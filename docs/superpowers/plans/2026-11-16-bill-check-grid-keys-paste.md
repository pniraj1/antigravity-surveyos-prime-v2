# Bill Check Grid: Keyboard Movement and Excel Paste — Plan 4

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In Bill Check, the surveyor moves between editable boxes with the same keys as the Assessment tab, and pastes a column of values from Excel into any editable column.

**Architecture:**
- A pure module, `src/lib/reports/grid-fill.ts`, decides two things:
  - where a key press moves, from the list of editable cells in screen order;
  - what a pasted column writes, with apply, undo, filled and skipped counts.
- `BillCheckGrid.tsx` tags each editable box with `data-bc-row` / `data-bc-col` and adds one `onKeyDown` and one `onPaste` on the grid container. It applies the result through `updateAssessmentRow` and shows one toast with Undo.

**Tech Stack:** TypeScript, React (Next.js 16), Zustand, sonner, Vitest.

**Design (owner asked 2026-11-16; calls made by Claude, stated to the owner):**
- **Keys, matching `AssessmentGrid.handleGridNavigation`:**
  - **Shift+↑/↓:** the same column in the previous or next row, in screen order across sections;
  - **Shift+←/→:** the previous or next editable box in the same row;
  - **skipped:** disabled (locked) boxes;
  - **focus:** the target gets focus, and its text is selected for inputs.
- **Paste:** clipboard text with a line break, in one of the columns below, fills from that row downward in screen order. One line per row. Disabled boxes and rows where the column doesn't apply are **skipped and counted**. A single value pastes natively.
- **Columns, written exactly as the grid's own editors write them:**
  - **`gst`:** integer ≥ 0. Skipped on disposal rows. When `billedTaxable` is set, also `billedAmount = round(billedTaxable × (1 + gst/100))`.
  - **`disposalPercent`:** a number from 0 to 100. Skipped when the row is not a disposal row.
  - **`billAllowed`:** a number ≥ 0. Written as `billAllowed` only; `assessed` is never touched (the safe branch of `AllowanceScopeDialog`). Skipped on disallowed rows.
  - **`depOverride`:** a number from 0 to 100. Equal to the auto rate means `undefined`, as the grid's editor does.
  - **`billedTaxable`:** a number ≥ 0, with `billedAmount = round(tax × (1 + (gst ?? 18)/100))`. Skipped when the input is disabled: a disallowed row, `not-in-bill`, or a claim made from the bill.
  - **`billRemarks`:** text, kept as typed.
  - **`refSrNo`:** keeps its existing paste (`handleRefPaste`, D10). Not handled here.
- **Numbers** go through the existing `parseClipboardValue` (`src/lib/utils/grid-paste.ts`), which handles "18%", "1,200" and formulas. A value it can't parse is skipped.
- **Not included:** pasting into Status, mouse range selection, Ctrl+D fill-down and copy-out.

## Global Constraints
- Commit to `main`. End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage by path.
- Do not touch `src/lib/ai/prompts.ts` or `src/lib/ai/__tests__/prompts-final-bill.test.ts`. They are uncommitted, parked work.
- No new dependencies. Normal and from-bill claims both keep every existing rule. A paste never writes a box the screen shows as disabled.
- Exact toast copy: `Pasted ${filled} value${filled === 1 ? '' : 's'}`, plus ` · ${skipped} skipped` when skipped > 0, with an `Undo` action. When nothing was filled: `toast.info('Nothing pasted — those boxes are locked or the values could not be read.')`.
- Prime ↔ Scan: none.

## Review Focus
1. Excel CRLF and a trailing newline produce no extra row (Task 1).
2. Pasting with the "needs a ref" filter on follows the rows on screen (Task 2 uses the same on-screen list as `handleRefPaste`).
3. In a claim made from the bill, a pasted Billed column writes nothing (Task 1 test).
4. Shift+↓ on the last row, or Shift+→ on the last box, stays put (Task 1 test).
5. Undo restores every pasted field exactly, including `billedAmount` (Task 1 test).

---

### Task 1: The pure fill and move logic

