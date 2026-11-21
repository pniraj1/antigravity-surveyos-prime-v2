# 2026-11-21 — Parser: split short amounts (Claude Code)

Owner report: `Estimate for parser.pdf` (digital, Tata-style, 9 pages, 137 rows) was not read by the parser.

## Root cause
The "Taxable Amt" column is narrow, so pdf.js puts the last digits on a second line (`265.2` + `5`, `13,76` + `4.41`, `1,211.` + `02`). `repairNumbers` joined `8,845.`/`76` and 4+-digit `2,916.9`/`5` only. The short forms stayed split, 99 taxable amounts did not parse, rows had no rate, and the parser declined ("rows print no tax rate...").

## Fix
`src/lib/ai/row-parser.ts` `repairNumbers`: two added shapes, each joined only with a digit/fragment directly below at the same x (1.5 pt) and under 10 pt gap: `^\d{1,3}\.\d$` and `^\d{1,3}(,\d{2})*,\d{2}$` (a two-digit last comma group is never a whole number). The stacked reading then settles the 18% rate from taxable + printed total.

## Checks
- Result: parts 99, labour 27, painting 11; sum ties to Gross 276,332.18.
- vitest `src/lib/ai`: 650 passing (one new test: both joins, plus lone `496.0` and qty `1.5` kept whole).
- Corpus (29 PDFs from Downloads, snapshots before/after): only this file changed (declined to ok).
- Deployed hosting only to `surveyos-v2-antigravity-in`; live chunk grep on motorsurveyos-in.web.app and surveyos.in found the new rule.

## Left
Owner re-upload on live site. Corpus is only the owner's own PDFs: other makers untested. Scratch dump script was deleted.
