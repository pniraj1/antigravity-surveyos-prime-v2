# Design: UIIC Depreciation Amount Column

**Date:** 2026-08-18
**Status:** Approved

---

## Problem

The UIIC Final Report and UIIC Bill Check Report both print a `Dep%` column per item — the depreciation rate applied to that row — but never the rupee amount that rate removes. A claims officer reading either report can see *10%* was applied but has to compute *how much* that was themselves. The top summary block of the Final Report already shows one **aggregate** depreciation figure (`depAmt = rawParts - partsDepreciated`, [uiic-final-builder.ts:382](../../src/lib/reports/uiic-final-builder.ts)); nothing shows it per line item.

Deferred from the Standard Bill Check work and logged in `Tasks.md` on 2026-08-18; the surveyor asked for it explicitly for UIIC only.

---

## Goal

Add a **Depreciation Amount (₹)** column immediately after `Dep%`, in both the UIIC Final Report's item table (`buildUIICFinalHTML`) and the UIIC Bill Check Report's item table (`buildUIICBillCheckHTML`) — parts, labour, and paint sections in each. Standard reports are untouched.

---

## Scope

**In scope:**
- One new column, position: right after `Dep%`, in both UIIC item tables
- Per-row value: `row.assessed − afterDep`, where `afterDep` is `computeRowNet`'s existing result — no new arithmetic
- Section subtotal cells for the new column, matching every other numeric column in these tables
- Replacing `N.D.` with `0%` in the existing `Dep%` cell, in both tables, all three sections — a zero rate and "no data" have been printing identically; they are not the same thing, and the new column needs a real number beside every `Dep%` cell, not a blank one
- Every `colspan` in both tables that currently spans across or past the insertion point (enumerated below)

