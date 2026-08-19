# Design: Bill Check Screen &amp; Report Corrections

**Date:** 2026-08-18
**Status:** Draft — awaiting review

---

## Problem

Seven defects reported by the surveyor, all verified against the code. Six are mechanical. One — the Assessed cell fighting the surveyor as he types — can write a wrong figure into a report already filed with the insurer.

They share a theme: **the Bill Check screen and the Bill Check report disagree about what is true.** The report was corrected over the preceding sessions; the screen was not brought with it.

The flagging work (telling the surveyor *which* rows need attention) is deliberately **not** here. It is its own spec.

---

## Goal

Make the Bill Check screen state the same figures the report prints, stop the Assessed cell committing half-typed numbers, and correct four report defects. No new judgement is asked of the surveyor — everything here either fixes a wrong number or removes a distraction.

---

## Scope

**In scope:**
1. Screen recalculates Net and Price+GST from the bill-check basis
2. Assessed cell commits on blur, not on keystroke; scope dialog gains an editable amount
3. Disallowed rows leave the Bill Check grid
4. Standard Bill Check serials come from the assessment sheet
5. `No Bill` replaces `0.00` where the workshop billed nothing
6. UIIC Final Report `Dep%` column widened to hold `12.5%*`
7. Evidence viewer acknowledges a file it cannot render

**Out of scope:**
- **Flagging billed-vs-assessed divergence.** Its own spec — three-way estimate/assessed/billed diagnosis, attention banners, invoice-total reconciliation, block-versus-advise tiers.
- Anything reading `billStatus: 'partial'`, which today changes no arithmetic.
- Billed GST rate, billed quantity, repair-versus-replace mismatch.

---

## 1. Screen recalculates from the bill-check basis

**The defect.** The Assessed cell writes `billAllowed` ([BillCheckGrid.tsx:425](../../src/components/tabs/bill-check/BillCheckGrid.tsx)), but the Net and Price+GST cells beside it call `computeRowNet(row, …)` ([:439](../../src/components/tabs/bill-check/BillCheckGrid.tsx)), and `computeRowNet` reads `row.assessed` ([row-net.ts:17](../../src/lib/calculations/row-net.ts)). So the figure the surveyor just typed is ignored by the two cells that should follow it.

The report is correct: `projectForBillCheck` substitutes `assessed: r.billAllowed ?? r.assessed` before any money is computed. **The logic exists once and the screen does not use it.**

**The fix.** Export the substitution as a named function and have both callers use it:

```ts
/** The assessed figure this document works from — the surveyor's bill-check
 *  allowance where one was recorded, otherwise the final-survey figure. */
export function billCheckAssessed(r: AssessmentRow): number {
  return r.billStatus === 'not-in-bill' ? 0 : (r.billAllowed ?? r.assessed);
}
```

`projectForBillCheck` calls it. The grid computes `computeRowNet({ ...row, assessed: billCheckAssessed(row) }, dep)` for Dep%, Net and Price+GST. One definition, so screen and report cannot drift apart again — the same guard the shared `grid-columns` module gives the two grids.

The grid must **not** adopt the full projection: that also sets `estimated: billedTaxable`, and on screen the Estimate column has to keep showing the estimate.

---

## 2. The Assessed cell stops committing half-typed numbers

**The defect**, as reported: a cell reading `950`, one backspace, and the scope dialog opens quoting `95`. Choosing *Both reports* writes `assessed = 95` — into the Final Survey Report already filed.

Three faults compound:

| Fault | Consequence |
|---|---|
| `onChange` commits every keystroke ([:426](../../src/components/tabs/bill-check/BillCheckGrid.tsx)) | Dialog fires mid-edit |
| Input is controlled from the store, but the store write is gated behind the modal | The field cannot move while the dialog is open — it shows the old value while the dialog quotes another |
| `Number('') \|\| 0` | Clearing the field proposes **₹0** |

**The fix — trigger.** The cell holds a local draft while typing and commits on **blur or Enter**; **Escape** reverts to the stored value. The dialog can then only ever see a number the surveyor finished typing. Extracted as `AllowanceInput`, since `BillCheckGrid.tsx` is already ~590 lines and this is self-contained.

**The fix — recovery.** `AllowanceScopeDialog` gains an editable amount field, pre-filled with the proposed figure. If it opens on a number the surveyor did not intend, he corrects it there rather than cancelling and retyping. Fixing the trigger stops it firing wrongly; the editable field makes a wrong trigger survivable.

**Also.** An empty Billed Taxable field writes `undefined`, not `0`. `0` means *the workshop billed nothing*; `undefined` means *not checked yet*, and the print gate runs on that distinction.

---

## 3. Disallowed rows leave the grid

Rows rejected at final survey are already excluded from every Bill Check report. On screen they are still rendered greyed and struck through ([:385](../../src/components/tabs/bill-check/BillCheckGrid.tsx)), so the surveyor scrolls past rows that can never carry money.

`sectionRows` ([:346](../../src/components/tabs/bill-check/BillCheckGrid.tsx)) filters on `allowed`. A section left with no rows renders nothing, as it already does when empty.

Serial numbers are unaffected: `buildSerialMap` counts across all rows, so the gaps stay visible on screen exactly as they print — the surveyor sees 1, 4, 5 and knows 2 and 3 were rejected.

No per-section footer. The grid header already reads `12 items · 10 allowed`, which states the count once; the serial gaps show where the missing rows sat. A second line repeating it was drafted and cut as clutter.

---

## 4. Standard Bill Check serials come from the assessment sheet

The UIIC reports number with `buildSerialMap`, which counts across **all** rows including rejected ones, so a gap tells the insurer an item was refused.

