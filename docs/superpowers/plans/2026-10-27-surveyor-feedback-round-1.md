# Surveyor Feedback Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the nine surveyor complaints:
- re-read fix flow;
- remove the Site tab;
- survey date on the dashboard;
- policy check;
- continuation uploads;
- recovered list;
- bottom Add row;
- Word page breaks;
- UIIC repair dates at print.

**Architecture:** The logic goes into small pure functions with vitest tests: survey date, the Word break rewrite, estimate rows/continuation, the bill continuation, the estimate-fix planner and the policy-check status. UI changes reuse the existing store slices and the hook-returns-a-dialog pattern of `useEstimateModePrompt`. One shared print gate hook (`usePrintGate`) carries both the UIIC "Before printing" dialog and the policy block for every final/bill-check print path.

**Tech Stack:** Next.js 16, React, TypeScript, Zustand, vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-27-surveyor-feedback-round-1-design.md`. Read it with this plan.

## Global Constraints

- Work on `main`, one commit per task. Commit messages use conventional commits and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No new dependencies. No new AI calls (item 1 = one re-read per use; item 4 = extra fields on the existing policy read).
- AI never overwrites surveyor-typed rows/figures without a tick; AI policy answers are never treated as confirmed.
- PDFs/print HTML builders are not changed (item 8 changes `word-export.ts` only).
- Smallest working diff; reuse existing helpers. Mark deliberate shortcuts with a `ponytail:` comment.
- Test command: `npx vitest run <path>`. Type check: `npx tsc --noEmit`. Both must pass before each commit.
- UTF-8: files contain `₹`, `→`, `—`. Do not re-encode them.
- Auth-gated screens cannot be browser-verified here. Don't start the dev server to "verify" them; say so in the report.
- Prime ↔ Scan: only Task 5 touches Scan's contract. It runs Scan's tests.

## Review Focus

1. **Old claims** (no `policyCheck`, no reinspection dates, no `reReadNote`) must load, render and print through the gate without errors. A claim with no `policyCheck` is "0 of 4". Tests are in Task 11 and Task 6.
2. **A bookmarked or reloaded URL with `?tab=site`** must land on Claim Details, not a blank pane. Test in Task 5.
3. **An unnumbered estimate** (no `sr_no` anywhere) in the fix flow must match by description, never duplicate a sheet row, and never delete. Test in Task 9.
4. **Continuation onto a sheet with only hand-typed rows** (no `source: 'estimate'` rows) must number from 1 and drop nothing. Test in Task 7.
5. **A bill continuation whose page has no printed total or bill number** keeps the earlier bill no., date and total. Test in Task 8.

---

## Phase A: quick fixes

### Task 1: Recovered list shows vehicle number (item 6)

**Files:**
- Modify: `src/components/tabs/RecoveredClaimsView.tsx:71,126`

**Interfaces:** none.

- [ ] **Step 1: Change the heading at line 126** to show `snap.vehicleNo` as the main text. If it is `'—'`, show `No vehicle no.`. Show `snap.reportNo` as small grey text after it (`text-[10px] font-normal text-muted-foreground`), before the existing items/photos count.
- [ ] **Step 2: Change the restore toast at line 71** to `Restored "${restored.vehicle?.registrationNumber || restored.reportNo || restored.id}". …` (rest unchanged).
- [ ] **Step 3: Type check.** Run: `npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 4: Commit.** `git commit -m "fix: recovered list shows vehicle number first"`

### Task 2: Add row at the bottom of each section (item 7)

**Files:**
- Modify: `src/components/claim/AssessmentSectionTable.tsx` (after `</table>` around line 638)
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx` (end of each section block inside `SECTION_ORDER.map`, after the section's assessed-subtotal line, around line 577)

**Interfaces:**
- Consumes: `addAssessmentRowToSection(section: AssessmentSection)` from `useClaimStore` (exists, `assessmentSlice.ts:48`).

- [ ] **Step 1: Assessment.** Below each section's table, render the same button as the header one (`PlusCircle` + `Add row`, same classes, `onClick={() => addAssessmentRowToSection(section)}`), left-aligned with `mt-2`. Keep the header button.
- [ ] **Step 2: Bill Check.** At the end of each rendered section, add the same button. Get `addAssessmentRowToSection` from `useClaimStore`.
  - Only sections that render get a button; an empty section is not rendered today, so it gets none.
  - A new row is an ordinary assessment row (spec, call 6).
- [ ] **Step 3 (optional, cheap only):** after adding, scroll the new last row of that section into view.
- [ ] **Step 4: Type check and existing tests.** Run: `npx tsc --noEmit && npx vitest run src/components`. Expected: pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: add-row button below each section in Assessment and Bill Check"`

### Task 3: Dashboard Survey Date + Last Edited (item 3)

**Files:**
- Create: `src/lib/claims/survey-date.ts`
- Test: `src/lib/claims/__tests__/survey-date.test.ts`
- Modify: `src/stores/slices/claimSlice.ts:24-39` (add `surveyDate: string` to the `claimsList` item type)
- Modify: `src/hooks/useClaimsLoader.ts:31-46` (fill it)
- Modify: `src/components/layout/Dashboard.tsx:327-335,410-426` (columns)

