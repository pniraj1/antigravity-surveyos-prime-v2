# Task 5 Report: one `rowDepRate` for every depreciation-rate call site

## Status: DONE
Commit: `c74ed3e161e03e6d9c278c8ce00638241fda45bd`

## Files touched

### Created
- `src/lib/calculations/row-dep-rate.ts` — `rowDepRate(row, ageMonths, claim)` + `PaintDepClaim` interface, verbatim from the brief.
- `src/lib/calculations/__tests__/row-dep-rate.test.ts` — 6 tests, verbatim from the brief.

### `src/lib/calculations/assessment.ts`
- Dropped `getDepreciationRate` import, added `rowDepRate, type PaintDepClaim`.
- `calculateAssessmentSummary` and `calculateBillCheckSummary` each gained an optional
  7th param `paintDep: PaintDepClaim = { depreciationType: depType }`.
- Both inner `depRate` expressions now `rowDepRate(r, ageMonths, { ...paintDep, depreciationType: depType })`.

### `src/lib/reports/standard-report-builder.ts`
- Swapped `getDepreciationRate` import for `rowDepRate`.
- All 3 `const dep = … getDepreciationRate(…)` sites (`:106/:278/:325`) → `rowDepRate(r, ageMonths, claim)`.
- `calculateAssessmentSummary` call gained final arg `claim`.
- The label-only `r.depOverride !== undefined ? …%* …` expressions left untouched.

### `src/lib/reports/uiic-final-builder.ts`
- Removed the dead local `getDepRate` helper and its now-unused `getDepreciationRate`,
  `toDepreciationType`, `PartType` imports; added `rowDepRate` import.
- All 4 rate expressions (`depFor`, the inline `const dep` in the parts map, `rowDep`,
  `rowDepFor`) → `rowDepRate(r, ageMonths, claim)`.
- `calculateAssessmentSummary` and `calculateBillCheckSummary` calls gained final arg `claim`.

### `src/components/claim/AssessmentSectionTable.tsx`
- Added `rowDepRate` import; local `depRate` → `rowDepRate(row, ageMonths, currentClaim ?? { depreciationType })`.
- `autoDepRate` kept (still used by the override input / tooltip at `:459/:474/:519`).

### Step 7 summary callers — final `currentClaim` arg added
`AssessmentGrid.tsx` (was a 3-arg call — filled `0, 0, 0` positionally then `currentClaim`,
added `currentClaim` to the `useMemo` deps), `AssessmentSummary.tsx`, `BillCheckTab.tsx`
(both calls), `DetailsTab.tsx`, `ReportTab.tsx`.

## Test commands & output

```
$ npx vitest run src/lib/calculations/__tests__/row-dep-rate.test.ts
 Test Files  1 passed (1)      Tests  6 passed (6)

$ npx tsc --noEmit
(clean)

$ npx vitest run
 Test Files  120 passed (120)      Tests  953 passed (953)
```

947 → 953 (the 6 new). No existing test changed value; the IMT-23 real-claims pin
(`imt23-real-claims.test.ts`) stayed green — stored fixtures carry no
`applyPaintMaterialDep`, so `paintMaterialRate` resolves to 0 and paint behaviour is
byte-identical to before.

## Deviations / notes on the brief

1. **uiic-final-builder had 4 rate expressions, not "both `rowDepFor` definitions"** as
   the brief phrased it: `depFor` (final HTML), an inline `const dep` in the parts-row
   map, `rowDep` and `rowDepFor` (bill-check HTML). All 4 were routed through `rowDepRate`.
   The display-only override-asterisk expressions were left alone.
2. **`standard-report-builder.ts:325` is indented 6 spaces**, not 4 like `:106/:278` —
   noted only because a naive exact-match replace misses it. All three were replaced.
3. **Other copies of the pattern exist but are out of scope** and were left untouched
   per the brief: `src/components/tabs/bill-check/BillCheckGrid.tsx:57`,
   `src/lib/calculations/insured-report.ts:53`,
   `src/lib/calculations/uiic-portal-summary.ts:80`. These keep their own inline
   expression; paint dep does not reach them yet.
4. **`calculateAssessmentSummary` callers not in the Step 7 list**, left compiling via
   the default param (identical behaviour): `src/components/claim/TotalLossForm.tsx:23`,
   `src/lib/calculations/insured-report.ts:110`. Deliberately-excluded
   `irdai-summary-builder.ts` and `FeesTab.tsx` untouched as instructed.
5. Removed dead code in uiic-final-builder (the `getDepRate` shim) rather than leaving it
   unused — tsconfig has no `noUnusedLocals` so it would not have failed tsc, but it was
   genuinely dead after the refactor.

## Concerns
None affecting figures. The grid and both report builders now apply the paint GR-9 rate
the moment a claim sets `applyPaintMaterialDep` — which is the intended reach of this
task — while every stored claim (no such field) is unchanged.

---

## Fix report — review findings (5)

**FIX 1 (Critical) — `src/components/claim/AssessmentSectionTable.tsx`**
`autoDepRate` now routes through `rowDepRate({ ...row, depOverride: undefined }, ageMonths, claimForDep)` where `claimForDep = currentClaim ?? { depreciationType }` (same expression the `depRate` line uses). Paint rows now show 12.5% in the Dep% column, and a surveyor can set an explicit 0% override. Removed the now-unused `getDepreciationRate` import.

**FIX 2 (Important) — `src/components/tabs/bill-check/BillCheckGrid.tsx`**
`depRateFor` is now `rowDepRate(row, ageMonths, claim)`. Added a `claim: ClaimData` prop; `BillCheckTab.tsx` passes `claim={currentClaim}`. Dropped the `getDepreciationRate` import.

**FIX 3 (Important) — `src/lib/calculations/insured-report.ts`**
`calculateAssessmentSummary(...)` now passes `claim` as the 7th argument, so `insurerPays` includes paint depreciation and matches the standard/UIIC reports. `depRateFor` at ~line 53 left untouched (parts-only filter).

**FIX 4 (Important) — `src/components/claim/TotalLossForm.tsx`**
`calculateAssessmentSummary(...)` now passes `currentClaim` as the 7th argument, so `detectCTL` sees the same net as the filed report.

**FIX 5 (Minor) — `src/lib/calculations/__tests__/paint-material-dep.test.ts`**
Added a test: for rows including a paint row, `calculateAssessmentSummary(rows, 24, 'standard', 0, 0, 0)` === same call with 7th arg `{}`, and `{ applyPaintMaterialDep: true }` lowers `netAssessedLoss`.

### Verification
- `npx tsc --noEmit` — clean.
- `npx vitest run src/lib/calculations/__tests__/` — 23 files, 152 tests passed (imt23-real-claims unchanged).
- `npx vitest run` — 120 files, 954 tests passed (was 953 + 1 new).
