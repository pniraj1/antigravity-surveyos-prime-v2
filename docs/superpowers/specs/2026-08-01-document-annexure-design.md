# Document Annexure — Design

**Date:** 2026-08-01
**Status:** Draft — awaiting review
**Area:** Prime V2 — Photo Engine (`PhotosTab`) / PDF output

---

## Problem

A surveyor routinely prints copies of supporting documents alongside the damage photo
sheet — most often RC and DL screenshots taken from the mParivahan app, but also policy
schedules, cheques, ID cards, and anything else the insurer's file needs. Today that is a
fully manual loop: screenshot on the phone, print on plain paper, hand-write "Verified",
sign, stamp.

The existing Photo Engine cannot absorb this work, for four concrete reasons:

- **`PhotosTab.tsx:124`** — `compressImage(file, 600, 1.0)` caps *every* upload at 600px
  wide. Adequate for a dented bumper, not for the fine print on an RC.
- **`PhotoSheetDocument.tsx:68`** — `objectFit: 'fill'` stretches images to fill their cell,
  ignoring aspect ratio. Cosmetic on a damage photo; on a document carrying a signed
  VERIFIED stamp it is **altered evidence**.
- **`claim.ts:95`** — `photoLayout` is a single claim-level value, so documents and damage
  photos cannot use different layouts in one output.
- **`assessment.ts:245`** — `PhotoItem` is `{dataUrl, name, w, h}`. There is no way to mark
  an image as a document.

Additionally, the RC/DL images already uploaded into the DetailsTab scan slots **cannot** be
reused: `DocumentEvidenceViewer.tsx:14` states plainly that those blob URLs are in-memory
only and are cleared on tab close or claim archive. `claim.photos` is the only persisted,
Drive-restorable image store in the app.

## Goal

A **Document Annexure**: a separate, printable PDF of arbitrary supporting documents, laid
out for legibility, carrying an optional surveyor attestation strip (VERIFIED + name +
signature + stamp) on every page.

## Non-Goals

- No mParivahan / VAHAN / DigiLocker API integration. No public free API exists, and the
  evidentiary artefact the insurer accepts is the attested screenshot regardless.
- No OCR, no auto-extraction, no cross-checking extracted fields against claim data. The
  document is printed as captured; the surveyor verifies it by eye, as today.
- No RC/DL-specific handling. The annexure is document-type agnostic.
- **No cropping.** Explicitly rejected. Rotation plus the page-orientation control cover the
  need; cropping adds an editing surface and a destructive operation on evidence.
- No new navigation tab. Adding to `AppTab` / `useRouteSync` is the risky part of this
  codebase and is not justified by an upload zone and a download button.

---

## Aspect ratio: the constraint that drives the layout defaults

Documents in this feature are overwhelmingly **phone screenshots**, which are far taller
than any page geometry. Typical ratios (width ÷ height):

| Source | Pixels | Aspect |
|---|---|---|
| Android 20:9 | 1080 × 2400 | 0.450 |
| iPhone 15 | 1179 × 2556 | 0.461 |
| Older 16:9 | 1080 × 1920 | 0.563 |
| Scanned A4 page | — | 0.707 |
| Landscape capture / wide card | — | 1.414 |

Because images are fitted with `objectFit: 'contain'`, a tall image in a wide-ish cell is
**height-limited** — it renders far narrower than the cell, wasting horizontal space. This
produces a result that is counter-intuitive and must be recorded so nobody "optimises" it
later.

### Page geometry

A4 portrait 595 × 842 pt, A4 landscape 842 × 595 pt. Subtracting page padding (20 × 2),
header (45), footer (25) and the attestation strip (95):

- **Portrait grid: 555 × 637 pt**
- **Landscape grid: 802 × 390 pt**

The strip reserves a **fixed 95 pt regardless of which optional lines are enabled**, and
0 pt when `verified` is off. Sizing it to its content would make every cell dimension below
depend on the licence and place/date checkboxes, so toggling a checkbox would silently
reflow the whole annexure. A fixed reserve keeps layout stable; unused lines are whitespace.
When `verified` is off the grid gains the full 95 pt (portrait 555 × 732, landscape
802 × 485).

### Rendered width of a 0.450 screenshot

