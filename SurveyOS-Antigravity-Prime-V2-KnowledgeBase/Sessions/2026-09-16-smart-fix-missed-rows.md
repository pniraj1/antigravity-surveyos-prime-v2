# Session: 2026-09-16 (Claude) — Smart Fix: missed-row detection

## What Changed

The subtotal-based math check (`validateMath`) is gone. It compared
model-reported section subtotals to row sums; on a 5-page DTC invoice read
one page per call the subtotals were page-level and `Math.max`-merged, so a
perfect 80-row read was flagged, a full second read ran, and the surveyor
saw a ₹53,049 "mismatch" printed nowhere. Missed rows — the thing that
matters — were never detected.

Spec: `docs/superpowers/specs/2026-09-16-smart-fix-missed-rows-design.md`
Plan: `docs/superpowers/plans/2026-09-16-smart-fix-missed-rows.md`
Ledger: `.superpowers/sdd/progress.md` § Smart Fix missed rows
Commits: 405b967b..71e942e8 (10) on `main`. **Not deployed.** Also not yet
deployed: 50c2e994, fd732a06, 2b20fde9 (post-L1 fixes).

### New modules
- `src/lib/ai/row-check.ts` — pure. `rowCheck(data, pageTexts?)` → gaps
  (with 0-based page candidates), duplicates, `duplicatesDroppable`,
  `grossMismatch`, `serialsUsable`. `tagRows`, `dropDuplicates`,
  `mergeBySerial`, `stripPageTags`, `toFindings`, `describeFinding`, `countRows`.
- `src/lib/ai/gap-fill.ts` — `fillGaps(...)`: one vision call per gap page
  (≤ `MAX_GAP_PAGES` = 6), prompt names the missed serials, merge by serial.
- `src/lib/ai/__tests__/processor-flow.test.ts` — drives the REAL
  `extractDocument` in node via the image branch + a 6-line `FileReader`
  stub (the Phase-1 "not unit-drivable" belief was wrong).

### Rules
- Serial modes detected, not configured: one run (≤ 10 % duplicates) or
  per-section (≥ 2 sections start at 1). < 80 % numeric `sr_no` → gap check off.
- Gross only, against `total_amount` row sums; in text mode only when its
  integer digits appear in a page text. Section subtotals never checked.
- Duplicates dropped only when ≤ 10 % of serials — the model numbers
  unnumbered bills 1..n per page, and dropping those deleted real rows
  (caught in final review).
- Second opinion (whole re-read, next model) only when the gross is off AND
  no gap explains it; accepted only when the second read has neither a gross
  mismatch nor gaps. First-pass model pinned before the gap fill so
  `session.avoid` targets the right one.
- `_page`/`_pageEnd` live on the review result; stripped at
  `setExtractedData`, `confirmApply`, and feedback re-scan `previousData`.
- Smart Fix (`smartFixRescan`) runs on the pending review result; result is
  discarded if the job was replaced meanwhile; closing the dialog or a
  feedback re-scan calls `cancelJob` (aborts the fix). Honours the profile's
  forced doc mode.
- UI: toast has no action; one amber "Check before applying" card above the
  field list in `AIReviewDialog`, button inside, inline progress, green "No
  remaining findings — N rows"; Apply + free-text rescan locked while running.
  Wired in `AssessmentTab` and `BillCheckTab` (the only money tabs).
- `?ai-drop=<sr_no>` (dev only) removes a serial from the first pass.

### Removed
`validateMath`, `rescanTargetPages`, `applyTargetedUpdate`, the "last 1–2
pages" heuristic, `buildFocusHint`, `targetPageIndices`,
`triggerTargetedRescan`, `DiscrepancyContext` / `setDiscrepancyContext`, the
red "Math Validation Warnings" box (no tab ever passed it).

## Live check L9 (pending, owner)
`npm run dev` → open with `?ai-drop=38` → upload DTC Proforma Invoice-1.PDF
as estimate. Expect console `[ai-fault] dropped serial 38`, `[Smart Fix]
serial gaps after first pass: [{srNo:38, pages:[…]}]`, one extra
single-page gateway call, toast "Estimate read — 80 rows", no card. Then
without the param: 5 calls, no second opinion. L2–L8 from Phase 1 still open.

## Carried minors (from reviews)
- Missed LAST row (max serial) is undetectable by serial → falls to a full
  second opinion; cheaper first move would be one last-page gap-fill call
  (what the Smart Fix button does). Upgrade path noted.
- `grossPrinted` matches integer digits anywhere in the page text (a part
  number could match); wrong direction is an extra amber line, not data loss.
- Ratio heuristic edge: 1..40 + 1..4 unnumbered = 4/44 ≤ 0.1 → 4 rows
  dropped, gross check then flags it (ponytail comment in row-check.ts).
- Toast counts a gross finding as "1 need a look".
- gap-fill: `import type` for `newSession`; `MAX_GAP_PAGES` boundary and
  `OfflineError` propagation untested. Lost indent in
  `extraction-store.test.ts`. Per-render `onSmartFix` closure; `'>Smart Fix<'`
  test assertion brittle (use a data-testid next time the card is touched).

## Tests
`npx vitest run` 1150 passing (145 files); `npx tsc --noEmit` clean.
