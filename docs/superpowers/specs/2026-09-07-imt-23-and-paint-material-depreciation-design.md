# IMT-23 Endorsement and Paint Material Depreciation — Design

**Date:** 2026-09-07
**Status:** Approved for planning
**Scope:** Assessment grid, calculation engine, standard report builder (final + bill check), insured report

## Problem

Two gaps, both surfaced by auditing four settled survey reports from SWAR (two claims, final + bill check each).

### 1. IMT-23 is not modelled at all

Under the India Motor Tariff, a commercial vehicle package policy **excludes** loss of or damage to lamps, tyres/tubes, mudguards, bonnet/side parts, bumpers, headlights and paintwork (IMT-21). Endorsement **IMT-23** restores cover for those items, on conditions:

- the insured bears **50% of the assessed loss** on each such item, every claim
- cover applies only where the vehicle is **also damaged in the same incident**
- **theft** of these items is excluded under all circumstances
- depreciation still applies per the policy's own schedule

IMT-23 is therefore a **benefit, not a penalty**. Without it these parts are covered at 0%; with it, at 50%.

Nothing in the codebase models this. Worse, `AssessmentTab.tsx:83` tells the surveyor *"Calculations apply IMT-23 and GST automatically"* — which is false.

### 2. Paint material depreciation is not applied

GR-9 of the erstwhile India Motor Tariff, as modified by IRDAI effective 01 Feb 2013: depreciation of 50% applies **only to the material cost** of painting charges, and where the bill is consolidated the material component is taken as **25% of total painting charges**.

Our automatic rate for paint is 0%. The 2026-08-10 design deferred this deliberately — *"Revisit only if the manual entry proves repetitive in practice"* — and it has proved repetitive.

**The derived 12.5% is not an acceptable way to express this.** 12.5% appears in no tariff. Printing `Dep 12.5%` on a paint row invites a query from anyone who knows the rule is 50%, and hides the bifurcation that justifies it. All four SWAR documents state the real rule instead, as a separate deduction line.

## Evidence base

Both claims reconcile to the rupee and become test fixtures.

| | Claim A — TATA SIGNA 4825 | Claim B — TATA LPT 4825 |
|---|---|---|
| Policy | Standard dep, 46 months → metal 25% | **Nil dep** |
| IMT-23 metal | ₹16,433.91 → less ₹8,216.95 | ₹5,000.00 → less ₹2,500.00 |
| IMT-23 plas/rub | ₹10,443.22 → less ₹5,221.61 | ₹2,400.00 → less ₹1,200.00 |
| IMT-23 paint | ₹20,000.00 → less ₹10,000.00 | ₹18,000.00 → less ₹9,000.00 |
| Contribution of insured | **₹23,438.56** | **₹12,700.00** |
| Net assessed loss | **₹11,09,000.41** | **₹1,12,000.00** |
| Bill check net | ₹11,02,000.68 — *not reproducible, see below* | **₹1,11,000.00** |

Claim B settles two questions empirically: paint material depreciation does **not** apply under a nil-dep policy, and IMT-23 applies in full regardless of depreciation type.

### Known divergence from SWAR — the bill-check cap

**SWAR's bill check pays the billed amount even when it exceeds the assessed.** In Claim A the workshop billed roughly 3% above assessment on most rows — headlamp assessed ₹5,076.27, billed ₹5,260.17, paid ₹5,260.17 — and SWAR's endorsement-23 deduction is computed on those billed figures (₹16,925.05 × 50% = ₹8,462.53).

Our `computeRowLiability` caps at `min(assessedNet, billedNet)`, a deliberate decision from the 2026-08-18 bill-check-cap design. Our net for Claim A's bill check is therefore **lower** than ₹11,02,000.68, and that figure must **not** be written as a test expectation — it would fail in a way that looks like a calculation bug.

Claim B's bill check *is* a valid fixture: billed equals assessed on every billed row there, so the cap never bites, and ₹1,11,000.00 is reproducible exactly.

This divergence is worth surfacing to the surveyor in the UI, since someone moving from SWAR will see our figure come out lower and assume a defect. Out of scope here; recorded as a follow-up.

## Goals

