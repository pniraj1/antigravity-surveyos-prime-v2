# Document Annexure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Document Annexure to the Photo Engine — a separate printable PDF of supporting documents (RC/DL screenshots, policy schedules, anything), with per-image rotation and an optional surveyor attestation strip on every page.

**Architecture:** Documents live in the existing `claim.photos` array, discriminated by a new optional `PhotoItem.kind` field, so they inherit IndexedDB persistence, Google Drive upload and Drive restore for free. All layout maths, array partitioning and strip composition are extracted into pure functions in `src/lib/photos/` so they are unit-testable under Vitest's `node` environment; canvas and react-pdf work stays at the edges in components.

**Tech Stack:** Next.js 16 (static export) + React 19, TypeScript, Zustand, `@react-pdf/renderer`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-01-document-annexure-design.md`

## Global Constraints

- **Test environment is `node`** (`vitest.config.ts`). No `document`, no `Image`, no `canvas` in tests. Only pure functions get unit tests. Do not add jsdom.
- **Test command is `npx vitest run <path>`** for a single file. `npm test` also runs `test:functions`, which is slower and unrelated.
- **Path alias `@` → `./src`** is configured in both `tsconfig` and `vitest.config.ts`.
- **Immutability is mandatory** (project coding-style rule). Never mutate arrays or objects in store actions; spread and replace.
- **No `console.log`** in production code. A hook flags it.
- **No `any`.** Use `unknown` and narrow, per the TypeScript style rule.
- **Explicit types on all exported functions.**
- **Files stay under 800 lines**; prefer many small files.
- **Existing damage-photo output must not change.** `PhotoSheetDocument`'s `objectFit: 'fill'` stays as-is; `compressImage`'s existing 2-argument call sites must produce byte-identical output.
- **A4 geometry, in points:** portrait 595 × 842, landscape 842 × 595. Header 45, footer 25, attestation strip 95 (fixed reserve, 0 when `verified` is off).
- **Commit format:** `<type>: <description>` — `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

## Deviation from the spec

The spec names the store action `rotatePhoto(index)`. This plan uses **`replacePhotoImage(index, dataUrl, w, h)`** instead. Reason: rotation requires canvas work, which is asynchronous, and every existing action in `claimSlice.ts` is synchronous. Keeping the store synchronous means the component awaits `rotateImage90()` and then calls a plain setter. Behaviour is identical; only the seam moves.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/types/assessment.ts` | modify | `PhotoItem.kind`, `DocumentLayout`, `DocumentAnnexureOptions` |
| `src/types/claim.ts` | modify | `ClaimData.documentAnnexure` + default in `createEmptyClaim` |
| `src/lib/photos/document-annexure.ts` | create | Pure: partitioning, layout maths, strip composition, defaults, Drive filename prefix |
| `src/lib/photos/__tests__/document-annexure.test.ts` | create | Unit tests for all of the above |
| `src/lib/photos/rotate-image.ts` | create | Canvas 90° rotation (browser-only, no unit test) |
| `src/stores/slices/claimSlice.ts` | modify | `addPhoto` kind param, `replacePhotoImage`, `updateDocumentAnnexure` |
| `src/components/pdf/PhotoSheetDocument.tsx` | modify | Exclude documents from the damage sheet |
| `src/components/pdf/DocumentAnnexureDocument.tsx` | create | The annexure PDF: header, grid, attestation strip, footer |
| `src/components/pdf/DocumentAnnexureDownloadButton.tsx` | create | `PDFDownloadLink` wrapper (static-import constraint) |
| `src/components/pdf/DocumentAnnexurePreview.tsx` | create | `PDFViewer` wrapper |
| `src/components/tabs/photos/DocumentAnnexureSection.tsx` | create | The UI section: dropzone, gallery, controls |
| `src/components/tabs/PhotosTab.tsx` | modify | `compressImage` params, Drive prefix, restore prefix, render the section |

---

### Task 1: Types and claim defaults

**Files:**
- Modify: `src/types/assessment.ts:245-271`
- Modify: `src/types/claim.ts` (interface near line 93, default near line 394)
- Test: `src/lib/photos/__tests__/document-annexure.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PhotoItem.kind?: 'damage' | 'document'`; `type DocumentLayout = 1 | 2 | 4`; `interface DocumentAnnexureOptions`; `ClaimData.documentAnnexure: DocumentAnnexureOptions`.

- [ ] **Step 1: Add the types**

In `src/types/assessment.ts`, replace the `PhotoItem` interface and append the new types after `PhotoSheetOptions`:

```typescript
// ─── PHOTO SHEET ────────────────────────────────────────
export interface PhotoItem {
  dataUrl: string;
  name: string;
  /** Original pixel width captured at upload time (used for orientation detection) */
  w?: number;
  /** Original pixel height captured at upload time (used for orientation detection) */
  h?: number;
  /**
   * Which output this image belongs to. 'document' items render in the Document
   * Annexure and never in the damage photo sheet. Undefined is treated as
   * 'damage', which keeps every claim created before this field existed valid.
   */
  kind?: 'damage' | 'document';
}
```

Then, after the existing `PhotoSheetOptions` interface, add:

```typescript
// ─── DOCUMENT ANNEXURE ──────────────────────────────────
/** Number of documents per A4 page. */
export type DocumentLayout = 1 | 2 | 4;

/**
 * Persisted on the claim (unlike PhotoSheetOptions, which is runtime-only)
 * because the surveyor customises the attestation strip per claim.
 */
export interface DocumentAnnexureOptions {
  layout: DocumentLayout;
  pageOrientation: PageOrientation;
  /** Master toggle. When false no attestation strip is rendered at all. */
  verified: boolean;
  /** Include the "IRDAI: … · IIISLA: …" line. */
  showLicence: boolean;
  /** Include the "<place> · <date>" line. */
  showDatePlace: boolean;
  place: string;
  /** ISO date (YYYY-MM-DD). */
  verifiedDate: string;
  pagePadding: number;
  cellGap: number;
  showBorder: boolean;
  borderColor: string;
}
```

- [ ] **Step 2: Add the claim field**

In `src/types/claim.ts`, import `DocumentAnnexureOptions` alongside the existing assessment-type imports on line 10, then extend the Photo Sheet block near line 93:

```typescript
  // ─── Photo Sheet ───────────────────────────────────
  photos: PhotoItem[];
  photoLayout: PhotoLayout;
  photoLandscape: boolean;

  // ─── Document Annexure ─────────────────────────────
  documentAnnexure: DocumentAnnexureOptions;
```

- [ ] **Step 3: Write the failing test**

Create `src/lib/photos/__tests__/document-annexure.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DEFAULT_DOCUMENT_ANNEXURE_OPTIONS } from '@/lib/photos/document-annexure';

describe('DEFAULT_DOCUMENT_ANNEXURE_OPTIONS', () => {
  it('defaults to 2-up portrait, the optimal layout for phone screenshots', () => {
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.layout).toBe(2);
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.pageOrientation).toBe('portrait');
  });

  it('defaults verified to false so the app never asserts verification on its own', () => {
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.verified).toBe(false);
  });

  it('matches the photo sheet defaults for the shared cosmetic options', () => {
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.pagePadding).toBe(20);
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.cellGap).toBe(8);
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.showBorder).toBe(true);
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.borderColor).toBe('#E5E7EB');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npx vitest run src/lib/photos/__tests__/document-annexure.test.ts
```

Expected: FAIL — cannot resolve `@/lib/photos/document-annexure`.

- [ ] **Step 5: Create the defaults**

Create `src/lib/photos/document-annexure.ts`:

```typescript
import type { DocumentAnnexureOptions } from '@/types/assessment';

