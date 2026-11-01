/**
 * Prime's side of Scan's Drive status file (`SurveyOS/Phone Scans/<folder>/_surveyos-status.json`).
 * Contract: `SurveyOS Scan/docs/handover/scan-drive-status.md`. Claims with a `scanClaimId` only.
 * Any failure (no token, no folder, network) does nothing: one console warning per session, no toast.
 */
import type { ClaimData } from '@/types';
import type { DocType } from '@/types/documents';
import { DOC_TYPE_TO_TAG } from '@/types/documents';
import { useClaimStore } from '@/stores/claim-store';
import { driveRequest, findFolder, getDriveToken } from './index';
import { STATUS_FILE, parseStatus, statusToChase, statusToJson, withCompletion, withReceived, type Status } from './scan-status';

const API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';

let warned = false;
const warnOnce = (e: unknown) => {
  if (warned) return;
  warned = true;
  console.warn('[Drive] Scan status sync skipped:', e instanceof Error ? e.message : e);
};

/** Oldest first, so both apps pick the same item when there are duplicates. */
async function firstId(q: string): Promise<string | null> {
  const res = await driveRequest(`${API}?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive&orderBy=createdTime`);
  return ((await res.json()).files?.[0]?.id as string | undefined) ?? null;
}

/** `SurveyOS/Phone Scans`, where Scan keeps one folder per claim. Never creates anything. */
export async function phoneScansFolder(): Promise<string | null> {
  const root = localStorage.getItem('surveyos_drive_root') ?? (await findFolder('SurveyOS'));
  return (root && (await findFolder('Phone Scans', root))) || null;
}

/** The Scan claim folder, by `appProperties.claimId` (never by name), oldest first. Never creates anything. */
export async function findScanFolder(scanClaimId: string): Promise<string | null> {
  const phoneScans = await phoneScansFolder();
  if (!phoneScans) return null;
  const id = scanClaimId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return firstId(`mimeType='${FOLDER}' and '${phoneScans}' in parents and appProperties has { key='claimId' and value='${id}' } and trashed=false`);
}

async function readStatus(folderId: string): Promise<{ fileId: string | null; status: Status | null }> {
  const fileId = await firstId(`name='${STATUS_FILE}' and '${folderId}' in parents and trashed=false`);
  if (!fileId) return { fileId, status: null };
  const res = await driveRequest(`${API}/${fileId}?alt=media`);
  return { fileId, status: parseStatus(await res.text()) };
}

/** Updates in place when the file exists (PATCH by id), else creates it. Never a second file with that name. */
async function writeStatus(folderId: string, fileId: string | null, s: Status): Promise<void> {
  const form = new FormData();
  const meta = fileId ? {} : { name: STATUS_FILE, parents: [folderId], mimeType: 'application/json' };
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', new Blob([statusToJson(s)], { type: 'application/json' }));
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  await driveRequest(url, { method: fileId ? 'PATCH' : 'POST', body: form });
}

/** Stores the file's view in `scanChase` if this claim is still open and something changed. */
function applyToClaim(claimId: string, s: Status): void {
  const { currentClaim, updateClaim } = useClaimStore.getState();
  if (currentClaim?.id !== claimId) return;
  const next = statusToChase(s, currentClaim.scanChase);
  if (!next) return;
  const prev = currentClaim.scanChase;
  const same = (k: 'slotStates' | 'contacts' | 'asks') => JSON.stringify(prev?.[k]) === JSON.stringify(next[k]);
  if (!same('slotStates') || !same('contacts') || !same('asks')) updateClaim({ scanChase: next });
}

const linked = (claim: ClaimData | null | undefined): claim is ClaimData & { scanClaimId: string } =>
  !!claim?.scanClaimId && !!getDriveToken();

/** On claim open: read Scan's status and refresh `scanChase` (so the Ask dialog is current). */
export async function syncScanStatus(claim: ClaimData | null | undefined): Promise<void> {
  if (!linked(claim)) return;
  try {
    const folder = await findScanFolder(claim.scanClaimId);
    const status = folder && (await readStatus(folder)).status;
    if (status) applyToClaim(claim.id, status);
  } catch (e) { warnOnce(e); }
}

/** On a document upload: mark the base DocType slot received by Prime in Scan's status file. */
export async function markReceivedInScan(claim: ClaimData | null | undefined, type: DocType): Promise<void> {
  if (!linked(claim) || DOC_TYPE_TO_TAG[type]) return; // photo types are not Scan slots
  try {
    const folder = await findScanFolder(claim.scanClaimId);
    if (!folder) return;
    const { fileId, status } = await readStatus(folder);
    const merged = withReceived(status, claim.scanClaimId, type, Date.now());
    await writeStatus(folder, fileId, merged);
    applyToClaim(claim.id, merged);
  } catch (e) { warnOnce(e); }
}

/** On Mark completed / Reopen: set `status` (completed|active) in Scan's status file with updatedAt = now. */
export async function setCompletedInScan(claim: ClaimData | null | undefined, completed: boolean): Promise<void> {
  if (!linked(claim)) return;
  try {
    const folder = await findScanFolder(claim.scanClaimId);
    if (!folder) return;
    const { fileId, status } = await readStatus(folder);
    await writeStatus(folder, fileId, withCompletion(status, claim.scanClaimId, completed, Date.now()));
  } catch (e) { warnOnce(e); }
}
