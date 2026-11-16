# Reconciliation Cockpit Stage 3 & Stage 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stage 3 compares the remaining assessment rows (left) with the remaining uploaded lines (right) in a bigger, less wordy cockpit. Stage 4 opens on the assessed rows that have no link, each with Link / Not in bill (or estimate) / typed ref, and folds disallowed items and the tally away.

**Architecture:** Wording comes from the existing `uploadLabels(claim)` in `src/lib/reports/bill-check-mode.ts`. Which rows are still waiting comes from the existing `isTallyCandidate(row, fromBill)` in `src/lib/tally/candidate.ts`. A typed ref reuses the grid's own write (`BillCheckGrid.tsx:~873`). No new store actions except where stated.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Tailwind v4, Vitest (node env; `renderToStaticMarkup`; store state via `Object.assign(useClaimStore.getInitialState(), { currentClaim })` + `afterEach` reset — see `src/components/tabs/bill-check/__tests__/StageReviewTable.test.tsx`).

**Spec:** owner's answers, 2026-11-16 (this conversation), recorded here as the binding spec:
1. Assessment rows are always on the LEFT; the uploaded document (bill or estimate, per `uploadLabels`) on the RIGHT.
2. Stage 3 shows two lists side by side before AI is asked; the cockpit dialog is bigger; instruction text takes less space.
3. Stage 4 opens on "allowed assessed rows not linked to any uploaded line". Each row offers: **Link to ▾** (the uploaded lines still unlinked), **Not in bill** (normal claim) / **Not in estimate** (from-bill claim), or a **typed ref** (number or any text).
4. Stage 4 order: (1) assessed rows not linked, (2) uploaded lines not linked (existing Link / Add / Discard), (3) a collapsed **Summary** holding disallowed items, rows already marked not-in-bill, and the final seal.

## Global Constraints
- Brand Orange / amber only; light-only app: no new `dark:` classes; no blue/purple.
- Never mutate; immutable updates.
- "A blank beats a wrong number": no action may write a billed or estimate figure the surveyor did not choose.
- Do not deploy or push.
- Prime ↔ Scan: no doc types, labels in `documents.ts`, folder layout or manifest touched → impact none.
- Commit to `main`; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: `npx vitest run <path>`; `npx tsc --noEmit` 0 errors.

## Review Focus
1. A from-bill claim: "Not in estimate" must not touch `billedTaxable` / `billedAmount` / `billStatus` (the bill figure). Test in Task 2.
2. A typed ref of only spaces clears the ref (same as the grid), it never stores `'   '`. Test in Task 2.
3. "Link to ▾" lists only uploaded lines that are still unlinked (`claim.extraBillItems`), never all assessment rows. Test in Task 2.
4. Normal claims keep their existing billed figures and wording outside the changed sections. Tests assert both modes.
5. Stage 3 lists use the same "remaining" rule as Stages 1–2 (`isTallyCandidate`) — a row linked by a typed ref disappears from Stage 3 and Stage 4's unlinked list alike.

---

### Task 1: Stage 3 — two lists side by side, right labels, bigger cockpit

**Files:**
- Modify: `src/components/tabs/bill-check/StageAITrigger.tsx` (hero ~:160-230, counts ~:185-205, proposal card ~:280-335)
- Modify: `src/components/dialogs/ReconciliationWizardDialog.tsx:~109` (dialog size) and its header subtitle
- Test: `src/components/tabs/bill-check/__tests__/StageAITrigger.test.tsx`, `src/components/dialogs/__tests__/ReconciliationWizardDialog.test.tsx`

**Interfaces:** Consumes `uploadLabels(claim): { doc: 'Workshop bill' | 'Estimate'; amount: 'Billed' | 'Estimated'; ... }`, `isTallyCandidate`.

- [ ] **Step 1: Failing tests**
  - Before AI is asked, `StageAITrigger` renders a left list headed `Assessment` with each remaining row's particulars and `Assessed` figure, and a right list headed `Workshop bill lines` (normal) / `Estimate lines` (from-bill) with each extra line's item no. (`#<srNo>`), description and amount.
  - The proposal card's left label is `Assessment` (not `Estimate Item`); the right label is `Workshop bill line` / `Estimate line`; the right amount label is `Billed` / `Estimated`.
  - The counts label `Bill Lines` is gone (no literal `Bill Lines` / `Estimate Item` in the from-bill render).
  - The wizard dialog box uses `max-w-[1600px]` and `h-[94vh]`, and no longer renders the subtitle `4-Stage surveyor-controlled matching against assessment rows.`
