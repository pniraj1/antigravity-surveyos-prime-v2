# Design: Standard Bill Check Report

**Date:** 2026-08-18
**Status:** Draft — awaiting review

---

## Problem

The Bill Check tab collects a full set of bill-side inputs — `billedTaxable`, `billedAmount`, `billStatus`, `billRemarks` ([BillCheckGrid.tsx:394-449](../../src/components/tabs/bill-check/BillCheckGrid.tsx)) — and `extraBillItems`. The only report that consumes any of it is the UIIC Bill Check Report, which consumes three fields and throws the rest away.

`buildUIICBillCheckHTML` ([uiic-final-builder.ts:460-998](../../src/lib/reports/uiic-final-builder.ts)) reads:

- `billNo` / `billDate` → four header cells
- `billTotal` → one cell
- `billStatus` + `billedTaxable` → two summary numbers, via `calculateBillCheckSummary`

Its item table ([:771-839](../../src/lib/reports/uiic-final-builder.ts)) is built entirely from `estimated`, `assessed`, `gst` and `depOverride`. It has no Bill column, no status column, no billed figure of any kind. It is the Final Report's table with Paint split out.

For UIIC that is correct behaviour, not a defect. UIIC is a **one-pass** workflow: the Final Survey Report is itself prepared from the workshop bill, so `assessed` already carries the bill figure and there is no second number to print. The document exists to certify that disallowed items were excluded, which is exactly what it states at [:989](../../src/lib/reports/uiic-final-builder.ts).

Other insurers run a **two-pass** workflow. The Final Survey Report assesses from the garage *estimate*; weeks later the workshop's bill arrives with different figures. The bill check must show what was billed against what was assessed. No report in the codebase does this — `standard-report-builder.ts` does not read `billCheck` either.

So the missing artifact is the Standard bill check, not a fix to the UIIC one.

---

## Goal

Produce a Standard Bill Check Report that is the Standard Final Survey Report with the **Estimate column replaced by the Bill column**, so a claims officer reads Bill against Assessed in the layout they already know. All other columns, the §8 summary, the GST/HSN tables and the depreciation treatment stay exactly as they are.

---

## Scope

**In scope:**
- `mode: 'final' | 'bill-check'` on the existing Standard builder
- A pure row projection that moves the bill figure into the estimate slot and zeroes unreplaced parts
- `PENDING` rendering for rows with no bill figure recorded
- Format toggle (Standard | UIIC) on the Bill Check tab, mirroring [ReportTab.tsx:58](../../src/components/tabs/ReportTab.tsx)
- Bill-check variant of the report preamble

**Out of scope:**
- Any new field on `AssessmentRow` — none is required
- Any change to `calculateAssessmentSummary`, `aggregateGst`, `computeRowNet` or `computeRowLiability`
- Any change to the UIIC Bill Check Report, including its known not-in-bill total mismatch (tracked separately)
- A second Bill Check tab — the existing grid already collects every input this report needs
- Variance columns, remarks columns, or a deduction summary section
- Auto-selecting the format from `policy.insurerName` — it is free text and drives nothing today

---

## Design

### The whole feature is a projection

The report is the Standard Final Survey Report rendered over projected rows. Nothing downstream changes.

```ts
// ponytail: bill check IS the final report over projected rows. The estimate
// slot carries the bill figure, and a part that was never replaced carries no
// money. Every existing calculation then works untouched.
export function projectForBillCheck(rows: AssessmentRow[]): AssessmentRow[] {
  return rows.map(r =>
    r.billStatus === 'not-in-bill'
      ? { ...r, estimated: 0, assessed: 0 }
      : { ...r, estimated: r.billedTaxable ?? 0 }
  );
}
```

Immutable, per the project's immutability rule. Because `assessed` is what every money path already reads, zeroing it is sufficient to remove an unreplaced part from §8, the GST tables and the net liability — with no arithmetic changes anywhere.

### What `mode` actually controls

Only labels and one cell. It does not thread through the calculations.

| Location | `final` | `bill-check` |
|---|---|---|
| Document title | `MOTOR (FINAL) SURVEY REPORT` | `MOTOR BILL CHECK REPORT (FINAL)` |
| §9 main header ([:615](../../src/lib/reports/standard-report-builder.ts)) | `Est. ₹` | `Bill ₹` |
| §9 labour/paint sub-header ([:301](../../src/lib/reports/standard-report-builder.ts)) | `Est. ₹` | `Bill ₹` |
| §8 summary column | `Estimated` | `Billed` |
| §9 cell ([:232](../../src/lib/reports/standard-report-builder.ts), [:273](../../src/lib/reports/standard-report-builder.ts)) | `m9(r.estimated)` | `PENDING` when `billedTaxable` is undefined, else `m9(r.estimated)` |
| Preamble ([:470](../../src/lib/reports/standard-report-builder.ts)) | estimate wording | bill wording |

The §8 columns at [:128-132](../../src/lib/reports/standard-report-builder.ts) sum `r.estimated` and therefore pick up the bill figures for free once the rows are projected.

### §9 columns

Unchanged from the Final Survey Report except the first money column:

