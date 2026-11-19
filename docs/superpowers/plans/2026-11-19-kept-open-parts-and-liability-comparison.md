# Kept-Open Parts & Liability Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let surveyors mark rows K.O. (kept open). K.O. rows are excluded from the assessment but included in the Repair Basis of the liability comparison. The comparison also gets a missing-items deduction and its own Repair Basis build-up.

**Architecture:** A K.O. row is `allowed: false` + `keptOpen: true`, so every existing money path already excludes it. Two pure functions in `src/lib/calculations/kept-open.ts` compute the K.O. total and the comparison figures. One HTML renderer prints the table in four reports. The remaining work is display: every place that would print a K.O. row as "not allowed" or "not covered".

**Tech Stack:** Next.js 16, TypeScript, Zustand slices, Vitest (`npx vitest run <file>`), `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-11-19-kept-open-parts-and-liability-comparison-design.md`. Read it before any task.

## Global Constraints
- `keptOpen === true` ⇒ `allowed === false`. Anything that sets `allowed: true`, or toggles `allowed`, clears `keptOpen`.
- K.O. amount per row = `estimated × (1 + (gst ?? 0)/100)`. No depreciation, and the disposal flag is ignored.
- A new row or label prints only when its amount is > 0 or a K.O. row exists. Non-total-loss claims with no `keptOpen` rows must render byte-identical HTML. Total-loss claims change only inside the comparison table (the Repair Basis build-up), and the UIIC Final with Total Loss on gains the table.
- Missing items reduce only the three Total-Loss columns, never Repair Basis.
- Printed copy: `KEPT OPEN` (report rows, amber `#b45309`), `K.O.` (grid badge), `Add: K.O. parts (as per estimate)`, `Less: Missing items`, `Assessed repair cost (incl. GST)`, insured-report label `Kept open, to be decided after dismantling`.
- The CTL banner (`detectCTL`) stays unchanged.
- No changes to the SurveyOS Scan or `extension/` code. `SurveyReportDocument.tsx` is untouched.
- Files are UTF-8. Keep `₹` and `—` intact. There are no `console.log` calls.

## Review Focus
1. Old non-total-loss claims: the standard Final and the UIIC Final HTML must be unchanged. This is pinned in Task 3 and Task 4 with a test that builds the HTML before and after (capture the pre-change output as a fixture string in Step 1).
2. A K.O. row re-allowed with ✓ gets `assessed = estimated` and `keptOpen` is cleared. A K.O. row hit with ✕ becomes an ordinary rejection. Pinned in Task 1.
3. Missing items larger than the IDV clamp to 0 and never go negative. Pinned in Task 2.
4. A K.O. row whose `gst` is undefined counts at 0% GST and is not NaN. Pinned in Task 2.
5. The Repair Basis net equals the report's existing net plus the K.O. total, in both builders (parity). Pinned in Task 3 and Task 4.

---

### Task 1: Data field + store actions

**Files:**
- Modify: `src/types/assessment.ts` (AssessmentRow, near `allowed: boolean` ~106)
- Modify: `src/types/claim.ts:175-181` (`totalLossDetails`)
- Modify: `src/stores/slices/assessmentSlice.ts:92-99` (updateRow), `:369-389` (toggleRowAllowed)
- Test: `src/stores/slices/__tests__/kept-open-actions.test.ts`

**Interfaces — Produces:**
- `AssessmentRow.keptOpen?: boolean`
- `export interface MissingItem { id: string; description: string; amount: number }` in `src/types/claim.ts`. Then `totalLossDetails.missingItems?: MissingItem[]`.
- A store action `toggleRowKeptOpen(id: string): void`. If the row is not K.O., it sets `{ allowed: false, keptOpen: true }`. If it is K.O., it sets `{ allowed: true, keptOpen: false, assessed: estimated }`. Register it in the slice's type next to `toggleRowAllowed`.

- [ ] **Step 1: Write the failing tests.** Follow the pattern of `src/stores/slices/__tests__/extra-bill-actions.test.ts`.
  - `toggleRowKeptOpen on an allowed row → allowed false, keptOpen true`
  - `toggleRowKeptOpen twice → allowed true, keptOpen false, assessed === estimated`
  - `toggleRowAllowed on a K.O. row → allowed true, keptOpen false, assessed === estimated`
  - `updateRow(id, { allowed: true }) on a K.O. row → keptOpen false`
