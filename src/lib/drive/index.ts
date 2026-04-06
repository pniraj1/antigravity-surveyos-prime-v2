// ═══════════════════════════════════════════════════════════
// GOOGLE DRIVE INTEGRATION — SurveyOS Prime V2
// Token management, folder creation, file upload, index sync
// ═══════════════════════════════════════════════════════════

import { useUIStore } from '@/stores/ui-store';
import { useProfileStore } from '@/stores/profile-store';

// ─── Token State (in-memory) ─────────────────────────────────────────────────
let accessToken: string | null = null;
let tokenExpiryTimestamp: number = 0;
const ROOT_FOLDER_NAME = 'SurveyOS';
const INDEX_FILE_NAME  = 'surveyos_index.json';

// Pending uploads queue — for files uploaded before Drive folder is ready
const pendingQueue: { claimId: string; fileName: string; blob: Blob }[] = [];

export function getDriveToken(): string | null {
  if (accessToken && Date.now() < tokenExpiryTimestamp) return accessToken;
  return null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export function linkGoogleDrive(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    if (typeof google === 'undefined' || !google?.accounts?.oauth2) {
      return reject(new Error('Google Identity Services not loaded. Please wait a moment and try again.'));
    }

    const { profile } = useProfileStore.getState();
    if (!profile.googleClientId?.trim()) {
      return reject(new Error('Google Client ID is missing. Please paste it in the field below first.'));
    }

    try {
      // @ts-ignore
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: profile.googleClientId.trim(),
        scope: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.email',
        ].join(' '),
        callback: async (response: any) => {
          if (response.error) {
            useUIStore.getState().setDriveConnected(false);
            return reject(new Error(response.error_description || response.error));
          }

          accessToken = response.access_token;
          tokenExpiryTimestamp = Date.now() + ((response.expires_in ?? 3500) * 1000);

          // Fetch the user's email
          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const info = res.ok ? await res.json() : {};
            useUIStore.getState().setDriveConnected(true, info.email ?? 'Google Drive Linked');
          } catch {
            useUIStore.getState().setDriveConnected(true, 'Google Drive Linked');
          }

          // Flush any queued uploads now that we have a token
          flushPendingQueue();
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

  // Update index
  index[claimId] = folderId;
  await saveDriveIndex(index);
  localStorage.setItem(cacheKey, folderId);

  return folderId;
}

// ─── File Upload ──────────────────────────────────────────────────────────────

/**
 * Upload a file (Blob or File) to the claim's Drive folder.
 * Queues silently if Drive is not linked yet.
 */
export async function uploadFileToDrive(
  claimId: string,
  fileName: string,
  blob: Blob,
  claimLabel: string = claimId
): Promise<void> {
  if (!getDriveToken()) {
    // Queue for later
    pendingQueue.push({ claimId, fileName, blob });
    console.log(`[Drive] Queued "${fileName}" — Drive not linked yet.`);
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
    console.log(`[Drive] Uploaded "${fileName}" to folder ${folderId}`);
  } catch (e) {
    console.warn(`[Drive] Upload failed for "${fileName}":`, e);
  }
}

/** Replay all queued uploads after Drive is linked. */
async function flushPendingQueue() {
  const items = [...pendingQueue];
  pendingQueue.length = 0;
  for (const item of items) {
    await uploadFileToDrive(item.claimId, item.fileName, item.blob);
  }
}
