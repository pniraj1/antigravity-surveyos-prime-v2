# Handover to Claude Code: Phone Scan Import & Document Source Selection

> **Date:** 2026-11-20  
> **From:** Antigravity  
> **To:** Claude Code  
> **Status:** Live deployment on `https://surveyos.in` completed for Tasks 1–5 (commit `95d7f9ef`). Systematic debugging completed for user-reported field issues: folder creation/download block and RC document source selection.

---

## 1. Summary of Recent Developments & Commits

In the recent session, we implemented and deployed the **Phone Scan & Claim Storage Workflow**:

| Commit | Description | Key Files Modified |
|---|---|---|
| `9662ee31` | `fix(documents): enforce SHA-256 content deduplication on multi-file photo saves` | `src/lib/documents/folder.ts`, `folder-photo-dedup.test.ts` |
| `7ff6cb21` | `feat(scan-import): enrich Drive scan folders with timestamps and item metadata` | `src/lib/scan-import/drive-notes.ts`, `PhoneFolderPickerDialog.tsx`, `drive-notes-inspection.test.ts` |
| `48bd115d` | `fix(scan-import): harden Drive folder inspection error handling and time formatting` | `src/lib/scan-import/drive-notes.ts`, `drive-notes-inspection.test.ts` |
| `54866ce4` | `feat(documents): replace 3-option modal with direct surveyor-friendly Phone Scans dialog` | `src/components/documents/FromPhoneButton.tsx`, `PhoneFolderPickerDialog.tsx`, `drive-source.ts` |
| `07a25e3f` | `feat(storage): implement Choice 2 per-claim local folder selection` | `ClaimFolderPromptDialog.tsx`, `FromPhoneButton.tsx`, `claim-folder-store.ts` |
| `f8d32cd8` | `feat(reports): auto-file all deliverables into connected vehicle claim folder` | `src/lib/reports/auto-file-report.ts`, `auto-file-report.test.ts` |
| `1b88897f` | `docs(kb): record phone scan and claim storage workflow implementation` | `Tasks.md`, `Changelog.md`, `Sessions/` |
| `95d7f9ef` | `docs(deploy): mark phone scan and claim storage workflow as deployed to surveyos.in` | `Tasks.md`, `Changelog.md`, `Sessions/` |

**Verification baseline before handover:**
- `npx vitest run`: **401 test files passed, 3,623 unit tests passed (100% green)**.
- `npx tsc --noEmit`: **0 errors**.
- `SurveyOS Scan` (Android app): **0 drift** (clean git working tree).
- Live Production URL: `https://surveyos.in` (Firebase Hosting site: `motorsurveyos-in`, chunk `05htj_w4kba-j.js` HTTP 200).

---

## 2. Systematic Debugging: Root Causes of User-Reported Issues

The user reported two specific issues:
1. *"when I click on use phone and select a folder that folder is not getting created and also te documents are not getting downloaded."*
2. *"Also whrn i click on rc it should allow me to get that from google drive folder or (if the download is completed then from that selected folder right) but that is not happening"*

### Root Cause 1: Why documents are not downloaded and folder is not created
1. **`src/lib/scan-import/import.ts` (Lines 105–111):**
   ```typescript
   const rootHandle = await getStoredRootHandle();
   if (!rootHandle) return { status: 'needs-folder', notes: manifest.notes ?? null };
   ```
   - **The Bug:** `importScanFiles` checks `getStoredRootHandle()` (which only retrieves the legacy global root folder from the `handles` store).
   - Under **Choice 2 (Per-claim folder)**, the handle is stored under the claim ID in `claim-handles` via `getClaimFolderHandle(claim.id)`.
   - Because `getStoredRootHandle()` returns `null`, `importScanFiles` immediately aborts with `{ status: 'needs-folder' }`.
   - As a result, `saveDocuments()` is **never reached**, zero files are downloaded, and zero directories are created on disk.
   - **The Fix:**
     ```typescript
     const claimHandle = await getClaimFolderHandle(claim.id);
     const effectiveHandle = claimHandle ?? (await getStoredRootHandle());
     if (!effectiveHandle) return { status: 'needs-folder', notes: manifest.notes ?? null };

     const hasPerm = claimHandle
       ? await verifyHandlePermission(claimHandle, 'readwrite')
       : (effectiveHandle.queryPermission ? (await effectiveHandle.queryPermission({ mode: 'readwrite' })) === 'granted' : true);
     if (!hasPerm) return { status: 'needs-permission', notes: manifest.notes ?? null };
     ```

