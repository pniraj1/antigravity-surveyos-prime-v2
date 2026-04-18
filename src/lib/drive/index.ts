// ═══════════════════════════════════════════════════════════
// GOOGLE DRIVE INTEGRATION — SurveyOS Prime V2
// Token management, folder creation, file upload, index sync
// ═══════════════════════════════════════════════════════════

import { useUIStore } from '@/stores/ui-store';
import { useProfileStore } from '@/stores/profile-store';
import { toast } from 'sonner';
import {
  addToDriveQueue,
  getDriveQueue,
  removeDriveQueueItem,
  incrementDriveQueueRetry,
  getDriveQueueCount,
  getClaim,
  saveClaim,
} from '@/lib/storage/indexeddb';

// ─── Token State ─────────────────────────────────────────────────────────────
// Stored in localStorage so it survives page refreshes within the 58-min window.
const TOKEN_KEY  = 'surveyos_drive_token';
const EXPIRY_KEY = 'surveyos_drive_token_expiry';
const ROOT_FOLDER_NAME = 'SurveyOS';
const INDEX_FILE_NAME  = 'surveyos_index.json';
const MAX_RETRIES = 3;

function setStoredToken(token: string, expiresIn: number) {
  const expiry = Date.now() + expiresIn * 1000;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRY_KEY, String(expiry));
  } catch { /* storage full — ignore */ }
}

function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  } catch { /* ignore */ }
}

export function getDriveToken(): string | null {
  try {
    const token  = localStorage.getItem(TOKEN_KEY);
    const expiry = Number(localStorage.getItem(EXPIRY_KEY) || 0);
    if (token && Date.now() < expiry) return token;
    // Token expired — clean up storage
    if (token) clearStoredToken();
  } catch { /* localStorage unavailable */ }
  return null;
}

// ─── Silent token restore on page reload ─────────────────────────────────────
/**
 * Silently re-acquire a Drive access token without a popup.
 * Called on app load if `isDriveConnected` is true in localStorage.
 * Uses `prompt: 'none'` — if Google session is still active, returns a new token.
 * On failure (session expired, access revoked), clears the connected state.
 */
export function silentlyRestoreDriveToken(): Promise<boolean> {
  return new Promise((resolve) => {
    // @ts-ignore
    if (typeof google === 'undefined' || !google?.accounts?.oauth2) {
      resolve(false);
      return;
    }
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
    if (!clientId?.trim()) { resolve(false); return; }

    const { driveEmail } = useUIStore.getState();

    try {
      // @ts-ignore
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.email',
        ].join(' '),
        callback: async (response: any) => {
          if (response.error) {
            // Silent auth failed — do NOT disconnect. The token in localStorage
            // may still be valid (getDriveToken() checks expiry). If both are
            // gone, uploads will queue and the user will see a toast to re-link.
            resolve(false);
            return;
          }
          setStoredToken(response.access_token, response.expires_in ?? 3500);
          flushDriveQueue().catch(() => {});
          resolve(true);
        },
      });

      // `prompt: 'none'` + login_hint allows silent re-auth without a popup
      tokenClient.requestAccessToken({
        prompt: 'none',
        ...(driveEmail ? { login_hint: driveEmail } : {}),
      });
    } catch {
      // Silent auth unavailable — don't disconnect, token may still be in localStorage
      resolve(false);
    }
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export function linkGoogleDrive(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    if (typeof google === 'undefined' || !google?.accounts?.oauth2) {
      return reject(new Error('Google Identity Services not loaded. Please wait a moment and try again.'));
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
    if (!clientId?.trim()) {
      return reject(new Error('Google Drive is not configured. Contact support.'));
    }

    try {
      // @ts-ignore
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.email',
        ].join(' '),
        callback: async (response: any) => {
          if (response.error) {
            useUIStore.getState().setDriveConnected(false);
            return reject(new Error(response.error_description || response.error));
          }

          setStoredToken(response.access_token, response.expires_in ?? 3500);

          // Fetch the user's email
          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            });
            const info = res.ok ? await res.json() : {};
            useUIStore.getState().setDriveConnected(true, info.email ?? 'Google Drive Linked');
          } catch {
            useUIStore.getState().setDriveConnected(true, 'Google Drive Linked');
          }

          // Flush any queued uploads now that we have a token
          flushDriveQueue();
          resolve(true);
        },
      });

      tokenClient.requestAccessToken();
    } catch (e: any) {
      reject(e);
    }
  });
}

// ─── Drive API helpers ────────────────────────────────────────────────────────

