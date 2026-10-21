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
import { clearPortalUpload, readDocument, writePortalUpload } from '../folder';
import { planBox, sha256Hex } from './build';
import { checklist, missingMessage } from './checklist';
import { fileMatchesFingerprint } from './fingerprint';
import type { BoxState } from './checklist';
import {
  blockedBoxes, buildBoxes, buildable, claimDrift, confirmAllLabels, evictedTexts, identityMap, invalidateIfReviewed, labelClaim,
  mismatchedDocs, overrideLabel, readSignature, setPageLabels, toWrite,
} from './orchestrate';
import type { BoxError, BuiltBox } from './orchestrate';
import { recipeFor } from './recipes';
import { whileReading } from './reading';
import { identityFieldsKey, invalidate, markReviewed, newUploadSet, planSig, staleBoxes } from './review';

type Flow = NonNullable<ClaimData['portalFlow']>;
/** The built files, handed to the caller for previews. In memory only; never stored. */
export type BuiltFile = { boxId: string; name: string; blob: Blob };
type BuildResult = { ok: true; files: BuiltFile[]; errors: BoxError[] } | { ok: false; reason: string; errors?: BoxError[] };
type Texts = Record<string, (string | null)[]>;
type Source = { blob: Blob; mime: string; name: string };

const latest = (): ClaimData | null => useClaimStore.getState().currentClaim;

/**
 * Reads every source of `boxes` once. C2: a file that changed since it was labelled (or was never fingerprinted
 * here) refuses the whole build, returned as the reason. A file that can't be read fails only the boxes using it.
 */
async function readSources(c: ClaimData, boxes: BoxState[], device: string): Promise<string | ((docId: string) => Promise<Source>)> {
  const files = new Map<string, File>();
  const failed = new Map<string, string>();
  for (const id of new Set(boxes.flatMap((s) => planBox(s).map((p) => p.docId)))) {
    const doc = c.documents?.[id];
    if (!doc) { failed.set(id, 'A source file is no longer in the claim.'); continue; }
    let file: File;
    try { file = await readDocument(c, doc); } catch (err) {
      failed.set(id, `${doc.relPath} could not be read (${err instanceof Error ? err.message : String(err)}).`);
      continue;
    }
    if (!fileMatchesFingerprint(file, doc, device)) return `${doc.relPath} changed since it was labelled. Press Scan folder.`;
    files.set(id, file);
  }
  return async (docId) => {
    const file = files.get(docId);
    if (!file) throw new Error(failed.get(docId) ?? 'A source file could not be read.');
    return { blob: file, mime: file.type, name: file.name };
  };
}

