# Claim Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show for every claim which workflow step it is waiting on and since when, on the dashboard and in the sidebar, with courier date and portal tick typed on the dashboard.

**Architecture:** One pure function `claimProgress(claim)` evaluates an ordered step table per survey type from existing claim fields plus five new optional ones. The claims loader stores a small summary of it in `claimsList`; the dashboard, sidebar and a Next button only read. Prints record a timestamp through the one shared filing function.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Vitest (`npx vitest run <path>`), IndexedDB via `@/lib/storage/indexeddb`.

**Spec:** `docs/superpowers/specs/2026-11-21-claim-progress-design.md` (rev 3)

## Global Constraints

- No change to `AppTab` IDs, routing or `useRouteSync`.
- No Scan change, no `_surveyos-status.json` change, no new `DocType` (doc types are a Prime↔Scan coupling point).
- No new npm dependencies. Courier date is a native `<input type="date">`.
- Every new claim field is optional; old claims load unchanged, no migration.
- Immutable updates only (spread; see `src/lib/claims/fee-status.ts`).
- No `console.log`. Files under 800 lines; new UI goes in new component files, not into `Dashboard.tsx` bodies.
- Watch UTF-8 in edits (existing files contain `·`, `—`, `₹`).
- Commit straight to `main` (owner rule). Do not deploy.

## Review Focus

1. Old or blank claims (`documents` undefined, `documentVerification` fields `''`, no `printedAt`) must not throw and must show sensible "waiting" steps. Pinned in Task 2.
2. A document checklist item left blank is not "verified"; only `YES` or `N.A.` counts. Pinned in Task 2.
3. Clearing the courier date must remove `courieredAt` and put the step back to waiting. Pinned in Task 4.
4. A report printed with no claim folder connected must still record `printedAt`. Pinned in Task 3.
5. Typing in a dashboard row's date field or ticking its checkbox must not open the claim (row `onClick` opens it). Pinned in Task 5 and Task 6.

---

### Task 1: One "completed" flag

Header Mark completed writes `completedAt`; dashboard Mark Completed writes `isCompleted`; reports' draft watermark and archiving read `isCompleted`. Make both writers set both.

**Files:**
- Modify: `src/lib/drive/scan-status.ts:147-151` (`completionPatch`)
- Modify: `src/lib/drive/__tests__/scan-status.test.ts:166-172`
- Modify: `src/components/layout/Dashboard.tsx:480-490` (row Mark Completed button)
- Modify: `src/hooks/useClaimsLoader.ts:45`

**Interfaces:**
- Produces: `completionPatch(completed: boolean, nowIso: string): Partial<ClaimData>` now also returns `isCompleted: completed`.

- [ ] **Step 1: Update the tests**

```ts
expect(completionPatch(true, 'T')).toEqual({ completedAt: 'T', statusChangedAt: 'T', isCompleted: true });
const p = completionPatch(false, 'T');
expect(p.isCompleted).toBe(false);
expect(p.completedAt).toBeUndefined();
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/drive/__tests__/scan-status.test.ts`
- [ ] **Step 3: Add `isCompleted` to both branches of `completionPatch`.**
- [ ] **Step 4: Dashboard row button:** replace `{ ...fullClaim, isCompleted: !fullClaim.isCompleted }` with `{ ...fullClaim, ...completionPatch(!done, at) }` where `done = !!fullClaim.completedAt || fullClaim.isCompleted` and `at = new Date().toISOString()`, then `void setCompletedInScan(fullClaim, !done, at)` (import from `@/lib/drive/scan-status-sync`, as `ClaimHeader.tsx` does).
- [ ] **Step 5: Loader:** `isCompleted: c.isCompleted || !!c.completedAt`.
- [ ] **Step 6: Run, expect PASS** — same command, plus `npx vitest run src/components/layout`.
- [ ] **Step 7: Commit** — `fix: one completed flag for header and dashboard`

---

### Task 2: Step table and `claimProgress`

