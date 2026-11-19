# Cash Loss Basis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any Final claim can switch on a cash-loss settlement. The surveyor enters a notional %, and the reports show an 8A Cash Loss Basis table beside the repair basis.

**Architecture:** A `cashLoss` setting lives on the claim. The pure function `cashLossBasis(claim, ageMonths)` derives everything from allowed rows through `computeRowNet(row, rowDepRate(...)).netBeforeGst`, so the standard and UIIC reports print the same figures. A shared `renderCashLossTable` prints 8A. The liability comparison gains an optional Cash Loss column.

**Tech Stack:** Next.js 16, TypeScript, Zustand, Vitest (`npx vitest run <file>`), `npx tsc --noEmit`. Scan: Kotlin/Gradle.

**Spec:** `docs/superpowers/specs/2026-11-19-cash-loss-basis-design.md`. Read it, especially **Rulings** and the **Where cash loss shows** table, before any task.

## Global Constraints
- `ClaimData.cashLoss?: { enabled: boolean; notionalPercent: number | null }`. Undefined means off. There is no default %.
- Every figure is before GST. Row data is never altered.
- Rows that count: `allowed !== false && !keptOpen`.
- Gross = labour + paint (after paint-material dep) + parts per material (after dep, IMT-23 share out) + towing − salvage. Notional = Gross × N/100. Net = max(0, Gross − notional − excess).
- Unchanged: section 8, fee bill, IRDAI summary, portals and NIA/OIC/UIIC exports.
- Exact copy:
  - `8A. CASH LOSS BASIS (without production of repair bills; all figures before GST)`
  - `Labour assessed (before tax)`
  - `Add: Towing charges`
  - `Metal parts after depreciation (before tax)` (also `Plastic / Rubber`, `Glass`, `Fibre Glass`)
  - `Less: Salvage`
  - `GROSS ASSESSED LOSS`
  - `Less: Notional deduction for non-submission of bills @ N%`
  - `Less: Policy Excess (Compulsory / Voluntary)`
  - `NET LIABILITY ON CASH LOSS BASIS`
  - Doc label: `Cash Loss Consent of Insured`
- Claims with cash loss off must render byte-identical HTML. The existing `non-ko-byte-identical.test.ts` must stay green, and each report task adds a cash-loss-off case.
- UTF-8: keep ₹ and — intact. No console.log. Smallest diff, and reuse existing helpers.

## Review Focus
1. **IMT-23 claim:** Gross must equal section 8's assessed grand total + towing − salvage. Pinned in Task 1.
2. **Standard vs UIIC:** on the same claim the two Grosses must be equal. Pinned in Task 3.
3. **Bad percent** (`notionalPercent` null, negative or > 100): the print is held, and no NaN appears in the HTML. Pinned in Tasks 1 and 2.
4. **K.O. rows on a cash-loss claim:** the print is held and the parts are listed. Pinned in Task 1 (`cashLossHold`) and Task 2.
5. **Cash loss on while Total Loss is off:** the comparison table is not printed. Pinned in Task 2.

---

### Task 1: Data + calculation + hold reasons

**Files:**
- Modify: `src/types/claim.ts` (ClaimData, beside `isTotalLoss`)
- Create: `src/lib/calculations/cash-loss.ts`
- Test: `src/lib/calculations/__tests__/cash-loss.test.ts`

**Interfaces — Produces:**
```ts
export interface CashLossBasis {
  labour: number;            // labour + paint, after paint-material dep, before GST
  towing: number;
  parts: { metal: number; plastic: number; glass: number; fiberglass: number };
  salvage: number; gross: number;
  percent: number | null; notional: number; excess: number; net: number;
}
export function cashLossBasis(claim: ClaimData, ageMonths: number): CashLossBasis | null; // null when !claim.cashLoss?.enabled
export function cashLossHold(claim: ClaimData): string[]; // [] = may print; else human messages
```
- Towing, salvage and excess come from the same `feeBill` fields section 8 uses: `towingCharges`, `salvageValue`, `voluntaryExcess + getCompulsoryExcess(feeBill)`.
- When `percent` is null, `notional` = 0 and `net` = max(0, gross − excess). The print hold stops it from printing.
- `cashLossHold` returns two kinds of message:
  - `Enter the notional deduction % for cash loss` when the percent is null or outside 0–100;
  - `Decide these as allowed or not allowed: <particulars, comma-joined>` when K.O. rows exist.

