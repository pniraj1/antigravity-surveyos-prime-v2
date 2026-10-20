# Claim Document Kit: know what's in the folder, build what the portal wants — Design

**Date:** 2026-10-20
**Status:** Draft for owner approval
**Builds on:**
- `docs/superpowers/specs/2026-09-20-claim-documents-design.md`: the typed document index `claim.documents`, the claim folder on disk, **Scan folder**, and rules D1–D10.
- `docs/superpowers/specs/2026-09-20-portal-fill-extension-design.md`: extension rules E1–E10.
- `docs/superpowers/specs/2026-10-16-portal-live-verification-and-audit-design.md`: live checks, Stage C audit, roadmap item I-4.
- `docs/portal-integration.md` §2.3 and §5: the portals' upload sections, captured in September.

Decisions marked **(owner)** came from the owner in conversation. Everything else is the author's call and is marked as such where it isn't obvious.

---

## 1. Why this exists

Every claim ends with the surveyor uploading a set of documents to the insurer's portal. A New India non-tieup claim wants about 15. Some come from the insured (KYC, Aadhaar, PAN, RC, DL, policy, claim form, cheque…), some from the garage (estimate, invoice), and some are made in SurveyOS (survey report, bill check report, reinspection report, fee bill).

**(owner)** How it works today:
- Everything arrives **by email**.
- The surveyor saves the attachments, plus the reports SurveyOS made, into **one folder per claim**, either on the laptop (Case 1) or in Google Drive (Case 2).
- File names can't be trusted, and **files are often combined PDFs**: one PDF holding the policy, RC, DL and Aadhaar.
- The portals' upload boxes don't match one document per box. **(owner)** The KIA tie-up has only RC, DL, Claim Form and "Claim related documents", so the surveyor **merges** Aadhaar, PAN and the rest into one PDF for that last box.

Nothing tracks which required documents exist for a claim, which are missing, or which pages of which file are which document. The surveyor works it out by hand, every claim, for every portal.

**What success looks like:**
1. The surveyor opens the claim and sees, for the portal it's going to, **every upload box with Ready / Missing / Check**.
2. Missing documents produce a **copy-ready message** the surveyor sends the insured themselves. **(owner)** SurveyOS never contacts anyone.
3. Each box's file is **built automatically** from the right pages: one file as is, pages cut out of a combined PDF, or several documents merged into one PDF.
4. Later, the extension **drops each file into its box** on the portal. The surveyor still presses the portal's own Upload/Save.
5. A typical claim costs **zero AI calls**. AI is only an opt-in button. **(owner)**

## 2. Goals, non-goals, anti-goals

**Goals**
- One page-level inventory per claim, built from the claim's folder wherever the surveyor keeps it.
- Free, local recognition first; the surveyor labels the leftovers; AI only on request.
- A per-portal "recipe" of upload boxes, and a checklist driven by it.
- Upload files assembled from labelled pages (split and merge).
- A missing-documents message to copy.
- Extension upload into the portal's boxes, as a later phase.

**Non-goals (this design)**
- Reading email or fetching attachments. **(owner)** Surveyors keep saving attachments into the folder.
- Contacting the insured, garage or insurer.
- Storing documents on our servers. We provide no storage (spec D1/D4).
- OCR of scanned pages by default. A scanned page with no text layer is "unlabelled" until the surveyor or the opt-in AI labels it.
- Restricted Google Drive permissions (whole-Drive read). They need Google's paid yearly security assessment, which breaks the "practically free" rule.
- Editing, renaming or deleting the surveyor's own files.

**Anti-goals: a failure even if it works**
- **The wrong document in a portal box,** e.g. a DL uploaded as the RC, or another claim's Aadhaar. This is worse than no upload.
- Aadhaar, PAN or other KYC images leaving the surveyor's machine without the surveyor asking. That covers AI and our servers (DPDP).
- AI calls by default, or per page.
- A surveyor's original file modified, moved or deleted.
- A checklist that says "Ready" when a page is only *guessed* and unconfirmed.

