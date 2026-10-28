# Design: Bill Check Cross-Reference Serial Numbers

**Date:** 2026-10-27  
**Status:** Approved  
**Author:** Niraj Patil (Owner) & Antigravity  

---

## 1. Problem & Context

Motor insurance claims are processed across insurers in India following two distinct documentation models:

1. **Standard / NIA Workflow (Estimate-First):**
   * The surveyor starts from the workshop's initial estimate, allows/disallows parts, and calculates assessment loss.
   * At Bill Check, the workshop's final tax invoice/bill is uploaded to verify which items were actually replaced/billed.
   * Primary serial numbers follow the **Estimate**.
   * Insurers require seeing where each part is situated in the garage bill via a cross-reference serial number.

2. **UIIC Workflow (Bill-First):**
   * For United India Insurance (UIIC), reports are commonly drawn directly from the **Final Invoice / Bill** rather than the estimate.
   * Primary serial numbers follow the **Final Invoice / Bill**.
   * The surveyor cross-checks whether that item was originally claimed in the estimate.
   * Insurers require seeing which estimate item number corresponds to each billed row.

Currently, SurveyOS does not provide cross-reference serial numbers in the Bill Check reports, forcing surveyors to manually look up and write cross-references by hand.

---

## 2. Goals & Non-Goals

### Goals
* Automatically track both `srNo` (primary) and `refSrNo` (cross-reference).
* Support both workflows seamlessly without requiring manual configuration.
* Render the reference serial number as the **last column** in red italic font in both UIIC and Standard Bill Check reports (HTML, PDF, Word).
* Allow the column header to default contextually (`Bill Item No.` vs `Est. Item No.`), while remaining fully editable by the surveyor.
* Enable rapid, fatigue-free review for claims up to **400 lines** via inline editing and quick-filter / jump navigation.
* Zero extra paid AI costs — utilize existing deterministic matching.

### Non-Goals
* Modifying the Final Survey Report layout (applies strictly to Bill Check view and Bill Check reports).
* Auto-committing questionable matches without surveyor review.
* Automatic re-ordering of primary rows during matching.

---

## 3. Workflow Detection (Upload Order)

Workflow determination is derived purely from upload sequence without adding modal questions or configuration toggles:

* **Estimate Uploaded First (`baseDocument: 'estimate'`):**
  * Primary `srNo` = Estimate serial.
  * Default column header = `Bill Item No.`
  * Reference column displays matching Final Bill serial numbers.
* **Final Bill Uploaded First (`baseDocument: 'final-bill'`):**
  * Primary `srNo` = Final Bill serial.
  * Default column header = `Est. Item No.`
  * Reference column displays matching Estimate serial numbers.

The surveyor may click the column header in the Bill Check tab at any time to edit the title to their insurer's exact wording preference (stored in `claim.billCheck.refColumnTitle`).

---

## 4. Data Model Changes

In `src/types/assessment.ts`:
```typescript
export interface AssessmentRow {
  // ... existing fields ...

  /** Cross-reference serial number in comparison document */
  refSrNo?: number | string;

  /** Match confidence indicator: 'clean' | 'ambiguous' | 'manual' */
  refStatus?: 'clean' | 'ambiguous' | 'manual';
}

export interface BillCheckDetails {
  // ... existing fields ...
  baseDocument?: 'estimate' | 'final-bill';
  refColumnTitle?: string;
}
```

---

## 5. Screen UI & 400-Line Scale Navigation

In `src/components/tabs/BillCheckTab.tsx` and the Bill Check grid:

### 1. Far-Right Editable Column
* Header displays `refColumnTitle || (baseDocument === 'final-bill' ? 'Est. Item No.' : 'Bill Item No.')` with an inline edit pencil icon.
* Cells display `r.refSrNo` in red italic text.
* Cells are directly editable: clicking allows typing/correcting the serial number immediately.

### 2. Quick-Filter & Navigation Banner
Positioned directly above the grid:
```text
[ All Rows (384) ]  |  [ ⚠️ Review Matches (14) ]  |  [ ❓ Unmatched (6) ]  |  [ < Prev ] [ Next > ]
```
* **Filter to Review Matches:** Isolates only ambiguous matches (multiple candidates or description mismatches) for quick verification.
* **Filter to Unmatched:** Isolates parts that had no detected reference in the secondary document.
* **Jump Navigation:** `< Prev` / `Next >` focuses the next questionable row in-place within the full grid.

---

## 6. Report & Word Export Layout

The reference number is placed as the **last column** on the far right of the item table.

### 1. Standard Bill Check Report (`standard-report-builder.ts`)
* Position: Far-right column (after `Price+GST ₹` and IMT-23 mark).
* Width: **4.5%** allocated to Reference column.
* Description adjustment: `Particulars` column adjusted from 26% to 21.5% (or 17.5% to 13% when fiberglass is present).
* Currency columns: 100% preserved. Six-figure currency figures with paise will **never wrap**.
* Styling:
  ```html
  <td style="color:#d32f2f; font-style:italic; font-weight:600; text-align:center;">14</td>
  ```

### 2. UIIC Bill Check Report (`uiic-final-builder.ts`)
* Position: 13th column on the far right (after `Labour` and `Paint`).
* Width: **4.5%** allocated to Reference column.
* Description adjustment: `Description` column reduced from 18% to 14.5%.
* Subtotals & tax bands: Retain empty `<td style="..."></td>` to maintain clean table structure.
* Styling: Center-aligned, `#d32f2f` red color, italic.

### 3. Word (`.docx`) Export (`word-export.ts`)
* Appends cell to the rightmost edge of each row.
* Applies red color `#D32F2F`, italicized font, center-aligned.

---

## 7. Decision Log

| Decision | Alternatives Considered | Rationale |
|---|---|---|
| **Workflow Detection:** Automatic by upload order | Insurer-specific auto switch; manual screen toggle | Natural surveyor habit; zero cognitive overhead or extra clicks. |
| **Column Header:** Context-aware + editable | Fixed generic "Ref No." | Smart default for UIIC vs Standard, but 100% flexible for any insurer. |
| **400-Line Scale Review:** Inline grid with filter/jump banner | Modal dialog comparing 400 rows | Prevents review fatigue and UI lag; surveyor audits only the ~5% questionable items. |
| **Column Placement:** Last column on far right | Second column next to `Sr.` | Natural audit flow `[Particulars] → [Financials] → [Audit Reference]`; preserves currency column widths. |
| **Styling:** Red italic | Plain black text | Instantly distinguishes comparison references from primary row numbers. |

---

## 8. Prime ↔ Scan Impact
* **SurveyOS Scan impact: None.** Scan deals with field notes and captures. Bill check cross-referencing is strictly an in-office reporting feature in Prime.
