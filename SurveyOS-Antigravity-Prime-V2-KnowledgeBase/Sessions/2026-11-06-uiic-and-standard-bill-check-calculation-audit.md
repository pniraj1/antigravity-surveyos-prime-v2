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

## Decisions Made
- UIIC Bill Check Report follows the pure assessment loss structure defined in UIIC gold standard format (`UIIC main correct format.html`).
- The Net Liability payable to workshop is strictly $gross - salvage - excess$.
- Standard Bill Check Report continues using its own item-level `projectForBillCheck` projection which already subtracts salvage and excess from Column 4 (`Incl. GST`).

## Files Changed
- `src/lib/reports/uiic-final-builder.ts` (modified)
- `src/lib/reports/__tests__/bill-check-report.test.ts` (modified)
- `C:\Users\Manasi\.gemini\antigravity\brain\10cf1a78-69db-41da-a8c1-96dc06889aa3\bill-check-audit-report.md` (new artifact)

## Production Deployment & Live Verification
- Static export build: `npm run build` completed cleanly (Next.js 16.2.2 static export to `out/`).
- Deployed to Firebase Hosting target `motorsurveyos-in` on project `surveyos-v2-antigravity-in`.
- Deployed to Firebase Hosting target `surveyos-v2-antigravity-in` on project `surveyos-v2-antigravity-in`.
- Live chunk verification: Queried chunk `0ggmzt3b_5lsd.js` via curl on `https://surveyos.in` and `https://motorsurveyos-in.web.app`, confirming `Towing Charges` and `Less: Voluntary / Imposed Excess` deduction stack are live in production.
- Git commit on `main`: `4744d70a` pushed to `origin/main`.