/**
 * Default is 2-up portrait, not 1-up. Because images are fitted with
 * objectFit:'contain', a tall phone screenshot (aspect ~0.45) is height-limited
 * in a wide cell: at 1-up portrait it renders 287pt wide, at 2-up 273pt — a 5%
 * legibility gain for double the paper. See the design spec for the full table.
 */
export const DEFAULT_DOCUMENT_ANNEXURE_OPTIONS: DocumentAnnexureOptions = {
  layout: 2,
  pageOrientation: 'portrait',
  verified: false,
  showLicence: true,
  showDatePlace: true,
  place: '',
  verifiedDate: '',
  pagePadding: 20,
  cellGap: 8,
  showBorder: true,
  borderColor: '#E5E7EB',
};
```

- [ ] **Step 6: Wire the default into new claims**

In `src/types/claim.ts`, import the constant and add the field to `createEmptyClaim` immediately after `photoLandscape: false,` (near line 396):

```typescript
    photos: [],
    photoLayout: 6,
    photoLandscape: false,
    documentAnnexure: { ...DEFAULT_DOCUMENT_ANNEXURE_OPTIONS },
```

Note: spread, do not assign the constant by reference — otherwise every claim shares one mutable object.

- [ ] **Step 7: Run test to verify it passes**

```bash
npx vitest run src/lib/photos/__tests__/document-annexure.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 8: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors. If `createEmptyClaim` is not the only place constructing a `ClaimData`, TypeScript will name the other sites — add `documentAnnexure: { ...DEFAULT_DOCUMENT_ANNEXURE_OPTIONS }` to each.

- [ ] **Step 9: Commit**

```bash
git add src/types/assessment.ts src/types/claim.ts src/lib/photos/document-annexure.ts src/lib/photos/__tests__/document-annexure.test.ts
git commit -m "feat(annexure): add document annexure types and claim defaults"
```

---

### Task 2: Partition photos by kind, preserving real indices

This is the task that prevents the worst bug in the feature. The document gallery shows a *filtered* subset of `claim.photos`, but `deletePhoto(index)` and `updatePhotoName(index)` take indices into the *full* array. Passing a filtered position to them deletes the wrong image.

**Files:**
- Modify: `src/lib/photos/document-annexure.ts`
- Test: `src/lib/photos/__tests__/document-annexure.test.ts`

**Interfaces:**
- Consumes: `PhotoItem` from Task 1.
- Produces: `interface IndexedPhoto { item: PhotoItem; index: number }`; `partitionPhotos(photos: readonly PhotoItem[]): { damage: IndexedPhoto[]; documents: IndexedPhoto[] }`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/photos/__tests__/document-annexure.test.ts`:

```typescript
import { partitionPhotos } from '@/lib/photos/document-annexure';
import type { PhotoItem } from '@/types/assessment';

const photo = (name: string, kind?: PhotoItem['kind']): PhotoItem => ({
  dataUrl: `data:image/jpeg;base64,${name}`,
  name,
  w: 100,
  h: 200,
  ...(kind ? { kind } : {}),
});

