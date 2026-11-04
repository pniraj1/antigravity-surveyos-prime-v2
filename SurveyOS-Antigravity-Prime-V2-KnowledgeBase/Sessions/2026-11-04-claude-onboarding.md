# Session: 2026-11-04 (Claude Code) — User onboarding

## What I Did
- Designed the onboarding flow and five phases; spec and plan in `Specs/`.
- Built Phase 0 (quick fixes) and Phase 1 (welcome, profile setup, checklist) on main, with a reviewer per task and a final whole-feature review.
- The final review found the checklist's claim rows, "Open saved" and the sidebar folder button all called a claims list nothing displays. Fixed.

## What's Unfinished
- [ ] Owner: live check with a fresh trial account; review wording.
- [ ] Deploy (to motorsurveyos-in, not the default site) and push: not done.
- [ ] Owner: is the admin-key fallback on in live `ai_config/routing`?
- [ ] Phases 2 to 4.

## Decisions Made
- AI provider names stay hidden (`6b99a1b4`), so key headings use plain wording beside the letters.
- Welcome shows only when report details are incomplete; checklist shows for all `active`/`trial` surveyors and admins, and can be hidden.
- Rows that the app cannot verify tick on opening the screen.
- Blank name fills from the Google name rather than changing approval code or the lock rule.
- `checklistHiddenAt` is set to `''`, not deleted, because Firestore merge is deep.
- No DOM test library added: click wiring, Esc and the gate effect have no automated tests.

## Files Changed
- New: `src/lib/onboarding/*`, `src/lib/claims/open-claim.ts`, `src/components/onboarding/*`.
- Modified: `Dashboard.tsx`, `sidebar.tsx`, `ProfileTab.tsx`, `NewClaimDialog.tsx`, `ReportTab.tsx`, `ReviewTab.tsx`, `TermsReacceptGate.tsx`, `lib/legal/versions.ts`, `types/vehicle.ts`, `ui-store.ts`, `claimSlice.ts`, `useClaimsLoader.ts`, `useCloudSync.ts`, `lib/firebase/sync.ts`, `resetAllState.ts`.
- Scan impact: none.