async function driveRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getDriveToken();
  if (!token) throw new Error('Drive not linked. Please link your Google Drive first.');

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive API error ${res.status}: ${text}`);
  }
  return res;
}

/** Find a folder by name under a given parent (undefined = root). Returns ID or null. */
async function findFolder(name: string, parentId?: string): Promise<string | null> {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const res = await driveRequest(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`
  );
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

/** Create a folder and return its id. */
async function createFolder(name: string, parentId?: string): Promise<string> {
  const metadata: Record<string, any> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) metadata.parents = [parentId];

  const res = await driveRequest('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  const data = await res.json();
  return data.id as string;
}

/** Get or create the root SurveyOS folder. Cached in localStorage. */
async function getRootFolder(): Promise<string> {
  const cached = localStorage.getItem('surveyos_drive_root');
  if (cached) return cached;

  let id = await findFolder(ROOT_FOLDER_NAME);
  if (!id) id = await createFolder(ROOT_FOLDER_NAME);
  localStorage.setItem('surveyos_drive_root', id);
  return id;
}

// ─── Index file (maps claimId → folderId) ────────────────────────────────────

async function getIndexFileId(rootId: string): Promise<string | null> {
  const q = `name='${INDEX_FILE_NAME}' and '${rootId}' in parents and trashed=false`;
  const res = await driveRequest(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`
  );
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

export async function loadDriveIndex(): Promise<Record<string, string>> {
  try {
    const rootId = await getRootFolder();
    const fileId = await getIndexFileId(rootId);
    if (!fileId) return {};

    const res = await driveRequest(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    );
    return await res.json();
  } catch {
    return {};
  }
}

export async function saveDriveIndex(index: Record<string, string>): Promise<void> {
  try {
    const rootId = await getRootFolder();
    const fileId = await getIndexFileId(rootId);
    const content = JSON.stringify(index, null, 2);
    const blob = new Blob([content], { type: 'application/json' });

    if (fileId) {
      // Update existing
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({})], { type: 'application/json' }));
      form.append('file', blob);
      await driveRequest(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
        { method: 'PATCH', body: form }
      );
    } else {
      // Create new
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: INDEX_FILE_NAME, parents: [rootId] })], { type: 'application/json' }));
      form.append('file', blob);
      await driveRequest(
        `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
        { method: 'POST', body: form }
      );
    }
  } catch (e) {
    console.warn('[Drive] Failed to save index:', e);
  }
}

// ─── Claim Folder ─────────────────────────────────────────────────────────────

/**
 * Get or create a Drive folder for a claim.
 * Returns the folder ID and stores it in the index and localStorage.
 */
