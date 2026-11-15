# Bill Check Ref No. Paste — Plan A

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The surveyor pastes a column of estimate numbers from Excel / Sheets / a Gemini table into Bill Check's Ref No. column instead of typing them one by one. A paste that lands on the wrong row is caught before it prints.

**Architecture:** A pure module `src/lib/reports/ref-paste.ts` reads the clipboard text and works out what to write to which row, including the check against the document read in Bill Check. `BillCheckGrid.tsx` only catches the paste, applies the result through `updateAssessmentRow`, and shows one message with Undo.

**Tech Stack:** TypeScript, React (Next.js 16), Zustand, sonner toasts, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-bill-check-reference-finder-design.md`, section **D10**. Ships before Plans 2–4 and depends only on Plan 1, which is deployed.

## Global Constraints
- Commit to `main` (`master` is abandoned). End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No new dependencies. No AI calls. No new stored fields: only the existing `refSrNo`, `refStatus` and `refMatch` are used.
- "The assessment is the surveyor's: suggestions are never applied without a tap." A paste is the surveyor's own act, so pasted refs are `manual`, unless the check flags them.
- A blank beats a wrong number: a doubtful pasted ref becomes `ambiguous`. That status doesn't print (`printableRef`) and blocks the print gate (`bill-check-flags.ts`, `blocking: true`).
- Prime only. No Scan coupling point is touched (doc types, folder layout, field labels, manifest). Impact on SurveyOS Scan: none.
- Run tests from the repo root: `npx vitest run <path>`.

## Review Focus
1. **Excel line endings.** Excel copies `\r\n` and adds a trailing newline. Neither may produce an extra row or a stray `\r` in a ref (Task 1 test).
2. **Pasting with "needs a ref" filter on.** Fill-down follows the rows on screen, not every row (Task 2 test, on-screen list passed in; Task 3 builds that list from the same filter the render uses).
3. **Serials from the other estimate.** Every pasted ref is flagged because none is on the stored document. The message must say why, so the surveyor isn't puzzled (Task 3 message copy).
4. **Sr No. written as `61.0` or `61 `** in a two-column paste still finds row 61 (Task 1 test).
5. **Rows with no Sr No.** (added by hand) are never the target of a two-column pair, and never crash the planner (Task 2 test).
6. **A bill read in two parts ("continue").** `extractedData` holds only the last part, so the check must also read the lines already matched or listed as extras. A serial from the first part must not be flagged (Task 3, Step 2).

---

### Task 1: Read the clipboard text

**Files:**
- Create: `src/lib/reports/ref-paste.ts`
- Test: `src/lib/reports/__tests__/ref-paste.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RefPaste =
    | { kind: 'single' }                                        // no line break, no tab: let the input paste natively
    | { kind: 'column'; refs: string[] }                        // '' = leave that row unchanged
    | { kind: 'keyed'; pairs: Array<{ srNo: number; ref: string }> }
    | { kind: 'invalid' };
  export function parseRefPaste(text: string): RefPaste;
  ```

Rules (from D10):
- Split lines on `\r?\n`, drop one trailing empty line, and split cells on `\t`. Trim every cell.
- No `\n` and no `\t` → `single`.
- Every line has 1 cell → `column`.
- Every line has 2 cells → drop the first line if its first cell isn't a number (a header). If every remaining first cell is a whole number (`Number(cell)` is an integer, so `61.0` → 61), the result is `keyed`. Otherwise `invalid`.
- 3 or more cells on any line, or a mix of 1 and 2 cells → `invalid`.
- An empty ref in a keyed pair drops that pair.

- [ ] **Step 1: Write the failing tests**

```ts
describe('parseRefPaste', () => {
  it('a plain value is single', () => expect(parseRefPaste('301')).toEqual({ kind: 'single' }));
  it('an Excel column with CRLF and trailing newline', () =>
    expect(parseRefPaste('301\r\n\r\n43\r\n')).toEqual({ kind: 'column', refs: ['301', '', '43'] }));
  it('keeps refs as typed', () =>
    expect(parseRefPaste('61, 65, 71\nE1-301 / E2-43')).toEqual({ kind: 'column', refs: ['61, 65, 71', 'E1-301 / E2-43'] }));
  it('two columns with a header are keyed', () =>
    expect(parseRefPaste('Sr No\tEst No\n12\t301\n13.0\t43 \n')).toEqual({
      kind: 'keyed', pairs: [{ srNo: 12, ref: '301' }, { srNo: 13, ref: '43' }] }));
  it('a keyed pair with an empty ref is dropped', () =>
    expect(parseRefPaste('12\t\n13\t43')).toEqual({ kind: 'keyed', pairs: [{ srNo: 13, ref: '43' }] }));
  it('a non-numeric first column is invalid', () =>
    expect(parseRefPaste('BUMPER\t301\nDOOR\t43')).toEqual({ kind: 'invalid' }));
  it('three columns are invalid', () =>
    expect(parseRefPaste('12\tBUMPER\t301')).toEqual({ kind: 'invalid' }));
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/reports/__tests__/ref-paste.test.ts`
Expected: FAIL. The module doesn't exist yet.

- [ ] **Step 3: Implement `parseRefPaste` in `src/lib/reports/ref-paste.ts`**

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/reports/__tests__/ref-paste.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/ref-paste.ts src/lib/reports/__tests__/ref-paste.test.ts
git commit -m "feat(bill-check): read a pasted Ref No. column or Sr No./Ref No. pairs"
```

---

### Task 2: Plan what the paste writes, with the check

**Files:**
- Modify: `src/lib/reports/ref-paste.ts`
- Test: `src/lib/reports/__tests__/ref-paste.test.ts`

**Interfaces:**
- Consumes: `RefPaste` (Task 1); `normPart` from `@/lib/reports/bill-match-score`.
- Produces:
  ```ts
  /** A line of the document read in Bill Check (buildBillItems output fits this shape). */
  export interface ReadLine { srNo?: number | string; partNumber?: string }
  export interface RowUpdate { id: string; updates: Partial<AssessmentRow> }
  export interface RefPastePlan {
    apply: RowUpdate[];
    undo: RowUpdate[];      // each touched row's previous refSrNo, refStatus, refMatch
    filled: number;         // written as manual
    flagged: number;        // written as ambiguous
    notOnDocument: number;  // of flagged: a serial not on the stored document
    skipped: number;        // pasted values that found no row (past the end, Sr No. missing or on 2+ rows)
  }
  export function planRefPaste(
    paste: RefPaste,
    onScreen: AssessmentRow[],   // rows in the order the grid shows them, filter applied
    startRowId: string,          // the Ref No. cell pasted into (column mode)
    lines: ReadLine[] | null,    // null = no stored document, so nothing is checked
  ): RefPastePlan;
  ```

Rules (from D10):
- **`column`:** `refs[i]` goes to `onScreen[start + i]`. `''` leaves the row as it is. Refs past the last row count as `skipped`.
- **`keyed`:** a pair goes to the single row in `onScreen` whose `srNo === pair.srNo`. No row, or two or more rows, means `skipped`. Rows without `srNo` never match.
- **Ref equal to the row's current `refSrNo`** (compared as strings): no update, not counted.
- **Written as:** `{ refSrNo: ref, refStatus: 'manual', refMatch: undefined }`. If the check fails, `refStatus` is `'ambiguous'` instead.
- **The check** runs only when `lines` is given and the ref matches `/^\d+(\s*,\s*\d+)*$/`. For each serial, the lines with `String(l.srNo) === serial` are looked up:
  - none → flag, counted in `notOnDocument`;
  - otherwise, if the row has a part number and every one of those lines has a different one (both present, compared with `normPart`) → flag.
- `apply` and `undo` are both empty for `single` and `invalid`.

- [ ] **Step 1: Write the failing tests**

Use rows `r(id, srNo?, partNumber?, refSrNo?)` built with the `AssessmentRow` fields the other Bill Check tests use (`estimated`, `assessed`, `section: 'parts'`, `allowed: true`).

```ts
describe('planRefPaste', () => {
  const rows = [r('a', 1, 'BP-1'), r('b', 2, 'RD-9'), r('c', 3)];
  const lines = [{ srNo: 301, partNumber: 'BP-1' }, { srNo: 43, partNumber: 'XX-7' }];

  it('column fills down from the pasted row and skips blanks', () => {
    const p = planRefPaste({ kind: 'column', refs: ['301', ''] }, rows, 'a', null);
    expect(p.apply).toEqual([{ id: 'a', updates: { refSrNo: '301', refStatus: 'manual', refMatch: undefined } }]);
    expect(p.filled).toBe(1);
  });
  it('column values past the last row are skipped', () =>
    expect(planRefPaste({ kind: 'column', refs: ['1', '2'] }, rows, 'c', null).skipped).toBe(1));
  it('keyed goes by Sr No., not position', () => {
    const p = planRefPaste({ kind: 'keyed', pairs: [{ srNo: 2, ref: '43' }] }, rows, 'a', null);
    expect(p.apply.map(u => u.id)).toEqual(['b']);
  });
  it('keyed skips a Sr No. on two rows or none', () => {
    const dup = [...rows, r('d', 2)];
    expect(planRefPaste({ kind: 'keyed', pairs: [{ srNo: 2, ref: '1' }, { srNo: 9, ref: '1' }] }, dup, 'a', null).skipped).toBe(2);
  });
  it('a different part number on the read line flags the row', () => {
    const p = planRefPaste({ kind: 'column', refs: ['301', '43'] }, rows, 'a', lines);
    expect(p.apply[0].updates.refStatus).toBe('manual');      // BP-1 = BP-1
    expect(p.apply[1].updates.refStatus).toBe('ambiguous');   // RD-9 ≠ XX-7
    expect(p.flagged).toBe(1);
  });
  it('a serial not on the read document flags the row', () => {
    const p = planRefPaste({ kind: 'column', refs: ['999'] }, rows, 'c', lines);
    expect(p.apply[0].updates.refStatus).toBe('ambiguous');
    expect(p.notOnDocument).toBe(1);
  });
  it('refs with letters are not checked', () =>
    expect(planRefPaste({ kind: 'column', refs: ['E1-999'] }, rows, 'c', lines).apply[0].updates.refStatus).toBe('manual'));
  it('undo restores the previous ref, status and match', () => {
    const prev = { ...r('a', 1, 'BP-1', '12'), refStatus: 'clean' as const };
    const p = planRefPaste({ kind: 'column', refs: ['301'] }, [prev], 'a', null);
    expect(p.undo).toEqual([{ id: 'a', updates: { refSrNo: '12', refStatus: 'clean', refMatch: undefined } }]);
  });
  it('an unchanged ref is not touched', () =>
    expect(planRefPaste({ kind: 'column', refs: ['12'] }, [r('a', 1, 'BP-1', '12')], 'a', null).apply).toEqual([]));
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/reports/__tests__/ref-paste.test.ts`
Expected: the `planRefPaste` tests FAIL (not exported). Task 1's tests still pass.

- [ ] **Step 3: Implement `planRefPaste`**

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/reports/__tests__/ref-paste.test.ts`
Expected: 16 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/ref-paste.ts src/lib/reports/__tests__/ref-paste.test.ts
git commit -m "feat(bill-check): plan a Ref No. paste and flag refs the read document contradicts"
```

---

### Task 3: Catch the paste in the grid

**Files:**
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx`. The Ref No. `<input>` is around line 725; the on-screen filter is around line 475; `flaggedIds` (around line 106) shows the section-order pattern.

**Interfaces:**
- Consumes: `parseRefPaste`, `planRefPaste`, `RowUpdate` (Tasks 1–2); `buildBillItems` (exported from `@/stores/slices/aiDataSlice`); `toast` from `sonner`.

- [ ] **Step 1: Build the on-screen row list once.** Add `onScreenRows`: `SECTION_ORDER.flatMap` over `allRows`, using the same filter the render uses (`r.section === section && (r.allowed || (r.billedAmount ?? 0) > 0)`, then the `filterUncertain` filter). Use it for paste only. Leave the render untouched.

- [ ] **Step 2: Add `onPaste` to the Ref No. input.** Read `e.clipboardData.getData('text')` and pass it to `parseRefPaste`.
  - `single`: return and let the input paste natively.
  - Anything else: `e.preventDefault()`.
  - `invalid`: `toast.error('Copy just the Ref No. column, or the Sr No. and Ref No. columns.')`.
  - Otherwise:
    - `lines` = every line Bill Check has read: `buildBillItems(claim.extractedData['final-bill'])`, plus `claim.extraBillItems`, plus each row's `refMatch.bill` and `refMatch.also`. A "continue" upload stores only its own pages in `extractedData`, but every line read ends up either matched or in `extraBillItems`. Use `null` when all three are empty;
    - `plan = planRefPaste(paste, onScreenRows, row.id, lines)`;
    - apply each `plan.apply` entry through `updateAssessmentRow`;
    - show one toast with an **Undo** action that applies `plan.undo` the same way.

- [ ] **Step 3: Message copy.** Build it from the counts, leaving out the zero parts:
  - `Filled ${filled} Ref Nos.`
  - `· ${flagged} to check`, plus ` (${notOnDocument} not on the document read here)` when `notOnDocument > 0`
  - `· ${skipped} found no row`

  When `filled + flagged === 0`, use `toast.info('Nothing to fill — the pasted values already match or found no row.')` instead.

- [ ] **Step 4: Type-check and run the Bill Check tests**

Run: `npx tsc --noEmit -p .` and `npx vitest run src/components/tabs/__tests__ src/lib/reports/__tests__`
Expected: no type errors; all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/bill-check/BillCheckGrid.tsx
git commit -m "feat(bill-check): paste a column of Ref Nos. from a spreadsheet, with Undo"
```

---

### Task 4: Ship

- [ ] **Step 1: Full suite.** Run `npx vitest run > .superpowers/sdd/2026-11-15-bill-check-ref-paste/suite.txt 2>&1` and read the tail. Expected: all pass. 3008 before this plan, plus the 16 new tests.
- [ ] **Step 2: Build.** Run `npm run build`. Expected: build completes.
- [ ] **Step 3: Deploy hosting** (owner approved deploying Plan A first). Run `firebase deploy --only hosting --project surveyos-v2-antigravity-in`. Expected: release complete for motorsurveyos-in and surveyos-v2-antigravity-in.
- [ ] **Step 4: Verify live.** Curl a live chunk on both motorsurveyos-in.web.app and surveyos.in and confirm it contains `"found no row"`. No browser tools: the owner checks paste in the app.
- [ ] **Step 5: Record.** Add a top entry for 2026-11-15 to the vault `Changelog.md` saying Ref No. paste was deployed, and update the `bill-match-score` memory. Commit. Push only if the owner says so.
