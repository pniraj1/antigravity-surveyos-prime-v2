# Session Log: 2026-11-05 (Antigravity) — Oriental Insurance (OIC) Assessment Excel & Portal Mapping

**Agent:** Antigravity  
**Goal:** Build OIC Assessment Excel export conforming to `9400ExcelOICL.xlsx` / official sample report and map the OIC Surveyor Portal (`https://orientalinsurance.org.in/surveyor-assessment-form`) in the SurveyOS Portal Fill Chrome extension.

---

## 1. What was accomplished

### A. OIC Assessment Excel Generator (`src/lib/reports/oic-assessment-excel.ts`)
- Implemented 2-sheet workbook (`Invoice` + `Items`) matching `9400ExcelOICL.xlsx`.
- Applied exact formula in Column K (`Total Amount With GST`):
  `=ROUND((E{row}-(E{row}*F{row}/100))*(G{row}/100),2)`
- Implemented **Statutory Painting Adapter**:
  - Maintained core architectural rule: **SurveyOS Final Survey Reports remain 100% pure and untouched**.
  - On export to OIC Excel, painting rows are cleanly converted:
    - **Nil Dep:** Consolidated `Labour Charge` line (`TOTAL PAINTING CHARGES`) at 0% dep.
    - **Standard (Normal):** Automatically split into 75% `Labour Charge` (0% dep) and 25% `Plastic` / Material (50% dep), perfectly matching the statutory 12.5% net deduction to the exact paisa.
- Configured Data Validations for dropdowns (`Item Description`, `Side Description`, `Depreciation Rate`, `GST Rate`, `Invoice GST Type`).
- Integrated with `saveOrDownloadReport` to auto-file directly into the claim's allocated local folder.

### B. OIC Export Dialog (`src/components/dialogs/OICExportDialog.tsx`)
- Bill-check verification gate ensuring claimed bill matching prior to export.
- Pre-filled Invoice Number and Bill Date from claim data with editable overrides.
- Invoice GST Type toggle (`CGST/SGST` vs `IGST`).
- Statutory painting translation preview chip explaining how painting charges are adapted.

### C. AssessmentGrid Integration
- Added indigo-themed `OIC Excel` export action button in `AssessmentGrid.tsx` toolbar.
- Registered `oicAssessmentExcel` in `src/types/documents.ts` (`DocType`, `DOC_TYPE_LABEL`).
- Added `'oic'` support in `readyLine` in `src/lib/portal/extension-bridge.ts`.

### D. OIC Portal Mapping & Chrome Extension Updates
- Created `scripts/portal-map/oic-assessment.overlay.json` mapping 25+ fields from Step 2 "Basic Details" (Registration Number, Make, Model, Policy No, Claim No, Dates, FIR Details, Underwriters, etc.).
- Compiled maps to `extension/maps/oic-assessment.json` and `public/portal-maps/oic-assessment.json`.
- Registered `https://orientalinsurance.org.in/*` in `extension/manifest.json`.
- Added OIC assessment flow support in `background.js` and `packet-validate.js`.
- Upgraded `extension/src/panel.js` and `extension/src/filler.js`:
  - Added CSS ID selector query support (`#id`).
  - Added HTML5 pushState URL path routing (`location.pathname`).
  - Added React Synthetic Event tracker triggering (`_valueTracker`) to notify React components of programmatic DOM updates.

### E. Scan Sibling Repo Contract Parity
- Updated `PrimeContract.kt` in `../SurveyOS Scan` with `OIC_ASSESSMENT_EXCEL` to prevent contract drift.
- Verified Scan unit tests pass with 0 failures (`:app:testDebugUnitTest`).

---

## 2. Verification
- **Vitest:** 278 passed test files, 2,491 passed tests (100% green).
- **Extension Tests:** 10 passed test files, 124 passed tests (100% green).
- **TypeScript:** `npx tsc --noEmit` exited 0 (clean).
- **SurveyOS Scan:** Gradle unit test run passed (`BUILD SUCCESSFUL`, 0 drift).

---

## 3. Commits on `main`
- `a978f83b` feat(reports): OIC assessment Excel workbook generator and statutory painting translation
- `8cc072c4` feat(ui): OIC assessment Excel export dialog with statutory painting translation
- `80ff2fc1` feat(claim): integrate OIC assessment Excel export button into AssessmentGrid toolbar
- `64a6101f` feat(portal): OIC portal assessment mapping and extension support
- `a903f39a` test(documents): update kit-types test for oicAssessmentExcel DocType
- `ebc9453` (in SurveyOS Scan) feat(contract): sync DocType with Prime for OIC Assessment Sheet (oicAssessmentExcel)
