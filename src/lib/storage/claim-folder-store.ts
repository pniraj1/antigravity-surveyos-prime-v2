// ═══════════════════════════════════════════════════════════
// CLAIM FOLDER STORE — Per-Claim Directory Handle Isolation
//
// ARCHITECTURE:
//   Motor insurance surveyors frequently organize claim files in
//   arbitrary directories on their local PC (by insurer, survey type,
//   garage, or vehicle registration).
//   To prevent cross-claim collisions and data loss, directory handles
//   are strictly partitioned per claim ID in IndexedDB (`claim-handles`).
//
// DB SCHEMA:
//   Database: `surveyos-local-sync` (Version 2)
//   Store: `claim-handles`
//   Key: `claimId` (in-line keyPath)
//   Value: {
//     claimId: string,
//     handle: FileSystemDirectoryHandle,
//     folderPath: string,
//     assignedAt: string
//   }
// ═══════════════════════════════════════════════════════════

import { openDB, type IDBPDatabase } from 'idb';
import { useClaimStore } from '@/stores/claim-store';
import { folderNameFor } from '@/lib/documents/naming';

export const DB_NAME = 'surveyos-local-sync';
export const DB_VERSION = 2;
export const CLAIM_HANDLES_STORE = 'claim-handles';
export const LEGACY_HANDLES_STORE = 'handles';

export interface ClaimFolderRecord {
  claimId: string;
  handle: FileSystemDirectoryHandle;
  folderPath: string;
  assignedAt: string;
}

export interface LocalSyncDB {
  [LEGACY_HANDLES_STORE]: {
    key: string;
    value: unknown;
  };
  [CLAIM_HANDLES_STORE]: {
    key: string;
    value: ClaimFolderRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<LocalSyncDB>> | null = null;

export async function getLocalSyncDB(): Promise<IDBPDatabase<LocalSyncDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LocalSyncDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(LEGACY_HANDLES_STORE)) {
          db.createObjectStore(LEGACY_HANDLES_STORE);
        }
        if (!db.objectStoreNames.contains(CLAIM_HANDLES_STORE)) {
          db.createObjectStore(CLAIM_HANDLES_STORE, { keyPath: 'claimId' });
        }
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/** Reset cached database connection promise (useful for tests or teardown). */
export function _resetLocalSyncDBForTesting(): void {
  dbPromise = null;
}

/**
 * Checks whether the current browser supports the File System Access API
 * directory picker (e.g., desktop Chromium: Chrome, Edge, Brave).
 */
export function isLocalFolderSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/**
 * Persists a FileSystemDirectoryHandle for a specific claim.
 * Strict isolation: The handle is stored strictly under the provided claimId.
 */
export async function setClaimFolderHandle(
  claimId: string,
  handle: FileSystemDirectoryHandle,
  folderPath?: string
): Promise<void> {
  const trimmedId = claimId?.trim();
  if (!trimmedId) {
    throw new Error('claimId is required to set claim folder handle');
  }

  const resolvedPath = folderPath?.trim() || handle?.name?.trim() || 'Selected Folder';

  const record: ClaimFolderRecord = {
    claimId: trimmedId,
    handle,
    folderPath: resolvedPath,
    assignedAt: new Date().toISOString(),
  };

  const database = await getLocalSyncDB();
  await database.put(CLAIM_HANDLES_STORE, record);
}

/**
 * Retrieves the stored FileSystemDirectoryHandle for a claim.
 * Strict isolation invariant:
 * - Returns null if the claim has no allocated folder.
 * - Never returns another claim's handle.
 */
export async function getClaimFolderHandle(
  claimId: string
): Promise<FileSystemDirectoryHandle | null> {
  const trimmedId = claimId?.trim();
  if (!trimmedId) return null;

  try {
    const database = await getLocalSyncDB();
    const record = await database.get(CLAIM_HANDLES_STORE, trimmedId);
    return record?.handle ?? null;
  } catch {
    return null;
  }
}

/**
 * Retrieves the human-readable folder name / path for a claim, or null if unassigned.
 */
export async function getClaimFolderPath(
  claimId: string
): Promise<string | null> {
  const trimmedId = claimId?.trim();
  if (!trimmedId) return null;

  try {
    const database = await getLocalSyncDB();
    const record = await database.get(CLAIM_HANDLES_STORE, trimmedId);
    return record?.folderPath ?? null;
  } catch {
    return null;
  }
}

/**
 * Removes the directory handle assignment for a specific claim.
 */
export async function removeClaimFolderHandle(
  claimId: string
): Promise<void> {
  const trimmedId = claimId?.trim();
  if (!trimmedId) return;

  try {
    const database = await getLocalSyncDB();
    await database.delete(CLAIM_HANDLES_STORE, trimmedId);
  } catch {
    // Graceful no-op
  }
}

/**
 * Verifies or requests permission on a directory handle.
 * Returns true if permission is granted, false otherwise.
 * Catches SecurityError gracefully when called without user gesture.
 */
export async function verifyHandlePermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' | boolean = 'readwrite'
): Promise<boolean> {
  if (!handle) return false;
  if (typeof handle.queryPermission !== 'function') return true;

  try {
    const resolvedMode: 'read' | 'readwrite' = mode === false || mode === 'read' ? 'read' : 'readwrite';
    const opts = { mode: resolvedMode };
    const queryStatus = await handle.queryPermission(opts);
    if (queryStatus === 'granted') return true;

    if (typeof handle.requestPermission === 'function') {
      const requestStatus = await handle.requestPermission(opts);
      return requestStatus === 'granted';
    }
    return false;
  } catch {
    // If requestPermission throws (e.g., SecurityError outside user gesture), return false
    return false;
  }
}

const plate = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * The vehicle's own folder for the picked one. A surveyor often picks a general folder (D:\Claims, Documents):
 * using it as is would put every claim's files loose in it together, so the vehicle folder is created inside.
 * A picked folder whose name already has the vehicle number is the vehicle folder.
 * ponytail: only the open claim's vehicle number is known here; no number (or another claim) keeps the pick as is.
 */
async function vehicleFolderIn(picked: FileSystemDirectoryHandle, claimId: string): Promise<FileSystemDirectoryHandle> {
  const claim = useClaimStore.getState().currentClaim;
  const reg = plate(claim?.id === claimId ? claim.vehicle?.registrationNumber ?? '' : '');
  if (!claim || !reg || plate(picked.name).includes(reg)) return picked;
  // documentsFolder can hold an earlier pick's name ("Claims"): the vehicle folder is named afresh.
  return picked.getDirectoryHandle(folderNameFor({ ...claim, documentsFolder: undefined }), { create: true });
}

/**
 * Prompts the user to pick a folder for the given claim via `showDirectoryPicker`,
 * persists the handle and folder name in IndexedDB, and returns them.
 */
export async function pickClaimFolder(
  claimId: string
): Promise<{ handle: FileSystemDirectoryHandle; folderPath: string }> {
  const trimmedId = claimId?.trim();
  if (!trimmedId) {
    throw new Error('claimId is required to pick claim folder');
  }

  if (!isLocalFolderSupported()) {
    throw new Error('This browser cannot open a local folder. Use desktop Chrome or Edge.');
  }

  const picked = await window.showDirectoryPicker!({ mode: 'readwrite' });
  const handle = await vehicleFolderIn(picked, trimmedId);
  const folderPath = handle?.name || 'Selected Folder';

  await setClaimFolderHandle(trimmedId, handle, folderPath);

  return { handle, folderPath };
}