- [ ] **Step 1: Write the failing tests.** Build rows with the `row()` helper pattern in `src/lib/reports/__tests__/net-liability-parity.test.ts`.
  - `sample: labour 36750, metal 68960.50, plastic 4775, glass 1600, salvage 7085, excess 1000, 30% → gross 105000.50, notional 31500.15, net 72500.35`. Build rows whose `computeRowNet(...).netBeforeGst` equals these figures, for example dep 0 with `depOverride: 0`, or check `row-net.ts`.
  - `IMT-23 row: gross === section 8 assessed grand (calculateAssessmentSummary assessed total before GST) + towing − salvage`
  - `not-allowed and keptOpen rows excluded`
  - `returns null when cashLoss undefined or enabled false`
  - `percent null → notional 0, no NaN`
  - `cashLossHold: null % → message; 120 → message; K.O. row → lists particulars; valid → []`
- [ ] **Step 2:** `npx vitest run src/lib/calculations/__tests__/cash-loss.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement using `computeRowNet` (`src/lib/calculations/row-net.ts`) and `rowDepRate` (`src/lib/calculations/row-dep-rate.ts`). These are the same calls `standard-report-builder.ts` uses for `pb` and `labBase`.
- [ ] **Step 4:** Run the tests and expect PASS. Run `npx tsc --noEmit` and expect no new errors.
- [ ] **Step 5:** Commit `feat(calc): cash loss basis calculation`.

### Task 2: Standard Final — 8A table, preamble, comparison column, print hold

**Files:**
- Create: `src/lib/reports/cash-loss-html.ts`
- Modify: `src/lib/calculations/kept-open.ts`. Add an optional `cash?: { gross: number; percent: number; notional: number; net: number }` to `ComparisonInput` and `LiabilityComparison`, passed through.
- Modify: `src/lib/reports/liability-comparison-html.ts`. Add a 5th "Cash Loss" column only when `c.cash` is set: the rows `Cash loss gross (before GST, after salvage & towing)` and `Less: Notional deduction @ N%`, the excess in the existing excess row, "—" elsewhere, and NET = `cash.net`.
- Modify: `src/lib/reports/standard-report-builder.ts`. Insert 8A after section 8 (after the "RUPEES … ONLY" row, before the TL comparison). Pass `cash` into the comparison. Add the preamble sentence only in the auto-composed branch (`preambleFromClaim`).
- Modify: the Final print / Word-export gate (`src/hooks/usePrintGate.tsx` and the Final export handler in `src/components/tabs/report/SurveyActions.tsx`). Hold with `toast.error(cashLossHold(claim).join(' · '))` when the list is non-empty.
- Test: `src/lib/reports/__tests__/cash-loss-report.test.ts`

**Interfaces:**
- Consumes: `cashLossBasis` and `cashLossHold` (Task 1).
- Produces: `export function renderCashLossTable(b: CashLossBasis, o: { td: string; tdr: string; headBg: string; title?: string }): string`. Rows follow the spec's 8A table. A material row prints only when it is > 0. The amount-in-words line uses `numberToWords(b.net)`.

- [ ] **Step 1: Write the failing tests:**
  - `cash loss off → buildStandardFinalHTML identical to before` (capture before editing)
  - `cash loss on → 8A title present, after "8. ASSESSMENT SUMMARY" and before "9. DETAILS"; NET 72,500.35 for the sample claim`
  - `section 8 NET ASSESSED LOSS unchanged when cash loss on`
  - `auto preamble contains "cash loss basis" and "30%"; a surveyor-typed reportPreamble is untouched`
  - `isTotalLoss + cash loss → comparison has a "Cash Loss" header and its NET equals 8A net; cash loss on with TL off → no comparison table`
  - `percent null → no "NaN" in HTML`
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Implement. Use the builder's existing `td` and `tdr` styles and the section-header style, so 8A matches section 8.
- [ ] **Step 4:** Run `npx vitest run src/lib/reports src/lib/calculations` and expect PASS. Run `npx tsc --noEmit` and expect no new errors.
- [ ] **Step 5:** Commit `feat(report): cash loss basis in the standard Final report`.

### Task 3: UIIC Final

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts`, `buildUIICFinalHTML`:
  - 8A goes in `p3` after DETAILS OF ASSESSMENT, before the TL comparison if present.
  - The `payableByInsurer` box shows `cashLossBasis(...).net` when cash loss is on.
  - The `p5` line "claim is recommended for Rs." shows the cash-loss net.
  - The "I / We hereby authorize repairs for Rs." line is omitted on cash loss.
  - Pass `cash` into the comparison.
- Test: `src/lib/reports/__tests__/cash-loss-uiic.test.ts`

