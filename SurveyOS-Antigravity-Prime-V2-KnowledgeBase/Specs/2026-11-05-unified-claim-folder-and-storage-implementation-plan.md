# Unified Claim Folder, Local Storage & Auto-Filing Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable surveyors to allocate any folder on their PC per claim, automatically save all input files (Details Tab direct uploads, phone scans, estimate/bills) into that folder, and auto-file all generated reports (Final Report, Re-inspection Report, Spot, Valuation, and Photo Sheet) directly to that folder without cross-claim collisions or data loss.

**Architecture:** Replace the rigid single-root guessing algorithm with per-claim `FileSystemDirectoryHandle` storage in IndexedDB (`claim-handles`). Unify all upload points through a universal `ingestDocument` pipeline that writes raw bytes to the allocated folder, registers in Evidence Viewer, runs AI, and syncs to Drive. Extend all report builders to auto-write finalized PDF outputs directly into the allocated folder.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Chromium File System Access API (`idb`), Zustand, Vitest.

---

### Task 1: Per-Claim Directory Handle Storage (`claim-folder-store.ts`)

**Files:**
- Create: `src/lib/storage/claim-folder-store.ts`
- Test: `src/lib/storage/__tests__/claim-folder-store.test.ts`

**Step 1: Write the failing test**
Create `src/lib/storage/__tests__/claim-folder-store.test.ts` testing:
- Storing a directory handle for `claim-1` and retrieving it.
- Ensuring `claim-2` does not receive `claim-1`'s handle (strict isolation).
- Querying and setting folder path labels.
- Checking permission status helpers.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/storage/__tests__/claim-folder-store.test.ts`
Expected: FAIL (module not found).

**Step 3: Write minimal implementation**
Create `src/lib/storage/claim-folder-store.ts`:
- Define `CLAIM_HANDLES_STORE = 'claim-handles'`.
- Open IndexedDB `surveyos-local-sync` (version bump or store check).
- Implement `setClaimFolderHandle(claimId, handle, pathLabel)`.
- Implement `getClaimFolderHandle(claimId)`.
- Implement `removeClaimFolderHandle(claimId)`.
- Implement `verifyHandlePermission(handle, mode)`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/storage/__tests__/claim-folder-store.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/storage/claim-folder-store.ts src/lib/storage/__tests__/claim-folder-store.test.ts
git commit -m "feat(storage): per-claim directory handle isolation store"
```

---

### Task 2: Claim Header Folder Allocation Button & Permission Chip

**Files:**
- Modify: `src/components/layout/ClaimHeader.tsx`
- Modify: `src/components/dialogs/NewClaimDialog.tsx`
- Test: `src/components/layout/__tests__/ClaimHeaderFolder.test.tsx`

**Step 1: Write the failing test**
Create `src/components/layout/__tests__/ClaimHeaderFolder.test.tsx` testing:
- When a claim has an allocated folder, `ClaimHeader` displays the folder name.
- When clicked, allows selecting/changing the folder via `window.showDirectoryPicker`.
- Shows permission badge (Granted vs Needs Permission).

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/layout/__tests__/ClaimHeaderFolder.test.tsx`
Expected: FAIL.

**Step 3: Write minimal implementation**
- Update `ClaimHeader.tsx` to include `ClaimFolderButton`:
  - Reads allocated folder handle for `currentClaim.id`.
  - Displays folder name or "Set Folder".
  - Clicking triggers direct synchronous `pickRootFolder()` and stores it in `claim-folder-store`.
  - Re-checks readwrite permissions on user click so Chromium never rejects with `SecurityError`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/layout/__tests__/ClaimHeaderFolder.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/layout/ClaimHeader.tsx src/components/layout/__tests__/ClaimHeaderFolder.test.tsx
git commit -m "feat(ui): add per-claim folder selector and permission status in ClaimHeader"
```

---

### Task 3: Universal Document Ingestion Pipeline (`ingest.ts`)

**Files:**
- Create: `src/lib/documents/ingest.ts`
- Test: `src/lib/documents/__tests__/ingest.test.ts`

**Step 1: Write the failing test**
Create `src/lib/documents/__tests__/ingest.test.ts` testing:
- Ingesting a document writes raw file to the claim folder.
- Registers document in Evidence Viewer (`storeFiles`).
- Registers document metadata in `claim.documents`.
- Dispatches AI extraction when `skipAI: false`.
- Uploads to Google Drive if connected and auto-sync is on.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/documents/__tests__/ingest.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
Create `src/lib/documents/ingest.ts` orchestrating:
1. `saveDocuments(docType, [{ blob: file, name: fileName }], source, claimId)`
2. `storeFiles(claimId, slotKey, [file])`
3. Optional `triggerExtraction(slotKey, file)`
4. Optional Drive sync via `uploadWithDuplicateCheck`

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/documents/__tests__/ingest.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/documents/ingest.ts src/lib/documents/__tests__/ingest.test.ts
git commit -m "feat(documents): unified document ingestion pipeline"
```

---

### Task 4: Fix Details Tab Direct Uploads & Add Phone Scans Support

**Files:**
- Modify: `src/components/tabs/DetailsTab.tsx`
- Modify: `src/components/claim/VehicleForm.tsx`
- Modify: `src/components/claim/DriverForm.tsx`
- Modify: `src/components/claim/PolicyForm.tsx`
- Test: `src/components/tabs/__tests__/DetailsTabUploads.test.tsx`

**Step 1: Write the failing test**
Create `src/components/tabs/__tests__/DetailsTabUploads.test.tsx` testing:
- Uploading an RC file in `VehicleForm` calls `ingestDocument` and persists the file.
- Uploading a DL file in `DriverForm` calls `ingestDocument` and persists the file.
- "Use phone files" button picks phone-scanned RC/DL and triggers extraction.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/tabs/__tests__/DetailsTabUploads.test.tsx`
Expected: FAIL.

