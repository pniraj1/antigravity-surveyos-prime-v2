# Bring phone scans — Prime imports SurveyOS Scan, Documents tab cleanup, Scan drops Drive sync

Status: design, approved in chat 2026-10-25 by the owner ("proceed and make changes"). Builder check skipped because
the owner asked for speed. The controller's calls are listed at the end.

Related:
- SurveyOS Scan handover: `../SurveyOS Scan/docs/handover/prime-notes-import.md`. It is the contract for manifest
  `notes`, the field table and the import rules.
- Standing rule (CLAUDE.md, both repos): every change checks its impact on the other app.

## Why

The surveyor scans and sorts every claim document at the vehicle in SurveyOS Scan, and writes spot and valuation notes
there. Today none of that reaches Prime by itself. The Documents tab has also grown into four overlapping notions of
"documents": the folder list, the Pages grid, the Portal list and the AI cards. The owner called it "chaotic as hell".
Scan already sorts documents to match the portal sections (merge, unmerge and split happen on the phone), so the Pages
and Portal steps in Prime are double work.

The owner decides the workflow. Documents reach Prime through Scan. Surveyors without Scan keep doing everything by
hand on the existing cards.

## Goals

1. **Bring phone scans** button on Prime's Documents tab. The surveyor picks the zip that Scan exported, either:
   - **from Google Drive**, using Google's own file chooser (the zip was shared from Scan to Drive); or
   - **from this computer**, for an email download or any local copy.
   One import path serves both.
2. **The claim exists first.** The surveyor creates the claim in Prime with its vehicle number, then imports into it.
   Prime never creates claims from a zip.
3. **Vehicle check.** The zip's manifest `vehicle` is compared with the claim's registration number, ignoring spaces
   and case. On a mismatch, show a confirm dialog that names both numbers, with the choices Import anyway / Cancel.
4. **Files land where they belong:**
   - **Files with a card** (the existing AI cards: RC, DL, Policy, Claim Form, FIR, Final Garage Bill, Permit,
     Fitness): the file is saved to the claim folder with its type and appears **in that card** as "From phone — click
     to read". Clicking opens the existing review-and-crop sheet, and from there the existing AI read and review flow
     runs unchanged.
   - **Files with no card** (spot, final and RI photos, chassis and odometer photos, cheque, estimate, PUC, others):
     saved to the claim folder with their type and listed in a new **Phone files** list below the cards. They are
     never sent to AI.
5. **Phone files list:**
   - grouped by type, showing name, count and Open;
   - a "checked for portal" tick per file, with a counter "Checked N of M";
   - this is the surveyor's check before uploading to the portal.
6. **Phone notes review.** When the manifest has `notes`, a review dialog opens after the files land. It follows the
   handover rules exactly:
   - allow-listed keys only;
   - an empty Prime field is filled;
   - a differing value is shown under "Phone notes differ", where the surveyor picks per field (keep Prime / use phone);
   - nothing is written until the surveyor clicks Apply;
   - re-importing never re-asks a difference already decided;
   - spot damage rows are appended and de-duped;
   - valuation part rows are appended to `panelRows`, de-duped by name case-insensitively, and an empty condition takes
     the phone's value;
   - `isInsurable` is never auto-filled, so it always shows as a pick when it differs;
   - clearing a value on the phone never clears it in Prime.
7. **Documents tab cleanup:**
   - **Removed from the tab:** the Pages grid (`PageLabelGrid`), the Portal list (`PortalChecklist`), the "Documents ·
     N" list (`ClaimDocumentsList`) and the "Files on Drive" panel.
   - **Kept:** the AI header controls, the processing and conflict banners, the reconciliation hub, the cards and the
     Sync pull.
   - **The claim folder card becomes one quiet line:**
     - when connected: "Files kept in: <root> on <PC> · Change";
     - when not connected: "No claim folder · Connect";
     - when permission is needed: "Allow access".
     The current card opens only from that line.
8. **Scan drops Sync to Drive.** Remove the sync button, the Drive connect/disconnect, the Drive status badges, the
   WorkManager sync job, the Drive code and the Google auth dependency.
   - Kept: Share zip, Share PDF/photos and Save to folder.
   - Existing Drive folders are left untouched.
   - The handover changelog says Scan no longer writes `SurveyOS/Phone Scans`, and that every import arrives as a zip.

## Non-goals

