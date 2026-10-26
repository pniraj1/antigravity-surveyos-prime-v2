# Session: 2026-10-25 (Claude): Bring phone scans

Owner wanted SurveyOS Scan's sorted documents and spot/valuation notes to reach Prime, and the Documents tab cleaned up ("chaotic as hell"). Spec `docs/superpowers/specs/2026-10-25-bring-phone-scans-design.md`, plan `docs/superpowers/plans/2026-10-25-bring-phone-scans.md`. Built task by task with an implementer and a reviewer per task. Everything is on `main` in both repos. **Not pushed, not deployed, not tried in a signed-in browser.**

## What I Did
- **Scan drops Sync to Drive** (Scan repo, b8b1248..0da6f79). Share zip, Share PDF/photos and Save to folder stay. Every import into Prime now arrives as an exported zip.
- **Zip reader and manifest** (6a507e0b). Browser-only: central directory, stored entries and `DecompressionStream('deflate-raw')`. No new dependency. Reads `_surveyos-scan.json`; a zip without one is refused.
- **Notes merge** (c49e4cea, c6cf7aa1). `src/lib/scan-import/notes.ts`: allow-list from the handover, fill-empty-only, "differ" picks, `isInsurable` never auto-filled, damage and part rows de-duped, `claim.scanImport.decided` so a re-import never asks again.
- **Import core** (bb5727a0, 6d89bc7c). `importScanZip`: vehicle check, folder required, every listed file checked before writing, de-dupe by real bytes (sha256), `saveDocuments(type, files, 'scan')`. No AI calls.
- **Documents tab cleanup** (4721bd85, 6ad6a0d7). Pages grid, Portal list, "Documents · N" and "Files on Drive" removed. The claim folder is one quiet line (`FolderLine`). Cards show "From phone — click to read". New **Phone files** list with "Checked N of M" ticks.
- **Import entry and notes review** (this session's last commit):
  - **Bring phone scans** button beside the folder line, with the menu items **From Google Drive** and **From this computer**.
  - Drive uses Google's Picker with the existing `drive.file` token (`src/lib/scan-import/picker.ts`). `api.js` is loaded once, on first use.
  - If the Picker fails (API off, not configured, sign-in refused, download failed), a toast explains why and the local file chooser opens instead.
  - A vehicle mismatch asks **Import anyway** / **Cancel**, naming both numbers.
  - With no folder connected, a toast appears and the folder connect dialog opens.
  - After an import, a toast reads "Added N, skipped M". If the zip has notes, the **Phone notes** dialog opens, with:
    - **Will fill**, ticked by default;
    - **Phone notes differ**, with **Keep Prime** (default) / **Use phone**;
    - the rows to add;
    - **Apply**. Closing without Apply writes nothing.
  - When there is nothing new, the dialog doesn't open; a toast reads "Phone notes: nothing new" instead.

## What's Unfinished
- [ ] **Owner/controller one-time step: enable the Google Picker API** in Cloud project `surveyos-v2-antigravity-in` (APIs & Services → Library → "Google Picker API" → Enable).
  - If the Firebase web API key has API restrictions, add Google Picker API to its allowed list too. Otherwise set `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` to a dedicated key that is restricted to the site's referrers.
  - Until it is done, "From Google Drive" fails into the local chooser (or Google shows its own error inside the picker), and the app keeps working.
- [ ] Owner browser checks while signed in, with a real claim folder (none of these could be run here):
  1. Connected folder: the line reads "Files kept in: <root> on <PC> · Change". Change opens the folder card in a dialog, and picking a folder closes it.
  2. No folder: the line reads "No claim folder · Connect". After a reload with permission lapsed, it reads "Allow access", and clicking it grants access.
  3. After importing a zip with an RC: the RC card shows "From phone — click to read". Clicking it opens the review sheet with the file and does not open the file chooser. Confirming runs the AI read, and no "RC Book (old)" copy appears in the folder.
  4. The rest of the card (outside the phone line) still opens the file chooser, and OS Sync still works.
  5. Spot photos, cheque or estimate from the zip appear under "Phone files", grouped with counts. Open shows the file. A tick updates "Checked N of M" and survives a reload or sync.
  6. A claim with no phone files shows no Phone files block, and the Files on Drive, Pages, Portal and Documents lists are gone.
  7. **Bring phone scans → From this computer** with a Scan zip: a toast reads "Added N, skipped M". Import the same zip again: "Added 0, skipped N", and no notes dialog (or "Phone notes: nothing new").
  8. A zip from a different vehicle: the dialog names both numbers. Cancel writes nothing; Import anyway imports.
  9. No folder connected: the toast appears, the folder dialog opens, and nothing is written.
  10. A zip with notes: "Will fill" items are ticked, and each "Phone notes differ" item defaults to Keep Prime. Untick one, pick Use phone on one, then Apply: only those values change. Re-import: neither is asked again.
  11. Close the notes dialog without Apply: no field changes.
  12. **From Google Drive** (after the Picker API is enabled): the chooser lists zips only. Pick the zip shared from Scan; it imports the same as the local file. Close the chooser: nothing happens.
  13. Before the Picker API is enabled: From Google Drive shows the toast (or Google's own error in the picker), and the app does not break.
  14. A non-Scan zip: a plain error toast, nothing written.
  15. After a browser restart (folder permission back to "ask"): import shows ONE toast with an Allow access button. Click it, then import again; files land.
  16. A Home-screen share of several claims: importing into one claim takes only that vehicle's files. Into a claim matching none: "This zip holds N claims (…); none match this claim's vehicle."
  17. Re-export after adding a chassis photo (or an Estimate page): all pages stay in Phone files, none disappear.
  18. A pill default (e.g. Drivable yes) under "Will fill" shows "(replaces Prime: yes)".
- [ ] Phone checks for Scan (controller): Share and Save to folder still work without Drive.
- [ ] "New phone file — click to read" never shows yet: no per-card read time is stored (controller's ruling, Task 5).
- [ ] Follow-ups: delete the unused `src/hooks/useClaimDriveFiles.ts`; decide whether to delete `src/lib/documents/kit/*` (its UI left the tab).
- [ ] If CSP headers are added to `firebase.json` later (a pending item in Tasks), allow `apis.google.com`, `docs.google.com` and `www.googleapis.com` for the Picker.

## Decisions Made
- **Import needs a connected claim folder.** Files must live somewhere durable.
- **Picker key.** `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`, else the Firebase web API key (a blank env value also falls back). The app id is the project number from `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`.
- **No CSP is set today** (`next.config.ts` and `firebase.json` have none), so no header change was needed. The service worker ignores cross-origin requests.
- **Picker script.** `api.js` is injected on first use rather than through `next/script` in the layout, so pages that never import don't load it. A failed load can be retried.
- **Notes dialog after import only when the plan is non-empty.** `notes.updatedAt` is not used as a gate: the `decided` record already stops re-asking, and the handover says to show no review when the plan is empty.
- **Phone pill defaults count as empty** (Severity, Drivable and the rest equal to the blank claim's default). So they appear under "Will fill", where the surveyor can untick them.
- **Doc verification is decided per sub-field** (`.status` / `.detail`).
- **An unusable phone value** (for example odometer "about 45k") is shown under "differ" for reference only, and Use phone is disabled for it.

## Files Changed
- src/lib/scan-import/zip.ts, manifest.ts, notes.ts, import.ts, cards.ts, picker.ts (new) + tests
- src/components/documents/BringPhoneScans.tsx, PhoneNotesDialog.tsx, FolderLine.tsx, PhoneFilesList.tsx (new)
- src/components/tabs/DocumentsTab.tsx (modified)
- src/types/documents.ts, src/types/claim.ts (`'scan'` source, `portalChecked`, `scanImport`)
- PortalChecklist.tsx, ClaimDocumentsList.tsx, PageLabelGrid.tsx, UploadReview.tsx (deleted)
- .env.example (optional `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`)
- Scan repo: Drive sync removed; `docs/handover/prime-notes-import.md` clarified and its changelog updated

## Use phone files (2026-10-25, follow-up)

**What.** A **Use phone files** button on three screens picks imported phone (`'scan'`) files for the current claim. It is hidden when the claim has none of the matching types. Plan: `docs/superpowers/plans/2026-10-25-use-phone-files.md`.
- Task 1 (3946c2d0): Assessment → Upload Estimate and Bill Check → invoice, single pick (`src/components/documents/UsePhoneFiles.tsx`).
- Task 2: Photos tab **Phone photos** dialog (`src/components/photos/PhonePhotosDialog.tsx`), `uploadPhotos(files, meta?)` in `usePhotoUpload`, `PhotoItem.sourceDocId`, helpers `skipsAlreadyAdded` / `tagFromGroup` in `src/lib/scan-import/phone-files.ts`.
- Not pushed, not deployed, not tried in a signed-in browser. No change to Scan.

**Manual checks** (signed in, claim folder connected, a Scan zip with an estimate, an invoice and photos already imported):
- [ ] U1. Assessment: **Use phone files** sits beside Upload Estimate. Pick the phone estimate: the estimate mode dialog appears and the read and review run exactly as when choosing the same file in the file chooser.
- [ ] U2. Assessment on a claim with no phone estimate: the button is not shown.
- [ ] U3. Bill Check: **Use phone files** beside the invoice upload; picking the phone invoice behaves like the file chooser. Hidden when no phone invoice.
- [ ] U4. Photos tab: **Use phone files** sits beside Gallery / Browse; hidden on a claim with no phone photos.
- [ ] U5. Open it: title **Phone photos**, groups in order Final Photos, Spot Photos, Front, Rear, Left, Right, Chassis, Odometer (only those present). Thumbnails fill in progressively; nothing is added to the sheet yet.
- [ ] U6. Tick two photos, close the dialog (X or Esc): the sheet is unchanged. Reopen: nothing ticked.
- [ ] U7. **Select all** on one group, then **Add to photo sheet**: the Save to Drive prompt (if on) appears, then the photos land compressed like Gallery / Browse. A chassis photo shows the Chassis number tag; Final Photos show Damage.
- [ ] U8. Reopen: the added photos show "Added" and cannot be ticked. Adding again adds nothing.
- [ ] U9. A group of 24+ photos: the dialog stays responsive while thumbnails load.
- [ ] U10. After a browser restart (folder permission back to "ask"): opening Phone photos shows ONE toast pointing to "Allow access" on the Documents tab; thumbnails say "Can't preview".
- [ ] U11. Start **Add to photo sheet** on a big selection, then switch claim at once: nothing lands on the other claim.
- [ ] U12. Gallery / Browse and Camera still work exactly as before, and the claim folder still gets their copies under Damage Photos (phone photos are not copied a second time).

**Decisions.**
- Final Photos (`damagePhotos`) arrive with no tag, matching the sheet's "Damage" choice; other groups keep their tag.
- Dedupe by `sourceDocId`; a photo stored without one is matched by its sheet name (Gallery rule: file name before the first dot, 30 chars). Annexure images never match.
- Phone photos skip the `saveDocuments('damagePhotos', …)` copy because they are already in the claim folder. The Drive save prompt and upload are unchanged.