export async function getOrCreateClaimFolder(claimId: string, label: string): Promise<string> {
  // Check localStorage cache first for speed
  const cacheKey = `surveyos_drive_folder_${claimId}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;

  const index = await loadDriveIndex();
  if (index[claimId]) {
    localStorage.setItem(cacheKey, index[claimId]);
    return index[claimId];
  }

  // Create new folder
  const rootId = await getRootFolder();
  const folderName = `${label}_${claimId.slice(-6)}`;
  const folderId = await createFolder(folderName, rootId);

  // Update Drive index + localStorage cache
  index[claimId] = folderId;
  await saveDriveIndex(index);
  localStorage.setItem(cacheKey, folderId);

  // Persist folder ID back to the claim in IndexedDB so the sync indicator works
  try {
    const claim = await getClaim(claimId);
    if (claim) {
      await saveClaim({ ...claim, gDriveFolderId: folderId });
      const channel = new BroadcastChannel('surveyos_claims_sync');
      channel.postMessage('CLAIMS_UPDATED');
      channel.close();
    }
  } catch {
    // Non-critical — indicator will show on next folder access
  }

  return folderId;
}

// ─── File Upload ──────────────────────────────────────────────────────────────

/**
 * Upload a file (Blob or File) to the claim's Drive folder.
 * If Drive is not linked or network fails, queues to IndexedDB for retry on reconnect.
 * Shows toast notifications — never silent.
 */
export async function uploadFileToDrive(
  claimId: string,
  fileName: string,
  blob: Blob,
  claimLabel: string = claimId
): Promise<void> {
  if (!getDriveToken()) {
    // Drive not linked — queue persistently
    const fileData = await blob.arrayBuffer();
    await addToDriveQueue({ claimId, claimLabel, fileName, fileData, mimeType: blob.type || 'application/octet-stream' });
    const count = await getDriveQueueCount();
    toast.warning(`Drive not linked — "${fileName}" queued (${count} pending). Link Drive in Profile to sync.`, { duration: 5000 });
    return;
  }

  try {
    const folderId = await getOrCreateClaimFolder(claimId, claimLabel);
    const metadata = { name: fileName, parents: [folderId] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    await driveRequest(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      { method: 'POST', body: form }
    );
    toast.success(`"${fileName}" uploaded to Drive.`, { duration: 2500 });
  } catch (e: any) {
    // Network failure — queue to IndexedDB for retry
    const fileData = await blob.arrayBuffer();
    await addToDriveQueue({ claimId, claimLabel, fileName, fileData, mimeType: blob.type || 'application/octet-stream' });
    const count = await getDriveQueueCount();
    toast.error(`Upload failed for "${fileName}" — queued for retry when online (${count} pending).`, { duration: 6000 });
  }
}

/**
 * Drain the persistent Drive upload queue.
 * Called on reconnect or after Drive is linked.
 * Returns number of successfully uploaded files.
 */
export async function flushDriveQueue(): Promise<number> {
  if (!getDriveToken()) {
    toast.warning('Link your Google Drive in Profile to sync pending files.', { duration: 5000 });
    return 0;
  }

  const items = await getDriveQueue();
  if (items.length === 0) return 0;

  toast.info(`Syncing ${items.length} pending file(s) to Drive…`, { duration: 3000 });
  let successCount = 0;

  for (const item of items) {
    if (item.retries >= MAX_RETRIES) {
      toast.error(`"${item.fileName}" failed after ${MAX_RETRIES} attempts — please re-upload manually.`, { duration: 8000 });
      await removeDriveQueueItem(item.id);
      continue;
    }

    try {
      const blob = new Blob([item.fileData], { type: item.mimeType });
      const folderId = await getOrCreateClaimFolder(item.claimId, item.claimLabel);
      const metadata = { name: item.fileName, parents: [folderId] };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      await driveRequest(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        { method: 'POST', body: form }
      );

      await removeDriveQueueItem(item.id);
      successCount++;
    } catch {
      await incrementDriveQueueRetry(item.id);
    }
  }

  if (successCount > 0) {
    toast.success(`${successCount} file(s) synced to Drive.`, { duration: 3000 });
  }

  const remaining = await getDriveQueueCount();
  if (remaining > 0) {
    toast.warning(`${remaining} file(s) still pending — will retry when online.`, { duration: 5000 });
  }

  return successCount;
}

// ─── Profile Backup / Restore ────────────────────────────────────────────────

const PROFILE_FILE_NAME = 'surveyos_profile_backup.json';

/**
 * Backs up the entire SurveyorProfile (including base64 signatures and API keys) 
 * to Google Drive as a JSON file in the root folder.
 */
export async function backupProfileToDrive(profile: any): Promise<void> {
  const token = getDriveToken();
  if (!token) return; // Silent return if not linked

  try {
    const rootId = await getRootFolder();
    
    // Check if the file already exists
    const q = `name='${PROFILE_FILE_NAME}' and '${rootId}' in parents and trashed=false`;
    const searchRes = await driveRequest(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`
    );
    const searchData = await searchRes.json();
    const fileId = searchData.files?.[0]?.id ?? null;

    const content = JSON.stringify(profile, null, 2);
    const blob = new Blob([content], { type: 'application/json' });

    if (fileId) {
      // Update existing
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({})], { type: 'application/json' }));
      form.append('file', blob);
      await driveRequest(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
        { method: 'PATCH', body: form }
      );
    } else {
      // Create new
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: PROFILE_FILE_NAME, parents: [rootId] })], { type: 'application/json' }));
      form.append('file', blob);
      await driveRequest(
        `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
        { method: 'POST', body: form }
      );
    }
  } catch (e) {
    console.warn('[Drive] Failed to backup profile:', e);
  }
}

/**
 * Restores the SurveyorProfile from Google Drive.
 * This should typically be done once per session initialization.
 * Returns the profile object if found, otherwise null.
 */
export async function restoreProfileFromDrive(): Promise<any | null> {
  const token = getDriveToken();
  if (!token) return null; // Silent return if not linked

  try {
    const rootId = await getRootFolder();
    
    const q = `name='${PROFILE_FILE_NAME}' and '${rootId}' in parents and trashed=false`;
    const searchRes = await driveRequest(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`
    );
    const searchData = await searchRes.json();
    const fileId = searchData.files?.[0]?.id ?? null;

    if (!fileId) return null;

    const res = await driveRequest(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    );
    return await res.json();
  } catch (e) {
    console.warn('[Drive] Failed to restore profile:', e);
    return null;
  }
}

