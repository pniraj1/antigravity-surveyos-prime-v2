# Design: Bill Check — the Cap, the Flags, and the Estimate Figures

**Date:** 2026-08-18
**Status:** Draft — awaiting review

---

## Problem

Three things, discovered together and sharing one cause: **the Bill Check screen knows more than it says.**

**The estimate figures are wrong on a live report.** `calculateAssessmentSummary` computes `estimatePartsBase` over every row but its per-material split only over allowed rows ([assessment.ts:142](../../src/lib/calculations/assessment.ts) vs [:145](../../src/lib/calculations/assessment.ts)) — so the two disagree. Separately, `standard-report-builder.ts` computes its *own* estimate totals, filtered by `allowed` ([:140-145](../../src/lib/reports/standard-report-builder.ts)), duplicating the engine and drifting from it.

Rendered proof, on a claim where the garage estimated ₹13,000 and the surveyor rejected a ₹2,000 wiper set:

| | Prints | Should be |
|---|---|---|
| §8 Spare Parts — Estimated | ₹10,000 | ₹12,000 |
| §8 GRAND TOTAL — Estimated | ₹11,000 | ₹13,000 |
| Narrative, same page | *"the estimate for **₹15,340**"* | correct |

The page contradicts itself, and worse: the Estimated column exists to show what the surveyor cut, so filtering it by what was allowed **hides the surveyor's own deduction**.

**The cap is not applied.** The billed figure is the ceiling on what may be claimed per item. Nothing implements this — `projectForBillCheck` reads `billAllowed ?? assessed` and never consults `billedTaxable`. A ₹700 bill against a ₹1,000 assessment still claims ₹1,000.

**The screen detects problems it never reports.** `applyFinalBill` already writes `'Workshop billed for a disallowed item'` and `'Ambiguous match — please verify'` into `billRemarks` ([aiDataSlice.ts:564](../../src/stores/slices/aiDataSlice.ts)), and sets `billStatus: 'partial'` when the billed figure differs from the estimate ([:554](../../src/stores/slices/aiDataSlice.ts)). None of it surfaces. `partial` changes no arithmetic anywhere.

---

## Goal

Apply the cap, surface every disagreement between the bill and the assessment as a decision the surveyor must make, and make the estimate figures state what the garage actually estimated.

---

## Scope

**Part 1 — the numbers.** Independent of the rest and built first, so it can deploy while Parts 2 and 3 are still being written.

**Part 2 — the cap.** Changes what is claimed.

**Part 3 — the flags.** Changes what the surveyor is told.

**Out of scope:**
- Billed GST rate differing from the assessed rate, billed quantity, repair-versus-replace mismatch. Real, catalogued, not here.
- Any discount handling. Confirmed with the surveyor: lump-sum discounts do not occur in this domain. A gap between the line items and the invoice total is **always** an error.
- Snapshotting the Final Survey Report at issue.

---

# Part 1 — The numbers

## 1.1 Estimates stop being filtered

An estimate is a fact about the garage's document. Nothing the surveyor decides changes it.

- **Engine:** remove the `if (r.allowed)` guard from the per-material split ([assessment.ts:145](../../src/lib/calculations/assessment.ts)), so `estimatePartsBase` equals the sum of its material parts.
- **Standard builder:** delete its four private estimate accumulators and read the engine's `estimatePartsBase`, `estimateMetalBase`, `estimatePlasticBase`, `estimateGlassBase`, `estimateFiberglassBase`, `estimateLabourOnlyBase`, `estimatePaintOnlyBase`, `estimateLabourBase`. The engine already exposes every figure the builder recomputes; the duplication *is* the bug.

This also corrects the UIIC Bill Check summary and the on-screen Assessment tab, both of which read engine values and today print `Spare Parts` above a material breakdown that does not sum to it.

**Independent evidence this is the right reading:** `FeesTab` bases the professional fee on `estimateGrossTotal`, unfiltered ([FeesTab.tsx:75](../../src/components/tabs/FeesTab.tsx)). The fee scales on the claim presented, not on what was allowed.

## 1.2 `Estimated (before GST)`

§8's first money column is a pre-GST base while the narrative paragraph quotes a GST-inclusive figure. With 1.1 applied the two reconcile — ₹13,000 × 1.18 = ₹15,340 — but only if the reader knows the basis. The header states it.

## 1.3 Per-section subtotals for Estimate and Assessed

