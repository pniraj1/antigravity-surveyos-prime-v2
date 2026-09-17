# AI Upload — PDF Page Selection — Design

**Date:** 2026-09-17
**Status:** Draft — awaiting review
**Area:** Prime V2 — AI document extraction (Documents, Estimate, Final Bill, Details)

---

## Problem

Surveyors upload multi-page PDFs (garage estimates, final bills, policies) for AI
extraction. These often carry pages that add nothing — cover letters, terms & conditions,
blank scans. Today `fileToImages()` (`src/lib/ai/processor.ts:134`) rasterizes **every**
page and sends every image to the AI provider. Each junk page costs ~1,000–1,500 tokens of
free-tier quota (BYOK, 20 req/day on Gemini Flash) and adds noise to extraction.

The surveyor has no way to say "read pages 1–3 only".

## Goal

Before any PDF is sent to the AI, a multi-page PDF shows its pages as thumbnails, all ticked
by default. The surveyor unticks the pages they don't want. Only ticked pages are
rasterized; unticked pages never become images, never leave the browser, and cost zero
tokens. Re-scan and Smart Fix on the same document honour the same selection.

Single-page PDFs and images see **no new UI** — zero friction in the common case.

## Non-Goals

- No PDF trimming / re-writing (no `pdf-lib`). The AI receives page images, not the PDF;
  skipping pages in the rasterize loop is the whole feature. The full original file is
  still stored for Drive upload and the evidence viewer.
- No auto-detection of junk pages (heuristics on the text layer). Candidate follow-up.
- No text-instead-of-image optimisation for digital PDFs. Separate investigation.
- No page reordering, rotation or cropping of PDF pages.

---

## Prior art reused

| Exists | Where | Reused for |
|---|---|---|
| "Review before sending to AI" sheet (file-level tick/untick + crop) | `src/components/documents/DocumentReviewSheet.tsx` | Becomes the single AI gate for all four tabs |
| Page thumbnail picker (all ticked, uncheck to reject) | `src/components/tabs/photos/PdfPageSelectorDialog.tsx` | Grid extracted into shared `PdfPageGrid` |
| `loadPdf()` / `renderPage()` / `PdfPasswordProtectedError` | `src/lib/photos/pdf-to-images.ts` | Page count + thumbnails in the sheet |
| Rasterize loop | `src/lib/ai/processor.ts:150` | Gains the page filter |

---

## Design

### 1. Carrying the selection to the rasterizer

The surveyor's choice is made in a dialog; the rasterize loop is four calls deep
(`triggerExtraction → extractDocument → filesToImages → fileToImages`) and the same `File`
is also held in the extraction store for Re-scan / Smart Fix, and read by
`bank-statement-extractor.ts`.

The selection is attached to the `File` object itself:

```ts
// src/lib/ai/processor.ts
// ponytail: page selection rides on the File via WeakMap so no signature in the
// extraction chain changes and Re-scan / Smart Fix inherit it. Upgrade path:
// thread `pages` explicitly through extractDocument/filesToImages/smartFixRescan.
const aiPages = new WeakMap<File, number[]>();
export function setAIPages(file: File, pages: number[]): void
export function getAIPages(file: File): number[] | undefined
```

`fileToImages()` reads `getAIPages(file)`; when present it iterates only those page
numbers (ascending). Excluded pages are dropped from `viewImages`, `apiImages` and
`textLayers` alike, so the three arrays stay index-aligned. Kept pages are renumbered
1..n in progress messages and page tags. `onProgress(i, total)` reports `total` as the
kept count.

A `File` with no entry behaves exactly as today (all pages). A `WeakMap` releases the
entry when the `File` is garbage-collected.

### 2. Review sheet changes (`DocumentReviewSheet.tsx`)

- On open, each PDF is opened with `loadPdf()`. `numPages === 1` → card unchanged.
- `numPages > 1` → card shows an "N pages" chip and, below it, a `PdfPageGrid` of
  thumbnails (`PDF_THUMB_WIDTH`, `PDF_THUMB_QUALITY`), all ticked. Thumbnails render
  progressively; the Send button is enabled once page counts are known (thumbnails may
  still be loading).
- Per-PDF state: `Set<number>` of ticked pages. Untick all pages ⇒ the file is treated
  as unticked at file level (not sent).
- "Send to AI": for each selected PDF with `pages.size < numPages`, call
  `setAIPages(file, [...pages].sort())`. Then `onConfirm(allFiles, filesForAI)` as today.
- `loadPdf` rejects (password-protected or corrupt) → card shows "Can't preview pages —
  will be sent whole", remains selectable, no page grid. Preview failure never blocks
  sending.
- `LoadedPdf.destroy()` is called for every loaded PDF on confirm and on cancel.
- The soft `AI_IMAGE_WARN` (5 images, Groq cap) now counts ticked **pages** of PDFs plus
  selected images, since that is what actually reaches the provider.

`PdfPageGrid` (`src/components/documents/PdfPageGrid.tsx`): the thumbnail grid + toggle
markup lifted from `PdfPageSelectorDialog`, props `{ pages, checked, onToggle }`.
`PdfPageSelectorDialog` renders it, behaviour unchanged.

### 3. Gate and tab wiring

Shared helper, `src/lib/ai/needs-review.ts`:

```ts
/** True when the surveyor has a decision to make before AI: >1 file, or any multi-page PDF. */
export async function needsReview(files: File[]): Promise<boolean>
```

Images and single-page PDFs return `false` — the tab calls `triggerExtraction` directly
as today. The page-count probe uses `loadPdf()` then `destroy()`; on error it returns
`false` (send whole, as today).

Each of the three tabs that currently skip review adopts DocumentsTab's pattern
(`reviewSheet` state at `DocumentsTab.tsx:85`, sheet at `:579`):

| Tab | Call site | Note |
|---|---|---|
| Estimate | `AssessmentTab.tsx:58` | Apply-mode prompt first, then gate, then sheet/extract. Blob URL + Drive upload unchanged. |
| Final Bill | `BillCheckTab.tsx:145` | Gate, then sheet/extract. |
| Details slots | `DetailsTab.tsx:104` | Gate, then sheet/extract. |

DocumentsTab already opens the sheet for every upload; it gains the page grid with no
wiring change. The Sync-Drive picker path (`DocumentsTab.tsx:574`) flows through the same
sheet and gets page selection for free.

### 4. Error handling

- Rasterize error on a kept page: unchanged from today (throws, job fails, toast).
- Selection refers to a page number outside the PDF (cannot happen via UI; defensive):
  `fileToImages` clamps to `1..numPages` and ignores out-of-range entries.
- Empty selection array: treated as "no selection" (all pages) — the sheet never emits it,
  since zero ticked pages ⇒ file not sent.

### 5. Testing

Unit (vitest, mock `pdfjs-dist`):
- `fileToImages`: File tagged `[1,3]` of a 4-page PDF → 2 images, text layers aligned,
  progress reports `total = 2`. Untagged File → 4 images. Tagged `[0, 9]` on a 4-page
  PDF → 0 images (out-of-range ignored).
- `needsReview`: image → false; 1-page PDF → false; 3-page PDF → true; 2 images → true;
  unreadable PDF → false.

Manual:
- Estimate tab: drop a 5-page PDF, sheet opens, untick 2, Send → progress reads
  "page 1 of 3"; Re-scan with feedback and Smart Fix both process 3 pages.
- Estimate tab: drop a JPEG → no sheet, extraction starts immediately.
- Documents tab: RC front + back JPEGs → sheet as today, no page grid.
- Password-protected PDF → "Can't preview" card, still sends whole.
