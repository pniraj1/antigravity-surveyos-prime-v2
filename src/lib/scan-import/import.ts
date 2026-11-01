/**
 * Brings a SurveyOS Scan export (a zip, or the claim's Drive folder) into the open claim: vehicle check, folder
 * check, content de-dupe, then the normal saveDocuments write per type.
 * No AI calls. Notes are only handed back; the notes review applies them.
 */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { DOC_TYPE_LABEL, MULTI_FILE_TYPES } from '@/types/documents';
import { useClaimStore } from '@/stores/claim-store';
import { getStoredRootHandle } from '@/lib/local-sync/directory-handle';
import { saveDocuments } from '@/lib/documents/sink';
import { readDocument } from '@/lib/documents/folder';
import { claimDocuments } from '@/lib/documents/index-ops';
import { readZip } from './zip';
import type { ScanChase, ScanManifestFile } from './manifest';
import { findManifest, sameVehicle } from './manifest';
import { planChase } from './chase';
import { setAt } from './path';

export type ImportResult =
  | { status: 'cancelled' }
  | { status: 'needs-folder' }
  /** A folder is stored but this session has no write access yet ("Allow access" needs a click). */
  | { status: 'needs-permission' }
  /** The surveyor opened another claim mid-import; types saved before the switch stay saved. */
  | { status: 'claim-changed'; added: number }
  /** `failed`: files whose save failed (the sink already toasted why); re-importing retries them safely. */
  | { status: 'done'; added: number; skipped: number; failed: number; notes: unknown; contactsFilled: number;
      /** Drive source only: ids of the source files whose content the claim now holds (saved now, or already there). */
      inPrime?: string[];
      /** Drive source only: types left untouched because some of their pages could not be had ("<label>: n pages ..."). */
      kept?: string[] };

export interface ImportOptions {
  /** Asked only on a vehicle mismatch; false aborts before anything is written. */
  confirmVehicle: (zipVehicle: string, claimVehicle: string) => Promise<boolean>;
  /** Asked only when the zip's Scan claim id differs from the one this claim is linked to; false aborts. */
  confirmRelink?: (zipClaimId: string, linkedClaimId: string) => Promise<boolean>;
  /**
   * Drive source: manifest path -> Drive file id, for the files still in Scan's folder. A listed file missing from
   * the source was moved into Prime on an earlier import, so it is skipped rather than "incomplete".
   */
  driveFileIds?: ReadonlyMap<string, string>;
}

export function toDocType(type: string): DocType {
  return Object.hasOwn(DOC_TYPE_LABEL, type) ? (type as DocType) : 'other';
}

// ponytail: the types Scan exports; anything else stays untyped and naming falls back to the file's extension.
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
};

function typedBlob(blob: Blob, name: string): Blob {
  const mime = MIME_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''];
  return mime ? new Blob([blob], { type: mime }) : blob;
}

export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The existing documents of `type` by content hash, with their files. With `sizes`, only documents of one of
 * those sizes are read (a different size cannot be the same bytes).
 * A document that can't be read here (another device, file gone) is not a duplicate.
 */
async function existingByHash(claim: ClaimData, type: DocType, sizes?: Set<number>): Promise<Map<string, { doc: ClaimDocument; blob: Blob }>> {
  const out = new Map<string, { doc: ClaimDocument; blob: Blob }>();
  for (const doc of claimDocuments(claim)) {
    if (doc.type !== type || (sizes && !sizes.has(doc.size))) continue;
    try {
      const blob = await readDocument(claim, doc);
      out.set(await sha256(blob), { doc, blob });
    } catch { /* unreadable here: not a duplicate */ }
  }
  return out;
}

export async function importScanZip(blob: Blob, options: ImportOptions): Promise<ImportResult> {
  return importScanFiles(await readZip(blob), options);
}

