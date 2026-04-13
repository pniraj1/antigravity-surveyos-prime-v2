// ═══════════════════════════════════════════════════════════
// INDEXEDDB STORAGE — User-Scoped Offline-First Persistence
//
// ARCHITECTURE: Each surveyor gets their own IndexedDB database,
// named  `surveyos-v2-{firebaseUID}`.
//
// WHY USER-SCOPED:
//   If two surveyors share a PC and browser (e.g. a shared office
//   computer), their claims must never mix. Using a per-user database
//   guarantees hard isolation — Surveyor B opening the app after
//   Surveyor A logs out will see only their own data.
//
// USER IDs:
//   Firebase UIDs are globally unique, permanent identifiers tied to
//   a Google account. They do NOT change if the user changes their
//   email address. Format: 28-character alphanumeric string, e.g.
//   "QCgRlZdGF3etljVitH8xq3KsTqB2".
//   → Safe to use as a DB name suffix.
//   → Safe to use for subscription management / account suspension.
//
// LIFECYCLE:
//   1. initUserDB(uid)  — called by useAuth.ts when Firebase confirms login.
//                         Opens (or creates) the user's personal database.
//                         On first login after migration, copies claims
//                         from the legacy shared database.
//   2. closeUserDB()    — called by useAuth.ts when Firebase fires logout.
//                         Closes the DB connection and clears the module
//                         singleton so the next user starts clean.
//
// MIGRATION:
//   Legacy database name: "surveyos-v2" (shared, all users mixed together).
//   On first login per UID, claims from the legacy DB are copied into the
//   user's personal DB. A localStorage flag prevents re-migration.
//   The legacy DB is left intact as a safety net and can be manually
//   deleted after confirming all data migrated successfully.
//
// SUBSCRIPTION / ACCOUNT SUSPENSION:
//   The Firebase UID is the canonical identifier for a surveyor account.
//   To suspend an account: set { suspended: true } on the Firestore
//   profile document for that UID. The app reads this on login and can
//   block access accordingly. The UID is stable even if the surveyor
//   changes their Google account email.
// ═══════════════════════════════════════════════════════════

import { openDB, type IDBPDatabase } from 'idb';
import type { ClaimData } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Legacy database name (shared, pre-isolation).
 * Used only during one-time migration on first login per UID.
 */
const LEGACY_DB_NAME = 'surveyos-v2';

/**
 * Current database version. Bump this when adding new object stores
 * or indexes. The `upgrade` function handles all version transitions.
 */
const DB_VERSION = 2;

/**
 * localStorage key prefix for tracking whether a user's legacy data
 * has already been migrated to their personal database.
 * Full key: `surveyos_migrated_${uid}`
 */
const MIGRATION_FLAG_PREFIX = 'surveyos_migrated_';

// ─── Module-level State ──────────────────────────────────────────────────────
// These are intentionally module-scoped (not React state) because IndexedDB
// connections are shared across all components in a single browser tab.

/**
 * The Firebase UID of the currently active surveyor.
 * null = no user logged in, DB is closed.
 */
let currentUserId: string | null = null;

/**
 * Cached promise resolving to the open IDB connection for the current user.
 * Reset to null on logout or user switch so the next login opens a fresh DB.
 */
let dbPromise: Promise<IDBPDatabase<SurveyOSDB>> | null = null;

// ─── DB Schema ───────────────────────────────────────────────────────────────

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

// ─── DB Lifecycle ─────────────────────────────────────────────────────────────

/**
 * Opens (or creates) the personal database for a surveyor.
 * Must be called BEFORE any read/write operation.
 *
 * Called by: useAuth.ts → onAuthStateChanged (when user logs in)
 *
 * @param uid - Firebase UID of the authenticated surveyor.
 *              Unique per Google account, permanent, safe as a DB key.
 */
export async function initUserDB(uid: string): Promise<void> {
  if (currentUserId === uid && dbPromise) {
    // Same user refreshed the page — DB already initialised, nothing to do.
    return;
  }

  // Different user (or first load) — close any existing connection first.
  if (dbPromise) {
    const oldDb = await dbPromise.catch(() => null);
    oldDb?.close();
  }

  currentUserId = uid;
  dbPromise = openDB<SurveyOSDB>(`surveyos-v2-${uid}`, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Claims store — primary data store for survey claims
      if (!db.objectStoreNames.contains('claims')) {
        const claimStore = db.createObjectStore('claims', { keyPath: 'id' });
        claimStore.createIndex('by-updated', 'updatedAt');
        claimStore.createIndex('by-survey-type', 'surveyType');
      }
      // Sync queue — Firestore push retries when offline
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
      // Learning data — AI learning feedback per surveyor
      if (!db.objectStoreNames.contains('learning')) {
        db.createObjectStore('learning', { keyPath: 'id' });
      }
      // Drive queue — pending Google Drive uploads (added in v2)
      if (oldVersion < 2 && !db.objectStoreNames.contains('driveQueue')) {
        db.createObjectStore('driveQueue', { keyPath: 'id' });
      }
    },
  });

  // Run one-time migration from legacy shared DB (fire-and-forget, non-blocking)
  migrateFromLegacyDB(uid).catch(err =>
    console.warn('[DB] Legacy migration failed (non-critical):', err)
  );
}