§9's subtotal rows label with `colspan="6"` ([standard-report-builder.ts:685](../../src/lib/reports/standard-report-builder.ts)), swallowing Sr, Particulars, Type, **Est ₹**, **Assessed ₹** and Dep%. So neither money column gets a subtotal while the material columns do.

Label drops to `colspan="3"`; Est and Assessed gain subtotal cells; Dep% prints `—`. Column count is unchanged: 3 + 1 + 1 + 1 + NMAT + 1 + 1 = 8 + NMAT = NCOLS.

## 1.4 §8's Billed total ties to the invoice

When a workshop bills for an item rejected at final survey, that money is on their invoice but absent from §9's table. §8's Billed total states the invoice figure and explains the difference in **one aggregate line**, however many rejected items there are:

```
Billed by workshop (per invoice)             14,400
Less: billed for items rejected at survey    (2,400)
Billed against allowed items                 12,000   ← matches §9
```

The bill check states the total; the Final Survey Report supplies the detail, listing each rejected item as `NOT ALLOWED` with the serial gaps pointing at them. A reader comparing the two documents has everything.

---

# Part 2 — The cap

## 2.1 The rule

**What is billed is the cap per item.**

| Assessed | Billed | Claimed | |
|---|---|---|---|
| 1,000 | 700 | **700** | cap bites |
| 1,000 | 1,200 | **1,000** | cap is above the assessment, so it does not bite |
| 1,000 | *none recorded* | **1,000** | nothing to cap against |

In `billCheckAssessed`:

```ts
export function billCheckAssessed(r: AssessmentRow): number {
  if (r.billStatus === 'not-in-bill') return 0;
  if (r.billAllowed !== undefined) return r.billAllowed;   // surveyor overrode the cap
  if (r.billedTaxable === undefined) return r.assessed;    // nothing billed to cap against
  return Math.min(r.assessed, r.billedTaxable);
}
```

Every consumer already routes through this function — the report's projection, the grid's derived cells, the missing-remark check — so the cap reaches all three at once.

## 2.2 It applies on its own

The claim drops to the billed figure the moment the bill is read. The surveyor is not asked for permission; he is asked to **verify the reading**, and printing is blocked until he has.

The alternative — waiting for a press on each row — was rejected because a bill with twenty items under assessment would need twenty presses, and a row skipped would silently over-claim. Automatic application plus a print gate makes a missed row impossible rather than merely unlikely.

## 2.3 The cap never touches the Final Survey Report

The assessment states what the repair should cost; the bill states what was charged. Different claims, and the second does not revise the first. The cap lives entirely in `billCheckAssessed`, which the Final Survey Report does not call.

`billAllowed` becomes purely an **override of the cap** — the surveyor deliberately allowing something other than `min(assessed, billed)`.

---

# Part 3 — The flags

## 3.1 One rule

> **Any row where the bill and the assessment disagree needs the surveyor's decision.**

Both directions, because both cost someone money:

| | Billed **below** assessment | Billed **above** assessment |
|---|---|---|
| Example | assessed 8,500, billed 6,000 | assessed 6,200, billed 7,400 |
| Happens on its own | cap bites, claim drops to 6,000 | claim holds at 6,200 |
| Heading | *The workshop billed less than you allowed* | *Priced higher than the estimate you assessed from* |
| Default button | **Confirm ₹6,000** | **Confirm ₹6,200** |
| Other button | Allow a different amount | **Raise to ₹7,400** |
| Skipped, who loses | the insurer over-claims | **the insured, ₹1,200 out of pocket** |

`Confirm` is the default in both directions: the claim never rises without the surveyor saying so.

**Raising above the assessment** writes `billAllowed` and fires the existing `AllowanceScopeDialog`, so *Bill Check only* stays the default while *Both reports* remains available for a genuine supplementary revision.

## 3.2 The third number does the diagnosing

Estimate, assessed and billed together say *why* a row diverges, and the answer changes the advice:

- **Assessed = estimate, billed higher** — the surveyor allowed the estimate in full, so the estimate underpriced the item. The surveyor's own words: *"generally these are wrong pricings during estimates which are later corrected."*
- **Assessed < estimate, billed higher** — the surveyor cut the estimate deliberately and the workshop has billed back toward it. A different conversation, and the wording says so.

This is why the Estimate column must be visible in Bill Check rather than optional.

## 3.3 Two tiers

**Blocks printing** — the report would state something the invoice does not support:
- A row where billed ≠ assessed and `billVerified` is not set
- A row still `pending` *(already built)*