describe('partitionPhotos', () => {
  it('splits documents from damage photos', () => {
    const { damage, documents } = partitionPhotos([
      photo('front', 'damage'),
      photo('rc', 'document'),
    ]);
    expect(damage.map(d => d.item.name)).toEqual(['front']);
    expect(documents.map(d => d.item.name)).toEqual(['rc']);
  });

  it('treats a missing kind as damage, keeping pre-existing claims valid', () => {
    const { damage, documents } = partitionPhotos([photo('legacy')]);
    expect(damage.map(d => d.item.name)).toEqual(['legacy']);
    expect(documents).toEqual([]);
  });

  it('reports the index into the full array, not the filtered position', () => {
    const { documents } = partitionPhotos([
      photo('front', 'damage'),   // 0
      photo('rc', 'document'),    // 1
      photo('rear', 'damage'),    // 2
      photo('dl', 'document'),    // 3
    ]);
    // The second *document* sits at index 3 of the full array, not index 1.
    expect(documents.map(d => d.index)).toEqual([1, 3]);
  });

  it('returns empty partitions for an empty array', () => {
    expect(partitionPhotos([])).toEqual({ damage: [], documents: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/photos/__tests__/document-annexure.test.ts
```

Expected: FAIL — `partitionPhotos is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/photos/document-annexure.ts`:

```typescript
import type { PhotoItem } from '@/types/assessment';

/** A photo paired with its index into the claim's full `photos` array. */
export interface IndexedPhoto {
  item: PhotoItem;
  /**
   * Index into `claim.photos`. Always pass THIS to deletePhoto /
   * updatePhotoName / replacePhotoImage — never the filtered position, or you
   * will mutate the wrong image.
   */
  index: number;
}

/**
 * Split a claim's photos into the damage sheet's items and the annexure's,
 * keeping each item's real array index. Single source of truth for the
 * kind filter, so the two PDF documents can never disagree about ownership.
 */
export function partitionPhotos(photos: readonly PhotoItem[]): {
  damage: IndexedPhoto[];
  documents: IndexedPhoto[];
} {
  const damage: IndexedPhoto[] = [];
  const documents: IndexedPhoto[] = [];

  photos.forEach((item, index) => {
    if (item.kind === 'document') {
      documents.push({ item, index });
    } else {
      damage.push({ item, index });
    }
  });

  return { damage, documents };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/photos/__tests__/document-annexure.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/photos/document-annexure.ts src/lib/photos/__tests__/document-annexure.test.ts
git commit -m "feat(annexure): partition photos by kind, preserving real indices"
```

---

### Task 3: Exclude documents from the damage photo sheet

**Files:**
- Modify: `src/components/pdf/PhotoSheetDocument.tsx:204`
- Test: `src/lib/photos/__tests__/document-annexure.test.ts`

**Interfaces:**
- Consumes: `partitionPhotos` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append to the test file:

```typescript
describe('damage sheet exclusion', () => {
  it('never includes documents among the damage photos', () => {
    const { damage } = partitionPhotos([
      photo('rc', 'document'),
      photo('front', 'damage'),
      photo('dl', 'document'),
    ]);
    expect(damage).toHaveLength(1);
    expect(damage.every(d => d.item.kind !== 'document')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes already**

```bash
npx vitest run src/lib/photos/__tests__/document-annexure.test.ts
```

Expected: PASS. This test pins the contract that the component change below relies on; the helper already satisfies it. The component edit is what makes it *true in the product*.

- [ ] **Step 3: Apply the filter in the component**

In `src/components/pdf/PhotoSheetDocument.tsx`, add the import at the top:

```typescript
import { partitionPhotos } from '@/lib/photos/document-annexure';
```

Then replace line 204:

```typescript
  const photos      = Array.isArray(claim?.photos) ? claim.photos : [];
```

with:

```typescript
  // Documents belong to the Document Annexure, never to the damage sheet.
  const photos      = partitionPhotos(Array.isArray(claim?.photos) ? claim.photos : [])
                        .damage.map(d => d.item);
```

Leave everything else in this file alone — in particular `objectFit: 'fill'` on line 68 stays, so existing damage-sheet output is unchanged.

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/pdf/PhotoSheetDocument.tsx src/lib/photos/__tests__/document-annexure.test.ts
git commit -m "feat(annexure): exclude documents from the damage photo sheet"
```

---

### Task 4: Annexure layout geometry

**Files:**
- Modify: `src/lib/photos/document-annexure.ts`
- Test: `src/lib/photos/__tests__/document-annexure.test.ts`

**Interfaces:**
- Consumes: `DocumentLayout`, `DocumentAnnexureOptions` from Task 1.
- Produces: `DOC_HEADER_H`, `DOC_FOOTER_H`, `DOC_STRIP_H`; `interface DocLayoutConfig { cols, rows, cellW, cellH, gap, perPage, pagePortrait }`; `buildDocLayout(layout, opts, pagePortrait): DocLayoutConfig`.

- [ ] **Step 1: Write the failing test**

Append to the test file:

```typescript
import { buildDocLayout, DEFAULT_DOCUMENT_ANNEXURE_OPTIONS as D } from '@/lib/photos/document-annexure';

describe('buildDocLayout', () => {
  const verified = { ...D, verified: true };

  it('portrait 1-up fills the whole grid', () => {
    const c = buildDocLayout(1, verified, true);
    expect(c.cols).toBe(1);
    expect(c.rows).toBe(1);
    expect(c.cellW).toBeCloseTo(555, 1);
    expect(c.cellH).toBeCloseTo(637, 1);
  });

  it('portrait 2-up is two columns of full height', () => {
    const c = buildDocLayout(2, verified, true);
    expect(c.cols).toBe(2);
    expect(c.rows).toBe(1);
    expect(c.cellW).toBeCloseTo(273.5, 1);
    expect(c.cellH).toBeCloseTo(637, 1);
  });

  it('portrait 4-up is a 2x2 grid', () => {
    const c = buildDocLayout(4, verified, true);
    expect(c.cols).toBe(2);
    expect(c.rows).toBe(2);
    expect(c.cellW).toBeCloseTo(273.5, 1);
    expect(c.cellH).toBeCloseTo(314.5, 1);
  });

  it('landscape 2-up widens the cells and shortens them', () => {
    const c = buildDocLayout(2, verified, false);
    expect(c.cellW).toBeCloseTo(397, 1);
    expect(c.cellH).toBeCloseTo(390, 1);
  });

  it('landscape 4-up halves the cell height', () => {
    const c = buildDocLayout(4, verified, false);
    expect(c.cellW).toBeCloseTo(397, 1);
    expect(c.cellH).toBeCloseTo(191, 1);
  });

  it('reclaims the strip height when verified is off', () => {
    const off = { ...D, verified: false };
    expect(buildDocLayout(1, off, true).cellH).toBeCloseTo(732, 1);
    expect(buildDocLayout(1, off, false).cellH).toBeCloseTo(485, 1);
  });

  it('reserves a fixed strip height regardless of optional lines', () => {
    const bare = { ...D, verified: true, showLicence: false, showDatePlace: false };
    expect(buildDocLayout(1, bare, true).cellH)
      .toBeCloseTo(buildDocLayout(1, verified, true).cellH, 1);
  });

  it('perPage matches the requested layout', () => {
    expect(buildDocLayout(1, verified, true).perPage).toBe(1);
    expect(buildDocLayout(2, verified, true).perPage).toBe(2);
    expect(buildDocLayout(4, verified, true).perPage).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/photos/__tests__/document-annexure.test.ts
```

Expected: FAIL — `buildDocLayout is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/photos/document-annexure.ts`:

```typescript
import type { DocumentLayout } from '@/types/assessment';

// ─── A4 constants (points) ──────────────────────────────
// A4 portrait 595 x 842, landscape 842 x 595.
export const DOC_HEADER_H = 45;
export const DOC_FOOTER_H = 25;
/**
 * The attestation strip reserves a FIXED height whenever `verified` is on,
 * regardless of which optional lines are enabled. Sizing it to its content
 * would make every cell dimension depend on the licence and place/date
 * checkboxes, so ticking a checkbox would silently reflow the annexure.
 */
export const DOC_STRIP_H = 95;

export interface DocLayoutConfig {
  cols: number;
  rows: number;
  /** Cell width in points. */
  cellW: number;
  /** Cell height in points. */
  cellH: number;
  gap: number;
  perPage: number;
  pagePortrait: boolean;
}

type LayoutOpts = Pick<
  DocumentAnnexureOptions,
  'pagePadding' | 'cellGap' | 'verified'
>;

/**
 * Build the annexure grid. Mirrors buildLayout() in PhotoSheetDocument, but
 * documents are fitted with objectFit:'contain' rather than 'fill' — a
 * stretched document under a signed VERIFIED stamp is altered evidence.
 */
export function buildDocLayout(
  layout: DocumentLayout,
  opts: LayoutOpts,
  pagePortrait: boolean,
): DocLayoutConfig {
  const pad = opts.pagePadding;
  const g = opts.cellGap;

  const pageW = pagePortrait ? 595 : 842;
  const pageH = pagePortrait ? 842 : 595;

  const gridW = pageW - pad * 2;
  const gridH =
    pageH - pad * 2 - DOC_HEADER_H - DOC_FOOTER_H - (opts.verified ? DOC_STRIP_H : 0);

  const cols = layout === 1 ? 1 : 2;
  const rows = layout === 4 ? 2 : 1;

  return {
    cols,
    rows,
    cellW: (gridW - g * (cols - 1)) / cols,
    cellH: (gridH - g * (rows - 1)) / rows,
    gap: g,
    perPage: layout,
    pagePortrait,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/photos/__tests__/document-annexure.test.ts
```

Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/photos/document-annexure.ts src/lib/photos/__tests__/document-annexure.test.ts
git commit -m "feat(annexure): add annexure page geometry"
```

---

### Task 5: Attestation strip composition and Drive filename prefix

**Files:**
- Modify: `src/lib/photos/document-annexure.ts`
- Test: `src/lib/photos/__tests__/document-annexure.test.ts`

**Interfaces:**
- Consumes: `DocumentAnnexureOptions` from Task 1.
- Produces: `interface StripContent { name: string; licence: string | null; placeDate: string | null }`; `buildStripContent(profile, opts): StripContent`; `DOC_FILE_PREFIX`, `PHOTO_FILE_PREFIX`, `isDocumentFileName(fileName: string): boolean`.

- [ ] **Step 1: Write the failing test**

Append to the test file:

```typescript
import {
  buildStripContent,
  isDocumentFileName,
  DOC_FILE_PREFIX,
} from '@/lib/photos/document-annexure';

const profile = {
  name: 'A. Surveyor',
  irdaiLicence: 'SLA-12345',
  iiislaNumber: '6789',
};

describe('buildStripContent', () => {
  it('always returns the surveyor name', () => {
    const s = buildStripContent(profile, { ...D, verified: true });
    expect(s.name).toBe('A. Surveyor');
  });

  it('includes the licence line when enabled', () => {
    const s = buildStripContent(profile, { ...D, verified: true, showLicence: true });
    expect(s.licence).toBe('IRDAI: SLA-12345 · IIISLA: 6789');
  });

  it('omits the licence line when disabled', () => {
    const s = buildStripContent(profile, { ...D, verified: true, showLicence: false });
    expect(s.licence).toBeNull();
  });

  it('omits the licence line when both numbers are blank rather than printing a bare label', () => {
    const s = buildStripContent(
      { name: 'A. Surveyor', irdaiLicence: '', iiislaNumber: '' },
      { ...D, verified: true, showLicence: true },
    );
    expect(s.licence).toBeNull();
  });

  it('includes only the number that is present', () => {
    const s = buildStripContent(
      { name: 'A. Surveyor', irdaiLicence: 'SLA-12345', iiislaNumber: '' },
      { ...D, verified: true, showLicence: true },
    );
    expect(s.licence).toBe('IRDAI: SLA-12345');
  });

  it('formats place and date together', () => {
    const s = buildStripContent(profile, {
      ...D, verified: true, showDatePlace: true, place: 'Nagpur', verifiedDate: '2026-08-01',
    });
    expect(s.placeDate).toBe('Nagpur · 2026-08-01');
  });

  it('shows the date alone when no place is set', () => {
    const s = buildStripContent(profile, {
      ...D, verified: true, showDatePlace: true, place: '', verifiedDate: '2026-08-01',
    });
    expect(s.placeDate).toBe('2026-08-01');
  });

  it('omits place and date when disabled', () => {
    const s = buildStripContent(profile, { ...D, verified: true, showDatePlace: false });
    expect(s.placeDate).toBeNull();
  });
});

describe('isDocumentFileName', () => {
  it('recognises the document prefix used for Drive uploads', () => {
    expect(isDocumentFileName(`${DOC_FILE_PREFIX}1234_rc.jpg`)).toBe(true);
  });

  it('treats a photo-prefixed file as a damage photo', () => {
    expect(isDocumentFileName('photo_1234_front.jpg')).toBe(false);
  });

  it('treats an unrecognised name as a damage photo', () => {
    expect(isDocumentFileName('IMG_0042.jpg')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/photos/__tests__/document-annexure.test.ts
```

Expected: FAIL — `buildStripContent is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/photos/document-annexure.ts`:

```typescript
/** Prefix for annexure documents uploaded to Google Drive. */
export const DOC_FILE_PREFIX = 'doc_';
/** Prefix for damage photos uploaded to Google Drive. */
export const PHOTO_FILE_PREFIX = 'photo_';

/**
 * Decide whether a Drive filename should restore as a document. Anything
 * unrecognised restores as a damage photo, matching the behaviour before the
 * annexure existed.
 */
export function isDocumentFileName(fileName: string): boolean {
  return fileName.startsWith(DOC_FILE_PREFIX);
}

/** The subset of SurveyorProfile the attestation strip reads. */
export interface StripProfile {
  name: string;
  irdaiLicence: string;
  iiislaNumber: string;
}

export interface StripContent {
  name: string;
  /** null when the line should not be rendered. */
  licence: string | null;
  /** null when the line should not be rendered. */
  placeDate: string | null;
}

/**
 * Compose the text lines of the attestation strip. Pure, so the composition
 * rules are testable without rendering a PDF. The VERIFIED badge, signature and
 * stamp are unconditional when `verified` is on and are handled by the renderer.
 */
export function buildStripContent(
  profile: StripProfile,
  opts: DocumentAnnexureOptions,
): StripContent {
  const licenceParts: string[] = [];
  if (opts.showLicence) {
    if (profile.irdaiLicence) licenceParts.push(`IRDAI: ${profile.irdaiLicence}`);
    if (profile.iiislaNumber) licenceParts.push(`IIISLA: ${profile.iiislaNumber}`);
  }

  const placeDateParts: string[] = [];
  if (opts.showDatePlace) {
    if (opts.place) placeDateParts.push(opts.place);
    if (opts.verifiedDate) placeDateParts.push(opts.verifiedDate);
  }

  return {
    name: profile.name,
    licence: licenceParts.length > 0 ? licenceParts.join(' · ') : null,
    placeDate: placeDateParts.length > 0 ? placeDateParts.join(' · ') : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/photos/__tests__/document-annexure.test.ts
```

Expected: PASS, 27 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/photos/document-annexure.ts src/lib/photos/__tests__/document-annexure.test.ts
git commit -m "feat(annexure): compose attestation strip content and drive prefixes"
```

---

### Task 6: Store actions

**Files:**
- Modify: `src/stores/slices/claimSlice.ts:42-45` (interface), `:233-245` (`addPhoto`), and append two new actions after `updatePhotoLayout`

**Interfaces:**
- Consumes: `PhotoItem['kind']`, `DocumentAnnexureOptions` from Task 1.
- Produces: `addPhoto(dataUrl, name, w?, h?, kind?)`; `replacePhotoImage(index: number, dataUrl: string, w: number, h: number): void`; `updateDocumentAnnexure(updates: Partial<DocumentAnnexureOptions>): void`.

- [ ] **Step 1: Update the interface declarations**

In `src/stores/slices/claimSlice.ts`, replace lines 42-45:

```typescript
  addPhoto: (
    dataUrl: string,
    name: string,
    w?: number,
    h?: number,
    kind?: PhotoItem['kind'],
  ) => void;
  deletePhoto: (index: number) => void;
  updatePhotoName: (index: number, name: string) => void;
  updatePhotoLayout: (layout: ClaimData['photoLayout']) => void;
  /** Swap an image's data and dimensions in place — used by rotation. */
  replacePhotoImage: (index: number, dataUrl: string, w: number, h: number) => void;
  updateDocumentAnnexure: (updates: Partial<DocumentAnnexureOptions>) => void;
```

Add `PhotoItem` and `DocumentAnnexureOptions` to the existing type imports from `@/types/assessment` at the top of the file.

- [ ] **Step 2: Add the kind parameter to addPhoto**

Replace the `addPhoto` implementation at line 233:

```typescript
  addPhoto: (dataUrl, name, w, h, kind = 'damage') => {
    set((state: ClaimSlice) => {
      if (!state.currentClaim) return {};
      return {
        currentClaim: {
          ...state.currentClaim,
          photos: [...state.currentClaim.photos, { dataUrl, name, w, h, kind }],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },
```

Existing two- and four-argument call sites keep working and now record `kind: 'damage'` explicitly.

- [ ] **Step 3: Add the two new actions**

Insert after the `updatePhotoLayout` implementation:

```typescript
  replacePhotoImage: (index, dataUrl, w, h) => {
    set((state: ClaimSlice) => {
      if (!state.currentClaim) return {};
      const photo = state.currentClaim.photos[index];
      if (!photo) return {};
      const newPhotos = [...state.currentClaim.photos];
      newPhotos[index] = { ...photo, dataUrl, w, h };
      return {
        currentClaim: {
          ...state.currentClaim,
          photos: newPhotos,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  updateDocumentAnnexure: (updates) => {
    set((state: ClaimSlice) => {
      if (!state.currentClaim) return {};
      return {
        currentClaim: {
          ...state.currentClaim,
          documentAnnexure: { ...state.currentClaim.documentAnnexure, ...updates },
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },
```

Note the `if (!photo) return {}` guard: an out-of-range index must be a no-op, not an insertion of `{...undefined}`.

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run the full suite for regressions**

```bash
npx vitest run
```

Expected: all existing tests still pass. `src/lib/recovery/__tests__/restoreClaim.test.ts` touches photos; if it constructs a `ClaimData` literal it will need `documentAnnexure` added.

- [ ] **Step 6: Commit**

```bash
git add src/stores/slices/claimSlice.ts
git commit -m "feat(annexure): add kind param, replacePhotoImage and annexure options to store"
```

---

### Task 7: Canvas rotation utility

Browser-only. Not unit tested — the Vitest environment is `node`, with no `document` or `Image`. Verified manually in Task 10.

**Files:**
- Create: `src/lib/photos/rotate-image.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `rotateImage90(dataUrl: string): Promise<{ dataUrl: string; w: number; h: number }>`.

- [ ] **Step 1: Create the utility**

```typescript
/**
 * Rotate an image 90 degrees clockwise, returning a new data URL and the
 * swapped dimensions.
 *
 * Rotation is baked into the pixels rather than stored as metadata, so the
 * result is correct in every consumer at once — the gallery, the PDF, and any
 * future one — with no dependence on @react-pdf/renderer's transform support.
 *
 * Cost: one JPEG re-encode per call, so quality degrades slightly with repeated
 * rotation. Negligible for the two or three presses a correction needs, and the
 * alternative (retaining an untouched original per document) would roughly
 * double the IndexedDB budget.
 */
export function rotateImage90(
  dataUrl: string,
): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      // A 90 degree turn swaps the axes.
      const w = srcH;
      const h = srcW;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get a 2D canvas context'));
        return;
      }

      // Move the origin to the destination centre, turn, then draw the source
      // centred on that origin.
      ctx.translate(w / 2, h / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -srcW / 2, -srcH / 2);

      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.92), w, h });
    };

    img.onerror = () => reject(new Error('Could not decode image for rotation'));
    img.src = dataUrl;
  });
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/photos/rotate-image.ts
git commit -m "feat(annexure): add canvas 90-degree rotation utility"
```

---

### Task 8: The annexure PDF document

**Files:**
- Create: `src/components/pdf/DocumentAnnexureDocument.tsx`

**Interfaces:**
- Consumes: `partitionPhotos`, `buildDocLayout`, `buildStripContent`, `DOC_HEADER_H`, `DOC_FOOTER_H`, `DOC_STRIP_H` from Tasks 2/4/5.
- Produces: `DocumentAnnexureDocument({ claim, profile })` where `profile: StripProfile & { signatureDataUrl: string | null; stampDataUrl: string | null }`.

- [ ] **Step 1: Create the component**

```tsx
'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { ClaimData } from '@/types';
import {
  partitionPhotos,
  buildDocLayout,
  buildStripContent,
  DOC_FOOTER_H,
  DOC_STRIP_H,
  type StripProfile,
} from '@/lib/photos/document-annexure';

const ACCENT = '#2563EB';
const DARK = '#111827';
const GREY = '#6B7280';

const S = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottom: `2px solid ${ACCENT}`,
    paddingBottom: 6,
  },
  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: DARK, letterSpacing: 0.5 },
  subtitle: {
    fontSize: 7.5, color: GREY, marginTop: 2,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // Documents are never stretched: a distorted document under a signed
  // VERIFIED stamp is altered evidence.
  image: { objectFit: 'contain', width: '100%', height: '100%' },
  strip: {
    position: 'absolute',
    height: DOC_STRIP_H,
    borderTop: `1px solid ${GREY}`,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  verified: {
    fontSize: 14, fontFamily: 'Helvetica-Bold', color: ACCENT, letterSpacing: 1.5,
  },
  surveyorName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK, marginTop: 4 },
  stripLine: { fontSize: 7, color: GREY, marginTop: 2 },
  marks: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  markImage: { objectFit: 'contain' },
  blankBox: {
    border: `1px dashed ${GREY}`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blankLabel: { fontSize: 5.5, color: GREY, textTransform: 'uppercase', letterSpacing: 0.3 },
  footer: {
    position: 'absolute', bottom: 12,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 7, color: '#9CA3AF', fontFamily: 'Helvetica-Oblique',
  },
});

/** Signature and stamp render at these sizes, or as a labelled blank box. */
const SIGNATURE_W = 110;
const SIGNATURE_H = 46;
const STAMP_W = 76;
const STAMP_H = 62;

interface AnnexureProfile extends StripProfile {
  signatureDataUrl: string | null;
  stampDataUrl: string | null;
}

interface Props {
  claim: ClaimData;
  profile: AnnexureProfile;
}

/**
 * A missing signature or stamp prints a labelled blank box rather than nothing.
 * A signed page silently missing its signature, with no explanation, is the
 * worst outcome — the surveyor can at least sign a visible box by hand.
 */
function Mark({ src, label, w, h }: { src: string | null; label: string; w: number; h: number }) {
  if (src) {
    return <Image src={src} style={[S.markImage, { width: w, height: h }]} />;
  }
  return (
    <View style={[S.blankBox, { width: w, height: h }]}>
      <Text style={S.blankLabel}>{label}</Text>
    </View>
  );
}

export function DocumentAnnexureDocument({ claim, profile }: Props) {
  const opts = claim.documentAnnexure;
  const documents = partitionPhotos(Array.isArray(claim?.photos) ? claim.photos : [])
    .documents.map(d => d.item);

  const pagePortrait = opts.pageOrientation !== 'landscape';
  const config = buildDocLayout(opts.layout, opts, pagePortrait);
  const pad = opts.pagePadding;
  const strip = buildStripContent(profile, opts);

  const pages: (typeof documents)[] = [];
  for (let i = 0; i < documents.length; i += config.perPage) {
    pages.push(documents.slice(i, i + config.perPage));
  }

  const regNum = claim?.vehicle?.registrationNumber || 'DRAFT';
  const insurer = claim?.policy?.insurerName || '';
  const reportNo = claim?.reportNo || '';
  const pageSize = pagePortrait ? 'A4' : ([842, 595] as [number, number]);
  const cellBorder = opts.showBorder ? `1px solid ${opts.borderColor}` : undefined;

  if (pages.length === 0) {
    return (
      <Document title={`Document Annexure – ${regNum}`}>
        <Page size="A4" style={{ padding: pad, fontFamily: 'Helvetica', fontSize: 10, color: DARK }}>
          <Text style={{ color: GREY, marginTop: 20 }}>
            No documents have been added to this claim.
          </Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document title={`Document Annexure – ${regNum}`}>
      {pages.map((pageDocs, pageIdx) => (
        <Page
          key={pageIdx}
          size={pageSize}
          style={{ padding: pad, fontFamily: 'Helvetica', fontSize: 9, color: DARK, backgroundColor: '#FFFFFF' }}
        >
          <View style={S.header}>
            <View>
              <Text style={S.title}>{profile.name || 'Surveyor'}{'  ·  '}{regNum}</Text>
              <Text style={S.subtitle}>
                {insurer ? `${insurer}  ·  ` : ''}
                {reportNo ? `Report No: ${reportNo}  ·  ` : ''}
                Document Annexure
              </Text>
            </View>
          </View>

          <View style={S.grid}>
            {pageDocs.map((doc, idx) => {
              const isLastInRow = idx % config.cols === config.cols - 1;
              return (
                <View
                  key={idx}
                  style={{
                    width: config.cellW,
                    height: config.cellH,
                    marginRight: isLastInRow ? 0 : config.gap,
                    marginBottom: config.gap,
                    border: cellBorder,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <View style={[S.cell, { width: config.cellW, height: config.cellH }]}>
                    {doc?.dataUrl
                      ? <Image src={doc.dataUrl} style={S.image} />
                      : <Text style={{ color: GREY, fontSize: 7 }}>No image</Text>}
                  </View>
                </View>
              );
            })}
          </View>

          {opts.verified && (
            <View style={[S.strip, { left: pad, right: pad, bottom: pad + DOC_FOOTER_H }]} fixed>
              <View>
                <Text style={S.verified}>VERIFIED</Text>
                <Text style={S.surveyorName}>{strip.name}</Text>
                {strip.licence && <Text style={S.stripLine}>{strip.licence}</Text>}
                {strip.placeDate && <Text style={S.stripLine}>{strip.placeDate}</Text>}
              </View>
              <View style={S.marks}>
                <Mark src={profile.signatureDataUrl} label="Signature" w={SIGNATURE_W} h={SIGNATURE_H} />
                <Mark src={profile.stampDataUrl} label="Stamp" w={STAMP_W} h={STAMP_H} />
              </View>
            </View>
          )}

          <View style={[S.footer, { left: pad, right: pad }]} fixed>
            <Text>Motor SurveyOS</Text>
            <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pdf/DocumentAnnexureDocument.tsx
git commit -m "feat(annexure): render the document annexure pdf"
```

---

### Task 9: Download button and preview wrappers

Both must import `DocumentAnnexureDocument` **statically**. See the comment at the top of `PhotoSheetDownloadButton.tsx`: a `dynamic()`-wrapped Document is a React wrapper, not a real react-pdf Document, and `PDFDownloadLink` silently fails on it. The consumer wraps these whole components in `dynamic()` instead.

**Files:**
- Create: `src/components/pdf/DocumentAnnexureDownloadButton.tsx`
- Create: `src/components/pdf/DocumentAnnexurePreview.tsx`

**Interfaces:**
- Consumes: `DocumentAnnexureDocument` from Task 8.
- Produces: `DocumentAnnexureDownloadButton({ claim })`, `DocumentAnnexurePreview({ claim })`.

- [ ] **Step 1: Create the download button**

`src/components/pdf/DocumentAnnexureDownloadButton.tsx`:

```tsx
'use client';
/**
 * Both imports below must stay STATIC and in this same chunk — see the
 * explanation at the top of PhotoSheetDownloadButton.tsx. The consumer wraps
 * this entire component in dynamic({ ssr: false }).
 */
import { PDFDownloadLink } from '@react-pdf/renderer';
import { DocumentAnnexureDocument } from './DocumentAnnexureDocument';

import type { ClaimData } from '@/types';
import { DownloadCloud, Loader2 } from 'lucide-react';
import { useProfileStore } from '@/stores/profile-store';

interface Props {
  claim: ClaimData;
}

export function DocumentAnnexureDownloadButton({ claim }: Props) {
  const profile = useProfileStore(s => s.profile);
  const fileName = `${claim?.vehicle?.registrationNumber || 'DRAFT'}-Document-Annexure.pdf`;

  const annexureProfile = {
    name: profile.name,
    irdaiLicence: profile.irdaiLicence,
    iiislaNumber: profile.iiislaNumber,
    signatureDataUrl: profile.signatureDataUrl,
    stampDataUrl: profile.stampDataUrl,
  };

  return (
    <PDFDownloadLink
      document={<DocumentAnnexureDocument claim={claim} profile={annexureProfile} />}
      fileName={fileName}
    >
      {({ loading, error }) => {
        if (error) {
          return (
            <button
              disabled
              title={String(error)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold text-sm bg-destructive/20 text-destructive cursor-not-allowed shadow-sm"
            >
              <DownloadCloud size={16} /> PDF Error
            </button>
          );
        }
        return (
          <button
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold text-sm transition-all shadow-sm ${
              loading
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow'
            }`}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
            {loading ? 'Preparing…' : 'Download Annexure'}
          </button>
        );
      }}
    </PDFDownloadLink>
  );
}
```

- [ ] **Step 2: Create the preview**

`src/components/pdf/DocumentAnnexurePreview.tsx`:

```tsx
'use client';
import { PDFViewer } from '@react-pdf/renderer';
import { DocumentAnnexureDocument } from './DocumentAnnexureDocument';

import type { ClaimData } from '@/types';
import { useProfileStore } from '@/stores/profile-store';

interface Props {
  claim: ClaimData;
}

export function DocumentAnnexurePreview({ claim }: Props) {
  const profile = useProfileStore(s => s.profile);

  const annexureProfile = {
    name: profile.name,
    irdaiLicence: profile.irdaiLicence,
    iiislaNumber: profile.iiislaNumber,
    signatureDataUrl: profile.signatureDataUrl,
    stampDataUrl: profile.stampDataUrl,
  };

  return (
    <PDFViewer style={{ width: '100%', height: '72vh', border: 'none' }} showToolbar={false}>
      <DocumentAnnexureDocument claim={claim} profile={annexureProfile} />
    </PDFViewer>
  );
}
```

If `src/components/pdf/PhotoSheetPreview.tsx` uses different `PDFViewer` props, match it rather than the above.

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/pdf/DocumentAnnexureDownloadButton.tsx src/components/pdf/DocumentAnnexurePreview.tsx
git commit -m "feat(annexure): add annexure download and preview wrappers"
```

---

### Task 10: PhotosTab plumbing — compression params, Drive prefix, restore

**Files:**
- Modify: `src/components/tabs/PhotosTab.tsx:51-81` (`compressImage`), `:111-140` (`handleFileUpload`), `:148-181` (`handleRestoreFromDrive`)

**Interfaces:**
- Consumes: `isDocumentFileName`, `DOC_FILE_PREFIX`, `PHOTO_FILE_PREFIX` from Task 5.
- Produces: `compressImage(file, maxWidth, quality, mime?)` — exported for the annexure section in Task 11.

- [ ] **Step 1: Parameterise compressImage**

In `src/components/tabs/PhotosTab.tsx`, replace the `compressImage` function. Note it is now **exported** and honours `quality`, which the current version accepts and then ignores:

```typescript
/**
 * Compress an image to a data URL and return its post-compress dimensions.
 *
 * `mime` defaults to PNG to keep the damage-photo path byte-identical to what
 * it produced before the annexure existed. PNG ignores `quality` in every
 * browser; only the JPEG path uses it.
 */
export function compressImage(
  file: File,
  maxWidth: number,
  quality: number,
  mime: 'image/png' | 'image/jpeg' = 'image/png',
): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let { width, height } = img;
        // Preserve original aspect ratio; cap width
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width  = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No canvas context')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL(mime, quality), w: width, h: height });
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}
```

The existing call `compressImage(file, 600, 1.0)` now resolves `mime` to `'image/png'`, so damage photos are unchanged.

- [ ] **Step 2: Use the explicit photo prefix on Drive upload**

Add the import at the top of the file:

```typescript
import { DOC_FILE_PREFIX, PHOTO_FILE_PREFIX, isDocumentFileName } from '@/lib/photos/document-annexure';
```

In `handleFileUpload`, replace the Drive upload line:

```typescript
            uploadFileToDrive(claimId, `${PHOTO_FILE_PREFIX}${Date.now()}_${name}.jpg`, file, label).catch(() => {});
```

- [ ] **Step 3: Restore documents as documents**

In `handleRestoreFromDrive`, replace the `addPhoto` call inside the loop:

```typescript
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const kind = isDocumentFileName(file.name) ? 'document' : 'damage';
          addPhoto(dataUrl, baseName.substring(0, 30), dims.w, dims.h, kind);
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run the full suite**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/tabs/PhotosTab.tsx
git commit -m "feat(annexure): parameterise compression and route documents through drive restore"
```

---

### Task 11: The Document Annexure section UI

**Files:**
- Create: `src/components/tabs/photos/DocumentAnnexureSection.tsx`
- Modify: `src/components/tabs/PhotosTab.tsx` (render the section at the end of the main panel)

**Interfaces:**
- Consumes: `partitionPhotos` (Task 2), `rotateImage90` (Task 7), `compressImage` (Task 10), store actions (Task 6), the PDF wrappers (Task 9).
- Produces: `DocumentAnnexureSection()` — reads `currentClaim` from the store itself, so it takes no props.

- [ ] **Step 1: Create the section**

```tsx
'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
  FileText, Loader2, RotateCw, Trash2, UploadCloud, Eye, EyeOff, ShieldCheck,
} from 'lucide-react';

import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { uploadFileToDrive } from '@/lib/drive';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { partitionPhotos, DOC_FILE_PREFIX } from '@/lib/photos/document-annexure';
import { rotateImage90 } from '@/lib/photos/rotate-image';
import { compressImage } from '@/components/tabs/PhotosTab';
import type { DocumentLayout } from '@/types/assessment';
import type { PageOrientation } from '@/types/assessment';

/** Documents are text, not scenery: 1600px keeps small print legible in print.
 *  At the 2-up portrait default a document prints 3.8in wide, so 300dpi needs
 *  ~1139px — 1600 leaves headroom without wasting the IndexedDB budget. */
const DOC_MAX_WIDTH = 1600;
const DOC_QUALITY = 0.92;

const DocumentAnnexureDownloadButton = dynamic(
  () => import('@/components/pdf/DocumentAnnexureDownloadButton').then(m => m.DocumentAnnexureDownloadButton),
  {
    ssr: false,
    loading: () => (
      <button disabled className="flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold bg-muted text-muted-foreground cursor-not-allowed shadow-sm">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </button>
    ),
  },
);

const DocumentAnnexurePreview = dynamic(
  () => import('@/components/pdf/DocumentAnnexurePreview').then(m => m.DocumentAnnexurePreview),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[72vh] rounded-lg bg-muted/40 flex items-center justify-center gap-3 text-muted-foreground text-sm">
        <Loader2 size={20} className="animate-spin" /> Loading PDF viewer…
      </div>
    ),
  },
);

const LAYOUT_OPTIONS: { value: DocumentLayout; label: string }[] = [
  { value: 1, label: '1 per page — densest documents' },
  { value: 2, label: '2 per page — best for screenshots' },
  { value: 4, label: '4 per page — scanned A4 pages' },
];

export function DocumentAnnexureSection() {
  const { currentClaim, addPhoto, deletePhoto, updatePhotoName, replacePhotoImage, updateDocumentAnnexure } =
    useClaimStore();
  const profile = useProfileStore(s => s.profile);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [rotatingIndex, setRotatingIndex] = useState<number | null>(null);

  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0 || !currentClaim) return;
      setIsProcessing(true);

      const claimId = currentClaim.id;
      const label = currentClaim.vehicle?.registrationNumber || claimId;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image. PDFs must be screenshotted first.`);
          continue;
        }
        try {
          const { dataUrl, w, h } = await compressImage(file, DOC_MAX_WIDTH, DOC_QUALITY, 'image/jpeg');
          const name = file.name.split('.')[0].substring(0, 30);
          addPhoto(dataUrl, name, w, h, 'document');
          if (profile.autoUploadDrive !== false) {
            uploadFileToDrive(claimId, `${DOC_FILE_PREFIX}${Date.now()}_${name}.jpg`, file, label).catch(() => {});
          }
        } catch {
          // A document is attested evidence — unlike a damage photo, a silent
          // drop here would leave the surveyor signing an incomplete annexure.
          toast.error(`Could not read ${file.name}. Try re-taking the screenshot.`);
        }
      }
      setIsProcessing(false);
      event.target.value = '';
    },
    [addPhoto, currentClaim, profile.autoUploadDrive],
  );

  const handleRotate = useCallback(
    async (index: number, dataUrl: string) => {
      setRotatingIndex(index);
      try {
        const rotated = await rotateImage90(dataUrl);
        replacePhotoImage(index, rotated.dataUrl, rotated.w, rotated.h);
      } catch {
        toast.error('Could not rotate this document.');
      } finally {
        setRotatingIndex(null);
      }
    },
    [replacePhotoImage],
  );

  if (!currentClaim) return null;

  const opts = currentClaim.documentAnnexure;
  const documents = partitionPhotos(currentClaim.photos).documents;
  const hasDocuments = documents.length > 0;
  const missingMarks = opts.verified && (!profile.signatureDataUrl || !profile.stampDataUrl);

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">Document Annexure</h2>
          <p className="text-muted-foreground text-sm mt-1">
            RC, DL, policy schedules — any supporting document. Prints as its own PDF,
            separate from the photo sheet.
          </p>
        </div>
        {hasDocuments && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowPreview(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold text-sm transition-all shadow-sm border ${
                showPreview
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:border-primary hover:text-primary'
              }`}
            >
              {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
              {showPreview ? 'Hide Preview' : 'Preview PDF'}
            </button>
            <DocumentAnnexureDownloadButton claim={currentClaim} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-card/50 pb-3 border-b border-border">
              <CardTitle className="text-sm font-medium">Layout</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Documents per page</Label>
                <select
                  value={opts.layout}
                  onChange={e => updateDocumentAnnexure({ layout: Number(e.target.value) as DocumentLayout })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                >
                  {LAYOUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Page orientation</Label>
                <select
                  value={opts.pageOrientation}
                  onChange={e => updateDocumentAnnexure({ pageOrientation: e.target.value as PageOrientation })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                >
                  <option value="portrait">Portrait A4</option>
                  <option value="landscape">Landscape A4</option>
                </select>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Portrait suits phone screenshots. Landscape suits wide cards and scanned
                  pages — and a rotated screenshot, but only at 1 per page.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="bg-card/50 pb-3 border-b border-border">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck size={15} className="text-primary" /> Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Add verified strip</Label>
                <button
                  onClick={() => updateDocumentAnnexure({
                    verified: !opts.verified,
                    ...(!opts.verified && !opts.verifiedDate
                      ? { verifiedDate: new Date().toISOString().split('T')[0] }
                      : {}),
                  })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    opts.verified ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    opts.verified ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {opts.verified && (
                <>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    VERIFIED, your name, signature and stamp print on every page.
                  </p>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={opts.showLicence}
                      onChange={e => updateDocumentAnnexure({ showLicence: e.target.checked })}
                      className="accent-primary"
                    />
                    IRDAI / IIISLA numbers
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={opts.showDatePlace}
                      onChange={e => updateDocumentAnnexure({ showDatePlace: e.target.checked })}
                      className="accent-primary"
                    />
                    Place and date
                  </label>
                  {opts.showDatePlace && (
                    <div className="space-y-2">
                      <Input
                        value={opts.place}
                        onChange={e => updateDocumentAnnexure({ place: e.target.value })}
                        placeholder="Place"
                        className="h-8 text-xs"
                      />
                      <Input
                        type="date"
                        value={opts.verifiedDate}
                        onChange={e => updateDocumentAnnexure({ verifiedDate: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  )}
                  {missingMarks && (
                    <div className="text-[11px] rounded-md bg-status-warning-tint text-status-warning p-2.5 leading-snug">
                      No {!profile.signatureDataUrl ? 'signature' : ''}
                      {!profile.signatureDataUrl && !profile.stampDataUrl ? ' or ' : ''}
                      {!profile.stampDataUrl ? 'stamp' : ''} saved in your Profile. The
                      annexure will print a blank box to sign by hand.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
            <p><strong>{documents.length}</strong> document(s) added</p>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {showPreview && hasDocuments && (
            <Card className="border-border shadow-sm overflow-hidden">
              <CardHeader className="bg-card/50 pb-3 border-b border-border">
                <CardTitle className="text-sm font-medium">Live PDF Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <DocumentAnnexurePreview claim={currentClaim} />
              </CardContent>
            </Card>
          )}

          <Card className="border-border shadow-sm border-dashed bg-muted/10">
            <CardContent className="p-8 flex flex-col items-center justify-center min-h-[180px]">
              <UploadCloud size={44} className="text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-base font-medium mb-1">Add Documents</h3>
              <p className="text-sm text-muted-foreground mb-5 text-center max-w-sm">
                Screenshots of RC, DL, policy schedules and the like. Images only — a PDF
                has to be screenshotted first.
              </p>
              <Label
                htmlFor="document-upload"
                className={`cursor-pointer inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {isProcessing ? 'Processing…' : 'Browse Files'}
              </Label>
              <input
                id="document-upload"
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
                disabled={isProcessing}
              />
            </CardContent>
          </Card>

          {hasDocuments && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {documents.map(({ item, index }) => (
                <div key={index} className="group relative rounded-lg border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all">
                  <div className="aspect-[3/4] bg-muted relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.dataUrl}
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-contain bg-muted"
                    />
                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => handleRotate(index, item.dataUrl)}
                        disabled={rotatingIndex === index}
                        title="Rotate 90°"
                        className="bg-background/80 backdrop-blur-sm text-foreground hover:bg-primary hover:text-primary-foreground p-1.5 rounded-md"
                      >
                        {rotatingIndex === index
                          ? <Loader2 size={13} className="animate-spin" />
                          : <RotateCw size={13} />}
                      </button>
                      <button
                        onClick={() => deletePhoto(index)}
                        title="Remove"
                        className="bg-background/80 backdrop-blur-sm text-destructive hover:bg-destructive hover:text-white p-1.5 rounded-md"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground shadow-sm flex items-center gap-1">
                      <FileText size={9} /> {item.w} × {item.h}
                    </div>
                  </div>
                  <div className="p-2 border-t border-border">
                    <Input
                      value={item.name}
                      onChange={e => updatePhotoName(index, e.target.value)}
                      placeholder="Caption…"
                      className="h-7 text-xs border-transparent hover:border-input focus:bg-background px-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

Every call to `deletePhoto`, `updatePhotoName` and `handleRotate` passes `index` from `partitionPhotos` — the real index into `claim.photos`, never the position in the filtered list.

- [ ] **Step 2: Render the section in PhotosTab**

In `src/components/tabs/PhotosTab.tsx`, add the import:

```typescript
import { DocumentAnnexureSection } from '@/components/tabs/photos/DocumentAnnexureSection';
```

Then, immediately before the final closing `</div>` of the component's returned tree (after the closing `</div>` of the `grid grid-cols-1 lg:grid-cols-4 gap-8` block), add:

```tsx
      <DocumentAnnexureSection />
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors. If a circular-import warning appears from `DocumentAnnexureSection` importing `compressImage` out of `PhotosTab`, move `compressImage` into `src/lib/photos/compress-image.ts` and import it from there in both files.

- [ ] **Step 4: Run the full suite**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Lint**

```bash
npx eslint src/components/tabs/photos/DocumentAnnexureSection.tsx src/components/pdf/DocumentAnnexureDocument.tsx src/lib/photos
```

Expected: no errors.

- [ ] **Step 6: Manual verification in the browser**

Start the dev server via the preview tooling (not `npm run dev` in a shell), open a claim, go to the Photo Engine, and confirm:

1. The Document Annexure section appears below the photo engine.
2. Uploading a tall phone screenshot adds it to the document gallery only — it does **not** appear in the damage photo gallery above.
3. The photo sheet PDF contains no documents; the annexure PDF contains only documents.
4. Rotate turns the image 90° clockwise and the `w × h` badge swaps its numbers.
5. Deleting the second document with damage photos interleaved removes the right image.
6. Toggling Verified adds the strip; VERIFIED, name, signature and stamp appear on **every** page.
7. With no signature saved in Profile, a labelled dashed box prints in its place and the warning shows in the section.
8. Switching to landscape re-flows the annexure and the damage photo sheet is unaffected.

- [ ] **Step 7: Commit**

```bash
git add src/components/tabs/photos/DocumentAnnexureSection.tsx src/components/tabs/PhotosTab.tsx
git commit -m "feat(annexure): add document annexure section to the photo engine"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| `PhotoItem.kind` marker, undefined = damage | 1 |
| `DocumentAnnexureOptions` persisted on the claim | 1 |
| Reuse `claim.photos`, inherit persistence | 1, 2 |
| Partition + index-mapping hazard | 2 |
| Documents excluded from the damage sheet | 3 |
| 1/2/4-up × portrait/landscape geometry | 4 |
| Fixed 95pt strip reserve, 0 when unverified | 4 |
| Strip content: VERIFIED, name, signature, stamp always; licence and place/date optional | 5, 8 |
| Drive `doc_` prefix and restore | 5, 10 |
| Store: kind param, rotation setter, options setter | 6 |
| Rotation via canvas re-encode, swaps w/h | 7 |
| `objectFit: contain`, never stretched | 8 |
| Blank labelled boxes for missing signature/stamp | 8 |
| Empty-state page when no documents | 8 |
| 1600px / q0.92 document compression | 10, 11 |
| Damage photos unchanged at 600px PNG | 10 |
| Toast on document upload failure | 11 |
| Images only, PDFs rejected with an explanation | 11 |
| Warning when verified is on but profile assets are missing | 11 |
| Section below the photo engine, mirroring its UX | 11 |
| Portrait-for-screenshots guidance in the UI | 11 |

No gaps.

**Placeholder scan:** no TBD/TODO; every code step carries complete code; every test step carries real assertions.

**Type consistency:** `IndexedPhoto { item, index }` is produced in Task 2 and consumed with those exact names in Tasks 3, 8 and 11. `buildDocLayout` returns `cellW`/`cellH` (not `imageH`, which is `PhotoSheetDocument`'s own name) and is consumed as such in Task 8. `StripContent { name, licence, placeDate }` is produced in Task 5 and consumed in Task 8. `replacePhotoImage(index, dataUrl, w, h)` is declared in Task 6 and called with that arity in Task 11. `compressImage(file, maxWidth, quality, mime?)` is exported in Task 10 and called with four arguments in Task 11.
