# Session Log: 2026-11-20 Phone Scan & Claim Storage Workflow

**Agent:** Antigravity  
**Goal:** Streamline the motor insurance surveyor workflow from phone to PC. Eliminate the confusing 3-option modal, give surveyors explicit Choice 2 control over local vehicle folder allocation, present transparent Google Drive sync inspection with live timestamps and item counts without technical jargon, prevent duplicate photo numbering via SHA-256 content deduplication, and automatically file all generated reports and bills into the connected vehicle folder and Google Drive.

---

## 1. What was done

### Task 1: SHA-256 Content Deduplication for Multi-File Photos
- **Problem:** When importing photos or saving site pictures, saving the same image bytes multiple times created redundant numbered files (`Damage Photos 1.jpg`, `Damage Photos 2.jpg`, `Damage Photos 3.jpg`), inflating document lists and confusing report generation.
- **Solution:**
  - In `src/lib/documents/folder.ts`, added SHA-256 content inspection for `MULTI_FILE_TYPES` (`damagePhotos`, `spotPhotos`).
  - Existing photos are indexed by their SHA-256 fingerprint (or computed on the fly from the directory handle).
  - Incoming photo blobs are hashed; files matching an existing hash are deduplicated and skipped, eliminating redundant file numbering while preserving distinct angles and damage shots.
  - Added unit test suite in `src/lib/documents/__tests__/folder-photo-dedup.test.ts` (3/3 passing).
- **Commit:** `9662ee31` (`fix(documents): enforce SHA-256 content deduplication on multi-file photo saves`)

### Task 2: Drive Folder Inspection & Timestamps
- **Problem:** Surveyors looking at phone scan folders on Google Drive could not tell whether backup was complete, when the last sync occurred, or what items were inside without guessing. Previous logic threw if `_surveyos-scan.json` was missing or partial.
- **Solution:**
  - Enriched `listScanDriveFolders` in `src/lib/scan-import/drive-notes.ts` to inspect Drive folder contents via non-throwing `fetchScanFolderDetails`.
  - Added surveyor-friendly metadata: `itemCount`, `photoCount`, `docCount`, `hasNotes`, `rawModifiedTime`, and human-formatted `lastBackedUpTime` (e.g., "Just now", "5 mins ago", "Today at 3:15 PM").
  - Filtered subfolders (`application/vnd.google-apps.folder`) from item counts and bounded time formatting to prevent clock drift anomalies.
  - In `src/components/documents/PhoneFolderPickerDialog.tsx`, displayed sync status pills (`Last backed up: 5 mins ago`, `14 photos · 3 documents · Field Notes ready`) with zero raw JSON or hash references.
  - Added unit test suite in `src/lib/scan-import/__tests__/drive-notes-inspection.test.ts` (13/13 passing).
- **Commits:** `7ff6cb21` (`feat(scan-import): enrich Drive scan folders with timestamps and item metadata`), `48bd115d` (`fix(scan-import): harden Drive folder inspection error handling and time formatting`)

### Task 3: Streamline FromPhoneButton & Eliminate 3-Option Modal
- **Problem:** Clicking "From Phone" presented a confusing 3-option modal ("Sync from Google Drive Folder", "Pick .zip from Google Drive", "Pick .zip from this computer"). Surveyors do not understand ZIP files or manual manifests.
- **Solution:**
  - Removed the intermediate 3-option modal entirely from `src/components/documents/FromPhoneButton.tsx`.
  - Clicking "From Phone" directly opens the surveyor-friendly `PhoneFolderPickerDialog`.
  - Streamlined `src/lib/scan-import/drive-source.ts` to accept an `explicitFolderId`, allowing direct download and import without redundant root scans.
  - Maintained fallback for non-Drive environments: when Drive is not connected, prompts to connect Google Drive with an option to select a phone folder from computer.
  - Updated unit tests in `src/components/documents/__tests__/FromPhoneButton.test.tsx` (10/10 passing) and `src/lib/scan-import/__tests__/drive-source.test.ts` (11/11 passing).