`Sr. | Particulars | Type | Bill ₹ | Assessed ₹ | Dep% | Metal ₹ | Pla/Rub ₹ | [FbrGls ₹] | Glass ₹ | GST% | Price+GST ₹`

No Variance column and no Remarks column: with Bill sitting beside Assessed, the difference is visible by subtraction, the same way Est. and Assessed already read in the final report. GST is presented exactly as the Standard Final Survey Report presents it.

### Row behaviour

| Condition | Bill ₹ | Money columns | In PDF |
|---|---|---|---|
| `allowed === false` | — | — | **No** — excluded, as today |
| `billStatus === 'not-in-bill'` | `0` | zeroed | Yes — visible, carries no money |
| `billedTaxable` undefined | `PENDING` | assessed stands | Yes |
| otherwise | `billedTaxable` | assessed stands | Yes |

`not-in-bill` covers both real cases — *"should have been billed and wasn't"* and *"the part was never put"*. The row printing with zeros lets the insurer see that a part was assessed and not replaced, and the saving is self-evident from the assessed column beside it.

### Items in the bill that are not in the assessment

Handled by the existing supplementary flow, not by a new mechanism.

On final-bill extraction, items matching no assessment row trigger the existing prompt ([useEstimateModePrompt.tsx](../../src/hooks/useEstimateModePrompt.tsx) / [EstimateModeDialog.tsx](../../src/components/dialogs/EstimateModeDialog.tsx)): *is there a supplementary estimate for these?*

- **Yes** → promoted into the assessment sheet as `source: 'supplementary'` rows via the existing `promoteExtraBillItem` action. They then flow into bill check normally, under the supplementary divider band both reports already draw.
- **No** → they stay in `ExtraBillItemsPanel` and the surveyor decides per row. Nothing unassessed reaches the PDF.

### Allowing a figure above the assessed value

There is no override field. Because the bill check's money column *is* `assessed`, allowing more means editing `assessed` in the grid — normally on the strength of a supplementary estimate.

**This is a deliberate trade with a consequence:** both reports read the same field, so raising a figure retroactively changes the Final Survey Report that was already submitted. That is defensible when a supplementary estimate exists (a supplementary *is* a revised assessment) and wrong when one does not. The design does not enforce the distinction; the surveyor does.

---

## Open decision — confirm at review

**Do PENDING rows carry their assessed money into the totals?**

This spec assumes **yes**: an unchecked row keeps its assessed value, and the report carries a visible banner stating how many items are unverified. Rationale: nothing has been decided that would reduce the figure, so the assessment stands until checked.

The risk is a bill check issued mid-check whose net liability includes unverified items. The banner is the mitigation, not a guarantee. The alternative — zeroing pending rows — understates liability just as wrongly. If the preference is that an incomplete bill check must not print at all, say so and it becomes a gate on the print button instead.

---

## Files touched

| File | Change |
|---|---|
| `src/lib/reports/bill-check-projection.ts` | **New** — `projectForBillCheck`, ~10 lines |
| `src/lib/reports/standard-report-builder.ts` | `mode` param; 2 header labels; §8 label; PENDING cell; title; preamble branch |
| `src/lib/reports/final-survey-preamble.ts` | Bill-check preamble variant |
| `src/components/tabs/BillCheckTab.tsx` | Standard \| UIIC toggle; route preview and Power Print through it |
| `src/lib/reports/__tests__/standard-bill-check.test.ts` | **New** |

`buildStandardPrintDocument` ([:665](../../src/lib/reports/standard-report-builder.ts)) and `triggerStandardPrint` ([:678](../../src/lib/reports/standard-report-builder.ts)) take a `mode` passthrough.

The builder grows to roughly 710 lines, within the 800 limit. Extending it rather than writing a parallel builder is deliberate: a copy would drift, which is the exact failure the depreciation table already caused ([:35-39](../../src/lib/reports/standard-report-builder.ts)).

---

## Testing

One vitest file, `standard-bill-check.test.ts`:

1. `projectForBillCheck` moves `billedTaxable` into `estimated` and leaves `assessed` alone
2. A `not-in-bill` row projects to `estimated: 0, assessed: 0`
3. A row with undefined `billedTaxable` projects to `estimated: 0` and renders `PENDING`
4. `allowed: false` rows stay out of the rendered HTML
5. §8 totals over projected rows equal `calculateAssessmentSummary` over the same projected rows — i.e. the summary and the table cannot disagree
6. Projection is immutable: the input array and its rows are unmodified
7. Net liability over projected rows containing one `not-in-bill` row equals net liability over the same rows with that row removed

---

## Risks

- **Retroactive edits to `assessed`** rewrite an already-issued Final Survey Report. Documented above; not enforced in code.
- **`billedTaxable` vs `billedAmount`.** The projection must use `billedTaxable` (pre-GST). Using `billedAmount` would feed a GST-inclusive figure into a column the builder then taxes again — the same class of error that produced a ~31% overstatement in the UIIC builder ([:560-563](../../src/lib/reports/uiic-final-builder.ts)).
- **Verification limits.** This is an auth-gated screen needing real claim data; correctness will be established by the unit tests above, not by running the dev server.
