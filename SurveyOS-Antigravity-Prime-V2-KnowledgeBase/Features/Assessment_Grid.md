# Assessment Grid

## Current Implementation

- **What it does:** Interactive data grid for managing insurance claim assessment rows (spare parts, labour, painting). Supports drag-and-drop reordering, column visibility toggling, deduction category tagging, cell editing, and Excel-style Ctrl+V paste from clipboard.
- **Key files:**
  - `src/components/claim/AssessmentGrid.tsx` — Main grid component with 10+ optional columns (Part No, HSN/SAC, Type, Qty, Unit Price, GST, Disposal, Action, Remarks, Price+GST), dnd-kit drag reordering, cell selection, paste support
  - `src/stores/slices/assessmentSlice.ts` — Zustand slice for CRUD on assessment rows; auto-calculates estimated/assessed amounts on unitPrice/quantity changes
  - `src/lib/utils/grid-paste.ts` — Clipboard paste utility (`parseClipboardValue`, `buildPasteUpdates`)
  - `src/lib/calculations/assessment.ts` — IRDAI-compliant assessment calculations
  - `src/lib/calculations/depreciation.ts` — Age-based metal depreciation scale
  - `src/lib/calculations/gst.ts` — GST calculation (CGST+SGST = 18%)
- **Dependencies:** dnd-kit (drag/drop), Zustand, IRDAI calculation engine

## Known Issues / What Went Wrong

- CGST+SGST confusion: prompt initially extracted single GST rate instead of sum (fixed 2026-05-17, 9+9=18%)
- Grid navigation race condition when drag-reordering was restored (fixed 2026-05-12)

## Improvement Ideas

- Inline validation for assessment amounts
- Bulk import from Excel spreadsheet (beyond paste)
- Undo/redo support for grid edits

## Technical Debt

- Grid component is large — could benefit from extracting column renderers into separate files
- Smart remarks cell integration documented but split across components

## Related

- [[AI_Extraction]] — AI fills assessment rows from uploaded documents
- [[PDF_Reports]] — Assessment data flows into all report formats
