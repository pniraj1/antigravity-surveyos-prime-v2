# Bill Check Mode and Labour Wording — Plan 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In a claim whose assessment was built from the bill (UIIC), uploading the estimate in Bill Check fills only the estimate item numbers. It never damages billed figures, and no row prints "No Bill". Labour and paint rows also get their number when the wording is identical.

**Architecture:**
- One saved choice, `billCheck.baseDocument`, says what Bill Check uploads are. A small pure module (`bill-check-mode.ts`) turns that choice into row updates.
- The existing upload path (`'final-bill'` extraction key, `applyFinalBill`), link and unlink, and the print gate each ask that module which behaviour applies.
- The matcher gains one wording pass for labour and paint.
- No new extraction key, no new document type, no new AI call.

**Tech Stack:** TypeScript, React (Next.js 16), Zustand slices, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-bill-check-reference-finder-design.md`, sections D0, D4, D4a and D6 (as decided 2026-11-15). D1–D3, D5 and D10 are already live and must keep working.

## Global Constraints
- Commit to `main` (`master` is abandoned). End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No new dependencies. No new AI calls. Free-tier BYOK unaffected.
- A blank beats a wrong number: nothing is written to Ref No. without an exact part number, exact labour/paint wording, or the surveyor's own act.
- In from-bill mode (`billCheck.baseDocument === 'final-bill'`), an upload never writes `billedTaxable`, `billedAmount`, `billStatus`, `billRemarks`, `billCheck.billNo`, `billCheck.billDate` or `billCheck.billTotal` from the uploaded document.
- "Self-billed" figures in from-bill mode: `billedTaxable = row.estimated`, `billedAmount = Math.round(row.estimated * (1 + (row.gst ?? 18) / 100))`, `billStatus = 'in-bill'`. These are the bill's figures, since the bill is what the estimate column was read from. The grid's manual "In Bill" uses `assessed`; that's normal mode and stays as it is.
- Labour and paint wording key: `s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()`; equal keys match. Parts are never matched by wording.
- Prime ↔ Scan: the `'final-bill'` key, `DOC_TYPE` mapping (`'final-bill': 'invoice'`), labels and folder layout are unchanged. Only the prompt text in `prompts.ts` changes, which isn't a coupling point. Impact on Scan: none.
- Run tests from the repo root: `npx vitest run <path>`.

## Review Focus
1. **A claim already damaged by an earlier estimate upload** (MH40BG5830: billed figures overwritten with estimate prices). Switching to Estimate puts every allowed row back to its own figures (Task 1 test `selfBillUpdates repairs figures an estimate upload overwrote`).
2. **Switching back to Final bill by mistake.** The surveyor is asked before billed figures and refs are cleared. Nothing changes on Cancel (Task 2 test plus Task 8 confirm).
3. **A row allowed after the switch** (ticked in the Assessment tab later) is pending. The print gate bills it at its own figures and never marks it No Bill (Task 6 test).
4. **More pages of the same estimate ("continue") in from-bill mode.** Rows that already hold a ref keep it, and only the rest are matched. Every row is self-billed, so "billed > 0" can't be the skip test there (Task 3 test).
5. **Generic repeated labour wording** ("LABOUR CHARGES" on two rows and two lines) pairs in serial order like repeated part numbers, and a labour row that has a part number is never wording-matched (Task 5 tests).

---

### Task 1: Mode helpers

**Files:**
- Create: `src/lib/reports/bill-check-mode.ts`
- Test: `src/lib/reports/__tests__/bill-check-mode.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RowUpdate { id: string; updates: Partial<AssessmentRow> }   // re-export the one in ref-paste.ts; do not define a second
  export function isFromBill(claim: { billCheck?: { baseDocument?: string } } | null | undefined): boolean;
  /** The row billed at its own figures (from-bill mode). */
  export function selfBilled(row: AssessmentRow): Pick<AssessmentRow, 'billedTaxable' | 'billedAmount' | 'billStatus'>;
  /** Allowed rows whose billed figures are not their own figures yet. */
  export function selfBillUpdates(rows: AssessmentRow[]): RowUpdate[];
  /** Bill no. / date / total from the Estimate-tab read, only where the field is empty. */
  export function billHeaderFromEstimate(claim: ClaimData): Partial<BillCheckDetails>;
  ```
- `billHeaderFromEstimate` reads `claim.extractedData?.estimate`: `bill_number` → `billNo`, `estimate_date` → `billDate`, `gross_amount` → `billTotal`, each only when `claim.billCheck` has no value there. It returns `{}` when nothing applies.

- [ ] **Step 1: Write the failing tests**

```ts
describe('bill-check-mode', () => {
  it('isFromBill reads baseDocument', () => {
    expect(isFromBill({ billCheck: { baseDocument: 'final-bill' } })).toBe(true);
    expect(isFromBill({ billCheck: { baseDocument: 'estimate' } })).toBe(false);
    expect(isFromBill(null)).toBe(false);
  });
  it('selfBilled uses the estimated figure and the row GST', () =>
    expect(selfBilled(row({ estimated: 1000, gst: 28 }))).toEqual({ billedTaxable: 1000, billedAmount: 1280, billStatus: 'in-bill' }));
  it('selfBillUpdates skips disallowed rows and rows already at their own figures', () => {
    const done = row({ id: 'a', estimated: 100, gst: 18, billedTaxable: 100, billedAmount: 118, billStatus: 'in-bill' });
    const off = row({ id: 'b', allowed: false });
    expect(selfBillUpdates([done, off])).toEqual([]);
  });
  it('selfBillUpdates repairs figures an estimate upload overwrote', () => {
    const hurt = row({ id: 'c', estimated: 5000, gst: 18, billedTaxable: 4200, billedAmount: 4956, billStatus: 'in-bill' });
    expect(selfBillUpdates([hurt])).toEqual([{ id: 'c', updates: { billedTaxable: 5000, billedAmount: 5900, billStatus: 'in-bill' } }]);
  });
  it('billHeaderFromEstimate fills only empty fields', () => {
    const c = { billCheck: { billNo: 'KEEP', billDate: '', billTotal: 0 },
      extractedData: { estimate: { bill_number: 'INV-9', estimate_date: '2026-06-03', gross_amount: 250000 } } } as unknown as ClaimData;
    expect(billHeaderFromEstimate(c)).toEqual({ billDate: '2026-06-03', billTotal: 250000 });
  });
});
```

Use a `row(overrides)` helper like the one in `src/stores/slices/__tests__/apply-final-bill.test.ts` (allowed, parts, gst 18, estimated 10000).

- [ ] **Step 2: Run, expect FAIL.** Run `npx vitest run src/lib/reports/__tests__/bill-check-mode.test.ts`. Expected: FAIL, because the module doesn't exist yet.
- [ ] **Step 3: Implement the four functions** in `src/lib/reports/bill-check-mode.ts`.
- [ ] **Step 4: Run, expect PASS.** Same command. Expected: 5 passed.
- [ ] **Step 5: Commit** with `feat(bill-check): mode helpers for claims built from the bill`.

---

### Task 2: Choosing what Bill Check uploads

**Files:**
- Modify: `src/stores/slices/claimSlice.ts`. Add next to `updateBillCheck` (around line 425) and to the slice interface (around line 59).
- Test: `src/stores/slices/__tests__/claimSlice.test.ts`

**Interfaces:**
- Consumes: `selfBillUpdates`, `billHeaderFromEstimate`, `isFromBill` (Task 1).
- Produces: `setBillCheckUpload(kind: 'final-bill' | 'estimate'): void` on the claim store.
  - `'estimate'` sets `billCheck.baseDocument = 'final-bill'`, applies `selfBillUpdates` to the rows, and merges `billHeaderFromEstimate`.
  - `'final-bill'` sets `baseDocument = 'estimate'`. If the claim was in from-bill mode, it clears `refSrNo`, `refStatus` and `refMatch` on every row, and on allowed rows also `billedTaxable` and `billedAmount`, with `billStatus` set to `'pending'`. There was no real bill read, so all of it came from the estimate mode.
  - It's one store write either way. The confirmation is the UI's job (Task 8).

- [ ] **Step 1: Write the failing tests** in `claimSlice.test.ts`, using the store the way that file already does:
  - `setBillCheckUpload('estimate')` → `baseDocument === 'final-bill'`, an allowed row with `estimated 1000, gst 18` has `billedAmount 1180, billStatus 'in-bill'`, and an empty `billNo` is filled from `extractedData.estimate.bill_number`.
  - Then `setBillCheckUpload('final-bill')` → `baseDocument === 'estimate'`, that row has `billStatus 'pending'` and `billedAmount` and `refSrNo` are undefined.
  - `setBillCheckUpload('final-bill')` on a normal claim (never from-bill) leaves rows untouched.
- [ ] **Step 2: Run, expect FAIL.** Run `npx vitest run src/stores/slices/__tests__/claimSlice.test.ts`. Expected: the new tests fail because `setBillCheckUpload` isn't a function.
- [ ] **Step 3: Implement `setBillCheckUpload`.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(bill-check): choose whether Bill Check uploads the bill or the estimate`.