/** The upload-set entry of every built box: what it was built from, and whether it went to the folder. */
async function setEntries(files: BuiltBox[], written: BuiltBox[]): Promise<UploadSet['boxes']> {
  const out: UploadSet['boxes'] = {};
  for (const f of files) {
    out[f.boxId] = {
      name: f.name, size: f.blob.size, pages: f.pages, sha256: await sha256Hex(f.blob),
      sources: [...new Set(f.plan.map((p) => p.docId))], planSig: planSig(f.state), written: written.includes(f),
    };
  }
  return out;
}

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
      // Texts read from a file that has changed since no longer describe it: its pages are pending until re-read.
      const gone = evictedTexts(cacheRef.current, current.documents ?? {}, dev);
      if (gone.length) {
        for (const id of gone) cacheRef.current.delete(id);
        setTexts((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !gone.includes(id))));
      }
      const cached = (d: ClaimDocument) => {
        const hit = cacheRef.current.get(d.id);
        return hit?.sig === readSignature(d, dev) ? hit.texts : undefined;
      };
      const { claim: next, texts: fresh, reset } = await labelClaim(current, (d) => readDocument(current, d), dev, cached);
      const now = latest();
      // Files can be slow to read; drop the result if the claim moved on meanwhile (the new run redoes it).
      if (cancelled || !now || now.id !== current.id || now.documents !== current.documents) return;
      if (next !== current) {
        // A file found changed since its labels were made: every review built from it no longer holds.
        const cancelledSet = reset.length && now.uploadSet ? invalidateIfReviewed(now.uploadSet, { docIds: reset }) : null;
        updateClaim({ documents: next.documents, ...(cancelledSet ? { uploadSet: cancelledSet } : {}) });
      }
      // Keyed on the entry as saved now (with its new fingerprint), so the next run finds the texts.
      for (const [id, t] of Object.entries(fresh)) cacheRef.current.set(id, { sig: readSignature(next.documents![id], dev), texts: t });
      if (Object.keys(fresh).length) setTexts((prev) => ({ ...prev, ...fresh }));
    }).catch(() => { /* a file that cannot be read is skipped; labelling retries on the next change */ });
    return () => { cancelled = true; };
  }, [claimId, documents, updateClaim]);

  const fieldsKey = claim ? identityFieldsKey(claim) : '';
  const identity = useMemo(
    () => (claim && device ? identityMap(claim, device, texts) : {}),
    // identity compares only these claim fields; keying on them (not `claim`) skips edits elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documents, fieldsKey, device, texts],
  );
  // A page newly found not to match (its text just loaded, or a claim field changed) cancels the reviews of
  // the boxes using its file. Only new ones: a box that is blocked by a known mismatch isn't marked again.
  const seenMismatch = useRef<{ id?: string; docs: string[] }>({ docs: [] });
  useEffect(() => {
    const c = latest();
    if (!c || c.id !== claimId) return;
    const now = mismatchedDocs(identity, c);
    const before = seenMismatch.current.id === claimId ? seenMismatch.current.docs : [];
    seenMismatch.current = { id: claimId, docs: now };
    const added = now.filter((id) => !before.includes(id));
    const cancelled = added.length && c.uploadSet ? invalidateIfReviewed(c.uploadSet, { docIds: added }) : null;
    if (cancelled) updateClaim({ uploadSet: cancelled });
  }, [identity, claimId, updateClaim]);

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

  // I-5: anything that changes what a box would be built from (a source removed, replaced or swapped, a box
  // marked not needed, an identity field edited even while this tab was closed) makes its built file stale.
  // Judged against the signatures stored at build time; written only when a box newly turns stale.
  useEffect(() => {
    const now = latest();
    const set = now?.uploadSet;
    // Only while this render's claim is the current one (the set may be newer: another effect may have just marked it).
    if (!claim || !set || !device || !recipe || !states.length || now.id !== claim.id || now.documents !== claim.documents) return;
    if (set.portal !== recipe.portal || set.flow !== recipe.flow) return; // states are for another portal list
    const ids = staleBoxes(set, states, claim, device);
    const next = ids.length ? invalidateIfReviewed(set, { boxIds: ids }) : null;
    if (next) updateClaim({ uploadSet: next });
  }, [claim, states, device, recipe, updateClaim]);

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

  const build = useCallback(async (): Promise<BuildResult> => {
    const c = latest();
    if (!c || !recipe || !device) return { ok: false, reason: 'No upload recipe for this claim.' };
    const boxes = buildable(states);
    if (!boxes.length) return { ok: false, reason: 'Nothing is ready to build yet.' };
    if (building.current) return { ok: false, reason: 'A build is already running.' };
    building.current = true;
    try {
      return await whileReading(async (): Promise<BuildResult> => {
        const read = await readSources(c, boxes, device);
        if (typeof read === 'string') return { ok: false, reason: read };
        const { files, errors } = await buildBoxes(boxes, read);
        if (!files.length) return { ok: false, reason: 'No upload file could be built.', errors };
        const moved = (d: ReturnType<typeof claimDrift>) =>
          (d === 'switched' ? 'The claim changed while building.' : 'Documents changed while building. Build again.');
        // Nothing is written when a label edit or scan reset landed while reading and building.
        const before = claimDrift(c, latest());
        if (before !== 'same') return { ok: false, reason: moved(before), errors };
        // I-3: only ready boxes go to the folder, and it keeps nothing else: it holds exactly what the review covers.
        const written = toWrite(files, boxes);
        await clearPortalUpload(c, recipe.title, written.map((f) => f.name));
        await writePortalUpload(c, recipe.title, written);
        const set = newUploadSet(recipe, c, await setEntries(files, written));
        // The folder holds these files now, so the set is recorded; a change during the write makes it all stale.
        const after = claimDrift(c, latest());
        if (after === 'switched') return { ok: false, reason: moved(after), errors };
        updateClaim({ uploadSet: after === 'same' ? set : invalidate(set, { claimFields: true }) });
        if (after === 'edited') return { ok: false, reason: moved(after), errors };
        return { ok: true, files: files.map(({ boxId, name, blob }) => ({ boxId, name, blob })), errors };
      });
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    } finally {
      building.current = false;
    }
  }, [recipe, states, device, updateClaim]);

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

export type DocumentKit = ReturnType<typeof useDocumentKit>;