/** The import core. `zipFiles`: path -> contents, as `readZip` returns them (a Drive source builds the same map). */
export async function importScanFiles(
  zipFiles: Map<string, Blob>,
  { confirmVehicle, confirmRelink, driveFileIds }: ImportOptions,
): Promise<ImportResult> {
  const claim = useClaimStore.getState().currentClaim;
  if (!claim) throw new Error('Open the claim first, then bring its phone scans.');
  const claimVehicle = claim.vehicle?.registrationNumber ?? '';
  const { root, manifest } = await findManifest(zipFiles, claimVehicle);
  // A zip from another phone claim needs the surveyor's yes before anything is written (notes included).
  let relink = false;
  if (planChase(claim, manifest.chase, manifest.claimId).conflict) {
    relink = !!confirmRelink && (await confirmRelink(manifest.claimId ?? '', claim.scanClaimId ?? ''));
    if (!relink) throw new Error('These phone scans are from a different claim on the phone. Open the matching claim in Prime.');
  }

  if (!sameVehicle(manifest.vehicle, claimVehicle) && !(await confirmVehicle(manifest.vehicle, claimVehicle))) {
    return { status: 'cancelled' };
  }
  const rootHandle = await getStoredRootHandle();
  if (!rootHandle) return { status: 'needs-folder' };
  // requestPermission needs a click, which is long gone after reading the zip: ask the caller to send the
  // surveyor to "Allow access" instead of letting every type's write fail with its own toast.
  if (rootHandle.queryPermission && (await rootHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    return { status: 'needs-permission' };
  }

  // Every listed file must be in the zip before anything is written (a Drive source skips the ones already moved).
  const byType = new Map<DocType, Array<{ f: ScanManifestFile; entry?: Blob }>>();
  for (const f of manifest.files) {
    const entry = zipFiles.get(`${root}${f.path}`);
    if (!entry && !driveFileIds) throw new Error(`This Scan export is incomplete: "${f.path}" is missing. Export it again from Scan.`);
    const type = toDocType(f.type);
    byType.set(type, [...(byType.get(type) ?? []), { f, entry }]);
  }

  let added = 0;
  let skipped = 0;
  let failed = 0;
  const inPrime: string[] = [];
  const kept: string[] = [];
  const stillHere = () => useClaimStore.getState().currentClaim?.id === claim.id;
  for (const [type, items] of byType) {
    if (!stillHere()) return { status: 'claim-changed', added };
    const present = items.filter((i) => i.entry);
    if (present.length === 0) continue; // all moved into Prime on earlier Drive imports
    // A single-file type is rewritten whole: pages moved on an earlier Drive import come back from the claim's own copies.
    const refill = !MULTI_FILE_TYPES.has(type) && present.length < items.length;
    const have = await existingByHash(claim, type, refill ? undefined : new Set(present.map((i) => i.entry!.size)));
    const files: Array<{ blob: Blob; name: string; sha: string; driveFileId?: string }> = [];
    let unavailable = 0;
    for (const { f, entry } of items) {
      const name = f.path.split('/').pop() ?? f.path;
      // The real bytes, never the manifest's sha256: a stale manifest must not skip a new file.
      if (entry) files.push({ blob: typedBlob(entry, name), name, sha: await sha256(entry), driveFileId: driveFileIds?.get(f.path) });
      else if (refill) {
        const hit = have.get(f.sha256);
        if (hit) files.push({ blob: typedBlob(hit.blob, name), name, sha: f.sha256, driveFileId: hit.doc.driveFileId });
        else unavailable++;
      }
    }
    // A page found neither on Drive nor here: rewriting the type would drop it, so leave the type (and its Drive files) as is.
    if (unavailable) { kept.push(`${DOC_TYPE_LABEL[type]}: ${unavailable} page${unavailable === 1 ? '' : 's'} not available, kept as is`); continue; }
    const presentIds = present.flatMap((i) => driveFileIds?.get(i.f.path) ?? []);
    const seen = new Set(have.keys());
    const fresh = files.filter((f) => {
      if (seen.has(f.sha)) return false;
      seen.add(f.sha); // the same bytes twice in one zip land once
      return true;
    });
    if (fresh.length === 0) { skipped += present.length; inPrime.push(...presentIds); continue; }
    // A single-file type is replaced as a whole by the write rules, so when anything is new write the zip's
    // full set for it (de-duped within the zip); writing only the new page would drop the earlier ones from the list.
    const toWrite = MULTI_FILE_TYPES.has(type) ? fresh : files.filter((f, i) => files.findIndex((g) => g.sha === f.sha) === i);
    skipped += files.length - toWrite.length;
    // saveDocuments places multi-file types (photos) in their subfolder, as every other save does.
    // claim.id: the sink re-checks at its turn in the queue, so a switch while waiting writes nothing.
    const inputs = toWrite.map(({ blob: b, name, driveFileId }) => ({ blob: b, name, ...(driveFileId && { driveFileId }) }));
    const written: ClaimDocument[] = await saveDocuments(type, inputs, 'scan', claim.id);
    added += written.length;
    if (written.length === 0 && !stillHere()) return { status: 'claim-changed', added };
    failed += toWrite.length - written.length;
    if (written.length === toWrite.length) inPrime.push(...presentIds); // the sink writes all of a type or none
  }
  if (!stillHere()) return { status: 'claim-changed', added };
  return {
    status: 'done', added, skipped, failed, notes: manifest.notes ?? null, contactsFilled: applyChase(manifest, relink),
    ...(driveFileIds && { inPrime, kept }),
  };
}

/** Fills blank contacts, stores the chase state and the Scan claim id. Returns how many contacts were filled. */
function applyChase(manifest: { chase?: ScanChase; claimId?: string }, relink: boolean): number {
  const { currentClaim, updateClaim } = useClaimStore.getState();
  if (!currentClaim) return 0;
  const plan = planChase(currentClaim, manifest.chase, manifest.claimId, relink);
  if (plan.conflict) return 0;
  const next = plan.fills.reduce<ClaimData>((acc, f) => setAt(acc, f.path, f.value), currentClaim);
  const updates: Record<string, unknown> = {};
  for (const section of new Set(plan.fills.map((f) => f.path.split('.')[0]))) {
    updates[section] = (next as unknown as Record<string, unknown>)[section];
  }
  if (manifest.chase) updates.scanChase = plan.next;
  if (plan.scanClaimId) updates.scanClaimId = plan.scanClaimId;
  if (Object.keys(updates).length) updateClaim(updates as Partial<ClaimData>);
  return plan.fills.length;
}
