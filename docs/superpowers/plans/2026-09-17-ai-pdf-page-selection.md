# AI Upload PDF Page Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before a multi-page PDF goes to the AI, the surveyor unticks the pages they don't want; only ticked pages are rasterized and sent, on all four AI upload paths.

**Architecture:** The page selection is attached to the `File` object via a `WeakMap` (`src/lib/ai/ai-pages.ts`) and read by `fileToImages()` in the rasterize loop, so nothing in the extraction call chain changes and Re-scan / Smart Fix inherit it. `DocumentReviewSheet` becomes the single AI gate for Documents, Estimate, Final Bill and Details; it renders a page thumbnail grid (shared `PdfPageGrid`, lifted from the annexure picker) for multi-page PDFs. A `needsReview()` helper opens the sheet only when there is a decision to make (>1 file or a multi-page PDF).

**Tech Stack:** Next.js 16, React, TypeScript, zustand, `pdfjs-dist` (dynamic import only), vitest (node environment — no canvas/DOM in unit tests).

**Spec:** `docs/superpowers/specs/2026-09-17-ai-pdf-page-selection-design.md`

## Global Constraints

- `pdfjs-dist` must be **dynamically imported** (`await import('pdfjs-dist')`) — never a static import. `import type` is fine.
- No new dependencies (no `pdf-lib`). The PDF is never trimmed; pages are skipped in the rasterize loop.
- Images and single-page PDFs must see **no new UI** — extraction starts exactly as today.
- Excluded pages are dropped from `viewImages`, `apiImages` **and** `textLayers` so the three arrays stay index-aligned.
- Preview / thumbnail failure never blocks sending; the file is sent whole.
- Vitest runs in `environment: 'node'` — anything touching `document`/canvas/pdfjs must be behind an injectable seam so pure logic is testable.
- Commits end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Conventional commit prefixes (`feat`, `refactor`, `test`, `docs`).
- Ponytail: smallest working diff; mark deliberate shortcuts with a `// ponytail:` comment.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/ai/ai-pages.ts` | Create | `setAIPages` / `getAIPages` (WeakMap) + pure `resolveAIPages(numPages, selection)` |
| `src/lib/ai/__tests__/ai-pages.test.ts` | Create | Unit tests for the above |
| `src/lib/ai/processor.ts` | Modify `:134-190` | `fileToImages` iterates `resolveAIPages(...)` instead of `1..numPages` |
| `src/lib/ai/needs-review.ts` | Create | `needsReview(files, countPdfPages?)` gate |
| `src/lib/ai/__tests__/needs-review.test.ts` | Create | Unit tests for the gate |
| `src/components/documents/PdfPageGrid.tsx` | Create | Thumbnail grid + checkbox toggle (lifted from the annexure picker) |
| `src/components/tabs/photos/PdfPageSelectorDialog.tsx` | Modify | Renders `PdfPageGrid`; behaviour unchanged |
| `src/components/documents/DocumentReviewSheet.tsx` | Modify | Loads PDFs, shows page grid, tags files on Send, page-aware warn count |
| `src/components/tabs/AssessmentTab.tsx` | Modify `:32-70` | Gate + sheet before `triggerExtraction('estimate', …)` |
| `src/components/tabs/BillCheckTab.tsx` | Modify `:143-147` | Gate + sheet before `triggerExtraction('final-bill', …)` |
| `src/components/tabs/DetailsTab.tsx` | Modify `:102-105` | Gate + sheet before `triggerExtraction(key, …)` |
| Vault `Changelog.md`, `Tasks.md`, `Sessions/2026-09-17-ai-pdf-page-selection.md` | Modify/Create | Protocol docs |

---

### Task 1: Page selection carrier + rasterize filter

**Files:**
- Create: `src/lib/ai/ai-pages.ts`
- Create: `src/lib/ai/__tests__/ai-pages.test.ts`
- Modify: `src/lib/ai/processor.ts:134-190`

**Interfaces:**
- Produces:
  - `setAIPages(file: File, pages: number[]): void`
  - `getAIPages(file: File): number[] | undefined`
  - `resolveAIPages(numPages: number, selection: number[] | undefined): number[]` — ascending, de-duplicated, clamped to `1..numPages`; `undefined` or `[]` ⇒ all pages.

- [ ] **Step 1: Write the failing test**

`src/lib/ai/__tests__/ai-pages.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveAIPages, setAIPages, getAIPages } from '@/lib/ai/ai-pages';

