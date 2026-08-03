# PDF Page Import for the Document Annexure — Design

**Date:** 2026-08-03
**Status:** Draft — awaiting review
**Area:** Prime V2 — Document Annexure (Photo Engine)

---

## Problem

The Document Annexure dropzone accepts images only (`accept="image/*"`); a PDF is
rejected with *"PDFs must be screenshotted first."* Surveyors sometimes already hold a
document as a 1- or 2-page PDF (a scan, or an export from another app) rather than a
phone screenshot, and re-screenshotting a PDF they already have is a needless step this
tool should absorb.

`@react-pdf/renderer`'s `<Image>` embeds PNG/JPEG only — it cannot embed a PDF page
directly. Supporting PDF input means rasterizing each page to an image client-side and
feeding it through the exact same path a photographed document already takes.

## Goal

Drop a PDF into the annexure dropzone. A single-page PDF is added immediately, exactly
like an image. A multi-page PDF opens a picker showing every page as a thumbnail, all
checked by default; the surveyor unchecks the pages they don't want, confirms, and only
the checked pages are added — each as its own `PhotoItem` with `kind: 'document'`,
identical in every downstream respect to a photographed screenshot.

## Non-Goals

- No text extraction / OCR from the PDF. Pages are rasterized to images; the annexure
  has never read document contents and continues not to.
- No page reordering, rotation-on-import, or cropping in the picker. Rotation is already
  available per-document after import via the existing gallery control.
- No support for password-protected PDFs. Rejected with a clear message (see Error
  handling) rather than prompting for a password.
- No change to how images are handled. This is additive to the existing dropzone.
- No thumbnail virtualization or page-count cap. The user explicitly chose "no cap, let
  me pick" over capping; very large page counts are an accepted, unoptimized edge case
  (see Testing / manual verification).

---

## Prior art already in this codebase

`pdfjs-dist` is already a dependency (`^5.6.205`), and `src/lib/ai/processor.ts:129-176`
(`fileToImages`) already rasterizes PDF pages to canvas for the AI extraction pipeline.
This design reuses its two load-bearing conventions rather than inventing new ones:

- **Dynamic import only.** `// DO NOT STATIC IMPORT THIS` — pdfjs-dist is large;
  `await import('pdfjs-dist')` inside the function keeps it out of the initial bundle for
  every page that never touches a PDF.
- **CDN worker.** `pdfjsLib.GlobalWorkerOptions.workerSrc =
  https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs` — version string read
  from the loaded module itself, so it can never drift from the installed package.

A `Dialog` primitive already exists (`src/components/ui/dialog.tsx`, base-ui backed) and
is already used for a picker of this shape — `SyncDrivePicker.tsx` takes the same
`open` / `onOpenChange` controlled pattern this design follows.

---

## Architecture

### Rendering: direct-to-target-resolution, not render-then-downscale

pdfjs's `page.getViewport({ scale })` lets the caller choose the output pixel size
directly, by computing `scale = targetWidth / nativeWidthAtScale1`. This means the
existing `compressImage` (File → Image → canvas → resize) is not reused here — a PDF
page renders once, straight to its target width, with no separate downscale pass.

Two target widths, both re-encoded as JPEG:

- **Thumbnail** — small and fast, generated for *every* page of a multi-page PDF before
  the surveyor has decided anything. Must stay cheap regardless of page count.
- **Full document resolution** — `DOC_MAX_WIDTH` (1600px) / `DOC_JPEG_QUALITY` (0.92),
  the same constants the image-upload path already uses. Rendered **only** for the pages
  the surveyor keeps — rendering every page at full resolution before a single checkbox
  has been touched would waste real time and memory on pages about to be rejected.

`DOC_MAX_WIDTH` is currently a private constant inside `DocumentAnnexureSection.tsx`.
This design gives it a second consumer, so it moves next to the already-shared
`DOC_JPEG_QUALITY` in `src/lib/photos/document-annexure.ts` — the same de-duplication
this feature already applied once (see the annexure profile / JPEG-quality fixes).

### One page count decides the flow

`numPages === 1` → render at full resolution immediately, `addPhoto(..., 'document')`,
no dialog, no thumbnail pass. `numPages > 1` → thumbnail every page, open the picker.

### The document handle stays open across thumbnail → confirm

Loading a PDF (parsing the file into a `PDFDocumentProxy`) is the expensive step.
Thumbnailing all pages and then, on confirm, rendering only the kept pages at full
resolution must not reload the file twice. `loadPdf(file)` therefore returns a handle
whose `renderPage` closes over the already-loaded document, so confirm re-renders from
the same parse. The handle is explicitly `.destroy()`ed once its pages are all added or
the dialog is cancelled, releasing pdfjs's internal resources before the next file (or
the next queued PDF) starts.

### Multiple PDFs in one upload batch: one dialog at a time

The dropzone allows multi-select and mixes images with PDFs. Images and 1-page PDFs
process immediately, in order, exactly as today. Multi-page PDFs cannot: each needs the
surveyor's attention before its pages can be added, and only one dialog can be on screen.
They are collected into a queue during the initial pass and presented one at a time —
confirming or cancelling one advances to the next queued PDF, and the queue draining to
empty is what finally clears `isProcessing`.

