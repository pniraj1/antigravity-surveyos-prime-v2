// ═══════════════════════════════════════════════════════════
// PRIVATE PROFILE SYNC — AI keys, signature, stamp
// Lives in users/{uid}/secrets/* (owner + admin, like the rest of the user's
// data), not profile/current, so the Admin Panel's profile listing doesn't pull
// every surveyor's keys and images. One doc per group so a large stamp image
// can never push the keys doc past Firestore's 1 MB cap.
// ═══════════════════════════════════════════════════════════

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from './config';
import type { SurveyorProfile } from '@/types';
import { useProfileStore } from '@/stores/profile-store';
import { logger } from '../utils/logger';

const SECRET_GROUPS = {
  aiKeys: ['geminiApiKeys', 'groqApiKeys', 'nvidiaApiKeys', 'ollamaApiKeys'],
  signature: ['signatureDataUrl'],
  stamp: ['stampDataUrl'],
} as const;
type GroupId = keyof typeof SECRET_GROUPS;
const GROUP_IDS = Object.keys(SECRET_GROUPS) as GroupId[];

export type SecretValues = Record<string, string[] | string | null>;

const MAX_DOC_CHARS = 900_000; // Firestore caps a document at 1 MiB
const SYNCED_FLAG_PREFIX = 'surveyos_secrets_synced_';

// Last JSON written/read per `${uid}/${group}` — a push only writes a group
// whose values actually changed, so a stale laptop editing its name never
// overwrites a key another laptop removed.
const lastSynced = new Map<string, string>();
// A push before this session's pull could clobber newer cloud values.
const pulledUids = new Set<string>();

const secretRef = (uid: string, group: GroupId) => doc(db, `users/${uid}/secrets`, group);

function pick(group: GroupId, src: Record<string, unknown>): SecretValues {
  return Object.fromEntries(SECRET_GROUPS[group].map((f) => {
    const v = src[f];
    if (group === 'aiKeys') {
      return [f, Array.isArray(v) ? v.map((k) => String(k).trim()).filter(Boolean) : []];
    }
    return [f, typeof v === 'string' && v ? v : null];
  }));
}

/**
 * First sync on a device: keep what both sides have (union of keys, local
 * image if set) so keys typed on two laptops before this release both survive.
 * Every sync after that: cloud wins, so a removal on one laptop reaches all.
 */
export function mergeSecrets(cloud: SecretValues | null, local: SecretValues, firstSyncHere: boolean): SecretValues {
  if (!cloud) return local;
  if (!firstSyncHere) return cloud;
  return Object.fromEntries(Object.keys(local).map((f) => {
    const c = cloud[f];
    const l = local[f];
    if (Array.isArray(l)) return [f, [...new Set([...(Array.isArray(c) ? c : []), ...l])]];
    return [f, l ?? c ?? null];
  }));
}

async function writeGroup(uid: string, group: GroupId, values: SecretValues): Promise<void> {
  const json = JSON.stringify(values);
  if (json.length > MAX_DOC_CHARS) {
    lastSynced.set(`${uid}/${group}`, json); // warn once, not on every profile edit
    logger.error(`[Sync] ${group} is ${json.length} chars — too large for Firestore, not synced.`);
    toast.warning(`Your ${group} image is too large to sync to your other devices. Upload it again in Profile to shrink it.`);
    return;
  }
  await setDoc(secretRef(uid, group), { ...values, ownerId: uid });
  lastSynced.set(`${uid}/${group}`, json);
}

/** Login: merge cloud keys/signature/stamp into the local profile, then push back anything the cloud lacks. */
export async function pullSecretsFromCloud(uid: string): Promise<void> {
  let firstSyncHere = true;
  try { firstSyncHere = localStorage.getItem(SYNCED_FLAG_PREFIX + uid) !== 'true'; } catch { /* private mode: union is the safe default */ }

  const local = useProfileStore.getState().profile as unknown as Record<string, unknown>;
  const snaps = await Promise.all(GROUP_IDS.map((g) => getDoc(secretRef(uid, g))));
  const merged = GROUP_IDS.map((g, i) => {
    const cloud = snaps[i].exists() ? pick(g, snaps[i].data()) : null;
    return { g, cloud, values: mergeSecrets(cloud, pick(g, local), firstSyncHere) };
  });

  useProfileStore.getState().updateProfile({
    ...Object.assign({}, ...merged.map((m) => m.values)),
    // Legacy single-key fields would resurrect a key removed on another device.
    geminiApiKey: '',
    groqApiKey: '',
  });

  for (const { g, cloud, values } of merged) {
    if (JSON.stringify(values) === JSON.stringify(cloud)) lastSynced.set(`${uid}/${g}`, JSON.stringify(values));
    else await writeGroup(uid, g, values);
  }
  pulledUids.add(uid);
  try { localStorage.setItem(SYNCED_FLAG_PREFIX + uid, 'true'); } catch { /* next login unions again — harmless */ }
  logger.log(`[Sync] Private profile fields synced for user ${uid}.`);
}

/** Profile edit: write only the groups whose values changed since the last sync. */
export async function pushSecretsToCloud(uid: string, profile: SurveyorProfile): Promise<void> {
  if (!pulledUids.has(uid)) return;
  const src = profile as unknown as Record<string, unknown>;
  for (const g of GROUP_IDS) {
    const values = pick(g, src);
    if (lastSynced.get(`${uid}/${g}`) !== JSON.stringify(values)) await writeGroup(uid, g, values);
  }
}