- [ ] **Step 2:** `npx vitest run src/stores/slices/__tests__/kept-open-actions.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Add the types and the action. In `toggleRowAllowed` and the `'allowed' in updates` branch, set `keptOpen: false` whenever the result changes `allowed`.
- [ ] **Step 4:** Re-run the tests and expect PASS. Then run `npx tsc --noEmit` and expect no new errors.
- [ ] **Step 5:** Commit `feat(assessment): kept-open (K.O.) flag on assessment rows`.

### Task 2: Pure calculations

**Files:**
- Create: `src/lib/calculations/kept-open.ts`
- Test: `src/lib/calculations/__tests__/kept-open.test.ts`

**Interfaces — Produces:**
```ts
export function keptOpenRows(rows: AssessmentRow[]): AssessmentRow[];
export function keptOpenTotal(rows: AssessmentRow[]): number; // Σ estimated*(1+(gst??0)/100), keptOpen rows only
export interface ComparisonInput {
  idv: number; excess: number;
  repairGrandInclGst: number; repairTowing: number; repairSalvage: number;
  keptOpen: number;
  tl: { salvageWithRC: number; salvageWithoutRC: number; towingExpenses: number; workshopRent: number; missingItems?: MissingItem[] };
}
export interface LiabilityComparison {
  repair: { grand: number; excess: number; salvage: number; towing: number; keptOpen: number; net: number };
  idv: number; excess: number; missing: number; addl: number;
  salvageWithRC: number; salvageWithoutRC: number;
  totalLoss: number; netWithRC: number; netWithoutRC: number;
}
export function liabilityComparison(i: ComparisonInput): LiabilityComparison;
```
Math (fixed by the spec):
- `repair.net = max(0, grand + towing − salvage − excess) + keptOpen`
- `base = max(0, idv − excess − missing)`
- `addl = towingExpenses + workshopRent`
- `totalLoss = base + addl`
- `netWithRC = max(0, base − salvageWithRC) + addl`
- `netWithoutRC` is the same with `salvageWithoutRC`.

- [ ] **Step 1: Write the failing tests:**
  - `keptOpenTotal`: rows `{keptOpen:true, allowed:false, estimated:10000, gst:18}` + `{keptOpen:true, estimated:5000, gst:undefined}` + an allowed row of 99999 → `16800`
  - The spec's worked example: idv 500000, excess 2000, grand 240000, towing 3000, salvage 5000, keptOpen 60000, tl {salvRC 120000, salvWoRC 80000, towing 3000, rent 0, missing [{amount:15000}]}. Expect `repair.net 296000`, `totalLoss 486000`, `netWithRC 366000`, `netWithoutRC 406000`.
  - `missing > idv → totalLoss === addl`, with nothing negative
  - `missingItems undefined → missing 0`
- [ ] **Step 2:** `npx vitest run src/lib/calculations/__tests__/kept-open.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Export it from `src/lib/calculations/index.ts` if that barrel exists.
- [ ] **Step 4:** Re-run and expect PASS.
- [ ] **Step 5:** Commit `feat(calc): K.O. total and liability comparison`.

### Task 3: Shared table renderer + standard report

**Files:**
- Create: `src/lib/reports/liability-comparison-html.ts`
- Modify: `src/lib/reports/standard-report-builder.ts`: section 9 rows (~414, ~464), section 8 summary (after the "RUPEES … ONLY" row ~880), and the TL table (885-952)
- Test: `src/lib/reports/__tests__/kept-open-report.test.ts`

**Interfaces:**
- Consumes: `liabilityComparison` and `keptOpenTotal` (Task 2), `AssessmentRow.keptOpen` (Task 1)
- Produces: `export function renderLiabilityComparison(c: LiabilityComparison, opts: { td: string; title: string; remarks: string; headerBg: string; labelFont: string }): string`. Row order and labels are exactly the spec's table. The K.O. and missing rows print only if > 0. "—" goes in cells that don't apply.