- [ ] **Step 2: Run** `npx vitest run src/components/tabs/bill-check src/components/dialogs` — expect FAIL.
- [ ] **Step 3: Implement.** Replace the big hero with one compact line (title + one-sentence hint + the Ask AI button). Two lists: a two-column grid (`grid-cols-1 lg:grid-cols-2`), each scrolling on its own (`max-h-[45vh] overflow-y-auto`), compact rows (one line each: particulars/description, small mono part no., right-aligned amount). Labels from `uploadLabels`. Dialog: `w-[98vw] max-w-[1600px] h-[94vh]`; drop the subtitle line.
- [ ] **Step 4: Run** the tests + `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(bill-check): stage 3 compares assessment with uploaded lines side by side`

---

### Task 2: Stage 4 — unlinked assessed rows first, with Link / Not in bill / typed ref

**Files:**
- Modify: `src/components/tabs/bill-check/StageAuditView.tsx`
- Test: `src/components/tabs/bill-check/__tests__/StageAuditView.test.tsx`

**Interfaces:**
- Consumes: `isTallyCandidate(row, fromBill)`, `uploadLabels`, store `updateAssessmentRow(id, patch)`, `linkExtraBillItem(extraId, rowId)` (already from-bill aware).
- Produces (pure, exported from `StageAuditView.tsx`, unit-tested):
  - `export function notInDocUpdates(fromBill: boolean): Partial<AssessmentRow>` — normal: `{ billStatus: 'not-in-bill', billedTaxable: 0, billedAmount: 0 }`; from-bill: `{ refSrNo: 'Not in estimate', refStatus: 'manual' }` (no billed keys).
  - `export function typedRefUpdates(text: string): Partial<AssessmentRow>` — `text.trim() === ''` → `{ refSrNo: undefined, refStatus: 'manual' }`, else `{ refSrNo: text.trim(), refStatus: 'manual' }` (identical to `BillCheckGrid.tsx:~873`).

- [ ] **Step 1: Failing tests**
  - `notInDocUpdates(false)` and `notInDocUpdates(true)` return exactly the objects above; the from-bill one has no `billedTaxable`/`billedAmount`/`billStatus` keys.
  - `typedRefUpdates('  12 ')` → `{ refSrNo: '12', refStatus: 'manual' }`; `typedRefUpdates('   ')` → `refSrNo` undefined.
  - Render (normal claim, one allowed unlinked row "WIPER BLADE", one extra line `#7 WIPER BLADE ASSY`, one linked row "BELT" with `refSrNo: 3`): the first `<section>` is headed `Assessed rows not linked` and lists `WIPER BLADE` but not `BELT`; it contains a `Link to` select whose options are the extra lines (`#7 WIPER BLADE ASSY`), not assessment rows; a `Not in bill` button; and a ref text input (`aria-label` contains `ref`).
  - Same render from-bill: the button reads `Not in estimate`.
  - The disallowed table, the not-in-bill/savings list and the seal sit inside a `<details>` whose summary text starts `Summary` (collapsed: no `open` attribute).
  - "Mark all remaining …" stays available (normal claims only) inside the unlinked section header.
- [ ] **Step 2: Run** `npx vitest run src/components/tabs/bill-check` — expect FAIL.
- [ ] **Step 3: Implement.** Unlinked list = `rows.filter(r => isTallyCandidate(r, fromBill))`. Each row on one line: particulars, part no., assessed amount, then the three controls. Link select options: `claim.extraBillItems` (label `#srNo description (amount)`); on change → `linkExtraBillItem(extraId, row.id)`. Not-in button → `updateAssessmentRow(row.id, notInDocUpdates(fromBill))`. Ref input commits on blur/Enter → `updateAssessmentRow(row.id, typedRefUpdates(value))`. Section 2 = the existing extra-lines section unchanged (its own Link menu may keep listing rows). Section 3 = `<details>` "Summary" containing the existing disallowed table, the existing savings/"Billed Items Not in Estimate" list, and the seal. Empty state for section 1: `Every allowed row is linked.`
- [ ] **Step 4: Run** tests + `npx tsc --noEmit` + full `npx vitest run` — PASS.
- [ ] **Step 5: Commit** `feat(bill-check): stage 4 opens on unlinked assessed rows with link, not-in-bill and typed ref`

---

### Task 3: Verify and record
- [ ] `npx vitest run`, `npx tsc --noEmit`, `npm run build` all pass.
- [ ] Vault: `Tasks.md`, `Changelog.md`, `Sessions/2026-11-16-cockpit-stage3-stage4.md` (not deployed; owner visual check: dialog size, two lists, Stage 4 controls). Commit `docs: record cockpit stage 3/4 rework`.
