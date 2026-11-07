# Session: 2026-11-07 (Antigravity) — Single Unified Google Drive Claim Folder & Manual Surveyor Linking

## What I Did
1. **Audited Google Drive Storage Structure Across Scan and Prime:**
   - Identified that SurveyOS Scan writes to `My Drive/SurveyOS/Phone Scans/<folderName>/` while Prime creates `My Drive/SurveyOS/<label>_<shortClaimId>/`.
   - Diagnosed that `getOrCreateClaimFolder` in `src/lib/drive/index.ts` only fell back to `claim.gDriveFolderId` if the remote index strictly failed to load; otherwise it created a new duplicate folder.
2. **Prevented Duplicate Drive Folder Generation:**
   - Updated `getOrCreateClaimFolder` in `src/lib/drive/index.ts` to check `claim?.gDriveFolderId` unconditionally before creating a new folder.
   - When present, it registers `index[claimId] = claim.gDriveFolderId`, saves the index, and returns the existing folder ID.
3. **Manual Surveyor Folder Linking:**
   - Updated `src/components/documents/UsePhoneNotesButton.tsx` to bind `claim.gDriveFolderId` when a surveyor chooses a Drive folder from `PhoneFolderPickerDialog`.
   - Updates `localStorage` and `surveyos_index.json` so all future photo uploads, direct document attachments, and report auto-filing in Prime write directly into that same folder.
4. **Expanded Folder Discovery in Picker:**
   - Updated `listScanDriveFolders` in `src/lib/scan-import/drive-notes.ts` to discover claim folders both in `SurveyOS/Phone Scans/` and directly in `SurveyOS/`, ignoring the container folder itself.
5. **Preserved Ingest Cloud Mirror:**
   - Confirmed that files loaded from computer (e.g. .zip) are automatically backed up to Google Drive if connected via `uploadWithDuplicateCheck` with MD5 hash deduplication.

## Decisions Made
- Zero auto-guessing / no popups: Linking remains 100% manual and surveyor-controlled.
- Single unified folder: One claim = one folder on Google Drive.
- Multi-location folder discovery: Works seamlessly with both legacy `Phone Scans/` folders and direct `SurveyOS/` claim folders.

## Verification
- Unit tests: `index-hygiene.test.ts` (4 tests passed), `drive-notes.test.ts` (3 tests passed).
- Full Vitest suite: 294 test files passed, 2,598 tests passed (100% green).
- TypeScript: `npx tsc --noEmit` passed with 0 errors.
- Scan Drift: `./gradlew :app:testDebugUnitTest` (28 tasks passed, 100% green).