**Interfaces:**
- Produces: `claimSurveyDate(claim: Pick<ClaimData, 'surveyType' | 'accident' | 'spotDetails' | 'valuationDetails'>): string`. It returns `YYYY-MM-DD`, or `''`.

- [ ] **Step 1: Write the failing test**

```ts
import { claimSurveyDate } from '../survey-date';
const base = { accident: { dateOfSurvey: '2026-10-01' }, spotDetails: { surveyDatetime: '2026-09-30T14:20' }, valuationDetails: { inspectionDate: '2026-09-29' } } as any;
it('final uses accident.dateOfSurvey', () => expect(claimSurveyDate({ ...base, surveyType: 'final' })).toBe('2026-10-01'));
it('spot uses the date part of spotDetails.surveyDatetime', () => expect(claimSurveyDate({ ...base, surveyType: 'spot' })).toBe('2026-09-30'));
it('valuation uses valuationDetails.inspectionDate', () => expect(claimSurveyDate({ ...base, surveyType: 'valuation' })).toBe('2026-09-29'));
it('blank or missing → empty string', () => expect(claimSurveyDate({ surveyType: 'spot' } as any)).toBe(''));
```

- [ ] **Step 2: Run it.** `npx vitest run src/lib/claims/__tests__/survey-date.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `claimSurveyDate`.** Use optional chaining and `.slice(0, 10)` on the spot value.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Wire it.**
  - In `useClaimsLoader`, add `surveyDate: claimSurveyDate(c)`.
  - In `Dashboard.tsx`, change the grid template on both the header and row to `grid-cols-[1.5fr_1fr_2fr_100px_100px_110px_110px_60px]`.
  - Replace the `Date` header with `Survey Date` and `Last Edited`.
  - Render `surveyDate` with the same `toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'})` as `updatedAt`, or `—` when blank.
  - Sorting stays on `updatedAt`.
- [ ] **Step 6: Type check.** `npx tsc --noEmit`. Expected: pass.
- [ ] **Step 7: Commit.** `git commit -m "feat: dashboard shows survey date and last edited"`

### Task 4: Word file honours page breaks (item 8)

**Files:**
- Modify: `src/lib/reports/word-export.ts` (`buildWordDocument`)
- Test: `src/lib/reports/__tests__/word-export.test.ts` (add cases)

**Interfaces:** none new. `buildWordDocument(bodyHtml, title, footerLeft)` keeps its signature.

- [ ] **Step 1: Write the failing tests** inside `describe('buildWordDocument')`:

```ts
test('turns an empty page-break div into a Word page break', () => {
  const doc = buildWordDocument('<p>a</p><div style="page-break-before:always;"></div><div>NAME</div>', 't');
  expect(doc).not.toContain('<div style="page-break-before:always;"></div>');
  expect(doc).toContain('<br clear=all style="page-break-before:always">');
});
test('leaves a page-break div with content alone', () => {
  const html = '<div style="page-break-before:always;">x</div>';
  expect(buildWordDocument(html, 't')).toContain(html);
});
```

- [ ] **Step 2: Run them.** `npx vitest run src/lib/reports/__tests__/word-export.test.ts`. Expected: the first FAILS.
- [ ] **Step 3: Implement.** In `buildWordDocument`, before interpolating, replace `/<div style="page-break-before:\s*always;?"\s*><\/div>/g` with `<br clear=all style="page-break-before:always">`. Add a one-line comment: Word ignores page-break on an empty block (verified 2026-10-27: 1 page vs 2).
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Manual check (owner or executor with Word).** Download UIIC final and UIIC bill check as Word for one claim. Page 2 and on start at the surveyor-name line. An optional scripted check, when Word is installed: open the `.doc` via PowerShell `Word.Application` COM and confirm `ComputeStatistics(2)` is greater than 1.
- [ ] **Step 6: Commit.** `git commit -m "fix: Word export keeps UIIC page breaks"`

---

## Phase B

### Task 5: Remove the Site tab (item 2)

**Files:**
- Delete: `src/components/tabs/SiteTab.tsx`
- Delete: `src/components/site/` (whole folder)
- Delete: everything in `src/lib/site/` except `path.ts`, plus its `__tests__`
- Delete: `buildSiteNotesPrompt` from `src/lib/ai/prompts.ts`, and `src/lib/ai/__tests__/site-notes-prompt.test.ts`
- Move: `src/lib/site/path.ts` → `src/lib/scan-import/path.ts`. Update the import in `src/lib/scan-import/notes.ts:8`; move or rename any `path` test with it.
- Modify: `src/stores/ui-store.ts:12` (remove `'site'` from `AppTab`)
- Modify: `src/components/layout/sidebar.tsx:57`, `src/components/layout/Dashboard.tsx:624` (and the `SiteTab` dynamic import)
- Modify: `src/components/layout/MobileBottomBar.tsx:10-15`
- Modify: `src/lib/claims/landing-tab.ts:21` and its test
- Modify: `src/hooks/useRouteSync.ts:70,75`
- Create: `src/lib/navigation/url-tab.ts`
- Test: `src/lib/navigation/__tests__/url-tab.test.ts`