**Interfaces — Consumes:** `cashLossBasis`, `renderCashLossTable`, the comparison `cash` field.

- [ ] **Step 1: Write the failing tests:**
  - `cash off → UIIC Final HTML identical`
  - `cash on → 8A between DETAILS OF ASSESSMENT and GST SUMMARY; Amount Payable by Insurer = cash net`
  - `"authorize repairs" absent; "recommended for Rs. <cash net>" present`
  - `same claim: UIIC 8A gross === standard 8A gross`
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Implement. Pass UIIC's own `td` style to the renderer.
- [ ] **Step 4:** Run `npx vitest run src/lib/reports` and expect PASS. Run `tsc` and expect no new errors.
- [ ] **Step 5:** Commit `feat(uiic): cash loss basis in UIIC Final`.

### Task 4: Settlement basis panel, K.O. lock, Bill Check off

**Files:**
- Modify: `src/components/claim/TotalLossForm.tsx`. Retitle the panel "Settlement basis" and keep the Total Loss switch and its fields unchanged. Add a **Cash Loss** switch that writes `cashLoss: { enabled, notionalPercent }` through `updateClaim`. Add a "Notional deduction %" number input (min 0, max 100, empty → null) and a live preview of the Gross and Net from `cashLossBasis`.
- Modify: `src/components/claim/AssessmentSectionTable.tsx`. Disable the K.O. button when `claim.cashLoss?.enabled`, with the title `Not available on cash loss claims`.
- Modify: `src/components/tabs/BillCheckTab.tsx`. When cash loss is on, show `This claim is settled on cash loss basis — no bill check` in place of the workflow.
- Modify: `src/hooks/useBillCheckPrintGate.tsx` and `src/components/tabs/report/BillCheckActions.tsx`. Hold Bill Check print and Word export when cash loss is on, with that same message as the toast.
- Test: `src/hooks/__tests__/bill-check-cash-loss-gate.test.ts`. Extract a pure helper beside `keptOpenBlock`, `billCheckHoldReasons(claim): string[]`, which combines the K.O. and cash-loss reasons, and test it.

- [ ] **Step 1:** Write the failing test for `billCheckHoldReasons`: `cash loss on → contains the cash-loss message; K.O. row → contains K.O. message; neither → []`.
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Implement the helper and the UI changes. Reuse `keptOpenBlock` inside the helper.
- [ ] **Step 4:** Run `npx vitest run` and expect PASS. Run `npx tsc --noEmit` and expect no new errors.
- [ ] **Step 5:** Commit `feat(ui): settlement basis panel with cash loss switch`.

### Task 5: Insured Report line, consent document, Scan, vault

**Files:**
- Modify: `src/components/pdf/InsuredSummaryDocument.tsx`. When cash loss is on, add one line: `Settled on cash loss basis at your request; a notional deduction of N% (₹X) applies as repair bills are not submitted.` X = notional amount, formatted with the file's `fmt`.
- Modify: `src/types/documents.ts`. Add `'cashLossConsent'` to `DocType`, with `DOC_TYPE_LABEL` `Cash Loss Consent of Insured`. Show it in the checklist as required only when `claim.cashLoss?.enabled`. Find the required-docs logic used by `DocumentChecklist.tsx`. It is never a print block.
- Scan (`../SurveyOS Scan`, Kotlin):
  - mirror the new doc type and label wherever Scan lists Prime's doc types (its drift tests name the file);
  - run `./gradlew :app:testDebugUnitTest` in Git Bash with `JAVA_HOME` set to Android Studio's `jbr` folder;
  - add a note to `../SurveyOS Scan/docs/handover/` (new file `prime-cash-loss-doc-type.md`).
- Vault: follow `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/AGENT_PROTOCOL.md`. Update `Tasks.md` and `Changelog.md`, and add a session log `Sessions/2026-11-19-cash-loss-basis.md`.
- Test: add to the existing InsuredSummaryDocument or insured-report test file: `cash loss on → line with 30% and amount; off → absent`.

- [ ] **Step 1:** Write the failing insured-report test and run it (FAIL).
- [ ] **Step 2:** Implement the line and the doc type. Run `npx vitest run` and `npx tsc --noEmit` and expect PASS and no new errors.
- [ ] **Step 3:** Make the Scan change and run its tests (PASS). Commit in the Scan repo: `feat: cash loss consent doc type (mirrors Prime)`.
- [ ] **Step 4:** Commit in Prime: `feat: cash loss in insured report and consent document`. Then commit the vault docs: `docs: record cash loss basis`.