---

### Task 3: An estimate upload fills only the ref

**Files:**
- Modify: `src/stores/slices/aiDataSlice.ts`: `applyFinalBill` (around lines 632–730) and `buildBillModePrompt` (around line 762).
- Test: `src/stores/slices/__tests__/apply-final-bill.test.ts`

**Interfaces:**
- Consumes: `isFromBill`, `selfBillUpdates` (Task 1).
- Produces:
  - `applyFinalBill` behaves as follows when `isFromBill(claim)`:
    - a matched row gets only `refSrNo`, `refStatus` and `refMatch`, for allowed and disallowed rows alike, with no `'not-allowed'` status or remark;
    - `billCheck.billNo`, `billDate` and `billTotal` stay as they were;
    - `selfBillUpdates` is applied after matching;
    - in `'continue'` mode, the rows excluded from matching are those with a `refSrNo`, not those with `billedAmount > 0`;
    - extras are merged as today, so the surveyor can still Link by hand.
  - `buildBillModePrompt(claim)` in from-bill mode returns `{ billNo: '', billedRows: <rows with refSrNo> }`, or `null` when there are none.
  - Normal mode is unchanged.

- [ ] **Step 1: Write the failing tests** (`fromBill = (c) => ({ ...c, billCheck: { baseDocument: 'final-bill', billNo: 'B-REAL', billDate: '2026-05-01', billTotal: 99999 } })`):
  - **"an estimate upload writes the ref but not the billed figures":** a row with `estimated 10000, gst 18` and part `BP-1` gets `refSrNo` from `BILL`'s BP-1 line, plus `billedTaxable 10000`, `billedAmount 11800` (its own figures), not the line's.
  - **"an estimate upload leaves the bill no., date and total"**: they equal `B-REAL` / `2026-05-01` / `99999` after `applyFinalBill(fromBill(claim([r])), BILL)`.
  - **"a disallowed row matched by an estimate gets only the ref":** `billStatus` stays undefined and `billRemarks` stays undefined.
  - **"continue in from-bill mode keeps refs already set and matches the rest":** row A has `refSrNo '7'` and status `clean`; row B has part `RD-9` and no ref. After `applyFinalBill(…, BILL, 'continue')`, A still has `'7'` and B has RD-9's serial.
  - **"buildBillModePrompt counts rows with refs in from-bill mode".**