## 3. Constraints

| # | Constraint | Consequence |
|---|---|---|
| K1 | **(owner)** The surveyor chooses where claim folders live; SurveyOS asks only for the permission that choice needs. | A one-time "Where are your claim folders?" setup with three options (§4.1). |
| K2 | The Drive connection uses `drive.file` (`src/lib/drive/index.ts`). That scope sees only files SurveyOS created, or files the surveyor picks in Google's Picker. | Surveyor-made Drive folders need Drive for desktop (→ a local folder) or the Google Picker. Never the restricted scope. |
| K3 | The File System Access API exists only in desktop Chrome/Edge. | Local and Drive-for-desktop sources work on laptops only. Phones fall back to Picker mode or show the checklist read-only. |
| K4 | Rules D1–D10 hold: the index lives on the claim record, the bytes stay on disk; one root folder; closed type vocabulary; never delete bytes silently. | Page labels are small metadata on `claim.documents` entries. Built upload files live on disk or in memory, never in the record. |
| K5 | DPDP: KYC (Aadhaar, PAN, CKYC) is sensitive personal data, much of it from people who never consented to SurveyOS. | KYC pages are never sent to AI unless the surveyor presses the AI button, with a warning. They never go to Firestore (only labels do). The extension handoff stays on the machine (E5). |
| K6 | Cost stays about ₹0 (BYOK free tier). | Recognition is local. One opt-in AI call per claim at most, on the cheap tier (Flash-Lite, 500/day free). |
| K7 | **(owner)** Third-party tools are fine where they avoid needless work. | `pdf-lib` (MIT, browser) for merging and cutting pages. Google Drive for desktop and Google Picker for Drive. Existing `pdfjs-dist` for text layers and thumbnails. |
| K8 | The portals' upload size limits and rejection messages are unknown (portal-integration §2.3). | Show the size per box, and warn above a limit once Stage B/C learns it. Never auto-compress silently. |
| K9 | The extension packet is capped at about 1 MB per file today (`packet-validate.js` `MAX_FILE_B64`), with a fixed slot list. | Phase 3 changes the transport for documents (§4.7). |

## 4. Design

### 4.1 Where the claim folders are (one-time setup, then per claim)

A **Claim folders** setting in Profile, first shown when the surveyor opens Documents or the portal checklist:

| Choice | What SurveyOS does | Permission asked |
|---|---|---|
| **Folder on this computer** | Today's flow: pick the root once; each claim folder is `<registration> - <INSURER SHORT>`; Scan reads it. | Chrome's folder access, inside a click (D9) |
| **Google Drive, using Drive for desktop** | A short guide (install Google Drive for desktop, sign in, choose "Stream" or "Mirror", find `G:\My Drive\…`). Then it's the same as the row above, with the root inside `G:`. | The same folder access |
| **Google Drive online (no install)** | Per claim, the surveyor presses **Choose files in Google Drive**, which opens Google's own Picker in the claim's Drive folder. SurveyOS reads only the picked files. | `drive.file`, already granted; files are granted one by one through the Picker |

- The setting is stored per device, because a laptop and a phone differ.
- The claim's folder link (`documentsFolder`, or the Drive folder id) is stored on the claim.
- Drive-online needs one Picker visit per claim, and again when files are added. That is the price of not asking for the restricted scope. The guide recommends Drive for desktop for people who live in Drive.

### 4.2 The page inventory

Every file in the claim's folder becomes a `ClaimDocument` (as today). It now gains page labels:

```ts
interface ClaimDocument {
  // existing: id, type, relPath, mime, size, addedAt, source, devices
  pageCount?: number;                  // PDFs; images count as 1
  pages?: Record<number, PageLabel>;   // 1-based; absent page = unlabelled
  driveFileId?: string;                // Drive-online source only
}
interface PageLabel {
  type: DocType;
  by: 'known' | 'text' | 'name' | 'surveyor' | 'ai';
  confirmed: boolean;                  // true for known/surveyor; text/name/ai are suggestions until confirmed
}
```