**Files:**
- Modify: `src/types/claim.ts` (add fields to `ClaimData`, after `statusChangedAt`)
- Create: `src/lib/claims/progress.ts`
- Test: `src/lib/claims/__tests__/progress.test.ts`

**Interfaces:**
- Produces (types, in `progress.ts`):

```ts
export type PrintedKind = DocType | 'spotReport';
export type StepStatus = 'done' | 'waiting' | 'optional' | 'na';
export interface StepResult { id: string; label: string; tab: AppTab | null; status: StepStatus; at?: string }
export interface ClaimProgress { steps: StepResult[]; done: number; total: number; next: StepResult | null; since?: string }
export function claimProgress(claim: ClaimData): ClaimProgress;
export function tabMarks(p: ClaimProgress): Partial<Record<AppTab, 'done' | 'next'>>;
```

- Produces (new optional `ClaimData` fields): `printedAt?: Partial<Record<PrintedKind, string>>`, `courieredAt?: string`, `portalUploadedAt?: string`, `reinspectionNeeded?: boolean`, `heldNote?: string`. Import `PrintedKind` as a type from `progress.ts`, or declare it in `src/types/claim.ts` and re-export; pick the one that avoids an import cycle.

Rules (exact; ids are the strings used in tests):

| Survey | id · label · tab | done when | `at` |
|---|---|---|---|
| all but valuation | `docs` · Documents verified · `details` | all 7 `documentVerification` items have status `YES` or `N.A.` | — |
| final | `estimate` · Estimate received · `documents` | a `documents` entry with `type === 'estimate'`, or `assessmentRows.length > 0` | earliest such `addedAt` |
| final | `surveyPrinted` · Survey report printed · `reports` | `printedAt.surveyReport` | itself |
| final | `bill` · Bill received · `bill-check` | `documents` entry `type === 'invoice'`, or `billCheck.billTotal > 0` | earliest `addedAt` |
| final | `billChecked` · Bill checked · `bill-check` | `billCheck.verifiedBySurveyor` | `billCheck.verifiedAt` |
| final | `reinspection` · Reinspection · `reinspection` | `optional` unless `reinspectionNeeded`; then done when `printedAt.reinspectionReport` | itself |
| final | `billCheckPrinted` · Bill check report printed · `reports` | `printedAt.billCheckReport` | itself |
| spot | `spotFindings` · Spot findings · `details` | `spotDamageRows.length > 0` | — |
| spot | `spotPhotos` · Spot photos · `photos` | a photo with `tag === 'spot'`, or a `documents` entry `type === 'spotPhotos'` | — |
| spot | `spotPrinted` · Spot report printed · `reports` | `printedAt.spotReport` | itself |
| valuation | `inspection` · Inspection recorded · `valuation` | `valuationDetails.inspectionDate` non-empty | — |
| valuation | `valPhotos` · Photos · `photos` | a photo with `kind !== 'document'` | — |
| valuation | `valPrinted` · Valuation report printed · `reports` | `printedAt.valuationReport` | itself |
| all | `photoSheet` · Photo sheet printed · `photos` | `printedAt.photoSheet` | itself |
| all | `feeBill` · Fee bill printed · `fees` | `printedAt.feeBill` | itself |
| final | `portalReady` · Portal files ready · `documents` | `na` without `uploadSet`; done when every box with `written !== false` has `reviewedAt` and no `stale` | latest `reviewedAt` |
| all | `couriered` · Couriered · `null` | `courieredAt` | itself |
| all | `portal` · Uploaded to portal · `null` | `portalUploadedAt` | itself |
| all | `fee` · Fee received · `null` | `feeBill.feePaid` | `feeBill.paymentDate` |

Order: final = docs, estimate, surveyPrinted, bill, billChecked, reinspection, billCheckPrinted, photoSheet, feeBill, portalReady, couriered, portal, fee. Spot = docs, spotFindings, spotPhotos, spotPrinted, photoSheet, feeBill, couriered, portal, fee. Valuation = inspection, valPhotos, valPrinted, photoSheet, feeBill, couriered, portal, fee. (Photo sheet and fee bill are two steps, not one as in the spec, so each sidebar tab gets its own mark.)