- Prime creating claims from a zip.
- Merging or splitting PDFs in Prime. That is done in Scan; surveyors without Scan do it by hand as today.
- Changing the AI read flow, the cards, the extension or the reconciliation hub.
- Deleting the Document Kit library code (`src/lib/documents/kit/*`). Only its UI leaves the tab. Whether to delete the
  library is a follow-up decision.
- The Scan safe photo copy that survives an uninstall. It is the next separate design.
- Adding UIIC and other insurers' portal sections to Scan's slots. That is a follow-up, and needs one look at the live
  UIIC upload page with the owner.

## Anti-goals

- Any AI request fired automatically by an import. Every read stays a surveyor click.
- Photos, cheque or estimate sent to AI.
- An import that silently overwrites a Prime value the surveyor typed.
- An import that deletes a file. Stale copies are renamed "(old)", as both apps do.
- New cost: Drive keeps the `drive.file` scope, the Picker is free, and no new paid service is added.

## How it works

**Zip reading.** Do it in the browser with no new dependency:
- read the central directory;
- stored entries are taken as-is; deflate entries go through `DecompressionStream('deflate-raw')`;
- Scan writes its zips with `java.util.zip` (deflate plus data descriptors), so take sizes from the central directory.
The manifest is `_surveyos-scan.json` at the folder root inside the zip. A zip without a manifest is refused with a
plain message.

**The Drive picker.** Use the Google Picker API with the existing `drive.file` token. A picked file is granted to
Prime's project, so it downloads with `files/{id}?alt=media`.
- The Picker needs:
  - an API key: use `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` if set, else `NEXT_PUBLIC_FIREBASE_API_KEY`;
  - the app id: the project number from `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`;
  - the Google Picker API enabled in `surveyos-v2-antigravity-in`. This is a one-time owner/controller step and is
    added to the release notes.
- If the Picker fails to load, the button falls back to "From this computer" with a toast that explains why.

**Where files go:**
- **The folder is required.** Each file is saved with `saveDocuments(type, files, source)`, which writes into the
  connected claim folder and adds it to `claim.documents`. With no folder connected, the import stops before writing
  and asks the surveyor to connect one.
- **Source and type.** Each document gets the new source value `'scan'`. Its type comes from the manifest `docType`,
  which is Prime's DocType key because Scan copies Prime's `documents.ts`. An unknown type becomes `other`.
- **Duplicates.** A file whose bytes equal an existing document of the same type is skipped; the manifest `sha256`
  supports the check. A different file goes through the existing write rules. Importing the same zip twice adds
  nothing.

**Cards:**
- A card shows a phone file when `claim.documents` has a `'scan'` document of that card's DocType, using the inverse of
  `FIELD_KEY_TO_DOC_TYPE` and skipping `other`.
- Clicking "click to read" opens the existing `DocumentReviewSheet` with that file, read via `readDocument`.
- After that, everything is today's flow.
- A card that is already AI-read and also has a newer phone file shows "New phone file — click to read".

**Checked ticks.** Add a `portalChecked?: boolean` field on `ClaimDocument`. It persists with the claim.

**Notes.** The notes review applies through the claim store's existing update path. "Decided" differences live on the
claim as `scanImport: { at, decided: Record<key, phoneValue> }`, so a re-import with the same phone value never asks
again.

## Constraints

- Next.js 16: check `node_modules/next/dist/docs/` before touching framework APIs.
- Prime tests use vitest (`npm test`). Pure logic gets tests: the zip reader, the vehicle match, the notes merge and
  the card mapping.
- Files stay at most 800 lines. `DocumentsTab.tsx` is 630 lines, so new UI goes in new components.
- No AI call from import code.
- Scan side:
  - build in Git Bash with `JAVA_HOME` set to the Android Studio jbr;
  - no java.time;
  - the drift tests stay green;
  - the handover is updated in the same commit as the Drive removal.
- Prime protocol on stop: update the vault `Tasks.md` and `Changelog.md`, and add a session log.
- Work on main. Never push or deploy without the owner.

## Controller's calls (the owner may override)

1. Import requires a connected claim folder, because files have to live somewhere durable. The owner works with a
   folder already.
2. The Picker reuses the Firebase web API key unless a dedicated key is set.
3. The Document Kit library stays in the code; only its UI is removed from the tab.
4. The "Files on Drive" panel goes. The Drive backup upload itself is unchanged.
5. Estimate has no card, so it goes to the Phone files list. When it later gets a card, the mapping picks it up
   automatically.