- [ ] **Step 1: Write the failing tests.** Build the claims with the `row()` helper pattern from `src/lib/reports/__tests__/net-liability-parity.test.ts`.
  - `old TL claim (no keptOpen, no missingItems): buildStandardFinalHTML output unchanged except Repair Basis cells`. Assert that the output has no `K.O.` and no `Missing items`, and that it contains `Assessed repair cost (incl. GST)`.
  - `K.O. row prints KEPT OPEN in section 9 and never NOT ALLOWED for that row`
  - `section 8 prints the K.O. line with keptOpenTotal when a K.O. row exists; absent otherwise`
  - `Repair Basis NET equals NET ASSESSED LOSS + K.O. total` (parity, read from the HTML)
  - `isBillCheck mode: table renders via the same function; no K.O. row`
- [ ] **Step 2:** `npx vitest run src/lib/reports/__tests__/kept-open-report.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the renderer. Replace the inline IIFE at 885-952 with a call to the renderer:
  - `repairGrandInclGst = grand`, `repairTowing = towing`, `repairSalvage = salvage`, `excess = excess`.
  - `keptOpen = isBillCheck ? 0 : keptOpenTotal(rows)`.
  - Keep the title and the remarks fallback text exactly as they are now.
  - In section 9, a row with `r.keptOpen` prints `KEPT OPEN` in amber where it prints `NOT ALLOWED` today, and its Estimated cell keeps its value.
  - Add the section 8 line: `K.O. parts (as per estimate, incl. GST) — not included above`, with its amount.
- [ ] **Step 4:** Re-run that test file, then run the whole reports folder (`npx vitest run src/lib/reports`). Expect PASS, including the existing parity tests.
- [ ] **Step 5:** Commit `feat(report): K.O. and missing items in standard liability comparison`.

### Task 4: UIIC Final + UIIC Bill Check

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts`: rows at 369-374, 397/408 and 415/434; Final page 3 after the Details table (~line 476, before `p5`); the Bill Check TL table at ~798-862
- Test: `src/lib/reports/__tests__/kept-open-uiic.test.ts`

**Interfaces — Consumes:** `renderLiabilityComparison`, `liabilityComparison`, `keptOpenTotal`.

- [ ] **Step 1: Write the failing tests:**
  - `UIIC Final, K.O. row → "Kept Open" not "Not Allowed" in that row`
  - `UIIC Final, isTotalLoss on → comparison table appears after DETAILS OF ASSESSMENT and before GST SUMMARY`. Assert the index order in the HTML.
  - `UIIC Final, isTotalLoss off → no comparison table`
  - `UIIC Final Repair Basis NET === Net Assessment + K.O. total`
  - `UIIC Bill Check old TL claim → no K.O./Missing rows; Repair Basis shows build-up`
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Implement.
  - For the Final: `repairGrandInclGst = pT + lT`, `repairTowing = tow`, `repairSalvage = salvage`, `excess = volExcess + compExcess`, `keptOpen = keptOpenTotal(rows)`.
  - For the Bill Check: use that builder's own gross, towing and salvage values, with `keptOpen = 0`.
  - Pass UIIC's green header (`#006838`) and UIIC's remarks fallback text through `opts`.
- [ ] **Step 4:** Run `npx vitest run src/lib/reports` and expect PASS.
- [ ] **Step 5:** Commit `feat(uiic): K.O. rows and liability comparison in UIIC Final and Bill Check`.

### Task 5: Assessment grid K.O. button + missing items form

**Files:**
- Modify: `src/components/claim/AssessmentSectionTable.tsx` (Allow column ~591-652; the "With GST" cell ~634)
- Modify: `src/components/claim/assessment-grid-config.ts:130` (row tint)
- Modify: `src/components/claim/TotalLossForm.tsx`

**Interfaces — Consumes:** `toggleRowKeptOpen` (Task 1), `MissingItem` (Task 1), `keptOpenTotal` (Task 2).