**Interfaces:**
- Produces: `normalizeUrlTab(tab: string | null, hasClaim: boolean): AppTab`. With a claim: `null` or `'site'` → `'details'`. Without a claim: `null` → `'dashboard'`. Any other value passes through.

- [ ] **Step 1: Write the failing tests.**
  - `url-tab.test.ts`:
    - `normalizeUrlTab('site', true)` is `'details'`;
    - `normalizeUrlTab(null, true)` is `'details'`;
    - `normalizeUrlTab(null, false)` is `'dashboard'`;
    - `normalizeUrlTab('photos', true)` is `'photos'`.
  - In `landing-tab.test.ts`, change the three `narrow` expectations to `'details'`.
- [ ] **Step 2: Run them.** `npx vitest run src/lib/navigation src/lib/claims`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `normalizeUrlTab`;
  - `claimLandingTab` returns `'details'` when `narrow`;
  - use `normalizeUrlTab(urlTab, true/false)` at `useRouteSync.ts:70` and `:75`;
  - remove the `'site'` entries;
  - set the `MobileBottomBar` items to Details (`ClipboardList`), Documents (`FileText`), Photos, Report. `isNavItemVisible` already hides Documents for valuation.
- [ ] **Step 4: Delete the files listed above. Move `path.ts`.**
- [ ] **Step 5: Check that nothing still references them.** `grep -rn "lib/site\|components/site\|SiteTab\|buildSiteNotesPrompt\|'site'" src --include=*.ts --include=*.tsx | grep -v graphify-out`. Expected: no output.
- [ ] **Step 6: Run the tests and type check.** `npx vitest run && npx tsc --noEmit`. Expected: pass.
- [ ] **Step 7: Run Scan's tests.** In Git Bash, from `../SurveyOS Scan`, with `JAVA_HOME` set to Android Studio's `jbr`: `./gradlew :app:testDebugUnitTest`. Expected: BUILD SUCCESSFUL.
- [ ] **Step 8: Update the Scan handover.** If `../SurveyOS Scan/docs/handover/prime-notes-import.md` mentions the Site tab or `src/lib/site/`, update it to say: "Site tab retired 2026-10-27; `getAt`/`setAt` now in `src/lib/scan-import/path.ts`". That is a separate commit in the Scan repo.
- [ ] **Step 9: Commit (Prime).** `git commit -m "refactor: retire Site tab; phone opens on Claim Details"`

### Task 6: Print gate + UIIC "Before printing" dialog (item 9)

**Files:**
- Create: `src/hooks/usePrintGate.tsx`
- Create: `src/components/dialogs/BeforePrintDialog.tsx`
- Test: `src/components/dialogs/__tests__/before-print-dialog.test.tsx`
- Modify: `src/components/tabs/report/SurveyActions.tsx:128-180` (Word export and both Power Print buttons)
- Modify: `src/components/tabs/BillCheckTab.tsx:163-166` (`doPrint`) and the `BillCheckPreview` Word button
- Modify: `src/components/shared/ReportPreviewPanel.tsx:28-31,130` (new optional prop)
- Modify: `src/components/layout/FloatingReportPreview.tsx:178-188` (`handleHtmlPrint`)

**Interfaces:**
- Produces:
  - `type GatedReport = 'final' | 'uiic-final' | 'bill-check' | 'uiic-bill-check'`
  - `usePrintGate(): { gate: (report: GatedReport, run: () => void) => void; gateDialog: ReactNode }`. It runs `run` straight away when no dialog is needed. In this task, the dialog is needed only for `uiic-*`.
  - `BeforePrintDialog` props: `{ showUiic: boolean; showPolicy: boolean; onPrint: () => void; onCancel: () => void; printLabel?: string }`. It reads and writes `claim.reinspection` through `useClaimStore().updateReinspection`. `showPolicy` renders nothing until Task 13.
  - `ReportPreviewPanel` new prop: `beforeExport?: (run: () => void) => void`. The Word button calls `beforeExport ? beforeExport(() => downloadAsWord(...)) : downloadAsWord(...)`.

- [ ] **Step 1: Write the failing test.** Use `renderToStaticMarkup`, as in `ai-review-findings.test.tsx`, with `useClaimStore` seeded from `createBlankClaim()`:
  - `showUiic` renders the labels `Reinspection appointment date`, `Repair Authorisation Date`, `Est. Repair Completion Date`, `Actual Repair Completion Date`, `Repairs as per assessment`, and the buttons `YES` / `NO` / `PARTIAL`;
  - `showUiic={false}` renders none of those labels.