Figures below assume `verified` is on (95 pt strip). With it off the grid is taller, but at
1-up and 2-up portrait a tall screenshot is width-limited, so its rendered width — and
therefore its legibility — is unchanged. The layout recommendations hold either way.

| Layout | Portrait cell | Renders | Landscape cell | Renders |
|---|---|---|---|---|
| 1-up | 555 × 637 | **287 × 637** | 802 × 390 | 176 × 390 |
| 2-up | 273 × 637 | **273 × 608** | 397 × 390 | 176 × 390 |
| 4-up | 273 × 314 | 141 × 314 | 397 × 191 | 86 × 191 |

**Key finding: for a tall screenshot, 1-up portrait renders only 287pt wide versus 2-up's
273pt — a 5% legibility gain for double the paper.** The cell is height-constrained in both
cases, so the extra width is simply never used.

### Decisions this forces

1. **Default layout is 2-up portrait.** It is within 5% of the best achievable legibility
   for the dominant input and uses half the paper. 1-up is retained because it *is* the
   right choice for wide content (landscape 1-up renders a 1.414 document at 551pt wide),
   but it must not be the default.
2. **4-up is offered but never defaulted.** At 141pt wide, a phone screenshot's fine print
   is not reliably legible in print. It is appropriate for scanned A4 pages and wide cards.
3. **The UI states the rule plainly:** *portrait for phone screenshots, landscape for wide
   cards and scanned pages.* This mirrors the guidance the Photo Engine already gives.

### Rotation

Each document in the gallery has a rotate control (90° clockwise per press, cycling back to
the original after four). Two distinct needs:

1. **Correction.** A photographed document is frequently captured sideways or upside down.
2. **Optimisation.** Rotating a tall screenshot and printing it on a landscape page gives
   more page along the direction the text runs, at the cost of the reader turning the page.

The optimisation only pays off at 1-up:

| Document | Page | Rendered | Length along the text |
|---|---|---|---|
| 0.450 upright | portrait 1-up | 287 × 637 | **637 pt** |
| rotated to 2.222 | landscape 1-up | 802 × 361 | **802 pt** — 26% better |
| 0.450 upright | portrait 2-up | 273 × 608 | **608 pt** |
| rotated to 2.222 | landscape 2-up | 397 × 179 | 397 pt — worse |

So the guidance is narrow and should be stated as such: **rotating to landscape helps only
at 1-up.** At 2-up, upright portrait wins and rotation is purely a correction tool.

**Implementation:** rotation re-encodes the image through a canvas and replaces `dataUrl`,
swapping the stored `w`/`h`. No new persisted field, and no dependence on
`@react-pdf/renderer`'s transform support — the stored image is already correct in the
gallery, the PDF, and any future consumer. New store action `rotatePhoto(index: number)`,
generic over both kinds; only the document gallery wires a button to it for now.

Cost: each rotation is a JPEG re-encode at q0.92, so quality degrades slightly per press.
Negligible at the two or three rotations a correction needs, and the alternative — retaining
an untouched original alongside every document — would roughly double the IndexedDB budget.

### Resolution cap: 1600px, validated

At 2-up portrait a document renders 273.5pt wide = 3.80in. 300 dpi print requires ~1139px.
A 1600px source yields ~421 dpi — comfortable headroom.

The worst case is a wide document at 1-up landscape: 551pt = 7.66in, where 1600px yields
~209 dpi. Below 300 but well clear of the ~150 dpi threshold where text becomes visibly
soft. Acceptable, and raising the cap would cost IndexedDB budget for a rare case.

Storage: a 1600px JPEG at q0.92 is roughly 350–600 KB, and base64 inflates that by ~33%, so
budget ~0.5–0.8 MB per document, ~3–5 MB for a typical six-document annexure.

---

## Architecture

### Data model

`PhotoItem` gains one optional discriminator (`types/assessment.ts`):

```ts
export interface PhotoItem {
  dataUrl: string;
  name: string;
  w?: number;
  h?: number;
  /** 'document' renders in the Document Annexure, never the damage photo sheet.
   *  undefined is treated as 'damage', keeping every existing claim valid. */
  kind?: 'damage' | 'document';
}
```