The Standard Bill Check numbers with `psn++` / `sn++` over rows already filtered by `allowed` ([standard-report-builder.ts:224](../../src/lib/reports/standard-report-builder.ts), [:271](../../src/lib/reports/standard-report-builder.ts)). It therefore renumbers 1…n and cannot be tallied line-for-line against the Final Survey Report — the defect the surveyor reported.

Replace both counters with a `buildSerialMap` lookup over the unfiltered projected rows. **Final mode is unaffected**: with nothing filtered, `psn++` and `buildSerialMap` produce identical numbering, so this changes the Bill Check only.

---

## 5. `No Bill` replaces `0.00`

A row marked not-in-bill projects to `assessed: 0`, so the report prints `0.00` across the money columns — indistinguishable from an item genuinely worth nothing. The surveyor wants the insurer to see that **no bill was provided**.

`projectForBillCheck` spreads `...r`, so `billStatus` survives into the builder. Where it reads `not-in-bill`, the money columns print `No Bill` instead of a figure. Totals are unchanged — the row already contributes zero.

**Applies to both reports**, and in doing so settles an older defect. UIIC Bill Check filters on `allowed` only and never checks `not-in-bill` ([uiic-final-builder.ts:520](../../src/lib/reports/uiic-final-builder.ts)), so the row prints its **full** money in the item table while `calculateBillCheckSummary` excludes it from the total. The two disagree, with nothing on the page explaining the gap. Printing `No Bill` makes the table foot to the figure page 1 already reports. This was raised at the start of the Standard Bill Check work and scoped out then.

**What is deliberately not built.** A variant was mocked that also prints the assessed figure in brackets and totals it in a closing *"assessed but not billed"* line, showing the insurer what the missing bill saved them. The surveyor asked for a `No Bill` comment, not a savings summary, so this spec implements the comment. The bracketed variant is a per-row change plus one summary row, available on request.

---

## 6. UIIC Final Report `Dep%` column widened

Paint at 12.5% depreciation must be a manual override — `getDepreciationRate` returns 0 for paint — so the cell always renders the override marker: `12.5%*`.

Measured against the 186mm printable width (A4 less 12mm margins): at `width:5%` the cell offers **19.4pt** of text room and `12.5%*` needs **21.8pt**. It wraps, making the row two lines tall. That is the extra line the surveyor reported.

`Dep%` goes 5% → 7% (30.1pt of room), taken from `Part Name` 18% → 16%. Widths still sum to 100 under `table-layout:fixed`, so the table stays exactly 186mm and cannot overflow.

UIIC Bill Check needs no change: its `Part Depreciation` column is 8%, giving 35.2pt.

---

## 7. Evidence viewer acknowledges every file

The viewer renders PDFs in an `<iframe>` and images in an `<img>`, and ends `: null` ([DocumentEvidenceViewer.tsx:229](../../src/components/evidence/DocumentEvidenceViewer.tsx)). Anything else — a `.docx`, a `.heic`, a file whose MIME type arrived empty — renders as **nothing at all**. The surveyor uploaded a document and the viewer shows blank space, with no indication a file is there.

`: null` becomes a card naming the file and offering to open it: filename, type (or *"type not recognised"*), size, and **Open in new tab** on the existing blob URL.

`blobEntries` currently carries only `{ url, mimeType }` ([:68](../../src/components/evidence/DocumentEvidenceViewer.tsx)). It is built from `File` objects, which already hold `.name` and `.size`, so both are added there.

The surveyor can then verify against the document in whatever application does open it, which is what he asked for — the viewer stops pretending the file does not exist.

---

## Testing

`bill-check-projection.test.ts` — extend:
1. `billCheckAssessed` returns `billAllowed` when set, `assessed` when not, `0` for not-in-bill
2. `projectForBillCheck` still passes every existing case, now routed through the shared function

New `bill-check-screen-basis.test.ts`:
3. A row with `assessed: 1000, billAllowed: 700` yields the same Net from the grid's basis as `projectForBillCheck` gives the report — the guard against the two drifting again

`standard-bill-check.test.ts` — extend:
4. With a disallowed row between two allowed ones, Bill Check serials read 1 and 3, not 1 and 2
5. Final mode numbering is byte-identical before and after the `buildSerialMap` switch
6. A not-in-bill row prints `No Bill`, not `0.00`, and totals are unchanged

New `uiic-no-bill.test.ts`:
7. UIIC Bill Check prints `No Bill` for a not-in-bill row, and its item-table subtotal equals the page-1 Total Billed figure — the guard for the older disagreement

`uiic-labour-column.test.ts` — extend:
8. `Dep%` is 7% and the twelve widths still sum to 100

Not covered by unit tests, verified by inspection: the draft-commit behaviour of `AllowanceInput` and the evidence-viewer fallback card, both being interaction rather than output. `AllowanceInput`'s commit rule is small enough to test directly if it grows a second condition.

---

## Risks

- **The `buildSerialMap` switch touches the Final Survey Report's code path** even though it must not change its output. Test 5 exists solely to prove that; if it fails, the switch is wrong rather than the test.
- **`billCheckAssessed` returns 0 for not-in-bill**, so a row the surveyor marks not-in-bill immediately shows zero Net on screen. That is correct and matches the report, but it is a visible change to a screen the surveyor knows.
- **Changing the Billed Taxable empty case from `0` to `undefined`** alters what the print gate considers checked. A row cleared to empty becomes *pending* again rather than *billed zero* — which is the intent, but it will start blocking prints that previously went through.
- **Not verifiable here.** The Bill Check screen is auth-gated and needs real claim data; correctness rests on the unit tests above and on the surveyor exercising the grid.
