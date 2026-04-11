// ═══════════════════════════════════════════════════════════
// INDEXEDDB STORAGE — Offline-First Persistence
// Using 'idb' library for a clean async wrapper.
// Replaces: localStorage-based loadClaims/saveClaims
// ═══════════════════════════════════════════════════════════

import { openDB, type IDBPDatabase } from 'idb';
import type { ClaimData } from '@/types';

const DB_NAME = 'surveyos-v2';
const DB_VERSION = 2;

export interface DriveQueueItem {
  id: string;
  claimId: string;
  claimLabel: string;
  fileName: string;
  fileData: ArrayBuffer;
  mimeType: string;
  createdAt: string;
  retries: number;
}

interface SurveyOSDB {
  claims: {
    key: string;
    value: ClaimData;
    indexes: {
      'by-updated': string;
      'by-survey-type': string;
    };
  };
  syncQueue: {
    key: string;
    value: {
      id: string;
      type: 'telemetry' | 'drive-upload' | 'claim-backup';
      payload: unknown;
      createdAt: string;
      retries: number;
    };
  };
  driveQueue: {
    key: string;
    value: DriveQueueItem;
  };
  learning: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<SurveyOSDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SurveyOSDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SurveyOSDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Claims store
        if (!db.objectStoreNames.contains('claims')) {
          const claimStore = db.createObjectStore('claims', { keyPath: 'id' });
          claimStore.createIndex('by-updated', 'updatedAt');
          claimStore.createIndex('by-survey-type', 'surveyType');
        }
        // Sync queue for offline actions
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
        // Learning data
        if (!db.objectStoreNames.contains('learning')) {
          db.createObjectStore('learning', { keyPath: 'id' });
        }
        // Drive upload queue — persistent across page refreshes (v2)
        if (oldVersion < 2 && !db.objectStoreNames.contains('driveQueue')) {
          db.createObjectStore('driveQueue', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ─── Claims CRUD ────────────────────────────────────────

export async function saveClaim(claim: ClaimData): Promise<void> {
  const db = await getDB();
  await db.put('claims', { ...claim, updatedAt: new Date().toISOString() });
  
  // Notify other tabs and useClaimsLoader
  try {
    const channel = new BroadcastChannel('surveyos_claims_sync');
    channel.postMessage('CLAIMS_UPDATED');
    channel.close();
  } catch (e) {
    // Ignore error in environments without BroadcastChannel
  }
}

export async function getClaim(id: string): Promise<ClaimData | undefined> {
  const db = await getDB();
  return db.get('claims', id);
}

export async function getAllClaims(): Promise<ClaimData[]> {
  const db = await getDB();
  return db.getAllFromIndex('claims', 'by-updated');
}

export async function deleteClaim(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('claims', id);
}

// ─── Sync Queue ─────────────────────────────────────────

export async function addToSyncQueue(
  type: 'telemetry' | 'drive-upload' | 'claim-backup',
  payload: unknown
): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', {
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retries: 0,
  });
}

export async function getSyncQueue(): Promise<SurveyOSDB['syncQueue']['value'][]> {
  const db = await getDB();
  return db.getAll('syncQueue');
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

// ─── Drive Upload Queue ─────────────────────────────────
// Persists failed/pending Drive uploads across page refreshes.
// Blobs are stored as ArrayBuffer so IndexedDB can serialize them.

export async function addToDriveQueue(item: Omit<DriveQueueItem, 'id' | 'createdAt' | 'retries'>): Promise<void> {
  const db = await getDB();
  await db.put('driveQueue', {
    ...item,
    id: `drive-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    retries: 0,
  });
}

export async function getDriveQueue(): Promise<DriveQueueItem[]> {
  const db = await getDB();
  return db.getAll('driveQueue');
}

export async function removeDriveQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('driveQueue', id);
}

export async function incrementDriveQueueRetry(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('driveQueue', id);
  if (item) {
    await db.put('driveQueue', { ...item, retries: item.retries + 1 });
  }
}

export async function getDriveQueueCount(): Promise<number> {
  const db = await getDB();
  return db.count('driveQueue');
}

// ─── Learning Data ──────────────────────────────────────

export async function saveLearningData(key: string, data: unknown): Promise<void> {
  const db = await getDB();
  await db.put('learning', { id: key, ...data as Record<string, unknown> });
}

export async function getLearningData(key: string): Promise<unknown> {
  const db = await getDB();
  return db.get('learning', key);
}
