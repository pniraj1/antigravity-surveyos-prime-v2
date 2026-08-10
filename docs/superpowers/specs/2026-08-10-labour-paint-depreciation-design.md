# Labour & Paint Depreciation and Report Estimates — Design

**Date:** 2026-08-10
**Status:** Approved for planning
**Scope:** Assessment grid depreciation entry + UIIC and standard report builders

## Problem

Two defects, both around how the Labour and Paint sections are treated relative to Parts.

### 1. Depreciation cannot be entered on Labour or Paint rows

`AssessmentRow` already carries `depOverride` — "Surveyor's manual depreciation override for this row (0–100). When set, supersedes the IRDAI auto-calculated rate" (`src/types/assessment.ts:81`). The calculation engine honours it for every row regardless of section (`src/lib/calculations/assessment.ts:69`, with the depreciated value flowing into `labourOnlyBase` / `paintOnlyBase` at lines 97–102).

But the surveyor can never create one on a Labour or Paint row. Three gates block it:

| location | behaviour |
|---|---|
| `src/components/claim/AssessmentSectionTable.tsx:443` | `{row.allowed && row.section === 'parts' ? <input/> : '-'}` — the Dep% cell renders a literal dash outside Parts |
| `src/lib/utils/grid-paste.ts:64` | `if (columnKey === 'depOverride' && (!row.allowed \|\| row.section !== 'parts')) continue;` — pasted values are silently dropped |
| `src/lib/calculations/section-move.ts:31` | clears `depOverride` on every section change |

The auto rate is also fixed at zero (`src/lib/calculations/depreciation.ts:67`).

This was deliberate — `section-move.ts` documents the reason as "Labour and paint are Nil depreciation under the tariff." That default is correct, but it is being enforced as a prohibition rather than a default, and the surveyor signing the assessment has no way to depart from it.

### 2. The UIIC Bill Check report never prints Labour or Paint estimates

`src/lib/reports/uiic-final-builder.ts` exports two documents, and the defect is in the second:

| function | lines | has an Estimate column? |
|---|---|---|
| `buildUIICFinalHTML` | 62–388 | No. Its column 5 is "Part List W/o Tax" and shows `assessed` for every section, so there is nothing to fix here. |
| `buildUIICBillCheckHTML` | 422–940 | Yes — and Labour and Paint are blank in it. |

In `buildUIICBillCheckHTML`, the estimate figure is omitted at all three levels of the allowed-items table:

- **Per row** — labour rows emit `${blank}` in the Estimate column (`:575`); paint rows likewise (`:589`).
- **Subtotals** — the labour subtotal spans `colspan="9"` (`:746`) and paint `colspan="10"` (`:760`), swallowing the Estimate column.
- **Grand total** — the TOTAL row's Estimate cell sums `allowedParts` only (`:771`).

So a surveyor's Labour and Paint estimate figures are stored on the claim and never printed, and the report's total estimate understates the workshop's estimate by the entire Labour + Paint amount.

The standard report does print them (`src/lib/reports/standard-report-builder.ts:244`), so the two documents already disagree.

### 3. Report money maths for Labour/Paint ignores depreciation entirely

This is latent today (the rate is always zero) but becomes a correctness bug the moment defect 1 is fixed.

`aggregateGst` (`src/lib/calculations/gst-bands.ts:37`) is fully depreciation-aware — it calls `computeRowNet(r, depRateFor(r))` — and the UIIC builder passes it a `rowDepFor` that reads `depOverride`. So GST and the final money columns would follow an override correctly.

The raw accumulators around it would not:

| location | reads |
|---|---|
| location | document | reads |
|---|---|---|
| `uiic-final-builder.ts:109`, `:110` | Final | `labOnly += r.assessed` / `paintOnly += r.assessed` |
| `uiic-final-builder.ts:327`, `:335` | Final | per-row `fa(r.assessed * (1 + gst/100))`, **and Dep% hardcoded to the literal `N.D.`** so an override would not even be displayed |
| `uiic-final-builder.ts:476`, `:480` | Bill Check | the same raw accumulation, duplicated |
| `uiic-final-builder.ts:580`, `:594` | Bill Check | per-row `fa(r.assessed)` |
| `uiic-final-builder.ts:747`, `:761` | Bill Check | subtotal `allowedLabour.reduce((s, r) => s + r.assessed, 0)` |
| `standard-report-builder.ts:239` | standard | `priceGst = r.assessed * (1 + gstPct / 100)`, and Dep% hardcoded to `—` at `:246` |

Note the Bill Check rows already call `depLabel(r)` (`:576`, `:590`), which is override-aware — so that document would *print* a depreciation percentage next to an amount that ignores it.

`labBase` (`= labOnly + paintOnly`) feeds the taxable-base cells at `:372` and `:373`, while the CGST/SGST/total cells beside them (`lC`, `lS`, `lT`) come from the dep-aware `serviceAgg`. With an override set, those cells would contradict each other **inside the same row of the same table**.

## Goals

- A surveyor can enter a depreciation percentage on any Labour or Paint row, exactly as on a Parts row.
- Every report prints the same figure the assessment screen shows.
- The UIIC report prints Labour and Paint estimates per row, per subtotal, and in the grand total.

## Non-goals

