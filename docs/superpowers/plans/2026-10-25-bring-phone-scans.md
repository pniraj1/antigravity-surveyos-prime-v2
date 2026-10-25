# Bring Phone Scans Implementation Plan

**Spec (binding):** `docs/superpowers/specs/2026-10-25-bring-phone-scans-design.md`
**Contract:** `../SurveyOS Scan/docs/handover/prime-notes-import.md`, which covers the manifest, the notes field table and the import rules.

**Shape:** 6 tasks.
- Task 1 is in the SurveyOS Scan repo.
- Tasks 2–6 are in Prime.
- Tasks 2 and 3 are pure logic with tests.
- Task 4 is the import core.
- Task 5 is the Documents tab UI.
- Task 6 is the import entry and the dialogs.

## Global Constraints

### Owner's workflow (binding)
- The claim exists first; Prime never creates claims from a zip.
- Every AI read is a surveyor click. Import code makes no AI calls.
- Photos, cheque and estimate never go to AI.
- Nothing is deleted. Stale copies are renamed "(old)" by the existing write rules.

### Card and file mapping
- **A file has a card** when `FIELD_KEY_TO_DOC_TYPE` maps a card id to its DocType. Skip `other`, because `auth` and `load-challan` map to it.
- Card DocTypes are: `rc`, `dl`, `policy`, `claimForm`, `fir`, `invoice`, `permit`, `fitness`.
- Every other DocType goes to the Phone files list.

### Exact copy
- Import button: `Bring phone scans`, with menu items `From Google Drive` and `From this computer`.
- Card phone state: `From phone — click to read`. When a newer phone file arrives for a card already read: `New phone file — click to read`.
- List header: `Phone files`. Counter: `Checked N of M`.
- Folder line, by state:
  - `Files kept in: <root> on <PC> · Change`
  - `No claim folder · Connect`
  - `Allow access`
- Vehicle mismatch dialog: names both numbers, with buttons `Import anyway` and `Cancel`.
- Notes dialog sections: `Will fill` and `Phone notes differ`, with button `Apply`. Per differing field: `Keep Prime` / `Use phone`.

### Data model changes (`src/types/documents.ts`, `src/types/claim.ts`)
- `ClaimDocument.source` gains `'scan'`.
- `ClaimDocument.portalChecked?: boolean`.
- `ClaimData.scanImport?: { at: string; decided: Record<string, string> }`.
- All three are additive and optional, so old claims load unchanged.

### Prime engineering
- Next.js 16: check `node_modules/next/dist/docs/` before using framework APIs.
- Tests: vitest. Verify with `npx vitest run <paths>` while iterating, and `npm test` plus `npx tsc --noEmit` before committing.
- Files stay at most 800 lines. `DocumentsTab.tsx` is 630 lines, so new UI goes in new components under `src/components/documents/`.
- No new npm dependency. The zip is read with `DecompressionStream('deflate-raw')`.

### SurveyOS Scan engineering
- Build in Git Bash: `export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"; ./gradlew :app:testDebugUnitTest :app:assembleDebug`
- No java.time. Drift tests stay green. Never run adb.

### Process and docs
- Commit to `main` in each repo. Never push. Never deploy.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Impact rule: each task's report states its impact on the other app.

## Review Focus

1. **The same zip imported twice:**
   - no new documents;
   - no notes questions on the second run;
   - zero AI calls.
   - Pinned by Task 4 `reimportAddsNothing` and Task 3 `decidedNotAskedAgain`.
2. **A Prime field the surveyor typed differs from the phone value:** it is never overwritten without a pick. Pinned by Task 3 `differingNeverAutoFilled`.
3. **`isInsurable`:** never auto-filled. Pinned by Task 3 `insurableAlwaysPicked`.
4. **A zip with photos only:** nothing goes to cards, all files go to Phone files, and no AI call is made. Pinned by Task 4 `photosNeverCarded`.
5. **No folder connected:** the import stops before writing anything. Pinned by Task 4 `requiresFolder`.
6. **Scan without Drive:** Share and Save to folder still work, and the drift tests pass. Phone-checked.

