import type { ClaimData } from '@/types';

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