`total` and `done` count only steps whose status is not `optional`/`na`. `next` = first step with status `waiting`, or `null` when `completedAt` is set. `since` = the `at` of the last done step (by order) that has one. `tabMarks`: a tab is `'next'` if `next?.tab` equals it; else `'done'` if it has steps and all are `done`, `optional` or `na`; otherwise absent.

- [ ] **Step 1: Write failing tests** in `progress.test.ts`, each starting from `createBlankClaim(...)`:
  - `blank final claim: next is docs, done 0, total 11 (reinspection optional, portalReady na), no throw with documents undefined`
  - `blank checklist values '' do not count; all YES/N.A. makes docs done`
  - `final waiting for bill: estimate document + printedAt.surveyReport → next.id === 'bill', since === estimate addedAt`
  - `reinspection is optional unless reinspectionNeeded; needed and unprinted → waiting`
  - `portalReady is na without uploadSet`
  - `spot claim never contains estimate/bill steps; total 9`
  - `valuation claim starts at inspection; total 8`
  - `completedAt set → next is null`
  - `tabMarks: next tab marked 'next', fully done tab 'done'`
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/claims/__tests__/progress.test.ts`
- [ ] **Step 3: Add the five fields to `ClaimData`; implement `progress.ts`** as one `STEPS: Record<SurveyType, StepDef[]>` table of `{ id, label, tab, eval(claim) → { status, at? } }` plus the two functions.
- [ ] **Step 4: Run, expect PASS**, then `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat: claim progress step table per survey type`

---

### Task 3: Record prints

**Files:**
- Create: `src/lib/claims/printed.ts`
- Test: `src/lib/claims/__tests__/printed.test.ts`
- Modify: `src/lib/reports/auto-file-report.ts:70-95` (`saveReportToClaimFolder`)
- Modify: `src/components/tabs/ReportTab.tsx:95-98` and `src/components/layout/FloatingReportPreview.tsx:174` (both `useReactToPrint` calls)

**Interfaces:**
- Consumes: `PrintedKind` (Task 2).
- Produces: `withPrinted(claim: ClaimData, kind: PrintedKind, at: string): ClaimData` (pure) and `recordPrinted(claimId: string, kind: PrintedKind): void`, which calls `updateClaim({ printedAt: ... })` on the claim store only when `currentClaim?.id === claimId`.

- [ ] **Step 1: Failing tests:**
  - `withPrinted keeps other kinds and does not mutate the input`
  - `recordPrinted ignores a claim that is not the open one`
  - `saveReportToClaimFolder records printedAt even when saveDocuments returns []` (mock `@/lib/documents/sink` and `@/lib/drive`)
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/claims/__tests__/printed.test.ts`
- [ ] **Step 3: Implement**; in `saveReportToClaimFolder`, call `recordPrinted(claim.id, docType)` right after the `claim?.id` guard, before the Drive and folder work. Add `onAfterPrint: () => currentClaim && recordPrinted(currentClaim.id, 'spotReport')` to both `useReactToPrint` options (react-to-print v3 supports `onAfterPrint`).
- [ ] **Step 4: Run, expect PASS**, plus `npx vitest run src/components/tabs src/lib/reports`.
- [ ] **Step 5: Commit** — `feat: record report prints on the claim`

---

### Task 4: Dispatch helpers and progress in the claims list

**Files:**
- Create: `src/lib/claims/dispatch.ts`
- Test: `src/lib/claims/__tests__/dispatch.test.ts`
- Modify: `src/stores/slices/claimSlice.ts:26-50` (`claimsList` item type)
- Modify: `src/hooks/useClaimsLoader.ts:34-60`

**Interfaces:**
- Consumes: `claimProgress` (Task 2).
- Produces:

