# Session: 2026-11-19 (Claude Code) — Cash loss basis

## What I Did
- Cash loss settlement basis: switch + notional % on the Assessment tab "Settlement basis" panel; 8A table in Standard and UIIC Final; Cash Loss column in the TL comparison; UIIC Amount Payable = cash net; Bill Check held; fee bill and portals unchanged.
- Last task: insured report line (`cashLossLine` in `InsuredSummaryDocument.tsx`) and doc type `cashLossConsent` ("Cash Loss Consent of Insured"), shown in the document-kit checklist as a required box only when cash loss is on (`internal` box: never built into Portal Upload, never blocks Build).
- Scan: `DocType.CASH_LOSS_CONSENT` mirrored; handover note added.
- Prime commits: 76d8d97b, 026c4183, 3c196107, 55336853 + insured report/consent commit.

## What's Unfinished
- [ ] Deploy (not deployed).
- [ ] Browser test of the panel, reports, insured line and checklist box.

## Decisions Made
- Consent is a checklist-only box, not a portal upload box (portals unchanged).
- SurveyOS Scan impact: new doc type mirrored.

## Files Changed
- src/components/pdf/InsuredSummaryDocument.tsx, src/types/documents.ts, src/lib/documents/kit/{checklist,panel,orchestrate}.ts, recipes/types.ts
- Tests: src/lib/reports/__tests__/insured-cash-loss.test.ts, src/lib/documents/__tests__/{checklist,kit-types}.test.ts
- Scan: PrimeContract.kt, PrimeContractTest.kt, docs/handover/prime-cash-loss-doc-type.md
- Tasks.md, Changelog.md (modified); this log (new)
