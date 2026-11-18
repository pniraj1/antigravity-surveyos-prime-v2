# Implementation Plan: Documents Tab Reconciliation Dock, Vehicle-First Naming, Transparent Auto-Save & PDF Page Breaks

- **Date:** 2026-11-18
- **Goal:**
  1. Solve the Documents Tab workflow disconnect by adding a sticky/floating Reconciliation Action Dock that remains visible even when surveyors scroll down through document upload slots.
  2. Switch Google Drive folders and generated deliverable file naming to Vehicle-First (`MH12AB1234_Final_Survey_Report_FINAL-001.pdf`).
  3. Make Report, Photo Sheet, and Survey Fee Bill auto-saving and prompts clear, direct, and transparent (ensure direct download on click, and clarify the post-print folder filing prompt).
  4. Implement physical A4 multi-page previews and visual page break guides in `ReportTab.tsx` so surveyors can see exactly where pages end before printing.
- **Rules Followed:** `using-superpowers`, `writing-plans`, `subagent-driven-development`. Main branch only. Zero impact on SurveyOS Scan.

---

## 1. Problem Statement & User Feedback

1. **Reconciliation Hub Disconnect on Documents Tab:**
   - In `src/components/tabs/DocumentsTab.tsx`, the reconciliation banner and manual launch button sit at the top of the tab (`lines 307–348`).
   - When uploading documents (RC, DL, Policy, Claim Form, FIR, Repair Estimate, Bills), the surveyor scrolls far down through the card grid (`DOC_GROUPS`).
   - If AI data extraction finds conflicting values (e.g., Engine No or Policy No differs across documents), the alert is scrolled off-screen at the top. The surveyor has to repeatedly scroll up to find the hub.
2. **Drive & Deliverable Naming Omits Vehicle Registration:**
   - In `src/lib/drive/index.ts:683`, `performClaimBackup` used `label = claim.reportNo?.trim() || claim.id`, creating Drive folders like `FINAL-001_abc123` instead of using the vehicle registration number.
   - In `src/lib/reports/auto-file-report.ts`, filenames (`finalSurveyFileName`, `reinspectionFileName`, `uiicFinalFileName`, `spotFeeBillFileName`, `valuationFileName`, `billCheckFileName`) omitted the vehicle registration number, generating generic names like `Final_Survey_Report_FINAL-001.html`.
3. **Report, Photo Sheet & Fee Bill Auto-Save & Cryptic Prompt:**
   - In `PhotoSheetDownloadButton.tsx`, single-part download only invoked `saveReportToClaimFolder`, but omitted `triggerBlobDownload(blob, defaultFileName)`, causing silent failure to download if no directory handle was attached.
   - In `src/lib/documents/print-followup.ts`, after printing, a cryptic toast asked: `"Saved the Final Survey Report as a PDF? Save it into the claim folder, then file it here..."` with button `"File the PDF"`. Surveyors cannot understand where the system is asking it to be saved or what "file it here" means.
   - In `FeesTab.tsx`, there was only `PRINT PDF — FEE BILL` with no direct download or clear filing status.
4. **PDF / Report Preview Page Breaks:**
   - In `src/components/tabs/ReportTab.tsx`, reports render inside a single continuous `div` with `minHeight: 297mm`.
   - On multi-page reports (UIIC, standard 2–3 page reports), content flows endlessly without any visual indication of where page 1 ends and page 2 starts, blinding surveyors to accidental table row splits, widowed signatures, or orphan declarations.

---

## 2. Proposed Architecture & Solutions

### A. Documents Tab Sticky Reconciliation Dock (`DocumentsTab.tsx`)
- Render a fixed bottom floating dock / pill when `conflicts.length > 0`:
  - Visual: High-contrast amber badge with alert icon, conflict count, and action:
    `[ ⚠️ {conflicts.length} Data Discrepancies Detected across uploaded documents ] [ Resolve Conflicts in Hub → ]`
  - Subtle pulse animation to draw attention without being intrusive.
  - When `conflicts.length === 0` and `scannedCount > 1`, show a compact floating pill:
    `[ 🔄 Reconciliation Hub ({scannedCount} docs scanned) ]`
  - Keeps the top banner for instant visibility when at the top, while the sticky dock ensures surveyors never miss conflicts while uploading files down the page.

### B. Vehicle-First Folder & File Naming
- In `src/lib/reports/auto-file-report.ts`:
  - Export `sanitizeRegNo(no?: string): string` which uppercase-normalizes and strips illegal filesystem characters.
  - Update all report naming helpers to prepend the vehicle registration number:
    - `finalSurveyFileName`: `${reg ? `${reg}_` : ''}Final_Survey_Report_${reportNo}.${ext}`
    - `reinspectionFileName`: `${reg ? `${reg}_` : ''}Reinspection_Report_${reportNo}.${ext}`
    - `uiicFinalFileName`: `${reg ? `${reg}_` : ''}UIIC_Final_Survey_Report_${reportNo}.${ext}`
    - `spotFeeBillFileName`: `${reg ? `${reg}_` : ''}Spot_Fee_Bill_${reportNo}.${ext}`
    - `valuationFileName`: `${reg ? `${reg}_` : ''}Valuation_Report_${reportNo}.${ext}`
    - `billCheckFileName`: `${reg ? `${reg}_` : ''}Bill_Check_${reportNo}.${ext}`
