# PDF Page Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a surveyor drop a PDF into the Document Annexure dropzone instead of screenshotting it — a single-page PDF adds immediately, a multi-page PDF opens a picker (every page checked by default) so the surveyor can uncheck pages they don't want before they're added.

**Architecture:** A new browser-only module (`pdf-to-images.ts`) rasterizes PDF pages via the `pdfjs-dist` dependency already used elsewhere in this codebase, mirroring the exact dynamic-import and worker-setup pattern already proven in `src/lib/ai/processor.ts`. Rendering targets the final pixel width directly via pdfjs's viewport scale — no separate render-then-downscale pass. A new controlled dialog shows thumbnails for a multi-page PDF; on confirm, only the checked pages are re-rendered at full document resolution and fed through the exact same `addPhoto(..., 'document')` call an image upload already uses. Nothing about the annexure PDF renderer, the store, or rotation changes — every document remains an opaque image to them regardless of where it came from.

**Tech Stack:** Next.js 16 (static export) + React 19, TypeScript, `pdfjs-dist` (already a dependency), the existing `Dialog` primitive (`@base-ui/react/dialog`), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-03-pdf-page-import-design.md`

## Global Constraints

- **Test environment is `node`** (`vitest.config.ts`). No `document`, `Image`, or canvas in tests — pdfjs-dist requires all three, so this feature's core rendering module has **no unit tests**, matching the existing precedent set by `rotate-image.ts`. Do not add jsdom.
- **Test command for a single file:** `npx vitest run <path>`. Do not run `npm test` (also runs slower, unrelated function tests).
- **Path alias `@` → `./src`**, configured in both `tsconfig` and `vitest.config.ts`.
- **pdfjs-dist must be dynamically imported**, never statically: `await import('pdfjs-dist')` inside a function body, never `import * as pdfjsLib from 'pdfjs-dist'` at module top level. A **type-only** import (`import type { PDFDocumentProxy } from 'pdfjs-dist';`) is fine at the top of a file — it is erased at compile time and does not bundle the library.
- **Immutability is mandatory.** Never mutate arrays or objects in store actions or component state; spread and replace.
- **No `console.log`** in production code.
- **No `any`.** Use `unknown` and narrow.
- **Explicit types on all exported functions.** React props via a named `interface`; do not use `React.FC`.
- **Existing image-upload behaviour must not change.** The image branch of `handleUpload` keeps calling `compressImage` exactly as it does today.
- **Password-protected PDFs are rejected outright**, directing the surveyor to screenshot instead — no password-entry UI.
- **Commit format:** `<type>: <description>` — `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

## Verified API facts (do not re-derive these — they were checked against the installed `pdfjs-dist` types before this plan was written)