Rationale for reusing `claim.photos` rather than a parallel `claim.documents` array: the
photos array already has IndexedDB persistence, Drive auto-upload, Drive restore, and
archive/clear handling, plus support in `restoreClaim.ts` and the Firebase sync layer. A
second array would reimplement all of it and would drift. The cost is a filter in two
places, pinned by tests.

Annexure options persist **on the claim** (the surveyor customises per claim), unlike
`PhotoSheetOptions` which its own comment marks as runtime-only:

```ts
export type DocumentLayout = 1 | 2 | 4;

export interface DocumentAnnexureOptions {
  layout: DocumentLayout;              // default 2
  pageOrientation: PageOrientation;    // default 'portrait'
  /** Master toggle. Off => no attestation strip at all. */
  verified: boolean;                   // default false
  showLicence: boolean;                // IRDAI + IIISLA line
  showDatePlace: boolean;
  place: string;
  verifiedDate: string;                // ISO, defaults to today
  pagePadding: number;                 // default 20
  cellGap: number;                     // default 8
  showBorder: boolean;                 // default true
  borderColor: string;                 // default '#E5E7EB'
}
```

→ new `ClaimData.documentAnnexure: DocumentAnnexureOptions`, with defaults applied on claim
creation and backfilled for existing claims on load.

### Store

`claimSlice.ts` currently exposes:

```ts
addPhoto: (dataUrl: string, name: string, w?: number, h?: number) => void;
deletePhoto: (index: number) => void;
updatePhotoName: (index: number, name: string) => void;
```

Changes:

- `addPhoto` gains a trailing `kind: 'damage' | 'document' = 'damage'` parameter. Existing
  call sites are unaffected.
- New `updateDocumentAnnexure(updates: Partial<DocumentAnnexureOptions>)`, following the
  existing `updateReportSettings` pattern.
- New `rotatePhoto(index: number)` — replaces `dataUrl` with a canvas-rotated re-encode and
  swaps `w`/`h`. Generic over both kinds; only the document gallery wires it up for now.
- `deletePhoto` and `updatePhotoName` are **unchanged** — see the index-mapping hazard below.

### Components

`PhotosTab.tsx` is already 476 lines. Replicating the engine inline would push it past the
800-line ceiling in the project coding-style rules, so the new UI is extracted.

| File | Status | Role |
|---|---|---|
| `components/tabs/photos/DocumentAnnexureSection.tsx` | new | Section rendered below the photo engine: dropzone, gallery (with per-item rotate and delete), layout + orientation pickers, verified toggle and field checkboxes, preview/download |
| `components/pdf/DocumentAnnexureDocument.tsx` | new | react-pdf document: header, grid, attestation strip, footer |
| `components/pdf/DocumentAnnexureDownloadButton.tsx` | new | Mirrors `PhotoSheetDownloadButton`, incl. the single-dynamic-import-boundary constraint |
| `components/pdf/DocumentAnnexurePreview.tsx` | new | Mirrors `PhotoSheetPreview` |
| `components/tabs/PhotosTab.tsx` | edit | Renders the new section; `compressImage` gains `mime` and honours `quality` |
| `components/pdf/PhotoSheetDocument.tsx` | edit | One filter: `kind !== 'document'` |
| `types/assessment.ts`, `types/claim.ts` | edit | Types above |
| `stores/slices/claimSlice.ts` | edit | Store changes above |

`buildDocLayout()` in `DocumentAnnexureDocument.tsx` mirrors the structure of the existing
`buildLayout()`, including its convention of varying cols/rows by page orientation:

| Layout | Portrait | Landscape |
|---|---|---|
| 1 | 1 × 1 | 1 × 1 |
| 2 | 2 cols × 1 row | 2 cols × 1 row |
| 4 | 2 × 2 | 2 × 2 |

Images use `objectFit: 'contain'`. The damage photo sheet keeps `fill` — changing it would
alter existing output that was not in scope.

### Data flow

1. Surveyor drops files into the annexure dropzone (`accept="image/*"`).
2. `compressImage(file, 1600, 0.92, 'image/jpeg')` → `addPhoto(url, name, w, h, 'document')`.
3. Drive auto-upload (when `profile.autoUploadDrive !== false`) names the file
   `doc_${Date.now()}_${name}` rather than `photo_${Date.now()}_${name}`.
4. `handleRestoreFromDrive` reads that prefix back and restores `kind: 'document'` — so
   restore requires no new plumbing or schema.
