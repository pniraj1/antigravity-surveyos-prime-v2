# Claim Documents — Design

**Date:** 2026-09-20
**Status:** Implemented 2026-09-21
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
| D2 | **One root folder, picked once**, via the File System Access API (desktop Chrome/Edge). Same root and handle store as local-sync. A claim's folder is named `<registration> - <INSURER SHORT>` (`MH12AB1234 - NIA`) — how a surveyor searches, and consistent with Sync's own folders — falling back to whichever part exists, then the claim number. It is decided at the **first write and stored on the claim** (`documentsFolder`), so later edits to the vehicle or insurer never move it. Two claims that would produce the same name get ` - 2`, ` - 3`. |
| D3 | **Every document has a type** from a closed vocabulary. Untyped files are `other`. |
| D4 | **Drive and Telegram are copies**, recorded on the index entry. Nothing new is uploaded; existing uploads are noted where they already happen. |
| D5 | **Bytes live where they were written.** The index records which machine holds them. On another machine the entry shows "on *Office PC*" and offers the Drive/Telegram copy if one exists. No cross-machine byte sync. |
| D6 | **Generated outputs that exist as a `Blob` save themselves** into the claim folder when it is connected. The browser download still happens, unchanged. |
| D7 | **Existing behaviour is not removed.** Photos stay in the record for now (see §6); Drive uploads stay; the Sync picker stays. |
| D8 | Deleting an index entry never deletes bytes silently — the file is left on disk and the surveyor is told the path. **One exception:** the report HTML this app writes at print time is a placeholder, not the surveyor's file; when the real PDF of the same type is filed, that HTML is deleted so the folder holds one file per report. Nothing a surveyor put in the folder is ever deleted. |
| D9 | **Permission is asked on the Documents tab.** Chrome re-grants folder access only inside a click. The Documents tab shows the permission state and an *Allow access* button; producers (print, upload, export) never prompt — if access is missing they save nothing and say which button to press. |
| D10 | **The index is a map, not an array** — `documents: Record<id, ClaimDocument>` — so two devices adding entries at once merge by key under the per-field multidevice sync instead of one overwriting the other. |

**Decided at implementation**

- (a) No `copies` field. Drive's upload flow returns no file id to record; the
  Documents tab's own Drive list is the cross-machine fallback instead. A
  Sync-picked file is saved as an ordinary upload (`source: 'upload'`), not a
  separate copy kind.
- (b) Multidevice sync is whole-claim, version-guarded — there is no
  field-level merge to design for. The map index is for O(1) lookup by id,
  not a merge strategy.
- (c) Word export is not hooked up to `saveDocuments` — six untyped callers
  across the codebase, left for a follow-up.