```ts
export function withCourieredAt(claim: ClaimData, date: string): ClaimData;   // '' removes the field
export function withPortalUploaded(claim: ClaimData, uploaded: boolean, nowIso: string): ClaimData;
export function withHeldNote(claim: ClaimData, note: string): ClaimData;      // trimmed; '' removes
export interface ProgressSummary { label: string | null; done: number; total: number; since?: string; nextTab: AppTab | null }
export function progressSummary(claim: ClaimData): ProgressSummary;           // label: 'Waiting: <next.label>', null when next is null
export async function applyToClaims(ids: string[], fn: (c: ClaimData) => ClaimData): Promise<number>; // getClaim → saveClaim each, one 'CLAIMS_UPDATED' broadcast at the end, returns count saved
```

- `claimsList` items gain `progress?: ProgressSummary`, `courieredAt?: string`, `portalUploadedAt?: string`, `heldNote?: string`. The loader fills them; the support-view list in `Dashboard.tsx:115-132` leaves them out (read-only view).

- [ ] **Step 1: Failing tests:** `withCourieredAt('') removes courieredAt`, `withCourieredAt sets the date and keeps other fields`, `withPortalUploaded(false) removes the field`, `withHeldNote trims and '' removes`, `progressSummary of a blank final claim → label 'Waiting: Documents verified', 0 of 11`, `applyToClaims saves every id and broadcasts once` (mock indexeddb and `BroadcastChannel`).
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/claims/__tests__/dispatch.test.ts`
- [ ] **Step 3: Implement; extend the list type and loader.**
- [ ] **Step 4: Run, expect PASS**, then `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat: dispatch helpers and progress summary in claims list`

---

### Task 5: Dashboard row: progress, courier date, portal tick

**Files:**
- Create: `src/components/dashboard/ClaimRowProgress.tsx`
- Test: `src/components/dashboard/__tests__/ClaimRowProgress.test.tsx`
- Modify: `src/components/layout/Dashboard.tsx:404-433` (header and the Stage cell)

**Interfaces:**
- Consumes: `claimsList` item fields and `withCourieredAt`, `withPortalUploaded`, `applyToClaims` (Task 4).
- Produces: `ClaimRowProgress({ claim, readOnly }: { claim: ClaimsListItem; readOnly: boolean })`, where `ClaimsListItem = ClaimSlice['claimsList'][number]`.

Shows `claim.progress.label` (or `Done` when completed, nothing when `progress` absent), `since <date>` via `toLocaleDateString(undefined, { day: 'numeric', month: 'short' })`, `done of total`, the hold note in muted text when present, a date input bound to `courieredAt` (saves via `applyToClaims([id], c => withCourieredAt(c, value))`), and a "Portal" checkbox. Replace the Stage column (header text "Progress") with this component; `StageBadge` stays in the codebase, unused there. Widen that grid column from `1fr` to `1.6fr` in both grid templates.

- [ ] **Step 1: Failing tests:** `shows Waiting label and since date`, `changing the date saves withCourieredAt for that id` (mock `applyToClaims`), `clicking the date input or checkbox does not propagate to the row` (wrap in a parent with an `onClick` spy), `readOnly hides the inputs`.
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/components/dashboard`
- [ ] **Step 3: Implement**; every input calls `e.stopPropagation()` on `onClick`. Pass `readOnly={!!viewAsSurveyor}`.
- [ ] **Step 4: Run, expect PASS**, plus `npx vitest run src/components/layout`.
- [ ] **Step 5: Commit** — `feat: progress, courier date and portal tick on dashboard rows`

---

### Task 6: Batch courier date

**Files:**
- Create: `src/components/dashboard/CourierBatchBar.tsx`
- Test: `src/components/dashboard/__tests__/CourierBatchBar.test.tsx`
- Modify: `src/components/layout/Dashboard.tsx` (selection state, a checkbox cell first in each row and header, the bar above the table)

**Interfaces:**
- Consumes: `applyToClaims`, `withCourieredAt` (Task 4).
- Produces: `CourierBatchBar({ ids, onDone }: { ids: string[]; onDone: () => void })`: hidden when `ids` is empty; shows "<n> selected", a date input defaulting to today (`YYYY-MM-DD`, local time), and "Mark couriered", which runs `applyToClaims(ids, c => withCourieredAt(c, date))`, toasts `"<n> claims marked couriered on <date>"`, then calls `onDone` to clear selection.

