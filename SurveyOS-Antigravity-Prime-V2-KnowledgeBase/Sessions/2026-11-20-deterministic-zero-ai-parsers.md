# Session: 2026-11-20 (Antigravity) — Deterministic Zero-AI Remittance Parsers (Axis CMS, UIIC, NIA)

## What I Did
- Implemented `/ponytail` (lazy senior dev) zero-AI deterministic parsers in `src/lib/reconciliation/deterministic-parsers.ts`:
  1. `parseAxisBankCmsPdfText`: Detects `Payment Advice` + Axis Bank signals (`Straight2axis`, `UTR Number`, `Beneficiary Name`, `LossDt`), parses insurer name, UTR, DD-MM-YYYY payment date, net amount, and `Enrichment:` block for vehicle registration number and claim number.
  2. `parseUiicEmailText`: Detects `For the claim` + `disbursed at Rs. X/-( gross=Y, TDS=Z )`, extracts exact claim number, policy number, vehicle registration, survey report number (remarks), net paid, gross fee, and TDS amount.
  3. `parseNiaEmailText`: Detects NIA signatures (`The New India Assurance`, `NIAHO`, or tabular header) + `remit an amount of Rs.`, extracts claim row with 20-digit claim number, policy number, vehicle registration, gross fee, negative TDS deduction row (`-157.00`), and net paid.
  4. `parseDeterministicAdvice`: Router combining Axis Bank CMS -> UIIC -> NIA fallback chain.
- Updated `src/lib/ai/payment-advice-extractor.ts`:
  - Hooked `parseDeterministicAdvice` at the very top of `extractPaymentAdviceFromText` (<5ms execution, 0 AI tokens, 0 API latency).
  - Added heuristic check in `extractPaymentAdviceFromText` to immediately reject non-financial texts without calling AI.
  - Switched text AI fallback tier from `'heavy'` to `'text'`.
  - In `extractPaymentAdviceFromFile`:
    - For ZIP archives: reads text layer of enclosed PDFs via `pageTexts`, routing directly to deterministic parsing without image generation.
    - For standalone PDFs: reads text layer via `pageTexts` and tests `parseDeterministicAdvice` first.
    - Downgraded scanned PDF vision fallback tier from `'heavy'` to `'light'`.
- Added comprehensive unit tests in `src/lib/reconciliation/__tests__/deterministic-parsers.test.ts` (12 tests) and updated `src/lib/ai/__tests__/payment-advice-extractor.test.ts` (12 tests).
- Verified test suite: 24/24 targeted vitest tests passed; 92/92 reconciliation tests passed; `tsc --noEmit` 0 errors.

## Decisions Made
- Lazy Senior Dev (/ponytail mode): Why invoke expensive multimodal LLMs with high latency for fixed, recurring bank/insurer remittance templates when pure regex executes in <1ms with 100% precision?
- Negative TDS detection: Restrict negative value parsing in NIA notices to currency amounts with decimal points (`-\s*([\d,]+\.\d{2})`) so hyphenated dates like `15-11-2026` are never mistakenly parsed as negative TDS.
- Column positioning in NIA tables: Extracted claim number from the column immediately preceding the gross amount column, disambiguating 20-digit policy numbers from 20-digit claim numbers.

## Files Changed
- `src/lib/reconciliation/deterministic-parsers.ts` (new)
- `src/lib/reconciliation/__tests__/deterministic-parsers.test.ts` (new)
- `src/lib/ai/payment-advice-extractor.ts` (modified)
- `src/lib/ai/__tests__/payment-advice-extractor.test.ts` (modified)
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md` (modified)
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md` (modified)
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-11-20-deterministic-zero-ai-parsers.md` (new)
