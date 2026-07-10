// ═══════════════════════════════════════════════════════════
// SYNC CLAIM NOW — explicit, on-demand cross-device save.
// Critical path: push the FULL claim (minus photos) to the Firestore
// vault — that is the only store the other device reads assessment data
// from. Best-effort: flush queued photos/documents to Google Drive.
// Drive failure must NOT fail the whole operation: the assessment is
// already safe in the vault and photos retry automatically later.
// Dependency-injected so it is unit-testable in the node test env.
// ═══════════════════════════════════════════════════════════

import type { ClaimData } from '@/types';

export interface SyncClaimDeps {
  pushClaimToCloud: (uid: string, claim: ClaimData) => Promise<{ conflicted?: true } | unknown>;
  flushDriveQueue: () => Promise<number>;
  isOnline: () => boolean;
}

export interface SyncClaimResult {
  ok: boolean;
  pushedToVault: boolean;
  driveFilesSynced: number;
  error?: string;
}

export async function syncClaimNow(
  claim: ClaimData,
  uid: string,
  deps: SyncClaimDeps,
): Promise<SyncClaimResult> {
  if (!deps.isOnline()) {
    return { ok: false, pushedToVault: false, driveFilesSynced: 0, error: 'offline' };
  }

  try {
    const res = await deps.pushClaimToCloud(uid, claim);
    // A refused (conflicted) push is NOT a save. Reporting ok here is how a
    // surveyor saw "Saved to cloud" while his work was being stashed away.
    if (res && typeof res === 'object' && (res as { conflicted?: true }).conflicted) {
      return { ok: false, pushedToVault: false, driveFilesSynced: 0, error: 'conflict' };
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'vault push failed';
    return { ok: false, pushedToVault: false, driveFilesSynced: 0, error };
  }

  let driveFilesSynced = 0;
  try {
    driveFilesSynced = await deps.flushDriveQueue();
  } catch {
    // Non-fatal: assessment data is already in the vault. Photos stay
    // queued in IndexedDB and retry on reconnect via useCloudSync.
    driveFilesSynced = 0;
  }

  return { ok: true, pushedToVault: true, driveFilesSynced };
}