- [ ] **Step 2: Run it.** `npx vitest run src/components/dialogs/__tests__/before-print-dialog.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement `BeforePrintDialog`.**
  - Title: `Before printing — UIIC`.
  - Five inputs: date inputs for `riAppointmentDate`, `repairAuthDate`, `estCompletionDate`, `actualCompletionDate`, and the YES/NO/PARTIAL pills for `repairsAsAssessed`. Copy the `ReinspectionTab.tsx:134-196` controls.
  - A note: `Blank dates are allowed if reinspection is not done yet.`
  - Buttons: `printLabel ?? 'Print'` and `Cancel`.
  - Use the modal shell style of `EstimateModeDialog`.
- [ ] **Step 4: Implement `usePrintGate`.** Same pattern as `useEstimateModePrompt`: pending state holding `{ report, run }`. `gate` calls `run()` immediately unless `report.startsWith('uiic')`. On print: close, then `run()`.
- [ ] **Step 5: Wire all three print places.**
  - **SurveyActions:**
    - standard print → `gate('final', () => triggerStandardPrint(...))`;
    - UIIC print → `gate('uiic-final', …)`;
    - Word export → `gate(format === 'uiic' ? 'uiic-final' : 'final', <existing body>)`.
  - **BillCheckTab:** inside `doPrint`, `gate(format === 'uiic' ? 'uiic-bill-check' : 'bill-check', <existing body>)`. Pass `beforeExport={(run) => gate(<same kind>, run)}` to `ReportPreviewPanel` through `BillCheckPreview`.
  - **FloatingReportPreview:** in `handleHtmlPrint`, map `format`:
    - `uiic` → `'uiic-final'`;
    - `bill-check` → `'uiic-bill-check'` (it builds UIIC bill check);
    - `standard` → `'final'`;
    - anything else prints ungated.

    Render each `gateDialog`.
- [ ] **Step 6: Run the tests and type check.** `npx vitest run && npx tsc --noEmit`. Expected: pass.
- [ ] **Step 7: Commit.** `git commit -m "feat: UIIC repair dates asked before UIIC print/Word"`

---

## Phase C

### Task 7: Estimate continuation (item 5, estimate)

**Files:**
- Modify: `src/stores/slices/aiDataSlice.ts:6` (type), `:664-755` (`applyEstimate`)
- Modify: `src/components/dialogs/EstimateModeDialog.tsx`
- Modify: `src/hooks/useEstimateModePrompt.tsx`
- Test: `src/stores/slices/__tests__/aiDataSlice.test.ts` (inside `describe('applyEstimate')`)

**Interfaces:**
- Produces:
  - `type EstimateApplyMode = 'replace' | 'append' | 'continue'`
  - `export function buildEstimateRows(data: any, source: 'estimate' | 'supplementary', startSerial: number): AssessmentRow[]`. This is the row-building body extracted from `applyEstimate`, unchanged in behaviour. Unnumbered rows take `startSerial, startSerial+1, …` with one counter across parts → labour → paint.
  - `applyEstimate(claim, data, mode)` handles `'continue'`.
  - `EstimateModeDialog` new prop `kind: 'estimate' | 'bill'` (Task 8 uses `'bill'`). `onChoose(mode: EstimateApplyMode)`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('continue: keeps every row, tags new rows estimate, numbers on from the highest estimate serial', () => {
  // sheet: estimate rows srNo 1..3 (any sections) + one supplementary row srNo 9
  // data: two unnumbered spare_parts
  // expect: all 4 old rows kept; 2 new rows source 'estimate', srNo 4 and 5
});
it('continue: printed sr_no is kept', () => { /* data item sr_no 40 → row srNo 40 */ });
it('continue onto a sheet with only hand-typed rows numbers from 1 and drops nothing', () => { /* rows with no source */ });
it('replace still drops estimate rows including continuation ones and keeps supplementary/manual', () => {});
```

Fill in the fixtures using the existing helpers in this test file.

