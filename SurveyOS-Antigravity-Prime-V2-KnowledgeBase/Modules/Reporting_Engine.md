# Reporting Engine Module

SurveyOS Prime V2 houses a twin-engine approach to report generation.

## Power Print / HTML Reports
- React components construct "Pixel-Perfect" representations of final PDF files inside standard DOM layouts.
- Rendered natively across the browser for printing to PDF safely.
- [[Sequential_Numbering]] mechanisms assign report numbers locally.

## Excel Bridges
Instead of building standard PDFs for all Insurance Companies, specific legacy clients (like UIIC) mandate deep Excel automation.
- `UIICExcelBuilder.ts`: Employs `exceljs` to generate highly-formatted merged-cell reports.
- Data structures from the active Claim model map directly to specific cell coordinates for automated generation.