**Files:**
- Create: `src/lib/reports/grid-fill.ts`
- Test: `src/lib/reports/__tests__/grid-fill.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type FillColumn = 'gst' | 'disposalPercent' | 'billAllowed' | 'depOverride' | 'billedTaxable' | 'billRemarks';
  export interface CellRef { row: string; col: string }
  export type MoveKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
  /** Index in `cells` (editable cells in screen order) to move to, or null to stay. */
  export function moveTarget(cells: CellRef[], current: CellRef, key: MoveKey): number | null;
  /** One value per line; null when the text has no line break (paste natively). Drops one trailing empty line; trims. */
  export function columnValues(text: string): string[] | null;
  export interface FillPlan { apply: RowUpdate[]; undo: RowUpdate[]; filled: number; skipped: number }
  export function planColumnFill(
    col: FillColumn, values: string[], onScreen: AssessmentRow[], startRowId: string,
    ctx: { fromBill: boolean; autoDepRate: (row: AssessmentRow) => number },
  ): FillPlan;
  ```
  Reuse `RowUpdate` from `src/lib/reports/ref-paste.ts`.
- `undo` holds each touched row's previous values for exactly the fields `apply` wrote.
- An empty line leaves its row unchanged and isn't counted as skipped.
- Values past the last row are counted as skipped.

- [ ] **Step 1: Write the failing tests:**
  - `moveTarget`:
    - Down goes to the same column in the next row, and Up to the previous;
    - Right and Left go to neighbours in the same row;
    - at the ends it returns null;
    - a column that is missing in the next row (disabled) is skipped to the following row that has it.
  - `columnValues('5\r\n6\r\n')` gives `['5','6']`, and `columnValues('5')` gives `null`.
  - `planColumnFill`:
    - `'billedTaxable'` with `['1000']` on a row with gst 18 writes `{ billedTaxable: 1000, billedAmount: 1180 }`, and undo restores the previous `billedTaxable` and `billedAmount`;
    - with `fromBill: true` it writes nothing and counts 1 skipped;
    - `'gst'` on a disposal row is skipped;
    - `'gst'` `['28']` on a row with `billedTaxable 1000` writes `{ gst: 28, billedAmount: 1280 }`;
    - `'disposalPercent'` on a non-disposal row is skipped;
    - `'billAllowed'` `['900']` writes `{ billAllowed: 900 }` and never `assessed`;
    - `'depOverride'` equal to `autoDepRate` writes `{ depOverride: undefined }`;
    - `'billRemarks'` `['ok']` writes `{ billRemarks: 'ok' }`;
    - an unparseable number such as `'abc'` is skipped;
    - a value past the last row is counted as skipped.
- [ ] **Step 2: Run, expect FAIL.** Run `npx vitest run src/lib/reports/__tests__/grid-fill.test.ts`.
- [ ] **Step 3: Implement.** Use `parseClipboardValue` for the number columns (`gst`, `billedTaxable` and `depOverride` are already in its number set; for `disposalPercent` and `billAllowed`, use `parseClipboardValue(v, 'billedTaxable')` to get the same number parsing). Clamp to the ranges above.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(bill-check): pure logic for grid keyboard moves and column paste`.

---

### Task 2: Wire keys and paste into the Bill Check grid

**Files:**
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx`
- Test: `src/components/tabs/__tests__/BillCheckGridEditability.test.tsx`

**Behaviour:**
- **Tag each editable box** with `data-bc-row={row.id}` and `data-bc-col="<col>"`:
  - GST `FormulaNumericInput` (`gst`). If it doesn't forward data attributes, wrap it in a span carrying them, and query the input inside;
  - disposal % input (`disposalPercent`);
  - `AllowanceInput` (`billAllowed`). Add a pass-through if needed;
  - dep % input (`depOverride`);
  - billed input (`billedTaxable`);
  - status select (`billStatus`): movement only, no paste;
  - Ref No input (`refSrNo`): movement plus its existing paste;
  - remarks input (`billRemarks`).
- **One `onKeyDown` on the grid container.** When Shift + an arrow is pressed on a tagged element:
  - collect `container.querySelectorAll('[data-bc-row][data-bc-col]')`, excluding disabled elements, in document order;
  - call `moveTarget`;
  - `preventDefault`, then focus the target and `.select()` it when it is a text or number input.
