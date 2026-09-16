# Smart Fix: missed-row detection and surgical re-read

Date: 2026-09-16 · Status: approved in brainstorm, awaiting spec review
Follows: `2026-09-15-ai-fallback-and-job-routing-design.md` (rev 3)

## Problem

Estimates arrive in many dealer formats (DTC, MGA, Hyundai, …). Today's
check (`validateMath` in `src/lib/ai/processor.ts`) compares
model-reported *section subtotals* to the row sums. Those subtotals are
often not printed at all, or are printed per page and merged by
`Math.max`, so the check cries wolf (live 2026-09-16: a perfect 80-row read
was flagged, a full second read ran, the surveyor saw a ₹53,049 "mismatch"
that appears nowhere on the paper). Meanwhile the thing that actually
matters — a **missed row** — is not detected at all, and the "Smart Fix"
button guesses that the fault is on the last two pages.

Decisions from the brainstorm: missed rows matter most; dealer software
prints serial numbers and a gross almost always; subtotal formats vary;
handwritten bills are out of scope.

## Goals

1. Detect a missed or duplicated row precisely, and know which page it is on.
2. Never alarm on a figure nobody printed.
3. Zero extra AI calls on a clean read. A gap costs one single-page call.
   A full second read only when nothing cheaper can help.
4. Smart Fix is a first-class step in the review dialog, not a toast.

Non-goals: handwritten bills; documents without serial numbers get the
gross check only; no change to the fallback loop in `service.ts`.

## Design

### 1. `row-check.ts` — pure checks (new module, `src/lib/ai/row-check.ts`)

Input: the merged extraction (`spare_parts`, `labour_items`,
`painting_items`, `gross_amount`/`total_amount`) plus, for text-native
pages, the page texts.

```ts
interface RowCheck {
  gaps: { srNo: number; pages: number[] }[];   // missing serials, 0-based page candidates
  duplicates: number[];                         // serials seen twice (first kept)
  grossMismatch?: { rows: number; printed: number };
  serialsUsable: boolean;                       // ≥ 80 % of rows have a numeric sr_no
}
```

Serial mode is detected, not configured:
- **one run** (DTC style, 1…80 across all three sections) when the union of
  serials has at most 10 % duplicates; gaps are missing numbers between min and max.
- **per section** when two or more sections each start at 1; gaps are found
  inside each section.
- fewer than 80 % numeric `sr_no` → `serialsUsable = false`, gap check skipped.

Gross: rows' `total_amount` must sum to the printed gross within the
existing `tolerance()`. Section subtotals are **not** checked any more.
For text-native pages the gross is trusted only if its digits (with or
without commas/decimals) appear in some page's text; otherwise the model
computed it and `grossMismatch` is never raised. Vision pages trust the
model's figure.

### 2. Rows remember their page (`processor.ts`)

`mergeResponse(raw, first, last)` already knows the chunk's page range.
Every array item merged from that chunk gets `_page: first` and, for a
vision chunk spanning more than one page, `_pageEnd: last`; the check
treats `first…last` as candidates. `_page` is stripped before the data is
applied to the claim (`applyExtractedData`) so nothing downstream changes.

Gap page attribution: the pages of the nearest present serials on either
side; if they agree, one page; otherwise both.

### 3. Automatic surgical fix (`processor.ts`, inside `extractDocument`)

After `runAllChunks`:

1. `rowCheck(result)`.
2. Duplicates: drop the later copy.
3. Gaps: for each candidate page (deduplicated), one `callAIGateway` on
   that page only with the estimate prompt plus
   `Return ONLY the rows with serial numbers 38, 52 (they were missed).`
   Merge **by `sr_no`**: insert a row only if its serial is still missing;
   never replace or append anything else. Progress text:
   "Rows 38, 52 missing — re-reading page 3…". Runs through the same
   session (fallback loop applies). Then re-check.
4. Second opinion (existing whole-document re-run on the next model) is
   triggered **only** when `grossMismatch` remains **and** `gaps` is empty
   — a row without a serial is missing and no page can be pinned. Every
   other case: no second pass. `needsSecondOpinion` becomes this rule.
5. Whatever is still unresolved is returned as structured `discrepancies`
   (not prose) for the dialog:
   `{ kind: 'gap', srNos, pages } | { kind: 'gross', rows, printed }`.

Cost: clean read = 0 extra calls; each gap page = 1 single-page call;
full re-read only in the no-serial case.

### 4. Smart Fix button = the same engine (`useAIExtraction.ts`, `rescanTargetPages`)

`rescanTargetPages(key, file, pages, focusHint)` is replaced by
`fillGaps(key, file, check, existing, onProgress, session?)`, the function
step 3 uses. The button calls it with the *remaining* discrepancies:
gap → its pages and serials; gross-only → the last page (where the gross
lives) asking for rows not yet listed, merged by serial. The "last 1–2
pages" heuristic, `targetPageIndices` and the array-stripping merge in the
hook are deleted.

Smart Fix operates on the **pending review result** (store `jobs[key].result`),
not on already-applied claim data, so the dialog updates in place.

### 5. UI / UX (`AIReviewDialog.tsx`, `useAIExtraction.ts`)

- Toast on completion: one line, no action —
  "Estimate read — 80 rows" or "Estimate read — 78 rows, 2 need a look".
- Review dialog: the red "Math Validation Warnings" box is replaced by one
  amber **"Check before applying"** card placed **above the field list**.
  Plain-language lines: "Rows 38 and 52 look missing (page 3)";
  "Rows add up to ₹2,25,100 but the bill says ₹2,26,860".
  The **Smart Fix** button sits inside the card; while running the card shows
  the inline progress ("Re-reading page 3…", cancel available via the
  existing job cancel); on success the card turns green ("All 80 rows
  found, totals match") and fades after the surveyor applies. If something
  remains, the card stays amber with the remaining lines and the hint
  "Check page 3 in the Evidence Viewer or describe the fix below".
- The card does not render on a clean read.
- The free-text "tell AI to fix it" box stays below as the manual fallback.
- No new store fields beyond typing `discrepancies` structurally; the
  `DiscrepancyContext` type carries the `RowCheck` instead of strings.

### 6. Errors

- Gap-fill call fails (busy/offline/parse): keep the first result, leave
  the gap in `discrepancies`, no retry loop. `AllProvidersBusyError` /
  `OfflineError` / abort propagate as today.
- Gap page returns rows with wrong serials: ignored (merge is by serial).
- More than 6 gap pages: skip auto-fill (likely a systematic mis-read),
  fall through to the second-opinion rule.

### 7. Testing

Unit (`src/lib/ai/__tests__/row-check.test.ts`): one-run and per-section
serial modes; duplicates; gap page attribution (same page / straddling
pages); `serialsUsable` threshold; gross trusted only when printed (text
mode) and always in vision mode; DTC shape fixture (80 rows, 5 pages,
gross reconciles → no findings).
Unit (`processor` tests): `_page` tagging per chunk; merge-by-serial
inserts only missing rows; second opinion fires only for gross-without-gaps;
no extra calls on a clean read (spy on `callAIGateway`).
Existing `second-opinion.test.ts` updated to the new trigger.
Component: `AIReviewDialog` renders the amber card only when findings
exist and calls Smart Fix with the pending result.
Live: L9 — DTC invoice with `?ai-fault=` unchanged; plus a dev-only
`?ai-drop=38` that removes serial 38 from the first-pass result to watch
the gap fill on a real document.

### 8. Out of scope / later

Per-page "rows printed on this page" count as a fallback for unserialled
documents (Approach 2 from the brainstorm); diffing two full reads per
section.