- [ ] **Step 2: Run them.** `npx vitest run src/stores/slices/__tests__/aiDataSlice.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - Extract `buildEstimateRows`.
  - In `'continue'`: `startSerial = max(srNo of rows with source === 'estimate') + 1`, or `1` if there are none. Source is `'estimate'`, and `kept` is all rows.
  - `'append'` and `'replace'` are unchanged (`startSerial = 1`).
- [ ] **Step 4: Run them.** Expected: PASS, along with all existing `applyEstimate` tests.
- [ ] **Step 5: Dialog.** With `kind='estimate'`, show three choices in this order:
  1. **More pages of the same estimate**, subtext `Items join the original estimate. Numbering carries on.`. Uses the current primary-button style; `continue`.
  2. **A supplementary estimate**: existing copy; `append`.
  3. **The same estimate again — read it fresh**, subtext `Replaces every estimate line, including continuation pages. Hand-added and supplementary lines are kept.`; `replace`.

  `useEstimateModePrompt` passes `kind="estimate"`.
- [ ] **Step 6: Type check.** `npx tsc --noEmit`. Expected: pass.
- [ ] **Step 7: Commit.** `git commit -m "feat: estimate upload can continue the same estimate"`

### Task 8: Bill continuation (item 5, bill)

**Files:**
- Modify: `src/stores/slices/aiDataSlice.ts:577-637` (`applyFinalBill`), `:816` (dispatch), and next to `buildEstimateModePrompt`
- Modify: `src/hooks/useEstimateModePrompt.tsx`, `src/components/dialogs/EstimateModeDialog.tsx`
- Modify: `src/components/tabs/BillCheckTab.tsx:88,146-155,332-340`
- Test: `src/stores/slices/__tests__/aiDataSlice.test.ts` (new `describe('applyFinalBill continue')`)

**Interfaces:**
- Consumes: `EstimateApplyMode` and the `kind` prop from Task 7.
- Produces:
  - `applyFinalBill(claim: ClaimData, data: any, mode: 'replace' | 'continue' = 'replace'): ClaimData`
  - `buildBillModePrompt(claim: ClaimData | null): { billNo: string; billedRows: number } | null`. Non-null when `billCheck.billNo` is set or any row has `billedAmount > 0`.
  - `useEstimateModePrompt()` also returns `confirmBillMode(fileLabel: string): Promise<'replace' | 'continue' | null>`. It resolves to `'replace'` when `buildBillModePrompt` is null.

- [ ] **Step 1: Write the failing tests.**
  - Continue, where page 2 has no `bill_number`, `bill_date` or `total_amount`: `billCheck` keeps its earlier no., date and total.
  - Continue, where page 2 has `total_amount: 50000`: `billTotal` is 50000, and bill no. and date are kept.
  - Continue: a row already `billStatus: 'in-bill'` with `billedAmount > 0` is not re-matched. Its billed values are unchanged even when a page-2 item has the same description.
  - Replace is unchanged (the existing behaviour holds).
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - In `'continue'`:
    - match only rows without `billedAmount > 0`;
    - `billNo` and `billDate` keep the existing values if non-empty;
    - `billTotal = data.total_amount || existing`.
  - Dispatch: `applyFinalBill(newClaim, data, mode === 'continue' ? 'continue' : 'replace')`.
  - Dialog `kind='bill'`:
    - heading `This claim already has a bill read`;
    - choices **More pages of the same bill** (`continue`) and **The same bill again — read it fresh** (`replace`);
    - no supplementary option.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Wire BillCheckTab.**
  - `processBillFile` awaits `confirmBillMode(file.name)` and returns on `null`.
  - Pass the mode as the 5th argument of `triggerExtraction('final-bill', file, undefined, undefined, mode)`.
  - Keep the mode with `reviewFile` state for the `DocumentReviewSheet` path.
  - Render `estimateModeDialog`.
- [ ] **Step 6: Run the tests and type check.** `npx vitest run src/stores && npx tsc --noEmit`. Expected: pass.
- [ ] **Step 7: Commit.** `git commit -m "feat: bill upload can continue the same bill"`

### Task 9: Estimate-fix planner (item 1, logic)

**Files:**
- Create: `src/lib/ai/estimate-fix.ts`
- Test: `src/lib/ai/__tests__/estimate-fix.test.ts`
- Modify: `src/types/assessment.ts:~115` (add `reReadNote?: string` to `AssessmentRow`, documented as screen-only and never printed)

**Interfaces:**
- Consumes: `buildEstimateRows` (Task 7). The re-read rows come from `buildEstimateRows(data, 'estimate', 1)`.
- Produces:

```ts
type FixFields = Pick<AssessmentRow, 'estimated' | 'gst' | 'quantity' | 'particulars' | 'partType'>;
export interface EstimateFixChange { rowId: string; before: FixFields; after: FixFields }
export interface EstimateFixPlan { missing: AssessmentRow[]; changed: EstimateFixChange[] }
export interface EstimateFixPicks { missingIds: string[]; changedRowIds: string[] }
export function sheetToEstimateData(rows: AssessmentRow[]): { spare_parts: object[]; labour_items: object[]; painting_items: object[] }
export function planEstimateFix(sheetRows: AssessmentRow[], reReadRows: AssessmentRow[]): EstimateFixPlan
export function applyEstimateFix(rows: AssessmentRow[], plan: EstimateFixPlan, picks: EstimateFixPicks): AssessmentRow[]
```

Rules, which the tests do not fully determine:
- **Matching:** within the same `section`, against **every** sheet row whatever its `source`.
  1. Match first on equal `srNo`, when both are defined.
  2. Otherwise match on equal normalised `particulars` (lowercase, trimmed, whitespace collapsed).

  Each sheet row matches at most once. An unmatched re-read row goes to `missing`.
- **Changed:** a matched pair goes in when any of these differ:
  - `|estimated diff| > 0.5`;
  - `gst`;
  - `quantity ?? 1`;
  - normalised `particulars`;
  - `partType`.
- **Insert:** a picked missing row goes after the last same-section row whose `srNo` is lower than its own. Without an `srNo` it goes at the section end, or at the array end if the section is empty. `source` = the previous row's `source ?? 'estimate'`.
- **Apply change:** copy the `after` fields.
  - If `|row.assessed − before.estimated| < 0.01`, set `assessed = after.estimated`.
  - Otherwise keep `assessed` and set `reReadNote = \`Estimate re-read changed ₹${before.estimated} → ₹${after.estimated}\``.
- Never remove a row.
- `sheetToEstimateData`: every row on the sheet becomes `{ sr_no, description, taxable_amount: estimated, gst_percent: gst, quantity }`, grouped by section. It is the AI's "previous data".

