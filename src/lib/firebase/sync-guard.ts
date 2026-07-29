import type { ClaimData } from '@/types';
import type { ClaimTombstone } from '@/lib/sync/tombstone';

/** True if a device based on `localVersion` may overwrite the cloud's
 *  `cloudVersion`. Refuses only when the cloud is strictly newer. */
export function canOverwrite(localVersion: number, cloudVersion: number): boolean {
  return cloudVersion <= localVersion;
}

/** Thrown by a guarded push when the cloud version is newer than the
 *  device's base version. Carries the newer remote claim for recovery. */
export class ClaimConflictError extends Error {
  remote: ClaimData;
  constructor(remote: ClaimData) {
    super('Claim version conflict — cloud copy is newer');
    this.name = 'ClaimConflictError';
    this.remote = remote;
  }
}

/** Thrown by a guarded push when the cloud says the claim was DELETED.
 *  Distinct from ClaimConflictError: "the cloud is newer" and "the cloud says
 *  this is dead" need opposite responses — adopt versus remove. */
export class ClaimDeletedError extends Error {
  tombstone: ClaimTombstone;
  constructor(tombstone: ClaimTombstone) {
    super('Claim was deleted on another device');
    this.name = 'ClaimDeletedError';
    this.tombstone = tombstone;
  }
}

/** Claims whose current `updatedAt` is newer than the last value pushed to
 *  the cloud (or never pushed) — i.e. not yet safely in the vault. */
export function selectDirtyClaims(
  claims: ClaimData[],
  pushedMap: Map<string, string>,
): ClaimData[] {
  return claims.filter((c) => {
    const pushed = pushedMap.get(c.id);
    return !pushed || c.updatedAt > pushed;
  });
}

/** Number of claims not yet safely in the cloud. */
export function countUnsynced(
  claims: ClaimData[],
  pushedMap: Map<string, string>,
): number {
  return selectDirtyClaims(claims, pushedMap).length;
}
