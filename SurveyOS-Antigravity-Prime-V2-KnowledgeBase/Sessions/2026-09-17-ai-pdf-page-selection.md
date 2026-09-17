# Session: 2026-09-17 (Claude) — AI upload PDF page selection

## What changed

Multi-page PDFs going into an AI upload now get a page picker instead of
being rasterized whole. The surveyor unticks the pages that are covers,
blanks or irrelevant scans before the document is sent — the AI never sees
those pages, and they cost zero tokens.

Spec: `docs/superpowers/specs/2026-09-17-ai-pdf-page-selection-design.md`
Commits: 62234062..3855b55c (7) on `main`. Not deployed.

### Modules
- `src/lib/ai/ai-pages.ts` — `setAIPages`/`getAIPages`: a `WeakMap<File,
  number[]>` carrier so the surveyor's page choice rides on the `File`
  object itself, four calls deep into the rasterize chain, with no
  signature change to `extractDocument`/`filesToImages`. Re-scan, Smart
  Fix and the bank-statement extractor inherit the tagging for free since
  they hold the same `File`. Pure `resolveAIPages(totalPages, tagged?)`
  clamps out-of-range indices and returns all pages when untagged.
- `src/lib/ai/processor.ts` — `fileToImages` calls `resolveAIPages` and
  rasterizes only the resolved set; progress counts renumber against the
  filtered total, not the PDF's real page count.
- `src/lib/ai/needs-review.ts` — `needsReview(files, countPdfPages?)`: the
  review sheet now opens for more than one file OR a single multi-page
  PDF (previously: more than one file only). A 1-page PDF or an unreadable
  PDF returns `false` — no grid to show.
- `src/components/documents/PdfPageGrid.tsx` — thumbnail grid lifted out
  of `PdfPageSelectorDialog.tsx` (the photos-tab annexure picker) into a
  shared component: `{ pages, checked, onToggle, className? }`.
- `src/components/documents/DocumentReviewSheet.tsx` — when a file is a
  PDF with >1 page, renders `PdfPageGrid` under it, all pages ticked by
  default; per-PDF tick state; page-aware file counts and the
  `AI_IMAGE_WARN` threshold count ticked pages, not raw file count;
  zero-ticked PDF is excluded from Send entirely; ticks survive a crop
  edit; a password-protected or corrupt PDF falls back to "Can't preview
  pages — will be sent whole" and still sends the full document; Send is
  disabled while a PDF is still being probed for page count.
- `AssessmentTab.tsx` (estimate upload), `BillCheckTab.tsx` (final bill),
  `DetailsTab.tsx` (RC/DL/policy uploads) — all three now call
  `needsReview([file])` and route through `DocumentReviewSheet` when it
  says yes. `DocumentsTab.tsx` and the Sync picker already used the sheet
  for multi-file review and pick up the page grid with no changes of
  their own.

### Quota rationale
Unticked pages are filtered out before `fileToImages` ever rasterizes
them, so they're never turned into an image and never sent to the model —
zero tokens for pages the surveyor rejects. This is the entire mechanism;
there's no separate cost-accounting step.

## Manual E2E (spec §5) — NOT RUN

No credentials in this session; the app is auth-gated and these checks
need a real sign-in plus live AI calls. Checklist for whoever runs it
next:

- [ ] Estimate tab: drop a 5-page PDF, sheet opens, untick 2, Send →
      progress reads "page 1 of 3"; Re-scan with feedback and Smart Fix
      both process the same 3 pages.
- [ ] Estimate tab: drop a JPEG → no sheet, extraction starts immediately.
- [ ] Documents tab: RC front + back JPEGs → sheet as today, no page grid.
- [ ] Password-protected PDF → "Can't preview" card, still sends whole.

## Deferred follow-ups (spec Non-Goals)

- Auto-suggest junk pages from the local text layer (heuristic
  pre-ticking based on page text) — candidate follow-up, not started.
- Text-instead-of-image optimisation for digital PDFs (skip rasterizing
  pages that have a clean text layer) — separate investigation, not
  started.

## Carried minors

- `setAIPages` stores the page array by reference into the WeakMap; a
  caller that mutates the array after tagging would corrupt the stored
  selection. No current caller does this.
- Seeded ticks are not re-clamped if a PDF at the same array index were
  ever replaced by one with a different page count — unreachable today
  since each upload creates a fresh `File`.
- A zero-ticked PDF still shows its selected border in the grid even
  though it will not be sent; cosmetic only, Send is correctly disabled
  for it.

## Tests

`npx tsc --noEmit` clean. `npx vitest run` 1239 passing (152 files).
`npm run build` OK (static export compiles, 24 pages).
