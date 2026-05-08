// ═══════════════════════════════════════════════════════════
// CLOUD SYNC SERVICE
// Reconciles IndexedDB with Firestore
// Photos are EXCLUDED from Firestore (too large, local only)
// Uses "Latest Update Wins" (updatedAt) approach
// ═══════════════════════════════════════════════════════════

import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './config';
import { ClaimData, SurveyorProfile } from '@/types';
import {
  getAllClaims,
  saveClaim,
  setPushedAt,
  getAllPushedAt,
  getTombstones,
  getTombstoneIds,
  removeTombstone,
} from '../storage/indexeddb';
import { useProfileStore } from '@/stores/profile-store';
import { logger } from '../utils/logger';

const LAST_SYNC_KEY_PREFIX = 'surveyos_last_sync_';
const BATCH_SIZE = 499;

/**
 * Returns the ISO timestamp of the last successful cloud sync for this user.
 * null = never synced (full sync required).
 */
export function getLastSyncTimestamp(uid: string): string | null {
  return localStorage.getItem(`${LAST_SYNC_KEY_PREFIX}${uid}`);
}

/**
 * Records a successful sync completion time.
 * Call this after both push and pull succeed.
 */
export function setLastSyncTimestamp(uid: string, timestamp: string): void {
  localStorage.setItem(`${LAST_SYNC_KEY_PREFIX}${uid}`, timestamp);
}

/** Recursively replaces undefined values with null for Firestore compatibility. */
function sanitize<T>(obj: T): T {
  if (obj === undefined) return null as unknown as T;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize) as unknown as T;
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, sanitize(v)])
  ) as T;
}

/**
 * Strips photos from a claim before writing to Firestore.
 * Also sanitizes undefined → null (Firestore rejects undefined values).
 */
function stripPhotos(claim: ClaimData): Omit<ClaimData, 'photos'> & { photos: [] } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { photos: _photos, ...rest } = claim;
  return sanitize({ ...rest, photos: [] }) as Omit<ClaimData, 'photos'> & { photos: [] };
}

/**
 * Pushes a single local claim to Firestore (without photos).
 * Used by the 2s debounced auto-save in useCloudSync.
 * No conflict check — debounced saves always win (last write wins).
 */
export async function pushClaimToCloud(uid: string, claim: ClaimData) {
  const claimRef = doc(db, `users/${uid}/claims`, claim.id);
  const payload = stripPhotos(claim);
  await setDoc(claimRef, { ...payload, ownerId: uid });
  // Record the successfully-pushed updatedAt so the pull reconciler can
  // detect locally-dirty claims that must not be overwritten by remote.
  await setPushedAt(claim.id, claim.updatedAt);
  logger.log(`[Sync] Pushed claim ${claim.id} to cloud (photos excluded).`);
  return claim;
}

/**
 * Deletes tombstoned claims from Firestore and clears local tombstones.
 * Call this before pullClaimsFromCloud so the pull doesn't resurrect
 * anything the user just deleted.
 */
export async function syncTombstones(uid: string): Promise<void> {
  const tombstones = await getTombstones();
  if (tombstones.length === 0) return;

  logger.log(`[Sync] Deleting ${tombstones.length} tombstoned claim(s) from cloud.`);
  for (const t of tombstones) {
    try {
      const claimRef = doc(db, `users/${uid}/claims`, t.id);
      await deleteDoc(claimRef);
      await removeTombstone(t.id);
      logger.log(`[Sync] Cloud delete for tombstoned claim ${t.id} succeeded.`);
    } catch (err) {
      // Keep the tombstone for the next sync attempt
      logger.error(`[Sync] Cloud delete for tombstoned claim ${t.id} failed:`, err);
    }
  }
}

/**
 * Delta sync: pushes only claims changed since the last sync.
 * Falls back to full push if sinceTimestamp is null (first login on this device).
 * Batches writes in groups of 499 to stay within Firestore's batch limit.
 */
export async function syncDeltaToCloud(uid: string, sinceTimestamp: string | null) {
  const localClaims = await getAllClaims();
  const changed = sinceTimestamp
    ? localClaims.filter(c => c.updatedAt > sinceTimestamp)
    : localClaims;

  if (changed.length === 0) {
    logger.log('[Sync] Delta push: no local changes since last sync.');
    return;
  }

  logger.log(`[Sync] Delta push: ${changed.length} claim(s) changed since ${sinceTimestamp ?? 'never'}.`);

  let batchErrors = 0;
  for (let i = 0; i < changed.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const chunk = changed.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const claim of chunk) {
      const claimRef = doc(db, `users/${uid}/claims`, claim.id);
      batch.set(claimRef, { ...stripPhotos(claim), ownerId: uid });
    }
    try {
      await batch.commit();
      // Record pushed updatedAt only after successful commit
      await Promise.all(chunk.map(c => setPushedAt(c.id, c.updatedAt)));
      logger.log(`[Sync] Delta push: committed batch ${batchNum} (${chunk.length} claims).`);
    } catch (err) {
      batchErrors++;
      logger.error(`[Sync] Delta push: batch ${batchNum} failed (${chunk.length} claims skipped):`, err);
    }
  }

  if (batchErrors > 0) {
    logger.error(`[Sync] Delta push completed with ${batchErrors} failed batch(es). Affected claims will retry on next sync.`);
    throw new Error(`Delta push: ${batchErrors} batch(es) failed`);
  }
  logger.log(`[Sync] Delta push complete (${changed.length} claims).`);
}

