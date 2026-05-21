# Design: Excel-Style Column Paste for AssessmentGrid

**Date:** 2026-05-16
**Status:** Approved

---

## Problem

Two issues in the AssessmentGrid:

1. **No bulk cell edit:** Surveyors must manually edit the same value (e.g. GST 18%) into every row one at a time. There is no way to select a range in a column and paste a value across all rows simultaneously.

2. **CGST+SGST AI extraction bug:** When a bill shows CGST 9% + SGST 9%, the AI bill extractor writes `9` to the `gst` field instead of summing them to `18`. This causes all downstream calculations and PDF figures to use the wrong rate.

---

## Goal

Allow surveyors to select a range of cells in any column of the AssessmentGrid and press Ctrl+V to paste the same value into every selected cell — exactly like filling a column in Excel. Also fix the CGST+SGST extraction bug as a bundled prompt change.

---

## Scope

**In scope:**
- Cell range selection within a single column (click to anchor, Shift+click or Shift+Arrow to extend)
- Ctrl+V paste to selected range
- Blue ring visual on selected cells
- Escape to clear selection
- All editable columns except SmartRemarksCell
- CGST+SGST prompt fix

**Out of scope:**
- Multi-column paste (selecting across columns)
- Ctrl+C to copy a range (read direction only)
- Fill-down (Ctrl+D) — Ctrl+V covers this case
- SmartRemarksCell (deductionCategory + remarks — too complex for clipboard paste)

---

## Interaction Model

### Selection
| Action | Result |
|---|---|
| Click a cell | Anchors selection to that cell; clears any prior selection |
| Shift+click same column | Extends selection from anchor to clicked cell |
| Shift+click different column | Starts new selection in the new column |
| Shift+Arrow Up/Down | Extends selection in same column (uses existing `handleGridNavigation`) |
| Escape | Clears selection |
| Click outside grid | Clears selection |

Selection is **column-scoped** — a selection always belongs to exactly one column. The anchor row and focus row define the range; all rows between them (inclusive, in display order) are selected.

### Paste
- **Ctrl+V** with an active selection → reads clipboard → parses value for the column's type → applies to every row in the selected range
- **Ctrl+V** with no selection → behaves normally (browser default paste into the focused input)

### Skip rules (paste silently skips these rows)
| Column | Skip condition |
|---|---|
| `gst` | Row has `isDisposal === true` (GST is always 0 for used parts) |
| `depOverride` | Row has `!row.allowed` or `row.section !== 'parts'` |
| All enum columns (`partType`, `action`) | Clipboard value is not a valid enum member |

### Value parsing by column type
| Type | Columns | Parse rule |
|---|---|---|
| Number | `gst`, `assessed`, `estimated`, `quantity`, `unitPrice`, `depOverride`, `disposalPercent` | `parseFloat(text)` — skip if `NaN` |
| String | `particulars`, `partNumber`, `hsnSac` | Raw trimmed string |
| Enum | `partType`, `action` | Accept only valid enum values; skip row if value not recognised |
| Boolean | `isDisposal` | `"true"` / `"1"` / `"yes"` → `true`; `"false"` / `"0"` / `"no"` → `false`; else skip |
| SmartRemarksCell | `deductionCategory`, `remarks` | **Out of scope** |

### Visual feedback
- Selected `<td>` cells receive `ring-2 ring-blue-400 ring-inset` CSS classes
- The range stays highlighted until Escape or a new click elsewhere in the grid
- The focused input inside the cell retains its own focus ring independently

---

## Architecture

### New file: `src/lib/utils/grid-paste.ts`

Pure utility module. No React, no store access — fully unit-testable.

```typescript
export function parseClipboardValue(
  text: string,
  columnKey: keyof AssessmentRow,
): unknown | null   // returns null if value should be skipped

export function buildPasteUpdates(
  rows: AssessmentRow[],
  anchorRowId: string,
  focusRowId: string,
  columnKey: keyof AssessmentRow,
  parsedValue: unknown,
): Record<string, Partial<AssessmentRow>>
// keys are rowIds, values are the { columnKey: parsedValue } update to apply
// skip rules are applied inside here — skipped rows are absent from the result
```

`buildPasteUpdates` derives the row range by finding the indices of `anchorRowId` and `focusRowId` in the `rows` array, then iterates every row between them (inclusive) applying skip rules.

### Modified: `AssessmentGrid.tsx`

**State addition (1 line):**
```typescript
const [cellSelection, setCellSelection] = useState<{
  columnKey: string;
  anchorRowId: string;
  focusRowId: string;
} | null>(null);
```

**Cell attributes — every `<td>` gets:**
```tsx
data-row-id={row.id}
data-column-key="gst"   // the column's key string
```
This lets the `<tbody>` event handler identify which cell was interacted with via `event.target.closest('td')?.dataset`.

**`<tbody>` additions:**
- Extend existing `onKeyDown={handleGridNavigation}` — add Ctrl+V branch that calls `buildPasteUpdates` and dispatches `updateAssessmentRow` for each result entry
- Add `onMouseDown={handleCellMouseDown}` — reads `data-row-id` / `data-column-key` from the clicked `<td>`, updates `cellSelection` (anchor on plain click, extend focus on Shift+click)

**Visual (per `<td>`):**
```typescript
function isCellSelected(rowId: string, columnKey: string): boolean
// returns true if this cell falls within the current cellSelection range
```
Used to conditionally add `ring-2 ring-blue-400 ring-inset` to the `<td>` className.

**No changes to:** `updateAssessmentRow`, Zustand store, row checkbox selection, Shift+Arrow navigation (focus movement already works — Ctrl+V branch is additive).

### Modified: `src/lib/ai/prompts.ts` — CGST+SGST fix

In the bill extraction prompt (both `estimate` and `final-bill` variants), add one clarifying line:

> `"gst_percent": total GST rate for this line — sum ALL GST components (CGST rate + SGST rate + IGST rate). Example: CGST 9% + SGST 9% = 18, not 9. Never write just one component.`

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/utils/grid-paste.ts` | NEW — ~70 lines, pure utility |
| `src/components/claim/AssessmentGrid.tsx` | MODIFY — state, data attributes, mousedown handler, Ctrl+V branch, cell highlight |
| `src/lib/ai/prompts.ts` | MODIFY — one-line clarification in bill extraction prompt |
| `src/lib/utils/__tests__/grid-paste.test.ts` | NEW — unit tests for parseClipboardValue and buildPasteUpdates |

---

## Verification Checklist

1. Open a claim → Assessment tab → click a cell in the GST% column → blue ring appears
2. Shift+click a cell 5 rows lower in the same column → all 5 cells highlighted
3. Copy "18" to clipboard → Ctrl+V → all 5 rows now show GST 18%
4. Disposal rows in the range are skipped (gst stays 0)
5. Shift+click a cell in a different column → selection resets to new column
6. Escape → selection cleared, no highlight
7. Repeat for a string column (particulars) and an enum column (action)
8. Upload a bill with CGST 9% + SGST 9% → extracted gst% = 18, not 9
