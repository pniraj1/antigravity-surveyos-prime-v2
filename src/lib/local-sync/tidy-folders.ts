// ═══════════════════════════════════════════════════════════
// TIDY UP — one-time rename of folders created before the
// insurer short form (2026-09-23). Pure planning here; the
// copy/delete lives in the engine half of this file.
// ═══════════════════════════════════════════════════════════

import { claimFolderName, legacyClaimFolderName } from './nomenclature'

export interface TidyCandidate {
  claimId: string
  label: string
  from: string
  to: string
}

export interface TidySkip {
  label: string
  from: string
  why: 'target exists' | 'already named'
}

export interface TidyPlan {
  rename: TidyCandidate[]
  skipped: TidySkip[]
}

/**
 * Which claims have a folder on disk under the old name that could move to the
 * new one. `onDisk` is the set of directory names directly under the root.
 * Pure — the caller lists the directories and performs the moves.
 */
export function planTidy(
  claims: ReadonlyArray<{ claimId: string; label: string; vehicleNumber: string; insuranceCompany: string }>,
  onDisk: ReadonlySet<string>,
): TidyPlan {
  const rename: TidyCandidate[] = []
  const skipped: TidySkip[] = []
  const seen = new Set<string>()
  for (const c of claims) {
    const to = claimFolderName(c)
    const from = legacyClaimFolderName(c)
    if (from === to || !onDisk.has(from) || seen.has(from)) continue
    seen.add(from)
    if (onDisk.has(to)) {
      // Both names exist — the surveyor synced before and after the change.
      // Merging two manifests is not worth the risk; leave it for them.
      skipped.push({ label: c.label, from, why: 'target exists' })
      continue
    }
    rename.push({ claimId: c.claimId, label: c.label, from, to })
  }
  return { rename, skipped }
}
