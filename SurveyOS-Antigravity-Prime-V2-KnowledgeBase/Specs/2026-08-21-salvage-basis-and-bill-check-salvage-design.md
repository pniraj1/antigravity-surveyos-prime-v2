# Design: Salvage — the Basis, and a Bill Check Figure of Its Own

**Date:** 2026-08-21
**Status:** Draft — awaiting review

---

## Problem

Salvage is the value of the old damaged part, which becomes the insurer's property once a replacement is fitted. It is deducted from the settlement. Two things are wrong with how the app handles it.

**The suggestion is computed off the wrong number.** The Assessment tab prints a suggested range under the salvage box, 5% to 10% of `summary.estimateMetalBase` ([AssessmentSummary.tsx:43](../../src/components/claim/AssessmentSummary.tsx)). That field is the *garage's estimate* for metal parts, before depreciation, **without GST**, over **every** metal row including ones the surveyor rejected.

Salvage is scrap sold by weight and condition, and what determines it is the part the surveyor actually allowed — priced as it will be claimed, GST included. The estimate is the garage's asking price for a part that may never have been allowed at all.

Worked example, GST 18%:

| part | estimate +GST | assessed +GST | allowed |
|---|---|---|---|
| Fender | 10,000 | 8,000 | yes |
| Bonnet | 14,000 | 12,000 | yes |
| Door | 9,000 | — | **no** |

Today the suggestion reads off `estimateMetalBase` — the pre-GST bases of all three, rejected door included. It should read 20,000, the two allowed parts as assessed and as they will be claimed.

The unfiltered part of this is recent and deliberate: the 2026-08-20 fix removed an `allowed` guard from the per-material estimate split so the split would agree with `estimatePartsBase` above it. That was correct for the summary table, and the surveyor accepted the salvage side-effect at the time rather than reverting the fix. Moving salvage onto its own basis resolves it properly — the estimate figures stay unfiltered, and salvage stops reading them.

**Bill Check has no salvage of its own, and no box to type one in.** Both `calculateAssessmentSummary` and `calculateBillCheckSummary` receive the same `feeBill.salvageValue` ([BillCheckTab.tsx:104,108](../../src/components/tabs/BillCheckTab.tsx)), and the Bill Check tab has no salvage input at all. To change it the surveyor must return to the Assessment tab — where typing rewrites the figure printed on a Final Survey Report already sent to the insurer.

This matters because the bill-check basis genuinely moves. Continuing the example: the fender is billed at 7,000 and the cap takes the bill-check assessment down to it, and the bonnet is **not in the bill** — the garage never replaced it.

| | metal basis | 5–10% band | salvage in force |
|---|---|---|---|
| Final Survey Report | 20,000 | 1,000 – 2,000 | 1,500 (typed) |
| Bill Check, today | 20,000 | — (no box) | **1,500**, carried over |
| Bill Check, correct | 7,000 | 350 – 700 | ~525 |

1,500 against a 7,000 basis is 21%. The bonnet's share of that 1,500 was 900 — 12,000 of the 20,000 basis it was struck on — and the bonnet was **never replaced**. No old bonnet came off, the insurer receives nothing, and the insured is charged for it anyway.

---

## Goal

Salvage suggestions read from the parts actually allowed, priced as claimed. The Bill Check tab gets its own salvage figure and its own input, resolved from the final report's figure by default and overridable by the surveyor, and it never writes back to the Final Survey Report.

**Non-goal:** salvage stays a number the surveyor decides. Every figure here is a suggestion or a starting point. Nothing in this design makes salvage a computed output the surveyor cannot overrule.

---

## 1. The basis

One function, in a new `src/lib/calculations/salvage.ts`:

```ts
import type { AssessmentRow } from '@/types/assessment';

/**
 * The metal-parts figure a salvage suggestion is a percentage of.
 *
 * Allowed metal parts only, at their assessed amount before depreciation,
 * with each row's own GST — the amount the claim will actually carry for
 * that part. Salvage is scrap: what matters is the part that came off,
 * which exists only for parts the surveyor allowed.
 *
 * `amount` is the lens. Pass nothing for the Final Survey Report's basis;
 * pass `billCheckAssessed` for the Bill Check's, and the cap and the
 * not-in-bill rows fall out on their own.
 *
 * Disposal rows carry no GST, matching the engine everywhere else.
 */
export const salvageBasis = (
  rows: AssessmentRow[],
  amount: (r: AssessmentRow) => number = r => r.assessed,
) => rows.reduce((s, r) =>
  r.allowed && r.section === 'parts' && r.partType === 'metal'
    ? s + amount(r) * (r.isDisposal ? 1 : 1 + (r.gst ?? 18) / 100)
    : s, 0);
```

Deliberately **not** a new field on `AssessmentSummary` or `BillCheckSummary`. Putting it there would mean changing two engine functions, two exported interfaces, and threading a parameter through three report builders — all to carry one sum that two call sites need. The lens argument gives both figures from one implementation.

The `allowed` test cannot be replaced by `assessed === 0`. Turning a row off does not zero its assessed amount — `toggleRowAllowed` writes `assessed` only when switching a row *on* ([assessmentSlice.ts:318](../../src/stores/slices/assessmentSlice.ts)) — so a rejected row keeps its old figure. The engine filters on `allowed` for the same reason ([assessment.ts:86](../../src/lib/calculations/assessment.ts)).

### The Assessment tab's suggestion changes basis

| | now | after |
|---|---|---|
| source | `summary.estimateMetalBase` | `salvageBasis(rows)` |
| figure | estimate | assessed |
| GST | excluded | **included** |
| rejected rows | counted | **excluded** |

The input stays a rupee field. The 5% and 10% buttons stay. Only the number they are a percentage of changes.

