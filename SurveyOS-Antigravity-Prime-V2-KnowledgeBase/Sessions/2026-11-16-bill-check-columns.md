# Session 2026-11-16 - Bill Check column order and allowed-only view (Claude Code)

## Done
- Allowed-only view (`83292612`): Bill Check grid shows allowed rows only by default. "Allowed only" toggle is on every time; off shows disallowed items the workshop billed.
- Counts (`ce6767af`): counts follow the rows shown.
- Footers (`521fd622`): footer totals via tested `sectionFooterTotals`. Totals unchanged.
- Column order (`ea296fb8`): one order in both cases: base amount | Assessed | uploaded amount | its item no. | Status | GST | Disposal | Dep% | Net | Price+GST | Remarks.
  - Case 1 (estimate is base, bill uploaded): "Estimate (taxable)", "Billed (taxable)", "Bill Item No.".
  - Case 2 (bill is base, estimate uploaded): "Bill (taxable)", "Estimated (taxable)", "Est. Item No.". Old locked "Billed Taxable" duplicate removed. Footer shows bill total under base and estimate total under uploaded.
- Spec: `docs/superpowers/specs/2026-11-16-bill-check-columns-design.md`. Plan: `docs/superpowers/plans/`.

## Verification
vitest 3277 passed (360 files, 1 skipped); tsc 0 errors; `npm run build` ok.

## State
Not deployed. Not pushed. Impact on SurveyOS Scan: none (no doc types, folder layout, manifest or spot/valuation labels touched).

## Owner visual checks (agents may not use a browser)
1. Case 1 and Case 2: column order and labels.
2. The "Allowed only" toggle (on by default; off shows disallowed items).
3. Keyboard moves and paste in the grid.

## Final review fix wave (0f585b87, 36d761ca)
- Delete Selected acts only on rows on screen; selection clears when Allowed only or the needs-a-ref filter changes; the confirm shows the true count.
- Column picker shows the case labels (Bill/Estimated (taxable) in Case 2).
- Attention banner adds "Turn off Allowed only to see them." to the rejected-items line.
vitest 3281 pass, tsc 0, build OK. Not deployed.
Follow-ups: the Delete Selected (N) button label can overcount after other row changes (the confirm is correct); "Remove zero amount parts" also acts on hidden rows (pre-existing).