/**
 * Closes the current user's database connection and clears the module state.
 * Must be called when a surveyor logs out so the next user starts clean.
 *
 * Called by: useAuth.ts → onAuthStateChanged (when user logs out)
 */
export async function closeUserDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    db?.close();
  }
  dbPromise = null;
  currentUserId = null;
}

/**
 * Returns the open database connection for the current user.
 * Throws if called before initUserDB — this is intentional to surface
 * coding errors where DB is accessed before auth is confirmed.
 */
function getDB(): Promise<IDBPDatabase<SurveyOSDB>> {
  if (!dbPromise || !currentUserId) {
    throw new Error(
      '[DB] No user database open. initUserDB(uid) must be called after login before any DB operation.'
    );
  }
  return dbPromise;
}

// ─── One-time Migration from Legacy Shared DB ─────────────────────────────────

/**
 * Copies claims from the old shared "surveyos-v2" database into the
 * user's personal "surveyos-v2-{uid}" database.
 *
 * Runs once per UID, tracked by a localStorage flag.
 * The legacy database is NOT deleted (safety net).
 *
 * @param uid - Firebase UID of the authenticated surveyor.
 */
async function migrateFromLegacyDB(uid: string): Promise<void> {
  const migrationKey = `${MIGRATION_FLAG_PREFIX}${uid}`;

  // Skip if already migrated
  if (localStorage.getItem(migrationKey) === 'done') return;

  let legacyDb: IDBPDatabase | null = null;
  try {
    // Check if the legacy DB exists by trying to open it
    legacyDb = await openDB(LEGACY_DB_NAME, DB_VERSION);
    const legacyClaims = await legacyDb.getAll('claims');

    if (!legacyClaims || legacyClaims.length === 0) {
      // Nothing to migrate
      localStorage.setItem(migrationKey, 'done');
      legacyDb.close();
      return;
    }

    // Write all legacy claims into the user's personal DB
    const db = await getDB();
    const tx = db.transaction('claims', 'readwrite');
    await Promise.all(legacyClaims.map(claim => tx.store.put(claim)));
    await tx.done;

    localStorage.setItem(migrationKey, 'done');
    console.info(
      `[DB] Migrated ${legacyClaims.length} claim(s) from legacy DB to surveyos-v2-${uid}`
    );
  } catch {
    // Legacy DB may not exist on this device — perfectly normal for new installs
    localStorage.setItem(migrationKey, 'done');
  } finally {
    legacyDb?.close();
  }
}

// ─── Claims CRUD ──────────────────────────────────────────────────────────────

/**
 * Save or update a claim in the current user's database.
 * Automatically updates `updatedAt` and notifies other tabs via BroadcastChannel.
 */
export async function saveClaim(claim: ClaimData): Promise<void> {
  const db = await getDB();
  await db.put('claims', { ...claim, updatedAt: new Date().toISOString() });

  // Notify other open tabs so their claim lists refresh
  try {
    const channel = new BroadcastChannel('surveyos_claims_sync');
    channel.postMessage('CLAIMS_UPDATED');
    channel.close();
  } catch {
    // BroadcastChannel unavailable in some environments — ignore
  }
}

/** Retrieve a single claim by its ID. Returns undefined if not found. */
export async function getClaim(id: string): Promise<ClaimData | undefined> {
  const db = await getDB();
  return db.get('claims', id);
}

/** Retrieve all claims for the current user, sorted by last updated (oldest first). */
export async function getAllClaims(): Promise<ClaimData[]> {
  const db = await getDB();
  return db.getAllFromIndex('claims', 'by-updated');
}

/** Permanently delete a claim from the current user's database. */
export async function deleteClaim(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('claims', id);
}

// ─── Sync Queue ───────────────────────────────────────────────────────────────
// Stores Firestore push operations that failed while offline.
// Drained automatically by useCloudSync when connectivity returns.

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

// ─── Drive Upload Queue ───────────────────────────────────────────────────────
// Persists failed or pending Google Drive uploads across page refreshes.
// Files are stored as ArrayBuffer so IndexedDB can serialise them.
// Drained automatically by flushDriveQueue() in src/lib/drive/index.ts.

export async function addToDriveQueue(
  item: Omit<DriveQueueItem, 'id' | 'createdAt' | 'retries'>
): Promise<void> {
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

// ─── Learning Data ────────────────────────────────────────────────────────────
// Stores per-surveyor AI learning feedback (vehicle damage patterns, etc.)

export async function saveLearningData(key: string, data: unknown): Promise<void> {
  const db = await getDB();
  await db.put('learning', { id: key, ...(data as Record<string, unknown>) });
}

export async function getLearningData(key: string): Promise<unknown> {
  const db = await getDB();
  return db.get('learning', key);
}