**Advises, never blocks** — the report is already correct:
- The workshop billed for an item rejected at final survey. Carries no liability, and §8 now shows it under 1.4, so nothing is hidden — but the surveyor should know the claim was attempted.
- The invoice total does not reconcile (3.5).
- A low-confidence match from reading the bill — `applyFinalBill` already writes *"Ambiguous match — please verify"* and nothing displays it.

Blocking on things that are already correct trains a surveyor to click through warnings, including the ones that matter.

## 3.4 How it is surfaced

Three layers, so nothing depends on the surveyor being careful:

1. **A banner above the grid**, stating how many rows need a decision and what the report would over- or under-claim until they are made. Carries bulk actions — **Confirm all** for the cap direction, **Keep my assessment on all** for the raise direction. Without the second, a systematically underpriced estimate means twenty presses on exactly the claims where the estimate was worst.
2. **A mark on the row**, in its own narrow column beside Sr, so one edge can be scanned for everything wanting attention.
3. **An explanation in place**, opened by clicking the mark. Not a hover tooltip: hover cannot hold buttons, vanishes on scroll, and does not exist on a tablet in a workshop. It shows estimate, assessed and billed together, states the diagnosis from 3.2, and carries the two buttons. It stays open until a decision is made.

## 3.5 Invoice-total reconciliation

The surveyor types the invoice total from the document; the system computes its own from the line items. Nothing compares them today ([billTotal is only ever printed](../../src/lib/reports/uiic-final-builder.ts)).

Warn when `|Σ(billedTaxable + its own GST) − billTotal| > ₹1`.

Because no discounts exist in this domain, **any gap is an error** — a missed line or a misread figure — so there is no legitimate source of false positives to erode the warning. The wording names the likely causes so a surveyor knows at a glance what to look for.

Screen only. It is a check for the surveyor, not a statement to the insurer; it is resolved or accepted before printing, and the report stays clean. Consistent with the missing-remark warning already built.

---

## Data model

One new field:

```ts
  /** The surveyor has looked at this row's billed figure against the bill. */
  billVerified?: boolean;
```

Set by either button on a flag. The flag condition is otherwise derived, not stored:

```ts
billedTaxable !== undefined && billedTaxable !== assessed && !billVerified
```

**`billStatus: 'partial'` is deleted.** It changes no arithmetic anywhere, and its meaning — the billed figure differs from the estimate — is subsumed by the derived flag, which compares against the assessment instead and therefore drives the cap. `applyFinalBill` sets `'in-bill'` in its place.

---

## Testing

**Part 1**
1. `estimatePartsBase` equals the sum of the four material bases when a part is disallowed
2. Standard §8 Estimated states the garage's full estimate, matching the narrative paragraph ÷ 1.18
3. §9 subtotal rows carry an Estimate and an Assessed figure, and every row still spans `NCOLS`
4. §8's Billed total equals the invoice when a rejected item was billed, and the deduction line accounts for the difference — one line for three rejected items

**Part 2**
5. `billCheckAssessed` returns `min(assessed, billedTaxable)` — 700 against 1,000 assessed
6. It returns `assessed` when billed is higher — 1,000 against a 1,200 bill
7. It returns `assessed` when no billed figure is recorded
8. `billAllowed` overrides the cap in both directions
9. **The cap never reaches the Final Survey Report** — a row with `assessed: 1000, billedTaxable: 700` prints 1,000 in final mode

**Part 3**
10. A row with billed ≠ assessed and no `billVerified` blocks printing; setting it unblocks
11. A row with billed = assessed never flags
12. Both directions produce their own heading and default button
13. Reconciliation fires above ₹1 and stays quiet below it
14. The reconciliation warning appears in no report output

---

## Risks

- **2.2 changes claimed figures without a press.** That is the point, but it means a surveyor who prints without reading the flags gets different money than before this change. The print gate is what makes it safe; if the gate is ever bypassed, the cap becomes silent.
- **Part 1 changes a live report's figures.** The estimate column will rise on any claim with a rejected item. That is the correction, but it will look like a change to a surveyor who has not read this.
- **Deleting `partial` touches AI extraction.** `applyFinalBill` and `assessmentSlice` both write it. Neither reads it for arithmetic, so removal is safe, but both write sites must go together.
- **Not verifiable here.** The Bill Check screen is auth-gated and needs real claim data. Correctness rests on the unit tests above and on the surveyor exercising the grid.