describe('resolveAIPages', () => {
  it('returns every page when there is no selection', () => {
    expect(resolveAIPages(4, undefined)).toEqual([1, 2, 3, 4]);
  });

  it('treats an empty selection as "all pages"', () => {
    expect(resolveAIPages(3, [])).toEqual([1, 2, 3]);
  });

  it('keeps only the selected pages, ascending and de-duplicated', () => {
    expect(resolveAIPages(5, [4, 1, 4])).toEqual([1, 4]);
  });

  it('ignores page numbers outside 1..numPages', () => {
    expect(resolveAIPages(4, [0, 2, 9])).toEqual([2]);
  });

  it('returns nothing when every selected page is out of range', () => {
    expect(resolveAIPages(4, [0, 9])).toEqual([]);
  });
});

describe('setAIPages / getAIPages', () => {
  it('round-trips a selection on the same File object', () => {
    const f = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    setAIPages(f, [2, 3]);
    expect(getAIPages(f)).toEqual([2, 3]);
  });

  it('is undefined for a File that was never tagged', () => {
    const f = new File(['x'], 'b.pdf', { type: 'application/pdf' });
    expect(getAIPages(f)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/ai-pages.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ai/ai-pages'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/ai/ai-pages.ts`:

```ts
/**
 * Which pages of a PDF the surveyor wants the AI to read.
 *
 * ponytail: the selection rides on the File object via a WeakMap so no
 * signature in the extraction chain (triggerExtraction → extractDocument →
 * filesToImages → fileToImages) changes, and Re-scan / Smart Fix — which hold
 * the same File in the extraction store — inherit it for free. Upgrade path
 * if this ever bites: thread `pages` explicitly through those calls.
 */
const aiPages = new WeakMap<File, number[]>();

/** Tag a File with the 1-based page numbers the AI should read. */
export function setAIPages(file: File, pages: number[]): void {
  aiPages.set(file, pages);
}

/** The tagged selection, or undefined when the whole file should be read. */
export function getAIPages(file: File): number[] | undefined {
  return aiPages.get(file);
}

/**
 * The page numbers `fileToImages` should actually render: ascending, unique,
 * clamped to 1..numPages. No selection (or an empty one) means every page.
 */
export function resolveAIPages(numPages: number, selection: number[] | undefined): number[] {
  if (!selection || selection.length === 0) {
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }
  const kept = new Set(selection.filter(p => Number.isInteger(p) && p >= 1 && p <= numPages));
  return [...kept].sort((a, b) => a - b);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/ai-pages.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Use it in `fileToImages`**

In `src/lib/ai/processor.ts`, add the import near the top (after the existing imports):

```ts
import { getAIPages, resolveAIPages } from './ai-pages';
```

Replace the loop header at `:150-151`:

```ts
    for (let i = 1; i <= pdf.numPages; i++) {
      if (onProgress) onProgress(i, pdf.numPages);
      const page = await pdf.getPage(i);
```

with:

```ts
    // Only the pages the surveyor ticked in the review sheet are rendered —
    // unticked pages never become images and never reach the provider.
    const pageNumbers = resolveAIPages(pdf.numPages, getAIPages(file));
    for (let idx = 0; idx < pageNumbers.length; idx++) {
      if (onProgress) onProgress(idx + 1, pageNumbers.length);
      const page = await pdf.getPage(pageNumbers[idx]);
```

Nothing else in the loop body references `i` or `pdf.numPages` — verify with `grep -n "numPages\|\bi\b" src/lib/ai/processor.ts | sed -n 1,20p` (only the two replaced lines should have matched before the edit).

- [ ] **Step 6: Type-check and run the AI test folder**

Run: `npx tsc --noEmit && npx vitest run src/lib/ai`
Expected: tsc clean; all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/ai-pages.ts src/lib/ai/__tests__/ai-pages.test.ts src/lib/ai/processor.ts
git commit -m "feat(ai): fileToImages renders only the pages tagged on the File

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `needsReview` gate

**Files:**
- Create: `src/lib/ai/needs-review.ts`
- Create: `src/lib/ai/__tests__/needs-review.test.ts`

**Interfaces:**
- Consumes: `loadPdf(file)` from `src/lib/photos/pdf-to-images.ts` (`{ numPages, destroy() }`).
- Produces: `needsReview(files: File[], countPdfPages?: (f: File) => Promise<number>): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

`src/lib/ai/__tests__/needs-review.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { needsReview } from '@/lib/ai/needs-review';

const img = (n: string) => new File(['x'], n, { type: 'image/jpeg' });
const pdf = (n: string) => new File(['x'], n, { type: 'application/pdf' });

describe('needsReview', () => {
  it('is false for a single image', async () => {
    expect(await needsReview([img('a.jpg')], async () => 99)).toBe(false);
  });

  it('is false for a single-page PDF', async () => {
    expect(await needsReview([pdf('a.pdf')], async () => 1)).toBe(false);
  });

  it('is true for a multi-page PDF', async () => {
    expect(await needsReview([pdf('a.pdf')], async () => 3)).toBe(true);
  });

  it('is true for more than one file, without probing any PDF', async () => {
    let probed = 0;
    expect(await needsReview([img('a.jpg'), img('b.jpg')], async () => { probed++; return 1; })).toBe(true);
    expect(probed).toBe(0);
  });

  it('is false for an empty list', async () => {
    expect(await needsReview([], async () => 9)).toBe(false);
  });

  it('is false when the PDF cannot be opened (sent whole, as today)', async () => {
    expect(await needsReview([pdf('locked.pdf')], async () => { throw new Error('PasswordException'); })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/needs-review.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ai/needs-review'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/ai/needs-review.ts`:

```ts
import { loadPdf } from '@/lib/photos/pdf-to-images';

/** Page count of a PDF, releasing pdfjs resources immediately. */
async function defaultCountPdfPages(file: File): Promise<number> {
  const loaded = await loadPdf(file);
  try {
    return loaded.numPages;
  } finally {
    await loaded.destroy();
  }
}

/**
 * True when the surveyor has a decision to make before the AI reads these
 * files: more than one file, or any multi-page PDF. A single image or
 * single-page PDF returns false so the upload starts exactly as before.
 *
 * `countPdfPages` is injectable so the gate is unit-testable in node
 * (pdfjs needs a DOM/canvas).
 */
export async function needsReview(
  files: File[],
  countPdfPages: (file: File) => Promise<number> = defaultCountPdfPages,
): Promise<boolean> {
  if (files.length === 0) return false;
  if (files.length > 1) return true;
  const [file] = files;
  if (file.type !== 'application/pdf') return false;
  try {
    return (await countPdfPages(file)) > 1;
  } catch {
    // Unreadable / password-protected: nothing to pick from, send whole.
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/needs-review.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/needs-review.ts src/lib/ai/__tests__/needs-review.test.ts
git commit -m "feat(ai): needsReview gate — review sheet only for >1 file or a multi-page PDF

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Shared `PdfPageGrid`

**Files:**
- Create: `src/components/documents/PdfPageGrid.tsx`
- Modify: `src/components/tabs/photos/PdfPageSelectorDialog.tsx:7-11, 73-97`

**Interfaces:**
- Produces:
  ```ts
  export interface PdfPage { pageNumber: number; thumbDataUrl: string }
  export function PdfPageGrid(props: { pages: PdfPage[]; checked: Set<number>; onToggle: (pageNumber: number) => void; className?: string }): JSX.Element
  ```
- `PdfPageSelectorDialog` keeps re-exporting `PdfPage` (the annexure section imports it from there).

- [ ] **Step 1: Create the grid**

`src/components/documents/PdfPageGrid.tsx`:

```tsx
'use client';

/** One page of a PDF, already thumbnailed. */
export interface PdfPage {
  pageNumber: number;
  thumbDataUrl: string;
}

interface PdfPageGridProps {
  pages: PdfPage[];
  checked: Set<number>;
  onToggle: (pageNumber: number) => void;
  className?: string;
}

/**
 * Thumbnail grid with a checkbox per page. Shared by the annexure page
 * picker and the AI review sheet so both "choose pages" moments look and
 * behave the same.
 */
export function PdfPageGrid({ pages, checked, onToggle, className = '' }: PdfPageGridProps) {
  return (
    <div className={`grid grid-cols-3 gap-3 ${className}`}>
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
              onChange={() => onToggle(page.pageNumber)}
              className="accent-primary"
            />
            Page {page.pageNumber}
          </div>
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Use it in `PdfPageSelectorDialog`**

In `src/components/tabs/photos/PdfPageSelectorDialog.tsx`:

Replace the local interface (lines 7-11):

```ts
/** One page of a PDF, already thumbnailed. */
export interface PdfPage {
  pageNumber: number;
  thumbDataUrl: string;
}
```

with:

```ts
import { PdfPageGrid, type PdfPage } from '@/components/documents/PdfPageGrid';
export type { PdfPage };
```

Replace the whole `<div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto py-1"> … </div>` block (the `pages.map(...)` markup) with:

```tsx
        <PdfPageGrid
          pages={pages}
          checked={checked}
          onToggle={togglePage}
          className="max-h-[50vh] overflow-y-auto py-1"
        />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run src/lib/photos`
Expected: clean / PASS. `grep -rn "PdfPage\b" src --include=*.tsx --include=*.ts` should show `DocumentAnnexureSection.tsx` still importing from `PdfPageSelectorDialog` and compiling.

- [ ] **Step 4: Commit**

```bash
git add src/components/documents/PdfPageGrid.tsx src/components/tabs/photos/PdfPageSelectorDialog.tsx
git commit -m "refactor(photos): lift PDF page thumbnail grid into shared PdfPageGrid

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Page selection in `DocumentReviewSheet`

**Files:**
- Modify: `src/components/documents/DocumentReviewSheet.tsx`

**Interfaces:**
- Consumes: `setAIPages` (Task 1), `PdfPageGrid`/`PdfPage` (Task 3), `loadPdf`, `PDF_THUMB_WIDTH`, `PDF_THUMB_QUALITY`, `LoadedPdf` from `src/lib/photos/pdf-to-images.ts`.
- Produces: unchanged public props `{ open, slotLabel?, files, onConfirm(allFiles, filesForAI), onCancel }`. Tags each sent PDF via `setAIPages` when a subset of pages is ticked.

- [ ] **Step 1: Add imports**

At the top of `DocumentReviewSheet.tsx`, after the existing imports:

```ts
import { loadPdf, type LoadedPdf, PDF_THUMB_WIDTH, PDF_THUMB_QUALITY } from '@/lib/photos/pdf-to-images';
import { PdfPageGrid, type PdfPage } from '@/components/documents/PdfPageGrid';
import { setAIPages } from '@/lib/ai/ai-pages';
```

- [ ] **Step 2: Add per-PDF page state**

Inside `DocumentReviewSheet`, after `const [cropIndex, setCropIndex] = useState<number | null>(null);` add:

```ts
  // Per-file PDF info, keyed by index into `workingFiles`. Only multi-page
  // PDFs get an entry with pages; a 1-page PDF or an unreadable PDF has no
  // entry and behaves exactly as before (sent whole).
  type PdfInfo = { numPages: number; pages: PdfPage[]; ticked: Set<number>; loaded: LoadedPdf };
  const [pdfInfo, setPdfInfo] = useState<Record<number, PdfInfo>>({});
  const [pdfProbing, setPdfProbing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadedRefs: LoadedPdf[] = [];
    const pdfIndexes = workingFiles.map((f, i) => (f.type === 'application/pdf' ? i : -1)).filter(i => i >= 0);
    if (pdfIndexes.length === 0) return;

    setPdfProbing(true);
    (async () => {
      for (const i of pdfIndexes) {
        try {
          const loaded = await loadPdf(workingFiles[i]);
          if (cancelled) { await loaded.destroy(); return; }
          if (loaded.numPages < 2) { await loaded.destroy(); continue; }
          loadedRefs.push(loaded);
          const pageNumbers = Array.from({ length: loaded.numPages }, (_, k) => k + 1);
          setPdfInfo(prev => ({
            ...prev,
            [i]: { numPages: loaded.numPages, pages: [], ticked: new Set(pageNumbers), loaded },
          }));
          // Thumbnails stream in one by one so a long PDF shows progress.
          for (const p of pageNumbers) {
            const thumb = await loaded.renderPage(p, PDF_THUMB_WIDTH, PDF_THUMB_QUALITY);
            if (cancelled) return;
            setPdfInfo(prev => {
              const cur = prev[i];
              if (!cur) return prev;
              return { ...prev, [i]: { ...cur, pages: [...cur.pages, { pageNumber: p, thumbDataUrl: thumb.dataUrl }] } };
            });
          }
        } catch {
          // Password-protected / corrupt: no page grid; the file can still be
          // sent whole. The card says so (see render).
        }
      }
    })().finally(() => { if (!cancelled) setPdfProbing(false); });

    return () => {
      cancelled = true;
      for (const l of loadedRefs) void l.destroy();
    };
  }, [workingFiles]);

  const togglePage = (fileIndex: number, pageNumber: number) =>
    setPdfInfo(prev => {
      const cur = prev[fileIndex];
      if (!cur) return prev;
      const ticked = new Set(cur.ticked);
      if (ticked.has(pageNumber)) ticked.delete(pageNumber); else ticked.add(pageNumber);
      return { ...prev, [fileIndex]: { ...cur, ticked } };
    });
```

Note: cropping replaces an image `File` in `workingFiles`, which re-runs this effect and re-probes PDFs. Acceptable — cropping is rare and PDFs are small to re-open. (`// ponytail: re-probe on crop; key by File identity if it ever matters`.) Add that comment above the `useEffect`.

- [ ] **Step 3: Page-aware counts and Send**

Replace:

```ts
  const isImage = (f: File) => f.type.startsWith('image/');
  const selectedImageCount = workingFiles.filter((f, i) => selected[i] && isImage(f)).length;
  const selectedCount = selected.filter(Boolean).length;
```

with:

```ts
  const isImage = (f: File) => f.type.startsWith('image/');
  // A multi-page PDF with every page unticked is not sent at all.
  const isSent = (i: number) => selected[i] && (pdfInfo[i] ? pdfInfo[i].ticked.size > 0 : true);
  const selectedCount = workingFiles.filter((_, i) => isSent(i)).length;
  // What actually reaches the provider: one image per photo, one per ticked PDF page.
  const selectedImageCount = workingFiles.reduce((n, f, i) => {
    if (!isSent(i)) return n;
    if (isImage(f)) return n + 1;
    return n + (pdfInfo[i]?.ticked.size ?? 1);
  }, 0);
```

Replace `handleSend`:

```ts
  const handleSend = () => {
    const filesForAI = workingFiles.filter((_, i) => isSent(i));
    if (filesForAI.length === 0) return;
    workingFiles.forEach((f, i) => {
      const info = pdfInfo[i];
      if (isSent(i) && info && info.ticked.size < info.numPages) {
        setAIPages(f, [...info.ticked].sort((a, b) => a - b));
      }
    });
    onConfirm(workingFiles, filesForAI);
  };
```

- [ ] **Step 4: Render the page grid inside the PDF card**

The current file card is a single-row flex. Wrap it so a page grid can sit below the row. Replace the `workingFiles.map((file, i) => ( <div key=… className="flex items-center gap-3 …"> … </div> ))` body with:

```tsx
          {workingFiles.map((file, i) => {
            const info = pdfInfo[i];
            return (
              <div
                key={`${file.name}-${i}`}
                className={`rounded-lg border p-2 transition-colors ${
                  selected[i] ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Select toggle */}
                  <button
                    onClick={() => toggle(i)}
                    aria-label={selected[i] ? 'Exclude from AI' : 'Include in AI'}
                    className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center ${
                      selected[i] ? 'bg-primary border-primary text-white' : 'border-muted-foreground/40 text-transparent'
                    }`}
                  >
                    <Check size={14} strokeWidth={3} />
                  </button>

                  {/* Thumbnail / PDF card */}
                  {isImage(file) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urls[i]}
                      alt={file.name}
                      className="w-14 h-14 object-cover rounded-md border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-md border border-border shrink-0 flex items-center justify-center bg-muted/40">
                      <FileText size={20} className="text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {isImage(file) ? 'Image' : 'PDF'} · {Math.max(1, Math.round(file.size / 1024))} KB
                      {info && <> · {info.ticked.size} of {info.numPages} pages</>}
                    </p>
                  </div>

                  {/* Crop (images only) */}
                  {isImage(file) && (
                    <button
                      onClick={() => setCropIndex(i)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted/50"
                    >
                      <CropIcon size={13} /> Crop
                    </button>
                  )}
                </div>

                {/* Page picker — multi-page PDFs only */}
                {info && selected[i] && (
                  <div className="mt-2 pl-9">
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                      Untick pages the AI should skip — cover letters, terms, blank scans.
                    </p>
                    <PdfPageGrid
                      pages={info.pages}
                      checked={info.ticked}
                      onToggle={p => togglePage(i, p)}
                    />
                    {info.pages.length < info.numPages && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Loader2 size={11} className="animate-spin" /> Loading page {info.pages.length + 1} of {info.numPages}…
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
```

`Loader2` is already imported. `pdfProbing` is used only to gate the Send button (next step) so page counts are known before sending.

- [ ] **Step 5: Gate Send on page counts**

Change the Send button's `disabled` from `selectedCount === 0` to `selectedCount === 0 || pdfProbing`. (The sheet still opens instantly; Send enables as soon as every PDF's page count is known — thumbnails may still be streaming.)

Also update the warning copy so it's page-aware:

```tsx
            {selectedImageCount > AI_IMAGE_WARN && (
              <span className="block text-status-warning">
                {selectedImageCount} images/pages — some free models accept only {AI_IMAGE_WARN}.
              </span>
            )}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean / green.

Then preview: start the dev server (`preview_start`, name from `.claude/launch.json`), open a claim → Documents tab → upload a 3+ page PDF to any slot. Expect: sheet opens, "N of N pages" on the card, thumbnails stream in, unticking updates the count, Send disabled while probing then enabled, and progress reads "page 1 of (ticked)" during extraction. Upload a JPEG: sheet opens as before with no grid. (Auth-gated — if no credentials are available in the session, state that this step could not be run rather than faking it.)

- [ ] **Step 7: Commit**

```bash
git add src/components/documents/DocumentReviewSheet.tsx
git commit -m "feat(documents): review sheet lets the surveyor untick PDF pages before AI

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire the Estimate upload (AssessmentTab)

**Files:**
- Modify: `src/components/tabs/AssessmentTab.tsx:1-70, 74-78`

**Interfaces:**
- Consumes: `needsReview` (Task 2), `DocumentReviewSheet` (Task 4).

- [ ] **Step 1: Imports and state**

Add imports:

```ts
import { needsReview } from '@/lib/ai/needs-review';
import { DocumentReviewSheet } from '@/components/documents/DocumentReviewSheet';
import type { EstimateApplyMode } from '@/stores/slices/aiDataSlice';
```

After `const [showSummary, setShowSummary] = useState(true);` add:

```ts
  // Open only when there is something to decide (multi-page PDF); see needsReview.
  const [reviewSheet, setReviewSheet] = useState<{ file: File; mode: EstimateApplyMode } | null>(null);
```

- [ ] **Step 2: Split the handler**

Replace the body of `handleEstimateUpload` from `// Store blob URL …` through `triggerExtraction('estimate', file, undefined, undefined, mode);` with a gate, and move the post-decision work into a `startEstimate` function. The result:

```ts
  // Everything that happens once the surveyor has decided which file/pages go
  // to the AI: evidence blob, extraction, optional Drive upload.
  const startEstimate = async (file: File, mode: EstimateApplyMode) => {
    // Store blob URL for the Evidence Viewer to display the file natively
    if (currentClaim?.id) {
      storeBlobUrl(currentClaim.id, 'estimate', file);

      // Auto-open evidence panel and focus on estimate
      setShowEvidence(true);
      useEvidenceStore.getState().openField(currentClaim.id, {
        docType: 'estimate',
        fieldKey: '',
        contextSnippet: ''
      });
    }

    triggerExtraction('estimate', file, undefined, undefined, mode);

    if (currentClaim?.id && profile.autoUploadDrive !== false) {
      const claimId = currentClaim.id;
      const label = currentClaim.vehicle?.registrationNumber || claimId;
      const ext = file.name.split('.').pop() ?? 'bin';
      if (await confirmSaveToCloud(file.name)) {
        uploadFileToDrive(claimId, `estimate.${ext}`, file, label).catch(console.error);
      }
    }
  };

  const handleEstimateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    // Asked BEFORE extraction: a wrong file, or a surveyor who changes their
    // mind, then costs nothing. Resolves straight to 'replace' on an empty
    // sheet — nothing to lose, so nothing to ask.
    const mode = await confirmEstimateMode(file.name);
    if (mode === null) return;

    if (await needsReview([file])) {
      setReviewSheet({ file, mode });
      return;
    }
    await startEstimate(file, mode);
  };
```

(`e.target.value = ''` moves to the top so the same file can be re-picked after a cancel; the old trailing reset is removed.)

- [ ] **Step 3: Render the sheet**

Next to `{estimateModeDialog}` add:

```tsx
      {reviewSheet && (
        <DocumentReviewSheet
          open
          slotLabel="Estimate"
          files={[reviewSheet.file]}
          onCancel={() => setReviewSheet(null)}
          onConfirm={(_all, forAI) => {
            const { mode } = reviewSheet;
            setReviewSheet(null);
            if (forAI[0]) void startEstimate(forAI[0], mode);
          }}
        />
      )}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: clean. Preview if credentials allow: upload a multi-page estimate PDF → mode prompt → review sheet → untick → Send → progress "page 1 of N". Upload a JPEG → mode prompt → extraction starts immediately, no sheet.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/AssessmentTab.tsx
git commit -m "feat(assessment): estimate upload goes through the AI review sheet for multi-page PDFs

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Wire the Final Bill upload (BillCheckTab)

**Files:**
- Modify: `src/components/tabs/BillCheckTab.tsx:1-20, 143-147, ~322`

**Interfaces:**
- Consumes: `needsReview` (Task 2), `DocumentReviewSheet` (Task 4).

- [ ] **Step 1: Imports and state**

Add imports:

```ts
import { needsReview } from '@/lib/ai/needs-review';
import { DocumentReviewSheet } from '@/components/documents/DocumentReviewSheet';
```

Near the other `useState` calls in the component add:

```ts
  const [reviewFile, setReviewFile] = useState<File | null>(null);
```

- [ ] **Step 2: Gate the handler**

Replace:

```ts
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) triggerExtraction('final-bill', file);
    e.target.value = '';
  };
```

with:

```ts
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (await needsReview([file])) setReviewFile(file);
    else triggerExtraction('final-bill', file);
  };
```

`BillCheckUploadPanel`'s `onFileUpload` prop type must accept an async handler — check `src/components/tabs/bill-check/BillCheckUploadPanel.tsx`; if it is typed `(e: React.ChangeEvent<HTMLInputElement>) => void`, an async function is assignable (returns a Promise, which `void` accepts). No change needed.

- [ ] **Step 3: Render the sheet**

Immediately before the existing `<AIReviewDialog` in the JSX add:

```tsx
      {reviewFile && (
        <DocumentReviewSheet
          open
          slotLabel="Final Bill"
          files={[reviewFile]}
          onCancel={() => setReviewFile(null)}
          onConfirm={(_all, forAI) => {
            setReviewFile(null);
            if (forAI[0]) triggerExtraction('final-bill', forAI[0]);
          }}
        />
      )}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/BillCheckTab.tsx
git commit -m "feat(bill-check): final bill upload goes through the AI review sheet for multi-page PDFs

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Wire the Details slots (DetailsTab)

**Files:**
- Modify: `src/components/tabs/DetailsTab.tsx:1-20, 102-105, ~305`

**Interfaces:**
- Consumes: `needsReview` (Task 2), `DocumentReviewSheet` (Task 4).

- [ ] **Step 1: Imports and state**

Add imports:

```ts
import { needsReview } from '@/lib/ai/needs-review';
import { DocumentReviewSheet } from '@/components/documents/DocumentReviewSheet';
```

Near the other `useState` calls in `DetailsTab` add:

```ts
  const [reviewSheet, setReviewSheet] = useState<{ key: string; label: string; file: File } | null>(null);
```

- [ ] **Step 2: Gate the handler**

`docSlots` is declared *after* `handleFileChange`; move the `docSlots` array above the handler so the label can be looked up, then replace the handler with:

```ts
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (await needsReview([file])) {
      const label = docSlots.find(s => s.id === key)?.label ?? key.toUpperCase();
      setReviewSheet({ key, label, file });
      return;
    }
    triggerExtraction(key, file);
  };
```

- [ ] **Step 3: Render the sheet**

Immediately before the existing `<AIReviewDialog` add:

```tsx
      {reviewSheet && (
        <DocumentReviewSheet
          open
          slotLabel={reviewSheet.label}
          files={[reviewSheet.file]}
          onCancel={() => setReviewSheet(null)}
          onConfirm={(_all, forAI) => {
            const { key } = reviewSheet;
            setReviewSheet(null);
            if (forAI[0]) triggerExtraction(key, forAI[0]);
          }}
        />
      )}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean / green.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/DetailsTab.tsx
git commit -m "feat(details): RC/DL/policy uploads go through the AI review sheet for multi-page PDFs

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Docs and final verification

**Files:**
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`, `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`
- Create: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-09-17-ai-pdf-page-selection.md`

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all clean/green; the static export compiles.

- [ ] **Step 2: Session log**

Write `Sessions/2026-09-17-ai-pdf-page-selection.md` (follow the format of the latest file in `Sessions/`): what changed (page selection on all four AI upload paths; `ai-pages.ts` WeakMap carrier; `needsReview` gate; `PdfPageGrid` shared; three tabs gained the review sheet), the quota rationale (unticked pages are never rasterized — zero tokens), the manual E2E checklist from the spec §5 with results (or "not run — no credentials in session"), and the two deferred follow-ups from the spec's Non-Goals: auto-suggest junk pages from the text layer, and text-instead-of-image for digital PDFs.

- [ ] **Step 3: Changelog + Tasks**

Add a Changelog entry under today's date with the one-line summary and the list of files. In `Tasks.md`, mark this feature done and add the two follow-ups as open items.

- [ ] **Step 4: Commit**

```bash
git add SurveyOS-Antigravity-Prime-V2-KnowledgeBase
git commit -m "docs: session log, changelog and tasks — AI upload PDF page selection

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Do NOT deploy — deploy target is `motorsurveyos-in` and needs explicit approval.

---

## Self-review

- **Spec coverage:** §1 (carrier, filter, aligned arrays, renumbered progress, out-of-range clamp) → Task 1; §2 (sheet: loadPdf, grid, tick state, zero-ticked ⇒ not sent, setAIPages on Send, password/corrupt card, destroy on confirm/cancel, page-aware AI_IMAGE_WARN) → Task 4 (destroy on cancel/confirm happens in the effect cleanup when the sheet unmounts — the parent mounts it fresh each open); §3 (`needsReview`, three tabs, Documents + Sync path unchanged) → Tasks 2, 5, 6, 7; §4 error handling → Tasks 1 (clamp/empty), 2 (unreadable ⇒ false), 4 (catch on load); §5 tests → Tasks 1, 2 (unit), 4–5 (manual); docs → Task 8.
- **Placeholders:** none. Every code step shows the code; verification steps have commands and expected output.
- **Type consistency:** `setAIPages/getAIPages/resolveAIPages` (Task 1) used in Tasks 1, 4; `needsReview(files, countPdfPages?)` (Task 2) used in Tasks 5–7 as `needsReview([file])`; `PdfPage`/`PdfPageGrid` props `{ pages, checked, onToggle, className? }` (Task 3) used in Tasks 3, 4; `DocumentReviewSheet` props unchanged and used identically in Tasks 5–7; `EstimateApplyMode` import path matches `useAIExtraction.ts`.
- **Node test constraint:** neither unit test touches pdfjs/canvas — `resolveAIPages` is pure and `needsReview` takes an injected counter.
