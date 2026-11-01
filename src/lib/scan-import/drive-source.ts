/**
 * "Import from Drive": Scan's claim folder (Settings › Drive backup › Full) as an import source.
 * Files are moved, never copied: each file the claim now holds is moved into Prime's claim folder (same file id),
 * so the next import finds only what is new. Contract: SurveyOS Scan docs/handover/scan-drive-status.md.
 */
import type { ClaimData } from '@/types/claim';
import { useClaimStore } from '@/stores/claim-store';
import { driveRequest, getOrCreateClaimFolder, moveFile } from '@/lib/drive';
import { findScanFolder, phoneScansFolder } from '@/lib/drive/scan-status-sync';
import { claimDocuments } from '@/lib/documents/index-ops';
import { importScanFiles, sha256, type ImportOptions, type ImportResult } from './import';
import { MANIFEST_NAME, sameVehicle, type ScanManifest } from './manifest';

const API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';
const FULL_HINT = 'In Scan, turn on Settings › Drive backup › Full, then try again.';

/** A file in Scan's claim folder. `name` is its path inside that folder ("Final Photos/Final Photos 1.jpg"). */
export interface ListedFile { name: string; id: string; parent?: string; createdTime?: string }

export interface DriveImportPlan {
  present: Array<{ path: string; id: string; parent?: string }>;
  /** Listed in the manifest but gone from the folder: moved into Prime on an earlier import. */
  absent: string[];
}

/** Manifest files still in the folder (the newest by `createdTime` when Scan re-uploaded one under the same name) and the rest. */
export function planDriveImport(manifest: Pick<ScanManifest, 'files'>, listed: ListedFile[]): DriveImportPlan {
  const newest = new Map<string, ListedFile>();
  for (const l of listed) {
    const cur = newest.get(l.name);
    if (!cur || (l.createdTime ?? '') > (cur.createdTime ?? '')) newest.set(l.name, l);
  }
  const plan: DriveImportPlan = { present: [], absent: [] };
  for (const { path } of manifest.files) {
    const l = newest.get(path);
    if (l) plan.present.push({ path, id: l.id, parent: l.parent });
    else plan.absent.push(path);
  }
  return plan;
}

interface DriveItem { id: string; name: string; mimeType: string; createdTime?: string }

async function children(folderId: string, extraQuery = ''): Promise<DriveItem[]> {
  const out: DriveItem[] = [];
  let pageToken = '';
  do {
    const qs = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false${extraQuery}`,
      fields: 'nextPageToken,files(id,name,mimeType,createdTime)',
      spaces: 'drive',
      pageSize: '1000',
      ...(pageToken && { pageToken }),
    });
    const data = await (await driveRequest(`${API}?${qs}`)).json();
    out.push(...((data.files ?? []) as DriveItem[]));
    pageToken = data.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

/** Every file in the folder and its subfolders ("Final Photos", ...), with paths relative to it. */
async function listTree(folderId: string, prefix = ''): Promise<ListedFile[]> {
  const out: ListedFile[] = [];
  for (const item of await children(folderId)) {
    if (item.mimeType === FOLDER) out.push(...(await listTree(item.id, `${prefix}${item.name}/`)));
    else out.push({ name: `${prefix}${item.name}`, id: item.id, parent: folderId, createdTime: item.createdTime });
  }
  return out;
}

const download = async (id: string): Promise<Blob> => (await driveRequest(`${API}/${encodeURIComponent(id)}?alt=media`)).blob();

async function readManifest(id: string): Promise<{ blob: Blob; manifest: ScanManifest }> {
  const blob = await download(id);
  try {
    const manifest = JSON.parse(await blob.text()) as ScanManifest;
    if (manifest?.app === 'surveyos-scan' && Array.isArray(manifest.files)) return { blob, manifest };
  } catch { /* falls through */ }
  throw new Error('Not a SurveyOS Scan export');
}

export interface DriveImportOptions extends Omit<ImportOptions, 'driveFileIds'> {
  /** Several phone claims on Drive match an unlinked claim's vehicle: the surveyor picks one (null cancels). */
  choose?: (folders: Array<{ id: string; name: string }>) => Promise<string | null>;
}

/**
 * The Scan folder for this claim: by its linked `scanClaimId`, else the Phone Scans folders whose manifest vehicle
 * matches the claim. ponytail: an unlinked claim reads every phone claim's manifest; narrow by folder name if that gets slow.
 */
async function scanFolderFor(claim: ClaimData, choose: DriveImportOptions['choose']): Promise<string | null> {
  if (claim.scanClaimId) {
    const id = await findScanFolder(claim.scanClaimId);
    if (!id) throw new Error(`No Drive folder for this claim's phone scans. ${FULL_HINT}`);
    return id;
  }
  const vehicle = claim.vehicle?.registrationNumber ?? '';
  const phoneScans = await phoneScansFolder();
  const matches: Array<{ id: string; name: string }> = [];
  for (const folder of phoneScans ? await children(phoneScans, ` and mimeType='${FOLDER}'`) : []) {
    const m = (await children(folder.id, ` and name='${MANIFEST_NAME}'`))[0];
    if (m && sameVehicle((await readManifest(m.id).catch(() => null))?.manifest.vehicle ?? '', vehicle)) {
      matches.push({ id: folder.id, name: folder.name });
    }
  }
  if (matches.length === 0) throw new Error(`No phone scans on Drive for ${vehicle || 'this claim'}. ${FULL_HINT}`);
  if (matches.length === 1) return matches[0].id;
  return choose ? choose(matches) : null;
}

