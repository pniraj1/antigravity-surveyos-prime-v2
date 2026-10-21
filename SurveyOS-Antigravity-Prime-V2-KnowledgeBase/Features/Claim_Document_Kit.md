# Claim Document Kit

## Current Implementation

- **What it does:** It reads the claim's folder (on this computer, or Google Drive for desktop) and learns which page of which file is which document. It checks each page belongs to this claim. It then builds one upload file per insurer-portal box into `Portal Upload/<portal>/`, so the surveyor reviews it before uploading the files to the portal by hand.
- **Status (2026-10-21):** Phases 1–2 are complete on `main` (7181ae3c..c4f42bca). 1720 tests pass and tsc is clean. **It is not deployed and not browser-tested.**
- **Cost:** ₹0. No AI calls, and everything is done locally with pdfjs and pdf-lib.

### How it works, step by step (surveyor's view)
1. **Connect the claim folder.** In the Documents tab, use the Claim folder card. Choose "On this computer" or "Google Drive for desktop", and a guide is shown for the second. The choice is kept in localStorage (`surveyos_claim_folders_location`).
2. **Scan folder.**
   - Files are found. Anything SurveyOS didn't save is *adopted*, which means it's labelled but never auto-confirmed.
   - Each page is labelled from the file name, the file's subfolder, or the PDF text layer.
   - A combined PDF (Aadhaar + PAN + policy in one file) gets a label per page.
3. **Pages view.** It shows thumbnails, puts the needed types first, and supports Shift+click ranges inside one file. The surveyor fixes labels, then confirms each one or all at once.
4. **Identity check.** Each labelled page is compared with the claim: registration, chassis, policy number, claim number, and the insured or driver name.
   - The results are match, mismatch, can't check, or *still checking*.
   - A mismatch blocks the box unless the surveyor presses "Use anyway".
   - Continuation pages (policy terms, an Aadhaar back) inherit a match from a matching page of the same file.
5. **Portal checklist.**
   - Pick the portal and flow: NIA non-tieup, NIA KIA, or UIIC claim survey.
   - Each box shows **Ready**, **Check** or **Missing**, and a box can be marked not needed.
   - A copyable **missing-documents message** is there for the surveyor to send to the insured.
6. **Build.**
   - pdf-lib copies the chosen pages, merges documents where a box takes several, and turns images into A4 pages.
   - **Only Ready boxes are written** to `Portal Upload/<portal>/`. Check boxes are previews only ("Not saved to the folder until it's confirmed.").
   - The folder is cleared of our older files after the new ones are written.
7. **Review.** It shows a preview of each built file and a "Looks right" tick.
   - The whole set reads *reviewed* only when every box is ticked, nothing is blocked now, and no ready box lacks a file.
   - Any later change makes that box stale: "Changed since it was built: build again." That covers a replaced file, a label edit, a swapped source, a not-needed toggle, or an edited claim field.

### Safety rules (binding)
- The surveyor's own files are read-only. SurveyOS writes only inside `Portal Upload/`.
- Labels are tied to the exact file through a per-device fingerprint (size, lastModified, page count). If the file is replaced, its labels reset.
- Page text and KYC numbers (Aadhaar, PAN) are **never stored, shown or logged**. They're held in memory only.
- The assessment stays surveyor-made. Nothing here uploads to a portal or clicks anything there.

### Key files
- `src/types/documents.ts` holds `DocType` (39 types), `PageLabel`, `Fingerprint`, `ClaimDocument` and `UploadSet`.
- `src/types/claim.ts` holds `portalFlow`, `notNeededBoxes` and `uploadSet` on the claim.
- `src/lib/documents/folder.ts` handles scanning, `writePortalUpload` and `clearPortalUpload` (path-safe).
- `src/lib/documents/naming.ts` handles labels and aliases, scan-skip of `Portal Upload`, and `staleUploads`.
- `src/lib/documents/kit/`:
  - `recognise.ts`: free recognisers (known, text, name, surveyor).
  - `page-text.ts`: lazy pdfjs text and page count.
  - `identity.ts`: identity checks.
  - `fingerprint.ts`: per-device reconcile.
  - `recipes/`: portal box lists (`nia-nontieup`, `nia-kia`, `uiic-claimsurvey`).
  - `checklist.ts`: box states and the missing message.
  - `build.ts`: plan, pdf-lib build, encrypted-PDF refusal and sha256.
  - `review.ts`: upload set, ticks, stale handling (`staleBoxes`, `reviewDone`, `unbuilt`).
  - `orchestrate.ts`: labelling, the identity map, and `claimDrift` lost-update guards.
  - `useDocumentKit.ts`: the hook, mounted once in DocumentsTab.
- UI in `src/components/documents/`: `ClaimFolderCard.tsx`, `PageLabelGrid.tsx`, `PortalChecklist.tsx` and `UploadReview.tsx`.
- Spec: `docs/superpowers/specs/2026-10-20-claim-document-kit-design.md`. Plan: `docs/superpowers/plans/2026-10-20-claim-document-kit.md`.
- **Dependencies:** `pdfjs-dist` (already present) and `pdf-lib@^1.17.1` (new). It runs on the File System Access API, so desktop Chrome or Edge only.

## Owner test checklist
1. Open a real claim and go to the Documents tab. Connect its folder and press **Scan folder**.
2. Add a combined PDF (Aadhaar + PAN + policy). Check each page's label in the Pages view, fix any wrong ones, and confirm.
3. Open the checklist for NIA (non-tieup or KIA) or UIIC. Are the boxes right? Is the missing-documents message right?
4. **Build**, then open `Portal Upload/<portal>/`. Is each file correct, with the right pages in the right order?
5. Tick the review. Replace a source file, then Scan again: that box must show "build again".
6. Add another vehicle's RC or policy and check it's flagged as not matching.
7. Confirm the default portal boxes (spec §8(b)–(d)).

## Known Issues / Deferred
- **I-8 photo tags.** Photos are saved as `damagePhotos`, because a photo has no tag at upload and tags are set later in the Photos tab. The workaround is to label them in the Pages view. The proper fix is for `setPhotoTag` to retype the folder entry, which needs a link between a photo and its folder entry.
- An Aadhaar back whose S/O or W/O line shares the surname is still a mismatch, so it needs "Use anyway".
- A file whose first read failed shows "Still checking" until a reload.
- A claim switch in the middle of a write leaves the old claim's set unchanged. The window is tiny.
- The hook wiring and the body of `clearPortalUpload` have no tests (there's no jsdom).
- The full list of rulings and deferred minors is in `Sessions/2026-10-21-claim-document-kit.md`.

## Improvement Ideas (Phases 3–5)
- More portals and flows (UIIC waits on mapping).
- The extension picks the built files up from `Portal Upload/`.
- An opt-in AI button for pages with no text layer (scans), on the surveyor's own key.

## Related
- [[Portal_Fill_Extension]]
- [[Google_Drive_Integration]]
- [[PDF_Reports]]
