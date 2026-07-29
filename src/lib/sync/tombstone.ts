// ═══════════════════════════════════════════════════════════
// CLAIM TOMBSTONES
//
// A deleted claim is not removed from Firestore — its document is
// OVERWRITTEN with a tombstone: a marker carrying the claim's identity and
// nothing else. Two consequences, both load-bearing:
//
//   1. The overwrite erases the claim payload, so deleting a claim genuinely
//      removes the insured's personal data from the cloud.
//   2. A marker is something other devices can SEE. A hard-deleted document
//      is merely absent from a query, which is indistinguishable from
//      "unchanged" or "never existed" — which is why deletions used to fail
//      to propagate, and why a second device could push the claim back.
//
// `updatedAt` makes the tombstone travel on the existing delta pull.
// `version` makes the existing version-guarded write refuse a stale push.
// ═══════════════════════════════════════════════════════════

import type { ClaimData } from '@/types';

/** A deleted claim's gravestone in Firestore. Carries NO claim payload. */
export interface ClaimTombstone {
  id: string;
  ownerId: string;
  deleted: true;
  /** ISO timestamp of the deletion. */
  deletedAt: string;
  /** Equals deletedAt. Drives the `updatedAt > cursor` delta pull. */
  updatedAt: string;
  /** cloudVersion + 1, so a stale device's push loses the version check. */
  version: number;
}

/** What a document in users/{uid}/claims may be. */
export type CloudClaimDoc = ClaimData | ClaimTombstone;

/**
 * Builds the tombstone written in place of a deleted claim.
 *
 * @param nextVersion MUST be the current cloud version + 1. Writing a stale
 *   version would let a stale device win `canOverwrite` and resurrect the claim.
 * @param now Injectable for deterministic tests.
 */
export function makeTombstone(
  claimId: string,
  uid: string,
  nextVersion: number,
  now: string = new Date().toISOString(),
): ClaimTombstone {
  return {
    id: claimId,
    ownerId: uid,
    deleted: true,
    deletedAt: now,
    updatedAt: now,
    version: nextVersion,
  };
}

/**
 * Type guard separating tombstones from live claims.
 *
 * Every cloud document must pass through this before anything downstream
 * touches it. Once narrowed, the compiler prevents a tombstone from being
 * treated as a claim — which is what stops a stub being written into
 * IndexedDB and rendered as an empty row on the dashboard.
 */
export function isTombstone(doc: CloudClaimDoc): doc is ClaimTombstone {
  return (doc as ClaimTombstone).deleted === true;
}

/**
 * True if a local copy holds work that postdates the deletion, and so must be
 * kept in Recovered rather than dropped.
 *
 * NOTE: the tempting test — "is this claim dirty?" via pushTracking — is WRONG
 * here. On a freshly installed device pushTracking is empty, so every claim
 * reads as dirty and a restored laptop would produce dozens of Recovered
 * entries and warnings on its first sync. Comparing timestamps needs no local
 * bookkeeping and so survives a fresh install.
 */
export function shouldStashOnRemoteDelete(
  localUpdatedAt: string,
  deletedAt: string,
): boolean {
  return localUpdatedAt > deletedAt;
}
