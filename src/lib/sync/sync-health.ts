// ═══════════════════════════════════════════════════════════
// SYNC HEALTH — honest cross-device sync status.
// Replaces the previously hardcoded "100% Synced" label.
// Pure function of claim ids on each side; no I/O.
// ═══════════════════════════════════════════════════════════

export interface SyncHealth {
  /** Union of local + cloud claim ids. */
  total: number;
  /** Claims present in BOTH local and cloud. */
  syncedCount: number;
  /** Claims on this device but NOT in the cloud (not backed up). */
  localOnlyCount: number;
  /** Claims in the cloud but NOT on this device (not pulled down yet). */
  cloudOnlyCount: number;
  /** syncedCount / total, as a rounded 0-100 percentage. 100 when empty. */
  syncedPct: number;
}

export function computeSyncHealth(
  localIds: readonly string[],
  cloudIds: readonly string[]
): SyncHealth {
  const local = new Set(localIds);
  const cloud = new Set(cloudIds);
  const union = new Set<string>([...local, ...cloud]);

  let syncedCount = 0;
  let localOnlyCount = 0;
  for (const id of local) {
    if (cloud.has(id)) syncedCount++;
    else localOnlyCount++;
  }
  let cloudOnlyCount = 0;
  for (const id of cloud) {
    if (!local.has(id)) cloudOnlyCount++;
  }

  const total = union.size;
  const syncedPct = total === 0 ? 100 : Math.round((syncedCount / total) * 100);

  return { total, syncedCount, localOnlyCount, cloudOnlyCount, syncedPct };
}
