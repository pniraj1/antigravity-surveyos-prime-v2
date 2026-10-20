'use client';
/**
 * Claim Document Kit: scan -> label pages -> identity checks -> per-portal checklist -> build upload files -> review.
 * Mount once (it runs the labelling effects) and pass the result down.
 *
 * Page texts and identity results are memory only: they can hold Aadhaar/PAN numbers, so they never reach the
 * claim, IndexedDB or Firestore. After a reload they are recomputed by reading the files again.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType, UploadSet } from '@/types/documents';
import { getDeviceLabel } from '@/lib/local-sync/directory-handle';
import { readDocument, writePortalUpload } from '../folder';
import { buildBoxFile, planBox, sha256Hex } from './build';
import { checklist, missingMessage } from './checklist';
import type { BoxState } from './checklist';
import {
  blockedBoxes, buildable, claimDrift, confirmAllLabels, identityMap, invalidateIfReviewed, labelClaim, overrideLabel, setPageLabels,
} from './orchestrate';
import { recipeFor } from './recipes';
import { whileReading } from './reading';
import { markReviewed, newUploadSet } from './review';

type Flow = NonNullable<ClaimData['portalFlow']>;
type Texts = Record<string, (string | null)[]>;

const latest = (): ClaimData | null => useClaimStore.getState().currentClaim;
const readSignature = (d: ClaimDocument, device: string): string => `${d.size}|${JSON.stringify(d.fingerprints?.[device] ?? null)}`;

export function useDocumentKit() {
  const claim = useClaimStore((s) => s.currentClaim);
  const updateClaim = useClaimStore((s) => s.updateClaim);
  const [device, setDevice] = useState<string | null>(null);
  const [texts, setTexts] = useState<Texts>({});
  // docId -> page texts as read this session, with the signature of the file they came from (memory only)
  const cacheRef = useRef(new Map<string, { sig: string; texts: (string | null)[] }>());
  const building = useRef(false);

  const claimId = claim?.id;
  const documents = claim?.documents;

  // A different claim: forget the previous one's texts.
  useEffect(() => { setTexts({}); cacheRef.current = new Map(); }, [claimId]);

  // Label pages after every Scan (it changes `documents`) and whenever the claim's documents change.
  useEffect(() => {
    const current = latest();
    if (!current || current.id !== claimId) return;
    let cancelled = false;
    void whileReading(async () => {
      const dev = await getDeviceLabel();
      if (cancelled) return;
      setDevice(dev);
      const cached = (d: ClaimDocument) => {
        const hit = cacheRef.current.get(d.id);
        return hit?.sig === readSignature(d, dev) ? hit.texts : undefined;
      };
      const { claim: next, texts: fresh } = await labelClaim(current, (d) => readDocument(current, d), dev, cached);
      const now = latest();
      // Files can be slow to read; drop the result if the claim moved on meanwhile (the new run redoes it).
      if (cancelled || now?.id !== current.id || now.documents !== current.documents) return;
      if (next !== current) updateClaim({ documents: next.documents });
      for (const [id, t] of Object.entries(fresh)) cacheRef.current.set(id, { sig: readSignature(current.documents![id], dev), texts: t });
      if (Object.keys(fresh).length) setTexts((prev) => ({ ...prev, ...fresh }));
    }).catch(() => { /* a file that cannot be read is skipped; labelling retries on the next change */ });
    return () => { cancelled = true; };
  }, [claimId, documents, updateClaim]);

  // Editing a field the identity checks compare against cancels every review.
  const fieldsKey = claim
    ? [claim.vehicle.registrationNumber, claim.vehicle.chassisNumber, claim.driver.name,
      claim.policy.policyNumber, claim.policy.claimNumber, claim.policy.insuredName].join('|')
    : '';
  const prevFields = useRef<{ id: string; key: string } | null>(null);
  useEffect(() => {
    const prev = prevFields.current;
    prevFields.current = claimId ? { id: claimId, key: fieldsKey } : null;
    const set = latest()?.uploadSet;
    if (!prev || prev.id !== claimId || prev.key === fieldsKey || !set) return;
    const cancelled = invalidateIfReviewed(set, { claimFields: true });
    if (cancelled) updateClaim({ uploadSet: cancelled });
  }, [claimId, fieldsKey, updateClaim]);

  const identity = useMemo(
    () => (claim && device ? identityMap(claim, device, texts) : {}),
    // identity compares only these claim fields; keying on them (not `claim`) skips edits elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documents, fieldsKey, device, texts],
  );
  const recipe = useMemo(
    () => (claim ? recipeFor(claim) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [claim?.policy.insurerName, claim?.portalFlow],
  );
  const states: BoxState[] = useMemo(
    () => (claim && recipe && device ? checklist(recipe, claim, { device, identity }) : []),
    [claim, recipe, device, identity],
  );
  const missingText = claim && recipe ? missingMessage(claim, states) : '';

  const apply = useCallback((patch: (c: ClaimData) => Partial<ClaimData> | null) => {
    const c = latest();
    const p = c && patch(c);
    if (p) updateClaim(p);
  }, [updateClaim]);

  const setFlow = useCallback((flow: Flow) => updateClaim({ portalFlow: flow }), [updateClaim]);

  const setNotNeeded = useCallback((boxId: string, notNeeded: boolean) => {
    if (!recipe) return;
    const key = `${recipe.portal}-${recipe.flow}`;
    apply((c) => {
      const rest = (c.notNeededBoxes?.[key] ?? []).filter((id) => id !== boxId);
      return { notNeededBoxes: { ...c.notNeededBoxes, [key]: notNeeded ? [...rest, boxId] : rest } };
    });
  }, [recipe, apply]);

  const setLabels = useCallback((docId: string, pages: number[], type: DocType) => apply((c) => setPageLabels(c, docId, pages, type)), [apply]);
  const confirmAll = useCallback(() => { if (device) apply((c) => confirmAllLabels(c, device)); }, [apply, device]);
  const useAnyway = useCallback((docId: string, page: number) => apply((c) => overrideLabel(c, docId, page, new Date().toISOString())), [apply]);

  const build = useCallback(async (): Promise<{ ok: true } | { ok: false; reason: string }> => {
    const c = latest();
    if (!c || !recipe) return { ok: false, reason: 'No upload recipe for this claim.' };
    const boxes = buildable(states);
    if (!boxes.length) return { ok: false, reason: 'Nothing is ready to build yet.' };
    if (building.current) return { ok: false, reason: 'A build is already running.' };
    building.current = true;
    try {
      return await whileReading(async () => {
        const read = async (docId: string) => {
          const doc = c.documents?.[docId];
          if (!doc) throw new Error('A source file is no longer in the claim.');
          const file = await readDocument(c, doc);
          return { blob: file, mime: file.type, name: file.name };
        };
        const built: UploadSet['boxes'] = {};
        const files: Array<{ name: string; blob: Blob }> = [];
        for (const s of boxes) {
          const plan = planBox(s);
          const out = await buildBoxFile(s.box, plan, read);
          files.push({ name: out.name, blob: out.blob });
          built[s.box.id] = {
            name: out.name, size: out.blob.size, pages: out.pages, sha256: await sha256Hex(out.blob),
            sources: [...new Set(plan.map((p) => p.docId))],
          };
        }
        await writePortalUpload(c, recipe.title, files);
        // A label edit or scan reset while building makes this set's sources and hashes stale.
        const drift = claimDrift(c, latest());
        if (drift === 'switched') return { ok: false as const, reason: 'The claim changed while building.' };
        if (drift === 'edited') return { ok: false as const, reason: 'Documents changed while building. Build again.' };
        updateClaim({ uploadSet: newUploadSet(recipe, c, built) });
        return { ok: true as const };
      });
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    } finally {
      building.current = false;
    }
  }, [recipe, states, updateClaim]);

  const set = claim?.uploadSet;
  const blocked = useMemo(() => (set ? blockedBoxes(states, Object.keys(set.boxes)) : []), [set, states]);
  const review = useMemo(() => ({
    set,
    blocked,
    markReviewed: (boxId: string | 'all') => apply((c) => {
      if (!c.uploadSet) return null;
      const next = markReviewed(c.uploadSet, boxId, new Date().toISOString(), blocked);
      return next === c.uploadSet ? null : { uploadSet: next };
    }),
  }), [set, blocked, apply]);

  return { recipe, states, identity, missingText, setFlow, setNotNeeded, setLabels, confirmAll, useAnyway, build, review };
}