- [ ] **Step 1:** Add a small `K.O.` toggle button beside ✓/✕. It calls `toggleRowKeptOpen(row.id)` and uses `aria-pressed={!!row.keptOpen}`. Give it the title `Kept open — decide after dismantling`.
- [ ] **Step 2:** A K.O. row gets an amber tint (`bg-amber-500/10`) instead of the muted strike-through. Its With-GST cell shows `formatCurrency(estimated*(1+gst/100))` in amber, not `₹0.00`.
- [ ] **Step 3:** In `TotalLossForm`, add a "Missing items" list: description + amount inputs, with add and remove buttons. Write through `updateTLDetails('missingItems', [...])` with ids from `crypto.randomUUID()`. Show the list total below it.
- [ ] **Step 4:** Run `npx tsc --noEmit` (no new errors) and `npx vitest run src/components` (PASS).
- [ ] **Step 5:** Commit `feat(ui): K.O. toggle in assessment grid and missing items in Total Loss form`.

### Task 6: Insured report, Smart Remarks, price history, bill read-in, NIA export

**Files:**
- Modify: `src/lib/ai/insured-report.ts:53-62, 312, 658`; `src/lib/ai/prompts.ts:494`; `src/lib/calculations/insured-report.ts:98`; `src/components/pdf/InsuredSummaryDocument.tsx:63-64, 332-338`
- Modify: `src/components/claim/SmartRemarksCell.tsx:10-25, 61`
- Modify: `src/lib/claims/part-history.ts:73` (+ the `PartHistoryEntry` type and where it renders `disallowed`)
- Modify: `src/stores/slices/aiDataSlice.ts:699-705`
- Modify: `src/lib/reports/nia-assessment-excel.ts` (row list ~125-141)
- Test: add cases to `src/lib/calculations/__tests__/insured-report.test.ts`; create `src/lib/reports/__tests__/kept-open-misc.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - `insured summary: K.O. row is not in the disallowed list and contributes 0 to every total`
  - `InsuredSummaryDocument categoryLabel(cat, false, true) === 'Kept open, to be decided after dismantling'`. Add a third param `keptOpen?: boolean`, export it if needed for the test, and print no amount for that row.
  - `NIA export: K.O. rows absent`
  - `part history entry for K.O. row has keptOpen: true`
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Implement each change.
  - **Insured report (AI side):** K.O. rows go to the AI under their own `keptOpen: true` and never count as disallowed. Add the prompt rule: `If keptOpen = true → say the part is kept open and will be decided after dismantling; give no amount.`
  - **Smart Remarks:** add a `'kept-open'` RowContext, checked before `'disallowed'`. Its default remark is `Kept open pending dismantling`.
  - **Bill read-in:** for a K.O. row, `billRemarks: 'Billed while still kept open — decide in Assessment'`.
- [ ] **Step 4:** Run `npx vitest run` and expect PASS. Run `npx tsc --noEmit` and expect no new errors.
- [ ] **Step 5:** Commit `feat: K.O. rows read "kept open" in insured report, remarks, history, bill read-in; excluded from NIA export`.

### Task 7: Bill Check print hold

**Files:**
- Modify: `src/hooks/useBillCheckPrintGate.tsx`
- Modify: `src/components/tabs/BillCheckTab.tsx` (banner)
- Test: `src/hooks/__tests__/bill-check-kept-open-gate.test.ts` (create the folder if it is missing)

**Interfaces — Consumes:** `keptOpenRows` (Task 2).

- [ ] **Step 1: Write the failing test.** Export a pure helper `keptOpenBlock(rows): { blocked: boolean; particulars: string[] }`, then test: `blocked when any row keptOpen; lists its particulars; not blocked otherwise`.
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** The gate holds printing while the helper says it is blocked. `BillCheckTab` shows an amber banner listing those parts, with the text `These parts are still kept open. Decide them in the Assessment tab before printing the Bill Check.` and a button that navigates to the Assessment tab with the existing tab-switch call that BillCheckTab already uses.
- [ ] **Step 4:** Run `npx vitest run` and expect PASS. Run `npx tsc --noEmit` and expect no new errors.
- [ ] **Step 5:** Commit `feat(bill-check): hold printing while parts are kept open`.

### Task 8: Vault + Scan note
- [ ] Following `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/AGENT_PROTOCOL.md`, update `Tasks.md` and `Changelog.md` and add a session log. State "SurveyOS Scan impact: none (assessment rows are not a coupling point)".
- [ ] Commit `docs: record K.O. parts and liability comparison`.
