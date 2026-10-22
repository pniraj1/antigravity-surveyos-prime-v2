# Session: 2026-10-22 (Claude): Surveyor feedback batch

Five items surveyors reported, brainstormed with the owner, then built, committed on `main` and deployed.

## What I Did
- **Accident date/time not pulled from the claim form** (commit 7bc9132e). Root cause: the time was cut to 5 characters as written, so "4.30 pm" / "16.30 hrs" / "2:30 PM" made an invalid datetime-local and the input rendered the whole value blank, date included; an unreadable date wrote "T00:00" over a good value. New `parseTime` (24 h, dotted, `1630 hrs`, am/pm, refuses dotted dates); `applyClaim` keeps the existing value when the date can't be read and falls back to a time inside the date field. Reconciliation: compares dates only for `accident.dateAndTime` (was always a false conflict) and `coerceForPath` writes a valid datetime-local when a document date is picked.
- **AI Review tab showed no document** (7bc9132e). It had its own old evidence panel reading `sessionStorage evidence_<claimId>_<docType>`, which nothing writes. Replaced with the shared `InlineEvidencePanel` (≈130 lines deleted).
- **Select all / Unselect all** (7bc9132e) on the shared `PdfPageGrid` (`onSetAll`); used by the AI review sheet (ticks all `numPages`, including pages still loading) and the Photos annexure picker.
- **Rephrase with AI** for Cause and Nature of Accident (565919af). Claim form text is still copied as written; a button beside the field (now a 3-line textarea) translates and rewrites in house style. Style from three of Vikram Dhule's paragraphs (places blanked), same for every surveyor. Only the field text is sent; one `text` job call, ~1k tokens. Undo restores; a manual edit drops Undo.
- **Evidence opens at the right page** (877ab9f8). `filesToImages` returns `pageRefs` (file index + real PDF page per sent image); `tagFieldPages` writes `foo_page` / `foo_file` beside each value as chunks merge. `fieldSource` reads them; AI Review, Details (`useFieldEvidence`) and Reconciliation pass page/file to the inline viewer, which loads `url#page=N` (iframe keyed to remount) and shows "page N".
- Deployed hosting to motorsurveyos-in, release 2026-10-22 15:54 (owner ran the command in the Terminal panel; all 86 chunks and the new strings verified live).

## What's Unfinished
- [ ] Owner live check on one real claim: date/time after re-reading the claim form, Rephrase, page jump in AI Review and Reconciliation.
- [ ] More of Vikram's paragraphs for `EXAMPLES` in `src/lib/ai/rephrase-cause.ts` (only 3; ideally 15–20 covering different accident types, with the insured's Marathi note where available).
- [ ] Insured Report dialog has the same dead sessionStorage lookup for policy images (falls back to upload) — in Tasks.md, low priority.
- [ ] `main` is 263 commits ahead of `origin/main`; pushing is the owner's call.

## Decisions Made
- Rephrase is opt-in per press, never on extraction — the assessment stays the surveyor's (IRDAI). Prompt forbids adding facts (no sides/severity not in the input).
- House style is shared across all surveyors (owner's call), from one surveyor's examples; places are blanked so they don't leak into other claims.
- Page tags come from the code, not the AI: light docs are read one page per call, so the chunk's page is the source page. No prompt or cost change. Known ceilings: 2-page estimate chunks tag the first page; documents read before this deploy have no tags.
- `reconciliation.ts` imports `parseDate` from `aiDataSlice` (circular, call-time only — marked `ponytail:`).
- Reconciliation picking a date-only source resets the time to 00:00 (marked `ponytail:`); surveyor re-enters it.
- Database reads and production deploys are blocked for Claude by the auto-mode classifier; examples were pasted by the owner and the deploy was owner-run.

## Files Changed
- src/stores/slices/aiDataSlice.ts (modified — parseTime, applyClaim exported, coerceForPath)
- src/stores/slices/__tests__/aiDataSlice.test.ts (modified)
- src/lib/ai/reconciliation.ts (modified — date compare, page/fileIndex on sources)
- src/lib/ai/processor.ts (modified — pageRefs, tagFieldPages)
- src/lib/ai/rephrase-cause.ts (new)
- src/lib/ai/__tests__/rephrase-cause.test.ts (new)
- src/lib/ai/__tests__/field-pages.test.ts (new)
- src/components/tabs/ReviewTab.tsx (modified)
- src/components/evidence/InlineEvidencePanel.tsx (modified)
- src/components/evidence/DocumentEvidenceViewer.tsx (modified — page/fileIndex, fieldSource)
- src/components/tabs/reconciliation/ReconciliationDialog.tsx (modified)
- src/hooks/useFieldEvidence.ts (modified)
- src/components/dialogs/AIReviewDialog.tsx (modified — hide page tags)
- src/components/documents/PdfPageGrid.tsx (modified)
- src/components/documents/DocumentReviewSheet.tsx (modified)
- src/components/tabs/photos/PdfPageSelectorDialog.tsx (modified)
- src/components/claim/AccidentForm.tsx (modified)
