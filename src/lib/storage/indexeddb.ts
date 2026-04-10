// ═══════════════════════════════════════════════════════════
// INDEXEDDB STORAGE — Offline-First Persistence
// Using 'idb' library for a clean async wrapper.
// Replaces: localStorage-based loadClaims/saveClaims
// ═══════════════════════════════════════════════════════════

import { openDB, type IDBPDatabase } from 'idb';
import type { ClaimData } from '@/types';

const DB_NAME = 'surveyos-v2';
const DB_VERSION = 1;

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
  learning: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<SurveyOSDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SurveyOSDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SurveyOSDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
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

// ─── Learning Data ──────────────────────────────────────

export async function saveLearningData(key: string, data: unknown): Promise<void> {
  const db = await getDB();
  await db.put('learning', { id: key, ...data as Record<string, unknown> });
}

export async function getLearningData(key: string): Promise<unknown> {
  const db = await getDB();
  return db.get('learning', key);
}