**Out of scope:**
- Standard Final Survey Report and Standard Bill Check Report — not requested, and neither currently has this ambiguity (Standard's §9 already always shows a `%` value, never `N.D.`)
- Any change to depreciation rate rules (`getDepreciationRate`) — labour and paint are 0% by design unless a surveyor sets `depOverride`; that rule is correct and unchanged
- Any change to the aggregate `Depreciation` figure already in the Final Report's top summary — it will continue to equal the sum of the new column's parts-section values, which doubles as a built-in consistency check (see Testing)

---

## Design

### Value and formula

```ts
const depAmt = row.assessed - afterDep;
```

`afterDep` already comes out of `computeRowNet(row, depRate)` — both builders call this today for the existing `Parts Assess` / `With GST` figures. Disposal rows need no special case: the disposal factor is a further reduction applied *after* depreciation (`netBeforeGst = afterDep × disposalFactor`), so `assessed − afterDep` is depreciation alone in every case, disposal included.

This also makes the column self-checking: in the UIIC house format, the existing `Part List W/o Tax` column already holds the *pre-depreciation* assessed value (not the garage estimate — confirmed by reading the row builder, not assumed), and the existing next column holds the *post-depreciation* value. The new column sits between them, so `PreDep − DepAmt = PostDep` is verifiable at a glance by the reader.

### Labour and paint rows

No branching needed. `getDepreciationRate` already returns `0` for `partType === 'labour' | 'paint'` unless `depOverride` is set, so the same formula naturally yields `₹0.00` for an un-overridden labour or paint row and the real rupee figure when a surveyor has overridden it. This is the direct consequence of the surveyor's own point: paint *can* carry depreciation, via override, and the formula already handles that — it needed no special-casing, only recognizing that `0` is a valid answer, not an absence of one.

### Disallowed rows (Final Report only)

The Final Report's item table shows disallowed rows, marked `NOT ALLOWED`, with every other money cell blank. The new column follows that same pattern — blank, not `₹0.00` — since a disallowed row was never assessed at all; `0` would misstate that as "assessed, then fully depreciated," which it wasn't. The Bill Check Report's item table already excludes disallowed rows entirely (fixed earlier today), so this case does not arise there.

### `N.D.` → `0%`

Three call sites currently print `N.D.` when a row's resolved depreciation rate is `0` and no override is set: the Final Report's parts rows, its shared labour/paint label helper (`serviceDepLabel`), and the Bill Check Report's shared label helper (`depLabel`). All three become `'0%'`. This affects more than labour/paint — glass parts, which are always `0%` by rate-table rule, and any metal part under 6 months old, will also now read `0%` instead of `N.D.`. That is a more accurate label in every case: the rate genuinely is zero, which is different information from "no rate on record."

### Column position and widths

Inserted immediately after `Dep%` in both tables. The Final Report's item table has no explicit column widths (`<th>` cells with no `width:`) — the browser sizes it automatically, so no rebalancing is needed there. The Bill Check Report's item table does set explicit percentage widths on every `<th>`; those are rebalanced to make room for the new column (~6–7%), trimming a few of the wider existing columns (`Description`, `Part List Without Tax`, `Parts Assessment`, `Final amount With G.S.T.`). Exact percentages are an implementation detail, not a design decision — the constraint is that they sum to 100 and no column becomes too narrow to hold a six-figure rupee amount on one line, the same rule the Standard report's §9 geometry comment already documents.

### Header label

`Dep<br/>Amt` in the Final Report (matching its stacked-header style, e.g. `Part<br/>Type`), `Dep.<br/>Amount` or similar in the Bill Check Report (matching its style, e.g. `Part<br/>Depreciation`). Exact wording is an implementation call within that constraint.

---

## Exact structural changes

Both tables need every `colspan` that currently spans across or past the insertion point widened by one, and one cell inserted per data row. Verified by reading the current source directly, not inferred.

### UIIC Final Report — `buildUIICFinalHTML`, item table (10 cols → 11)

Columns before: `SR | Part Name | Part Type | Job Type | Part List W/o Tax | Dep% | Parts Assess | GST% | With GST | Labour`
New column lands at position 7 (immediately after `Dep%`); everything from the old position 7 onward shifts by one.

| Location | Before | After |
|---|---|---|
| Supplementary-band rows (parts, labour, paint — 3 occurrences) | `colspan="10"` | `colspan="11"` |
| `SPARE PARTS` / `LABOUR` / `PAINTING CHARGES` section headers (3 occurrences) | `colspan="10"` | `colspan="11"` |
| Parts row (`pHtml`) | 10 `<td>`s | insert `<td>{depAmt or blank}</td>` between the `dL` (Dep%) cell and the `afterDep` (Parts Assess) cell → 11 |
| Labour row (`lHtml`) | 10 `<td>`s | insert `<td>{depAmt or blank}</td>` between `serviceDepLabel` and the existing blank Parts-Assess cell → 11 |
| Paint row (`ptHtml`) | 10 `<td>`s | insert `<td>{depAmt or blank}</td>` in the same relative position → 11 |
| SUB TOTAL row | `colspan="4">SUB TOTAL<` then `rawParts, blank, partsDepreciated, blank, pT, labBase` | insert `fa(rawParts − partsDepreciated)` between the Dep%-blank and `partsDepreciated` — this is a free subtotal, since both operands already exist as variables |
| `TAX IN 18% for Labour` row | `colspan="6">…<` then `colspan="2">` blank, `labOnly`, `paintOnly` | `colspan="6"` → `colspan="7"`; the following `colspan="2"` is unchanged (same span count, shifted position) |
| `GROSS TOTAL` row | `colspan="8">…<` then `labourAgg.amount`, `paintAgg.amount` | `colspan="8"` → `colspan="9"` |

### UIIC Bill Check Report — `buildUIICBillCheckHTML`, item table (11 cols → 12)

Columns before: `SR.NO | Description | Part Type | Job Type | Part List Without Tax | Part Depreciation | Parts Assessment | GST% | Final amount With G.S.T | Labour | Paint`
New column lands at position 7; everything from the old position 7 onward shifts by one.

| Location | Before | After |
|---|---|---|
| Supplementary-band row (`band()` helper) | `colspan="11"` | `colspan="12"` |
| `SPARE PARTS` / `LABOUR` / `PAINTING CHARGES` section headers + their empty-state fallbacks (6 occurrences) | `colspan="11"` | `colspan="12"` |
| Parts row (`pHtml`) | 11 `<td>`s | insert one `<td>{depAmt}</td>` between `depLabel(r)` and `fa(r.assessed)` → 12. No blank case: `allowedParts` already excludes disallowed rows |
| Labour row (`lHtml`) | 11 `<td>`s | insert one `<td>{depAmt}</td>` between `depLabel(r)` and the existing blank Parts-Assessment cell → 12 |
| Paint row (`ptHtml`) | 11 `<td>`s | same insertion point → 12 |
| SPARE PARTS `SUB TOTAL` row | `colspan="4">…<`, `estimated-sum`, blank(Dep%), `assessed-sum`, blank(GST%), `partsAgg.amount`, blank, blank | insert `fa(allowedParts.reduce((s,r)=>s+(r.assessed-computeRowNet(r,rowDepFor(r)).afterDep),0))` between the Dep%-blank and `assessed-sum` |
| LABOUR `SUB TOTAL` row (first) | `colspan="4">…<`, `estimated-sum`, `colspan="4">` blank, `labourAgg.base`, blank | `colspan="4"` (the blank span) → `colspan="5"` |
| `TAX IN {rate}% for Labour` row | `colspan="9">…<` then trailing cells | `colspan="9"` → `colspan="10"` |
| LABOUR `SUB TOTAL` row (second, gross) | `colspan="9">…<`, `labourAgg.amount`, blank | `colspan="9"` → `colspan="10"` |
| PAINTING `SUB TOTAL` row (first) | `colspan="4">…<`, `estimated-sum`, `colspan="5">` blank, `paintAgg.base` | `colspan="5"` (the blank span) → `colspan="6"` |
| `TAX IN {rate}% for Paint` row | `colspan="9">…<` then trailing cells | `colspan="9"` → `colspan="10"` |
| PAINTING `SUB TOTAL` row (second, gross) | `colspan="10">…<`, `paintAgg.amount` | `colspan="10"` → `colspan="11"` |
| `TOTAL` row | `colspan="4">…<`, `est-grand-sum`, blank(Dep%), `assessed-sum`, blank(GST%), `partsAgg.amount`, `labourAgg.amount`, `paintAgg.amount` | insert the grand depreciation-amount total (sum across parts, labour, and paint) between the Dep%-blank and `assessed-sum` |

---

## Testing

Both builders already have test coverage (`bill-check-report.test.ts`, and the UIIC-adjacent tests introduced earlier today). New cases to add:

1. A metal part depreciates by a known rate → the new cell equals `assessed − afterDep`, computed independently in the test
2. A glass part (always 0% by rate table) → `Dep%` cell reads `0%`, not `N.D.`; new cell reads `₹0.00`
3. A labour row with no override → `Dep%` reads `0%`; new cell reads `₹0.00`
4. A labour row with `depOverride` set → new cell shows the real rupee amount, not blank
5. A disposal row → the new cell equals depreciation alone, unaffected by the disposal factor
6. A disallowed row, Final Report only → new cell is blank, like its neighbours
7. **Column-count regression guard:** every `<tr>` in the rendered item table (outside section-header and band rows) has the same number of `<td>` elements as the table's `<thead>` — this is the automated version of the "one mismatch shifts every figure a column to the right" check done by hand in this session's earlier work
8. Sum of the new column's per-row values across the parts section equals the existing aggregate `Depreciation` figure in the Final Report's top summary block — the free consistency check this design produces

---

## Risks

- **Colspan arithmetic.** Enumerated exhaustively above from the current source, not from memory — the risk is a future edit to either table drifting these apart again. Test 7 is the standing guard.
- **Bill Check width rebalancing** is a genuine trade: narrowing existing columns to fit a 12th could make a six-figure rupee amount wrap in one of them. Verify by rendering a fixture claim with large numbers (₹9,99,999.00-class figures in every money column) to a static HTML file and inspecting it directly — this needs no live claim or authentication, only the pure builder function and a fixture object.