---

### Task 1: SurveyOS Scan — remove Sync to Drive (repo `../SurveyOS Scan`)

**Files:**
- Delete `app/src/main/java/surveyos/scan/drive/*`, which includes `DriveAuth`, `DriveApi`, `DriveSync`, `DriveSyncWorker` and `SyncPlan`.
- Delete `ui/claim/DriveCard.kt`.
- Edit `ScanApp.kt`, `ui/claim/ClaimViewModel.kt`, `ui/home/HomeScreen.kt` and `ui/settings/SettingsScreen.kt`.
- Remove all their Drive references, plus any Drive tests under `app/src/test`.
- Remove `play-services-auth` from `app/build.gradle.kts` and `gradle/libs.versions.toml`. Keep `firebase-auth`, which the promo codes use.

**Steps:**
1. Remove the Sync button, the Drive status badges, Settings' "Google Drive connected / Disconnect", the WorkManager sync scheduling, and the pending-sync counts.
   - If a Room column or table exists only for Drive (for example, a Drive folder id or sync state), leave the schema alone, because a migration risks data, and stop writing to it. Mark it with a `ponytail:` comment.
2. Keep Share zip, Share PDF/photos and Save to folder unchanged.
3. Handover:
   - Add a Changelog line to `docs/handover/prime-notes-import.md` dated 2026-10-25: "Scan no longer syncs to Drive; every import arrives as an exported zip (shared to Drive or email). Existing `SurveyOS/Phone Scans` folders are left as they are."
   - Fix any section of that doc that describes Drive pickup.
4. Add a ruling D-82 to `docs/build-notes.md`: Drive sync removed by owner decision 2026-10-25.
5. Release checklist: remove the Android OAuth client step from `docs/release/owner-steps.md`.
   - Phone checklist section `## Drive removal`:
     - no Drive UI anywhere;
     - Share zip, Share PDF and Save to folder work;
     - an app upgrade from the previous build opens without a crash.
6. Tests: full suite green. Delete tests that only covered the deleted Drive code, and list them in the report.

### Task 2: Zip reader and manifest (Prime, pure)

**Files:**
- Create `src/lib/scan-import/zip.ts` and `src/lib/scan-import/manifest.ts`.
- Tests go in `src/lib/scan-import/__tests__/`.

**Steps:**
1. `readZip(blob: Blob): Promise<Map<string, Blob>>`.
   - Parse the end-of-central-directory record and the central directory.
   - Method 0 entries: slice the bytes.
   - Method 8 entries: pipe through `new DecompressionStream('deflate-raw')`.
   - Any other method throws `Unsupported zip`.
   - Paths use `/`. Skip directory entries.
2. `findManifest(files)`.
   - Look for `_surveyos-scan.json` at the zip root, or one folder down, which is the usual case: `<folder>/_surveyos-scan.json`.
   - Return `{ root, manifest }`. The manifest is typed from the handover: `vehicle`, `insurer`, `claimNo`, `exportedAt`, `files[] {path, docType, pages, sha256, photo?}`, `notes?`, `claimId?`.
   - Throw `Not a SurveyOS Scan export` when it is absent.
   - Unknown manifest keys are ignored.
3. `sameVehicle(a, b)`: compare uppercased strings with all non-alphanumerics stripped.
4. Tests:
   - `readsStoredAndDeflated`: build fixture zips in the test with node's `zlib.deflateRawSync`, plus hand-written headers through a tiny test helper.
   - `refusesNoManifest`.
   - `manifestOneFolderDown`.
   - `ignoresUnknownKeys`.
   - `vehicleMatchIgnoresSpacesAndCase`.

### Task 3: Notes merge (Prime, pure)

**Files:**
- Create `src/lib/scan-import/notes.ts`.
- Tests go in `src/lib/scan-import/__tests__/notes.test.ts`.

