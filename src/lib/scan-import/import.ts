/**
 * Brings a SurveyOS Scan export zip into the open claim: vehicle check, folder
 * check, content de-dupe, then the normal saveDocuments write per type.
 * No AI calls. Notes are only handed back; the notes review applies them.
 */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { DOC_TYPE_LABEL } from '@/types/documents';
import { useClaimStore } from '@/stores/claim-store';
import { getStoredRootHandle } from '@/lib/local-sync/directory-handle';
import { saveDocuments } from '@/lib/documents/sink';
import { readDocument } from '@/lib/documents/folder';
import { claimDocuments } from '@/lib/documents/index-ops';
import { readZip } from './zip';
import { findManifest, sameVehicle } from './manifest';

export type ImportResult =
  | { status: 'cancelled' }
  | { status: 'needs-folder' }
  | { status: 'done'; added: number; skipped: number; notes: unknown };

export interface ImportOptions {
  /** Asked only on a vehicle mismatch; false aborts before anything is written. */
  confirmVehicle: (zipVehicle: string, claimVehicle: string) => Promise<boolean>;
}

export function toDocType(type: string): DocType {
  return Object.hasOwn(DOC_TYPE_LABEL, type) ? (type as DocType) : 'other';
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes of the existing documents of `type` whose size matches one of `sizes`
 * (a different size cannot be the same bytes, so those are never read).
 * A document that can't be read here (another device, file gone) is not a duplicate.
 */
async function existingHashes(claim: ClaimData, type: DocType, sizes: Set<number>): Promise<Set<string>> {
  const out = new Set<string>();
  for (const doc of claimDocuments(claim)) {
    if (doc.type !== type || !sizes.has(doc.size)) continue;
    try { out.add(await sha256(await readDocument(claim, doc))); } catch { /* unreadable here: not a duplicate */ }
  }
  return out;
}

export async function importScanZip(blob: Blob, { confirmVehicle }: ImportOptions): Promise<ImportResult> {
  const claim = useClaimStore.getState().currentClaim;
  if (!claim) throw new Error('Open the claim first, then bring its phone scans.');
  const zipFiles = await readZip(blob);
  const { root, manifest } = await findManifest(zipFiles);

  const claimVehicle = claim.vehicle?.registrationNumber ?? '';
  if (!sameVehicle(manifest.vehicle, claimVehicle) && !(await confirmVehicle(manifest.vehicle, claimVehicle))) {
    return { status: 'cancelled' };
  }
  if (!(await getStoredRootHandle())) return { status: 'needs-folder' };

  // Every listed file must be in the zip before anything is written.
  const byType = new Map<DocType, Array<{ blob: Blob; name: string; sha: string }>>();
  for (const f of manifest.files) {
    const entry = zipFiles.get(`${root}${f.path}`);
    if (!entry) throw new Error(`This Scan export is incomplete: "${f.path}" is missing. Export it again from Scan.`);
    const type = toDocType(f.type);
    const list = byType.get(type) ?? [];
    list.push({ blob: entry, name: f.path.split('/').pop() ?? f.path, sha: (f.sha256 || (await sha256(entry))).toLowerCase() });
    byType.set(type, list);
  }

  let added = 0;
  let skipped = 0;
  for (const [type, files] of byType) {
    const seen = await existingHashes(claim, type, new Set(files.map((f) => f.blob.size)));
    const fresh = files.filter((f) => {
      if (seen.has(f.sha)) return false;
      seen.add(f.sha); // the same bytes twice in one zip land once
      return true;
    });
    skipped += files.length - fresh.length;
    if (fresh.length === 0) continue;
    // saveDocuments places multi-file types (photos) in their subfolder, as every other save does.
    const written: ClaimDocument[] = await saveDocuments(type, fresh.map(({ blob: b, name }) => ({ blob: b, name })), 'scan');
    added += written.length;
  }
  return { status: 'done', added, skipped, notes: manifest.notes ?? null };
}