- The file-level `type` stays. It equals the type of all its pages when they agree, and `other` when mixed.
- Labels are metadata and sync with the claim. Bytes never do (D1).

**New document types:** the vocabulary grows by what the portals ask for and SurveyOS lacks:
- `aadhaar`, `pan`, `ckyc`
- `claimIntimation`, `dischargeVoucher`, `csr`, `investigationReport`
- `rcBack`, `dlBack` (author's call: the back side as a separate type, because some portals ask for both sides)
- `kycOther`

Each gets a `DOC_TYPE_LABEL`.

### 4.3 Recognisers, cheapest first

They run on Scan, and when a new file appears. Each page takes the first label it gets:

1. **Known (free, certain):**
   - files SurveyOS wrote itself (`source: 'generated'`), such as the survey report, bill check, fee bill, RI report and NIA Excel;
   - files already sent to AI extraction through a field (RC/DL/policy/estimate/bill, via `FIELD_KEY_TO_DOC_TYPE`);
   - photos tagged in the Photos tab.

   These are `by:'known', confirmed:true`.
2. **Text layer (free, local):** for each PDF page with a text layer (`pdfjs-dist` `getTextContent`, already used in `src/lib/ai/processor.ts`), match a keyword table per type. A page matching exactly one type gets `by:'text', confirmed:false`. Pages matching none, or more than one, stay unlabelled. Example rules (the full table is written in the plan and unit-tested):
   - `rc`: "Registration Certificate", "Form 23", "Chassis No" + "Engine No"
   - `dl`: "Driving Licence", "Licence No", "COV"
   - `aadhaar`: "Aadhaar", "Unique Identification Authority", a 12-digit `XXXX XXXX XXXX` pattern
   - `pan`: "Permanent Account Number", "Income Tax Department"
   - `invoice`: "Tax Invoice", "GSTIN" + "Invoice No"
   - `estimate`: "Estimate" + "Labour"
   - `policy`: "Policy Schedule", "Certificate of Insurance", "IDV"
   - `cancelledCheque`: "Pay" + "IFSC" + "A/c"
   - `fir`: "First Information Report"
   - `claimForm`: "Claim Form" + "Signature of the Insured"
3. **File name (free):** today's `docTypeFromRelPath`, plus common words ("rc", "dl", "aadhar"/"aadhaar", "pan", "cheque", "invoice", "estimate", "policy", "claim form"). Applied to all pages of a single-page or same-type file: `by:'name', confirmed:false`.
4. **Surveyor:** everything else stays unlabelled and appears in the labelling screen (§4.4). The surveyor's label is `by:'surveyor', confirmed:true`. This also confirms any text/name suggestion.
5. **AI (opt-in only, (owner)):** a **Guess the rest** button sends only the *unlabelled* pages, as small thumbnails, in **one** call, through the existing AI gateway as a `light` job.
   - Before the call it shows: *"This sends N pages, which may include ID documents, to your AI provider. Continue?"*
   - Results are `by:'ai', confirmed:false` and must be confirmed like any suggestion.
   - It never runs automatically.

### 4.4 Labelling screen

- The Documents tab gets a **Pages** view: the existing `PdfPageGrid` thumbnails (shared with the AI page picker), grouped by file.
- Each page shows its label chip, with a dotted outline when it's a suggestion and solid when confirmed.
- **Select pages** (click, shift-click for a range), then tap a type in a short type bar showing the types the current portal still needs first.
- **Confirm all suggestions** confirms every text/name/AI label in one go, after the surveyor has looked.
- Images are one page. Word or Excel files show a file icon and get one label for the whole file.

### 4.5 Portal recipes

Data, not code: one recipe per portal flow, in `src/lib/portal/recipes/<portal>-<flow>.ts`. Each box:

```ts
interface RecipeBox {
  id: string;                 // stable, e.g. 'drivingLicence', 'claimRelatedDocs'
  label: string;              // the portal's own caption
  mandatory: boolean;
  accepts: DocType[];         // ordered; first match fills a single box
  combine: 'single' | 'merge';// merge = all present accepted types, in this order, into one PDF
  formats: string[];          // the portal's accept list, e.g. ['.pdf', '.jpg', ...]
}
```

**First recipes**, from the captures (`docs/portal-integration.md`):

- **UIIC claim survey.**
  - Mandatory, single: Survey Report (`surveyReport`), Assessment Details (`billCheckReport`), Estimate (`estimate`), Invoice (`invoice`), Re-Inspection Report (`reinspectionReport`).
  - Optional: the 21-type picker, one box per type that's present. The fee bill goes as **Other 1**.
- **NIA non-tieup.**
  - Mandatory: Driving Licence, Registration Certificate, Claim Form, Claim Related Documents (merge: policy, Aadhaar, PAN, CKYC, cheque, claim intimation, other KYC), Chassis Number photo, Odometer photo.
  - Optional: Estimate, PUC, Spot photos and Spot Survey Report, Permit/Fitness, FIR, Cancelled Cheque, Front/Rear/Side photos, Re-inspection, Invoice, Others.
  - What goes into "Claim Related Documents" is the author's guess. **The owner confirms it** before Phase 1 ships.
- **NIA KIA tie-up (owner):** RC, DL, Claim Form, and Claim Related Documents (merge: everything else the claim has that the insurer needs). Its exact list is written with the owner. The extension can't fill tie-up pages yet; the recipe still drives the checklist and the built files.

The recipe tells the checklist **what's needed**. A separate **slot map** (extension, Phase 3) tells the extension **where each box is** on the page. They are kept apart because recipes are needed long before the extension can upload.

### 4.6 The portal checklist and the missing message

A **Portal documents** panel on the Documents tab. The portal is taken from the claim's insurer and flow; the surveyor can switch it.

```
New India · Non-tieup                         12 of 15 ready · 2 missing · 1 to check
──────────────────────────────────────────────────────────────────────────────────
✓ Driving Licence          DL.pdf p1                       Ready
✓ Registration Certificate Documents.pdf p3–4              Ready
! Claim Related Documents  merged: policy p1, Aadhaar p5,  Check (Aadhaar is a guess)
                           cheque.jpg  — PAN missing
✗ Chassis Number Photo     —                               Missing
…
[Copy missing-documents message]   [Build upload files]   [Label pages]
```

**Box states:**
- **Ready:** every page it uses is confirmed.
- **Check:** some page is only a suggestion.
- **Missing:** a mandatory box has nothing, or a merge box lacks one of its mandatory parts.
- Optional boxes with nothing are shown greyed, not as missing.

**The missing-documents message** is plain text, copied to the clipboard:

> Claim 7700…9686 (MH 18 AB 1234): please send the following documents: Chassis number photo, PAN card.

Its language and wording are settled in the plan. It is never sent by SurveyOS.

### 4.7 Building the upload files

**Build upload files** produces one file per box, from **confirmed** pages only:
- **Single** box: if the source is a whole file of the right format, it's used as it is (no rewrite). If the pages sit inside a combined PDF, they're cut out into a new PDF.
- **Merge** box: the pages in recipe order go into one PDF. Images are placed on A4 pages.
- **Library:** `pdf-lib`, a new dependency, approved under K7. Thumbnails and text keep using `pdfjs-dist`.

**Where the built files go:**
- **Local or Drive-for-desktop:** into the claim folder under `Portal Upload/<Portal>/<Box label>.pdf`. They are overwritten on rebuild, and **Scan** ignores that subfolder.
- **Drive-online:** kept in memory and offered as downloads, or as a zip.

The size of each file is shown next to its box.

**Useful on its own:** even before the extension can upload, the surveyor drags these files into the portal by hand. That alone removes the splitting, merging and hunting.

### 4.8 Extension upload (Phase 3)

- The extension learns each portal's upload boxes in its field map, as a `docs` section. The model paths are already captured: NIA `manDoc.*` / `nonmanDoc.*` repeats with a `docType` select and a file input; UIIC `impDoc.fileToUpload` ×5 plus the `input.docType` picker.
- **Before building it,** the Stage C audit (live verification spec §4.3) must answer:
  - each portal's size limit;
  - whether adding a non-mandatory row needs a portal button;
  - how the `base-sixty-four-input` directive reacts to a programmatic file.
- **Transport:** files no longer travel inside the ~1 MB packet. The extension gains the `unlimitedStorage` permission, and SurveyOS hands it a **document kit**, `{claimNo, portal, flow, boxes: [{boxId, name, mime, base64}]}`. It's stored apart from the field packet, with the same 24 h expiry and claim-number match (E3/E6).
- The card shows per box: attached / not found / too large / needs you.
- E2 holds: the extension attaches the file and **never presses the portal's Upload or Save**. Any portal button needed to add a row is the surveyor's.

## 5. Phases

| Phase | Ships | Depends on | Size |
|---|---|---|---|
| **1** | Folder choice (§4.1: local and Drive-for-desktop with guide), page labels, free recognisers, labelling screen, recipes (UIIC, NIA non-tieup; KIA list from owner), checklist, missing message | owner confirms NIA "Claim Related Documents" and the KIA list | M |
| **2** | Build upload files (`pdf-lib`), the `Portal Upload` subfolder, sizes shown | 1 | S |
| **3** | Drive-online (Google Picker) | 1 | S |
| **4** | Opt-in "Guess the rest" AI | 1 | S |
| **5** | Extension uploads into portal boxes (`docs` map section, document-kit transport) | 2; live verification Stage B and C findings | M |

Phases 2–4 are independent of each other once Phase 1 lands. Phase 5 waits for the live portal facts.

## 6. Risks

| Risk | Handling |
|---|---|
| Wrong page in a box | Only confirmed pages build files; suggestions show as "Check"; the checklist names the exact file and pages per box |
| A keyword rule mislabels (e.g. an invoice page mentioning "Registration") | Exactly-one-match rule; text labels are suggestions; rules are unit-tested on real-shaped text |
| KYC leaks | Labels only in the record; bytes stay local; AI only on the button, with the warning; the extension handoff stays local |
| Surveyor's files changed | Read-only on originals; built files go only into `Portal Upload/` |
| Drive-online is tedious per claim | The guide recommends Drive for desktop; Picker opens in the claim folder; picked files are remembered by `driveFileId` |
| Portal rejects size or format | Size per box shown; formats checked against the recipe; limits added once Stage B/C learns them |

## 7. Cost

- **Money:** ₹0. `pdf-lib` and `pdfjs-dist` are free, local libraries. Google Picker and Drive for desktop are free. The opt-in AI is at most one Flash-Lite call per claim, inside the free 500/day.
- **Surveyor time:** a few seconds per claim to tap labels for the pages free recognition couldn't place. Drive-online adds one Picker visit per claim.
- **Build effort (author's estimate):** about 5–7 sessions across Phases 1–5. Phase 1 is the largest.

## 8. Owner decisions needed

1. **(owner)** What goes into NIA non-tieup's **Claim Related Documents** merge box, and in what order?
2. **(owner)** The full KIA tie-up box list and what each takes, especially its "Claim related documents".
3. **(owner)** The wording and language of the missing-documents message (English only, or also Hindi/Marathi).

## 9. Author's calls after the builder check

These are binding for the plan.

- **C1. SurveyOS reports are HTML until filed.** What SurveyOS writes at print time is an HTML placeholder (D8, `print-followup.ts`). A real PDF exists only once the surveyor files it.
  - A box whose only source is the HTML placeholder shows **Check: "File the PDF of this report"**, with the existing *File the PDF* action next to it.
  - HTML is never uploaded and never page-labelled.
  - Word and Excel files (`.docx`, `.xlsx`, e.g. the NIA Excel) can fill **single** boxes whose `formats` allow them. They are **left out of merge boxes**, and that box then shows which part couldn't be merged.
- **C2. Labels are tied to the exact file they were made on.** A file's fingerprint is `size + lastModified + pageCount`, stored on the entry.
  - **Scan** re-checks every indexed file's fingerprint (today it skips known paths).
  - On a mismatch, all page labels for that file are dropped and the free recognisers run again. The checklist says *"Documents.pdf changed: labels reset"*.
  - **Build** re-checks the fingerprint before cutting pages, and refuses on a mismatch.
- **C3. Devices.** Labels sync with the claim but apply only to a file whose fingerprint matches.
  - Ready / Check / Missing is computed on the device that holds the bytes.
  - Elsewhere, the box shows "on *Office PC*" (D5) and can't be built there.
- **C4. Drive-online reads only files the surveyor picks.**
  - The Picker opens on the surveyor's own Drive (recent and My Drive views), not the SurveyOS-made backup folders.
  - Files picked under `drive.file` stay accessible to SurveyOS in later sessions, and are remembered by `driveFileId` on the entry.
  - It needs a Google API key and app id, a one-time setup that costs nothing.
  - Reading goes through a small byte reader built on the existing Drive download (it returns bytes, not a data URL).
  - The code gets one `DocumentSource` interface (`list`, `read(entry) → Blob`, `fingerprint`) with two implementations: the local folder (both local and Drive-for-desktop) and Drive-online. Scan, read and Build all go through it.
  - The Drive-online option is **hidden until Phase 3** ships.
- **C5. Which recipe a claim uses.**
  - The insurer comes from `insurerShortForm(claim.insurerName)`.
  - The flow is a new claim field `portalFlow` (`'nontieup' | 'kia' | 'maruti' | 'claimsurvey'`). It defaults to non-tieup for NIA and claim survey for UIIC, and the surveyor can change it on the checklist.
  - An insurer with no recipe shows *"No portal list for this insurer yet"*. The Pages view and labelling still work.
  - Any box can be marked **Not needed for this claim** (e.g. Re-Inspection when there was none). That's stored per claim and counts as done.
- **C6. Two files of the same type.** The newest confirmed one wins. The checklist shows a "2 found" chip, so the surveyor can pick the other.
- **C7. Page count and thumbnails.** `pageCount` comes from `pdfjs-dist` `numPages` (no render). Thumbnails render lazily as they scroll into view, at a small size. A scanned PDF with no text layer is unlabelled until the surveyor or the opt-in AI labels it.
- **C8. Drive for desktop "Stream" mode.**
  - Reading a file that isn't downloaded makes Windows fetch it, so Scan and Build show *"Fetching from Google Drive…"*.
  - The guide recommends **Mirror** mode for working offline.
  - A file that can't be fetched counts as unreadable (it already does in `listFiles`).
- **C9. `Portal Upload/`.** Scan skips it (it's added to `isScanSkippable`). Its files are ours, so a rebuild overwrites them. D8 protects the surveyor's own files, which Build never touches.
- **C10. Phase 5 is a deferred block.** It's planned after the Stage C audit answers the size limit, the row-add behaviour and the base64 directive. It gets no stub now.

## 10. Left to the builder

- The exact keyword table and its tests (§4.3 examples are the floor).
- Thumbnail size and caching for the Pages view.
- Zip vs. separate downloads in Drive-online mode.
- How the Profile setting looks, within the existing Profile styles.
