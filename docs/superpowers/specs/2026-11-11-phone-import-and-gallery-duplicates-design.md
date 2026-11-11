# Phone import in one step, and no Gallery duplicates

Date: 2026-11-11. Owner: Niraj (practising surveyor). Two changes, two repos:

- **Part A — Prime** (`SurveyOS-Prime-V2`): one button brings everything in from the Scan zip.
- **Part B — Scan** (`../SurveyOS Scan`): photos picked from Gallery stop showing twice in Gallery and Google Photos, and existing duplicates are cleaned up, without losing what an uninstall would need.

They don't depend on each other. Either can ship first.

## Why

A surveyor types notes and scans documents in SurveyOS Scan, shares one zip (WhatsApp or email), and expects it all to land in the Prime claim. There is no cloud sync; the zip is the transport, and the owner is happy with the zip.

What goes wrong today:

1. Prime has too many doors for the same zip. Documents tab → **From Phone** splits into **Phone Notes** and **Phone Scans & Photos**, each asking for the same zip. Spot, Valuation and Fees tabs have a third, **Use Phone Notes**, which is a near copy of the notes code in `FromPhoneButton.tsx`. `BringPhoneScans.tsx` (255 lines) is used nowhere. The surveyor can't tell which door to use.
2. When a surveyor picks a photo from the phone's Gallery into Scan, Scan's "safe copy" writes the finished page to `Pictures/SurveyOS Scan/<claim folder>`. That copy shows in Gallery next to the original, and Google Photos backs it up a second time. The owner wants that gone, including the duplicates already on surveyors' phones.

The safe copy exists for a real reason (owner, earlier): **if Scan is uninstalled, photos, documents and notes must stay on the phone in their folders**, and Settings → Restore rebuilds claims from them. Part B must keep that true.

## Goals

- One clear action in Prime: pick the Scan zip once, and notes, documents and photos all come in.
- No new Gallery duplicate for a page picked from Gallery, and no second Google Photos backup of it.
- Existing duplicates of Gallery-picked pages removed from Gallery.
- After an uninstall and Restore, every page comes back, Gallery-picked ones included, with its crop, stamp and filter.

## Non-goals

