// ═══════════════════════════════════════════════════════════
// CLOUD SYNC SERVICE
// Reconciles IndexedDB with Firestore
// Photos are EXCLUDED from Firestore (too large, local only)
// Uses "Latest Update Wins" (updatedAt) approach
// ═══════════════════════════════════════════════════════════

import { doc, setDoc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './config';
import { ClaimData, SurveyorProfile } from '@/types';
import { getAllClaims, saveClaim } from '../storage/indexeddb';
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
  logger.log(`[Sync] Pushed claim ${claim.id} to cloud (photos excluded).`);
  return claim;
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

  for (let i = 0; i < changed.length; i += BATCH_SIZE) {
    const chunk = changed.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const claim of chunk) {
      const claimRef = doc(db, `users/${uid}/claims`, claim.id);
      batch.set(claimRef, { ...stripPhotos(claim), ownerId: uid });
    }
    await batch.commit();
    logger.log(`[Sync] Delta push: committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} claims).`);
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

  // Hoist getAllClaims() once — avoids O(n²) from calling inside the loop
  const localList = await getAllClaims();
  const localMap = new Map(localList.map(c => [c.id, c]));

  for (const remote of remoteClaims) {
    const local = localMap.get(remote.id);
    if (!local || remote.updatedAt > local.updatedAt) {
      const mergedClaim: ClaimData = {
        ...remote,
        photos: local?.photos ?? [],
      };
      await saveClaim(mergedClaim);
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
 * signatureDataUrl and stampDataUrl are stripped — large base64 blobs are
 * kept locally only (same pattern as claim photos).
 * SECURITY NOTE: geminiApiKeys and groqApiKeys are included in the cloud backup
 * intentionally — they enable multi-device restore. Access is restricted to the
 * owner UID by firestore.rules. If Firebase console access is ever shared with
 * team members, consider encrypting these fields before storage.
 */
export async function pushProfileToCloud(uid: string, profile: SurveyorProfile) {
  const profileRef = doc(db, `users/${uid}/profile`, 'current');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    signatureDataUrl: _sig,
    stampDataUrl: _stamp,
    ...cloudProfile
  } = profile;

  await setDoc(profileRef, { ...cloudProfile, ownerId: uid }, { merge: true });
  logger.log(`[Sync] Profile pushed to cloud for user ${uid}.`);
}

/**
 * Pulls the profile from Firestore and merges into the local store.
 * Local signatureDataUrl and stampDataUrl are preserved (not stored in cloud).
 * API keys pulled from the cloud will overwrite local keys.
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
    });

    logger.log(`[Sync] Local profile updated from cloud for user ${uid}.`);
    return remoteProfile;
  }
  return null;
}
