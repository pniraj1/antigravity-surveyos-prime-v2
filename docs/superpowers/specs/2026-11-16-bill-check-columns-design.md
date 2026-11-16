# Bill Check grid: column order by case + "Allowed only" view — design (short)

**Date:** 2026-11-16 · **Owner-approved in conversation** · Small change.

## Why
The surveyor checks two things on every Bill Check row (owner's words):
1. Assessed must not be more than billed.
2. The item must really be in the other document — in the bill when the estimate is the base; in the estimate when the bill is the base.
The formula already enforces (1) and records (2): `billCheckAssessed` (`src/lib/reports/bill-check-projection.ts:29`) = 0 if Not in bill, else min(assessed, billed); presence is the ref (Bill / Est. Item No.) or the status. Today the columns that carry these checks are scattered (Assessed and Billed four columns apart; the uploaded document's amount and its item no. at opposite ends; in Case 2 a locked "Billed Taxable" repeats the base). Disallowed rows also clutter Case 2, where every disallowed row counts as "billed" and is therefore shown.

## Cases
- **Case 1** — assessment built from the **estimate**; **bill** uploaded in Bill Check.
- **Case 2** — assessment built from the **bill** (`isFromBill(claim)`); **estimate** uploaded in Bill Check.

## Goals
- One column skeleton for both cases; only labels change:
  `Sr | Particulars | [Part No | HSN | Section | Qty] | BASE amount | Assessed | UPLOADED amount | UPLOADED item no. | Status | GST | Disposal | Dep% | Net | Price+GST | Remarks`
  - BASE amount = `row.estimated` in both cases. Label: "Estimate (taxable)" (Case 1) / "Bill (taxable)" (Case 2).
  - UPLOADED amount = `row.billedTaxable` (Case 1, editable as today) / `row.estimateAmount` (Case 2, read-only as today). Label: "Billed (taxable)" / "Estimated (taxable)".
  - UPLOADED item no. = existing ref column (`Bill Item No.` / `Est. Item No.`, still renamable).
  - Case 2: the locked duplicate "Billed Taxable" column disappears (its figure is the base).
- **"Allowed only" view, on by default** (owner: "it is not the surveyor's primary job to look if disallowed items were billed"): the grid shows allowed rows only. Switching it off shows today's set (allowed + disallowed rows the workshop billed). Starts on every time Bill Check opens; not remembered.

## Non-goals
- No change to any formula, status rule, Stage 1–4 cockpit, print/report layout, or the column chooser's keys.
- Rows missing from the other document: no new behaviour (owner chose to keep today's: the row stays; the surveyor decides with the Allowed toggle on the Assessment tab; Case 2's Bill Check status is locked by design).

## Anti-goals
- Hiding a disallowed-but-billed row must not change any total or the print (it is still in Stage 4's Summary and the report).

## Approaches considered
1. **Reorder + case labels (picked).** Pure layout: move cells in header, rows and totals; labels from `uploadLabels`. No logic change.
2. Two separate grids per case — rejected: double the code for one difference in labels.
3. Add a "difference" column — rejected: not asked; the cap already shows in Assessed vs uploaded amount side by side.

## Decided by Claude (owner may overrule)
- GST and Disposal move right of Status, beside Dep% / Net (they belong to the depreciation maths, not to the comparison).
- Toggle wording: "Allowed only"; placed in the grid toolbar next to the existing "needs a ref" filter.

## Left to the builder
- Exact toolbar styling (match the existing filter button).
- Column widths unchanged (`COL_WIDTHS`).