- `PDFDocumentProxy.destroy(): Promise<void>` — confirmed inside the `PDFDocumentProxy` class body (`node_modules/pdfjs-dist/types/src/display/api.d.ts`, class spans lines 870–1360). A same-named `destroy()` exists on two *other* classes in the same file (`PDFDocumentLoadingTask`, `PDFWorker`) — those are not this one.
- `PasswordException` is **not** re-exported from `pdfjs-dist`'s public `pdf.d.ts` barrel (only from an internal `shared/util` path). Detecting a password-protected PDF must check `error instanceof Error && error.name === 'PasswordException'`, never `instanceof pdfjsLib.PasswordException`.
- `page.render({ canvasContext, canvas, viewport }).promise` — `render()` returns a `RenderTask`; the promise to await is its `.promise` property. Already used this way in `src/lib/ai/processor.ts:161,173`.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/lib/photos/document-annexure.ts` | modify | `DOC_MAX_WIDTH` promoted here as an export, alongside the existing `DOC_JPEG_QUALITY` |
| `src/lib/photos/pdf-to-images.ts` | create | `loadPdf(file)` → parse once, render any page at any resolution; `PdfPasswordProtectedError`; thumbnail constants |
| `src/components/tabs/photos/PdfPageSelectorDialog.tsx` | create | Controlled picker dialog: thumbnail grid, checkboxes (all on by default), Confirm/Cancel |
| `src/components/tabs/photos/DocumentAnnexureSection.tsx` | modify | `handleUpload` branches on `application/pdf`; new PDF queue state; renders the picker dialog |

---

### Task 1: Promote `DOC_MAX_WIDTH` to a shared constant

**Files:**
- Modify: `src/lib/photos/document-annexure.ts`
- Modify: `src/components/tabs/photos/DocumentAnnexureSection.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DOC_MAX_WIDTH: number`, exported from `document-annexure.ts`, for Task 2's PDF renderer to reuse without duplicating the value.

- [ ] **Step 1: Move the constant**

In `src/lib/photos/document-annexure.ts`, add near the other exported constants (after `DOC_JPEG_QUALITY` at the end of the file is fine):

```typescript
/**
 * Documents are text, not scenery: 1600px keeps small print legible in print.
 * At the 2-up portrait default a document prints 3.8in wide, so 300dpi needs
 * ~1139px — 1600 leaves headroom without wasting the IndexedDB budget.
 *
 * Shared by the image-compression path and the PDF-rasterization path, so a
 * page imported from a PDF prints at the same resolution as a screenshot.
 */
export const DOC_MAX_WIDTH = 1600;
```

- [ ] **Step 2: Remove the local copy and import the shared one**

In `src/components/tabs/photos/DocumentAnnexureSection.tsx`, delete the local declaration:

```typescript
/** Documents are text, not scenery: 1600px keeps small print legible in print.
 *  At the 2-up portrait default a document prints 3.8in wide, so 300dpi needs
 *  ~1139px — 1600 leaves headroom without wasting the IndexedDB budget. */
const DOC_MAX_WIDTH = 1600;
```

and add `DOC_MAX_WIDTH` to the existing import from `@/lib/photos/document-annexure`:

```typescript
import {
  partitionPhotos,
  resolveAnnexureOptions,
  DOC_JPEG_QUALITY,
  DOC_MAX_WIDTH,
} from '@/lib/photos/document-annexure';
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

```bash
npx vitest run src/lib/photos/__tests__/document-annexure.test.ts
```

