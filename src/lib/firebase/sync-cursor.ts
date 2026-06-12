// ═══════════════════════════════════════════════════════════
// PULL CURSOR HELPER
// Cross-device clocks are never perfectly in sync. The delta pull
// filters claims with `updatedAt > sinceTimestamp`, comparing an ISO
// string stamped on the EDITING device against a cutoff stamped on the
// PULLING device. If the editing device's clock lags, a freshly-pushed
// claim looks "older" than the cutoff and is skipped. Rolling the cutoff
// back by a margin re-fetches a small recent window so nothing is missed.
// Re-fetching is harmless: pullClaimsFromCloud only overwrites a local
// claim when remote is newer AND the local copy is not dirty.
// ═══════════════════════════════════════════════════════════

/** Safety window for cross-device clock skew. 5 minutes covers normal drift. */
export const DEFAULT_SKEW_MARGIN_MS = 5 * 60 * 1000;

/**
 * Returns a pull cursor rolled back by `marginMs`.
 * - null in  → null out (first login on this device → full pull).
 * - invalid timestamp → null (safe fallback to full pull).
 */
export function applySkewMargin(
  sinceTimestamp: string | null,
  marginMs: number = DEFAULT_SKEW_MARGIN_MS
): string | null {
  if (sinceTimestamp === null) return null;
  const t = Date.parse(sinceTimestamp);
  if (Number.isNaN(t)) return null;
  return new Date(t - marginMs).toISOString();
}
