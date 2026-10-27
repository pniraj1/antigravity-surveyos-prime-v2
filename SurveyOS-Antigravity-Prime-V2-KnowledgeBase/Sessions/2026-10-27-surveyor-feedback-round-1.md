# 2026-10-27 — Surveyor feedback round 1 (Claude)

Spec: `docs/superpowers/specs/2026-10-27-surveyor-feedback-round-1-design.md`
Plan: `docs/superpowers/plans/2026-10-27-surveyor-feedback-round-1.md`
Built subagent-driven (cheap models for tasks and reviews, one strong-model whole-branch review). Commits 469aaa51..f3fa8d4a on main. 1863 tests pass, tsc clean. Not pushed, not deployed, not browser-checked (auth-gated).

## What changed, per complaint
1. **Fix extraction** → "Fix estimate reading" toolbar dialog. Re-read compares with the sheet: missing rows (ticked) and changed rows (unticked). Never deletes; keeps surveyor-edited assessed figures (amber "Re-read" badge). Original/Supplementary toggle.
2. **Site tab** retired; phone opens on Claim Details.
3. **Dashboard**: Survey Date (by survey type) + Last Edited; sorted by last edited.
4. **Policy check**: Nil Dep / IMT 23 / consumables / excess. AI suggests only. Notice strip on Assessment and Report Center. Final and bill-check Print/Word are blocked until all four are answered.
5. **Continuation** for estimate and bill uploads.
6. **Recovered** list shows vehicle no.
7. **Add row** below each section (Assessment and Bill Check).
8. **Word** keeps UIIC page breaks (verified via Word COM page count).
9. **UIIC dates** asked in a "Before printing — UIIC" step on every UIIC print/Word.

## Rulings made during the build (owner to check)
- Re-read matching: description first, then serial; supplementary rows are matched and anchored only among supplementary rows. Reason: unnumbered estimates get positional serials, so serial-first mispaired rows.
- Re-read never re-proposes a row the sheet already has with the same amount (multi-page PDFs return duplicates). Cost: a genuinely repeated identical line isn't proposed (use Add row).
- Continuation renumbers an AI page that restarted at 1; printed serials above the sheet's highest are kept.
- Policy amounts: "Rs. 1,000" parses as 1000 (the plan's pattern gave 0.1).
- Print buttons stay clickable while the policy check is pending; click opens the check inside the print step.

## Open
- Duplicate copies of a row whose amount the re-read *changed* still show as "missing" on multi-page text PDFs (owner decision pending).
- Owner checks in the app; push + deploy to the -in target.
