# Session 2026-10-31 — Extraction bench, page order, PDF text (Claude Code)

Spec: `docs/superpowers/specs/2026-10-31-model-page-limits-bench-design.md`
Plan: `docs/superpowers/plans/2026-10-31-extraction-bench.md`
Commits: `78ea329e..c8f01875` on `main`. **Not pushed, not deployed.**
Checks: 243 files / 2125 Vitest tests pass, `tsc` clean, functions tests pass. `prompts.ts` and `package.json` unchanged.
Built subagent-driven: every task had its own review, plus a final whole-branch review.

## What changed for surveyors (live app)
- **Page-order bug fixed.** Gap-fill used to add re-read rows to the end of each section, so page 1 showed after page 2. Rows now keep page order; there is no serial sort (`row-check.ts` `orderByPage`).
- **Digital PDF text keeps lines and columns** (`text-lines.ts`), instead of being joined into one line.
- **Text or image is decided per page.** In a mixed PDF, text pages go as text and scanned pages go as images. The old rule sent the whole PDF one way (text when ≥85% of pages had text).
  - Side effect: the text-layer prompt hint and the printed-gross check now apply only when **every** page is text. This is stricter, so expect more "rows ≠ printed gross" notices on mostly-text PDFs.
- **Grouping by model limits** (`page-limits.ts`, `group-pages.ts`): the table is **empty**, so behaviour is unchanged until the owner approves a table.
- **IndexedDB is now v8** (4 bench stores added; nothing removed). An old open tab closes its connection, and a blocked upgrade shows a toast.
- **`?sandbox=true` is ignored on `motorsurveyos-in.*`**, including with a trailing dot.

## Sandbox bench (`/bench`, sandbox only)
- Each PDF gets a profile: kind, estimate page ranges, printed totals, GST basis, an adjustment (discount or round-off) and unreadable pages.
- Gold keys are locked by the owner.
- Readings are checked against the printed totals, then against two models that agree. Errors are typed; serial gaps, rate limits, provider errors and unreadable pages never count against a model.
- Step-up search per model and method: pages per call 1→4, then image scales 1.25 and 1.0. A setting needs 2 passing runs, or 3 at the borderline.
- Pacing is per API call. There is a daily cap per provider, a 429 retry then pause, and runs resume where they stopped.
- Results stay greyed until the checker agrees with the gold set.
- "Export limits table" produces the `page-limits.ts` text.

## Owner next
1. Approve the sandbox deploy:
   - functions: `aiProxy` (rate-limit headers)
   - hosting: `surveyos-v2-antigravity-in`
2. On the sandbox: open `/bench`, add the Pawar PDF and confirm its profile, lock its gold key, enter keys and run.
3. Do checklist §6.6 A–F in the spec before any limits go to production.

## Rulings made (the owner can reverse any of these)
- R1: an untagged row takes the page of the row before it.
- R3: `processor.ts` must not grow (823→708 lines). `service.ts` was split, and `call-with-key.ts` is new.
- R5: qty×rate is compared with the taxable amount, skipped when there is a discount.
- R6: each estimate span has a totals basis and an adjustment.
- R7: serial gaps are diagnostic only.
- R8: pacing is per call. Bench readings run one at a time across providers, so other providers wait while one paces.
- R9: only 429, timeout and network errors are retried. Other errors become `provider_error`, which stops the step-up.
- R10: the first chunk and the render scale use the limit of the model that will answer first.
- R11: a setting is safe only with ≥2 passing runs per hard PDF.
- `surveyos-v2-antigravity-in.web.app` stays a sandbox host on purpose.

## Known gaps
- The `/bench` page has never been opened in a browser. Its interactive flows (upload, run, Stop, autosave) have no tests, because jsdom isn't installed.
- `firstModel` guesses the first model by ranking with a placeholder image.
- The image cap ignores the surveyor's preferred model (same as before).

Scan impact: none (no coupling file touched).