- **One `onPaste` on the grid container.** If the target's `data-bc-col` is a `FillColumn`:
  - `columnValues(text)` returns null → return and let the paste be native;
  - otherwise `preventDefault` and run `planColumnFill` with the same on-screen row list that `handleRefPaste` builds. Extract that list into one local helper both use, so they can't drift;
  - `fromBill` is the grid's existing value, and `autoDepRate` is `r => depRateFor({ ...r, depOverride: undefined })`;
  - apply through `updateAssessmentRow`;
  - show the toast copy from Global Constraints, with Undo applying `undo`.
  The Ref No column keeps its own `onPaste`; the container handler ignores `refSrNo`.

- [ ] **Step 1: Write the failing test** (static markup): a rendered row's billed input, remarks input and status select carry `data-bc-col="billedTaxable"`, `"billRemarks"` and `"billStatus"`, with `data-bc-row` set to the row id.
- [ ] **Step 2: Run, expect FAIL.** Implement. Run `npx vitest run src/components/tabs/__tests__ src/lib/reports/__tests__/grid-fill.test.ts`, and expect PASS. Then `npx tsc --noEmit -p .`.
- [ ] **Step 3: Commit** with `feat(bill-check): move between boxes with Shift+arrows and paste a column from Excel`.

---

### Task 3: One scroll box with sticky headings and an always-visible sideways scrollbar (owner, 2026-11-16)

**Why:** in Assessment the grid is one box that scrolls both ways (`AssessmentGrid.tsx:529`, `flex-1 min-h-0 overflow-auto`, with a `sticky top-0` header). In Bill Check, the page scrolls vertically (`BillCheckTab.tsx:198`) and the grid only scrolls sideways (`BillCheckGrid.tsx:519`, `overflowX: auto`). So the sideways scrollbar sits under the last row, and the headings scroll away.

**Files:**
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx`. The scroll wrapper is around line 519; `headerRow` is around line 274.
- Test: `src/components/tabs/__tests__/BillCheckGridEditability.test.tsx`

**Behaviour:**
- **The scroll box.** The wrapper at line 519 becomes the grid's own scroll box in both directions: `overflow: auto` and `maxHeight: 'calc(100dvh - 240px)'`. The sideways scrollbar then sits at the box's bottom edge, which stays on screen.
- **Unchanged:** the toolbar, the settings popover and the section footers.
- **Sticky headings.** Each section's column heading row (the element `headerRow(...)` returns) gets `position: sticky; top: 0; z-index: 10` and an opaque background (the same `bg-muted` / card background it already has), so rows don't show through.
- **Section titles** scroll normally.
- **Keyboard moves** (Task 2) that focus a box out of view scroll it into view. Native `focus()` already does this inside a scroll box, so don't add `scrollIntoView` unless the test shows it's needed.

- [ ] **Step 1: Write the failing test** (static markup):
  - the scroll wrapper renders with `overflow:auto` and a `max-height` containing `100dvh`;
  - a section heading row renders with `position:sticky`.
- [ ] **Step 2: Run, expect FAIL.** Implement. Run `npx vitest run src/components/tabs/__tests__` and expect PASS. Then `npx tsc --noEmit -p .`.
- [ ] **Step 3: Commit** with `feat(bill-check): one scroll box with sticky headings and a visible sideways scrollbar`.

---

### Task 4: Ship
- [ ] **Step 1: Full suite.** Run `npx vitest run --exclude "src/lib/ai/__tests__/prompts-final-bill.test.ts"`, with output to a file. Expected: all pass.
- [ ] **Step 2: Build.** Run `npm run build` with the parked Task 7 files stashed (`git stash push -u -- src/lib/ai/prompts.ts src/lib/ai/__tests__/prompts-final-bill.test.ts`), deploy hosting to `--project surveyos-v2-antigravity-in`, then `git stash pop`. The owner asked for live deploys.
- [ ] **Step 3: Verify and record.** Check a live chunk on motorsurveyos-in.web.app and surveyos.in for `Nothing pasted`. Add a Changelog entry in the vault, update memory, and commit.
