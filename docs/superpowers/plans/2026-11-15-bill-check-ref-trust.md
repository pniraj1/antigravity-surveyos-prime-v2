# Bill Check Reference Finder — Plan 1 of 4: Trust and Safety

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No wrong Ref No. is ever written or printed, and a Ref No. the surveyor set is never overwritten.

**Architecture:**
- Matching becomes part-number-only: a Ref No. is written only on an exact part number, with fixed rules for repeated part numbers. Everything else goes to the existing unmatched list, where the surveyor links by hand.
- `scorePair` (used to rank candidates in that list) learns that two different part numbers mean "not the same part".
- Print shows a Ref No. only when it is sure or surveyor-set.
- A one-time check demotes old refs that link different part numbers.

**Tech Stack:** TypeScript, Zustand store slices, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-bill-check-reference-finder-design.md`. This plan covers D1, D2, D3 and D5, except "Leave blank", which needs the panel and goes in Plan 3.

## The four plans (the spec, split by subsystem)
| Plan | Covers | Depends on |
|---|---|---|
| **1 (this): Trust and safety** | D1 part number decides · D2 repeats · D3 what prints · D5 protected and legacy refs | none |
| 2: Mode and comparison slots | D0 claim mode · D6 Final bill / Estimate 1 / Estimate 2, per-document refs, "E1-301 / E2-43" | 1 |
| 3: Reference panel | D7 two tabs, candidate detail, Leave blank · D8 scan strips and storage | 1, 2 |
| 4: Labour codes | D4: parser keeps Labor Code, 6-character match | 1; waits for a second brand's documents |

## Global Constraints
- Commit to `main` (`master` is abandoned). End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No new dependencies. No new AI calls.
- "The assessment is the surveyor's: suggestions are never applied without a tap."
- Prime only; no Scan coupling point is touched (doc types, folder layout, field labels, manifest).
- Run tests from the repo root: `npx vitest run <path>`.

## Review Focus
1. **Normal claim where neither document has part numbers** (small garages). After this plan, nothing auto-links; every bill line lands in "Bill Items Not Matched" for the surveyor to Link. That's what the spec intends (D1), but the reviewer should confirm totals and the print gate still behave. Pinned in Task 3 (`no part numbers → no row billed, every line unmatched`).
2. **A row the surveyor linked by hand, then the same bill re-uploaded.** The row keeps its ref and figures, and its bill line must **not** reappear as unmatched. Pinned in Task 3 (`manual row untouched and its line not re-listed`).
3. **Legacy rows with a ref but no `refStatus`** must keep printing. Pinned in Task 4 (`legacy ref without status prints`).
4. **Part numbers that differ only in formatting** ("56100-0R190" against "561000R190") must still be Certain. The existing test in `bill-matcher.test.ts` stays and must pass.
5. **One row, several bill lines with the same part number,** in a normal claim. The billed amount is the sum and the Ref No. lists every serial, never counted twice. Pinned in Task 2 and Task 3 (`one row, three lines`).

---

### Task 1: `scorePair` knows different part numbers mean different parts

**Files:**
- Modify: `src/lib/reports/bill-match-score.ts` (`scorePair`, plus a new private `oneEditApart`)
- Test: `src/lib/reports/__tests__/bill-match-score.test.ts`

**Interfaces:**
- Produces: `scorePair(row: PairRow, bill: PairBill): PairScore`, same signature, new behaviour:
  - both part numbers present, normalised and equal: unchanged (100, `['Part no. matches']`);
  - both present, **one edit apart** (one character inserted, deleted or changed), **and** the description Dice is ≥ 0.99: score computed as today, with `'Part no. 1 character off'` put first in `reasons`;
  - both present and otherwise different: score capped at **30** (below `MIN_SCORE` 40), with `'Part no. differs'` put first in `reasons`;
  - one or both missing: unchanged.

- [ ] **Step 1: Write the failing tests** (add to `bill-match-score.test.ts`)

```ts
describe('scorePair — part numbers decide', () => {
  const bill = (description: string, partNumber: string, taxableAmount = 100) => ({ description, partNumber, taxableAmount });
  it('different part numbers cap below MIN_SCORE even when words match', () => {
    const s = scorePair({ particulars: 'HEX SCREW MBN 10105-M6X50', partNumber: 'N910105006013', estimated: 100 }, bill('HEX SCREW MBN 10105-M6X50', 'N910105008026'));
    expect(s.score).toBeLessThan(MIN_SCORE);
    expect(s.reasons[0]).toBe('Part no. differs');
  });
  it('one character off with identical words keeps its score and says so', () => {
    const s = scorePair({ particulars: 'FENDER LH_Darkgrey', partNumber: 'A4008800006A8', estimated: 4193 }, bill('FENDER LH_Darkgrey', 'A40088800006A8', 4193));
    expect(s.score).toBeGreaterThanOrEqual(SURE_SCORE);
    expect(s.reasons[0]).toBe('Part no. 1 character off');
  });
  it('one character off but different words is "differs"', () => {
    const s = scorePair({ particulars: 'HEX SCREW M14X1,5X40', partNumber: 'N000000005514' }, bill('HEX SCREW M14X1,5X50', 'N000000005517'));
    expect(s.reasons[0]).toBe('Part no. differs');
  });
  it('a missing part number on one side is scored by words as before', () => {
    const s = scorePair({ particulars: 'FRONT BUMPER', estimated: 100 }, bill('BUMPER FRONT', 'A123', 100));
    expect(s.score).toBeGreaterThanOrEqual(SURE_SCORE);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/reports/__tests__/bill-match-score.test.ts`
Expected: the first three new tests FAIL; the fourth passes already.

- [ ] **Step 3: Implement** inside `scorePair`, after the exact-match return. Keep the existing word, amount and section scoring and the side-clash cap. Then apply the part-number rule last, so `'Part no. differs'` caps the result. Add `oneEditApart(a: string, b: string): boolean` (length difference ≤ 1, at most one mismatch; no full Levenshtein needed).

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/reports/__tests__/bill-match-score.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/bill-match-score.ts src/lib/reports/__tests__/bill-match-score.test.ts
git commit -m "feat(bill-check): different part numbers never score as the same part"
```

---

### Task 2: The matcher links on exact part number only, with the repeat rules

**Files:**
- Modify: `src/stores/slices/aiDataSlice.ts` (`BillMatch`, `matchBillItemsToRows`, around lines 200–318)
- Test: `src/stores/slices/__tests__/bill-matcher.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface BillMatch {
    bill: BillItem;          // the line this row is paired with (first of several in the one-row case)
    also?: BillItem[];       // more lines with the same part number, when this is the only row with it
    refOnly?: boolean;       // more rows than lines: this row shares `bill`'s ref and takes no amount
    reason: 'part';
    ambiguous: false;
    score: 100;
    reasons: string[];       // ['Part no. matches']
  }
  export function matchBillItemsToRows(rows: AssessmentRow[], billItems: BillItem[]): Map<string, BillMatch>
  ```
- **Rules** (spec D1 and D2):
  - group rows and lines by normalised part number (lowercase, strip spaces, '-', '_', '.'); rows or lines without a part number are never matched;
  - order each group's rows by `srNo`, falling back to array order, and its lines by `srNo`, falling back to `idx`;
  - **one row, M lines:** that row gets `bill = lines[0]` and `also = lines.slice(1)`;
  - **N ≥ 2 rows:** pair `rows[i] ↔ lines[i]` for `i < min(N, M)`. Extra rows get `bill = lines[M-1]` with `refOnly: true`. Extra lines are left unmatched.
  - No word, amount or section matching. `RIVAL_GAP` and the runner-up pass are removed.

- [ ] **Step 1: Update the tests.** In `bill-matcher.test.ts`, delete the tests that assert **word** matching. They assert the behaviour D1 removes; record this as a ledger Ruling. Keep `matches on part number regardless of formatting`. Add:

```ts
test('words alone never match', () => {
  const rows = [row({ id: 'r1', particulars: 'FRONT BUMPER' })];
  const bill = buildBillItems({ spare_parts: [{ description: 'BUMPER FRONT', total_amount: 11800 }] });
  expect(matchBillItemsToRows(rows, bill).size).toBe(0);
});
test('different part numbers never match even with identical words', () => {
  const rows = [row({ id: 'r1', particulars: 'HEX SCREW', partNumber: 'N910105006013' })];
  const bill = buildBillItems({ spare_parts: [{ description: 'HEX SCREW', part_number: 'N910105008026', total_amount: 100 }] });
  expect(matchBillItemsToRows(rows, bill).size).toBe(0);
});
test('one row, three lines: first line plus also', () => {
  const rows = [row({ id: 'r1', partNumber: 'A0019901167' })];
  const bill = buildBillItems({ spare_parts: [61, 65, 71].map(sr_no => ({ sr_no, part_number: 'A0019901167', total_amount: 142 })) });
  const m = matchBillItemsToRows(rows, bill).get('r1')!;
  expect(m.bill.srNo).toBe(61);
  expect(m.also?.map(b => b.srNo)).toEqual([65, 71]);
});
test('two rows, one line: second row shares the ref, refOnly', () => {
  const rows = [row({ id: 'a', srNo: 36, partNumber: 'MBBC0076' }), row({ id: 'b', srNo: 193, partNumber: 'MBBC0076' })];
  const bill = buildBillItems({ spare_parts: [{ sr_no: 260, part_number: 'MBBC0076', total_amount: 2200 }] });
  const m = matchBillItemsToRows(rows, bill);
  expect(m.get('a')?.refOnly).toBeFalsy();
  expect(m.get('b')?.refOnly).toBe(true);
  expect(m.get('b')?.bill.srNo).toBe(260);
});
test('two rows, three lines: paired in order, third line unmatched', () => {
  const rows = [row({ id: 'a', srNo: 1, partNumber: 'P1' }), row({ id: 'b', srNo: 2, partNumber: 'P1' })];
  const bill = buildBillItems({ spare_parts: [10, 11, 12].map(sr_no => ({ sr_no, part_number: 'P1', total_amount: 1 })) });
  const m = matchBillItemsToRows(rows, bill);
  expect([m.get('a')?.bill.srNo, m.get('b')?.bill.srNo]).toEqual([10, 11]);
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/stores/slices/__tests__/bill-matcher.test.ts`
Expected: FAIL on `words alone never match`, `different part numbers…`, `one row, three lines`, `two rows, one line`.

- [ ] **Step 3: Implement** the new `matchBillItemsToRows` and `BillMatch` per Interfaces. Remove `RIVAL_GAP` if nothing else uses it.

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/stores/slices/__tests__/bill-matcher.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/slices/aiDataSlice.ts src/stores/slices/__tests__/bill-matcher.test.ts
git commit -m "feat(bill-check): link refs on exact part number only, with repeat rules"
```

---

### Task 3: `applyFinalBill` protects surveyor refs and writes repeats correctly

**Files:**
- Modify: `src/stores/slices/aiDataSlice.ts` (`applyFinalBill`, around line 640)
- Test: `src/stores/slices/__tests__/apply-final-bill.test.ts`

**Interfaces:**
- Consumes: `matchBillItemsToRows` and `BillMatch` from Task 2.
- Behaviour:
  - Rows with `refStatus === 'manual'` are left out of matching in **both** modes and never changed.
  - Lines whose `srNo` equals any manual row's `refSrNo` (compared as strings) are not added to `extraBillItems`.
  - **Normal match:** as today: `billedTaxable` and `billedAmount` from `bill`, `billStatus 'in-bill'` (or `'not-allowed'` with the existing remark for a disallowed row), `refSrNo = bill.srNo`, `refStatus 'clean'`, `refMatch`.
  - **With `also`:**
    - `billedTaxable` and `billedAmount` are the **sums** over `[bill, ...also]`;
    - `refSrNo` is the serials joined with `', '` (e.g. `'61, 65, 71'`);
    - `refMatch.bill` is the first line.
  - **`refOnly`:** set only `refSrNo = bill.srNo`, `refStatus 'clean'` and `refMatch`. Billed fields and `billStatus` are untouched (a 0 billed figure would drive the cap to 0).
  - Lines matched as `bill` or in `also` never go to `extraBillItems`; all other lines do, as today.

- [ ] **Step 1: Write the failing tests** (add to `apply-final-bill.test.ts`, using its existing claim and row builders)

```ts
it('manual row untouched and its line not re-listed', () => {
  // row r1: refStatus 'manual', refSrNo 12, billedAmount 500. Bill has sr 12 with the same part no. and sr 13 unrelated.
  // expect r1 deep-equals its input; extraBillItems srNos === [13]
});
it('one row, three lines: amounts summed, serials joined', () => {
  // row partNumber A0019901167; bill lines 61/65/71 each taxable 142, total 168
  // expect billedTaxable 426, billedAmount 504, refSrNo '61, 65, 71', extraBillItems empty
});
it('refOnly row gets the ref and no billed figures', () => {
  // rows srNo 36 and 193 both MBBC0076; bill sr 260
  // expect second row refSrNo 260, billedAmount undefined, billStatus unchanged
});
it('no part numbers → no row billed, every line unmatched', () => {
  // rows without partNumber; two bill lines without part_number
  // expect every row billStatus unchanged, extraBillItems length 2
});
```

The implementer fills each body with the file's existing builders. The comments fix the inputs and the exact expected values.

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/stores/slices/__tests__/apply-final-bill.test.ts`
Expected: the first three new tests FAIL. Existing tests that relied on word matching also fail: update them to use part numbers, and record a Ruling (D1).

- [ ] **Step 3: Implement** per Behaviour.

- [ ] **Step 4: Run the store suite, expect PASS**

Run: `npx vitest run src/stores`
Expected: all pass. A failure in `extra-bill-actions.test.ts` or `aiDataSlice.test.ts` caused by word matching gets the same part-number update and Ruling.

- [ ] **Step 5: Commit**

```bash
git add src/stores/slices/aiDataSlice.ts src/stores/slices/__tests__
git commit -m "feat(bill-check): never overwrite surveyor refs; sum repeated lines on one row"
```

---

### Task 4: Print only sure or surveyor-set refs

**Files:**
- Create: `src/lib/reports/bill-ref.ts`
- Modify: `src/lib/reports/standard-report-builder.ts:342`, `src/lib/reports/uiic-final-builder.ts:692`
- Test: `src/lib/reports/__tests__/bill-ref.test.ts`

**Interfaces:**
- Produces: `export function printableRef(row: Pick<AssessmentRow, 'refSrNo' | 'refStatus'>): string | number | undefined`. It returns `row.refSrNo` when `refStatus` is `'clean'`, `'manual'` or `undefined` (legacy), and `undefined` for `'ambiguous'`.
- Both builders render `${printableRef(r) ?? '—'}` in place of `${r.refSrNo ?? '—'}`.

- [ ] **Step 1: Write the failing tests** in `bill-ref.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { printableRef } from '../bill-ref';
describe('printableRef', () => {
  it('prints a clean ref', () => expect(printableRef({ refSrNo: 68, refStatus: 'clean' })).toBe(68));
  it('prints a manual ref', () => expect(printableRef({ refSrNo: '61, 65', refStatus: 'manual' })).toBe('61, 65'));
  it('legacy ref without status prints', () => expect(printableRef({ refSrNo: 12 })).toBe(12));
  it('hides a doubtful ref', () => expect(printableRef({ refSrNo: 146, refStatus: 'ambiguous' })).toBeUndefined());
});
```

Also add one assertion to `src/lib/reports/__tests__/bill-check-ref-sr-no.test.ts`: a row with `refStatus: 'ambiguous'`, `refSrNo: 146` renders `—`, not `146`, in the standard bill-check output. Add the same to `uiic-no-bill.test.ts` for the UIIC output, using each file's existing builder call.

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/reports/__tests__/bill-ref.test.ts src/lib/reports/__tests__/bill-check-ref-sr-no.test.ts src/lib/reports/__tests__/uiic-no-bill.test.ts`
Expected: FAIL (`bill-ref` is missing; the doubtful ref still prints).

- [ ] **Step 3: Implement** `printableRef` and use it at both builder lines.

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/reports`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/bill-ref.ts src/lib/reports/standard-report-builder.ts src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__
git commit -m "feat(reports): print a Ref No. only when sure or set by the surveyor"
```

---

### Task 5: One-time check of old refs when Bill Check opens

**Files:**
- Modify: `src/lib/reports/bill-ref.ts` (add `settleLegacyRefs`)
- Modify: `src/components/tabs/BillCheckTab.tsx` (one `useEffect`)
- Test: `src/lib/reports/__tests__/bill-ref.test.ts`

**Interfaces:**
- Produces: `export function settleLegacyRefs(rows: AssessmentRow[]): Array<{ id: string; updates: Partial<AssessmentRow> }>`. It returns only the rows to change:
  - `refStatus 'clean'` where `refMatch.bill.partNumber` and `row.partNumber` are both non-empty and differ after normalising (same rule as Task 2): `{ refStatus: 'ambiguous' }`;
  - `refSrNo` set and `refStatus` undefined: `{ refStatus: 'manual' }`.
- `BillCheckTab` runs it once per claim id on mount and calls the existing `updateAssessmentRow(id, updates)` for each entry. It does nothing when the list is empty, so the claim isn't marked dirty.

- [ ] **Step 1: Write the failing tests** (add to `bill-ref.test.ts`)

```ts
describe('settleLegacyRefs', () => {
  const base = { id: 'r', particulars: 'X', estimated: 0, assessed: 0, partType: 'metal', gst: 18, section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50 } as AssessmentRow;
  it('demotes a clean ref that links different part numbers', () => {
    const r = { ...base, partNumber: 'N910105006013', refSrNo: 146, refStatus: 'clean' as const,
      refMatch: { bill: { id: 'b', description: 'HEX SCREW', amount: 1, taxableAmount: 1, gstPercent: 18, section: 'parts' as const, source: 'final-bill' as const, partNumber: 'N910105008026' }, score: 86, reasons: [] } };
    expect(settleLegacyRefs([r])).toEqual([{ id: 'r', updates: { refStatus: 'ambiguous' } }]);
  });
  it('marks a status-less ref as manual', () => {
    expect(settleLegacyRefs([{ ...base, refSrNo: 12 }])).toEqual([{ id: 'r', updates: { refStatus: 'manual' } }]);
  });
  it('leaves a clean same-part ref alone', () => {
    const r = { ...base, partNumber: 'A1', refSrNo: 5, refStatus: 'clean' as const,
      refMatch: { bill: { id: 'b', description: 'X', amount: 1, taxableAmount: 1, gstPercent: 18, section: 'parts' as const, source: 'final-bill' as const, partNumber: 'a-1' }, score: 100, reasons: [] } };
    expect(settleLegacyRefs([r])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/reports/__tests__/bill-ref.test.ts`
Expected: FAIL (`settleLegacyRefs` is not exported).

- [ ] **Step 3: Implement** `settleLegacyRefs` and the `BillCheckTab` effect (keyed on `currentClaim.id`).

- [ ] **Step 4: Run the full suite and the type check, expect PASS**

Run: `npx vitest run` then `npx tsc --noEmit -p .`
Expected: all tests pass; no type errors in the touched files.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/bill-ref.ts src/lib/reports/__tests__/bill-ref.test.ts src/components/tabs/BillCheckTab.tsx
git commit -m "feat(bill-check): demote old refs that link different part numbers"
```

---

## Acceptance (spec success criteria owned by this plan)
After deploying, on the MH40BG5830 copy with estimate 2 re-uploaded:
- **Criterion 1:** 0 Ref Nos. print that link different part numbers. Today there are 51.
- **Criterion 2:** ≥ 131 refs are filled automatically.
- **Criterion 3:** a ref typed by the surveyor survives a re-upload.

Criteria 4–7 belong to Plans 2 and 3.