- [ ] **Step 2: Run, expect FAIL.** Run `npx vitest run src/stores/slices/__tests__/apply-final-bill.test.ts`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.** Also run `npx vitest run src/stores/slices/__tests__` to confirm no normal-mode test changed.
- [ ] **Step 5: Commit** with `feat(bill-check): an estimate upload fills only Ref No. in claims built from the bill`.

---

### Task 4: Link and Unlink touch only the ref in from-bill mode

**Files:**
- Modify: `src/stores/slices/assessmentSlice.ts`: `linkExtraBillItem` (around line 254) and `unlinkBillMatch` (around line 295).
- Modify: `src/components/tabs/bill-check/ExtraBillItemsPanel.tsx`: add a prop `canPromote: boolean`; the promote button renders only when true.
- Modify: `src/components/tabs/BillCheckTab.tsx`: pass `canPromote={!isFromBill(currentClaim)}`.
- Test: `src/stores/slices/__tests__/extra-bill-actions.test.ts`

**Interfaces:**
- Consumes: `isFromBill` (Task 1).
- Produces:
  - In from-bill mode, `linkExtraBillItem` writes only `refSrNo`, `refStatus: 'manual'` and `refMatch`. It writes no billed fields and no "Linked from bill" remark. Displaced lines still return to the extras.
  - `unlinkBillMatch` clears only `refSrNo`, `refStatus` and `refMatch`; billed figures and status stay. Held lines still return.
  - Normal mode is unchanged.

- [ ] **Step 1: Write the failing tests:**
  - "link in from-bill mode keeps the row's billed figures";
  - "unlink in from-bill mode keeps the row's billed figures and status".
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement, including the panel prop.**
- [ ] **Step 4: Run, expect PASS.** Run `npx vitest run src/stores/slices/__tests__/extra-bill-actions.test.ts src/components/tabs/__tests__`.
- [ ] **Step 5: Commit** with `feat(bill-check): estimate links never touch billed figures`.

