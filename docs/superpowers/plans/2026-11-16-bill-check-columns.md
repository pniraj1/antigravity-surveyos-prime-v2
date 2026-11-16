# Bill Check Columns by Case + "Allowed only" View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Bill Check grid reads base amount → Assessed → uploaded amount → its item no. → Status in both cases, with case-correct labels, and shows allowed rows only by default.

**Architecture:** Layout-only change in `src/components/tabs/bill-check/BillCheckGrid.tsx` (column template, header, row cells, totals row) plus one row-population helper. Labels come from the existing `uploadLabels(claim)` (`src/lib/reports/bill-check-mode.ts`). No formula, status, cockpit or print change.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Tailwind v4, Vitest (node env, `renderToStaticMarkup`; store state via `Object.assign(useClaimStore.getInitialState(), { currentClaim })` + `afterEach` reset).

**Spec:** `docs/superpowers/specs/2026-11-16-bill-check-columns-design.md`

## Global Constraints
- Column order, both cases: `Sr | Particulars | [Part No | HSN | Section | Qty] | BASE amount | Assessed | UPLOADED amount | UPLOADED item no. | Status | GST | Disposal | Dep% | Net | Price+GST | Remarks`.
- BASE amount = `row.estimated` in both cases; label "Estimate (taxable)" (Case 1) / "Bill (taxable)" (Case 2, `isFromBill`).
- UPLOADED amount = `row.billedTaxable` (Case 1, editable as today) / `row.estimateAmount` (Case 2, read-only, '—' when undefined); label "Billed (taxable)" / "Estimated (taxable)".
- UPLOADED item no. = the existing ref column (title `Bill Item No.` / `Est. Item No.`, still renamable).
- Case 2 has no separate locked "Billed Taxable" column any more.
- "Allowed only" view on by default, every time; not persisted. Off = today's rows (allowed + disallowed rows with `billedAmount > 0`).
- Column visibility keys unchanged: `unitPrice` drives the BASE column, `billedTaxable` drives the UPLOADED column, `refSrNo` the item no.
- No change to formulas, statuses, totals' values, the cockpit, or print/report builders.
- Brand Orange/amber only; no new `dark:` classes. Commit to `main`, message ends `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No deploy/push.

## Review Focus
1. Every header cell, row cell and totals cell must move together — a header/row mismatch silently shows numbers under the wrong heading. Task 2 test compares the header order with a row's cell order.
2. Keyboard moves / paste (`data-bc-col`, `handleGridKeys`, column paste) follow DOM order; after the reorder Shift+arrow must still land on editable cells in the new left-to-right order. Task 2: run the existing grid keyboard/paste tests unchanged.
3. Case 2 totals: the BASE total is the bill total and the UPLOADED total is the estimate total — not swapped. Task 2 test.
4. "Allowed only" must not change any subtotal/total (they already use allowed rows only). Task 1 test.
5. Flags, the "needs a ref" filter and navigation pools (`BillCheckGrid.tsx:~119, ~127`) use the same row population as the screen. Task 1.

---

### Task 1: "Allowed only" view, on by default

**Files:** Modify `src/components/tabs/bill-check/BillCheckGrid.tsx` (state ~:95; populations ~:119, ~:127, ~:589; toolbar near the "needs a ref" filter button). Test `src/components/tabs/__tests__/BillCheckGridEditability.test.tsx` (or a new `BillCheckGridAllowedOnly.test.tsx` beside it).

**Interfaces:** Produces `export function billCheckRowsShown(rows: AssessmentRow[], section: AssessmentSection, allowedOnly: boolean): AssessmentRow[]` in `BillCheckGrid.tsx` — `allowedOnly ? allowed rows of the section : (allowed || (billedAmount ?? 0) > 0) rows of the section`, order preserved.

- [ ] **Step 1: Failing tests**
  - `billCheckRowsShown([allowedA, disallowedBilledB, disallowedUnbilledC], 'parts', true)` → `[allowedA]`; with `false` → `[allowedA, disallowedBilledB]`.
  - Static render of `BillCheckGrid` with an allowed row "BUMPER" and a disallowed billed row "GRILLE": html contains `BUMPER`, not `GRILLE`; contains a toggle button with text `Allowed only` and `aria-pressed="true"`.
  - The TOTAL line's assessed figure is the same as before (only BUMPER's), i.e. unchanged by the toggle.
- [ ] **Step 2: Run** `npx vitest run src/components/tabs` — FAIL.
- [ ] **Step 3: Implement** `const [allowedOnly, setAllowedOnly] = useState(true)`; use `billCheckRowsShown` at all three population sites; toolbar toggle styled like the existing filter button (amber when on), `aria-pressed`, `title="Show allowed rows only. Turn off to also see disallowed items the workshop billed."`.
- [ ] **Step 4: Run** `npx vitest run src/components/tabs` + `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(bill-check): show allowed rows only by default`

### Task 2: Column order and case labels

**Files:** Modify `src/components/tabs/bill-check/BillCheckGrid.tsx` — `buildCols` (~:337-345), `headerRow` (~:375-436), `totalsRow` (~:447-480), row cells (~:676-900). Tests: same test folder.

**Interfaces:** Consumes `uploadLabels(claim)` → `{ base: 'Estimate' | 'Billed', amount: 'Billed' | 'Estimated', itemNo }` and `isFromBill`.

- [ ] **Step 1: Failing tests** (static render, one allowed row with `estimated: 1000, assessed: 900, billedTaxable: 950, estimateAmount: 880, refSrNo: 7`):
  - Case 1: header text order (by `indexOf`) is `Estimate (taxable)` < `Assessed` < `Billed (taxable)` < `Bill Item No.` < `Status` < `Dep%` < `Price+GST` < `Remarks`.
  - Case 2 (`billCheck.baseDocument: 'final-bill'`): order `Bill (taxable)` < `Assessed` < `Estimated (taxable)` < `Est. Item No.` < `Status`; html contains no `Billed Taxable`.
  - Row cells follow the header: in Case 1 the row's `1,000` appears before `900`, before `950`, before the ref input value `7`; in Case 2 `1,000` (bill) before `900` before `880` (estimate).
  - Case 2 totals: BASE total shows the bill figure, UPLOADED total shows the estimate figure.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the order from Global Constraints in all four places (keep `visible.*` guards, widths from `COL_WIDTHS`, existing editability/locks: Case 1 uploaded = today's Billed Taxable input; Case 2 uploaded = read-only `estimateAmount`). Base cell renders `fmt(row.estimated || 0)` in both cases.
- [ ] **Step 4: Run** `npx vitest run src/components/tabs src/lib/reports` (includes existing keyboard/paste/editability tests, which must pass unchanged unless they assert the old column order — if so, update only the order and say so) + `npx tsc --noEmit` + full `npx vitest run` — PASS.
- [ ] **Step 5: Commit** `feat(bill-check): columns read base, assessed, uploaded, item no. in both cases`

### Task 3: Verify and record
- [ ] `npx vitest run`, `npx tsc --noEmit`, `npm run build` pass.
- [ ] Vault: `Tasks.md`, `Changelog.md`, `Sessions/2026-11-16-bill-check-columns.md` (not deployed; owner visual check of both cases and the toggle; Scan impact none). Commit `docs: record bill check column order and allowed-only view`.
