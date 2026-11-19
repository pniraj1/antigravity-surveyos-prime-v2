# Kept-Open (K.O.) Parts, Missing Items, and the Liability Comparison — Design

Date: 2026-11-19 · Status: awaiting owner approval

## Why

When a Final Survey Report is first made, some parts can only be judged after
the vehicle is dismantled. Surveyors mark these **K.O. (kept open)**. They are
not part of the assessment, because the surveyor is not yet sure about them.
On a borderline total loss, though, they can change which settlement is
cheapest, so the insurer must see them.

Two more gaps in the same table:
- The **Repair Basis** column of "Comparison of Insurer's Liability" prints
  "—" on every row and a bare net at the bottom. It should show its own
  build-up, starting from the repair cost including GST. IDV plays no part in
  it.
- There is no way to deduct **missing items** (for example, stolen parts) from
  the total-loss settlements.

No claim has needed K.O. yet. Every addition below prints only when used, so
reports already filed look the same.

## Goals
- A surveyor can mark any assessment row (parts, labour or paint) as K.O.
- K.O. rows never enter the Net Assessed Loss.
- The comparison table shows Repair Basis with its own build-up, including a
  K.O. row, and a missing-items deduction in the total-loss columns.
- Wherever a K.O. row is shown, it reads "Kept open", never "Not allowed" or
  "Not covered".