---

### Task 5: Labour and paint matched by exact wording

**Files:**
- Modify: `src/stores/slices/aiDataSlice.ts`: `matchBillItemsToRows` (around line 267), plus the `BillMatch.reason` type (around line 200), which gains `'words'`.
- Test: `src/stores/slices/__tests__/bill-matcher.test.ts`

**Interfaces:**
- Produces: after the part-number pass, a second pass over the rows not yet matched and the lines not yet used.
  - Only rows and lines in section `'labour'` or `'paint'` that **both** have no part number (`normPart` empty).
  - Grouped by `section + wording key` (Global Constraints).
  - Paired with the same D2 rules as part numbers: allowed first, serial order, `also` for one row with several lines, `refOnly` for extra rows.
  - Match fields: `reason: 'words'`, `reasons: ['Same wording']`, `score: 100`, `ambiguous: false`.

- [ ] **Step 1: Write the failing tests:**
  - "identical labour wording matches, ignoring case and punctuation": row `FRONT BUMPER R&R` (labour) matches line `front bumper r & r` (labour).
  - "different wording stays unmatched": `R/R BUMPER FRT` vs `BUMPER FRONT REMOVE & REFIT`.
  - "parts are never matched by wording": the same description, section `parts`, no part numbers → no match.
  - "a labour row with a part number is not wording-matched".
  - "repeated labour wording pairs in serial order": two `LABOUR CHARGES` rows (srNo 3, 9) and two lines (srNo 20, 41) → 3↔20, 9↔41.
  - "a line used by a part-number match is not reused by wording".
- [ ] **Step 2: Run, expect FAIL.** Run `npx vitest run src/stores/slices/__tests__/bill-matcher.test.ts`.
- [ ] **Step 3: Implement**, reusing the existing `group` / `bySerial` helpers with a wording key in place of `normPart`.
- [ ] **Step 4: Run, expect PASS.** Also run `npx vitest run src/stores/slices/__tests__/apply-final-bill.test.ts`.
- [ ] **Step 5: Commit** with `feat(bill-check): labour and paint lines matched by identical wording`.

---

### Task 6: The print gate never marks from-bill rows No Bill

**Files:**
- Modify: `src/hooks/useBillCheckPrintGate.tsx`: `rowsToMarkNotInBill` (line 22) and `resolveAllPending` (around line 141).
- Test: `src/hooks/__tests__/useBillCheckPrintGate.test.ts`

**Interfaces:**
- Consumes: `isFromBill`, `selfBillUpdates` (Task 1).
- Produces: `rowsToMarkNotInBill(rows, fromBill = false)` returns `[]` when `fromBill` is true. In from-bill mode, `resolveAllPending` applies `selfBillUpdates(claim.assessmentRows)` instead of marking rows not-in-bill.

- [ ] **Step 1: Write the failing test:** "rowsToMarkNotInBill marks nothing in a claim built from the bill". A pending allowed row with `fromBill = true` → `[]`. The existing normal-mode tests stay as they are.
- [ ] **Step 2: Run, expect FAIL.** Run `npx vitest run src/hooks/__tests__/useBillCheckPrintGate.test.ts`.
- [ ] **Step 3: Implement both changes.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `fix(bill-check): rows of a claim built from the bill never print No Bill`.

---

### Task 7: The Bill Check prompt reads bills and estimates, and copies part numbers exactly

**Files:**
- Modify: `src/lib/ai/prompts.ts`: the `'final-bill'` prompt (around line 186).
- Test: create `src/lib/ai/__tests__/prompts-final-bill.test.ts`, following `prompts-estimate.test.ts`.

**Exact copy changes:**
- The first line becomes: `You are an expert at reading Indian workshop documents: FINAL BILLS, TAX INVOICES and REPAIR ESTIMATES. Extract ALL line items from ALL pages.`
- In rule 4, delete the sentence `This is the NET amount and is the PRIMARY anchor for matching against the estimate.` Keep the rest of the rule.
- Rule 5 becomes: `5. "part_number": copy it EXACTLY as printed, character for character — same letters, digits, dashes and spaces. Never correct, complete or guess it; use "" if none is printed. Extract it for spare_parts ALWAYS, and for labour/paint when the document prints a code in a part-number or labour-code column.`
- The JSON shape doesn't change.

