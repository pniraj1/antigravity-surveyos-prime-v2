# 2026-11-17 - UIIC spot dates, AI model pick, "done by" note (Claude Code)

## Complaints
1. Surveyor: UIIC final report's SPOT SURVEY DETAILS column shows wrong dates and has no field to fill.
2. Owner: AI used for light tasks (rephrase, translate) gives no model choice; show which model did each AI job.

## Root causes
- `claimSlice.ts` (commit `83753194`) mirrors final-survey dates into `spotDetails.*`; `uiic-final-builder.ts` read `spotDetails.*` for the spot column. BeforePrintDialog never asked for spot dates.
- Only `processor.ts` called `newSession()`; every other `callAIGateway` caller passed no session, so `preferredAI/preferredModel` never reached `orderChain`. Extraction recorded `_models` but nothing displayed it.

## Changes
- `types/assessment.ts`, `uiic-final-builder.ts`, `BeforePrintDialog.tsx`: three spot-date fields on `reinspection`, asked at print.
- `ai/service.ts`: default session in `callAIGateway`; `lastUsedModelLabel()`.
- `processor.ts`: `noteModel()` before return so `_models` is never empty.
- UI notes: `AccidentForm`, `AIReviewDialog`, `StageAITrigger`, `InsuredReportReviewDialog`, `BankReconcileDialog`, `FixEstimateDialog`.
- Tests: `uiic-spot-dates.test.ts` (new), two cases in `fallback-loop.test.ts`; the no-session test was mutation-checked (fails without the fix).

## Known limits
- `lastUsedModelLabel()` is module-level; concurrent calls can swap labels. Insured report shows the last call's model only.
- Standard (non-UIIC) report not checked for the same mirrored spot dates.
