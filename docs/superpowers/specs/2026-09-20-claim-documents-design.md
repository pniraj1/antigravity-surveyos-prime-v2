# Claim Documents — Design

**Date:** 2026-09-20
**Status:** Draft — awaiting review
**Scope:** A typed document index on the claim record, with the bytes in a
real folder on the surveyor's PC. Builds on the existing local-sync module
(`src/lib/local-sync/`, spec `2026-06-10-sync-claim-to-local-folder-design.md`).
Drive and Telegram keep working as they do; they become copies.

---

## 1. The problem

A claim's files live in four places today and no list ties them together:

| Where | What | Problem |
|---|---|---|
| claim record (IndexedDB, synced) | photos as data URLs, estimate | heavy — a 40-photo claim is tens of MB inside the record |
| Google Drive | uploads, if linked and if there is space | optional, often full |
| SurveyOS Sync (Telegram) | what the field app collected | only for Sync users |
| local-sync folder | copies of Sync files | only for Sync users |

Generated outputs — the survey report, bill check, fee bill, NIA Excel — go
wherever the browser's download dialog puts them. Nothing records that they
exist or which version was sent.

The extension's v2 needs to answer "give me the RC for this claim" by type.
So does the surveyor.

We do not provide storage. Surveyor's disk, surveyor's Drive, surveyor's
Telegram.

---

## 2. Rules

| # | Rule |
|---|------|
| D1 | **Index on the record, bytes on disk.** `claim.documents[]` is small metadata and syncs with the claim like any other field. File bytes never enter the claim record or IndexedDB. |
| D2 | **One root folder, picked once**, via the File System Access API (desktop Chrome/Edge). Same root and handle store as local-sync. The claim's folder name is decided at the **first write and stored on the claim** (`documentsFolder`), from the claim number when there is one, else vehicle − insurer. A later edit to the vehicle number never moves the folder; two claims on one vehicle never share one. |
| D3 | **Every document has a type** from a closed vocabulary. Untyped files are `other`. |
| D4 | **Drive and Telegram are copies**, recorded on the index entry. Nothing new is uploaded; existing uploads are noted where they already happen. |
| D5 | **Bytes live where they were written.** The index records which machine holds them. On another machine the entry shows "on *Office PC*" and offers the Drive/Telegram copy if one exists. No cross-machine byte sync. |
| D6 | **Generated outputs that exist as a `Blob` save themselves** into the claim folder when it is connected. The browser download still happens, unchanged. |
| D7 | **Existing behaviour is not removed.** Photos stay in the record for now (see §6); Drive uploads stay; the Sync picker stays. |
| D8 | Deleting an index entry never deletes bytes silently — the file is left on disk and the surveyor is told the path. |
| D9 | **Permission is asked inside the click.** Chrome re-grants folder access only in a user gesture, so every flow that ends in a write calls `ensureReadWrite` first, before any async work (upload → extraction → write must ask up front). A write that finds itself without permission fails with a clear toast, never silently. |
| D10 | **The index is a map, not an array** — `documents: Record<id, ClaimDocument>` — so two devices adding entries at once merge by key under the per-field multidevice sync instead of one overwriting the other. |

---

## 3. Design

### 3.1 Types — `src/types/documents.ts`

```ts
export type DocType =
  | 'rc' | 'dl' | 'policy' | 'claimForm' | 'estimate' | 'supplementaryEstimate'
  | 'invoice' | 'fir' | 'puc' | 'permit' | 'fitness' | 'cancelledCheque'
  | 'chassisPhoto' | 'odometerPhoto' | 'photoFront' | 'photoRear' | 'photoLeft' | 'photoRight'
  | 'spotPhotos' | 'damagePhotos'
  | 'surveyReport' | 'billCheckReport' | 'feeBill' | 'reinspectionReport' | 'niaAssessmentExcel'
  | 'workApproval' | 'deliveryOrder' | 'other';

export interface ClaimDocument {
  id: string;                 // `doc-<ts>-<rand>`
  type: DocType;
  /** Path relative to the claim folder, e.g. "RC Book.pdf" or "Damage Photos/Damage Photos 3.jpg" */
  relPath: string;
  mime: string;
  size: number;
  addedAt: string;            // ISO
  source: 'upload' | 'generated' | 'photo' | 'sync' | 'drive';
  /** Device labels that hold the bytes. A device is the name given when the folder was connected. */
  devices: string[];
  copies?: { driveFileId?: string; syncRef?: string /* `${docId}:${fileIndex}` */ };
}
```

