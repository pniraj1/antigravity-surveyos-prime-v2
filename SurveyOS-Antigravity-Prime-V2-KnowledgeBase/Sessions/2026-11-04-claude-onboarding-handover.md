# Handover: user onboarding, Phases 2 to 4 (Claude Code to Google Antigravity)

Written 2026-11-04. The owner told Claude to proceed to the next phase, then ran out of Claude tokens before any Phase 2 work began. **No Phase 2 code exists and nothing is half-done.**

Read this with:
- `Specs/2026-11-04-user-onboarding-design.md` (spec)
- `Specs/2026-11-04-user-onboarding-plan.md` (plan for the finished Phases 0 and 1)
- `Sessions/2026-11-04-claude-onboarding.md` (session log)

---

## 1. Why this exists

The owner is Niraj, a practising motor surveyor from a family of surveyors. Trial surveyors are confused: they do not know what Prime does, what each tab is for, or what each report section does. The trial is only 3 days, so a surveyor must reach a real report in the first session.

The product is about removing admin, not about AI. Copy leads with less paperwork. AI drafts; the surveyor decides.

## 2. Current state

| Item | State |
|---|---|
| Phase 0 (quick fixes) | Built, deployed 2026-11-04 14:47 IST |
| Phase 1 (welcome, 3-step setup, checklist) | Built, deployed 2026-11-04 14:47 IST |
| Phase 2 (tips, Help, tour) | **Not started. Do this next.** |
| Phase 3 (report section guide) | Not started |
| Phase 4 (admin progress column) | Not started |
| Tests when deployed | `npx vitest run`: 260 files, 2356 tests pass. `npx tsc --noEmit`: clean |
| Browser testing | **None.** Nobody has tried it with a real login |
| Git | `main` pushed to `origin/main` on 2026-11-04 |

**Update, 22:12 IST:** the reinspection commit `11790138` is now deployed too, so the live site matches `main` as of that time. The owner is doing the live check.

Leave these untracked folders alone: `design/`, `docs/research/`, `scratch/`.

## 3. What was built (read before extending)

**Logic: `src/lib/onboarding/`**
- `profile-gaps.ts`: `isReportDetailsComplete`, `missingReportDetails`.
- `rules.ts`: `canShowOnboarding`, `shouldShowWelcome`, `getChecklist`, `markOnboarding`.
- `setup.ts`: `profilePrefill`, `checklistClaimTarget`, `checklistAction`, `closeSetup`, `reopenSetupGuide`, `isChecklistVisible`.
- `src/lib/claims/open-claim.ts`: `openClaim(id, tab?)`. It fetches the claim BEFORE changing navigation state. Keep that order; it prevents a real race with `useRouteSync`.

**UI: `src/components/onboarding/`**
- `OnboardingGate.tsx`: decides when to open; lazy loads the dialog. Mounted in `Dashboard.tsx` inside `<ErrorBoundary fallback={<></>}>`.
- `SetupDialog.tsx`, `SetupSteps.tsx`: welcome and the 3 steps.
- `GettingStartedCard.tsx`: checklist, first item in the Dashboard content.
- `ProfileGapBanner.tsx`: warning in Report Center.

**State**
- `profile.onboarding` = `{ welcomeDoneAt?, checklistHiddenAt?, reviewSeenAt?, reportSeenAt? }`, ISO strings, type in `src/types/vehicle.ts`. It travels with the existing profile sync.
- ui-store, not persisted: `loginSyncDone`, `setupStep`. Set in `useCloudSync.ts` after the profile pull.
- Claims list rows have `hasDocuments` (`useClaimsLoader.ts`).

**Traps already found. Do not reintroduce them.**
- Firestore `setDoc` with `merge` is deep. A key removed from `onboarding` comes back on the next pull, so `reopenSetupGuide` writes `checklistHiddenAt: ''`. `markOnboarding` treats `''` as unset. Never write `undefined`; Firestore rejects it.
- `markOnboarding` is first-write-wins per key, so it cannot grow a list. Phase 2 tip tracking needs its own helper.
- Any modal must not open while `TermsReacceptGate` is up: it would make the gate unclickable. `canShowOnboarding` handles this; reuse it.
- `ProfileTab` is lazy loaded on purpose. Do not statically import it into the Dashboard path.
- `ErrorBoundary`'s `fallback` is tested for truthiness: `fallback={null}` shows the big error panel, `<></>` shows nothing.
- `setClaimsListOpen` used to have no reader, which left "Open saved" dead. Trace that a store flag actually has a consumer before relying on it.
- Keys, signature and stamp are NOT in the profile Firestore doc. They are in `users/{uid}/secrets`, and admins can see keys. Do not write copy claiming keys are private to the surveyor.

