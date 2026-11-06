# Session: 2026-11-06 (Antigravity) — UIIC and Standard Bill Check Calculation Audit & Net Liability Fix

## What I Did
1. **Audited Financial Calculations Across Bill Check Engine & Reports:**
   - Evaluated `src/lib/reports/uiic-final-builder.ts` (`buildUIICBillCheckHTML`).
   - Evaluated `src/lib/reports/standard-report-builder.ts` (`buildStandardFinalSurveyHTML` in `bill-check` mode).
   - Evaluated `src/lib/calculations/assessment.ts` (`calculateBillCheckSummary`, `calculateAssessmentSummary`).
   - Evaluated `src/lib/calculations/row-net.ts` (`computeRowLiability`, `computeRowNet`).
   - Evaluated `src/lib/reports/bill-check-projection.ts` (`billCheckAssessed`, `projectForBillCheck`, `resolveBillSalvage`).
   - Evaluated `src/components/tabs/BillCheckTab.tsx` and `BillCheckSummaryPanel.tsx`.

2. **Identified the Root Causes of the Surveyor's Issue:**
   - **Page 2 Summary Table Disconnect:** `Total Assessed (After Dep + GST)` was rendered at the top of the deduction table, but the code deducted salvage, voluntary excess, and compulsory excess from `totalBilled` (derived from `bcSummary.grandTotalBilled`), completely ignoring the Total Assessed row above it.
   - **Page 1 Summary Arithmetic Impossibility:** Page 1's right column started with `Assessed Loss: gross`, listed Salvage and Excess, and ended with `Net Liability (Billed): netBilledLiability`. Because `netBilledLiability` was subtracted from `totalBilled`, $gross - salvage - excess \ne netBilledLiability$, creating an impossible equation on the printed page.
   - **Conflicting Net Totals on Same Page:** Page 2 displayed Table A (`ASSESSMENT SUMMARY`) with `NET ASSESSED LOSS: ₹ X` and Table B directly below it with `NET LIABILITY: ₹ Y`, each with differing written-out amount in words.
   - **Misleading Billed Label:** `bcSummary.grandTotalBilled` had vehicle depreciation applied, GST added, and was capped at assessed, but was mislabeled "Total Billed by Workshop", conflicting with `Workshop Invoice Total (₹)`.

3. **User Clarification & Architectural Choice (Option A):**
   - User confirmed preference:
     1. Pure Assessed Loss Basis — Net Liability = Total Assessed (After Dep + GST) minus Salvage minus Excess.
     2. Remove any mention of the billed total from the bottom summary box entirely.

4. **Implemented the Solution in `uiic-final-builder.ts`:**
   - Page 2 bottom summary table now derives cleanly from `gross` (Total Assessed after Dep + GST):
     - `Total Assessed (After Dep + GST): ₹ gross`
     - `Less: Salvage: ₹ salvage`
     - `Less: Voluntary / Imposed Excess: ₹ volExcess`
     - `Less: Compulsory Excess: ₹ compExcess`
     - `NET LIABILITY (PAYABLE TO WORKSHOP): ₹ net`
   - Removed `Total Billed by Workshop` row from the deduction table.
   - Words block updated: `In words: RUPEES ${numberToWords(net)} ONLY`.
   - Service Hub block updated: `Net liability confirmed at Rs. ${fa(net)}.`.
   - Page 1 summary updated: `Towing Charges: ${fa(tow)}` on left, `Net Liability: ${fa(net)}` on right.
   - Removed unused `calculateBillCheckSummary` invocation from `uiic-final-builder.ts`.

5. **Added Regression Unit Test & Verified Full Suite:**
   - Added test in `src/lib/reports/__tests__/bill-check-report.test.ts` verifying net liability is deducted from assessed amount (after dep + GST), not billed, and that "Total Billed by Workshop" is not present in the deduction box.
   - Verified 40 report test files (394 tests) pass.
   - Verified entire project test suite: 280 test files pass, 2,508 tests pass (100% green).
   - Verified `npx tsc --noEmit`: 0 errors.

## Part 2: Standard Bill Check Net Liability Calculation Reconciliation

1. **User Finding:**
   - User noted that Standard Bill Check had the same core discrepancy: Column 3 (`Assessed (after Dep.)`), Column 4 (`Incl. GST`), and Net Liability were taking capped workshop billed amounts instead of the surveyor's actual assessed loss.

