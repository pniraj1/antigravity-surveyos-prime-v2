# 2026-11-21 — Report filing, Drive backup, phone download (Claude Code)

Plan: `docs/plans/2026-11-20-report-filing-backup-and-phone-download.md`, run subagent-driven (implementer + reviewer per task, whole-branch review, one fix wave, re-review clean).

## What was wrong (F1–F7)
Each report written twice in the vehicle folder; photo sheet filed as a damage photo; valuation filed as "Final Survey Report"; Drive got a new copy per print; the printed PDF never reached Drive; phone import showed only a spinner and could save into a claim opened mid-download; older root-folder users were asked for a folder on every claim.

## Owner decisions
- Vehicle-number-first names inside the vehicle folder (one file per deliverable).

## Found by the final review and fixed
- Same-size reprint kept the old content (size-only dedupe) → content hash.
- Old vehicle-first files from the previous code collided with the new name → taken over as the report entry.
- Name fallback mislabelled surveyors' own files into portal-kit boxes → only `_`/`-` names, whole words.

## Prime ↔ Scan
Scan `2d9ad28`: `PHOTO_SHEET`, `VALUATION_REPORT` in `PrimeContract.kt` + handover note. ALIASES and labels unchanged. Scan tests green.

## Next
- Deploy after owner go-ahead; check on a real claim.
- Parked: size check before hashing; identical re-import keeps device marks.