5. `PhotoSheetDocument` filters to `kind !== 'document'`; `DocumentAnnexureDocument` filters
   to `kind === 'document'`.

### Attestation strip

Rendered on **every page** when `verified` is true, so a page separated from the set still
carries its attestation.

```
┌──────────────────────────────────────────────────────────┐
│  [ document ]                    [ document ]             │
├──────────────────────────────────────────────────────────┤
│  VERIFIED                    ✍ signature       ⬤ stamp    │
│  <Surveyor Name>                                          │
│  IRDAI: <irdaiLicence> · IIISLA: <iiislaNumber>           │  showLicence
│  <place> · <verifiedDate>                                 │  showDatePlace
└──────────────────────────────────────────────────────────┘
```

Always shown when `verified` is on: **VERIFIED**, surveyor name, signature, stamp. The
licence line and the place/date line follow their own checkboxes.

Sources, all already present on `SurveyorProfile` (`types/vehicle.ts:213-220`):
`signatureDataUrl`, `stampDataUrl`, `irdaiLicence`, `iiislaNumber`. Both image fields are
local-only and stripped from Firebase sync (`lib/firebase/sync.ts:404`), which is fine — the
annexure renders client-side.

**`verified` off → no strip is rendered at all.** Pages print bare and the surveyor signs by
hand exactly as today. The existing workflow stays available.

---

## Error handling

| Condition | Behaviour |
|---|---|
| No documents uploaded | Annexure preview and download hidden, mirroring the existing `hasPhotos` gate |
| `verified` on, but `signatureDataUrl` / `stampDataUrl` is `null` | Inline warning in the section linking to Profile; the PDF prints a labelled blank ruled box in place of each missing asset. A signed page silently missing its signature is the worst outcome |
| `verified` on, but `irdaiLicence` / `iiislaNumber` empty while `showLicence` is on | That line is omitted; no placeholder text |
| Image decode or compression failure | `toast.error` naming the file. The damage-photo loop swallows these silently (`PhotosTab.tsx:132`), acceptable for one photo among forty but not for a document being attested |
| Non-image file dropped | Rejected by `accept="image/*"` and by a runtime `file.type.startsWith('image/')` guard |

**Known constraint:** `@react-pdf/renderer`'s `<Image>` embeds PNG and JPEG only, so PDFs
cannot be attached to the annexure — they must be screenshotted first. This is an
inconsistency with the DetailsTab scan slots, which do accept PDFs, and the dropzone copy
should say so.

---

## Testing

Vitest, alongside the existing `src/lib/reports/__tests__/`.

1. **Partition.** A claim with mixed `photos` yields only `kind !== 'document'` items in the
   photo sheet and only `kind === 'document'` items in the annexure. Legacy items with
   `kind` undefined are treated as damage.
2. **Index mapping (the hazard).** The document gallery displays a *filtered* subset, so a
   filtered index is not a `photos` index. The section must carry each item's real index
   through to `deletePhoto` / `updatePhotoName`. Test: given `[damage, document, damage,
   document]`, deleting the second *document* removes index 3, not index 1.
3. **Layout maths.** `buildDocLayout` returns the cell dimensions tabulated above for each
   layout × orientation pair.
4. **Strip composition.** Fields appear and disappear per their toggles; `verified: false`
   emits no strip; missing profile assets emit blank boxes rather than nothing.
5. **Drive round-trip.** A `doc_`-prefixed filename restores as `kind: 'document'`; a
   `photo_`-prefixed one as `kind: 'damage'`.
6. **Rotation.** One `rotatePhoto` swaps `w`/`h`; four consecutive calls return the item to
   its original orientation. Rotating a document never touches any other array entry.

---

## Future considerations

Out of scope, recorded so the reasoning is not lost:

- **Deep link to mParivahan** from the annexure section, to cut the app-switch. Requires
  first confirming whether the app registers a URL scheme.
- **`compressImage` ignores its `quality` argument** — it is passed `1.0` and then calls
  `toDataURL('image/png')`, which accepts no quality parameter, so damage photos are stored
  as PNG despite the comment saying JPEG. This work adds the parameters for the document
  path only and leaves the damage path byte-identical. Fixing it globally is a separate
  change with its own storage implications.