- In `src/lib/drive/index.ts`:
  - In `performClaimBackup`:
    ```ts
    const regNo = sanitizeRegNo(claim.vehicle?.registrationNumber);
    const label = regNo || claim.reportNo?.trim() || claim.id;
    ```
    This ensures Google Drive folders are named `MH12AB1234_abc123` or `MH12AB1234` primarily.

### C. Transparent Auto-Save & Direct Storage Prompt
- In `src/components/pdf/PhotoSheetDownloadButton.tsx`:
  - When the surveyor clicks "Download PDF", call `triggerBlobDownload(blob, defaultFileName)` AND `saveReportToClaimFolder`.
  - Show a clear toast: `toast.success(`Photo Sheet downloaded: ${defaultFileName}`);`
- In `src/lib/documents/print-followup.ts`:
  - Update toast copy to be crystal clear:
    - Title: `Save printed PDF to vehicle folder (${regNo})`
    - Description: `Downloaded or saved the PDF from Chrome's print dialog? Pick it here to file it into this vehicle's folder.`
    - Action button: `[ Select & Save PDF to Folder ]`
    - If no claim folder is connected, offer: `[ Connect Vehicle Folder ]` to guide the surveyor on connecting a folder.
- In `src/components/tabs/FeesTab.tsx`:
  - Provide direct HTML/PDF download alongside Print PDF and toast confirmation when saved.

### D. Multi-Page A4 Physical Page Breaks & Guides in `ReportTab.tsx`
- Split `reportHtml` by explicit page breaks (`<div style="page-break-before:\s*always;?"\s*><\/div>`) into discrete page sections.
- When multiple explicit pages exist (e.g. UIIC Final Report):
  - Render each page inside its own discrete A4 page card (`width: 210mm; min-height: 297mm; background: white; margin-bottom: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.15)`).
  - Add page badge above each card: `Page 1 of N`, `Page 2 of N`, etc.
- In addition, for single or multi-page cards that extend beyond `297mm`:
  - Calculate or render dynamic A4 cut-guides at `297mm` height intervals:
    `─── 📄 Page Break (End of Page X) ────── [ Page X+1 Starts ↓ ] ───`
  - Surveyors see exact physical page boundaries, avoiding orphaned signatures or cut-off tables.

---

## 3. Tasks Breakdown

### Task 1: Vehicle-First Folder & Deliverable File Naming
- **Files:**
  - `src/lib/reports/auto-file-report.ts`
  - `src/lib/drive/index.ts`
  - `src/lib/reports/__tests__/auto-file-report.test.ts`
- **Subagent Roles:**
  - Implementer: `Vehicle-First Naming Implementer`
  - Spec Reviewer: `Task 1 Spec Reviewer`
  - Code Quality Reviewer: `Task 1 Code Quality Reviewer`

### Task 2: Transparent PDF Auto-Save & Direct Storage Prompt
- **Files:**
  - `src/components/pdf/PhotoSheetDownloadButton.tsx`
  - `src/lib/documents/print-followup.ts`
  - `src/components/tabs/FeesTab.tsx`
  - `src/components/pdf/__tests__/PhotoSheetDownloadButton.test.tsx`
- **Subagent Roles:**
  - Implementer: `Direct Auto-Save & Prompt Implementer`
  - Spec Reviewer: `Task 2 Spec Reviewer`
  - Code Quality Reviewer: `Task 2 Code Quality Reviewer`

### Task 3: Multi-Page A4 Physical Page Breaks & Guides in Report Previews
- **Files:**
  - `src/components/tabs/ReportTab.tsx`
  - `src/components/tabs/__tests__/ReportTabPageBreaks.test.tsx`
- **Subagent Roles:**
  - Implementer: `Report Page Break Implementer`
  - Spec Reviewer: `Task 3 Spec Reviewer`
  - Code Quality Reviewer: `Task 3 Code Quality Reviewer`

### Task 4: Documents Tab Sticky Reconciliation Dock & Alignment
- **Files:**
  - `src/components/tabs/DocumentsTab.tsx`
  - `src/components/tabs/__tests__/DocumentsTabReconDock.test.tsx`
- **Subagent Roles:**
  - Implementer: `Documents Tab Dock Implementer`
  - Spec Reviewer: `Task 4 Spec Reviewer`
  - Code Quality Reviewer: `Task 4 Code Quality Reviewer`

### Task 5: Verification, Knowledge Base Sync & Production Deployment
- **Steps:**
  - Run full test suite (`npm test`).
  - Run full typecheck (`npx tsc --noEmit`).
  - Verify zero impact on SurveyOS Scan.
  - Update `Tasks.md`, `Changelog.md`, and create session log in `Sessions/`.
  - Build static export (`npm run build`).
  - Deploy to Firebase Hosting (`firebase deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in`).
