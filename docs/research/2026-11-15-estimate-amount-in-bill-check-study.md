# Study: keeping the estimate's amount in Bill Check (claims built from the bill)

Date: 2026-11-15. Read-only study of the code on `main` at ad5db880. Owner's idea: when the Bill Check upload is known to be the estimate, keep that estimate's amount under its own name instead of throwing it away.

## Today's amount fields on a row
| Field | Normal claim | UIIC claim built from the bill |
|---|---|---|
| `estimated` | the estimate's price | **the bill's price** (the bill was uploaded in the Estimate tab) |
| `assessed` | surveyor's figure | surveyor's figure |
| `billedTaxable` / `billedAmount` | the bill's price (Bill Check upload) | overwritten with the **estimate's** price by today's Bill Check upload (wrong) |

So in a from-bill claim, the real estimate's price has no field of its own. Today it is wrongly put in the billed fields.

## Who reads these fields (verified in code)
- **The claim amount.** `billCheckAssessed` (`bill-check-projection.ts:29`) = min(assessed, billedTaxable). The Bill Check liability is capped at the billed figure. **Consequence today:** on a from-bill claim, an estimate upload that wrote a lower estimate price into `billedTaxable` **lowered the claim** on every such row.
- **Flags.** `billCheckFlags` (`bill-check-flags.ts:96`): `billed !== assessed` raises a **blocking** "billed above" or "billed below" flag. **Consequence for Plan 2 as written:** self-billing sets billed = the bill price. Every row the surveyor reduced would then raise a blocking "Priced higher than the estimate you assessed from" flag. The text would be wrong (bill and "estimate" are the same document there), and printing would be held until "Keep all above".
- **Standard Bill Check report.** It prints "Billed" = `billedTaxable ?? estimated` (`standard-report-builder.ts:435`).
- **UIIC Bill Check report.** The "ASSESSMENT SUMMARY → Estimated" column = Σ `estimated` (`uiic-final-builder.ts:1042`). In a from-bill claim, that "Estimated" column prints the bill total.
- **OIC Excel.** "Estimated Amount" = `billedTaxable ?? estimated` (owner rule 2026-11-10, `oic-assessment-excel.ts:148`).
- **Insured report.** It reads negotiated savings from `billedTaxable ?? estimated` vs assessed (`insured-report.ts:46`).
- **Estimate floor.** `estimateShortRows` checks assessed ≤ `estimated`; `overBilledRows` checks allowed ≤ `billedTaxable` (`estimate-floor.ts`).
- **Also reading `estimated`:** part-price history, the estimate tally banner, the final-survey preamble total, the NIA Excel and section subtotals.

## The idea: a separate field for the real estimate's price
Proposed field: `estimateAmount?: number`, the taxable amount of the estimate line matched to the row (summed when one row has several lines).
- **Written only** by an estimate upload in Bill Check (from-bill mode) on an exact match, or when the surveyor links an estimate line.
- **Read by no money calculation.** It drives no cap, subtotal, liability or export. That is the safety property: it can show and warn, never change a figure.

What it adds:
1. **Bill Check grid, from-bill mode.** The "Estimate" column shows `estimateAmount` (the real estimate), and the "Billed" column shows the row's own bill price. The surveyor sees estimate, bill and assessed side by side, which is the comparison Bill Check is for.
2. **A non-blocking check: "Billed above the estimate".** It applies when the bill price > `estimateAmount` ("The workshop billed ₹X; its estimate said ₹Y"). It is information, not a hold, in line with the owner rule that a bill above the estimate is normal. It replaces the misleading blocking "billed above/below" flags in from-bill mode.
3. **Reports (owner to decide).** It could print as the UIIC Bill Check summary's "Estimated" column instead of the bill total.

What it does not change:
- the Assessment tab;
- the Final Survey Report;
- OIC and NIA exports;
- liability.

## Findings that change Plan 2
1. **Reset all is required, not optional.** The wrong billed figures also lowered the claim (cap above). Resetting to the bill price restores the right liability.
2. **In from-bill mode, skip the "billed above/below" flags.** Billed is the row's own figure there, so the difference is the surveyor's own cut, already decided. Without this, Plan 2 would block printing on every reduced row.
3. **Add `estimateAmount`** (written by estimate matches and links; display and info flag only) and the grid column change. Report printing waits on the owner.
4. **The earlier Plan 2 run stopped inside Task 1.** `src/lib/reports/bill-check-mode.ts` and its test exist, uncommitted; the ledger has no "Task 1: complete". The code matches the plan. It resumes from there after the plan is amended.

## Open for the owner
- Should the UIIC Bill Check report's "Estimated" column print the real estimate's total once it is known, or keep printing the bill total?
- Should the "Billed above the estimate" note print anywhere, or show only on screen?