- [ ] **Step 1: Write the failing tests.**
  - Re-read has sr 1–5 and the sheet has 1, 2, 5: `missing` is sr 3 and 4. After applying, they sit between 2 and 5.
  - A hand-typed sheet row (`source` undefined) with the same description is not proposed as missing.
  - Taxable vs gross: every re-read row's `estimated` is the sheet's `/1.18`, so every matched row is in `changed`.
  - A row with `assessed === estimated` follows the new value. A row with `assessed !== estimated` keeps its figure and gets `reReadNote`.
  - Unnumbered estimate (all `srNo` undefined): matching is by description, nothing is duplicated, and `applyEstimateFix` never shortens the array.
  - Picks that leave groups unticked are not applied.
- [ ] **Step 2: Run them.** `npx vitest run src/lib/ai/__tests__/estimate-fix.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the three functions** per the rules above.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: estimate re-read planner (missing/changed rows, never deletes)"`

### Task 10: "Fix estimate reading" dialog; floating button removed (item 1, UI)

**Files:**
- Create: `src/components/dialogs/FixEstimateDialog.tsx`
- Delete: `src/components/chat/AssessmentChatbot.tsx`
- Modify: `src/components/tabs/AssessmentTab.tsx:19,37,242-247` (toolbar button; remove the chatbot)
- Modify: `src/hooks/useAIExtraction.ts:194-205,219` (delete `reScanLatest` and `hasFile` if no other caller is left; `extraction-store.ts` comments may mention them, so leave those)
- Modify: `src/stores/slices/aiDataSlice.ts` (store action)
- Modify: `src/components/claim/AssessmentSectionTable.tsx` (`reReadNote` badge)

**Interfaces:**
- Consumes: `planEstimateFix`, `applyEstimateFix`, `sheetToEstimateData`, `buildEstimateRows` (Tasks 7 and 9); `extractDocument(key, files, onProgress, feedback, previousData, forceDocMode, signal)` from `@/lib/ai/processor`; `stripPageTags` from `@/lib/ai/row-check`; `useExtractionStore` (`files.estimate` and `rememberFile`).
- Produces:
  - store action `applyEstimateFixToClaim(plan: EstimateFixPlan, picks: EstimateFixPicks): void` on the AI data slice. It replaces `assessmentRows` with `applyEstimateFix(...)` and sets `updatedAt` and `isDirty`.
  - `FixEstimateDialog` props: `{ open: boolean; onClose: () => void }`.

- [ ] **Step 1: Build the dialog in three stages.**
  1. **Ask.** Title `Fix estimate reading`.
     - A textarea labelled `Tell the AI what it got wrong`, with the hint `e.g. items 38–52 missing · last column is taxable, without GST · page 3 not read`.
     - The line `Re-reading: <file name>` with a **Choose another file** file input (`image/*,application/pdf`). When `files.estimate` is absent, show only the picker, captioned `Choose the estimate file again`.
     - **Send** is disabled until there is both a note and a file.
  2. **Reading.** A progress line from `onProgress`, and **Cancel** to abort via `AbortController`.
  3. **Review.**
     - Group `Missing on the sheet (n)`: each row has a checkbox, ticked by default, and shows Sr / description / ₹estimated.
     - Group `Changed (n)`: each row has a checkbox, unticked by default, and shows old → new only for the fields that differ. An `Accept all changes` button ticks every row in this group.
     - Buttons: **Apply ticked** and **Cancel**.
     - Empty plan: the message `The re-read found nothing new or different.`

  The re-read itself:
  ```ts
  extractDocument('estimate', [file], onProgress, note,
    sheetToEstimateData(rows), forceDocMode, signal)
  ```
  Then `stripPageTags(data)` → `buildEstimateRows(data, 'estimate', 1)` → `planEstimateFix(currentRows, reRead)`. Errors show a `toast.error` and return to stage 1. A chosen file is passed to `rememberFile('estimate', file)`.
- [ ] **Step 2: Toolbar.** In `AssessmentTab`, add a `Fix estimate reading` outline button, height `h-12`, after `UsePhoneFiles`. It shows only when some row has `source` set (`'estimate'` or `'supplementary'`), meaning an estimate was read, and opens the dialog. Remove the `AssessmentChatbot` import and render, then delete the file.
- [ ] **Step 3: Badge.** In `AssessmentSectionTable`, rows with `reReadNote` show a small amber `Re-read` badge beside the particulars. Its `title` is the note, and an `×` clears it (`updateAssessmentRow(id, { reReadNote: undefined })`).
- [ ] **Step 4: Remove dead code.** `grep -rn "reScanLatest\|hasFile\|AssessmentChatbot" src --include=*.ts --include=*.tsx | grep -v graphify-out`. Remove whatever no longer has a caller.
- [ ] **Step 5: Run the tests and type check.** `npx vitest run && npx tsc --noEmit`. Expected: pass.
- [ ] **Step 6: Commit.** `git commit -m "feat: fix-estimate-reading dialog replaces floating Fix Extraction"`

---

## Phase D: policy check

### Task 11: Policy check data, AI read, status (item 4, logic)