`ClaimData` gains `documents?: Record<string, ClaimDocument>` (D10) and
`documentsFolder?: string` (D2). Both undefined on old claims; read through
`claimDocuments(claim)` (sorted array, `[]` when absent) and
`claimFolder(claim)`.

`DOC_TYPE_LABEL: Record<DocType, string>` — the human label, also the file
stem ("RC Book", "Driving Licence", "Final Survey Report"). Portal slot
labels are **not** here; they belong to the extension's map
(`docType → portal slot`), so a portal rename touches one JSON.

### 3.2 Folder — reuse `src/lib/local-sync/`

Already there and kept as is: `pickRootFolder`, `getStoredRootHandle`,
`ensureReadWrite`, `isLocalSyncSupported`, `claimFolderName`,
`sanitizeSegment`, `extFor`, `placeFile`.

One addition to `directory-handle.ts`: the device label. `pickRootFolder`
asks for a short name ("Office PC", "Laptop") stored next to the handle;
`getDeviceLabel()` returns it. Default "This PC".

Layout:

```
<root>/
  MOTOR-871-2026/                ← documentsFolder, fixed at first write (D2)
    RC Book.pdf
    Driving Licence.jpg
    Estimate.pdf
    Final Survey Report.pdf
    Primary Assessment Template.xlsx
    Damage Photos/
      Damage Photos 1.jpg
```

Sync's own folders (`MH12AB1234 - HDFC ERGO/`, with `_surveyos-sync.json`)
sit beside these under the same root and are not touched.

Single-file types → `<Label>.<ext>` (a second file of the same type
replaces it: newer report wins; the old one is renamed `<Label> (old).<ext>`).
Multi-file types (`damagePhotos`, `spotPhotos`, `other`) → subfolder, numbered.

### 3.3 Engine — `src/lib/documents/`

| File | What | Tests |
|---|---|---|
| `index-ops.ts` | **pure**: `addDocument(claim, doc)`, `removeDocument(claim, id)`, `upsertByType(claim, doc)` (single-file types), `markCopy(claim, id, copies)`, `onThisDevice(doc, label)`. All return a new claim. | unit |
| `naming.ts` | **pure**: `relPathFor(type, mime, existing)` — label + ext, subfolder + next number for multi types, `(old)` rename plan for replacements | unit |
| `folder.ts` | `writeDocument(claim, type, blob, source) → ClaimDocument`; `readDocument(claim, doc) → File \| null`; `openDocument(doc)` (object URL in new tab). Wraps handle walking; throws typed errors (`NoFolder`, `PermissionDenied`, `NotOnThisDevice`) | manual |
| `useClaimDocuments.ts` | hook: folder state (unsupported / not connected / connected + label), `documents` list with `onThisDevice` resolved, `add(type, file)`, `remove(id)`, `open(doc)` | manual |

`writeDocument` = `ensureReadWrite` → `relPathFor` → create dirs → write
bytes → return the entry; the caller does `updateClaim(upsertByType(...))`.
Writing bytes and updating the record are two steps; a failed write never
touches the record.

### 3.4 Writers — where entries come from

| Caller | Today | Adds |
|---|---|---|
| `DocumentsTab` per-field upload (RC, DL, policy, permit, fitness, FIR…) | file → extraction → Drive | `writeDocument(type)` if folder connected; type from a fixed `fieldKey → DocType` table |
| `AssessmentTab` estimate upload | Drive as `estimate.<ext>` | `writeDocument('estimate')` |
| `PhotosTab` add photo | data URL in record + Drive | `writeDocument('damagePhotos' \| 'chassisPhoto' \| …)` per the photo's tag (§3.6) |
| `exportNiaAssessmentExcel` | download | `writeDocument('niaAssessmentExcel')` |
| Word export, insured report PDF | download | `writeDocument(type)` |
| Sync ✈️ picker — surveyor picks a Sync file into a claim field | fetches file (local-first) | `writeDocument(type from field key)` + `copies.syncRef`. Bulk sync does **not** touch the index: a Sync claim is not linked to a Prime claim, only a picked file is |
| `uploadFileToDrive` success | — | `markCopy(id, { driveFileId })` when the caller passed an index id |

