# Session: 2026-11-09 (Antigravity) — Bill Check Tab Editability (GST, Disposal, Dep%) & Report Integration

## What I Did
- **Added Disposal Column to Bill Check Grid Configuration (`src/components/tabs/bill-check/config.ts`):**
  - Added `'disposal'` to `OptionalColumn` union type, `OPTIONAL_COLUMN_ORDER`, and `DEFAULT_VISIBLE: true`.
  - Added column definition in `GRID_COLUMNS` with label `'Disposal'`, `defaultWidth: 100`, `minWidth: 80`, and icon `PackageX`.
- **Made GST, Disposal, and Dep% Interactive in Bill Check Grid (`src/components/tabs/bill-check/BillCheckGrid.tsx`):**
  - Included `'disposal'` in grid template columns builder (`buildCols`), header row, and totals row keeping CSS grid alignment intact.
  - **GST Cell:** Replaced static text div with `FormulaNumericInput` (bounds 0–100, step 1), editing `row.gst` directly. If `row.billedTaxable` is present, automatically synchronizes `billedAmount: Math.round(row.billedTaxable * (1 + newGst / 100))` ensuring statutory tax parity across assessed and billed calculations.
  - **Disposal Cell:** Added interactive checkbox and numeric percentage input for `row.disposalPercent` (default 50%). Toggling disposal off (switching to a new replacement part) resets `isDisposal: false`, restores default `gst: 18%`, and recalibrates `billedAmount` based on `billedTaxable`. Toggling disposal on sets `isDisposal: true` and `gst: 0%`.
  - **Dep% Cell:** Replaced static text div with interactive numeric input for `row.depOverride` (bounds 0–100). Highlights in amber with an asterisk marker when a manual override is active, with instant tooltip feedback.
- **Integrated Bill Check Overrides into Report Builders (`src/lib/reports/`, `src/lib/calculations/`):**
  - **Standard Report Builder (`standard-report-builder.ts`):** In `'bill-check'` mode, projected rows using `row.billAllowed ?? row.assessed`. In Section 8 Summary and Section 9 Details of Bill Check, items and subtotals derive strictly from the surveyor's active allowance, updated GST, disposal status, and depreciation override. Final Survey mode remains untouched (`billAllowed` never reaches the Final Survey Report).
  - **UIIC Bill Check Report Builder (`uiic-final-builder.ts`):** Projected `rows` with `row.billAllowed !== undefined ? { ...r, assessed: r.billAllowed } : r`. Derived `rawParts`, `effParts`, `computeRowNet`, `aggregateGst` (GST tax summary bands), and Page 1 `calculateAssessmentSummary` (`asum`) from active allowance and updated GST.
  - **Liability & Bill Check Summary (`row-net.ts`, `assessment.ts`):** Updated `computeRowLiability` and `calculateBillCheckSummary` to recognize `row.billAllowed`, ensuring the surveyor's deliberate allowance overrides the automatic `min(assessed, billed)` cap in either direction without mutating the underlying row.
- **Added Comprehensive Unit Tests:**
  - `src/components/tabs/__tests__/BillCheckGridEditability.test.tsx`: Tests rendering of editable GST input, disposal checkbox/percentage, and depOverride input in `BillCheckGrid`.
  - `src/lib/reports/__tests__/bill-check-gst-disposal-override.test.ts`: 4 end-to-end tests verifying:
    1. `billAllowed` updates assessed amount and liability in Standard Bill Check report while Final Survey Report retains original assessed figure.
    2. `billAllowed` updates assessed amount and net liability in UIIC Bill Check report while UIIC Final Survey Report retains original.
    3. User real-world scenario: Insured fitted new OEM part instead of planned disposal part; surveyor sets `isDisposal: false`, `gst: 18%`, and `billAllowed: 10000`, correctly computing 10% dep and 18% GST without the 50% disposal cut in both Standard and UIIC Bill Check reports.
    4. Surveyor edits GST rate from 18% to 28% (e.g. for tyre), verifying GST% column and Price+GST reflection.

## Prime ↔ Scan Coupling Review
- Prime ↔ Scan impact: **None**.
- No modifications to `valuationDetails`, `spotDetails`, `documents.ts`, Drive naming patterns, or API endpoints consumed by SurveyOS Scan.

## Verification
- TypeScript type-check (`npx tsc --noEmit`): 0 errors.
- Vitest test suite (`npm test -- --run`): 325 test files passed (2,866 tests, 100% green).
- Git branch: `main` (clean commits on main).