- [ ] **Step 1: Write the failing tests** on `getDocPrompt('final-bill')`:
  - it contains `REPAIR ESTIMATES` and `character for character`;
  - it doesn't contain `PRIMARY anchor`;
  - it still contains `"spare_parts"`, `"labour_items"` and `"painting_items"`.
- [ ] **Step 2: Run, expect FAIL.** Run `npx vitest run src/lib/ai/__tests__/prompts-final-bill.test.ts`.
- [ ] **Step 3: Edit the prompt.**
- [ ] **Step 4: Run, expect PASS.** Also run `npx vitest run src/lib/ai` to check no snapshot or prompt test breaks.
- [ ] **Step 5: Commit** with `feat(ai): Bill Check prompt reads estimates too and copies part numbers exactly`.

---

### Task 8: The choice on the upload panel

**Files:**
- Modify: `src/components/tabs/bill-check/BillCheckUploadPanel.tsx`. New props: `upload: 'final-bill' | 'estimate'` and `onUploadChange: (k: 'final-bill' | 'estimate') => void`.
- Modify: `src/components/tabs/BillCheckTab.tsx`. Pass `upload`, which is `'estimate'` when `isFromBill(currentClaim)` and `'final-bill'` otherwise. Wire `onUploadChange`. Pass `slotLabel` to `DocumentReviewSheet`.
- Modify: `src/hooks/useEstimateModePrompt.tsx` and `src/components/dialogs/EstimateModeDialog.tsx`. Add an optional `docWord?: 'bill' | 'estimate'` (default `'bill'`), used in the bill-kind texts. `confirmBillMode(fileLabel, docWord?)` passes it on.
- Test: `src/components/tabs/__tests__/BillCheckUploadPanel.test.tsx` (new, `renderToStaticMarkup` like `BillCheckGridEditability.test.tsx`).

**Behaviour and copy:**
- Above the upload box, two buttons in one row: **This upload is:** `Final bill` | `Estimate`. The chosen one is highlighted. Clicking the other calls `onUploadChange`.
- `BillCheckTab` behaviour when the choice changes:
  - Switching **to Final bill** while the claim is from-bill and any allowed row has a `refSrNo` or billed figures asks first, with `window.confirm`: `Switch to Final bill? The estimate numbers and billed amounts on {n} items will be cleared, because a final bill will now be read for them.` Cancel changes nothing.
  - Switching **to Estimate** needs no question. It sets every allowed item's billed amounts to its own figures (Task 1, `selfBillUpdates`), and touches no Ref No.
  - Either way, it then calls `setBillCheckUpload`.
- Texts when `upload === 'estimate'`:
  - title: `Step 1 — Upload the estimate`;
  - subtitle: `AI reads the estimate to find each item's estimate number`;
  - box: `Upload Estimate`, with `Image or PDF — AI reads every line`;
  - phone-file types: `['estimate']`;
  - review sheet `slotLabel`: `Estimate`;
  - mode dialog word: `estimate`.
- When `'final-bill'`, today's texts stay as they are.

- [ ] **Step 1: Write the failing test:**
  - the panel with `upload: 'estimate'` renders `Upload Estimate` and both choice labels;
  - with `upload: 'final-bill'` it renders `Upload Final Workshop Bill`.
- [ ] **Step 2: Run, expect FAIL.** Run `npx vitest run src/components/tabs/__tests__/BillCheckUploadPanel.test.tsx`.
- [ ] **Step 3: Implement the panel, the tab wiring and the dialog word.**
- [ ] **Step 4: Run, expect PASS.** Then run `npx tsc --noEmit -p .` and `npx vitest run src/components src/hooks`. Expected: no type errors, all pass.
- [ ] **Step 5: Commit** with `feat(bill-check): say on upload whether it is the final bill or the estimate`.

---

### Task 9: Ship

- [ ] **Step 1: Full suite.** Run `npx vitest run`, with output to a file in the SDD workspace, and read the tail. Expected: all pass (3031 before this plan, plus the new tests).
- [ ] **Step 2: Build.** Run `npm run build`. Expected: build completes.
- [ ] **Step 3: Deploy only when the owner says so.** Run `firebase deploy --only hosting --project surveyos-v2-antigravity-in`, then check that a live chunk on motorsurveyos-in.web.app and surveyos.in contains `Upload the estimate`.
- [ ] **Step 4: Record.**
  - Add a Changelog entry in the vault.
  - Update the `bill-match-score` memory.
  - Commit. Push only when the owner says so.
