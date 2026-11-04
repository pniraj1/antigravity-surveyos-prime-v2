# User Onboarding (Phases 0 and 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new surveyor is guided from first sign-in to a first report: welcome, 3-step profile setup, a self-ticking checklist, plus quick fixes for the worst confusion.

**Architecture:** Pure rules in `src/lib/onboarding/`. Progress lives on `profile.onboarding`, so the existing profile sync carries it across devices. UI in `src/components/onboarding/`, with the dialog lazy loaded.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Vitest + Testing Library, `@/components/ui/dialog` (base-ui). No new dependencies.

**Spec:** `Specs/2026-11-04-user-onboarding-design.md`

## Global Constraints

- Work on `main`. Never branch. Stage explicit paths only; `design/`, `docs/research/` and `scratch/` are not yours.
- Edit with the Edit tool. No Python or PowerShell rewrites (past UTF-8 corruption).
- Never name an AI provider in new UI copy. Existing Get Key links stay.
- Do not touch `src/components/print/`, `src/components/pdf/`, AppTab IDs or routing.
- Do not start a dev server or browser. Run only vitest and `npx tsc --noEmit`.
- No `console.log`. No new dependencies. Immutable updates.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

- Returning surveyor on a new device: no welcome before the cloud profile has been pulled. (Task 2 test)
- Terms re-accept gate is up: no welcome, as a modal over it would make it unclickable. (Task 2 test)
- `pending`, `readonly`, `expired`, `suspended`: no welcome and no checklist. (Task 2 test)
- Surveyor with only valuation claims: the checklist can still reach 100%. (Task 2 test)
- Whitespace values and `['']` key arrays (MultiKeyInput produces these) count as empty; the legacy `geminiApiKey` counts as a key. (Tasks 1 and 2 tests)

---

### Task 1: Phase 0 quick fixes

**Files:**
- Create: `src/lib/onboarding/profile-gaps.ts`, `src/lib/onboarding/__tests__/profile-gaps.test.ts`
- Create: `src/components/onboarding/ProfileGapBanner.tsx`, `src/components/onboarding/__tests__/ProfileGapBanner.test.tsx`
- Modify: `src/components/layout/sidebar.tsx`, `src/components/tabs/ProfileTab.tsx`, `src/components/layout/Dashboard.tsx`, `src/components/dialogs/NewClaimDialog.tsx`, `src/components/tabs/ReportTab.tsx`

**Interfaces:**
- Produces: `isReportDetailsComplete(profile: SurveyorProfile): boolean`, true when trimmed `name` and `licenceNumber` are both non-empty.
- Produces: `missingReportDetails(profile: SurveyorProfile): string[]`, in order, from `'name'`, `'licence number'`, `'signature'`, `'stamp'`.

