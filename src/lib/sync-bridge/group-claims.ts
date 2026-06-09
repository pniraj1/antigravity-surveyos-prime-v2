// ═══════════════════════════════════════════════════════════
// SYNC CLAIM SEARCH + GROUPING — pure, UI-agnostic.
// Filters claims by a free-text query and groups them by insurer.
// ═══════════════════════════════════════════════════════════

import type { SyncClaimSummary } from './types'

/** One insurer "folder" of claims. */
export interface ClaimGroup {
  insurer: string
  claims: SyncClaimSummary[]
}

/**
 * Filter `claims` by a case-insensitive substring match across vehicle number,
 * insurer, model/make and label, then group the survivors by insurer and sort
 * the groups alphabetically. Empty groups are dropped; a blank query matches all.
 */
export function filterAndGroupClaims(
  claims: readonly SyncClaimSummary[],
  query: string,
): ClaimGroup[] {
  const q = query.trim().toLowerCase()
  const matches = q
    ? claims.filter((c) =>
        [c.vehicleNumber, c.insuranceCompany, c.modelMake, c.label]
          .some((field) => field?.toLowerCase().includes(q)),
      )
    : [...claims]

  const byInsurer = new Map<string, SyncClaimSummary[]>()
  for (const c of matches) {
    const key = c.insuranceCompany || 'Other'
    const bucket = byInsurer.get(key) ?? []
    bucket.push(c)
    byInsurer.set(key, bucket)
  }

  return [...byInsurer.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([insurer, groupClaims]) => ({ insurer, claims: groupClaims }))
}