- The surveyor ticks a box on any row to mark it an IMT-23 item; the insurer's liability for that row halves.
- Paint material depreciation is applied and **stated in the tariff's own language**, never as a derived percentage.
- Every figure the surveyor sees while working is the figure that prints.
- No claim already signed changes unless the surveyor asks it to.

## Non-goals

- **No automatic IMT-23 detection, suggestion, or nudge, ever.** Which items fall under the endorsement is entirely the surveyor's judgment. The software offers a checkbox and nothing else.
- **No knob for the 50%.** That figure is fixed by the endorsement wording; a knob there would only be a way to print a number the policy does not support.
- **No `IMT 23 ITEMS SUMMARY` cross-tab.** SWAR dropped it themselves between December and February, keeping only the one-line contribution figure. Revisit if it is ever asked for.
- **No change to the UIIC portal summary or UIIC report presentation.** See "Deliberate exclusions".
- **No change to how depreciation is presented** (per-bucket `Less Depreciation` lines). Noted as a separate future item.

## Design

### Part 1 — The core: one helper

```ts
/** The assessed figure the insurer's liability is computed from. */
export function effectiveAssessed(row: AssessmentRow): number {
  return row.imt23 ? row.assessed / 2 : row.assessed;
}
```

The 50% is applied at the **assessed** level, before depreciation and GST — matching all four SWAR documents.

This position is what makes the printed block reconcile exactly, **always**, including with mixed `depOverride` rates and mixed per-row GST:

```
SUB TOTAL SPARE PARTS          Σ row.assessed
Less endorsement 23            Σ (ticked row.assessed × 0.5)
SUB TOTAL SPARE PARTS          Σ effectiveAssessed(row)
```

Applying it after depreciation would have required reconciling against post-dep subtotals that vary per row, and a single override would have broken the arithmetic on the face of the document.

Because every downstream step is a pure multiplier (`× (1−dep)`, `× (1+gst)`, `× disposalFactor`), and because `min(a,b) × 0.5 ≡ min(a×0.5, b×0.5)`, placing the halving here is arithmetically identical to placing it anywhere later in the chain. Verified against Claim A, where SWAR applies IMT-23 → GST → depreciation and reaches the same net.

### Part 2 — Where the helper applies

Two insertion points:

| Site | Reaches |
|---|---|
| `computeRowNet` (`row-net.ts:17`) | `aggregateGst` → every GST band, base, CGST, SGST · `computeRowLiability` → all bill-check liability · `standard-report-builder` · `uiic-final-builder` |
| `calculateAssessmentSummary` (`assessment.ts:88`) | material buckets, all GST accumulators, `grandTotal`, `netAssessedLoss` → `sectionSubtotals` → both grid footers |

`calculateAssessmentSummary` duplicates `computeRowNet`'s logic inline rather than calling it — pre-existing debt, out of scope to fix here. `effectiveAssessed` exists as a named helper precisely so the rule has one definition even though it has two call sites.

**GST needs no separate work.** Every GST figure in the codebase derives from the post-depreciation value, which derives from assessed. SWAR confirms GST follows the reduced base: metal ₹8,69,584.83 (post-IMT-23) × 9% = ₹78,262.64.

**Bill Check needs no calculation work.** `bill-check-projection.ts` states that bill check *is* the final report over projected rows; it spreads `...r`, so `imt23` survives, and `min(assessed, billed)` then halving matches SWAR's billed-side deduction exactly. A `not-in-bill` row projects to assessed 0, so its IMT-23 deduction vanishes — precisely the unbilled headlamp in Claim B.

### Part 3 — Where the helper must NOT apply

Each of these reads raw `row.assessed` and must continue to.

| Site | Reason |
|---|---|
| `salvageBasis` (`salvage.ts:23`) | Salvage is the scrap value of the physical part. The endorsement changes who pays, not what scrap is worth. |
| Estimate accumulators (`assessment.ts:141-161`) | An estimate is a fact about the garage's document. Nothing the surveyor ticks changes what the workshop wrote. Also protects the surveyor's professional fee, which runs off `estimateGrossTotal`. |
| `billedTotals` (`section-subtotals.ts:69`) | Bill-check grid column footers — document facts, not liability. |
| `negotiatedSavings`, overpricing, partial-repair (`insured-report.ts:42, 86, 90, 94`) | These compute `estimated − assessed`. Halving `assessed` would invent phantom negotiated savings equal to half the part's value and report them to the insured as the surveyor's negotiation. |
| Insured report line items (`insured-report.ts:65`) | Must show the part at its true assessed value with IMT-23 as a separate, named line — not silently at half, which reads as undervaluing the part. |

