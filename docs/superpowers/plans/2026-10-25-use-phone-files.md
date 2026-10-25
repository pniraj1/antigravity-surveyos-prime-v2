# Use Phone Files — Implementation Plan (with design)

## Design (approved by the owner in chat on 2026-10-25)

**Why.** Bring phone scans saves Scan's files into the claim folder as `'scan'` documents. Three screens still accept files only through the computer's file chooser:
- Assessment's Upload Estimate
- Bill Check's invoice upload
- the Photos tab's Gallery / Browse

Today the surveyor has to browse to the claim folder to reach these files. The owner wants to pick them directly ("even the photo engine").

**What it does.** A **Use phone files** button sits next to each of those uploads and lists only the matching imported files for the current claim:

| Screen | Types listed | After picking |
|---|---|---|
| Assessment → Upload Estimate | `estimate`, `supplementaryEstimate` | The same handler as the file input. The estimate mode dialog and the AI read and review run unchanged. |
| Bill Check → invoice | `invoice` | The same `handleFileUpload` path as the file input. |
| Photos tab | photo DocTypes | Photos are grouped by type and **always land as a selection first** (owner's decision). The surveyor ticks photos, or uses **Select all** per group, then clicks **Add to photo sheet**. That runs the same compress-and-add path as Gallery / Browse. |

**Photo groups.**
- These DocTypes are photo groups: `damagePhotos` (Final Photos), `spotPhotos`, `riPhotos` (if present), `photoFront`, `photoRear`, `photoLeft`, `photoRight`, `chassisPhoto`, `odometerPhoto`.
- Tags carry over through the inverse of `TAG_TO_DOC_TYPE`. A chassis photo arrives tagged `chassis`.
- A photo already on the sheet is skipped. Match it by the source document id stored on the PhotoItem, or by name if no id is stored.

**Rules.**
- No AI call starts without the surveyor's click; each screen keeps its own existing flow.
- The button is hidden when the claim has no matching `'scan'` documents.
- File-chooser uploads are unchanged.
- No change to Scan. No running cost.

## Global Constraints
- **Copy:**
  - Button: `Use phone files`.
  - Photo dialog title: `Phone photos`.
  - Per group: `Select all`.
  - Confirm button: `Add to photo sheet`.
  - Empty state: the button is hidden.
- **Reuse.** Files are read with `readDocument(claim, doc)` from `src/lib/documents/folder.ts`. The existing handlers take a `File`, or a `FileList` for photos, so refactor each handler to accept `File[]` and keep the input-event wrapper thin. Do not duplicate handler logic.
- **Permission.** If reading fails because folder permission is missing, show one toast pointing to the Documents tab's `Allow access`.
- **Claim switch.** After any await, abort if the current claim id changed. The same pattern as `openPhoneFile` in DocumentsTab.
- **Size and tests.** Files ≤800 lines. Tests use vitest, for pure helpers only.
- **Verify:** `npm test` and `npx tsc --noEmit`.
- **Git and docs.** Commit to main, never push. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Report impact on Scan (expected: none).
- **Prime protocol at the end.** Update vault `Tasks.md` and `Changelog.md`, and append to the session log `Sessions/2026-10-25-bring-phone-scans.md` with the manual checks.

## Review Focus
1. Picking a phone estimate behaves exactly like choosing the same file in the file chooser: the mode dialog appears and the read and review run.
2. Phone photos never reach the sheet without the Add click.
3. Adding the same phone photos twice adds nothing.
4. A claim switch during reading does nothing.

---

### Task 1: Shared picker plus Assessment and Bill Check

**Files:**
- `src/lib/scan-import/phone-files.ts` (pure): `phoneFilesOfTypes(claim, types)`, newest first; `photoGroups(claim)`, returning `{type, label, tag?, docs[]}` in the order listed in the Design.
- `src/components/documents/UsePhoneFiles.tsx`: a button plus a small list dialog for single-pick screens. Props: `types`, `onPick(file: File, doc)`.
- Edit `src/components/tabs/AssessmentTab.tsx` (estimate) and `src/components/tabs/bill-check/BillCheckUploadPanel.tsx`, or `BillCheckTab.tsx`, wherever the handler lives.

**Steps:**
1. Write the helpers and their tests:
   - `listsOnlyScanDocsOfTypes`
   - `newestFirst`
   - `photoGroupsOrderAndTags`
   - `emptyWhenNone`
2. Refactor `handleEstimateUpload` into `processEstimateFile(file)` plus the thin input wrapper. Do the same for the bill-check upload.
3. Mount `UsePhoneFiles` next to each upload, using the types from the Design table.
4. Add the claim-switch guard and the permission toast.

### Task 2: Photos tab selection

**Files:**
- Create `src/components/photos/PhonePhotosDialog.tsx`.
- Edit `src/components/tabs/PhotosTab.tsx`.

**Steps:**
1. Refactor `uploadPhotos(files)` so it can take `File[]` together with an optional per-file `{ tag, sourceDocId }`. Store `sourceDocId` on the PhotoItem as an optional field (add it to `PhotoItem` in `src/types/assessment.ts`, additive), and set `tag` from the group.
2. Build the dialog:
   - Groups come from `photoGroups(claim)`.
   - Each photo shows a thumbnail. Read it lazily with `readDocument`, then `URL.createObjectURL`, and revoke it on close.
   - Each photo has a checkbox. Each group has `Select all`.
   - Photos already on the sheet (matched by `sourceDocId`) show as added and are disabled.
   - The `Add to photo sheet` button runs `uploadPhotos` for the selected photos.
3. Add a `Use phone files` button beside Gallery / Browse that opens the dialog. Hide it when there are no photo groups.
4. Tests for the pure dedupe helper:
   - `skipsAlreadyAdded`
   - `tagFromGroup`
5. Docs: update vault `Tasks.md`, `Changelog.md`, and the session log with the manual checks.