- [ ] **Step 1: Write failing tests.** `profile-gaps.test.ts`: complete profile gives `[]`; `name: '   '` is missing `'name'`; empty everything gives all four in order; `isReportDetailsComplete` is false when the licence is only whitespace. `ProfileGapBanner.test.tsx`: renders nothing when complete; with gaps shows `Your reports are missing: licence number, signature.`; clicking "Open Profile" calls `setActiveTab('profile')`; the root has class `print:hidden`.
- [ ] **Step 2: Run** `npx vitest run src/lib/onboarding src/components/onboarding`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement `profile-gaps.ts` and `ProfileGapBanner`** (reads `useProfileStore`, `useUIStore`; copy: `Your reports are missing: {list}. Add them in Profile so they print correctly.`; warning tint tokens as in NewClaimDialog's duplicate box). Render it in `ReportTab.tsx` directly above the `{/* ── Header */}` block.
- [ ] **Step 4: Sidebar.** Disabled claim items get `title` = `Open or create a claim first` (collapsed: `{label} — open or create a claim first`). Under the `CLAIM WORKFLOW` group label, when `!hasClaim && !sidebarCollapsed`, add a `px-3 pb-2 text-[11px] text-[var(--color-neutral-400)]` line: `Open or create a claim to use these`.
- [ ] **Step 5: ProfileTab key headings.** Change only the three heading texts: `G` to `G · Main AI key (recommended)`, `Q` to `Q · Backup AI key`, `O` to `O · Extra backup key (optional)`. Add `title` and `aria-label` to the G and Q toggle buttons: `Use the main AI key first`, `Use the backup AI key first`.
- [ ] **Step 6: Dashboard empty state.** Replace the sentence at `Dashboard.tsx:316` with `Start with a vehicle number. Prime then takes you through documents, checks and the report.`
- [ ] **Step 7: NewClaimDialog.** Keep the valuation line. Add for spot: `First inspection after the accident, before repairs. Records the damage and its cause.` For final: `Full assessment: estimate, parts, labour, bills and the final report.` Use `text-[11px] text-muted-foreground font-medium px-1`.
- [ ] **Step 8: Run** `npx vitest run src/lib/onboarding src/components/onboarding` and `npx tsc --noEmit`. Expected: PASS, no new type errors.
- [ ] **Step 9: Commit** `fix(onboarding): explain disabled tabs, key labels, survey types and blank profiles`

### Task 2: Onboarding state and rules

**Files:**
- Create: `src/lib/onboarding/rules.ts`, `src/lib/onboarding/__tests__/rules.test.ts`
- Modify: `src/types/vehicle.ts`, `src/stores/ui-store.ts`, `src/hooks/useCloudSync.ts`, `src/stores/slices/claimSlice.ts`, `src/hooks/useClaimsLoader.ts` (and any other builder of `claimsList` rows that `tsc` reveals), `src/lib/legal/versions.ts`, `src/components/legal/TermsReacceptGate.tsx`, `src/components/tabs/ReviewTab.tsx`, `src/components/tabs/ReportTab.tsx`

**Interfaces:**
- Consumes: `isReportDetailsComplete` from Task 1.
- Produces on `SurveyorProfile`: `onboarding?: { welcomeDoneAt?: string; checklistHiddenAt?: string; reviewSeenAt?: string; reportSeenAt?: string }`, ISO strings.
- Produces on ui-store (not persisted): `loginSyncDone: boolean`, `setLoginSyncDone(v: boolean)`, `setupStep: SetupStep | null`, `setSetupStep(s: SetupStep | null)`, with `export type SetupStep = 0 | 1 | 2 | 3` (0 = welcome).
- Produces on claims list rows: `hasDocuments: boolean`.
- Produces from `rules.ts`:
  - `canShowOnboarding(profile: SurveyorProfile, loginSyncDone: boolean): boolean`
  - `shouldShowWelcome(profile: SurveyorProfile, loginSyncDone: boolean): boolean`
  - `getChecklist(profile: SurveyorProfile, claims: ChecklistClaim[], isDriveConnected: boolean): ChecklistItem[]`
  - `markOnboarding(updates: Partial<NonNullable<SurveyorProfile['onboarding']>>): void`, merging over the current value and writing nothing if every key is already set.
  - `type ChecklistId = 'drive' | 'details' | 'marks' | 'aiKey' | 'claim' | 'document' | 'review' | 'report'`
  - `interface ChecklistItem { id: ChecklistId; label: string; done: boolean }`
  - `type ChecklistClaim = { surveyType: SurveyType; hasDocuments: boolean }`

- [ ] **Step 1: Write failing tests in `rules.test.ts`.**
  - `canShowOnboarding`: true for `active` and `trial` with sync done and current consent; false for `pending`, `readonly`, `expired`, `suspended`; false when `loginSyncDone` is false; false when consent is stale for a non-admin; true when consent is stale for an admin.
  - `shouldShowWelcome`: true with incomplete details and no `welcomeDoneAt`; false once `welcomeDoneAt` is set; false when details are complete; false before sync.
  - `getChecklist` labels, in order: `Connect Google Drive`, `Add your report details`, `Add your signature and stamp`, `Add your AI key`, `Create your first claim`, `Upload your first document`, `Check what was read in AI Review`, `See your first report in Report Center`.
  - `marks` needs both images. `aiKey`: `geminiApiKeys: ['']` and `['  ']` are not done; `geminiApiKey: 'x'` is; any non-blank key in `groqApiKeys`, `nvidiaApiKeys` or `ollamaApiKeys` is.
  - `document` is done when any claim has `hasDocuments`; `review` from `reviewSeenAt`; `report` from `reportSeenAt`.
  - Valuation-only claims: `document` and `review` are absent, and marking the rest done gives every item done. No claims: both present.
  - `markOnboarding`: keeps existing keys when adding a new one.
- [ ] **Step 2: Run** `npx vitest run src/lib/onboarding/__tests__/rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Move `needsReaccept`** to `src/lib/legal/versions.ts` and re-export it from `TermsReacceptGate.tsx` so existing imports keep working; `rules.ts` must not pull in firebase. `canShowOnboarding` skips the consent check when `profile.isAdmin`, matching the gate.
- [ ] **Step 4: Implement** the type, the store fields, and `rules.ts`.
- [ ] **Step 5: Wire sync.** In `useCloudSync.ts` call `useUIStore.getState().setLoginSyncDone(true)` beside `profileSyncReadyRef.current = true`, and `setLoginSyncDone(false)` beside its reset in the `!isAuthenticated` branch.
- [ ] **Step 6: Wire claims.** `hasDocuments` = `Object.keys(c.documents ?? {}).length > 0 || Object.keys(c.extractedData ?? {}).length > 0`.
- [ ] **Step 7: Wire marks.** `ReviewTab` and `ReportTab` each get a mount `useEffect` as their first hook, before any early return: `markOnboarding({ reviewSeenAt: now })` / `markOnboarding({ reportSeenAt: now })`, only if not already set.
- [ ] **Step 8: Run** `npx vitest run src/lib/onboarding src/components/legal` and `npx tsc --noEmit`. Expected: PASS, no new type errors.
- [ ] **Step 9: Commit** `feat(onboarding): progress state and checklist rules`

### Task 3: Welcome, setup dialog and checklist card

**Files:**
- Create: `src/components/onboarding/OnboardingGate.tsx`, `SetupDialog.tsx`, `GettingStartedCard.tsx`, and `__tests__/SetupDialog.test.tsx`, `__tests__/GettingStartedCard.test.tsx`
- Modify: `src/components/layout/Dashboard.tsx`, `src/components/tabs/ProfileTab.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1 and 2; `MultiKeyInput`, and newly exported `Field` and `ImageUploader` from `ProfileTab.tsx`; `fetchGeminiModelEntries(apiKey): Promise<ModelEntry[] | null>` from `@/lib/ai/service`.
- Produces: `OnboardingGate()` and `GettingStartedCard()`, no props.

**Copy (exact):**
- Welcome title: `Welcome to Motor SurveyOS Prime`. Body: `Turn your claim documents into a finished survey report, with far less paperwork.`
- Path, as four labelled steps: `Documents` `Check` `Assess` `Report`
- Primary: `Set up my profile (3 min)`. Secondary: `Later`.
- Progress line: `Step {n} of 3`. Every step has `Back` (not on step 1), `Skip for now`, and a primary button (`Continue`, final step `Finish`).
- Step 1 title: `Your report details`. Sub: `These print on every report you generate.` Fields: Full Name (read-only and locked unless admin, as in ProfileTab), IRDAI Licence Number, Licence Expiry, Mobile, Address. Preview heading: `How it prints`, showing name, `Lic. No. {licence}`, mobile, address. Blocked hint: `Name and licence number are needed to continue.`
- Step 2 title: `Signature and stamp`. Sub: `A clear photo from your phone works. You can add these later.`
- Step 3 title: `Your AI key`. Sub: `Prime uses this free key to read your documents. It stays on your own account.` Link: `Get a free key`, to `https://aistudio.google.com/app/apikey`. Button: `Test key`. Results: `This key works.` and `Could not confirm this key. Check it and your internet connection.`
- Finish toast: `Setup saved. Create your first claim when you are ready.`
- Card title: `Getting started`. Count: `{done} of {total} done`. Hide button: `Hide`.
- Profile button: `Show setup guide`.

- [ ] **Step 1: Write failing tests.** `SetupDialog.test.tsx` (mock `@/lib/ai/service`): step 0 shows the welcome copy; "Set up my profile" moves to step 1; `Continue` is disabled with the blocked hint while the licence is empty; opening step 1 with `irdaiLicence: 'SLA-1'` and no `licenceNumber` prefills it; a whitespace-only licence stays blocked; `Skip for now` advances; closing or `Later` sets `onboarding.welcomeDoneAt` and `setupStep` to null; `Test key` shows each result; `Finish` closes and sets `welcomeDoneAt`. `GettingStartedCard.test.tsx`: hidden when `canShowOnboarding` is false, when `checklistHiddenAt` is set, and when all items are done; shows `{done} of {total} done`; `Hide` sets `checklistHiddenAt`; clicking `Add your AI key` calls `setSetupStep(3)`, `Add your report details` step 1, `Add your signature and stamp` step 2.
- [ ] **Step 2: Run** `npx vitest run src/components/onboarding`. Expected: FAIL.
- [ ] **Step 3: Export `Field` and `ImageUploader`** from `ProfileTab.tsx`. Add `Show setup guide` to the Profile hero's right column: it removes `checklistHiddenAt` (without changing other keys) and calls `setSetupStep(0)`.
- [ ] **Step 4: Implement `SetupDialog`.** `Dialog` with `open` from `setupStep !== null`; `DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto print:hidden"`. Edits go straight to `updateProfile` (existing cloud sync saves them). Any close sets `welcomeDoneAt` via `markOnboarding`. Bad test-key results never block `Finish`. Keep it under 300 lines; split a step component if it grows.
- [ ] **Step 5: Implement `OnboardingGate`.** Lazy load `SetupDialog` with `next/dynamic` `ssr: false`, rendering it only when `setupStep !== null`, so `ProfileTab` code stays out of the main bundle. An effect opens step 0 once per mount when `shouldShowWelcome` is true and `setupStep` is null.
- [ ] **Step 6: Implement `GettingStartedCard`.** `bg-card border border-border rounded-2xl`, thin progress bar, one row per item with a check icon and text (never colour alone); the first incomplete row is emphasised. Row actions: details/marks/aiKey open their step; `claim` calls `setNewClaimDialogOpen(true)`; `document`, `review` and `report` call `setClaimsListOpen(true)`, or `setNewClaimDialogOpen(true)` when no claims exist; `drive` has no action. Rows are buttons with `min-h-11`.
- [ ] **Step 7: Mount.** `<GettingStartedCard />` as the first child of the content area in `DashboardContent`, above the Stats Row. `<OnboardingGate />` under `{/* Global Modals */}` in `Dashboard`.
- [ ] **Step 8: Run** `npx vitest run` (the whole suite) and `npx tsc --noEmit`. Expected: PASS, no new type errors. Report any failure that was already there rather than fixing it.
- [ ] **Step 9: Commit** `feat(onboarding): welcome, profile setup and getting-started checklist`