## Non-goals / anti-goals
- K.O. must not be counted in the firm assessment (IRDAI: the assessment is
  the surveyor's own judgement).
- The 75% CTL warning stays on the firm figure (owner's decision).
- No K.O. column in the comparison table. It is a row inside Repair Basis
  (owner's decision).
- No change to the SurveyOS Scan app or the portal-fill extension. Neither
  reads assessment rows.

## Approaches considered
- **A. K.O. is a tagged "not allowed" (chosen).** Marking K.O. sets
  `allowed: false` and `keptOpen: true`. All 37 files that total money already
  skip `allowed === false`, so K.O. money cannot leak into any total. The work
  is in the places that *print* or *describe* a non-allowed row.
- B. A separate status with `allowed: true`. Every money path would have to
  learn to skip K.O. rows, and one missed path would silently add unassessed
  money to the Net Assessed Loss. Rejected.
- C. Typing K.O. parts into the Total Loss form. The parts are already in the
  estimate, so they would be entered twice. Rejected.

## The data

`AssessmentRow.keptOpen?: boolean`. Rule: `keptOpen === true` implies
`allowed === false`.
- **Mark K.O.:** `allowed: false, keptOpen: true`.
- **Tick ✓ (allow):** `keptOpen` is cleared. The existing rule
  (`assessed = estimated`) applies.
- **Tick ✕ (disallow) on a K.O. row:** `keptOpen` is cleared and the row
  becomes an ordinary rejection.
- Every place that sets `allowed` to true, or that toggles it, must clear
  `keptOpen`: `toggleRowAllowed`, the `'allowed' in updates` branch in
  `assessmentSlice.updateRow`, and grid paste.

`totalLossDetails.missingItems?: { id: string; description: string; amount: number }[]`.
This is optional, and old claims have none.

**K.O. amount** (owner's decision): the quotation figure, with no depreciation,
including GST. Per row this is `estimated × (1 + gst/100)`. The K.O. total is
the sum over rows where `keptOpen` is set. A disposal flag on a K.O. row is
ignored, so the amount is always the plain quote.

## Comparison of Insurer's Liability: where it prints

The table prints only when Total Loss mode is on, in these four places:
- **Standard Final** and **standard Bill Check**: the existing table after
  section 8.
- **UIIC Bill Check**: the existing table (`buildUIICBillCheckHTML`, ~line 798).
- **UIIC Final: new** (owner's decision). It goes on page 3, straight after the
  DETAILS OF ASSESSMENT table and before the GST Summary page. UIIC's fixed
  Loss Assessment Sheet boxes are unchanged. UIIC Finals without Total Loss
  mode print exactly as today.

All four call the same function. In Bill Check mode it receives that report's
own net, built from bill figures and the rescaled salvage. The K.O. row is
always 0 there, because Bill Check printing is held while any row is K.O.
(builder's call, recorded here).

## The comparison table

```
Description                        Repair Basis   Total Loss   Net (W/RC)   Net (W/O RC)
Assessed repair cost (incl. GST)    grand total        —            —             —
Insured Declared Value (IDV)            —             IDV          IDV           IDV
Less: Policy Excess                  - excess      - excess     - excess      - excess
Less: Salvage                     - feeBill salvage    —        - salv W/RC   - salv W/O RC
Less: Missing items *                   —          - missing    - missing     - missing
Add: Towing / Addl. Expenses       + feeBill tow   + TL tow+rent (same)        (same)
Add: K.O. parts (as per estimate) *  + K.O. total      —            —             —
NET PAYABLE LIABILITY              Repair net+K.O.    ...          ...           ...
```
`*` marks a row that prints only when its amount is above 0.

- The Repair Basis column must sum to the report's existing net (standard:
  `grand + towing − salvage − excess`; UIIC: `gross − salvage − excess`, where
  `gross` already includes towing) plus the K.O. total. Repair Basis uses the
  fee-bill towing and salvage. The total-loss columns keep using the Total Loss
  form's figures, as they do today.
- Missing items are deducted only in the three total-loss columns, never in
  Repair Basis (owner's decision).
- Results are clamped at 0, as now.
- **The sums move into one pure function**, for example
  `liabilityComparison(claim, repairNet, grandInclGst)` in
  `src/lib/calculations/`. Both builders call it, and it gets one test file.
  Today the two builders carry their own copies, and those copies would drift.

## Where K.O. shows up (each needs a change)

| Place | Today a K.O. row would show | Change |
|---|---|---|
| Assessment grid (`AssessmentSectionTable.tsx`, `assessment-grid-config.ts`) | struck-through and greyed as rejected | A K.O. button beside ✓/✕. The row is tinted amber and labelled "K.O.", and the "With GST" cell shows the quote incl. GST in amber, not ₹0. |
| Standard Final report, section 9 (`standard-report-builder.ts` ~414, ~464) | NOT ALLOWED (red) | **KEPT OPEN** (amber). The Estimated column keeps the quote. |
| Standard Final report, section 8 Assessment Summary | nothing | One line under NET ASSESSED LOSS: "K.O. parts (as per estimate, incl. GST), not included above: ₹X". Prints whenever any K.O. row exists, total loss or not. |
| UIIC Final report rows (`uiic-final-builder.ts` 369/397/415) | "Not Allowed" in the money cell | "Kept Open" in amber |
| Comparison table, both reports | see above | see above |
| Insured report: AI input (`lib/ai/insured-report.ts`), prompt rule (`prompts.ts:494` maps not allowed → "not-covered"), summary (`lib/calculations/insured-report.ts:98`), PDF (`InsuredSummaryDocument.tsx` `categoryLabel`) | **"Not covered"**, sent to the vehicle owner | A K.O. row is its own category: "Kept open, to be decided after dismantling". **Status only:** no amount is printed and it is in no total the owner sees (owner's decision: an amount could read as a promise to pay). It is not counted with rejected items. |
| Smart Remarks (`SmartRemarksCell.tsx:61`) | writes a rejection reason | A `'kept-open'` kind that writes "Kept open pending dismantling" |
| Part price history (`lib/claims/part-history.ts:73`) | listed as disallowed | Labelled kept open |
| Bill read-in (`aiDataSlice.ts:699`) | "Workshop billed for a disallowed item" | For a K.O. row: "Billed while still kept open, decide in Assessment" |
| Bill Check print gate (`useBillCheckPrintGate.tsx`) | prints | **Holds printing** while any row is K.O. A banner lists those rows, with a link to the Assessment tab. K.O. is only ever decided in the Assessment tab. |
| Bill Check rejected-billed sum (`standard-report-builder.ts:253`) | counts K.O. as rejected | Fine once the print gate holds, so no change is needed |
| NIA / OIC Excel exports, UIIC portal summary | NIA prints "NOT ALLOWED"; OIC and portal already exclude | **Leave K.O. rows out** of the NIA export (owner's decision). The others already exclude them. |
| Total Loss form (`TotalLossForm.tsx`) | — | A missing-items list (description + amount, add/remove) |

## Needs no change (verified)
All money totals (`calculations/assessment.ts`, IMT-23, salvage basis,
estimate floor, the UIIC portal summary, and the IRDAI fee summary, whose fee
is based on the assessed loss so K.O. is excluded, which is correct), the CTL
banner (it stays on the firm figure), and the preamble (it uses the estimate
total, which never filtered on `allowed`). `SurveyReportDocument.tsx` is
unused and is left alone. SurveyOS Scan and the portal-fill extension: no
impact.

## Lifecycle
After dismantling, the surveyor opens the Assessment tab and ticks ✓ (then
enters the assessed figure) or ✕. A reprint of the Final report then shows
the decided figures.

## Calls made by the designer (owner to check)
- K.O. applies to any row: parts, labour or paint (owner agreed).
- The Assessment Summary line prints on any claim with K.O. rows, total loss
  or not.
- A disposal flag on a K.O. row is ignored, so the K.O. amount is the plain
  quote incl. GST.
- Bill Check reads the K.O. mark but never changes it. It is decided only in
  the Assessment tab.
- `SurveyReportDocument.tsx` (unused) is left alone.

## Left to the builder
The button's look and icon, the exact amber token, the wording of the banner,
and the function and file names.