2. **Root Cause Identified in Standard Bill Check:**
   - In `src/lib/reports/standard-report-builder.ts`:
     - Line 92 executed `rows = isBillCheck ? projectForBillCheck(claim.assessmentRows || []) : ...`.
     - `projectForBillCheck(rows)` mutated `r.assessed = Math.min(r.assessed, r.billedTaxable)`.
     - Consequently, Section 8's Column 3 (`Assessed (after Dep.)`), Column 4 (`Incl. GST`), `grand`, and `net` were all derived from workshop billed amounts rather than surveyor assessment.
     - Section 9 item table printed the capped billed figure in the `Assessed ₹` column, overwriting the surveyor's assessment.
   - In `src/lib/calculations/assessment.ts`:
     - `calculateBillCheckSummary` computed `netLiability = Math.max(0, billedGrandTotal - salvage - totalExcess)`. This meant the "Final Liability" card on the Bill Check screen was deducting salvage and excess from `billedGrandTotal`.

3. **Implementation in `standard-report-builder.ts` & `assessment.ts`:**
   - Disconnected `rows` in `standard-report-builder.ts` from `projectForBillCheck`: `rows = claim.assessmentRows || []`.
   - Computed explicit taxable base totals for Column 2 (`Billed`): `col2PartsBase`, `col2Metal`, `col2Plastic`, `col2Glass`, `col2Fbr`, `col2LabBase`, `col2LabOnly`, `col2PaintOnly`.
   - Wired Column 3 and Column 4 in Section 8 strictly to surveyor assessed figures (`pb`, `labBase`, `grand`).
   - Labeled Section 8 final total as `${isBillCheck ? 'NET LIABILITY' : 'NET ASSESSED LOSS'}` and computed strictly as $\text{grand} - \text{salvage} - \text{excess}$.
   - In Section 9 item table, preserved `r.assessed` in the `Assessed ₹` column, and populated `Bill ₹` with `r.billedTaxable ?? r.estimated` (or `No Bill` for `not-in-bill`).
   - In `calculateBillCheckSummary`, accumulated `assessedGrandTotal += assessedNet` for allowed rows and set `netLiability = Math.max(0, assessedGrandTotal - salvage - totalExcess)` and `grandTotalAssessed: assessedGrandTotal`.

4. **Verification & Testing:**
   - Added regression test to `src/lib/reports/__tests__/standard-bill-check.test.ts` verifying that when assessed is ₹10,000 and billed is ₹7,000, Section 8 Columns 3/4 and Section 9 preserve ₹10,000 assessed (after dep/GST) and Net Liability deducts salvage and excess from assessed loss, NOT billed.
   - Full Vitest suite: 280 test files passed, 2,509 tests passed (100% green).
   - TypeScript compiler (`npx tsc --noEmit`): 0 errors.

## Decisions Made
- UIIC Bill Check Report follows the pure assessment loss structure defined in UIIC gold standard format (`UIIC main correct format.html`).
- The Net Liability payable to workshop is strictly $gross - salvage - excess$.
- Standard Bill Check Report presents Column 2 as the workshop Billed amount, while Columns 3, 4, and Net Liability reflect the surveyor's true assessment, ensuring complete transparency and mathematical integrity between billed and assessed figures.

## Files Changed
- `src/lib/reports/uiic-final-builder.ts` (modified)
- `src/lib/reports/standard-report-builder.ts` (modified)
- `src/lib/calculations/assessment.ts` (modified)
- `src/lib/reports/__tests__/bill-check-report.test.ts` (modified)
- `src/lib/reports/__tests__/standard-bill-check.test.ts` (modified)
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md` (modified)
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md` (modified)
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-11-06-uiic-and-standard-bill-check-calculation-audit.md` (modified)
- `C:\Users\Manasi\.gemini\antigravity\brain\10cf1a78-69db-41da-a8c1-96dc06889aa3\bill-check-audit-report.md` (new artifact)

## Production Deployment & Live Verification
- Static export build: `npm run build` completed cleanly (Next.js 16.2.2 static export to `out/`).
- Deployed to Firebase Hosting target `motorsurveyos-in` on project `surveyos-v2-antigravity-in`.
- Deployed to Firebase Hosting target `surveyos-v2-antigravity-in` on project `surveyos-v2-antigravity-in`.
- Live chunk verification: Queried chunk `0ggmzt3b_5lsd.js` via curl on `https://surveyos.in` and `https://motorsurveyos-in.web.app`, confirming `Towing Charges` and `Less: Voluntary / Imposed Excess` deduction stack are live in production.
- Git commit on `main`: `4744d70a` pushed to `origin/main`.
