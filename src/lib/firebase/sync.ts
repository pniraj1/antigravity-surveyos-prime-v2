// ═══════════════════════════════════════════════════════════
// CLOUD SYNC SERVICE
// Reconciles IndexedDB with Firestore
// Photos are EXCLUDED from Firestore (too large, local only)
// Uses "Latest Update Wins" (updatedAt) approach
// ═══════════════════════════════════════════════════════════

import { doc, setDoc, getDoc, collection, query, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './config';
import { ClaimData, SurveyorProfile } from '@/types';
import { getAllClaims, saveClaim } from '../storage/indexeddb';
import { useProfileStore } from '@/stores/profile-store';

/**
 * Strips photos from a claim before writing to Firestore.
 * Photos are base64 data URLs that can easily exceed Firestore's 1MB doc limit.
 * They remain safely in IndexedDB (local) only.
 */
function stripPhotos(claim: ClaimData): Omit<ClaimData, 'photos'> & { photos: [] } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { photos: _photos, ...rest } = claim;
  return { ...rest, photos: [] };
}

/**
 * Pushes a local claim to Firestore (without photos).
 */
export async function pushClaimToCloud(uid: string, claim: ClaimData) {
  const claimRef = doc(db, `users/${uid}/claims`, claim.id);
  
  // Before pushing, check if cloud has a newer version (conflict resolution)
  const cloudSnap = await getDoc(claimRef);
  if (cloudSnap.exists()) {
    const cloudData = cloudSnap.data() as ClaimData;
    if (new Date(cloudData.updatedAt) > new Date(claim.updatedAt)) {
      console.warn(`[Sync] Skipping push for ${claim.id}. Cloud version is newer.`);
      return cloudData;
    }
  }

  const payload = stripPhotos(claim);
  await setDoc(claimRef, { ...payload, ownerId: uid });
  console.log(`[Sync] Pushed claim ${claim.id} to cloud (photos excluded).`);
  return claim;
}

/**
 * Syncs all local claims to cloud (First Login Migration).
 * Also excludes photos from cloud storage.
 */
export async function syncAllLocalToCloud(uid: string) {
  const localClaims = await getAllClaims();
  if (localClaims.length === 0) return;

  console.log(`[Sync] Starting migration of ${localClaims.length} claims for user ${uid}...`);
  const batch = writeBatch(db);
  
  for (const claim of localClaims) {
    const claimRef = doc(db, `users/${uid}/claims`, claim.id);
    batch.set(claimRef, { ...stripPhotos(claim), ownerId: uid });
  }

  await batch.commit();
  console.log('[Sync] All local claims successfully backed up to cloud (photos kept local).');
}

/**
 * Pulls all claims from cloud for the current user.
 * Reconciles local data: Only overwrites if cloud is newer.
 * NOTE: Cloud docs won't have photos — local photos are preserved.
 */
export async function pullClaimsFromCloud(uid: string) {
  const claimsRef = collection(db, `users/${uid}/claims`);
  const q = query(claimsRef);
  const querySnap = await getDocs(q);

  const remoteClaims: ClaimData[] = [];
  querySnap.forEach((doc) => {
    remoteClaims.push(doc.data() as ClaimData);
  });

  for (const remote of remoteClaims) {
    const localList = await getAllClaims();
    const local = localList.find(c => c.id === remote.id);
    if (!local || new Date(remote.updatedAt) > new Date(local.updatedAt)) {
      // Preserve local photos if they exist — don't overwrite with empty array from cloud
      const mergedClaim: ClaimData = {
        ...remote,
        photos: local?.photos ?? [],
      };
      await saveClaim(mergedClaim);
      console.log(`[Sync] Updated local claim ${remote.id} from cloud (photos preserved).`);
    }
  }

  return remoteClaims;
}

/**
 * Pushes the current profile to Firestore.
 */
export async function pushProfileToCloud(uid: string, profile: SurveyorProfile) {
  const profileRef = doc(db, `users/${uid}/profile`, 'main');
  await setDoc(profileRef, { ...profile, ownerId: uid }, { merge: true });
  console.log(`[Sync] Profile pushed to cloud for user ${uid}.`);
}

/**
 * Pulls the profile from Firestore.
 */
export async function pullProfileFromCloud(uid: string) {
  const profileRef = doc(db, `users/${uid}/profile`, 'main');
  const snap = await getDoc(profileRef);
  
  if (snap.exists()) {
    const remoteProfile = snap.data() as SurveyorProfile;
    useProfileStore.getState().updateProfile(remoteProfile);
    console.log(`[Sync] Local profile updated from cloud for user ${uid}.`);
    return remoteProfile;
  }
  return null;
}
