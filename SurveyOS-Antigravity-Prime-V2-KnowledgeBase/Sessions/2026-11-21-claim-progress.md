# Session: 2026-11-21 (Claude Code) — Claim progress

## What I Did
- Built the claim-progress feature on main (`711e0b27`..`23becae0`), 9 tasks, spec `docs/superpowers/specs/2026-11-21-claim-progress-design.md`.
- One completed flag: header and dashboard Mark completed both set `completedAt` + `isCompleted` and sync to Scan.
- `claimProgress` step table per survey type; print records `printedAt`; dispatch helpers and claims-list summary; dashboard row progress/courier date/portal tick; batch courier date; sidebar marks, waiting line, hold note; "Reinspection needed" tick; Next button.
- Whole-change check: vitest 415 passed / 1 skipped files, 3,731 tests; `tsc --noEmit` clean; Scan unit tests BUILD SUCCESSFUL (Scan impact: none).

## What's Unfinished
- [ ] Deploy (not deployed), push (not pushed), browser check (not done): owner live check of dashboard and sidebar.
- [ ] Deferred minors: invalid partial date left on blur; overlapping-save revert race; selection not pruned after archive/delete; empty-date courier is a silent no-op; partial-save toast should say n of m; Next bypasses sidebar soft nudges; missing tests (empty-note clear, claim-switch reset, reinspection checkbox, fees-hidden branch, "All steps done" fallback); `withOptional` `as ClaimData` cast; global `querySelector('main')`.
- [ ] Parked: ClaimHeader.tsx `completed = !!completedAt` ignores legacy `isCompleted`; `printedAt` stamps on filing/print-window open, not print completion (photo sheet per part download); ISO string sort assumes toISOString format, whitespace inspectionDate counts.
- [ ] Lint: new files add `no-explicit-any` in tests and `set-state-in-effect` in ClaimRowProgress.tsx / SidebarClaimProgress.tsx.

## Decisions Made
- Completed is one flag set in both places, not two meanings.
- Progress is a per-survey-type step table, not stored state.

## Files Changed
- `src/lib/claims/progress.ts`, `printed.ts`, `dispatch.ts` (new); `auto-file-report.ts`, `useClaimsLoader`, `ReinspectionTab.tsx`, `Dashboard.tsx`, `sidebar.tsx`, `ReportTab.tsx` (modified)
- `src/components/dashboard/ClaimRowProgress.tsx`, `CourierBatchBar.tsx`, `src/components/layout/SidebarClaimProgress.tsx`, `NextTabButton.tsx` (new) plus tests