**Steps:**
1. Copy the allow-list from the handover field tables, spot and valuation, as a constant keyed by Prime claim path.
   - Add a test that fails if a handover table key is missing from it. It reads the handover markdown from `../SurveyOS Scan/docs/handover/prime-notes-import.md` and skips only if that repo is absent.
2. `planNotes(claim, notes, decided)` returns `{ fill: Change[], differ: Change[], rows: RowPlan }`. Rules:
   - keys outside the allow-list are dropped;
   - an empty Prime value goes to `fill`;
   - an equal value is dropped;
   - a different value goes to `differ`, unless `decided[key] === phoneValue`;
   - `valuationDetails.isInsurable` maps `yes` to true and `no` to false, and is never in `fill`. It goes to `differ` when it differs from Prime;
   - document verification `{status, detail}` maps to `documentVerification.<id>.status/detail`;
   - spot damage rows are appended, de-duped on component and damage, trimmed, case-insensitive;
   - valuation part rows are appended to `panelRows` with new ids, de-duped by component case-insensitively. An existing row with an empty condition takes the phone's condition.
3. `applyNotes(claim, plan, picks)` returns the claim updates plus the new `scanImport.decided`. Every differ key the surveyor saw is recorded with its phone value, whichever choice they made.
4. Tests:
   - `fillsEmpty`;
   - `differingNeverAutoFilled`;
   - `insurableAlwaysPicked`;
   - `decidedNotAskedAgain`;
   - `clearingOnPhoneNeverClears` (a phone key that is absent means no change);
   - `damageRowsDeduped`;
   - `partRowsDedupedAndEmptyConditionFilled`;
   - `unknownKeysDropped`;
   - `allowListMatchesHandover`.

### Task 4: Import core (Prime)

**Files:**
- Create `src/lib/scan-import/import.ts` and `src/lib/scan-import/cards.ts`.
- Edit `src/types/documents.ts`, `src/types/claim.ts` and `src/lib/documents/folder.ts`, but only if `'scan'` needs handling there.
- Write tests.

**Steps:**
1. Types, per the Global Constraints.
2. `cards.ts`:
   - `CARD_DOC_TYPES` is the inverse of `FIELD_KEY_TO_DOC_TYPE` without `other`.
   - `cardIdFor(type)` returns the card id or null.
   - `phoneFileFor(claim, cardId)` returns the newest `'scan'` document for that card's type.
3. `importScanZip(blob, { confirmVehicle })`:
   1. Read the zip and find the manifest.
   2. **Vehicle check:** on a mismatch, `await confirmVehicle(zipVehicle, claimVehicle)`. If it returns false, abort.
   3. **Folder check:** `getStoredRootHandle()`. With no folder, return `{ status: 'needs-folder' }` before writing anything.
   4. **Duplicate check:** for each manifest file, skip it if an existing document of the same type has the same content. Compute the SHA-256 of the existing bytes with `crypto.subtle` when the document has no stored hash.
   5. **Save:** call `saveDocuments(type, [{ blob, name: basename }], 'scan')`, grouped by type, and keep the folder subpath for photos as the existing naming does.
   6. **Return:** `{ status: 'done', added, skipped, notes: manifest.notes ?? null }`.
4. Tests (mock the folder and sink at the module boundary):
   - `requiresFolder`;
   - `mismatchAbortsWhenDeclined`;
   - `reimportAddsNothing`;
   - `photosNeverCarded` (card mapping returns null for photo types);
   - `unknownDocTypeBecomesOther`.

### Task 5: Documents tab UI (Prime)

**Files:**
- Create `src/components/documents/FolderLine.tsx` and `src/components/documents/PhoneFilesList.tsx`.
- Edit `src/components/tabs/DocumentsTab.tsx`.

**Steps:**
1. Remove these from the tab:
   - `PortalChecklist`, `ClaimDocumentsList` and `PageLabelGrid`;
   - the `useDocumentKit()` call, if nothing else on the tab needs it;
   - the "Files on Drive" panel and its hook state.
   Delete the three components only if nothing else imports them (grep first).
