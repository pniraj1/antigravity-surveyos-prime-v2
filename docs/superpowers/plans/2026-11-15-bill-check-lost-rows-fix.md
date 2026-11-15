# Bill Check: Lost-Rows Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop multi-page AI reads from silently dropping a page's rows when the model wraps its answer in a list, and record which model read each document.

**Architecture:** One helper, `asFragment`, turns a list-shaped page answer back into one document-shaped object before it is tagged and merged. It is applied at the three places an AI page answer is parsed. Separately, `extractDocument` notes the model that answered each call and returns the list as `_models` on the data, so the claim keeps it.

**Tech Stack:** TypeScript, Next.js 16, Vitest.

**Spec:** No design doc. This plan implements the bug found in the MH40BG5830 investigation (2026-11-15). Evidence is in Background below.

## Background (evidence)

- Claim `claim-1794715879932-p73c4p` (owner's copy of MH40BG5830). Estimate 2, a 5-page scan, was uploaded in Bill Check.
- `extractedData['final-bill']` had `spare_parts` 1–246 at the top level. It also had a key `"0"` holding `{ spare_parts: [247…263], labour_items: [1…36], painting_items: [37], … }`.
- **Cause:** the last page's reply was `[ { … } ]`, a list. `mergeAIResults(acc, fragment)` loops `for (const key in fragment)`, so it filed the object under `"0"`.
  - `buildBillItems` reads only `spare_parts`, `labour_items` and `painting_items`.
  - **54 rows were lost** (17 parts, 36 labour, 1 paint), with no warning.
- The same path serves every AI document read (estimate, bill, RC…), not only Bill Check.
- The AI's reading itself was good: 300/300 rows, correct serials, 2 misread part numbers. **No prompt change is in this plan.**

## Global Constraints

- Commit to `main` (`master` is abandoned).
- No new dependencies.
- Prime ↔ Scan impact: none. The AI extraction path is Prime-only; no coupling point is touched.
- Run tests from the repo root: `npx vitest run <path>`.

## Review Focus

1. **A reply that is a bare list of rows** (`[{ sr_no: 1, description: … }]`, no section keys) must be left as it is, not merged into one fake row. Pinned in Task 1 (`leaves a bare row list alone`).
2. **A list holding two document-shaped objects** (the model split one page into two objects) must keep the rows of both. Pinned in Task 1 (`merges two document-shaped objects`).
3. **A single-page document whose reply is list-shaped** (e.g. an RC) must come out as an object, so the field mappers can read it. Covered by applying `asFragment` at `processor.ts` line 518, which every page answer passes through. Pinned in Task 1's flow test.
4. **The gap-fill re-read** (`gap-fill.ts:66`) can get the same list-shaped reply. Pinned in Task 1 (wired there too; the unit test covers the shape).
5. **`_models` on the data must not break consumers** that loop over the data's keys. `stripPageTags` keeps it and the mappers read named keys only. Pinned in Task 2 by running the full `src/lib/ai` and `src/stores` suites.

---

### Task 1: Unwrap list-shaped page answers

**Files:**
- Modify: `src/lib/ai/merge-results.ts` (add `asFragment` export)
- Modify: `src/lib/ai/processor.ts:518` and `:535` (wrap `JSON.parse(...)` in `asFragment`)
- Modify: `src/lib/ai/gap-fill.ts:66` (same)
- Create: `src/lib/ai/__tests__/merge-results.test.ts`
- Modify: `src/lib/ai/__tests__/processor-flow.test.ts` (one new `it`)

**Interfaces:**
- Produces: `export function asFragment(parsed: unknown): unknown` in `merge-results.ts`.
  - **Rule:** if `parsed` is not an array, return it unchanged (same reference).
  - If it is an array **and every element is a plain object with at least one array-valued own property** ("document-shaped"), fold the elements with `mergeAIResults` (starting from `null`) and return the result.
  - Otherwise return `parsed` unchanged.

- [ ] **Step 1: Write the failing unit tests** in `src/lib/ai/__tests__/merge-results.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { asFragment, mergeAIResults } from '../merge-results';

describe('asFragment', () => {
  it('unwraps a one-element list holding a document', () => {
    expect(asFragment([{ spare_parts: [{ sr_no: 247 }], labour_items: [{ sr_no: 1 }], total_amount: 5 }]))
      .toEqual({ spare_parts: [{ sr_no: 247 }], labour_items: [{ sr_no: 1 }], total_amount: 5 });
  });
  it('merges two document-shaped objects', () => {
    expect(asFragment([{ spare_parts: [{ sr_no: 1 }] }, { spare_parts: [{ sr_no: 2 }], labour_items: [{ sr_no: 3 }] }]))
      .toEqual({ spare_parts: [{ sr_no: 1 }, { sr_no: 2 }], labour_items: [{ sr_no: 3 }] });
  });
  it('returns an object unchanged', () => {
    const o = { spare_parts: [] };
    expect(asFragment(o)).toBe(o);
  });
  it('leaves a bare row list alone', () => {
    const rows = [{ sr_no: 1, description: 'NUT' }];
    expect(asFragment(rows)).toBe(rows);
  });
  it('MH40BG5830 shape: no "0" key, last page rows kept', () => {
    const acc = { spare_parts: Array.from({ length: 246 }, (_, i) => ({ sr_no: i + 1 })) };
    const last = [{ spare_parts: [{ sr_no: 247 }], labour_items: [{ sr_no: 1 }, { sr_no: 2 }], painting_items: [{ sr_no: 37 }] }];
    const out = mergeAIResults(acc, asFragment(last));
    expect(out['0']).toBeUndefined();
    expect(out.spare_parts).toHaveLength(247);
    expect(out.labour_items).toHaveLength(2);
    expect(out.painting_items).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/ai/__tests__/merge-results.test.ts`
Expected: FAIL — `asFragment` is not exported.

- [ ] **Step 3: Implement `asFragment(parsed: unknown): unknown`** in `src/lib/ai/merge-results.ts`, per the rule in Interfaces. Add a one-line `ponytail:` comment naming the ceiling: a bare row list is left alone because its section can't be known; it still fails as before and is logged as an unread page.

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/ai/__tests__/merge-results.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Add the flow test** to `processor-flow.test.ts`, inside `describe('extractDocument — image path (estimate)')`

```ts
it('a page answered as a list keeps its rows (no "0" key)', async () => {
  queue(
    JSON.stringify({ spare_parts: [{ sr_no: 1, total_amount: 10 }, { sr_no: 2, total_amount: 10 }] }),
    JSON.stringify({ spare_parts: [{ sr_no: 3, total_amount: 10 }, { sr_no: 4, total_amount: 10 }] }),
    JSON.stringify([{ labour_items: [{ sr_no: 5, total_amount: 10 }], gross_amount: 50 }]),
  );
  const { data, findings } = await extractDocument('estimate', threeFiles());
  expect(data['0']).toBeUndefined();
  expect(data.labour_items).toHaveLength(1);
  expect(data.labour_items[0]._page).toBe(2);
  expect(findings).toEqual([]);
});
```

- [ ] **Step 6: Run, expect FAIL**

Run: `npx vitest run src/lib/ai/__tests__/processor-flow.test.ts -t "answered as a list"`
Expected: FAIL — `data['0']` is defined and `labour_items` is undefined.

- [ ] **Step 7: Wire it in.** In `processor.ts`, import `asFragment` with `mergeAIResults`. Change the two parse sites to `asFragment(JSON.parse(rawResponse))` (line 518) and `asFragment(JSON.parse(singleResp))` (line 535). In `gap-fill.ts:66`, change to `tagRows(asFragment(JSON.parse(raw)), p, p)` and import from `./merge-results`.

- [ ] **Step 8: Run the AI suite, expect PASS**

Run: `npx vitest run src/lib/ai`
Expected: all pass, including the new flow test.

- [ ] **Step 9: Commit**

```bash
git add src/lib/ai/merge-results.ts src/lib/ai/processor.ts src/lib/ai/gap-fill.ts src/lib/ai/__tests__/merge-results.test.ts src/lib/ai/__tests__/processor-flow.test.ts
git commit -m "fix(ai): keep a page's rows when the model answers with a list"
```

---

### Task 2: Record which model read the document

**Files:**
- Modify: `src/lib/ai/processor.ts` (`extractDocument`: collect models; both `return` sites)
- Modify: `src/lib/ai/__tests__/processor-flow.test.ts` (extend test `(a)`)

**Interfaces:**
- Consumes: `session.lastGood?.model`. The real `callAIGateway` sets it on success, and the test mock sets it to `'test-model'`.
- Produces: `data._models: string[]` on every `extractDocument` result. These are the distinct models that answered, in first-use order. It is `['row-parser']` on the parser path. It is stored in the claim via `setExtractedData`; `stripPageTags` keeps it. No UI reads it in this plan.

- [ ] **Step 1: Extend test (a)** with `expect(data._models).toEqual(['test-model']);`

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/ai/__tests__/processor-flow.test.ts -t "clean read"`
Expected: FAIL — `_models` is undefined.

- [ ] **Step 3: Implement.**
  - In `extractDocument`, add a `const usedModels = new Set<string>()`.
  - After every successful `callAIGateway` in `runAllChunks` (including the 413 page-at-a-time and auto-split calls), add `session.lastGood?.model` when it is set. The second-opinion pass goes through `runAllChunks` too.
  - Return `data: { ...finalResult, _models: [...usedModels] }` at the AI return (around line 735).
  - Return `_models: ['row-parser']` merged into `data` at the parser return (line 409).

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/ai src/stores`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/processor.ts src/lib/ai/__tests__/processor-flow.test.ts
git commit -m "feat(ai): record which model read each document"
```

---

## After this plan: the order of the remaining fixes

Each item below changes what the surveyor sees or prints, so each needs the Bill Check design doc first, then its own plan. They are listed in the order I'd do them, by harm in the MH40BG5830 run.

| # | Fix | Evidence (MH40BG5830) | Why it waits for the design |
|---|---|---|---|
| 3 | A match on words only never writes a Ref No.; it shows as a suggestion | 51 wrong refs. 50 were flagged doubtful but **still print** (`uiic-final-builder.ts:692`) | Changes what prints, and how billed amounts fill in a normal (estimate-based) claim |
| 4 | The invoice parser keeps the "Labor Code" column as `part_number` | Invoice prints "PAID 14202103", but the parser drops it, so 50 labour rows have no code | A parser change; needs a corpus snapshot run |
| 5 | Match labour on the first 6 characters of the code | Estimate 43111**097** against invoice 43111**003**; same operation | Rule may be BharatBenz-only; decide the confidence tier |
| 6 | A repeated part number shares one Ref No. (the ref only, never amounts) | 6 rows missed: cable ties, rust cleaner, vent line, brake adjuster | Sharing amounts would double-count billed figures |
| 7 | Near part number **plus** same description becomes a suggestion | 24 one-character-off pairs; only 2 were misreads (68, 69). 5514 and 5517 are different screws. | Never auto-filled; needs the review panel |
| 8 | Comparison slots (Final bill / Estimate 1 / Estimate 2) and refs like "E1-301 / E2-43" | Uploading an estimate in the bill slot overwrites billed amounts | New upload UI and data shape |
| 9 | Bottom panel with two tabs: "Without ref" and "Bill lines not in assessment" | Owner request | UI |
| 10 | Scan prompt for this task only | Reading was already good (2 misreads in 300 rows) | Lowest value; revisit only with new evidence |