**Step 3: Write minimal implementation**
- Update `VehicleForm.tsx`, `DriverForm.tsx`, `PolicyForm.tsx` to accept an optional `usePhone` action alongside `scan`.
- Wire `UsePhoneFiles` for `['rc', 'rcBack']` and `['dl', 'dlBack']` in `DetailsTab.tsx`.
- Connect `handleFileChange` in `DetailsTab.tsx` to `ingestDocument` so raw files are never dropped.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/tabs/__tests__/DetailsTabUploads.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/tabs/DetailsTab.tsx src/components/claim/VehicleForm.tsx src/components/claim/DriverForm.tsx src/components/claim/PolicyForm.tsx src/components/tabs/__tests__/DetailsTabUploads.test.tsx
git commit -m "fix(details-tab): persist direct field uploads and add phone files picker"
```

---

### Task 5: Automatic Output Filing for Final, Re-inspection, and Spot Reports

**Files:**
- Create: `src/lib/reports/auto-file-report.ts`
- Modify: `src/lib/reports/reinspection-report-builder.ts`
- Modify: `src/lib/reports/standard-report-builder.ts`
- Modify: `src/lib/reports/uiic-final-builder.ts`
- Modify: `src/lib/reports/spot-report-builder.ts`
- Modify: `src/lib/reports/valuation-report-builder.ts`
- Test: `src/lib/reports/__tests__/auto-file-report.test.ts`

**Step 1: Write the failing test**
Create `src/lib/reports/__tests__/auto-file-report.test.ts` testing:
- Calling `saveReportToClaimFolder` writes the PDF blob directly to the allocated directory handle.
- Reinspection report generates `Reinspection_Report_<ReportNo>.pdf`.
- Final survey report generates `Final_Survey_Report_<ReportNo>.pdf`.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/reports/__tests__/auto-file-report.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
- Create `src/lib/reports/auto-file-report.ts` with `saveReportToClaimFolder(claimId, reportName, pdfBlob)`.
- Update report builders to compile and directly write to the claim folder.
- Deprecate/remove the manual re-filing toast (`promptForPrintedPdf`).

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/reports/__tests__/auto-file-report.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/reports/auto-file-report.ts src/lib/reports/*.ts src/lib/reports/__tests__/auto-file-report.test.ts
git commit -m "feat(reports): auto-write generated reports directly into claim folder"
```

---

### Task 6: Photo Upload De-duplication & Drive Hygiene

**Files:**
- Modify: `src/hooks/usePhotoUpload.ts`
- Modify: `src/lib/drive/index.ts`
- Test: `src/hooks/__tests__/usePhotoUploadDedupe.test.ts`

**Step 1: Write the failing test**
Create `src/hooks/__tests__/usePhotoUploadDedupe.test.ts` testing:
- Photo uploads use deterministic names instead of `Date.now()`.
- Re-uploading an existing photo calls `uploadWithDuplicateCheck` rather than creating a duplicate.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/hooks/__tests__/usePhotoUploadDedupe.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
- Update `usePhotoUpload.ts` to generate deterministic filenames: `final_photo_${index + 1}_${photoName}.jpg`.
- Integrate `uploadWithDuplicateCheck` into `usePhotoUpload`.
- Harden `saveDriveIndex` in `src/lib/drive/index.ts` to abort if index read failed.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/hooks/__tests__/usePhotoUploadDedupe.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/hooks/usePhotoUpload.ts src/lib/drive/index.ts src/hooks/__tests__/usePhotoUploadDedupe.test.ts
git commit -m "fix(photos): deterministic drive photo names and duplicate check integration"
```

---

### Task 7: Full System Verification, TypeScript & Drift Check

**Files:**
- Update: `Tasks.md`
- Update: `Changelog.md`

**Step 1: Run full Vitest suite**
Run: `npx vitest run`
Expected: All tests pass.

**Step 2: Run TypeScript compiler**
Run: `npx tsc --noEmit`
Expected: 0 errors.

**Step 3: Run SurveyOS Scan drift tests**
Run: `cd "../SurveyOS Scan" && ./gradlew :app:testDebugUnitTest`
Expected: All tests pass with zero drift.

**Step 4: Commit documentation updates**
```bash
git add SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md
git commit -m "docs: complete unified claim folder and storage architecture implementation"
```