**Files:**
- Modify: `src/types/claim.ts` (types + `policyCheck?: PolicyCheck` on `ClaimData`; not seeded in `createBlankClaim`)
- Create: `src/lib/policy/policy-check.ts`
- Test: `src/lib/policy/__tests__/policy-check.test.ts`
- Modify: `src/lib/ai/prompts.ts:116-117` (five new policy fields)
- Modify: `src/stores/slices/aiDataSlice.ts:399-435` (`applyPolicy`)

**Interfaces:**
- Produces:

```ts
export type YesNo = 'yes' | 'no';
export interface PolicyAiRead { nilDep?: YesNo; imt23?: YesNo; consumables?: YesNo; compulsoryExcess?: number; voluntaryExcess?: number }
export interface PolicyCheck { nilDep?: YesNo; imt23?: YesNo | 'na'; consumables?: YesNo; excessConfirmed?: boolean; aiRead?: PolicyAiRead }
// src/lib/policy/policy-check.ts
export function parsePolicyAddOns(data: any): PolicyAiRead
export function mergePolicyAiRead(check: PolicyCheck | undefined, ai: PolicyAiRead, excess: { compulsory: number; voluntary: number }): PolicyCheck
export interface PolicyCheckStatus { answered: number; total: 4; complete: boolean; warnings: string[] }
export function policyCheckStatus(claim: ClaimData): PolicyCheckStatus
```

Rules:
- **`parsePolicyAddOns`:**
  - `'yes'` / `'no'` are read case-insensitively; anything else (including `'unknown'`) is omitted;
  - amounts are `Number(String(v).replace(/[^\d.]/g, ''))`, omitted when 0 or NaN.
- **`mergePolicyAiRead`:**
  - stores `aiRead`;
  - clears an answer when the AI value is defined and differs from it. For IMT 23, an answer of `'na'` is compatible with an AI `'no'`;
  - clears `excessConfirmed` when an AI excess amount is defined and differs from `excess`.
- **`policyCheckStatus`:**
  - `answered` counts `nilDep`, `imt23`, `consumables` and `excessConfirmed`;
  - warnings use this copy:
    - `${n} rows ticked IMT 23 — policy has no IMT 23` (when `imt23 === 'no'` and n > 0 allowed rows have `imt23`)
    - `Policy has IMT 23 — no rows ticked yet` (when `imt23 === 'yes'` and none are ticked)
    - `Consumables not payable — check consumable rows` (when `consumables === 'no'`)
- **`applyPolicy`:**
  - `policyCheck = mergePolicyAiRead(claim.policyCheck, parsePolicyAddOns(data), { compulsory: feeBill.compulsoryExcess || 0, voluntary: feeBill.voluntaryExcess || 0 })`, computed **before** filling excess;
  - fill `feeBill.compulsoryExcess` and `feeBill.lessExcess` from AI only when the current compulsory value is 0 or empty;
  - fill `voluntaryExcess` likewise.
- **Prompt:** add these five keys after `hpa_with`. Keep the JSON valid by adding a comma after the `hpa_with` line.

```
"nil_depreciation": "Is a Nil / Zero Depreciation add-on (also called 'Depreciation Reimbursement', 'Nil Dep', 'Bumper to Bumper') on THIS policy? Return \"yes\", \"no\" or \"unknown\"",
"imt23": "Is endorsement IMT 23 (cover for lamps, tyres, tubes, mudguards, bonnet, side parts, bumpers, headlights and paintwork of commercial vehicles) on this policy? Return \"yes\", \"no\" or \"unknown\"",
"consumables_cover": "Is a Consumables add-on on this policy? Return \"yes\", \"no\" or \"unknown\"",
"compulsory_excess": "Compulsory excess / deductible in rupees, digits only, or \"\"",
"voluntary_excess": "Voluntary excess in rupees, digits only, or \"\""
```

- [ ] **Step 1: Write the failing tests.**
  - A claim with no `policyCheck` gives `answered` 0 and `complete: false`.
  - All four answered gives `complete: true`.
  - Each of the three warnings is produced.
  - `parsePolicyAddOns({ nil_depreciation: 'YES', imt23: 'unknown', compulsory_excess: 'Rs. 1,000' })` gives `{ nilDep: 'yes', compulsoryExcess: 1000 }`.
  - `mergePolicyAiRead`: answer `nilDep: 'no'` with AI `'yes'` clears it; answer `imt23: 'na'` with AI `'no'` is kept; a different AI excess clears `excessConfirmed`.
- [ ] **Step 2: Run them.** `npx vitest run src/lib/policy`. Expected: FAIL.
- [ ] **Step 3: Implement** the types, the module, the prompt and `applyPolicy`.
- [ ] **Step 4: Run the tests and type check.** `npx vitest run && npx tsc --noEmit`. Expected: pass. If any existing prompt test pins the policy JSON keys, update it to include the new keys.
- [ ] **Step 5: Commit.** `git commit -m "feat: policy add-ons read by AI as suggestions; policy check status"`

### Task 12: Policy check notice and card (item 4, UI)

