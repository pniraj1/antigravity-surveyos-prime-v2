# Session Log: 2026-11-16 - Bill Check / Assessment document-kind fixes

## Summary
Implemented Issues 1-5 of `Specs/2026-11-16-bill-check-document-kind-report.md` (6-task plan, subagent-driven). All on `main`. Not deployed - owner holding. Not pushed.

## Commits
- Task 1, Issue 3: `07008b88` - `isTallyCandidate` (`src/lib/tally/candidate.ts`); `keepUpdates` keeps bill figure on from-bill Keep.
- Task 2, Issue 2: `d1af624d` - upload dialog Cancel + `switchPrompt`.
- Task 3, Issue 1: `fee88f50` - `uploadLabels`; amber for estimate-lower on from-bill; Mark-All hidden; Stage 3 prompt wording.
- Task 4, Issue 4: `67ca0865` - `assessmentSwitch`; Upload Document button; "Billed(taxable amount)" headings.
- Task 5, Issue 5: `409373fc`, `40bf3ef9` - single scroll box, pinned extras, extras on empty grid.
- Earlier same day: `740fe2ed` (React #310 fix, deployed), `d0b632d2` (cockpit restyle + dark-mode leak fix, not deployed).

## Deferred (owner decision)
Rows marked "Not in bill" by printing are not re-added to matching; Stage 2 word stemming.

## Verification
- `npx vitest run`: 357 files passed, 1 skipped; 3231 tests passed.
- `npx tsc --noEmit`: 0 errors. `npm run build`: succeeded.
- SurveyOS Scan `:app:testDebugUnitTest --rerun`: BUILD SUCCESSFUL, 537 tests, 0 failures.
- Impact on SurveyOS Scan: none (drift tests: pass).

## Open for owner
Visual checks (no browser used by agents): Bill Check sideways scroll + pinned extras; narrow-screen summary panel; cockpit look. Then approve deploy.

## Final whole-branch review fix wave (d2fa53d6..45ecf383)
Final review (740fe2ed..3d39dcd8) asked for 7 fixes before deploy; all done, re-reviewed clean. vitest 3245 pass, tsc 0, build OK.
- F1 d2fa53d6: Assessment switch no longer copies the OLD estimate's bill no/date/total into the bill header (`setBillCheckUpload(kind, { copyHeader: false })`); header stays blank.
- F2 5a6dfca0: Assessment switch has its own confirm wording ("Make this claim from the final bill/estimate? …").
- F3 d7119891: a real base-document switch always replaces the rows (no continue/append across documents).
- F4 45e7f743: Unlink on a suggested (Stage 1–2) pair drops it from Keep-all (local only; returns if the cockpit reopens).
- F5 ff39539b: no "Not billed" button on from-bill claims (it zeroed bill figures).
- F6 da88c104: from-bill Stage 4 "Billed Items Not in Estimate" lists bill rows the estimate lacks; no "Total Saved".
- F7 752e2744: below the lg width the Bill Check panel scrolls again so the summary (bill no/date/total) is reachable.
- M1 0b000fa9: "Mark all remaining" skips rows that already have a ref number. M2 45ecf383: "Keep all … (all sections)" when a section filter is on.

## Owner visual checks before deploy (no browser used by agents)
1. Bill Check: sideways scrollbar on screen without scrolling down; Extra Bill Items stays put when scrolling sideways.
2. Bill Check on a narrow window (< 1024 px): summary panel reachable; grid not oversized.
3. Reconciliation Cockpit look (restyle d0b632d2) on a normal claim and on a from-bill claim (Estimate wording, amber colours).
4. Assessment: upload on a claim with rows → question preselected; switching asks first and replaces rows; bill header stays blank.
Known, deferred: Bill Check switches mode before its replace/continue prompt (cancel leaves it switched); print-gate "Not in bill" rows not re-matched; Stage 2 word stemming.

## Deployed 2026-11-16
Hosting deployed to motorsurveyos-in (surveyos-v2-antigravity-in) from main @ 581ad696; live chunks verified byte-identical to the build on surveyos.in and motorsurveyos-in.web.app. Not pushed to GitHub. Owner visual checks above still to do on the live site.