**Survey report, bill check, fee bill, reinspection report** are HTML opened
with `window.print()`; there is no PDF `Blob`. v1 saves the report's **HTML
string** itself (`Final Survey Report.html`, `source: 'generated'`) at the
moment the print window opens — it opens in any browser and prints
identically, and the index knows the report exists. A PDF the surveyor
prints can be added over it with **Add file** → same type (`upsertByType`
replaces, HTML goes to `(old)`). A real PDF pipeline stays out of scope.

### 3.5 UI — Documents tab, one new card

**Claim folder** card at the top of `DocumentsTab`:

- not supported → one line: "Use desktop Chrome or Edge to keep claim files in a folder."
- not connected → **Connect folder** (asks for the device label)
- connected → `D:\SurveyOS Claims` · *Office PC* · "Change"

Below it, the **documents list**: one row per entry — type label, file
name, size, date, source icon, and where it is:
`✓ here` / `on Office PC` / `Drive ✓` / `✈️`. Row actions: **Open** (from
disk; from Drive copy when not here and Drive is linked), **Remove** (D8).
Toolbar: **Add file** → type picker + file input, multi-select for photo
types.

Everything else on the tab is unchanged.

### 3.6 Photo tags

`PhotoItem` gains `tag?: PhotoTag` where
`PhotoTag = 'front' | 'rear' | 'left' | 'right' | 'chassis' | 'odometer' | 'spot' | 'damage'`.
Undefined = `damage`. `PhotosTab` gets a small tag select per thumbnail; nobody tags forty
photos — the default is `damage` and only the handful of special shots
(front/rear/sides, chassis, odometer, spot) get a tag.
`tagToDocType` maps to the vocabulary above. Tags are what let v2 of the
extension put the odometer photo in the odometer slot.

---

## 4. Cross-machine story

Surveyor connects a folder on the office PC (label "Office PC") and on the
laptop ("Laptop"). Each entry lists the devices holding it. Opening a claim
on the laptop: entries written on the office PC show *on Office PC*; if the
same file also went to Drive, **Open** fetches it from Drive. If not, the
row says where to go. That is the whole cross-machine feature — no byte
sync, as agreed.

Root folder on OneDrive/Google Drive desktop sync is the surveyor's own
choice and works without us knowing.

---

## 5. Tests

Unit (Vitest): every function in `index-ops.ts` and `naming.ts` —
immutability, map-keyed add/remove/upsert, `upsertByType` replaces only
single-file types, numbering continues after gaps, `(old)` rename plan,
sanitised labels, `folderNameFor(claim)` (claim number first, vehicle −
insurer fallback, sticky once set), `onThisDevice`, `tagToDocType`,
field-key → `DocType` table covers every Documents-tab key.

Manual: connect folder → upload RC → file appears in Explorer, row shows
`✓ here` → NIA Excel download → appears in folder and list → revoke
permission → clear re-prompt → open the claim on a second machine → rows
show *on Office PC*, Drive-backed one opens.

---

## 6. Out of scope, and the next step it points to

- **Photos out of the record.** Today a photo is a data URL inside
  `claim.photos`. With the folder in place the record could keep a
  thumbnail and the index entry, bytes on disk — the "don't stress
  IndexedDB" change. Separate spec; needs a migration and a fallback for
  claims opened on a machine without the bytes.
- **Phone app** — removes the camera → PC step. Separate product task.
- **Scan an existing folder** into the index for claims made before this.
- **Stale index** when a file is renamed or moved in Explorer — the row
  shows *missing here*; no repair tooling.
- **PDF pipeline** for the print-based reports so they save themselves.
- **Extension v2** — attaching by type. Depends on this spec.