2. **`src/lib/storage/claim-folder-store.ts` & `ClaimFolderPromptDialog.tsx` (Automatic Vehicle Subfolder Creation):**
   - **The Bug:** When a surveyor is prompted *"Select Local Folder for MH 12 AB 1234"*, they typically pick their master folder on PC (e.g. `D:\Claims` or `C:\Users\...\Documents`).
   - `pickClaimFolder` previously stored `D:\Claims` as the claim's folder directly. It did not create the vehicle subfolder (`MH 12 AB 1234 - NIA`) inside it.
   - **The Fix:** In `pickClaimFolder` (or `ClaimFolderPromptDialog`), check if the selected folder's name matches the vehicle registration number (`sameVehicle(handle.name, regNo)`).
     - If it matches (or contains the reg number), use it directly.
     - If it does NOT match (e.g. the user selected `Claims` or `Desktop`), automatically create the vehicle subfolder inside it:
       `const vehicleDir = await handle.getDirectoryHandle(folderNameFor(claim), { create: true });`
       and store `vehicleDir` as the claim folder handle. That way, the vehicle folder is physically created on disk in Windows Explorer immediately!

3. **`src/lib/scan-import/drive-source.ts` (Lines 130–152):**
   - **The Bug:** If a phone folder on Google Drive contains files (e.g., `RC.pdf`, `DL.pdf`, `Final Photos/Final Photos 1.jpg`) but `_surveyos-scan.json` is missing or hasn't finished uploading, `importFromDrive` returns `added: 0` without downloading any documents.
   - **The Fix:** When `manifestFile` is missing but `listed` has PDFs/images in the Drive folder, synthesize a manifest from the present files (`RC.pdf` -> `rc`, `DL.pdf` -> `dl`, `Estimate.pdf` -> `estimate`, etc.) so that all existing documents and photos in that Drive folder are downloaded cleanly into the vehicle's folder.

---

### Root Cause 2: Clicking on "RC" (or document cards) to get from Drive vs Local Folder vs PC
- **Current State:**
  - In `DocumentsTab.tsx` (lines 384–416), the RC Book card is a `<label>` wrapping an invisible `<input type="file">`. Clicking anywhere on the card unconditionally launches the OS file browser.
  - In `DetailsTab.tsx` (lines 223–240), "Scan RC" is an `<input type="file">`, while `UsePhoneFiles` (`phoneRc`) returns `null` (hidden) if `claim.documents` has no scan documents, and never inspects Google Drive.
- **Desired Surveyor Experience:**
  When clicking on the **RC Book card** (in `DocumentsTab.tsx`) or **Scan RC** (in `DetailsTab.tsx`):
  Offer a multi-source modal or menu:
  1. **From Google Drive (Vehicle Folder):** If the vehicle's Drive folder has an RC file (`RC.pdf`, `RC.jpg`, `rc.pdf`), show it with a 1-click **[ ⬇️ Import RC from Drive ]** button.
  2. **From Vehicle Folder (On PC):** If the local vehicle folder already has the RC file (or downloaded via Phone Scans), show **[ 📄 Use Local RC ]**.
  3. **Upload from Computer:** Standard **[ 💻 Browse PC File ]**.

---

## 3. Recommended Implementation Plan for Claude Code

1. **Step 1: Fix `src/lib/scan-import/import.ts` to recognize `getClaimFolderHandle(claim.id)`:**
   - Import `getClaimFolderHandle`, `verifyHandlePermission` from `@/lib/storage/claim-folder-store`.
   - Update line 105 to check `claimHandle ?? rootHandle`.
   - Verify unit tests in `src/lib/scan-import/__tests__/import.test.ts`.

2. **Step 2: Auto-create vehicle subfolder on PC in `pickClaimFolder`:**
   - In `src/lib/storage/claim-folder-store.ts`, when `showDirectoryPicker` returns `pickedHandle`:
     - If `sameVehicle(pickedHandle.name, regNo)` is false, create `pickedHandle.getDirectoryHandle(folderNameFor(claim), { create: true })`.
     - Persist the vehicle directory handle and update `claim.documentsFolder`.

3. **Step 3: Fallback file listing in `drive-source.ts`:**
   - When `_surveyos-scan.json` is missing in `importFromDrive`, build synthetic manifest files from `listed` PDFs/images and import them.

4. **Step 4: Create Document Source Picker for RC (and other cards):**
   - Create `src/components/documents/DocumentSourceDialog.tsx` (or integrate into `DocumentReviewSheet` / card click):
     - Checks Google Drive vehicle folder for matching slot files (`RC.pdf`, `DL.pdf`, `Policy.pdf`, `Estimate.pdf`).
     - Checks local claim folder for existing files.
     - Offers 1-click import from Drive, use from local folder, or browse computer.
   - Wire into `DocumentsTab.tsx` doc cards and `DetailsTab.tsx` `ScanButton` / `UsePhoneFiles`.

5. **Step 5: Verification & Deploy:**
   - Run `npx vitest run` & `npx tsc --noEmit`.
   - Build with `npm run build` and deploy: `npx firebase deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in`.
