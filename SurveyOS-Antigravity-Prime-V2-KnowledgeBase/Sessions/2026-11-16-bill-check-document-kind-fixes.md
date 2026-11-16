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