- (d) `insuredSummary` was added to the `DocType` vocabulary (the Insured
  Report Tab's PDF).
- (e) Single-file types accept a batch too: two files of a single-file type
  save as `<Label> 1`, `<Label> 2` rather than one replacing the other.
- (f) A photo's tag is a label on the photo item (`PhotoItem.tag`); the
  folder/index entry keeps the type it was written under. Retagging a photo
  after the fact does not move or rewrite the file.

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
  source: 'upload' | 'generated' | 'photo';
  /** Device labels that hold the bytes. A device is the name given when the folder was connected. */
  devices: string[];
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
| `index-ops.ts` | **pure**: `addDocuments(claim, docs)`, `removeDocument(claim, id)`, `onThisDevice(doc, label)`, `claimDocuments(claim)`, `newDocId()`. All return a new claim. | unit |
| `naming.ts` | **pure**: `folderNameFor(claim)`, `relPathsFor(type, files, existing)` — label + ext, subfolder + next number for multi types, `oldNameFor(relPath, taken)` — `(old)` rename plan for replacements | unit |
| `insurers.ts` | **pure**: `insurerShortForm(name)` — the free-text insurer on a policy → `NIA`/`UIIC`/`ICICI`/… , first meaningful word when unknown | unit |
| `folder.ts` | `writeDocuments(claim, type, files, source) → { claim, written }` (batch); `readDocument(claim, doc) → File`; `openDocument(claim, doc)` (PDF/image → object URL in new tab; anything else downloads); `claimFolderPath(claim)`; `scanClaimFolder(claim)` — read-only walk that indexes files already in the folder and adopts entries written on another device. Wraps handle walking; throws typed errors (`NoFolderError`, `PermissionDeniedError`, `NotOnThisDeviceError`) | manual |
| `sink.ts` | `saveDocuments(type, files, source)` — the one call every "a file was born" site makes: no folder connected is a quiet no-op (existing download/Drive flow untouched), a write failure toasts and returns `[]` | manual |
| `print-followup.ts` | `promptForPrintedPdf(type)` — the toast + file picker that hands the printed PDF back | manual |
| `useClaimDocuments.ts` | hook: folder state (unsupported / not connected / connected + label), `documents` list with `onThisDevice` resolved, `connect(label)`, `addFiles(type, files)`, `open(doc)`, `remove(doc)` | manual |

`writeDocuments` writes every new file to a `<relPath>.part` sibling first;
only once all parts have landed does it rename replaced single-file entries
to `<Label> (old).<ext>` and promote the `.part` files to their final names.
A failed write cleans up its own `.part` files and never touches the index —
nothing is orphaned on disk or in the record. Single-file replacement only
renames-and-removes entries whose `devices` includes **this** device; a
same-type entry written on another device stays in the index untouched and
keeps showing "on &lt;device&gt;".

The hook's folder-state effect reloads only when the claim id or
`documentsFolder` changes — not on every render — so switching claims or a
fresh `writeDocuments` (which sets `documentsFolder` on first write) is what
refreshes the card, nothing else re-triggers it.

### 3.4 Writers — where entries come from

| Caller | Today | Adds |
|---|---|---|
| `DocumentsTab` per-field upload (RC, DL, policy, permit, fitness, FIR…) | file → extraction → Drive | `saveDocuments(type, ..., 'upload')` if folder connected; type from `FIELD_KEY_TO_DOC_TYPE` |
| `AssessmentTab` estimate upload | Drive as `estimate.<ext>` | `saveDocuments('estimate', ..., 'upload')` — always `estimate`, whether the estimate is uploaded in replace or append mode |
| `PhotosTab` add photo | data URL in record + Drive | `saveDocuments('damagePhotos', ..., 'photo')` — the original `File` saves as `damagePhotos` at add time, regardless of the photo's tag; tagging it later (§3.6) does not move or rewrite the file |
| `exportNiaAssessmentExcel` | download | `saveDocuments('niaAssessmentExcel', ..., 'generated')` |
| `InsuredReportTab` PDF | download | `saveDocuments('insuredSummary', ..., 'generated')` |
| Word export | download | not hooked up — six untyped callers, left for a follow-up |
| Sync ✈️ picker — surveyor picks a Sync file into a claim field | fetches file (local-first) | via `processFiles`, `source: 'upload'`, type from field key. Bulk sync does **not** touch the index: a Sync claim is not linked to a Prime claim, only a picked file is |

**Survey report, bill check, fee bill, reinspection report** are HTML opened
with `window.print()`; the PDF is produced by Chrome's own print dialog and
never passes through the app. Two things happen on print:

1. The report **HTML** is saved immediately (`Final Survey Report.html`,
   `source: 'generated'`) — so the folder records that the report was issued
   even if the surveyor goes no further.
2. A prompt offers **File the PDF**. One click opens a file picker; the
   chosen PDF is saved under the same type, and the HTML placeholder is
   deleted (D8's exception). The folder ends with one file per report — the
   PDF that was actually sent.

Re-printing later regenerates from the claim as it stands then, which is why
the filed PDF matters: it is the snapshot of what the insurer received.

All four print-based reports open through one shared `openPrintWindow` in
`print-shell.ts`; the reinspection report's print now uses the same 600 ms
timing as the other three, instead of its own.

### 3.5 UI — Documents tab, one new card

**Claim folder** card at the top of `DocumentsTab`:

- not supported → one line: "Use desktop Chrome or Edge to keep claim files in a folder."
- not connected → **Connect folder** (asks for the device label)
- connected → `D:\SurveyOS Claims` · *Office PC* · "Change"

Below it, the **documents list**: one row per entry — source icon, type
label, relative path, size, and where it is: `here` / `on Office PC`. Row
actions: **Open** (disabled unless the file is on this device), **Remove**
(D8, toasts the path). Toolbar: **Add file** → type picker + a `multiple`
file input (any type can add a batch, per decision (e) above); **Scan folder** reads the claim folder and adds anything not already listed —
a PDF saved straight from Chrome, a Word export, files copied in by hand, or
a whole folder carried to a second PC, whose rows then change from
"on Office PC" to "here". It never writes, renames or deletes; a file it
cannot name is filed as *Other* and the surveyor can retype it.

Everything else on the tab is unchanged.

### 3.6 Photo tags

`PhotoItem` gains `tag?: PhotoTag` where
`PhotoTag = 'front' | 'rear' | 'left' | 'right' | 'chassis' | 'odometer' | 'spot' | 'damage'`.
Undefined = `damage`. `PhotosTab` gets a small tag select per thumbnail; nobody tags forty
photos — the default is `damage` and only the handful of special shots
(front/rear/sides, chassis, odometer, spot) get a tag.
`tagToDocType` maps to the vocabulary above but is not wired into the write
path yet — every photo still saves as `damagePhotos` (§3.4); it exists for
v2 of the extension to put the odometer photo in the odometer slot once the
folder entry is linked to the tag (§6).

---

## 4. Cross-machine story

Surveyor connects a folder on the office PC (label "Office PC") and on the
laptop ("Laptop"). Each entry lists the devices holding it. Opening a claim
on the laptop: entries written on the office PC show *on Office PC* and
**Open** is disabled — no byte sync, as agreed. The Documents tab's own
Drive list (unchanged, outside the index) is the fallback for fetching a
copy from another machine.

Root folder on OneDrive/Google Drive desktop sync is the surveyor's own
choice and works without us knowing.

---

## 5. Tests

Unit (Vitest), what shipped:

- `src/types/__tests__/documents.test.ts` (4) — `DOC_TYPE_LABEL`,
  `MULTI_FILE_TYPES`, `FIELD_KEY_TO_DOC_TYPE`, `tagToDocType`.
- `src/lib/documents/__tests__/index-ops.test.ts` (6) — immutability,
  map-keyed `addDocuments`/`removeDocument`, `replaceByType` replaces only
  the given type, `onThisDevice`.
- `src/lib/documents/__tests__/naming.test.ts` (8) — `folderNameFor` (claim
  number first, vehicle − insurer fallback, sticky once set), `relPathsFor`
  numbering (continues after gaps, sanitised labels), `oldNameFor` rename
  plan.

Manual: `folder.ts`, `sink.ts`, the hook, and the components. Connect folder
→ upload RC → file appears in Explorer, row shows `here` → NIA Excel
download → appears in folder and list → revoke permission → clear
re-prompt → open the claim on a second machine → rows show *on Office PC*,
Open disabled.

---

## 6. Out of scope, and the next step it points to

- **Photos out of the record.** Today a photo is a data URL inside
  `claim.photos`. With the folder in place the record could keep a
  thumbnail and the index entry, bytes on disk — the "don't stress
  IndexedDB" change. Separate spec; needs a migration and a fallback for
  claims opened on a machine without the bytes. Also: link a photo's tag to
  its folder entry, so a retag moves the type (and the extension can read
  it) instead of the entry staying `damagePhotos` forever.
- **Phone app** — removes the camera → PC step. Separate product task.
- **Stale index** when a file is renamed or moved in Explorer — the row
  shows *missing here*; no repair tooling.
- **PDF pipeline** for the print-based reports so they save themselves. The print-followup prompt covers the gap for now — a real generated PDF would remove the prompt entirely.
- **Extension v2** — attaching by type. Depends on this spec.