Each site gets a one-line comment naming the reason, so the exclusion is not "tidied up" later.

### Part 4 — Paint material depreciation

**Internally an effective per-row depreciation rate. Externally a section line stating the 50%-on-material rule. The internal rate is never displayed.**

```ts
// engine — a rate, like any other, fed to computeRowNet
paintEffectiveRate = (materialPercent/100) × (materialDepPercent/100) × 100   // 25, 50 → 12.5

// report — the printed figure, derived for display only
paintMaterialDep = Σ(paint rows without depOverride).effectiveAssessed × paintEffectiveRate/100
```

It **must** be a per-row rate, not a subtraction from the section subtotal. Two reasons:

1. **It would break the base/GST pairing.** `paintOnlyGST` is accumulated per row on the full base. Subtracting the material deduction from `paintOnlyBase` afterwards leaves GST attached to a base that no longer exists.
2. **Paint rows can carry different GST rates.** A section-level subtraction has no single rate to reverse out.

The two formulations are arithmetically identical — `Σ(b × 0.875) ≡ Σb − 0.125 × Σb` — so the displayed section line is exact.

**The deduction reduces the taxable base, then GST applies to what remains.** This is not optional:

```
correct   (10,000 − 1,250) × 1.18 = 10,325
wrong      10,000 × 1.18 − 1,250  = 10,550     ← 18% of the deduction, in error
```

SWAR reaches ₹10,325 by both routes because its final report subtracts the **GST-inclusive** material figure (₹1,475 = 2,950 × 50%) from a GST-inclusive total, while its bill check subtracts the **pre-GST** figure (₹1,250) from a pre-GST base. We use the pre-GST form throughout, in both documents, and print ₹1,250.

Because the halving happens at `effectiveAssessed`, the rate lands on the **post-IMT-23** paint figure automatically, matching SWAR's label *"Painting Material (After less endorsment 23)"*.

Active only when `applyPaintMaterialDep === true` **and** the policy is standard depreciation. Under nil depreciation there is no material deduction at all — confirmed by Claim B.

Rows carrying an explicit `depOverride` keep their own rate and are excluded from both the effective rate and the displayed section line, so nothing the surveyor set deliberately is touched or double-deducted.

### Part 5 — Data model

```ts
// AssessmentRow
imt23?: boolean;

// ClaimData
applyPaintMaterialDep?: boolean;   // createClaim sets true; absent on existing claims → off
paintMaterialPercent?: number;     // default 25
paintMaterialDepPercent?: number;  // default 50
```

All optional. Every stored claim loads and prints unchanged until the surveyor acts.

### Part 6 — New `AssessmentSummary` fields

```ts
partsBasePreDep: number;
metalPreDep, plasticPreDep, glassPreDep, fiberglassPreDep: number;
labourOnlyBasePreDep, paintOnlyBasePreDep: number;
imt23Deduction: { parts: number; labour: number; paint: number; total: number };
imt23ItemCount: { parts: number; labour: number; paint: number };
paintMaterialDep: number;
```

`imt23Deduction.total` is the `Contribution of insured under IMT-23` figure.

### Part 7 — Assessment grid

- Narrow `IMT 23` column, checkbox per row, on **all three sections**. Always rendered, hideable through the existing column-visibility control. Restricting it to Parts and Paint would be more code, not less, and would leave no clean way to halve R&R labour on an IMT-23 part.
- **Rows keep showing their full assessed value.** The grid is the truth of what the part costs.
- Section footers gain the deduction lines, in the same wording and order they print — so the grid previews the report rather than surprising the surveyor at print time.
- Painting section header carries the controls: `[✓] Paint material dep — material [25]% @ [50]% dep`. Adjacent to the number they change. Shown only on standard-dep claims.
- Deduction lines render only when a section actually has a ticked row. A private-car claim looks exactly as it does today.

### Part 8 — Standard report (final and bill check)