```
handleUpload(files)
 ├─ for each file, in order:
 │   ├─ image           → compress, addPhoto, continue
 │   ├─ PDF, 1 page      → render at full res, addPhoto, continue
 │   └─ PDF, 2+ pages    → thumbnail every page, push {fileName, loaded, pages} to queue
 └─ queue non-empty? → open picker for queue[0]

picker confirm(selectedPageNumbers)
 ├─ render each selected page at full res → addPhoto per page
 ├─ loaded.destroy()
 ├─ pop queue
 └─ queue non-empty? → open picker for the new queue[0] : done

picker cancel()
 ├─ loaded.destroy()   (no pages added for this file)
 ├─ pop queue
 └─ queue non-empty? → open picker for the new queue[0] : done
```

### Components

| File | Status | Role |
|---|---|---|
| `src/lib/photos/pdf-to-images.ts` | new | `loadPdf(file)` → `{ numPages, renderPage(pageNumber, maxWidth, quality), destroy() }`. Dynamic pdfjs import, CDN worker, per-page canvas render, guarded against unsettled promises exactly like `rotate-image.ts`'s fix. |
| `src/components/tabs/photos/PdfPageSelectorDialog.tsx` | new | Controlled dialog: `open`, `fileName`, `pages: {pageNumber, thumbDataUrl}[]`, `onConfirm(selectedPageNumbers)`, `onCancel()`. Thumbnail grid, all checked by default, Confirm/Cancel in `DialogFooter`, built on the existing `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` primitives. |
| `src/components/tabs/photos/DocumentAnnexureSection.tsx` | edit | `handleUpload` branches on `file.type === 'application/pdf'`; new queue state; renders `<PdfPageSelectorDialog>` when the queue is non-empty. |
| `src/lib/photos/document-annexure.ts` | edit | Export `DOC_MAX_WIDTH` alongside the existing `DOC_JPEG_QUALITY`; both files import it. |

### Naming

Each added page is captioned `${baseName} (p${pageNumber}/${numPages})`, where
`baseName` is the PDF's filename without extension, truncated so the full caption still
fits the existing 30-character cap used for every other document caption today.

---

## Error handling

| Condition | Behaviour |
|---|---|
| PDF fails to parse (corrupt, truncated) | `loadPdf` rejects → `toast.error` naming the file, skip it, continue with the rest of the batch — matches the existing per-file try/catch in `handleUpload`. |
| Password-protected PDF | pdfjs rejects with a `PasswordException` when no password callback is supplied. **Verified:** that class is not re-exported from `pdfjs-dist`'s public `pdf.d.ts` barrel (only from an internal `shared/util` path), so detection must not rely on `instanceof`. Check `error instanceof Error && error.name === 'PasswordException'` instead — the name is set by the constructor regardless of what the public API re-exports — and surface *"`<file>` is password-protected — remove the password and try again."*, not a generic parse error. |
| Zero-page / malformed PDF | Treated the same as a parse failure. |
| A page fails to render (thumbnail or full-res) | That single page is skipped with a toast naming the page number; the rest of the batch/selection proceeds. A canvas failure on page 3 of 5 must not lose pages 1, 2, 4, 5. |
| Surveyor cancels the picker | No pages from that PDF are added. The handle is destroyed and the queue advances — a cancelled PDF does not block the next queued one. |
| Very large page count | No cap (explicit product decision). Thumbnails are generated sequentially at a small target width to keep this tolerable; no further optimization (virtualized grid, background rendering) is in scope. |

---

## Testing

`pdf-to-images.ts` is browser/canvas-bound (pdfjs requires `document`/canvas), so — like
`rotate-image.ts` and the PDF renderer before it — it is **not unit tested** under the
`node` Vitest environment; adding jsdom for this remains out of scope for the same
reason it was rejected earlier in this feature. Verified manually.

`PdfPageSelectorDialog`'s selection logic (which page numbers are checked by default,
what `onConfirm` is called with after toggling some off) is plain state and *could* be
unit tested with React Testing Library if the project had it configured; it does not
(Vitest here is `node`-only, no jsdom, no RTL dependency). Out of scope to introduce a
whole new testing stack for one dialog's checkbox state — covered by manual verification
instead.

**Manual verification checklist** (mirrors how the parent feature was verified — a real
generated file, inspected structurally, not a screenshot):

1. Upload a 1-page PDF → added immediately, no dialog, appears in the document gallery.
2. Upload a 3-page PDF → dialog opens with 3 thumbnails, all checked.
3. Uncheck page 2, confirm → exactly 2 documents added (pages 1 and 3), correctly
   captioned, at full document resolution (not thumbnail resolution).
4. Cancel the dialog on a multi-page PDF → zero documents added from that file.
5. Select a 1-page PDF and a 3-page PDF together → the 1-page one adds immediately, then
   the dialog opens once for the 3-page one.
6. Select two multi-page PDFs together → confirming the first dialog opens the second;
   cancelling the first also opens the second.
7. Upload a password-protected PDF → a specific, actionable toast, not a raw error.
8. The resulting annexure PDF (Task 8's renderer) treats an imported PDF page exactly
   like a photographed document — same layout options, same rotation control, same
   attestation strip.
