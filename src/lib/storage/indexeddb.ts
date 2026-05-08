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
import { logger } from '@/lib/utils/logger';

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
const DB_VERSION = 3;

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
  tombstones: {
    key: string;
    value: { id: string; deletedAt: string };
  };
  pushTracking: {
    key: string;
    value: { id: string; pushedUpdatedAt: string };
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
      // Tombstones — deleted claim IDs, pushed to cloud to prevent resurrection (v3)
      if (oldVersion < 3 && !db.objectStoreNames.contains('tombstones')) {
        db.createObjectStore('tombstones', { keyPath: 'id' });
      }
      // Push tracking — last successfully-pushed updatedAt per claim (v3)
      if (oldVersion < 3 && !db.objectStoreNames.contains('pushTracking')) {
        db.createObjectStore('pushTracking', { keyPath: 'id' });
      }
    },
  });

  // Run one-time migration from legacy shared DB (fire-and-forget, non-blocking)
  migrateFromLegacyDB(uid).catch(err =>
    logger.warn('[DB] Legacy migration failed (non-critical):', err)
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

  // Step 1: Try to open the legacy DB. If it doesn't exist, migration is
  // trivially complete — mark done and return.
  let legacyDb: IDBPDatabase | null = null;
  let legacyClaims: ClaimData[] = [];
  try {
    legacyDb = await openDB(LEGACY_DB_NAME, DB_VERSION);
    legacyClaims = (await legacyDb.getAll('claims')) as ClaimData[];
  } catch {
    // Legacy DB doesn't exist on this device — normal for fresh installs
    localStorage.setItem(migrationKey, 'done');
    legacyDb?.close();
    return;
  }

  // Step 2: Perform migration. If anything throws here, DO NOT mark done —
  // we want the next login to retry so data isn't lost permanently.
  try {
    // Strict ownerId match: un-owned legacy claims stay in legacy DB for
    // manual recovery. This prevents cross-account leakage on shared devices.
    const owned = legacyClaims.filter((c: ClaimData) => c.ownerId === uid);
    if (owned.length === 0) {
      localStorage.setItem(migrationKey, 'done');
      return;
    }
    const db = await getDB();
    const tx = db.transaction('claims', 'readwrite');
    await Promise.all(owned.map((c: ClaimData) => tx.store.put(c)));
    await tx.done;

    // Only mark done after the transaction has committed successfully.
    localStorage.setItem(migrationKey, 'done');
    logger.info(
      `[DB] Migrated ${owned.length} of ${legacyClaims.length} legacy claim(s) to surveyos-v2-${uid}`
    );
  } catch (err) {
    // Transaction failed — leave flag unset so migration retries next login
    logger.warn('[DB] Legacy migration transaction failed, will retry on next login:', err);
  } finally {
    legacyDb?.close();
  }
}

// ─── Claims CRUD ──────────────────────────────────────────────────────────────

/**
 * Save or update a claim in the current user's database.
 * Automatically updates `updatedAt` and notifies other tabs via BroadcastChannel.
 */
export class StorageFullError extends Error {
  constructor() {
    super('STORAGE_QUOTA_EXCEEDED');
    this.name = 'StorageFullError';
  }
}

export async function saveClaim(
  claim: ClaimData,
  options: { preserveUpdatedAt?: boolean } = {}
): Promise<void> {
  const db = await getDB();
  const toWrite = options.preserveUpdatedAt
    ? claim
    : { ...claim, updatedAt: new Date().toISOString() };
  try {
    await db.put('claims', toWrite);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new StorageFullError();
    }
    throw err;
  }

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

/**
 * Permanently delete a claim from the current user's database and
 * record a tombstone so the cloud deletion can be synced later and so
 * the next pull doesn't resurrect the claim.
 */
export async function deleteClaim(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['claims', 'tombstones', 'pushTracking'], 'readwrite');
  await tx.objectStore('claims').delete(id);
  await tx.objectStore('tombstones').put({ id, deletedAt: new Date().toISOString() });
  // Clean up push tracking for the deleted claim
  await tx.objectStore('pushTracking').delete(id);
  await tx.done;
}

// ─── Tombstones ──────────────────────────────────────────────────────────────
// Records deleted claim IDs so the cloud can be told to delete them and
// the pull reconciler can skip any remote docs that were deleted locally.

export async function getTombstones(): Promise<{ id: string; deletedAt: string }[]> {
  const db = await getDB();
  return db.getAll('tombstones');
}

export async function getTombstoneIds(): Promise<Set<string>> {
  const db = await getDB();
  const all = await db.getAll('tombstones');
  return new Set(all.map(t => t.id));
}

export async function removeTombstone(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tombstones', id);
}

// ─── Push Tracking ───────────────────────────────────────────────────────────
// Records the `updatedAt` value that was last successfully pushed to Firestore.
// Used by the pull reconciler to detect locally-dirty claims that must not be
// overwritten by remote even if remote.updatedAt > local.updatedAt.

export async function setPushedAt(id: string, pushedUpdatedAt: string): Promise<void> {
  const db = await getDB();
  await db.put('pushTracking', { id, pushedUpdatedAt });
}

export async function getPushedAt(id: string): Promise<string | null> {
  const db = await getDB();
  const rec = await db.get('pushTracking', id);
  return rec?.pushedUpdatedAt ?? null;
}

export async function getAllPushedAt(): Promise<Map<string, string>> {
  const db = await getDB();
  const all = await db.getAll('pushTracking');
  return new Map(all.map(r => [r.id, r.pushedUpdatedAt]));
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

const DRIVE_QUEUE_SIZE_LIMIT = 500 * 1024 * 1024; // 500 MB

export async function addToDriveQueue(
  item: Omit<DriveQueueItem, 'id' | 'createdAt' | 'retries'>
): Promise<void> {
  const db = await getDB();

  const existing = await db.getAll('driveQueue');
  const totalBytes = existing.reduce((sum, q) => sum + q.fileData.byteLength, 0);
  if (totalBytes + item.fileData.byteLength > DRIVE_QUEUE_SIZE_LIMIT) {
    logger.warn('[DriveQueue] Queue exceeds 500 MB — Drive may not be syncing. Item rejected:', item.fileName);
    throw new Error('DRIVE_QUEUE_FULL');
  }

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