- **No automatic depreciation rate for paint.** The tariff treatment of paint material (commonly 50% on the material portion) is deliberately not implemented. The automatic rate stays 0 for both Labour and Paint; the surveyor decides per claim. Revisit only if the manual entry proves repetitive in practice.
- **No change to `calculateAssessmentSummary`.** It is already section-agnostic and correct.
- **No change to Bill Check.** `computeRowLiability` already takes a `depRate` argument and its callers already pass a `depOverride`-aware function.

## Design

### Part 1 — Unlock the override

Remove the two gates that block entry, and leave the default rate alone.

- `AssessmentSectionTable.tsx:443` — drop `&& row.section === 'parts'` from the render condition. The input then shows the auto rate (0 for Labour and Paint) until the surveyor types over it, which is the same behaviour a 0% metal part already has. The existing amber "overridden" styling and the `title` tooltip need no change.
- `grid-paste.ts:64` — drop the `row.section !== 'parts'` clause, keeping the `!row.allowed` guard.
- `depreciation.ts:67` — no behavioural change. The comment changes from "Labour/Paint: always 0%" to record that this is a default the surveyor may override, so the next reader does not restore the prohibition.

### Part 2 — Section moves still clear the override

`section-move.ts` keeps clearing `depOverride` on every section change. The original justification (Labour and Paint are Nil depreciation) is retired, but a second one stands on its own: moving a plastic part carrying a 50% override into Labour would silently apply 50% to a labour line with nothing on screen reporting it. The surveyor re-enters the percentage after the move — one keystroke, against a silent change to a figure on a signed document.

The comment is rewritten to state the surviving reason, since the one it currently gives will no longer be true.

### Part 3 — Make the reports depreciation-aware

The rule: **a cell showing a post-depreciation figure must route through `computeRowNet(r, depRateFor(r))`**, which is what the Parts rows already do.

This is narrower than "never read `r.assessed`". The UIIC table has a legitimate **Assessed** column that shows the pre-depreciation figure — `rawParts` at `:472` and the parts subtotal at `:737` are correct as they stand and must not change. What is wrong is Labour and Paint using the raw figure in the *amount* column, where the Parts rows show a depreciated net. The two columns exist side by side at `:358`: `fa(rawParts)` (assessed) next to `fa(partsDepreciated)` (after depreciation).

In `buildUIICFinalHTML`:

- `:327`, `:335` — Labour and Paint rows compute their amount from `computeRowNet`, and print the row's real depreciation label instead of the hardcoded `N.D.`. Reuse the existing `dL` expression from the parts branch at `:314`.
- `:109`, `:110` — the `labOnly` / `paintOnly` accumulators use the depreciated net.
- `labBase` (`:112`) — replaced by the dep-aware aggregate base, so the taxable-base cells at `:358`, `:372` and `:373` agree with the CGST/SGST cells beside them.

In `buildUIICBillCheckHTML`:

- `:580`, `:594` — per-row Labour and Paint amounts use the depreciated net.
- `:476`, `:480` — the same accumulators, second copy.
- `labBase` (`:484`) — same replacement.
- `:747`, `:761` — subtotals use the depreciated net.

In `standard-report-builder.ts`:

- `:239` — `priceGst` computed from `computeRowNet`, matching the parts branch at `:206`.
- `:246` — the Dep% cell prints the row's actual rate (with the existing `%*` marker for an override) instead of a hardcoded `—`.

### Part 4 — Print the missing estimates

In `buildUIICBillCheckHTML` only — `buildUIICFinalHTML` has no Estimate column:

- `:575`, `:589` — replace the `${blank}` in the Estimate column with `fa(r.estimated)`.
- `:746`, `:760` — narrow each subtotal's `colspan` by one and emit an Estimate subtotal cell for that section.
- `:771` — the grand TOTAL's Estimate cell sums allowed Parts **plus** Labour **plus** Paint.

## Testing

Extend the existing parity tests (`src/lib/reports/__tests__/depreciation-parity.test.ts`, `standard-summary-consistency.test.ts`) rather than adding a parallel suite.

- **Parity under a Labour override.** A claim with a Labour row at a 30% override produces the same labour figure from `calculateAssessmentSummary`, the standard report, and the UIIC report. The same test for a Paint row.
- **Internal consistency.** With an override set, the UIIC taxable-base cell equals `serviceAgg.base`, so the base and its CGST/SGST no longer contradict.
- **Estimate totals.** The UIIC Bill Check grand-total Estimate equals the sum of allowed Parts + Labour + Paint estimates, and a claim with Labour and Paint rows prints a non-empty Estimate cell for each.
- **Section move clears the override.** A Parts row with a 50% override moved to Labour comes back with `depOverride: undefined` — locking in the decision above so it is not quietly reversed.
- **Paste guard.** A Dep% pasted onto a Labour row is applied; one pasted onto a disallowed row is still skipped.
- **Regression floor.** With no override anywhere, every existing report figure is unchanged — the whole change must be a no-op on current claims.

## Rollout

The change is behaviour-preserving for every existing claim: the automatic rate for Labour and Paint remains 0, so no stored claim's figures move. New behaviour appears only when a surveyor types a percentage. No migration, no data change.

## Open questions

None. Resolved during design:

- Manual override only; no automatic paint depreciation rate (option B).
- Section moves continue to clear the override.
