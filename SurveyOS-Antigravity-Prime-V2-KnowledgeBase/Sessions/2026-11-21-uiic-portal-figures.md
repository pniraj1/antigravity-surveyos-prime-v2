# 2026-11-21 — UIIC portal figures (Claude Code)

Trigger: surveyor's reconciliation of the UIIC Bill Check Report for MH40BG5830 (MOTOR/929/2026); the portal rejected the parts figures.

Root causes found (systematic debugging):
1. `uiicPortalSummary` added `r.assessed` into the parts boxes, so IMT-23 rows went in at full price. Labour already used the halved basis, which is why labour tied and parts did not.
2. Metal rows with a surveyor-set rate (non-disposal `0%*`) landed in the age-based box, where the portal applies 40%.
3. `uiic-final-builder` page-1 `depAmt = effParts - partsDepreciated`; `partsDepreciated` excludes disposal rows, so their whole basis showed as depreciation. Same formula in the Final Report SUB TOTAL dep cell.
4. `numberToWords` floored float noise (639999.9999 -> 639999).

Surveyor's claim B (agreed items lumped into metal) did not apply here: those rows are disposal rows and already went to the Nil box at their net.

Fixes are test-first; 7 new tests failed before, all 3,689 pass after. Not committed or deployed. SurveyOS Scan impact: none.
