# 2026-11-03 — Past prices for a part (Claude Code)

**Why:** surveyors want to check a garage's quote for a part against what they saw on the same model before (e.g. XUV700 front bumper quoted higher than usual).

**Decided with owner:** surveyor-initiated only (no auto flags); option A (row icon → popup) of four mockups; own claims only; no dealer/local tag (workshop name is enough).

**Built:** `src/lib/claims/part-history.ts` (+ `__tests__/part-history.test.ts`), `src/components/claim/PartHistoryButton.tsx`, wired into `AssessmentSectionTable.tsx` next to the Evidence icon.

**State:** tsc clean, full vitest suite passing. Not browser-tested, not deployed. Scan impact: none.

**Next:** owner checks it on real claims; add name abbreviations to `WORD_ALIASES` if matches are missed.