## 4. Rules for this repo

**Workflow**
- Work and commit directly on `main`. Never create branches. `master` is abandoned, whatever tooling says. No PRs.
- Follow `AGENT_PROTOCOL.md`. Before stopping, update `Tasks.md`, `Changelog.md` and write a session log.
- Stage explicit paths only.
- Commit only; **push and deploy only when the owner says so**.

**Verification**
- **Do not start a dev server or browser for this app, ever, unless the owner asks in that same request.** The owner has corrected this three times. Passing tests or `tsc` are never evidence that a feature works. Say plainly what is unverified and let the owner check on the live site.
- vitest runs in `node` with **no DOM test library**. Do not add one. Test with `renderToStaticMarkup` plus exported pure helpers. Effects do not run and portals render nothing in that mode, so test step content without the Dialog wrapper. See `src/components/onboarding/__tests__/`.

**Code and copy**
- Smallest working diff; native and existing code first; no new dependency without a reason. Always give the owner a cost and resource estimate for any proposal. The product must stay practically free.
- Trust code over vault docs; vault docs can be stale.
- Files can contain non-ASCII characters. Past rewrites corrupted UTF-8 through cp1252. Edit precisely; never rewrite whole files through PowerShell or Python.
- This is Next.js 16 with breaking changes: check `node_modules/next/dist/docs/` before using framework APIs.
- **AI provider names stay hidden in UI copy** (deliberate, commit `6b99a1b4`). Say "AI key"; never name the provider. Existing Get Key links stay.
- The final assessment is surveyor-made only. Copy must never imply AI decides it (IRDAI liability).
- Do not touch `src/components/print/` or `src/components/pdf/`. Help UI must carry `print:hidden`.
- Do not change AppTab IDs or `useRouteSync`; navigation is the risky part of any UI change.
- No third-party analytics (DPDP).

**Prime and Scan**
Every report of a change must state its impact on SurveyOS Scan (sibling repo `../SurveyOS Scan`), even when it is "none". Coupling points: doc types and labels (`documents.ts`, `DocumentChecklist.tsx`), insurer table, claim folder names, spot and valuation field labels (`SpotPrintReport.tsx`, `SpotTab.tsx`, `ValuationTab.tsx`, `valuation-report-builder.ts`), claim paths, `_surveyos-scan.json`. Help text may name these but must not rename them. Phases 2 to 4 should have no impact; say so.

**Deploy (only when asked)**
```bash
npm run build
firebase deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in
```
- Live site: https://motorsurveyos-in.web.app. The old `motorsurveyos` site is dead.
- Add `firestore:rules` to `--only` if rules changed.
- `out/` is prebuilt, so skipping the build silently redeploys the old version.
- Never claim it is live without checking: grep a new string in `out/_next/static/chunks`, then `curl` that chunk from the live URL. Check the release time with `firebase hosting:channel:list --site motorsurveyos-in --project surveyos-v2-antigravity-in`.

## 5. Remaining work

Build order within Phase 2: tips and Help first, tour last. The tour is the weakest layer, because people forget tours.

### Phase 2A: first-visit tips
Show one short, closable, non-modal card at the top of a tab the first time it opens. It explains the tab and names the next tab.
- Suggested: `src/lib/onboarding/tab-help.ts`, a map from `AppTab` to `{ title, what, tip }`; `src/components/onboarding/TabTip.tsx`, rendered in `Dashboard.tsx` above the keyed `ErrorBoundary` in `<main>`. Do not put it inside each tab.
- Track with `onboarding.tipsSeen?: Partial<Record<AppTab, string>>` (a map suits deep merge) and a dedicated helper. Respect `canShowOnboarding`.
- The next tab depends on survey type. Use `isNavItemVisible` (`src/lib/navigation/visible-nav.ts`), the one place that rule lives.

| Survey type | Order |
|---|---|
| Spot | Documents, AI Review, Claim Details, Report Center, Photo Sheet, Fees |
| Final | Documents, AI Review, Claim Details, Assessment, Bill Check, Report Center, Photo Sheet, Fees, Reinspection |
| Valuation | Claim Details, Valuation, Report Center, Photo Sheet, Fees |

On a phone every survey type lands on Claim Details first (`claimLandingTab`).

Draft wording, **for the owner to review as a surveyor**:

