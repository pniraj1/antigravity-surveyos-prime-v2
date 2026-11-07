# Photo Sheet Splitting (<2MB) & Photo Orientation Toggle Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use subagents to implement this plan task-by-task.

**Goal:** Constrain generated photo sheet PDFs to under 2 MB each by automatically splitting multi-page photo sheets into parts when >1.95 MB, and allow 1-click toggling between portrait and landscape orientation for photos in the Photo Engine.

**Architecture:**
1. A client-side PDF utility `src/lib/pdf/split-pdf.ts` uses `pdf-lib` to inspect the generated PDF blob and split pages into $<1.95\text{ MB}$ chunks with exact page ranges (e.g. Part 1: Pages 1–4, Part 2: Pages 5–8).
2. `PhotoSheetDownloadButton.tsx` automatically detects when the generated PDF blob exceeds 1.95 MB and renders distinct download buttons for each part (`Download Part 1`, `Download Part 2`).
3. `PhotosTab.tsx` transforms the gallery orientation badge (`▯` / `▭`) into an interactive button that runs `rotateImage90` and calls `replacePhotoImage`, seamlessly flipping portrait $\leftrightarrow$ landscape and updating both gallery and PDF.

**Tech Stack:** React 19, TypeScript 5, `@react-pdf/renderer`, `pdf-lib`, Zustand (`claimSlice`), Sonner, Lucide React, Vitest.

---

### Task 1: PDF Splitting Utility (`src/lib/pdf/split-pdf.ts`)

**Files:**
- Create: `src/lib/pdf/split-pdf.ts`
- Test: `src/lib/pdf/__tests__/split-pdf.test.ts`

**Step 1: Write the failing test**
Create `src/lib/pdf/__tests__/split-pdf.test.ts` verifying:
1. When input PDF is $\le 1.95\text{ MB}$, returns `isSplit: false` with 1 part.
2. When input PDF is $> 1.95\text{ MB}$ (or when simulated threshold is smaller), splits pages into multiple parts, each within the size limit, preserving all pages.
3. Edge case: 1-page PDF returns 1 part even if over threshold.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/pdf/__tests__/split-pdf.test.ts`
Expected: FAIL (module not found).

**Step 3: Implement `src/lib/pdf/split-pdf.ts`**
Implement `splitPdfBySize(pdfBlob: Blob, maxSizeBytes?: number): Promise<SplitPdfResult>` using `pdf-lib`:
- Default threshold: `1.95 * 1024 * 1024` bytes.
- Load with `PDFDocument.load(await pdfBlob.arrayBuffer())`.
- Group pages into sub-documents and return array of `{ partNumber, totalParts, blob, pageStart, pageEnd, sizeBytes }`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/pdf/__tests__/split-pdf.test.ts`
Expected: PASS.

**Step 5: Commit**
`git add src/lib/pdf/`
`git commit -m "feat(pdf): add splitPdfBySize utility using pdf-lib"`

---

### Task 2: Multi-Part Download Buttons in `PhotoSheetDownloadButton.tsx`

**Files:**
- Modify: `src/components/pdf/PhotoSheetDownloadButton.tsx`
- Test: `src/components/pdf/__tests__/PhotoSheetDownloadButton.test.tsx`

**Step 1: Write the failing test**
Create/update test in `src/components/pdf/__tests__/PhotoSheetDownloadButton.test.tsx` verifying:
1. Renders single download button when PDF $\le 1.95\text{ MB}$.
2. Renders multiple part buttons (`Download Part 1 (Pages 1–4)`, `Download Part 2 (Pages 5–8)`) when split is triggered.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/pdf/__tests__/PhotoSheetDownloadButton.test.tsx`
Expected: FAIL.

**Step 3: Update `PhotoSheetDownloadButton.tsx`**
- When react-pdf generates `blob`:
  - Run `splitPdfBySize(blob)` asynchronously.
  - If `isSplit === false`, render the default `[Download PDF]` and `SharePdfButton`.
  - If `isSplit === true`, render a badge "Split into N parts (<2MB each)" and individual buttons:
    `[Download Part 1 (Pages 1–4 · X.X MB)]`, `[Download Part 2 (Pages 5–8 · Y.Y MB)]`.
  - Saving each part calls `saveReportToClaimFolder(claim, fileNameWithPart, partBlob, 'damagePhotos')`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/pdf/__tests__/PhotoSheetDownloadButton.test.tsx`
Expected: PASS.

**Step 5: Commit**
`git add src/components/pdf/PhotoSheetDownloadButton.tsx src/components/pdf/__tests__/`
`git commit -m "feat(photosheet): add multi-part download buttons for pdfs exceeding 2MB"`

---

### Task 3: Interactive Photo Orientation Toggle in `PhotosTab.tsx`

**Files:**
- Modify: `src/components/tabs/PhotosTab.tsx`
- Test: `src/components/tabs/__tests__/PhotosTab-rotate.test.tsx`

**Step 1: Write the failing test**
Create `src/components/tabs/__tests__/PhotosTab-rotate.test.tsx` verifying:
1. Orientation badge has `title` indicating orientation and rotation capability.
2. Clicking the orientation button invokes `rotateImage90` and dispatches `replacePhotoImage` with swapped dimensions.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/tabs/__tests__/PhotosTab-rotate.test.tsx`
Expected: FAIL.

**Step 3: Implement rotation button in `PhotosTab.tsx`**
- Import `RotateCw` from `lucide-react`.
- Import `rotateImage90` from `@/lib/photos/rotate-image`.
- Add `rotatingIndex` state.
- Add `handleRotate(index, dataUrl)`.
- Replace the static orientation pill with an interactive button with `RotateCw` icon.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/tabs/__tests__/PhotosTab-rotate.test.tsx`
Expected: PASS.

**Step 5: Commit**
`git add src/components/tabs/PhotosTab.tsx src/components/tabs/__tests__/`
`git commit -m "feat(photos): add 1-click portrait-landscape orientation toggle in photo engine"`

---

### Task 4: Full Suite & Scan Drift Verification

**Files:**
- Verification: Full Vitest suite (`npx vitest run`)
- TypeScript: Type check (`npx tsc --noEmit`)
- Next.js build: Build check (`npm run build`)
- Scan Drift tests: Verify coupling (`cd "../SurveyOS Scan" && ./gradlew :app:testDebugUnitTest`)
- Update: `Tasks.md`, `Changelog.md`, and new session log.