- Narrow `*` column on ticked rows, including rows marked `not-in-bill` — the tag belongs to the part, not to the money. A dedicated column rather than appending to the particulars text, which also avoids colliding with the existing `%*` depreciation-override marker.
- The IMT-23 block is inserted **above** the existing section subtotal, as three new lines, using the new pre-depreciation figures:
  ```
  Assessed before depreciation            877,801.79    ← new
  Less endorsement 23 (50% share, 13 items)  8,216.95    ← new
                                          869,584.83    ← new
  SUB TOTAL SPARE PARTS                   652,188.62    ← existing line, meaning unchanged
  ```
  The existing subtotal keeps its current meaning (after depreciation, before GST). Its *value* moves only because the rows themselves are reduced. Nothing existing is relabelled, which is what lets the regression floor hold.
- **The block renders when the deduction amount is greater than zero — not when the section merely contains a ticked row.** In Claim B's bill check the rubber bucket contains a ticked headlamp that was never billed, so the deduction is zero and SWAR prints no line. Rendering on ticked-row presence would print `Less endorsement 23 (1 item) — ₹0.00`.
- `N items` counts the rows actually contributing to that deduction. The count is the print affordance: on a 123-row report a reader needs to know how many asterisks to find, and colour does not survive a monochrome printer.
- `Contribution of insured under IMT-23` in the insurer-information block.
- Under the painting subtotal, the deduction and its working:
  ```
  Less 50% dep. on paint material (₹2,500 of ₹10,000 @ 25%)     1,250.00
  Painting labour @ 75% ..... 7,500.00
  Painting material @ 25% ... 2,500.00   less 50% = 1,250.00
  ```
- Footnote below the assessment sheet:
  > `*` IMT-23 part. Lamps, tyres/tubes, mudguards, bonnet/side parts, bumpers, headlights and paintwork are excluded under the standard commercial vehicle policy and are covered only by virtue of Endorsement IMT-23, under which the insured bears 50% of the assessed loss. Cover applies only where the vehicle is also damaged in the same incident. Theft of these items is excluded.
- **Policy-type banner** in the header, adopted from SWAR's `Note : ( 0% Dep. Policy)`. The label already exists at `standard-report-builder.ts:358`; it is simply not printed prominently. This tells the reader why depreciation lines are absent instead of leaving them to wonder whether they were forgotten.

### Part 9 — Insured report

One new clause in `getIRDAIStandardClauses()`, surfaced only when the claim has ticked rows, framed as the buy-back it is:

> **Endorsement IMT-23 — cover restored on specified parts**
>
> Parts such as your bumper, headlamps, mudguards and paintwork are normally not covered at all under a commercial vehicle policy. Your policy carries Endorsement IMT-23, which brings them back into cover: the insurer pays half of their assessed cost and you bear the other half. Without this endorsement you would have had to pay for these parts in full.

Line items show the full assessed value with IMT-23 as its own named deduction.

## Deliberate exclusions

- **UIIC portal summary** (`uiic-portal-summary.ts`) is untouched and continues to read raw `assessed`. IMT-23 claims are not filed through that portal in practice, and the portal has no IMT-23 field. Guarding it costs one comment; guessing at it would produce figures nobody asked for.
- **UIIC report presentation** gains no `*` column and no deduction line this cycle. Its *totals* will move, because the calculation is global — if a row is IMT-23 the liability genuinely is half, and a UIIC report printing the full figure would be wrong. Presentation follows in a later cycle.
- **Constructive total loss** continues to work off `netAssessedLoss`, so IMT-23 reduces the ratio. This is consistent with how depreciation is already treated. Whether the warning should use repair cost rather than the net figure is a real question about existing behaviour, and is recorded as a separate item rather than half-fixed here.
- **No colour-coding of IMT-23 rows** in the grid beyond the checkbox and the accent on the deduction line. Row tinting would compete with the existing disallowed and disposal states on an already dense grid.

## Testing

Both settled claims become fixtures — they are the best regression suite available, because the correct answer is already signed by a surveyor and accepted by an insurer.

All expectations below were modelled against the proposed engine and verified to reconcile before this spec was finalised. Compare money with a ±₹0.05 tolerance: SWAR rounds its printed net to whole rupees, and the bucket-collapsed model carries sub-paisa drift.

