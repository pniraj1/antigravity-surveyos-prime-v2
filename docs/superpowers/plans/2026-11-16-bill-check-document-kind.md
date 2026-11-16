# Bill Check & Assessment Document-Kind Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Bill Check's Reconciliation Cockpit and the Assessment tab follow the claim's document kind (bill vs estimate), let labour and other unmatched rows reach Stages 2–3 on claims made from the bill, fix the upload-dialog bugs, and give Bill Check one scroll box.

**Architecture:** One switch already exists: `isFromBill(claim)` (`claim.billCheck.baseDocument === 'final-bill'`) in `src/lib/reports/bill-check-mode.ts`. Add two pure helpers beside it and next to the tally engines (`uploadLabels`, `isTallyCandidate`, `switchPrompt`). Point every hard-coded label and copied filter at them. Layout work copies the Assessment tab's single-scroll pattern.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Tailwind v4, Vitest (node environment, no jsdom: component tests use `renderToStaticMarkup`).

**Spec:** `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Specs/2026-11-16-bill-check-document-kind-report.md` (Issues 1–5).

## Global Constraints

- Owner decisions (2026-11-16, recommended options accepted):
  1. From-bill: estimate **lower** than assessed is amber ("billed above estimate"), not green.
  2. Rows marked "Not in bill" by the print gate are **not** re-added to matching (deferred; out of scope).
  3. The Assessment tab asks Bill/Estimate on **every** upload, preselected to the current mode, and warns before switching a claim that has rows.
  4. Extra Bill Items panel lives **inside** the grid's scroll box, after the last row, pinned left.