- Cloud sync between Scan and Prime.
- Importing the `.txt` notes files on their own (dropped: the owner is fine with the zip, and the `.txt` can't be read back reliably).
- Changing pages taken with Scan's camera or scanner. Their copy stays in `Pictures/SurveyOS Scan`; it is the only copy, and seeing it in Gallery and Google Photos is wanted.
- Removing the Drive import paths that exist today (pick zip from Drive, Drive folder, team shared Drive). They stay inside the new dialog as they are. *My call:* the owner said there is no cloud backup, but these paths are live features; deleting them is a separate decision.

## Anti-goals (a failure even if it "works")

- A Gallery-picked page that can't be restored after an uninstall.
- A Gallery duplicate removed before its hidden backup is safely written and read back.
- Any question added to the normal Gallery-pick flow.
- Notes silently written without the existing review (`PhoneNotesDialog`, import rules 1–11 in `../SurveyOS Scan/docs/handover/prime-notes-import.md`).

---

## Part A — Prime: one button

**Behaviour**

- Documents tab: **From Phone** opens one dialog directly (no Notes / Scans menu). It offers the sources already there: *From this computer (.zip)*, and when Drive is linked, *Pick .zip from Google Drive* and *Sync from Google Drive folder*.
- Spot, Valuation and Fees tabs: **Use Phone Notes** is replaced by the same **From Phone** button and dialog. One component, used in all four tabs.
- Picking a zip runs the existing scans import (`importScanZip`), which already returns the manifest `notes`, and then the existing notes review (`showNotesFromScanZip` → `PhoneNotesDialog`).
- **Claim folder not linked, or the browser can't use local folders** (not desktop Chrome/Edge/Brave): still read the zip and run the notes review. Skip saving documents and photos and say so in one line, e.g. "Notes brought in. Documents and photos were not saved: link the claim folder on the Documents tab (desktop Chrome)." Today `importScanZip` returns `needs-folder` before reading notes; the builder makes the notes still come through in that case.
- **Drive sources** (*my call*, keep today's behaviour, no merging of flows): *Pick .zip from Google Drive* is the zip path above. *Sync from Google Drive folder* runs `importFromDrive` as today; when it returns `done`, its manifest `notes` go to the same notes review (the same `showNotesFromScanZip` path the zip uses). The notes-only `PhoneFolderPickerDialog` → `fetchNotesFromScanFolder` path stays reachable only for the not-linked/unsupported-browser case (notes without files), and keeps its claim-to-folder linking exactly as today.
- **Zip with no `_surveyos-scan.json` but a `_surveyos-backup.json`** (*my call*): today's notes path accepts it. Keep that: if `importScanZip` finds no manifest, fall back to reading `_surveyos-backup.json` with `normalizeScanNotes` and run the notes review only, with the one-line message that no documents were found.
- Vehicle-mismatch and other-claim confirmations stay exactly as they are.

**Code**

- Merge the notes handling from `UsePhoneNotesButton.tsx` into `FromPhoneButton.tsx` (or one small shared module both use, builder's choice); end with one implementation.
- Delete `UsePhoneNotesButton.tsx` and `BringPhoneScans.tsx`, and any tests that only cover them.
- `FromPhoneButton.tsx` is 754 lines; removing the menu and the duplicated notes path should shrink it. Don't refactor beyond that.
- Labels: the button is "From Phone" everywhere. The file picker stays `accept=".zip"`; the dialog text says "Choose the zip SurveyOS Scan shared".

**Done when**

- One zip pick on the Documents tab brings in documents, photos and notes (notes via the review).
- The same button on Spot, Valuation and Fees brings in notes (and files, if the folder is linked).
- With no linked folder, notes still come in and the one-line message shows.
- Existing scan-import and notes tests pass; tests that targeted the deleted components are removed or repointed.
- Vault: `Changelog.md`, and the Scan handover doc's "Prime imports this" line updated to name the From Phone button.

**Impact on Scan:** none. The zip and manifest are unchanged.

---

## Part B — Scan: Gallery-picked pages backed up out of Gallery's sight

**Where things are today** (verified in code, 2026-11-11)

- `SafeCopy.kt`: `SAFE_COPY_SOURCES = SCAN, CAMERA, GALLERY, PDF`; each page's finished image is written to `Pictures/SurveyOS Scan/<claim folder>` through MediaStore (`MediaStoreWriter`), file name ending `" <id6>.jpg"`. Setting "Safe copy in Gallery", on by default.
- `BackupRunner`: text backup (`_surveyos-backup.json` + the notes `.txt` files) in `Documents/SurveyOS Scan/<claim folder>/` via `MediaStoreTextWriter`.
- Restore (`RestorePlan.kt`, `SafTree.kt`): reads backups from a SAF tree and matches page images by the `" <id6>.jpg"` name (`pageFileFor`, `pagePlan`).
- No-delete rule: `SafeCopyTest.deleteLeavesSafeCopy` bans any delete/rename call in the safe-copy code (decisions D-83/D-84).

**Behaviour**

1. **New Gallery-picked pages** (`source == "GALLERY"`) are not written to `Pictures`. Their finished image goes to `Documents/SurveyOS Scan/<claim folder>/` instead, saved as a file that no gallery app or Google Photos treats as a photo: the same JPEG bytes, with a non-image extension and a non-image MIME type (for example `… <id6>.page`, `application/octet-stream`). It is rewritten when the page changes, like today's copy.
   - Why not a `.nomedia` marker: not every phone's gallery is guaranteed to respect it. A non-image file type works on every phone.
2. **Restore** also finds these files: `pageFileFor` / `pagePlan` accept the new extension as well as `.jpg`, reading from the Documents tree. A restored page is the finished page, as with `.jpg` copies today.
3. **Cleanup of existing duplicates** — Settings, one action, e.g. **"Remove Gallery duplicates"**, with a line explaining it: "Photos you picked from Gallery were copied into the SurveyOS Scan album. This moves those copies out of Gallery into Scan's backup folder. Photos taken with Scan's camera are not touched."
   - For each existing safe copy of a `GALLERY` page: write the hidden backup (step 1), **read it back and compare bytes**, then remove the Gallery copy. Never remove first.
   - Removal uses Android's own delete confirmation (`MediaStore.createDeleteRequest`, Android 11+), so the surveyor confirms once for the batch in the system dialog. This also covers copies made by an earlier install that this install doesn't own.
   - Android 10 and older: *my call* — skip the removal step, still write the hidden backups, and tell the surveyor to delete the "SurveyOS Scan" album duplicates by hand. Builder may do better if it's simple.
   - Only pages whose `source` is `GALLERY` are touched. A page whose source is unknown is left alone.
   - The action only offers itself when there is something to clean.
   - *My call:* a Settings action, not an automatic run on update, because removal needs the surveyor's confirmation anyway and should never surprise them.
4. **The no-delete rule** is relaxed only for this cleanup, by the owner's decision (2026-11-11). Put the removal in its own small file; keep `SafeCopy.kt` and its source test banning deletes as they are, and add a test that the cleanup only ever removes copies of `GALLERY` pages whose hidden backup was verified.
5. **Restored claims are in scope** (*my call*). Today `RestoreRows.kt` sets every restored page's source to `RESTORE`, dropping the original that `_surveyos-backup.json` holds (`PageBackup.source`). Without a fix, cleanup would never see an earlier install's Gallery copies, and a restored Gallery page edited later would have no backup.
   - Restore keeps the original source for pages that were `GALLERY`. Those pages then get the hidden backup like any Gallery page (and the cleanup can find their old Gallery copies).
   - Every other restored page stays `RESTORE`, as today, so camera/scanner pages are not copied into `Pictures` a second time.
   - Check Scan's drift tests and `docs/handover/` for anything that relies on restored pages being `RESTORE`.
6. **Setting "Safe copy in Gallery"**: unchanged meaning for camera/scanner pages. Gallery-picked pages always get the hidden backup — *my call*, since it never shows anywhere and it's what makes Restore work.

**Done when**

- Picking a photo from Gallery into a claim adds nothing to Gallery; a file appears in `Documents/SurveyOS Scan/<claim folder>/` instead.
- Camera and scanner pages still appear in `Pictures/SurveyOS Scan`.
- Cleanup moves existing duplicates, and the Gallery album no longer shows Gallery-picked pages.
- **Phone test (must pass before release):** make a claim with camera pages and Gallery-picked pages (crop and stamp one), uninstall, reinstall, Restore: every page returns with its edits; Gallery shows no duplicate of the picked photos; Google Photos does not upload the hidden files. Try on a Samsung phone and one other brand.
- Unit tests: source routing (GALLERY → hidden, others → Pictures), restore name matching for both extensions, cleanup verify-before-remove.
- `./gradlew :app:testDebugUnitTest` green, including Scan's drift tests against Prime.
- Docs: `docs/handover/` gets a line that Gallery-picked pages are backed up in Documents with the new extension (for anyone reading a claim folder), the phone checklist gets the test above, and the safe-copy plan's decisions note D-85 for this change.

**Impact on Prime:** none. The shared zip still carries normal photos; the hidden files are never put in the zip.

## Left to the builder

- Exact extension, file naming and MIME type, within the rule "no gallery treats it as a photo".
- How Restore's SAF tree reaches the Documents folder (it already reads backups there).
- Whether Part A's shared notes code is a module or lives in `FromPhoneButton.tsx`.
- Wording of messages, within the plain, surveyor-facing tone used elsewhere.