---

## 2. The Bill Check figure

New optional field on `FeeBill`:

```ts
/** Bill-check-only salvage. Undefined means "rescale the final report's". */
billSalvage?: number;
```

Optional with no default, because `undefined` is load-bearing: it is what distinguishes *the surveyor has not touched this* from *the surveyor typed zero*.

Resolver, in `src/lib/reports/bill-check-projection.ts` beside `billCheckAssessed`, so the import direction stays reports → calculations:

```ts
/**
 * The salvage figure the Bill Check reports use.
 *
 * A figure typed on the Bill Check tab wins. Otherwise the final report's
 * salvage is rescaled by how far the metal basis has moved — the same
 * percentage of a smaller (or larger) pile of allowed metal.
 *
 * Bill-check only. `feeBill.salvageValue` is never written here; the Final
 * Survey Report keeps the figure it was filed with.
 */
export function resolveBillSalvage(fb: FeeBill | undefined, rows: AssessmentRow[]): number {
  if (fb?.billSalvage !== undefined) return fb.billSalvage;
  const final = salvageBasis(rows);
  if (!final) return fb?.salvageValue ?? 0;
  return Math.round((fb?.salvageValue ?? 0) * salvageBasis(rows, billCheckAssessed) / final);
}
```

**Both directions.** The basis rises when the surveyor raises an assessment to meet a larger bill, and salvage rises with it — a bigger part replaced means bigger scrap handed over. Decided explicitly; the formula has no special case.

**A zero final basis carries the figure unchanged.** With no allowed metal there is no ratio to rescale by, and inventing one would be worse than leaving the surveyor's number alone.

Worked through the running example. Each row is an independent outcome for the same claim, not a sequence:

| case | final basis | bc basis | salvage |
|---|---|---|---|
| bonnet not billed, fender capped to 7,000 | 20,000 | 7,000 | 1,500 → **525** |
| both billed, fender at 9,000 and the surveyor raises to match | 20,000 | 21,000 | 1,500 → **1,575** |
| surveyor types 800 on the Bill Check tab | — | — | **800** |

---

## 3. The input, once

The salvage box, its suggested band and its 5%/10% buttons currently live inline in `AssessmentSummary.tsx` ([:155-190](../../src/components/claim/AssessmentSummary.tsx)). They move to `src/components/claim/SalvageInput.tsx`:

```tsx
<SalvageInput value={…} onChange={…} basis={…} />
```

Both tabs render it. The Assessment tab passes `salvageBasis(rows)` and writes `salvageValue`; the Bill Check tab passes `salvageBasis(rows, billCheckAssessed)` and writes `billSalvage`.

One component rather than two copies of a 5–10% rule, for the reason this codebase already learned the hard way: three copies of the depreciation table drifted apart until they disagreed. `AssessmentSummary.tsx` gets shorter as a result.

**On the Bill Check tab**, when `billSalvage` is undefined the box shows the resolved figure with a line beneath it naming where it came from — *carried from the final report, rescaled 20,000 → 7,000*. Only an actual edit sets `billSalvage`; focusing or tabbing through the field does not pin it. Clearing the field returns it to `undefined` and the figure to automatic.

It sits in `BillCheckSummaryPanel`, next to the excess figures it is subtracted alongside.

---

## 4. Wiring

| site | change |
|---|---|
| `AssessmentSummary.tsx` | render `SalvageInput`, basis `salvageBasis(rows)` |
| `BillCheckSummaryPanel.tsx` | render `SalvageInput`, basis `salvageBasis(rows, billCheckAssessed)` |
| `BillCheckTab.tsx` | resolve once, pass to **both** summary calls in place of `fb?.salvageValue` |
| `standard-report-builder.ts` | resolved figure **only when `mode === 'bill-check'`** |
| `uiic-final-builder.ts` | resolved figure in the bill-check builder only ([:587,594](../../src/lib/reports/uiic-final-builder.ts)) |

The standard builder is the one to watch: it reads salvage once for both modes ([:122,134](../../src/lib/reports/standard-report-builder.ts)). Without the mode branch, the Final Survey Report starts printing the rescaled figure — the exact harm this design exists to prevent.

`BillCheckTab` passes the resolved figure to `calculateAssessmentSummary` as well as `calculateBillCheckSummary`, because on that tab both summaries describe the bill check.

---

## Testing

`salvageBasis`:
- allowed metal only — rejected metal, plastic, glass and labour rows contribute nothing
- a rejected row that still carries a stale `assessed` contributes nothing
- GST applied per row at its own rate; two rows at different rates
- disposal rows contribute their assessed amount with no GST
- the `billCheckAssessed` lens: a capped row contributes the billed figure, a not-in-bill row contributes nothing

`resolveBillSalvage`:
- `billSalvage` set wins, including when set to 0
- basis halved halves the salvage
- basis risen raises the salvage
- final basis 0 carries `salvageValue` through unchanged
- `salvageValue` 0 stays 0 whatever the bases

Reports:
- the Final Survey Report prints `salvageValue` even when `billSalvage` is set to something else — the regression that matters most
- the Standard Bill Check and the UIIC Bill Check both print the resolved figure
- `netLiability` reflects the resolved salvage

---

## Known risks

- **The standard builder serves two reports from one salvage read.** Covered by an explicit test; noted here because a careless later edit could undo it.
- **Not verifiable without a live claim.** The Bill Check tab is auth-gated and needs real bill data. Correctness rests on unit tests plus the surveyor exercising the box.

A typed figure staying put as the bill changes is not a risk; it is the point. The band is a suggestion, the surveyor decides the number, and nothing in this design nags about, warns on, or overrides a figure the surveyor has entered. Clearing the field returns it to automatic.
