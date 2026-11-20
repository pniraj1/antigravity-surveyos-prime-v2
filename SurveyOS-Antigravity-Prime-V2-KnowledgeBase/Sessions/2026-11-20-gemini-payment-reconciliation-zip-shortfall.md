# Session: 2026-11-20 (Antigravity) — ZIP Attachment Parsing, Real-World Insurer Formats & Fee Shortfalls

## What I Did
- Analyzed 5 real-world `.eml` sample payment advice emails provided by the user (Vikram Patil):
  1. United India Insurance (`policy.noreply@service.uiic.co.in`): Claim `2310023126C050058001`, Vehicle `MH 18 BZ 2552`, Net `Rs. 5468/-`, Gross `6076`, TDS `608`.
  2. Axis Bank CMS Advice for UIIC (`Straight2axis@axis.bank.in`): Attached `.zip` archive containing detailed payment voucher `.pdf`. Enrichment block contains Vehicle `GJ20AH3438` and Claim `2310843126C050010001`.
  3. New India Assurance (`NIAHO@newindia.co.in`): Table layout with Amount `1570.00`, Vehicle `MH-39-J-6873`, and negative TDS `-157.00`, Net credit `1413.00`.
  4. Axis Bank CMS Advice for Oriental Insurance: Remittance advice with zip attachment containing voucher.
- Implemented in-memory `.zip` archive extraction using `readZip` in `src/lib/ai/payment-advice-extractor.ts` and `PaymentReconciliationTab.tsx`. Unpacks zip files directly in browser memory and parses enclosed `.pdf` or text payment vouchers.
- Enhanced `PAYMENT_ADVICE_PROMPT` with explicit extraction patterns for UIIC, NIA table layouts with negative TDS rows, and Axis Bank CMS `Enrichment:` blocks.
- Added fee shortfall and insurer disallowance tracking:
  - Extended `FeeBill` and `PaymentAdviceClaimItem` with `disallowedAmount?: number;`.
  - Extended `PaymentMatchResult` with `shortfall?: number; disallowed?: number;`.
  - Updated `src/lib/reconciliation/matcher.ts` to calculate shortfall whenever `billedTotal > (netPaid + tds)`.
  - Updated `PaymentMatchQueue.tsx` to prominently show shortfall warnings: `⚠️ Shortfall: -₹{shortfall} (Billed ₹{billedTotal})`.
  - Updated `ClaimsLedgerTable.tsx` to display `[ ⚠️ Partial / Deducted ]` status badge and `-₹{shortfall} ded.` in the Billed column.
  - Updated `ReconciliationKPICards.tsx` to compute `totalDisallowed` and display an amber fee disallowance alert banner.
- Verified test suite: 54/54 vitest tests passed; `npx tsc --noEmit` 0 errors.
- Built (`next build`, 25/25 static pages) and deployed to Firebase Hosting site `motorsurveyos-in` on project `surveyos-v2-antigravity-in`. Verified live chunk `0cckjupkn0y0f.js` via `curl.exe` from `https://surveyos.in`.

## Decisions Made
- Zero server-side persistence: zip file unzipping and PDF parsing happen entirely client-side in the browser using Web Crypto & in-memory buffers.
- Disallowance vs Shortfall distinction:
  - `disallowed`: when gross approved fee is less than billed amount (`billed - gross`).
  - `shortfall`: total deficit between billed amount and net cash received + TDS (`billed - (net + tds)`).
- Status badge distinction: If a claim was settled for less than the billed amount, it is marked `[ ⚠️ Partial / Deducted ]` instead of `[ Fully Paid ]`, ensuring the surveyor can easily identify disputed or reduced fees.

## Files Changed
- `src/types/payment-reconciliation.ts` (modified)
- `src/types/assessment.ts` (modified)
- `src/lib/reconciliation/sample-store.ts` (modified)
- `src/lib/reconciliation/matcher.ts` (modified)
- `src/lib/reconciliation/__tests__/matcher.test.ts` (modified)
- `src/lib/ai/payment-advice-extractor.ts` (modified)
- `src/components/tabs/PaymentReconciliationTab.tsx` (modified)
- `src/components/reconciliation/PaymentMatchQueue.tsx` (modified)
- `src/components/reconciliation/ClaimsLedgerTable.tsx` (modified)
- `src/components/reconciliation/ReconciliationKPICards.tsx` (modified)
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md` (modified)
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md` (modified)
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-11-20-gemini-payment-reconciliation-zip-shortfall.md` (new)
