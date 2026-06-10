// ═══════════════════════════════════════════════════════════
// SYNC BRIDGE CLIENT — calls the SurveyOS Sync Cloudflare Worker.
// Read-only. Auth via the per-surveyor bridge token (Bearer).
// ═══════════════════════════════════════════════════════════

import type { BridgeResponse, SyncClaimSummary, SyncClaimDetail } from './types';

export const SYNC_WORKER_URL = 'https://surveyos-sync-worker.pnirajindia.workers.dev';

function extFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('pdf')) return 'pdf';
  return 'jpg';
}

async function parse<T>(resp: Response): Promise<T> {
  const json = (await resp.json()) as BridgeResponse<T>;
  if (!json.ok || json.data === undefined) {
    throw new Error(json.error ?? 'SurveyOS Sync request failed');
  }
  return json.data;
}

/** Exchange a one-time link code (+ Firebase UID) for a long-lived bridge token. */
export async function redeemLinkCode(code: string, firebaseUid: string): Promise<string> {
  const resp = await fetch(`${SYNC_WORKER_URL}/api/bridge/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, firebaseUid }),
  });
  const data = await parse<{ bridgeToken: string }>(resp);
  return data.bridgeToken;
}

/** List the surveyor's Sync claims (drive "folders"). */
export async function listSyncClaims(token: string): Promise<SyncClaimSummary[]> {
  const resp = await fetch(`${SYNC_WORKER_URL}/api/bridge/claims`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parse<SyncClaimSummary[]>(resp);
}

/** Get one claim's document manifest. */
export async function getSyncClaim(token: string, claimId: string): Promise<SyncClaimDetail> {
  const resp = await fetch(
    `${SYNC_WORKER_URL}/api/bridge/claims/${encodeURIComponent(claimId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return parse<SyncClaimDetail>(resp);
}

/** Stream one specific file (by index) from a multi-file slot, named "<docType> <n>.<ext>". */
export async function fetchSyncDocFileAt(
  token: string,
  claimId: string,
  docId: string,
  fileIndex: number,
  docType: string,
): Promise<File> {
  const resp = await fetch(
    `${SYNC_WORKER_URL}/api/bridge/file/${encodeURIComponent(claimId)}/${encodeURIComponent(docId)}/${fileIndex}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp.ok) throw new Error('Could not download the file from SurveyOS Sync');
  const blob = await resp.blob();
  const mime = resp.headers.get('Content-Type') ?? blob.type ?? 'application/octet-stream';
  const safeType = docType.replace(/[^\w\- ]+/g, '').trim() || 'document';
  return new File([blob], `${safeType} ${fileIndex + 1}.${extFor(mime)}`, { type: mime });
}

/** Stream one document's bytes and wrap them as a File for the existing upload flow. */
export async function fetchSyncDocFile(
  token: string,
  claimId: string,
  docId: string,
  docType: string,
): Promise<File> {
  const resp = await fetch(
    `${SYNC_WORKER_URL}/api/bridge/file/${encodeURIComponent(claimId)}/${encodeURIComponent(docId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp.ok) throw new Error('Could not download the document from SurveyOS Sync');
  const blob = await resp.blob();
  const mime = resp.headers.get('Content-Type') ?? blob.type ?? 'application/octet-stream';
  const safeType = docType.replace(/[^\w\- ]+/g, '').trim() || 'document';
  return new File([blob], `${safeType}.${extFor(mime)}`, { type: mime });
}
