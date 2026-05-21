# PDF Reports

## Current Implementation

- **What it does:** Twin-engine report generation system. "Power Print" uses React components for pixel-perfect HTML-to-PDF rendering. "Excel Bridges" use exceljs for legacy UIIC template injection. Supports 5 report types: Final Survey (UIIC + Standard), Spot, Reinspection, Valuation, and Fee Bill.
- **Key files:**
  - **Report Builders (HTML):**
    - `src/lib/reports/uiic-final-builder.ts` — UIIC final survey HTML
    - `src/lib/reports/uiic-html-builder.ts` — UIIC HTML builder utilities
    - `src/lib/reports/standard-report-builder.ts` — Standard final survey HTML
    - `src/lib/reports/spot-fee-bill-builder.ts` — Spot report + fee bill HTML
    - `src/lib/reports/reinspection-report-builder.ts` — Reinspection HTML
    - `src/lib/reports/valuation-report-builder.ts` — Valuation/break-in HTML
    - `src/lib/reports/irdai-summary-builder.ts` — IRDAI summary HTML
    - `src/lib/reports/word-builder.ts` — Word document export
  - **Report Utilities:**
    - `src/lib/reports/report-utils.ts` — Shared report helpers
    - `src/lib/reports/report-style-utils.ts` — Shared CSS/style utilities
  - **React-PDF Components:**
    - `src/components/pdf/BillCheckDocument.tsx`
    - `src/components/pdf/ValuationReportDocument.tsx`
    - `src/components/pdf/FeeBillDocument.tsx`
    - `src/components/pdf/PhotoSheetDocument.tsx`
    - `src/components/pdf/SpotReportDocument.tsx`
    - `src/components/pdf/SurveyReportDocument.tsx`
  - **Print Components:**
    - `src/components/print/UIICPrintReport.tsx`
    - `src/components/print/SpotPrintReport.tsx`
  - **Excel Bridge:**
    - `src/lib/reports/uiic-excel-builder.ts` — exceljs template injection for UIIC
- **Dependencies:** @react-pdf/renderer, docx, exceljs, DOMPurify, react-to-print

## Known Issues / What Went Wrong

- All 3 spot report formats must stay identical (SpotPrintReport.tsx is source of truth)
- Only spot reports have parity enforcement across 4 renderers (UIIC, Standard, Word, PDF)
- DL expiry was auto-injecting into reports (fixed 2026-05-12 — now UI-only warning)
- GVW/RLW field regression in SpotPrintReport (fixed 2026-05-12)

## Improvement Ideas

- Parity enforcement for all report types (not just spot)
- Report template customization per insurer
- Batch report generation for multiple claims
- Report versioning / audit trail

## Technical Debt

- 11 files in `src/lib/reports/` — common builder patterns could be extracted to a base utility
- Report builders have duplicated header/footer logic
- Sequential numbering stored in localStorage only (not synced)

## Related

- [[Assessment_Grid]] — Assessment data feeds into all reports
- [[Cloud_Sync]] — Generated reports uploaded to Drive
- `Patterns/Sequential_Numbering.md` — Report numbering scheme
