// ═══════════════════════════════════════════════════════════
// RESTORE A RECOVERED CLAIM
// Puts a stashed copy back as the live claim. Two rules keep this safe:
//  1. The copy being replaced is itself stashed first — restore is reversible.
//  2. The restored claim inherits the LIVE cloud generation, not the stale one
//     it was stashed with. Without this the very next push is refused as a
//     false conflict and the surveyor loses the report a second time.
// Dependency-injected so it is unit-testable without IndexedDB.
// ═══════════════════════════════════════════════════════════

import type { ClaimData } from '@/types';

/** A one-line, human-readable measure of "how much work is in this copy". */
export interface ClaimSummary {
  reportNo: string;
  vehicleNo: string;
  insuredName: string;
  assessmentRows: number;
  spotDamageRows: number;
  photos: number;
  updatedAt: string;
}

export function summarizeClaim(claim: ClaimData): ClaimSummary {
  return {
    reportNo: claim.reportNo || '—',
    vehicleNo: claim.vehicle?.registrationNumber || '—',
    insuredName: claim.policy?.insuredName || '—',
    assessmentRows: claim.assessmentRows?.length ?? 0,
    spotDamageRows: claim.spotDamageRows?.length ?? 0,
    photos: claim.photos?.length ?? 0,
    updatedAt: claim.updatedAt,
  };
}

export interface RestoreDeps {
  getClaim: (id: string) => Promise<ClaimData | undefined>;
  saveClaim: (claim: ClaimData, opts?: { preserveUpdatedAt?: boolean }) => Promise<void>;
  addRecoveredClaim: (claim: ClaimData, reason: string) => Promise<void>;
  now?: () => string;
}

/**
 * Restores `snapshot` over the live claim of the same id. Returns the claim
 * that is now live, ready to be loaded into the store.
 */
export async function restoreRecoveredClaim(
  snapshot: ClaimData,
  deps: RestoreDeps,
): Promise<ClaimData> {
  const live = await deps.getClaim(snapshot.id);

  // Reversibility: never destroy what is currently in the slot.
  if (live) await deps.addRecoveredClaim(live, 'replaced-by-restore');

  const restored: ClaimData = {
    ...snapshot,
    // Inherit the live cloud generation so the next push is accepted.
    version: live?.version ?? snapshot.version ?? 0,
    // Photos live only on-device and may have been dropped from the snapshot;
    // never trade a populated photo set for an empty one.
    photos: snapshot.photos?.length ? snapshot.photos : (live?.photos ?? []),
    // Newer than the last push → the claim reads as dirty and syncs normally.
    updatedAt: (deps.now ?? (() => new Date().toISOString()))(),
  };

  await deps.saveClaim(restored, { preserveUpdatedAt: true });
  return restored;
}