export interface DriveImport {
  result: ImportResult;
  /** Files saved in the claim that could not be moved on Drive; the next import moves them. */
  moveFailed: number;
  /** Files whose bytes do not match the manifest (still uploading, or older than it): left for the next import. */
  mismatched: string[];
}

/** Imports the open claim's phone scans from Scan's Drive folder, as a zip import would, then moves the files into Prime. */
export async function importFromDrive(opts: DriveImportOptions): Promise<DriveImport> {
  const claim = useClaimStore.getState().currentClaim;
  if (!claim) throw new Error('Open the claim first, then bring its phone scans.');
  const folderId = await scanFolderFor(claim, opts.choose);
  if (!folderId) return { result: { status: 'cancelled' }, moveFailed: 0, mismatched: [] };

  const listed = await listTree(folderId);
  const manifestFile = listed.find((l) => l.name === MANIFEST_NAME);
  if (!manifestFile) throw new Error(`No phone files on Drive for this claim yet. ${FULL_HINT}`);
  const { blob: manifestBlob, manifest } = await readManifest(manifestFile.id);

  // Saved on an earlier import whose move failed: move it now, never import it again.
  const known = new Set(claimDocuments(claim).flatMap((d) => d.driveFileId ?? []));
  const plan = planDriveImport(manifest, listed);
  const files = new Map<string, Blob>([[MANIFEST_NAME, manifestBlob]]);
  const driveFileIds = new Map<string, string>();
  const mismatched: string[] = [];
  const shaOf = new Map(manifest.files.map((f) => [f.path, f.sha256]));
  for (const p of plan.present.filter((x) => !known.has(x.id))) {
    const blob = await download(p.id);
    if ((await sha256(blob)) !== shaOf.get(p.path)) { mismatched.push(p.path); continue; }
    files.set(p.path, blob);
    driveFileIds.set(p.path, p.id);
  }

  const result = await importScanFiles(files, { ...opts, driveFileIds });
  if (result.status !== 'done') return { result, moveFailed: 0, mismatched };

  const parentOf = new Map(listed.map((l) => [l.id, l.parent ?? folderId]));
  const toMove = [...listed.filter((l) => known.has(l.id)).map((l) => l.id), ...(result.inPrime ?? [])];
  let moveFailed = 0;
  if (toMove.length) {
    try {
      const to = await getOrCreateClaimFolder(claim.id, claim.vehicle?.registrationNumber || claim.id);
      for (const id of toMove) {
        try { await moveFile(id, to, parentOf.get(id) ?? folderId); } catch { moveFailed++; }
      }
    } catch { moveFailed = toMove.length; }
  }
  return { result, moveFailed, mismatched };
}