| Tab | Tip |
|---|---|
| Documents | Upload RC, DL, policy and estimate here; everything else fills from these |
| AI Review | AI drafts and you decide; clear any mismatches between documents |
| Claim Details | Everything printed on the report; correct anything here |
| Assessment | Your parts, labour and depreciation decisions; the figures are yours |
| Bill Check | Match the final bill against what you assessed |
| Report Center | Preview and download the reports |
| Photo Sheet | Choose and arrange the photos that go in the report |
| Survey Fees Bill | Your fee bill; add bank, GST and PAN in Profile. The setup deliberately left these for here, so this tip must prompt for them |
| Reinspection | Record the check after repairs |
| Valuation | Valuation or break-in details |

Check each line against what the tab really does before shipping. Also cover Dashboard, Profile, Cloud Vault and Recovered in the Help text (2B); these labels confuse people too. Insured Report is admin-only.

### Phase 2B: Help button
Always reachable. It offers: what is this screen (from `tab-help.ts`), replay setup (`reopenSetupGuide`), FAQ (`/faq`), and contact (surveyosprime@gmail.com, per the FAQ page). Later it can link a short screen recording by the owner, which needs no code.
- Suggested place: sidebar footer in `src/components/layout/sidebar.tsx`, above the Privacy link.
- Check phones: the sidebar is hidden there, and with a claim open the bottom bar's "More" is the way in (`MobileBottomBar.tsx`). Trace that it really opens.
- Use the existing `Dialog`, or a simple panel, with `print:hidden`.

### Phase 2C: Dashboard tour (optional, last)
3 or 4 stops: New claim, Open claim, the claims list, Profile. Desktop only.
- Ask the owner if it is still wanted after 2A and 2B. Their live check may answer this.
- If built, try `driver.js`, but confirm its size and licence first, from memory about 5 KB and MIT. Tell the owner the cost.
- Respect `prefers-reduced-motion`. Do not run it while the setup dialog is open.

### Phase 3: report section guide
A side panel in Report Center (`src/components/tabs/ReportTab.tsx`). For each section of the selected report: what it is for, and which tab fixes it ("Wrong figure? Fix it in Assessment."). This is what the owner meant by "each section on report".
- Catalogue the real sections by READING `src/components/print/*` and the report builders. They have not been catalogued yet. Read only; do not edit them.
- Keep the data in one file, e.g. `src/lib/onboarding/report-guide.ts`, keyed by report type (`spot`, `survey`, `valuation`).
- **Show the owner the wording before shipping.** Only they can confirm it is correct.

### Phase 4: admin progress column
A column in `src/components/admin/tabs/SurveyorsTab.tsx`, data from `src/components/admin/hooks/useAdminData.ts`, showing how far each trial surveyor got. Limit: signature, stamp and keys are not in the profile doc, so only details, `welcomeDoneAt`, `reviewSeenAt`, `reportSeenAt` and whatever claim data is reachable can be shown. Check what the admin can read in `firestore.rules`.

## 6. Open items for the owner

- [ ] Live check with a fresh trial account: welcome appears once after Drive connects; Esc and X close it and it stays closed; a tap outside does not close it; every checklist row goes to the right place, especially "Upload your first document" once a claim exists; hide, then "Show setup guide" brings it back; picking a signature photo works on a phone. On the owner's admin account, use Profile, "Show setup guide".
- [ ] Review the wording: survey type lines in `NewClaimDialog.tsx`, setup text, all tips.
- [ ] Is the admin-key fallback on in live `ai_config/routing` (`src/lib/ai/service.ts`, near line 192)? The FAQ says surveyors need their own key. If the fallback is on, the checklist could call the key optional.
- [ ] Is a tour still wanted after tips and Help?
- [ ] Hindi? English was chosen first.
- [ ] Pushing to GitHub has not been done.

Any feedback from the live check comes before new phases.

## 7. Known small issues (deferred, none blocking)

- A surveyor whose details are completed by the prefill still sees the welcome once, with fields filled.
- `OnboardingGate` marks prefill as done even if the Google name is not available yet; unlikely, as auth comes before sync.
- Sidebar folder button: if the "Still reading" nudge holds navigation, the scroll flag stays set and the page scrolls on the next Dashboard visit. Harmless.
- The trial banner (`SubscriptionGuard.tsx`, z-9998) can cover the dialog top on short phones; "Skip for now" stays reachable.
- The Test key result can go stale if the key is edited during a test.
- `ProfileGapBanner` contrast is about 4.4:1; no darker warning token exists.
- `ReviewTab` and `ReportTab` set their "seen" mark even with no claim open; only a hand-typed URL reaches this.
- Claim rows on the checklist can read not-done briefly until claims load.
- Long-time surveyors also see the checklist until they hide it. Owner's call.
- Automated tests do not cover clicks, Esc, step transitions or the gate effect.
- "Check what was read" and "See your first report" tick on opening the screen; the app does not record review or report generation.
