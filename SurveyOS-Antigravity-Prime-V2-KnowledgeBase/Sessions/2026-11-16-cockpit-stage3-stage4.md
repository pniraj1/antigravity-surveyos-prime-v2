# Session 2026-11-16 - Cockpit Stage 3 / Stage 4 rework (Claude Code)

## Done
- Stage 3 (`db9556cf`): two lists side by side before AI is asked (assessment rows left; remaining uploaded lines right, labelled via uploadLabels "Workshop bill lines" / "Estimate lines"). Proposal cards: "Assessment" and "<doc> line". Dialog max-w-[1600px], h-[94vh]; instruction box one line.
- Stage 4 (`7db85bad`): opens on "Assessed rows not linked" with Link to, Not in bill / Not in estimate, typed ref. Not in estimate (claim built from the bill) writes ref text "Not in estimate" and never touches the bill figure. Then uploaded lines not linked; disallowed items, not-in-bill rows and final seal in a collapsed "Summary".
- Spec: owner's answers 2026-11-16 in `docs/superpowers/plans/2026-11-16-cockpit-stage3-stage4.md`.

## Verification
vitest 3260 passed (358 files, 1 skipped); tsc 0 errors; build ok.

## State
Not deployed. Not pushed. Impact on SurveyOS Scan: none (no doc types, folder layout or manifest touched).

## Owner visual checks (agents may not use a browser)
1. Dialog size.
2. The two Stage 3 lists.
3. Stage 4 controls on a normal claim.
4. Stage 4 controls on a claim built from the bill.