/**
 * Pulls claims from Firestore that changed since sinceTimestamp.
 * Falls back to full pull if sinceTimestamp is null (first login on this device).
 * Reconciles with local: only overwrites if cloud version is newer.
 * Local photos are always preserved (cloud never stores them).
 */
export async function pullClaimsFromCloud(uid: string, sinceTimestamp: string | null) {
  const claimsRef = collection(db, `users/${uid}/claims`);
  const q = sinceTimestamp
    ? query(claimsRef, where('updatedAt', '>', sinceTimestamp))
    : query(claimsRef);
  const querySnap = await getDocs(q);

  const remoteClaims: ClaimData[] = [];
  querySnap.forEach((d) => {
    remoteClaims.push(d.data() as ClaimData);
  });

  if (remoteClaims.length === 0) {
    logger.log('[Sync] Pull: no remote changes since last sync.');
    return remoteClaims;
  }

  logger.log(`[Sync] Pull: merging ${remoteClaims.length} claim(s) from cloud.`);

  // Hoist lookups once — avoids O(n²) from calling inside the loop
  const localList = await getAllClaims();
  const localMap = new Map(localList.map(c => [c.id, c]));
  const tombstoneIds = await getTombstoneIds();
  const pushedMap = await getAllPushedAt();

  for (const remote of remoteClaims) {
    // Skip any claim the user deleted locally — syncTombstones() is responsible
    // for deleting it from the cloud on the next push cycle.
    if (tombstoneIds.has(remote.id)) {
      logger.log(`[Sync] Skipping resurrection of tombstoned claim ${remote.id}.`);
      continue;
    }
    const local = localMap.get(remote.id);

    // Case 1: brand-new claim from cloud — always accept
    if (!local) {
      await saveClaim({ ...remote, photos: [] }, { preserveUpdatedAt: true });
      await setPushedAt(remote.id, remote.updatedAt);
      logger.log(`[Sync] Imported new claim ${remote.id} from cloud.`);
      continue;
    }

    // Case 2: local has unpushed edits — remote must NOT overwrite them.
    // A claim is "locally dirty" when its current updatedAt is newer than
    // the last value we successfully pushed to Firestore.
    const lastPushed = pushedMap.get(remote.id);
    const locallyDirty = !lastPushed || local.updatedAt > lastPushed;
    if (locallyDirty) {
      logger.log(`[Sync] Keeping local dirty claim ${remote.id} (unpushed edits).`);
      continue;
    }

    // Case 3: local is clean AND remote is newer — safe to overwrite.
    // Preserve local photos (never synced via Firestore).
    if (remote.updatedAt > local.updatedAt) {
      const mergedClaim: ClaimData = {
        ...remote,
        photos: local.photos ?? [],
      };
      await saveClaim(mergedClaim, { preserveUpdatedAt: true });
      // Re-record as pushed since local now matches remote.
      await setPushedAt(remote.id, remote.updatedAt);
      logger.log(`[Sync] Updated local claim ${remote.id} from cloud (photos preserved).`);
    }
  }

  const channel = new BroadcastChannel('surveyos_claims_sync');
  channel.postMessage('CLAIMS_UPDATED');
  channel.close();

  return remoteClaims;
}

/**
 * Pushes the current profile to Firestore.
 * Strips locally-only fields before write:
 * - signatureDataUrl / stampDataUrl — large base64 blobs, kept local only
 * - geminiApiKeys / groqApiKeys — sensitive credentials, kept local + Drive backup only
 */
export async function pushProfileToCloud(uid: string, profile: SurveyorProfile) {
  const profileRef = doc(db, `users/${uid}/profile`, 'current');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    signatureDataUrl: _sig,
    stampDataUrl: _stamp,
    geminiApiKeys: _gKeys,
    groqApiKeys: _rKeys,
    geminiApiKey: _gKey,
    groqApiKey: _rKey,
    ...cloudProfile
  } = profile;

  await setDoc(profileRef, { ...cloudProfile, ownerId: uid }, { merge: true });
  logger.log(`[Sync] Profile pushed to cloud for user ${uid}.`);
}

/**
 * Pulls the profile from Firestore and merges into the local store.
 * Local-only fields are preserved (not stored in cloud):
 * - signatureDataUrl / stampDataUrl — base64 blobs
 * - geminiApiKeys / groqApiKeys / geminiApiKey / groqApiKey — credentials
 */
export async function pullProfileFromCloud(uid: string) {
  const profileRef = doc(db, `users/${uid}/profile`, 'current');
  const profileSnap = await getDoc(profileRef);

  if (profileSnap.exists()) {
    const remoteProfile = profileSnap.data() as SurveyorProfile;
    const local = useProfileStore.getState().profile;

    useProfileStore.getState().updateProfile({
      ...remoteProfile,
      signatureDataUrl: local.signatureDataUrl,
      stampDataUrl: local.stampDataUrl,
      geminiApiKeys: local.geminiApiKeys,
      groqApiKeys: local.groqApiKeys,
      geminiApiKey: local.geminiApiKey,
      groqApiKey: local.groqApiKey,
    });

    logger.log(`[Sync] Local profile updated from cloud for user ${uid}.`);
    return remoteProfile;
  }
  return null;
}