Expected: all existing tests still pass (this is a pure relocation; no test asserts the constant's value today, and this plan does not add one — consistent with `DOC_JPEG_QUALITY` never having had a dedicated "equals 0.92" test either).

- [ ] **Step 4: Commit**

```bash
git add src/lib/photos/document-annexure.ts src/components/tabs/photos/DocumentAnnexureSection.tsx
git commit -m "refactor(photos): promote DOC_MAX_WIDTH to a shared constant"
```

---

### Task 2: PDF rasterization module

**Files:**
- Create: `src/lib/photos/pdf-to-images.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `interface RenderedPage { dataUrl: string; w: number; h: number }`
  - `interface LoadedPdf { numPages: number; renderPage(pageNumber: number, maxWidth: number, quality: number): Promise<RenderedPage>; destroy(): Promise<void> }`
  - `class PdfPasswordProtectedError extends Error`
  - `async function loadPdf(file: File): Promise<LoadedPdf>`
  - `const PDF_THUMB_WIDTH: number`, `const PDF_THUMB_QUALITY: number`

This module is **not unit tested**. Vitest's environment is `node` — no `document`, no `Image`, no canvas — and `pdfjs-dist` requires all three to parse and render a PDF. This matches the existing precedent of `rotate-image.ts`, which is also untested for the same reason. Verified manually in Task 4.

- [ ] **Step 1: Create the module**

```typescript
import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * Rasterize PDF pages to images so they can flow through the exact same
 * PhotoItem pipeline as a photographed document — @react-pdf/renderer's
 * <Image> only embeds PNG/JPEG, it cannot embed a PDF page directly.
 *
 * pdfjs-dist is dynamically imported inside loadPdf() so it never bundles
 * into a page that doesn't touch a PDF — mirrors fileToImages() in
 * src/lib/ai/processor.ts. The `import type` above is erased at compile
 * time and does not bundle the library; only a runtime `import(...)` would.
 */

/** One page, rendered to a JPEG data URL at some target resolution. */
export interface RenderedPage {
  dataUrl: string;
  w: number;
  h: number;
}

/** A PDF, parsed once, ready to render any of its pages at any resolution. */
export interface LoadedPdf {
  numPages: number;
  /** Render one page (1-indexed) to a JPEG capped at `maxWidth` px wide. */
  renderPage(pageNumber: number, maxWidth: number, quality: number): Promise<RenderedPage>;
  /**
   * Release pdfjs's internal resources for this document. Always call this
   * once every page you need has been rendered — whether the surveyor
   * confirmed a page selection or cancelled it.
   */
  destroy(): Promise<void>;
}

/**
 * Thrown when a PDF requires a password to open. Rejected outright rather
 * than prompting for one — an unusual enough case for a surveyor's
 * documents that building unlock UI for it isn't worth it. Callers should
 * catch this specifically and direct the surveyor to screenshot the
 * document instead.
 */
export class PdfPasswordProtectedError extends Error {
  constructor(fileName: string) {
    super(`${fileName} is password-protected.`);
    this.name = 'PdfPasswordProtectedError';
  }
}

/**
 * Thumbnail target for the page picker: small and fast, since every page of
 * a multi-page PDF is thumbnailed before the surveyor has decided which (if
 * any) they want to reject. The full DOC_MAX_WIDTH render only happens for
 * pages actually kept.
 */
export const PDF_THUMB_WIDTH = 220;
export const PDF_THUMB_QUALITY = 0.6;

/**
 * Parse a PDF file. Returns a handle bound to the parsed document, so
 * rendering a thumbnail now and the full-resolution image later for only
 * the kept pages never re-parses the file — parsing is the expensive step.
 */
export async function loadPdf(file: File): Promise<LoadedPdf> {
  const pdfjsLib = await import('pdfjs-dist');
  const version = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();

  let pdf: PDFDocumentProxy;
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new PdfPasswordProtectedError(file.name);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to open ${file.name}: ${String(error)}`);
  }

  return {
    numPages: pdf.numPages,
    renderPage: (pageNumber, maxWidth, quality) => renderPdfPage(pdf, pageNumber, maxWidth, quality),
    destroy: () => pdf.destroy(),
  };
}

async function renderPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  maxWidth: number,
  quality: number,
): Promise<RenderedPage> {
  try {
    const page = await pdf.getPage(pageNumber);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = maxWidth / unscaled.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get a 2D canvas context');
    }

    await page.render({ canvasContext: ctx, canvas, viewport }).promise;

    return {
      dataUrl: canvas.toDataURL('image/jpeg', quality),
      w: viewport.width,
      h: viewport.height,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to render page ${pageNumber}: ${String(error)}`);
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors. If TypeScript complains that `pdfjs-dist` has no default export or that `pdfjsLib.getDocument` / `pdfjsLib.GlobalWorkerOptions` / `pdfjsLib.version` don't exist on the dynamic import's type, compare your import against `src/lib/ai/processor.ts:134-139` — it uses the identical `const pdfjsLib = await import('pdfjs-dist');` pattern successfully today, so the fix is almost certainly a typo, not a real incompatibility.

- [ ] **Step 3: Lint**

```bash
npx eslint src/lib/photos/pdf-to-images.ts
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/photos/pdf-to-images.ts
git commit -m "feat(photos): add PDF page rasterization module"
```

---

### Task 3: Page selector dialog

**Files:**
- Create: `src/components/tabs/photos/PdfPageSelectorDialog.tsx`

**Interfaces:**
- Consumes: nothing from Task 2 directly — this component only receives already-rendered thumbnail data URLs as props; it never imports `pdf-to-images.ts` or touches pdfjs.
- Produces: `interface PdfPage { pageNumber: number; thumbDataUrl: string }`; `PdfPageSelectorDialog({ open, fileName, pages, onConfirm, onCancel })`.

This component has no automated tests. Its selection logic is plain `useState`/`useEffect`, but this project's Vitest is `node`-only with no jsdom or React Testing Library configured, and introducing a whole new testing stack for one dialog's checkbox state is out of scope (see the design spec's Testing section). Verified manually in Task 4.

- [ ] **Step 1: Create the dialog**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** One page of a PDF, already thumbnailed. */
export interface PdfPage {
  pageNumber: number;
  thumbDataUrl: string;
}

interface PdfPageSelectorDialogProps {
  open: boolean;
  /** The PDF's filename (without extension), shown in the dialog title. */
  fileName: string;
  pages: PdfPage[];
  /** Called with the checked page numbers, ascending, when the surveyor confirms. */
  onConfirm: (selectedPageNumbers: number[]) => void;
  /** Called when the surveyor cancels, presses Escape, or dismisses the dialog. */
  onCancel: () => void;
}

/**
 * Every page starts checked — the surveyor rejects the pages they don't
 * want rather than opting each one in, matching how this was described:
 * "surveyor should be able to choose which pages he wants to select and
 * reject."
 */
export function PdfPageSelectorDialog({
  open,
  fileName,
  pages,
  onConfirm,
  onCancel,
}: PdfPageSelectorDialogProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  // Reset to "all checked" every time a new PDF's pages arrive. `pages` is a
  // fresh array from the caller for each queued PDF, so this fires exactly
  // once per file, not on every re-render.
  useEffect(() => {
    setChecked(new Set(pages.map(p => p.pageNumber)));
  }, [pages]);

  const togglePage = (pageNumber: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm([...checked].sort((a, b) => a - b));
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select pages from {fileName}</DialogTitle>
          <DialogDescription>
            Every page is added by default — uncheck any you don&apos;t want in the annexure.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto py-1">
          {pages.map(page => (
            <label
              key={page.pageNumber}
              className="flex flex-col gap-1.5 rounded-md border border-border p-2 cursor-pointer hover:border-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.thumbDataUrl}
                alt={`Page ${page.pageNumber}`}
                className="w-full aspect-[3/4] object-contain bg-muted rounded"
              />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={checked.has(page.pageNumber)}
                  onChange={() => togglePage(page.pageNumber)}
                  className="accent-primary"
                />
                Page {page.pageNumber}
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={checked.size === 0}>
            Add {checked.size} page{checked.size === 1 ? '' : 's'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Lint**

```bash
npx eslint src/components/tabs/photos/PdfPageSelectorDialog.tsx
```

Expected: no errors. A `jsx-a11y/alt-text` warning does not apply here (the `<img>` already has a real `alt`); if eslint reports anything else, fix it before committing.

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/photos/PdfPageSelectorDialog.tsx
git commit -m "feat(photos): add PDF page selector dialog"
```

---

### Task 4: Wire PDF import into the Document Annexure section

**Files:**
- Modify: `src/components/tabs/photos/DocumentAnnexureSection.tsx`

**Interfaces:**
- Consumes: `loadPdf`, `LoadedPdf`, `PdfPasswordProtectedError`, `PDF_THUMB_WIDTH`, `PDF_THUMB_QUALITY` from Task 2; `PdfPageSelectorDialog`, `PdfPage` from Task 3; `DOC_MAX_WIDTH` from Task 1.
- Produces: nothing consumed by a later task — this is the final integration point.

This task has no automated tests — it is UI wiring around two already-untested browser modules. Verified manually via the checklist in Step 6, mirroring how the parent Document Annexure feature was verified (a real generated artifact inspected directly, not a screenshot).

- [ ] **Step 1: Add the imports**

In `src/components/tabs/photos/DocumentAnnexureSection.tsx`, add to the existing imports:

```typescript
import { loadPdf, type LoadedPdf, PdfPasswordProtectedError, PDF_THUMB_WIDTH, PDF_THUMB_QUALITY } from '@/lib/photos/pdf-to-images';
import { PdfPageSelectorDialog, type PdfPage } from '@/components/tabs/photos/PdfPageSelectorDialog';
```

- [ ] **Step 2: Add the queue type and state**

Immediately before `export function DocumentAnnexureSection() {`, add:

```typescript
/** A multi-page PDF whose pages have been thumbnailed and are awaiting the
 *  surveyor's page selection. One entry per PDF in an upload batch; only
 *  the first is shown — see the queue-draining comment in handlePdfConfirm. */
interface PendingPdf {
  fileName: string;
  loaded: LoadedPdf;
  pages: PdfPage[];
}
```

Inside the component, alongside the existing `useState` calls:

```typescript
  const [pdfQueue, setPdfQueue] = useState<PendingPdf[]>([]);
```

- [ ] **Step 3: Rewrite `handleUpload` to branch on PDF**

Replace the entire `handleUpload` callback with:

```typescript
  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0 || !currentClaim) return;
      setIsProcessing(true);

      const newPendingPdfs: PendingPdf[] = [];

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          if (file.type === 'application/pdf') {
            try {
              const loaded = await loadPdf(file);
              const baseName = file.name.replace(/\.pdf$/i, '');

              if (loaded.numPages === 1) {
                const { dataUrl, w, h } = await loaded.renderPage(1, DOC_MAX_WIDTH, DOC_JPEG_QUALITY);
                addPhoto(dataUrl, baseName.substring(0, 30), w, h, 'document');
                await loaded.destroy();
              } else {
                const pages: PdfPage[] = [];
                for (let p = 1; p <= loaded.numPages; p++) {
                  const thumb = await loaded.renderPage(p, PDF_THUMB_WIDTH, PDF_THUMB_QUALITY);
                  pages.push({ pageNumber: p, thumbDataUrl: thumb.dataUrl });
                }
                newPendingPdfs.push({ fileName: baseName, loaded, pages });
              }
            } catch (error: unknown) {
              if (error instanceof PdfPasswordProtectedError) {
                toast.error(`${file.name} is password-protected. Take a screenshot of the document and upload that instead.`);
              } else {
                toast.error(`Could not read ${file.name}. Take a screenshot of the document and upload that instead.`);
              }
            }
            continue;
          }

          if (!file.type.startsWith('image/')) {
            toast.error(`${file.name} isn't a supported file. Upload an image or a PDF.`);
            continue;
          }
          try {
            const { dataUrl, w, h } = await compressImage(file, DOC_MAX_WIDTH, DOC_JPEG_QUALITY, 'image/jpeg');
            const name = file.name.split('.')[0].substring(0, 30);
            // Documents never leave the device: no Drive upload, no queueing,
            // no claim.json backup (see performClaimBackup's driveSafeClaim).
            addPhoto(dataUrl, name, w, h, 'document');
          } catch {
            // A document is attested evidence — unlike a damage photo, a silent
            // drop here would leave the surveyor signing an incomplete annexure.
            toast.error(`Could not read ${file.name}. Try re-taking the screenshot.`);
          }
        }
      } finally {
        setIsProcessing(false);
        event.target.value = '';
        if (newPendingPdfs.length > 0) {
          setPdfQueue(prev => [...prev, ...newPendingPdfs]);
        }
      }
    },
    [addPhoto, currentClaim],
  );
```

Note what did **not** change: the image branch still calls `compressImage` with the exact same arguments as before. Only the rejection message for non-image/non-PDF files changed (it used to say PDFs must be screenshotted; that's no longer true), and a new PDF branch was inserted above it.

- [ ] **Step 4: Add the confirm/cancel handlers for the picker**

Immediately after `handleUpload`, before `handleRotate`, add:

```typescript
  const handlePdfConfirm = useCallback(
    async (selectedPageNumbers: number[]) => {
      const current = pdfQueue[0];
      if (!current) return;
      setIsProcessing(true);
      try {
        for (const pageNumber of selectedPageNumbers) {
          try {
            const { dataUrl, w, h } = await current.loaded.renderPage(pageNumber, DOC_MAX_WIDTH, DOC_JPEG_QUALITY);
            const caption = `${current.fileName} (p${pageNumber}/${current.pages.length})`.substring(0, 30);
            addPhoto(dataUrl, caption, w, h, 'document');
          } catch {
            toast.error(`Could not render page ${pageNumber} of ${current.fileName}.`);
          }
        }
      } finally {
        await current.loaded.destroy();
        // The dialog is modal, so nothing else can mutate the queue while it
        // is open — `current` is always still pdfQueue[0] here, and slice(1)
        // always removes exactly the PDF just confirmed.
        setPdfQueue(prev => prev.slice(1));
        setIsProcessing(false);
      }
    },
    [addPhoto, pdfQueue],
  );

  const handlePdfCancel = useCallback(() => {
    const current = pdfQueue[0];
    if (!current) return;
    current.loaded.destroy();
    setPdfQueue(prev => prev.slice(1));
  }, [pdfQueue]);
```

- [ ] **Step 5: Update the dropzone and render the dialog**

Change the `accept` attribute and the two pieces of now-inaccurate copy. Replace:

```typescript
              <p className="text-sm text-muted-foreground mb-5 text-center max-w-sm">
                Screenshots of RC, DL, policy schedules and the like. Images only — a PDF
                has to be screenshotted first.
              </p>
```

with:

```typescript
              <p className="text-sm text-muted-foreground mb-5 text-center max-w-sm">
                Screenshots of RC, DL, policy schedules and the like — or attach a PDF
                directly. A multi-page PDF lets you pick which pages to keep.
              </p>
```

Replace:

```typescript
              <input
                id="document-upload"
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
                disabled={isProcessing}
              />
```

with:

```typescript
              <input
                id="document-upload"
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleUpload}
                disabled={isProcessing}
              />
```

Then, immediately before the final closing `</div>` of the component's returned JSX (after the closing `</div>` of the `grid grid-cols-1 lg:grid-cols-4 gap-8` block — the same insertion point the section itself used when it was added to `PhotosTab`), add:

```tsx
      <PdfPageSelectorDialog
        open={pdfQueue.length > 0}
        fileName={pdfQueue[0]?.fileName ?? ''}
        pages={pdfQueue[0]?.pages ?? []}
        onConfirm={handlePdfConfirm}
        onCancel={handlePdfCancel}
      />
```

- [ ] **Step 6: Verify types compile and lint is clean**

```bash
npx tsc --noEmit
```

Expected: no errors.

```bash
npx eslint src/components/tabs/photos/DocumentAnnexureSection.tsx
```

Expected: no new errors or warnings beyond whatever this file already had before this task (there should be none — this file had none before).

```bash
npx vitest run
```

Expected: all 285 pre-existing tests still pass (this task adds no new test files, and touches no file any existing test imports beyond what Task 1 already touched safely).

- [ ] **Step 7: Manual verification in the browser**

Start the dev server via the preview tooling, open a claim, go to the Photo Engine's Document Annexure section, and confirm:

1. Upload a genuine 1-page PDF → it's added immediately, no dialog appears, and it shows up in the document gallery at the expected resolution (not a tiny thumbnail).
2. Upload a genuine 3-page PDF → the picker opens with 3 thumbnails, all checked.
3. Uncheck page 2, click "Add 2 pages" → exactly 2 documents are added (pages 1 and 3), each captioned `<filename> (p1/3)` / `<filename> (p3/3)`, and visibly at full document resolution, not the blurry thumbnail resolution.
4. Open a multi-page PDF's picker and click Cancel → zero documents are added from that file.
5. Open a multi-page PDF's picker and press Escape (or click the backdrop) → same result as Cancel.
6. Select one 1-page PDF and one 3-page PDF together in a single file-picker selection → the 1-page one adds immediately, then the picker opens once for the 3-page one.
7. Select two different multi-page PDFs together → confirming the first picker opens the second automatically; cancelling the first also opens the second automatically.
8. If a password-protected PDF is available to test with, upload it → a toast naming the file and directing to screenshot it, no crash, no stuck "Processing…" state.
9. After adding pages from a PDF, open the annexure's Preview or Download — the imported pages render exactly like a photographed document: same layout options apply, rotation works on them, the attestation strip prints if enabled.
10. Check the browser console throughout — no errors on any of the above.

- [ ] **Step 8: Commit**

```bash
git add src/components/tabs/photos/DocumentAnnexureSection.tsx
git commit -m "feat(photos): wire PDF page import into the document annexure"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| 1-page PDF adds immediately, no dialog | 4 (Step 3) |
| Multi-page PDF opens picker, all pages checked by default | 3, 4 |
| Surveyor unchecks pages to reject them | 3 |
| Thumbnail pass for all pages, full-res render only for kept pages | 2, 4 |
| Document handle stays open across thumbnail → confirm (no re-parse) | 2 (`LoadedPdf` closure), 4 (queue carries `loaded`, not just the file) |
| `destroy()` called after confirm and after cancel | 4 (Steps 4) |
| Multiple PDFs in one batch queue one at a time | 4 (Steps 3–4, `pdfQueue`) |
| Images unaffected | 4 (Step 3 — image branch untouched) |
| `DOC_MAX_WIDTH` shared, not duplicated | 1 |
| Dynamic pdfjs import, CDN worker, version read from the loaded module | 2 |
| Password-protected PDF rejected, directed to screenshot | 2 (`PdfPasswordProtectedError`), 4 (Step 3 catch) |
| Corrupt/malformed PDF rejected with a toast, batch continues | 2, 4 (Step 3 catch, `continue`) |
| A single page failing to render doesn't lose the rest | 4 (Step 4, per-page try/catch) |
| Caption format `name (pN/total)`, truncated to 30 chars | 4 (Step 4) |
| No unit tests for the browser-bound modules; manual verification instead | 2, 3, 4 (Step 7) |

No gaps.

**Placeholder scan:** no TBD/TODO; every code step contains complete, real code; every verification step names an exact command and its expected result.

**Type consistency:** `LoadedPdf { numPages, renderPage, destroy }` is defined in Task 2 and consumed with that exact shape in Task 4's `PendingPdf.loaded` and every call site (`loaded.renderPage(...)`, `loaded.destroy()`, `current.loaded.renderPage(...)`, `current.loaded.destroy()`). `PdfPage { pageNumber, thumbDataUrl }` is defined in Task 3 and produced with that exact shape in Task 4's thumbnail loop (`pages.push({ pageNumber: p, thumbDataUrl: thumb.dataUrl })`) and consumed identically by `PdfPageSelectorDialog`'s `pages` prop. `PdfPasswordProtectedError` is thrown in Task 2's `loadPdf` and caught by name (`instanceof PdfPasswordProtectedError`) in Task 4 — no string-matching duplicated across the module boundary. `PDF_THUMB_WIDTH` / `PDF_THUMB_QUALITY` are defined once in Task 2 and imported, not redefined, in Task 4. `DOC_MAX_WIDTH` is defined once in Task 1 and imported, not redefined, in Task 4's PDF and image branches alike.