- [ ] **Step 1: Failing tests:** `hidden with no ids`, `defaults the date to today`, `Mark couriered applies the date to all ids and clears selection`.
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/components/dashboard/__tests__/CourierBatchBar.test.tsx`
- [ ] **Step 3: Implement**; row checkboxes `stopPropagation`; selection is `useState<string[]>`, cleared when `showArchived` or the search changes; hidden in support view.
- [ ] **Step 4: Run, expect PASS**, plus `npx vitest run src/components`.
- [ ] **Step 5: Commit** — `feat: mark several claims couriered with one date`

---

### Task 7: Sidebar marks, waiting line, hold note, reinspection-needed tick

**Files:**
- Modify: `src/components/layout/sidebar.tsx:279-294` (claim badge) and `:363-378` (per-tab badges)
- Modify: `src/components/tabs/ReinspectionTab.tsx` (one checkbox at the top)
- Test: `src/components/layout/__tests__/sidebar-progress.test.tsx`

**Interfaces:**
- Consumes: `claimProgress`, `tabMarks` (Task 2), `withHeldNote` logic via `updateClaim({ heldNote })`.

Per tab: `'done'` → the existing green `✓`; `'next'` → a small amber dot with `title="Next step"`. This replaces the Bill Check `verifiedBySurveyor` tick (now covered by `tabMarks`); the AI Review conflict count stays as it is. Under the claim badge: `{progress.label} · since {date} · {done} of {total}`, hidden when `progress.next` is null, then a one-line input "Why is this claim waiting?" bound to `heldNote` (saves on blur, trimmed, empty removes). ReinspectionTab: checkbox "Reinspection needed for this claim" bound to `reinspectionNeeded`.

- [ ] **Step 1: Failing tests:** `final claim waiting for bill marks Bill Check as next`, `done tab shows the tick`, `waiting line shows label and count`, `hold note saves trimmed text on blur`, `conflict count still shows on AI Review`.
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/components/layout/__tests__/sidebar-progress.test.tsx`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS**, plus `npx vitest run src/components/layout src/components/tabs`.
- [ ] **Step 5: Commit** — `feat: sidebar progress marks, waiting line and hold note`

---

### Task 8: Next button

**Files:**
- Create: `src/components/layout/NextTabButton.tsx`
- Test: `src/components/layout/__tests__/NextTabButton.test.tsx`
- Modify: `src/components/layout/Dashboard.tsx:763-765` (render after `<TabPlaceholder />`, inside the `ErrorBoundary`)

**Interfaces:**
- Consumes: `getNextClaimTab`, `getTabLabel` from `src/lib/onboarding/tab-help.ts`.
- Produces: `NextTabButton()`: renders nothing without an open claim or when `getNextClaimTab(activeTab, surveyType)` is null; otherwise a right-aligned `print:hidden` button "Next: <label> →" that calls `setActiveTab(next)` and scrolls `main` to top.

- [ ] **Step 1: Failing tests:** `final claim on assessment → "Next: Bill Check"`, `spot claim on details → "Next: Report Center"` (spot hides assessment), `nothing on the last tab`, `nothing on the dashboard`.
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/components/layout/__tests__/NextTabButton.test.tsx`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `feat: Next button at the foot of claim tabs`

---

### Task 9: Whole-change check and records

- [ ] **Step 1:** `npx vitest run` → all pass. `npx tsc --noEmit` → no errors. `npm run lint` → no new errors in touched files.
- [ ] **Step 2: Scan check:** in Git Bash, from `../SurveyOS Scan`, `JAVA_HOME` set to Android Studio's jbr: `./gradlew :app:testDebugUnitTest` → BUILD SUCCESSFUL. Expected Scan impact: none.
- [ ] **Step 3:** Update `SurveyOS-Antigravity-Prime-V2-KnowledgeBase` `Tasks.md`, `Changelog.md` and a new `Sessions/` log per `AGENT_PROTOCOL.md`; note "not deployed, not browser-tested".
- [ ] **Step 4: Commit** — `docs: log claim progress work`