- **Claim A final, standard dep.** Metal IMT-23 ₹16,433.91 → ₹8,216.95; plas/rub ₹10,443.22 → ₹5,221.61; paint ₹20,000 → ₹10,000; contribution ₹23,438.56; parts after dep incl GST ₹10,27,052.61; labour incl paint ₹1,27,097.80; total assessed ₹11,54,150.41; **net assessed loss ₹11,09,000.41**.
- **Claim A bill check — assert the cap, not SWAR's net.** Assert that a row billed above its assessed figure contributes `assessed`, not `billed`, and that its IMT-23 deduction follows the capped figure. Do **not** assert ₹11,02,000.68.
- **Claim B final, nil dep.** Contribution ₹12,700.00; parts ₹20,700.00; labour ₹94,600.00; **net ₹1,12,000.00**. No paint material deduction anywhere.
- **Claim B bill check.** Spare total ₹19,500.00; **net liability ₹1,11,000.00**. The unbilled headlamp contributes zero, so the rubber deduction is ₹0 and **no line is rendered for that bucket**.
- **Reconciliation.** For every claim, `preDepSubtotal − imt23Deduction == preDepSubtotalAfter`, exactly — including with a `depOverride` on one row of a bucket and a non-18% GST rate on another. This is the property the pre-depreciation placement buys, and the test that proves it.
- **Commutativity.** `halve → dep → GST` equals `halve → GST → dep` to the paisa, and `min(a,b)/2 == min(a/2, b/2)`. Also with a disposal row and a `not-in-bill` row.
- **The five exclusions.** Ticking a row does not move `salvageBasis`, any estimate total, `billedTotals`, `negotiatedSavings`, or the professional fee.
- **Paint, base-vs-GST ordering.** A ₹10,000 paint line with the toggle on yields ₹10,325 incl GST, **not** ₹10,550. This single assertion catches the whole class of "subtract from the wrong side of GST" error.
- **Paint, other cases.** Deduction computed on the post-IMT-23 figure; absent under nil dep; absent when the claim toggle is off; a paint row with a `depOverride` keeps its own rate and is excluded from both the effective rate and the displayed line; paint rows at two different GST rates still reconcile.
- **Regression floor.** With no row ticked and the paint toggle off, **every existing report figure is byte-identical.** This is the gate on the whole change.

## Rollout

No migration. All new fields are optional; absent means off. Existing claims print exactly as they do today until the surveyor ticks a box or switches the paint toggle on. New claims get the paint toggle on by default when the policy is standard depreciation.

## Prerequisite — already landed

Two date-of-loss defects found during this audit are fixed and verified (`tsc` clean, 921 tests passing):

- `irdai-summary-builder.ts` computed depreciation against *today* rather than the accident date, so a claim's regulatory summary drifted upward every month it sat unsettled and disagreed with its own final report.
- `UIICPrintReport.tsx` used the survey date instead of the accident date.
- `getVehicleAgeMonths`'s `referenceDate` is now a required parameter, so the compiler prevents recurrence.

## Open questions

None. Resolved during design:

- IMT-23 applied at the assessed level, before depreciation, matching SWAR (option A).
- Checkbox on all three sections, not Parts and Paint only.
- Paint depreciation as a section-level deduction stating the 50%-on-material rule, never as a 12.5% row rate.
- Paint deduction gated on a per-claim toggle, defaulting on for new standard-dep claims and off for existing ones.
- Depreciation presentation (per-bucket `Less Depreciation` lines) deferred to a separate cycle.
- UIIC portal left untouched.
- Constructive total loss follows the net figure, as it already does.

Corrected after modelling the design against both claims:

- Paint material depreciation is an **internal per-row rate**, not a section-level subtraction — a subtraction would break the base/GST pairing and cannot handle mixed GST rates.
- The paint deduction reduces the **taxable base**; GST applies to what remains.
- The IMT-23 block renders on **deduction amount > 0**, not on the presence of a ticked row.
- The block sits **above** the existing subtotal as new pre-depreciation lines; no existing line is relabelled.
- Claim A's bill-check net is **not** a valid fixture, because our cap at `min(assessed, billed)` diverges from SWAR.

Recorded as follow-ups, not addressed here:

- Surfacing the bill-check cap in the UI, so a surveyor moving from SWAR understands why our figure is lower.
- Whether the constructive-total-loss warning should use repair cost rather than the net figure. It already has this issue with depreciation, independently of IMT-23.
- IMT-23 presentation in the UIIC reports (their totals move with this change; their layout does not).