**Files:**
- Create: `src/components/policy/PolicyCheckCard.tsx`
- Create: `src/components/policy/PolicyCheckStrip.tsx`
- Test: `src/components/policy/__tests__/policy-check-card.test.tsx`
- Modify: `src/stores/slices/claimSlice.ts:50,221-232` (new action `setPolicyCheck`; `setDepreciationType` syncs the answer)
- Modify: `src/components/tabs/AssessmentTab.tsx` (strip above the grid)
- Modify: `src/components/tabs/ReportTab.tsx` (strip at the top for `surveyType === 'final'`)

**Interfaces:**
- Consumes: `PolicyCheck`, `policyCheckStatus` (Task 11).
- Produces:
  - `setPolicyCheck(updates: Partial<Omit<PolicyCheck, 'aiRead'>>): void`. It merges into `currentClaim.policyCheck`, sets `isDirty`, and, when `updates.nilDep` is present, sets `depreciationType` to `nilDep === 'yes' ? 'nil' : 'standard'`.
  - `setDepreciationType(t)` also sets `policyCheck.nilDep` to `t === 'nil' ? 'yes' : 'no'`.
  - `PolicyCheckCard` (no props). It reads the claim from the store and renders:
    - pill rows `Nil / Zero Dep` (Yes/No), `IMT 23` (Yes/No/N.A.) and `Consumables cover` (Yes/No), each with `AI read: Yes|No` beside it when `aiRead` has a value;
    - the two excess inputs bound to `feeBill.compulsoryExcess` (and `lessExcess`) and `feeBill.voluntaryExcess` through `updateFeeBill`, as `AssessmentSummary.tsx:166-169` does, plus a `Confirm` checkbox bound to `excessConfirmed`;
    - the `warnings` list.
  - `PolicyCheckStrip` (no props):
    - when incomplete, an amber bar `Policy check: {answered} of 4 confirmed` that toggles the card;
    - when complete, a small green chip `Policy checked` that also toggles the card;
    - warnings show in the bar even when complete.

- [ ] **Step 1: Write the failing tests** (`renderToStaticMarkup` with a seeded store):
  - the card renders the three pill labels and `AI read: Yes` when `aiRead.nilDep === 'yes'`;
  - the strip shows `0 of 4` for a blank claim and `Policy checked` when complete.

  Add store tests to an existing slice test file, or a new one under `src/stores/slices/__tests__/`:
  - `setPolicyCheck({ nilDep: 'yes' })` sets `depreciationType` to `'nil'`;
  - `setDepreciationType('standard')` sets `policyCheck.nilDep` to `'no'`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the actions, the card, the strip and the two placements.
- [ ] **Step 4: Run the tests and type check.** `npx vitest run && npx tsc --noEmit`. Expected: pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: policy check notice on Assessment and Report Center"`

### Task 13: Policy block in the print gate (item 4, block)

**Files:**
- Modify: `src/hooks/usePrintGate.tsx`
- Modify: `src/components/dialogs/BeforePrintDialog.tsx`
- Modify: `src/components/tabs/report/SurveyActions.tsx`, `src/components/tabs/BillCheckTab.tsx` (button hint text only)
- Test: `src/components/dialogs/__tests__/before-print-dialog.test.tsx` (add cases)

**Interfaces:**
- Consumes: `usePrintGate`, `GatedReport`, `BeforePrintDialog` (Task 6); `PolicyCheckCard`, `policyCheckStatus` (Tasks 11–12).
- Produces: no new names. Behaviour changes:
  - every `GatedReport` needs the dialog when `!policyCheckStatus(claim).complete`;
  - `showPolicy` renders the title `Policy check — confirm before printing` with `PolicyCheckCard`;
  - the Print button is disabled while the policy check is incomplete. It re-evaluates live from the store.

- [ ] **Step 1: Write the failing tests.**
  - `showPolicy` with a blank claim: the markup contains `Policy check — confirm before printing` and the Print button has the `disabled` attribute.
  - `showPolicy` with all four answered: Print is enabled.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **`usePrintGate`:**
    - `needsDialog = report.startsWith('uiic') || !policyCheckStatus(claim).complete`;
    - `showUiic = report.startsWith('uiic')`;
    - `showPolicy = !complete` at open time; keep the card visible after it completes so the surveyor sees it turn green;
    - title becomes `Before printing` when only the policy part shows.
  - **Buttons:** next to the final-report Print/Word buttons and the Bill Check Print button, while incomplete, show the small amber text `Policy check pending — click Print to complete it`. The buttons stay clickable and open the dialog.
- [ ] **Step 4: Run the tests and type check.** `npx vitest run && npx tsc --noEmit`. Expected: pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: final and bill-check reports need the policy check before print"`

---

## After all tasks

- [ ] Run the whole suite and the type check: `npx vitest run && npx tsc --noEmit`. Expected: pass.
- [ ] Run the lint: `npm run lint`. Expected: no new errors in touched files.
- [ ] Update the vault: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`, `Changelog.md`, and a new session log, per `AGENT_PROTOCOL.md`.
- [ ] Hand the owner the in-app check list:
  - each of the nine items, on one real claim;
  - a UIIC Word download opened in Word.