- Assessment heading wording when the bill is the base: **"Billed(taxable amount)"** (owner's wording).
- Brand: Brand Orange / amber only, no blue or purple. Light-only app: no new `dark:` classes.
- Never mutate: return new objects (project rule).
- Do not deploy. Owner is holding the deploy (commit `d0b632d2` is also undeployed).
- Prime ↔ Scan: doc types `invoice` / `estimate`, folder names and the manifest stay unchanged. Every report states the Scan impact: "none".
- Commit to `main` directly (no branches). End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Test command: `npx vitest run <path>`. Type check: `npx tsc --noEmit` (must stay 0 errors).

## Review Focus

1. **A from-bill claim whose rows already carry a ref** (`refSrNo` set, `refMatch` unset: manual or pasted refs) must NOT become a candidate again. Test in Task 1.
2. **Keep on a from-bill candidate** must leave `billedTaxable` (the bill figure) untouched and write `estimateAmount` + `refSrNo`. Test in Task 1.
3. **Cancelling the "Switch to…?" confirm** in the Bill Check upload dialog must not read the file. Task 2 (`switchPrompt` returns the text; the caller stops on cancel).
4. **The Assessment upload on an empty claim** still records the answer as before (no warning: nothing to lose). Test in Task 4 (`switchPrompt` returns `null` when the claim has no rows).
5. **A normal (estimate-based) claim** shows exactly the old wording everywhere. The tests in Tasks 3 and 4 assert both modes.

---

### Task 1: Labour and unmatched rows reach Stages 1–3 on from-bill claims (Issue 3)

**Files:**
- Create: `src/lib/tally/candidate.ts`
- Test: `src/lib/tally/__tests__/candidate.test.ts`
- Modify (replace the inline filter `!r.refMatch && r.allowed && r.billStatus !== 'not-in-bill' && r.billedTaxable === undefined` or its variant):
  - `src/components/tabs/bill-check/BillCheckStepper.tsx:87`
  - `src/components/tabs/bill-check/StageReviewTable.tsx:134` and `:199` (keep the extra `!handledRowIds.has(r.id)` there)
  - `src/components/tabs/bill-check/StageAITrigger.tsx:58`
  - `src/components/tabs/bill-check/StageAuditView.tsx:89` (savings list: use `isTallyCandidate(r, false)`. Savings only apply to normal claims; in from-bill the list is empty.)
  - `src/stores/slices/tallySlice.ts:29` (`markRemainingAllowedAsNotInBill`: no-op when `isFromBill(currentClaim)`)
- Modify: `StageReviewTable.tsx` `handleKeep`, the last `else` branch (the one writing `billedTaxable`)

**Interfaces:**
- Produces: `export function isTallyCandidate(row: AssessmentRow, fromBill: boolean): boolean`

- [ ] **Step 1: Write failing tests** in `candidate.test.ts`:
  - `isTallyCandidate(allowed row, no refMatch, billedTaxable undefined, false)` → `true`
  - same row with `billedTaxable: 1000` (self-billed) and `fromBill = true` → `true`
  - same self-billed row and `fromBill = false` → `false`
  - from-bill row with `refSrNo: 7` (no refMatch) → `false`
  - row with `refMatch` set → `false`; `allowed: false` → `false`; `billStatus: 'not-in-bill'` → `false`
  - Stepper regression: `renderToStaticMarkup(<BillCheckStepper rows={[selfBilledLabourRow]} extraBillItems={[estimateLine]} />)` with the store's `currentClaim.billCheck.baseDocument = 'final-bill'`, row `'FRONT BUMPER R/R'` (labour, 1000) and line `'R&R FRONT BUMPER'` (labour, 1000), contains `Name &amp; Price</span>` followed by count `1`. (Put this one in `src/components/tabs/bill-check/__tests__/BillCheckStepper.test.tsx`. Use the existing `selfBilled()` from `bill-check-mode.ts` to build the row.)
- [ ] **Step 2: Run** `npx vitest run src/lib/tally/__tests__/candidate.test.ts src/components/tabs/bill-check/__tests__/BillCheckStepper.test.tsx`. Expected: FAIL (module missing, count 0).
- [ ] **Step 3: Implement** `isTallyCandidate`: `allowed && !refMatch && !refSrNo && billStatus !== 'not-in-bill' && (fromBill || billedTaxable === undefined)`. Wire it into the six places. Each component gets `fromBill` via `isFromBill(currentClaim)` from the store, not through new props. Stepper and table already read `currentClaim`.
- [ ] **Step 4: Fix `handleKeep` for from-bill:** in the fallback `else` branch, when `isFromBill(currentClaim)`, call `updateAssessmentRow(id, { refSrNo: pair.billItem.srNo, estimateAmount: pair.billItem.taxableAmount, billVerified: true })` and do not touch `billedTaxable`, `billedAmount` or `billStatus`. Test in `StageReviewTable.test.tsx`: with a from-bill store claim, call the exported keep path through a `pairs` prop plus a spied `updateAssessmentRow` on the store, and assert the payload has no `billedTaxable` key. If `handleKeep` is not reachable without a DOM, extract it as `export function keepUpdates(pair: ReviewPair, fromBill: boolean): Partial<AssessmentRow>` in `StageReviewTable.tsx` and test that instead.
- [ ] **Step 5: Run** `npx vitest run src/lib/tally src/components/tabs/bill-check src/stores` and `npx tsc --noEmit`. Expected: all pass, 0 errors.
- [ ] **Step 6: Commit** `fix(bill-check): let unmatched rows reach tally stages on from-bill claims`

---

### Task 2: Bill Check upload dialog: honour Cancel, use the chosen kind (Issue 2)

**Files:**
- Modify: `src/lib/reports/bill-check-mode.ts` (add `switchPrompt`)
- Test: `src/lib/reports/__tests__/bill-check-mode.test.ts`
- Modify: `src/components/tabs/BillCheckTab.tsx:136-180` and `:301-304`

**Interfaces:**
- Produces: `export function switchPrompt(claim: ClaimData, kind: 'final-bill' | 'estimate'): string | null`. It returns the exact confirm text `handleUploadChange` builds today (move the four strings verbatim from `BillCheckTab.tsx:157-164`), or `null` when nothing would be lost (`rowsLostOnSwitch === 0` and no `extraBillItems`) or `kind` is already the claim's mode.

- [ ] **Step 1: Write failing tests:** `switchPrompt` returns `null` for an empty claim. It returns `null` when `kind` already matches the mode. It returns the text starting `'Switch to Estimate?'` for a normal claim with extra bill items. It returns text containing `'on 2 items'` when two rows would be lost.
- [ ] **Step 2: Run** `npx vitest run src/lib/reports/__tests__/bill-check-mode.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `switchPrompt`. Change `handleUploadChange(kind): boolean`: build `const text = switchPrompt(currentClaim, kind)`, `if (text && !window.confirm(text)) return false`, then `setBillCheckUpload(kind)` and `return true`.
- [ ] **Step 4:** `processBillFile(file, phone, kind = upload)` and `fileUpload(file, kind)` take the kind explicitly. Use it for `confirmBillMode(..., kind === 'estimate' ? 'estimate' : 'bill')` and `billCheckUploadDocType(kind)`. In the dialog's `onConfirm`: `if (kind !== upload && !handleUploadChange(kind)) return; void processBillFile(file, false, kind);`. Existing callers (header input, phone files) keep the default.
- [ ] **Step 5: Run** `npx vitest run src/lib/reports src/components/tabs` and `npx tsc --noEmit`. Expected: pass.
- [ ] **Step 6: Commit** `fix(bill-check): upload dialog honours cancel and files under the chosen kind`

---

### Task 3: Cockpit wording and colours follow the uploaded document (Issue 1)

**Files:**
- Modify: `src/lib/reports/bill-check-mode.ts` (add `uploadLabels`), test in `bill-check-mode.test.ts`
- Modify: `src/components/tabs/bill-check/StageReviewTable.tsx` (column headings "Workshop bill" / "Billed", the difference tooltip, the difference colour)
- Modify: `src/components/dialogs/ReconciliationWizardDialog.tsx:68` (badge fallback `'Workshop Bill'`)
- Modify: `src/components/tabs/bill-check/StageAuditView.tsx` (headings at ~`:246`, its subtitle, ~`:323`; hide the button at ~`:271` in from-bill)
- Modify: `src/lib/tally/stage3-ai-matcher.ts:20` + caller `StageAITrigger.tsx:97`
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx:102` (use `uploadLabels(claim).itemNo`)
- Tests: `StageReviewTable.test.tsx`, `StageAuditView.test.tsx`, `src/lib/tally/__tests__/stage3-ai-matcher.test.ts`

**Interfaces:**
- Produces (used by Task 4 too):
```ts
export interface UploadLabels {
  doc: 'Workshop bill' | 'Estimate';          // the document uploaded in Bill Check
  amount: 'Billed' | 'Estimated';             // its money column
  itemNo: 'Bill Item No.' | 'Est. Item No.';
  base: 'Estimate' | 'Billed';                // the Assessment's own document column
  comparison: 'Estimate vs assessment comparison' | 'Bill vs assessment comparison';
}
export function uploadLabels(claim: { billCheck?: { baseDocument?: string } } | null | undefined): UploadLabels
```
  Normal claim → `{ doc: 'Workshop bill', amount: 'Billed', itemNo: 'Bill Item No.', base: 'Estimate', comparison: 'Estimate vs assessment comparison' }`; from-bill → the other values.
- Produces: `buildStage3AIPrompt(rows, lines, docName = 'workshop invoice')`; from-bill passes `'repair estimate'`.

- [ ] **Step 1: Write failing tests:**
  - `uploadLabels` returns both exact objects above.
  - `StageReviewTable` with a from-bill store claim and one Stage 1 pair (assessed 1000, uploaded 900): html contains `>Estimate<` and `>Estimated<`; the −₹100 cell has `text-amber-700`; the tooltip is `Estimate is lower than assessed`. On a normal claim the same pair renders `>Workshop bill<`, `>Billed<`, `text-emerald-700` and `Bill is cheaper than assessed` (unchanged).
  - `StageAuditView` from-bill: contains `Billed Items Not in Estimate` and `Estimate Lines Not on the Bill`, and does not contain `Mark All Remaining Allowed as Not in Bill`.
  - `buildStage3AIPrompt([], [], 'repair estimate')` contains `repair estimate`, and the default contains `workshop invoice`.
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** Colour rule in the table: `fromBill` swaps the meaning, so negative → `text-amber-700` and positive → `text-muted-foreground`. Tooltips: normal `Bill is cheaper than assessed` / `Bill is higher than assessed`; from-bill `Estimate is lower than assessed` / `Estimate is higher than assessed`. Stage 4 from-bill headings: `Billed Items Not in Estimate`, subtitle `Items on the bill that the estimate did not include.`, and `Estimate Lines Not on the Bill`.
- [ ] **Step 4: Run** `npx vitest run src/lib src/components/tabs/bill-check src/components/dialogs` and `npx tsc --noEmit`. Expected: pass.
- [ ] **Step 5: Commit** `fix(bill-check): cockpit wording and colours follow the uploaded document`

---

### Task 4: Assessment tab asks bill or estimate on every upload; headings follow (Issue 4)

**Files:**
- Modify: `src/lib/documents/upload-doc-type.ts` (`asksDocumentKind`), test `src/lib/documents/__tests__/upload-doc-type.test.ts` (create if missing)
- Modify: `src/components/dialogs/DocumentKindDialog.tsx` (add `current?: 'estimate' | 'final-bill'`), test `src/components/dialogs/__tests__/DocumentKindDialog.test.tsx`
- Modify: `src/components/tabs/AssessmentTab.tsx` (`:60-91` answer handling, `:111-131`, `:140`, button text `:198-202`)
- Modify: `src/components/claim/AssessmentSectionTable.tsx:227`, `src/components/claim/AssessmentSummary.tsx:58,64`, `src/components/claim/assessment-grid-config.ts:51`

**Interfaces:**
- Consumes: `uploadLabels(claim)` (Task 3); `switchPrompt(claim, kind)` (Task 2); store action `setBillCheckUpload(kind)`.
- Produces: `asksDocumentKind(claim): boolean` returns `true` for any non-null claim.

- [ ] **Step 1: Write failing tests:**
  - `asksDocumentKind` returns `true` for a claim with rows and `baseDocument: 'estimate'`.
  - `DocumentKindDialog` with `current="final-bill"` marks that option (`aria-pressed="true"`) and shows the text `Current`.
  - `AssessmentSectionTable`/`AssessmentSummary` rendered with a from-bill store claim contain `Billed(taxable amount)`, `Bill vs assessment comparison` and `>Billed<`. With a normal claim they contain `Estimate(taxable amount)` and `Estimated` (unchanged). If `AssessmentSectionTable` is too heavy to render, assert on `uploadLabels(...).base + '(taxable amount)'` and render `AssessmentSummary` only.
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement:**
  - `asksDocumentKind` → `!!claim`. Pass `current={isFromBill(claim) ? 'final-bill' : 'estimate'}` to the dialog, but only when the claim has `baseDocument` set; a brand-new claim stays unpreselected.
  - In `startEstimate`, when `answer` differs from the current mode and `switchPrompt(claim, answer)` is non-null: if `window.confirm(text)` is false, stop. Otherwise call `setBillCheckUpload(answer)` (not `updateBillCheck`). Keep the existing `updateBillCheck({ baseDocument: answer })` + Undo toast only for claims with no rows.
  - Button text `Upload Document` (and the input `title`).
  - Headings: `${uploadLabels(claim).base}(taxable amount)`, `uploadLabels(claim).comparison`, `>{base === 'Billed' ? 'Billed' : 'Estimated'}<`. Config label `'Estimate / Billed (taxable)'`.
- [ ] **Step 4: Run** `npx vitest run src/lib/documents src/components/dialogs src/components/claim src/components/tabs` and `npx tsc --noEmit`. Expected: pass.
- [ ] **Step 5: Commit** `feat(assessment): ask bill or estimate on every upload; headings follow`

---

### Task 5: Bill Check has one scroll box (Issue 5)

**Files:**
- Modify: `src/components/tabs/BillCheckTab.tsx:210-262` (panel layout)
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx:494-563` (root card + scroll box; new `after` prop)
- Test: `src/components/tabs/__tests__/BillCheckGridEditability.test.tsx` (or a new `BillCheckGridScroll.test.tsx` beside it)

**Interfaces:**
- Produces: `BillCheckGrid` prop `after?: React.ReactNode`, rendered inside the scroll box after the rows.

- [ ] **Step 1: Write a failing test:** `renderToStaticMarkup(<BillCheckGrid … after={<div>EXTRAS</div>} />)` (reuse the props the existing editability test builds). The html does not contain `calc(100dvh - 240px)`; it contains `flex-1 min-h-0 overflow-auto`; and `EXTRAS` sits inside an element with `sticky left-0`, after the rows.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement** the Assessment pattern (`AssessmentTab.tsx:248`, `AssessmentGrid.tsx:474`):
  - Grid root card: `flex flex-col h-full min-h-0`.
  - Scroll box: `flex-1 min-h-0 overflow-auto` with `scrollPaddingTop: 44`.
  - The `max-content` row wrapper stays.
  - `after` goes in a sibling block after that wrapper: `<div className="sticky left-0">`. As a block child of the scroll box it is the box's visible width and stays put when scrolling sideways.
  - In `BillCheckTab`, the left panel stops scrolling (`h-full flex flex-col min-h-0 p-4`). The attention banner is `shrink-0`. The grid wrapper is `flex-1 min-h-0`. `ExtraBillItemsPanel` moves into `BillCheckGrid`'s `after`. The summary column keeps its own `overflow-y-auto h-full`.
- [ ] **Step 4: Run** `npx vitest run src/components/tabs` and `npx tsc --noEmit`, then `npm run build`. Expected: pass and build succeeds.
- [ ] **Step 5: Commit** `fix(bill-check): one scroll box so the sideways scrollbar stays on screen`

---

### Task 6: Full verification and vault records

- [ ] **Step 1:** `npx vitest run` (expect all pass; the count was 3,202 before this plan, plus the new tests), `npx tsc --noEmit` (0 errors), `npm run build` (succeeds).
- [ ] **Step 2:** Run SurveyOS Scan's drift tests (CLAUDE.md coupling rule; these tasks touch no coupling point, so this confirms "none"): in Git Bash, in `../SurveyOS Scan`, `./gradlew :app:testDebugUnitTest` with `JAVA_HOME` set to Android Studio's jbr. If the toolchain is unavailable, say so in the report. Do not skip it silently.
- [ ] **Step 3:** Vault per `AGENT_PROTOCOL.md`:
  - update `Tasks.md`;
  - update `Changelog.md`;
  - add `Sessions/2026-11-16-bill-check-document-kind-fixes.md`;
  - mark each Issue in the spec as built, with its commit.
  - Do NOT deploy.
- [ ] **Step 4: Commit** `docs: record bill check document-kind fixes`