2. `FolderLine`:
   - shows one line per the copy in Global Constraints;
   - "Change" or "Connect" opens the existing `ClaimFolderCard` in a small dialog or popover, so its logic is reused rather than duplicated;
   - "Allow access" calls `docs.reconnect`.
3. Cards:
   - When `phoneFileFor(claim, doc.id)` exists and the card is unread, or the phone file is newer than the last read, show the phone copy from Global Constraints.
   - Clicking it opens the existing review sheet: `setReviewSheet({ key: doc.id, label: doc.label, files: [await readDocument(claim, phoneDoc)] })`.
   - The upload input and the Sync pull are unchanged.
4. `PhoneFilesList` sits below the cards:
   - It lists `'scan'` documents whose type has no card, grouped by `DOC_TYPE_LABEL`, with name, Open (`docs.open`) and a `portalChecked` checkbox that persists through `updateClaim({documents})`.
   - Header: `Phone files · Checked N of M`.
   - Hidden when the list is empty.
5. Add the phone checks to the vault, or wherever Prime keeps manual checks. If there is no such file, put them in the session log in Task 6.

### Task 6: Import entry, dialogs, and docs (Prime)

**Files:**
- Create `src/components/documents/BringPhoneScans.tsx`, `src/components/documents/PhoneNotesDialog.tsx` and `src/lib/scan-import/picker.ts`.
- Edit `DocumentsTab.tsx` to mount the button near the top of the document section.

**Steps:**
1. `picker.ts`:
   - Load `https://apis.google.com/js/api.js`, then `gapi.load('picker')`.
   - Build a DocsView filtered to `application/zip` with the current `getDriveToken()`. If there is no token, call `linkGoogleDrive()` first.
   - Use `setDeveloperKey(NEXT_PUBLIC_GOOGLE_PICKER_API_KEY ?? NEXT_PUBLIC_FIREBASE_API_KEY)` and `setAppId(NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)`.
   - Download the picked file with `files/{id}?alt=media`.
   - On a load or auth failure, show a toast and fall back to the local file input.
2. `BringPhoneScans`:
   - A menu with the two items from Global Constraints. The local item is a hidden `<input type="file" accept=".zip">`.
   - It runs `importScanZip` with a vehicle confirm dialog.
   - On `needs-folder`, show a toast, then open the folder connect from FolderLine.
   - On `done`, show a toast `Added N, skipped M`. If there are notes, open `PhoneNotesDialog`.
3. `PhoneNotesDialog`:
   - Run `planNotes`.
   - Show a `Will fill` list as label, phone value and a tick per item (default on).
   - Show `Phone notes differ` per field, with the Prime value, the phone value, and `Keep Prime` / `Use phone` (default Keep Prime).
   - Show the row additions.
   - `Apply` calls `applyNotes` and then `updateClaim`. Closing without Apply writes nothing.
   - When the plan is empty, show the toast `Phone notes: nothing new` instead of the dialog.
4. **Owner/controller one-time step:** enable the Google Picker API in project `surveyos-v2-antigravity-in`. Write it in the session log and the vault `Tasks.md`. The code must not crash without it.
5. **Prime protocol:** update the vault `Tasks.md` and `Changelog.md`, add the session log `Sessions/2026-10-25-bring-phone-scans.md`, and add the phone/browser checks.
6. **Handover:** add a short line to `../SurveyOS Scan/docs/handover/prime-notes-import.md` Changelog: "Prime import built (Bring phone scans), 2026-10-25". Commit it in the Scan repo.

## After the tasks

1. Final whole-branch review across both repos (opus), then ONE fix wave.
2. `npm test` and `npx tsc --noEmit` green in Prime. Scan builds.
3. Install Scan on R5CTC18EAYT (controller only).
4. Browser check: Prime needs a sign-in plus a real folder, so the owner checks it.
