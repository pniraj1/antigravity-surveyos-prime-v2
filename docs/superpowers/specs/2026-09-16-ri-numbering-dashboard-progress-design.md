# RI Numbering + Dashboard Progress Visibility

**Date:** 2026-09-16
**Status:** Approved (brainstorm with Niraj)

## Problem

For a final-survey claim the dashboard shows only the final report number and
a guessed stage badge. The surveyor cannot see whether the bill check has been
done, whether a re-inspection report exists, or what RI number it carries —
so allocating the *next* sequential RI number to another claim means opening
claims one by one.

RI numbers (`reinspection.refNo`) are typed by hand: nothing remembers the last
one, and there is no "next number" button as there is for spot/final on the
Details tab.

Bill Check reports share the final report number — they need no number of
their own, only a "done" marker.

## Decisions

- RI numbering works exactly like spot/final: pattern-following on the last
  number used (`incrementReportNo`), default scheme `RI/YYYY/NNN`, year reset.
- "RI done" = `reinspection.refNo` or `reinspection.date` is set.
  "Bill check done" = `billCheck.billTotal > 0` (existing heuristic).
- Dashboard shows progress as small chips under the Report No; the stage badge
  stays but is derived correctly.

## Changes

### 1. Profile — RI series (`src/types/vehicle.ts`, `src/stores/profile-store.ts`)
- `SurveyorProfile` gains `lastRIReportNo?: string` and `riSequence?: number`.
- New store action `getNextRINumber(): string`.
- Refactor: `getNextSpotNumber` / `getNextFinalNumber` / `getNextRINumber`
  share one private helper
  `nextInSeries(profile, lastKey, seqKey, prefix)` returning
  `{ reportNo, patch }`; each action applies `patch` via `set`. Behaviour of
  spot/final is unchanged (existing tests must still pass).
- `getNextReportNumber(surveyType)` unchanged (spot → spot, else final).

### 2. Reinspection tab (`src/components/tabs/ReinspectionTab.tsx`)
- Beside the RI Ref Number input: a **"Next RI No."** button. If the field is
  already filled, `confirm('Overwrite existing RI number?')` first. On click,
  `updateReinspection({ refNo: getNextRINumber() })`.
- `onBlur` of the RI Ref Number input: if non-empty, trimmed,
  `updateProfile({ lastRIReportNo: value })` — so a hand-typed format becomes
  the series.

### 3. Stage derivation (`src/lib/claims/stage-variant.ts`)
- New pure function:
  ```ts
  export type ClaimStage = 'spot' | 'final' | 'reinspection' | 'bill-check' | 'valuation';
  export function deriveStage(c: ClaimData): ClaimStage
  ```
  Order: `valuation` if `surveyType === 'valuation'`; `bill-check` if
  `billCheck?.billTotal > 0`; `reinspection` if `reinspection?.refNo ||
  reinspection?.date`; `final` if `surveyType === 'final'`; else `spot`.
- `useClaimsLoader.ts` calls `deriveStage(c)` instead of the inline block
  (which checked the never-populated `reinspection.parts`).

### 4. Dashboard list (`src/stores/slices/claimSlice.ts`, `src/hooks/useClaimsLoader.ts`, `src/components/layout/Dashboard.tsx`)
- Claim list item gains `riRefNo: string` (from `reinspection.refNo || ''`) and
  `billCheckDone: boolean` (`billCheck.billTotal > 0`).
- Row, first column: below the Report No, a sub-line rendered only when at
  least one is set:
  - chip `RI · <riRefNo>` when `riRefNo` non-empty
  - chip `BC ✓` when `billCheckDone`
  Chips use the existing small-badge styling in the file (10px, muted).
- Search: `riRefNo` added to the fields matched by the search box.

### 5. Tests
- `src/stores/__tests__/profile-store-ri.test.ts` (or alongside existing
  profile-store tests if present): `getNextRINumber()` with a blank profile
  → `RI/<currentYear>/001`, second call → `/002`; with
  `lastRIReportNo: 'RI-14-2026/27'` → `RI-15-2026/27`. Spot/final existing
  tests unchanged and passing.
- `src/lib/claims/__tests__/stage-variant.test.ts` extended with `deriveStage`:
  one case per branch, including a final claim with `refNo` set and empty
  `parts` → `reinspection`, and bill-check taking precedence over
  reinspection.

## Out of scope
- Bill check report numbering (shares the final number).
- Any change to report HTML.
- Progress strip / new dashboard columns.