- **Commit:** `54866ce4` (`feat(documents): replace 3-option modal with direct surveyor-friendly Phone Scans dialog`)

### Task 4: Per-Claim Local Folder Selection Gate (Choice 2)
- **Problem:** Surveyors need complete control over where files for each vehicle are stored on their PC (e.g., `D:\Claims\2026\MH12AB1234`). Previously, folder selection was either a global root folder or bypassed.
- **Solution:**
  - Updated `src/components/layout/ClaimFolderPromptDialog.tsx` to clearly prompt the surveyor:
    `📁 Select Local Folder for [Vehicle Reg / Claim]`
    *"Choose where all photos, scans, and final reports for this vehicle should be saved on your computer."*
    `[ Choose Folder on PC ]`
  - Integrated with `pickClaimFolder(activeClaimId)` in `src/lib/storage/claim-folder-store.ts`, securely storing the directory handle in IndexedDB (`surveyos-local-sync` DB, `claim-handles` store).
  - Updates `currentClaim.documentsFolder` in `useClaimStore` and emits `surveyos:claim-folder-updated` event so that all tabs show the connected folder name with a green checkmark.
  - In `FromPhoneButton.tsx`, implemented automatic resume flow: if a surveyor clicks a phone folder before linking a local PC folder, the local folder dialog opens automatically and resumes phone import immediately upon selection with zero repeat clicks.
  - Added unit test suite in `src/components/layout/__tests__/ClaimFolderPromptDialog.test.tsx` (9/9 passing) and expanded `FromPhoneButton.test.tsx` (14/14 passing).
- **Commit:** `07a25e3f` (`feat(storage): implement Choice 2 per-claim local folder selection`)

### Task 5: Auto-Filing Deliverables into Vehicle Folder & Drive
- **Problem:** When a surveyor generated a Final Survey Report, UIIC Final, Reinspection Report, Valuation Report, Spot Fee Bill, Bill Check, Photo Sheet, or NIA Excel, the files were only downloaded via browser downloads or stored in volatile state, risking missing files in the vehicle's folder.
- **Solution:**
  - Enhanced `src/lib/reports/auto-file-report.ts` (`saveReportToClaimFolder`):
    1. Retrieves the claim's verified directory handle from IndexedDB (`getClaimFolderHandle`).
    2. Writes the generated report or bill directly into the vehicle's folder using `{ create: true }`.
    3. Surfaces an Executive Platinum Sonner toast: `Saved [file.pdf] to vehicle folder: [Folder Name]`.
    4. Automatically mirrors to Google Drive via `uploadFileToDrive` in non-blocking background when Google Drive is connected.
    5. Registers the deliverable in `claim.documents` under its respective category.
  - Tested across all report types in `src/lib/reports/__tests__/auto-file-report.test.ts` (30/30 passing).
- **Commit:** `f8d32cd8` (`feat(reports): auto-file all deliverables into connected vehicle claim folder`)

---

## 2. Verification & Test Results
- **TypeScript:** `npx tsc --noEmit` passed with 0 errors.
- **Unit & Integration Tests:**
  - `src/lib/documents/__tests__/folder-photo-dedup.test.ts`: 3/3 passed.
  - `src/lib/scan-import/__tests__/drive-notes-inspection.test.ts`: 13/13 passed.
  - `src/components/documents/__tests__/FromPhoneButton.test.tsx`: 14/14 passed.
  - `src/lib/scan-import/__tests__/drive-source.test.ts`: 11/11 passed.
  - `src/components/layout/__tests__/ClaimFolderPromptDialog.test.tsx`: 9/9 passed.
  - `src/lib/reports/__tests__/auto-file-report.test.ts`: 30/30 passed.
  - All report generator test suites (58 files, 574 tests) passed 100%.
  - Full test suite: 401 test files passed, 3,610 tests passed (100% pass rate).
- **SurveyOS Scan Android Drift:**
  - Checked `SurveyOS Scan/` git status: clean working tree, 0 modified files, 0 schema changes, 0 drift.
