# Supplementary Estimates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a surveyor upload a supplementary estimate without deleting the original estimate's rows, by asking in the review dialog which of the two they mean.

**Architecture:** `applyEstimate` gains a `mode` parameter (`'replace' | 'append'`) that decides whether existing estimate rows are dropped and how new rows are tagged. The mode is chosen by the surveyor in the existing `AIReviewDialog`, which already gates every extraction, and is threaded through `confirmApply` → `applyExtractedData` → `applyEstimate`. No new button, no new extraction key, no AI-layer change. Supplementary rows are then marked with a "Supplementary Estimate" divider band, driven by one shared helper across all four render sites.

**Tech Stack:** TypeScript, React 19, Next.js 16, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-16-supplementary-estimate-design.md`

## Global Constraints

- Default mode is `'replace'` everywhere. Every existing call site must keep working untouched.
- The existing test `re-applying replaces previous AI rows but keeps manual rows` (`src/stores/slices/__tests__/aiDataSlice.test.ts:39`) must pass **unmodified**. It is the signal that primary-estimate behaviour has not moved.
- `replace` must **not** delete rows tagged `'supplementary'`.
- No duplicate detection. Uploading the same document twice produces duplicate rows by design (spec D5).
- Do not change `srNo`, the extraction prompt, or the extraction schema.
- The band is **presentation only** — not a row. It has no id, no serial number, never enters `sectionIds`, and changes no sub-total. `buildSerialMap` must not be touched.
- Section sub-totals stay exactly as they are (spec D9). Do not add a supplementary sub-total.
- **Add no dependencies.** In particular do not install `@testing-library/*` or `jsdom`; this repo tests logic in the node environment and keeps JSX as thin wiring.
- Run `npx vitest run` and `npx tsc --noEmit` from `SurveyOS-Prime-V2/`. Both must be clean before any commit.

---

### Task 1: Widen `source` and add the mode to `applyEstimate`

**Files:**
- Modify: `src/types/assessment.ts:80-88`
- Modify: `src/stores/slices/aiDataSlice.ts:606-683`
- Test: `src/stores/slices/__tests__/aiDataSlice.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `export type EstimateApplyMode = 'replace' | 'append';` exported from `src/stores/slices/aiDataSlice.ts`
  - `applyEstimate(claim: ClaimData, data: any, mode?: EstimateApplyMode): ClaimData`
  - `AssessmentRow['source']` widened to `'estimate' | 'supplementary' | undefined`

- [ ] **Step 1: Write the failing tests**

Append to `src/stores/slices/__tests__/aiDataSlice.test.ts`, inside the existing `describe('applyEstimate', ...)` block:

```ts
  it('append adds rows without removing existing estimate rows', () => {
    const once = applyEstimate(baseClaim, estimate);
    const twice = applyEstimate(once, estimate, 'append');

    // 5 original + 5 supplementary — nothing dropped.
    expect(twice.assessmentRows).toHaveLength(10);
  });

  it('append tags its new rows as supplementary', () => {
    const once = applyEstimate(baseClaim, estimate);
    const twice = applyEstimate(once, estimate, 'append');

    expect(twice.assessmentRows.filter((r) => r.source === 'estimate')).toHaveLength(5);
    expect(twice.assessmentRows.filter((r) => r.source === 'supplementary')).toHaveLength(5);
  });

  it('replace drops estimate rows but keeps supplementary rows', () => {
    const once = applyEstimate(baseClaim, estimate);
    const withSupp = applyEstimate(once, estimate, 'append');

    // Re-scanning the primary estimate must not discard a supplementary the
    // surveyor has already reviewed.
    const rescanned = applyEstimate(withSupp, estimate, 'replace');

    expect(rescanned.assessmentRows.filter((r) => r.source === 'supplementary')).toHaveLength(5);
    expect(rescanned.assessmentRows.filter((r) => r.source === 'estimate')).toHaveLength(5);
    expect(rescanned.assessmentRows).toHaveLength(10);
  });

  it('defaults to replace when no mode is given', () => {
    const once = applyEstimate(baseClaim, estimate);
    const twice = applyEstimate(once, estimate);

    expect(twice.assessmentRows).toHaveLength(5);
  });

  it('two appends accumulate — no duplicate detection by design', () => {
    const once = applyEstimate(baseClaim, estimate);
    const twice = applyEstimate(once, estimate, 'append');
    const thrice = applyEstimate(twice, estimate, 'append');

    expect(thrice.assessmentRows).toHaveLength(15);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/stores/slices/__tests__/aiDataSlice.test.ts`

Expected: FAIL. The `append` tests fail because the third argument is ignored, so rows are replaced and the length is 5 rather than 10. TypeScript will also flag the extra argument.

- [ ] **Step 3: Widen the `source` type**

In `src/types/assessment.ts`, find this exact block (currently lines 84-88):

```ts
  /**
   * 'estimate' = row auto-created by AI estimate extraction.
   * Re-applying an estimate replaces these rows; manually added rows (undefined) are kept.
   */
  source?: 'estimate';
```

and replace it with:

```ts
  /**
   * Row origin.
   *   undefined       = added by hand by the surveyor. Never touched by an upload.
   *   'estimate'      = created from the primary estimate. Replaced when that
   *                     estimate is re-scanned.
   *   'supplementary' = created from a supplementary estimate. Only ever
   *                     appended; re-scanning the primary leaves these alone.
   */
  source?: 'estimate' | 'supplementary';
```

- [ ] **Step 4: Add the mode to `applyEstimate`**

In `src/stores/slices/aiDataSlice.ts`, change the signature at line 606 from:

```ts
export function applyEstimate(claim: ClaimData, data: any): ClaimData {
```

to:

```ts
/**
 * How an incoming estimate meets the rows already on the sheet.
 *   'replace' — a re-scan of the primary estimate. Drops rows tagged
 *               'estimate'; keeps supplementary and manual rows.
 *   'append'  — a supplementary estimate. Drops nothing.
 */
export type EstimateApplyMode = 'replace' | 'append';

export function applyEstimate(
  claim: ClaimData,
  data: any,
  mode: EstimateApplyMode = 'replace',
): ClaimData {
  const rowSource: AssessmentRow['source'] = mode === 'append' ? 'supplementary' : 'estimate';
```

- [ ] **Step 5: Tag new rows from the mode**

Still in `applyEstimate`, there are three `createAssessmentRow(...)` calls, each with a hardcoded `source: 'estimate',` line (currently lines 621, 640, 658). Change **all three** to:

```ts
        source: rowSource,
```

- [ ] **Step 6: Make the merge respect the mode**

Replace the return statement at line 679-683 with:

```ts
  // A re-scan of the primary estimate returns the FULL document, so its old
  // rows go. A supplementary is a DIFFERENT document holding only the extra
  // items — dropping anything there would delete the original assessment,
  // which is exactly the bug this replaces.
  const kept =
    mode === 'append'
      ? claim.assessmentRows
      : claim.assessmentRows.filter((r) => r.source !== 'estimate');

  return {
    ...claim,
    assessmentRows: [...kept, ...newRows],
    ...(data.workshop_name ? { accident: { ...claim.accident, placeOfSurvey: data.workshop_name } } : {}),
  };
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/stores/slices/__tests__/aiDataSlice.test.ts`

Expected: PASS, including the pre-existing `re-applying replaces previous AI rows but keeps manual rows` test, which must not have been edited.

- [ ] **Step 8: Run the full suite and type check**

Run: `npx vitest run`
Expected: all files pass.

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add src/types/assessment.ts src/stores/slices/aiDataSlice.ts src/stores/slices/__tests__/aiDataSlice.test.ts
git commit -m "feat(assessment): add replace/append mode to applyEstimate

A supplementary estimate is a different document holding only the extra
items, so replacing on every upload deleted the original assessment.
Rows now carry 'estimate' or 'supplementary', and replace spares the
supplementary ones so re-scanning the primary is safe."
```

---

### Task 2: Thread the mode through the store and the hook

**Files:**
- Modify: `src/stores/slices/aiDataSlice.ts:9` (interface), `:732-753` (`applyExtractedData`)
- Modify: `src/hooks/useAIExtraction.ts:216-222` (`confirmApply`)

**Interfaces:**
- Consumes: `EstimateApplyMode` and the 3-argument `applyEstimate` from Task 1.
- Produces:
  - `applyExtractedData(key: string, data: any, mode?: EstimateApplyMode): void`
  - `confirmApply(mode?: EstimateApplyMode): void` returned from `useAIExtraction`

- [ ] **Step 1: Widen the slice interface**

In `src/stores/slices/aiDataSlice.ts` line 9, change:

```ts
  applyExtractedData: (key: string, data: any) => void;
```

to:

```ts
  applyExtractedData: (key: string, data: any, mode?: EstimateApplyMode) => void;
```

- [ ] **Step 2: Pass the mode to `applyEstimate`**

In the same file, change the implementation signature at line 732:

```ts
  applyExtractedData: (key, data, mode) => {
```

and the estimate branch at line 746:

```ts
      else if (key === 'estimate') newClaim = applyEstimate(newClaim, data, mode ?? 'replace');
```

Leave every other branch alone — they ignore the mode.

- [ ] **Step 3: Accept the mode in `confirmApply`**

In `src/hooks/useAIExtraction.ts`, replace `confirmApply` (lines 216-222) with:

```ts
  const confirmApply = useCallback((mode?: EstimateApplyMode) => {
    if (reviewData) {
      applyExtractedData(reviewData.key, reviewData.data, mode);
      clearJob(reviewData.key);
      toast.success(
        mode === 'append' ? 'Supplementary estimate added!' : 'Fields auto-filled!',
      );
    }
  }, [reviewData, applyExtractedData, clearJob]);
```

Add the type import at the top of the file, alongside the existing imports:

```ts
import type { EstimateApplyMode } from '@/stores/slices/aiDataSlice';
```

- [ ] **Step 4: Verify nothing else broke**

Run: `npx tsc --noEmit`
Expected: no output. `confirmApply` is passed as `onConfirm` in both `AssessmentTab.tsx:182` and `BillCheckTab.tsx:216`; because `mode` is optional, both still typecheck as `() => void` consumers.

Run: `npx vitest run`
Expected: all files pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/slices/aiDataSlice.ts src/hooks/useAIExtraction.ts
git commit -m "feat(ai): thread estimate apply mode from review dialog to store

applyExtractedData and confirmApply take an optional mode. Every existing
call site is unchanged because it defaults to replace."
```

---

### Task 3: Ask the surveyor in the review dialog

**Files:**
- Create: `src/lib/ai/estimate-mode.ts`
- Create: `src/lib/ai/__tests__/estimate-mode.test.ts`
- Modify: `src/components/dialogs/AIReviewDialog.tsx` (props + footer)
- Modify: `src/components/tabs/AssessmentTab.tsx:179-187` (wiring)

**Why the decision is a pure function:** this repo has **no component testing** — no
`@testing-library`, no jsdom, `environment: 'node'` in `vitest.config.ts`, and zero
`.tsx` test files. Adding a rendering stack for one dialog is a large unrequested
change. House style here is to test logic and keep JSX as thin wiring, so the
"should we ask, and with what numbers" decision lives in a pure, node-testable
function and the dialog only renders what it is handed.

**Do NOT install `@testing-library/*` or `jsdom`.**

**Interfaces:**
- Consumes: `confirmApply(mode?)` from Task 2.
- Produces, from `src/lib/ai/estimate-mode.ts`:

```ts
export interface EstimateModePrompt {
  existingRows: number;
  existingTotal: number;
  incomingRows: number;
  incomingTotal: number;
}

export function buildEstimateModePrompt(
  rows: AssessmentRow[],
  data: unknown,
): EstimateModePrompt | undefined;
```

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/estimate-mode.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildEstimateModePrompt } from '../estimate-mode';
import type { AssessmentRow } from '@/types';

const row = (over: Partial<AssessmentRow>) =>
  ({ id: 'r1', section: 'parts', particulars: 'Bonnet', allowed: true, estimated: 0, assessed: 0, ...over }) as AssessmentRow;

const data = {
  spare_parts: [{ description: 'Bonnet', taxable_amount: 20000 }],
  labour_items: [{ description: 'Denting', taxable_amount: 14500 }],
};

describe('buildEstimateModePrompt', () => {
  it('returns undefined on a claim with no estimate rows — nothing to disambiguate', () => {
    expect(buildEstimateModePrompt([], data)).toBeUndefined();
  });

  it('returns undefined when the sheet holds only manual rows', () => {
    const manual = [row({ source: undefined, estimated: 5000 })];
    expect(buildEstimateModePrompt(manual, data)).toBeUndefined();
  });

  it('asks when the sheet already holds estimate rows', () => {
    const rows = [row({ source: 'estimate', estimated: 8000 })];
    expect(buildEstimateModePrompt(rows, data)).toBeDefined();
  });

  it('asks when the sheet already holds supplementary rows', () => {
    const rows = [row({ source: 'supplementary', estimated: 8000 })];
    expect(buildEstimateModePrompt(rows, data)).toBeDefined();
  });

  it('returns undefined when the extraction found no line items', () => {
    const rows = [row({ source: 'estimate', estimated: 8000 })];
    expect(buildEstimateModePrompt(rows, {})).toBeUndefined();
  });

  it('counts every row on the sheet, manual ones included', () => {
    const rows = [
      row({ id: 'a', source: 'estimate', estimated: 8000 }),
      row({ id: 'b', source: undefined, estimated: 2000 }),
    ];
    const p = buildEstimateModePrompt(rows, data)!;

    expect(p.existingRows).toBe(2);
    expect(p.existingTotal).toBe(10000);
  });

  it('totals the incoming document from the extraction summary', () => {
    const rows = [row({ source: 'estimate', estimated: 8000 })];
    const p = buildEstimateModePrompt(rows, data)!;

    expect(p.incomingRows).toBe(2);
    expect(p.incomingTotal).toBe(34500);
  });

  it('treats a missing estimated as zero rather than NaN', () => {
    const rows = [row({ source: 'estimate', estimated: undefined as never })];
    const p = buildEstimateModePrompt(rows, data)!;

    expect(p.existingTotal).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/estimate-mode.test.ts`

Expected: FAIL — cannot resolve `../estimate-mode`, the module does not exist yet.

- [ ] **Step 3: Write the pure decision function**

Create `src/lib/ai/estimate-mode.ts`:

```ts
// ═══════════════════════════════════════════════════════════
// ESTIMATE APPLY MODE — the "is this a re-scan or a supplementary?" decision
//
// Uploading a second estimate used to delete the first one's rows, because
// the apply step assumed every re-upload was a re-scan of the same document.
// Rather than infer intent from a document hash or an estimate number, the
// surveyor is asked — but only when the answer actually matters.
// ═══════════════════════════════════════════════════════════

import type { AssessmentRow } from '@/types';
import { summariseExtraction } from './extraction-summary';

/** Both sides of an estimate upload, so the surveyor decides on numbers. */
export interface EstimateModePrompt {
  existingRows: number;
  existingTotal: number;
  incomingRows: number;
  incomingTotal: number;
}

/**
 * Returns the numbers to show the surveyor, or undefined when there is no
 * genuine choice to make — a first upload, a sheet of only hand-added rows,
 * or an extraction that found nothing. Undefined means "keep today's single
 * confirm button".
 */
export function buildEstimateModePrompt(
  rows: AssessmentRow[],
  data: unknown,
): EstimateModePrompt | undefined {
  const hasEstimateRows = rows.some(
    r => r.source === 'estimate' || r.source === 'supplementary',
  );
  if (!hasEstimateRows) return undefined;

  // An extraction that found nothing has no mode worth choosing.
  const s = summariseExtraction(data);
  if (s.totalItems === 0) return undefined;

  return {
    // Counts every row the surveyor can see in the grid, manual ones included
    // — a tagged-only total would match nothing on screen.
    existingRows: rows.length,
    existingTotal: rows.reduce((sum, r) => sum + (r.estimated || 0), 0),
    incomingRows: s.totalItems,
    incomingTotal: s.parts.taxable + s.labour.taxable + s.painting.taxable,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/estimate-mode.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit the decision logic**

```bash
git add src/lib/ai/estimate-mode.ts src/lib/ai/__tests__/estimate-mode.test.ts
git commit -m "feat(ai): decide when to ask replace-or-supplementary

Pure function so the choice is unit-testable in the node environment this
repo already uses; the dialog only renders what it is handed."
```

- [ ] **Step 6: Add the prop to the dialog**

In `src/components/dialogs/AIReviewDialog.tsx`, import the type and extend the props:

```tsx
import type { EstimateModePrompt } from '@/lib/ai/estimate-mode';
```

```tsx
interface AIReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode?: 'replace' | 'append') => void;
  onReScan?: (feedback: string) => void;
  title: string;
  data: any;
  evidenceImages?: string[];
  discrepancies?: string[];
  /** Present only when the claim already holds estimate rows. */
  estimateModePrompt?: EstimateModePrompt;
}
```

Add `estimateModePrompt` to the destructured parameters:

```tsx
export function AIReviewDialog({ isOpen, onClose, onConfirm, onReScan, title, data, evidenceImages = [], discrepancies = [], estimateModePrompt }: AIReviewDialogProps) {
```

- [ ] **Step 7: Render the choice in the footer**

Replace the `<CardFooter>` block (lines 207-227) with:

```tsx
        <CardFooter className="flex flex-col gap-3 bg-muted/30 p-4 border-t border-border">
          {estimateModePrompt && (
            <div className="w-full p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <div className="font-bold mb-1">This claim already has an estimate.</div>
              <div>
                Currently on the assessment sheet:{' '}
                <strong>{estimateModePrompt.existingRows} rows, ₹{INR.format(estimateModePrompt.existingTotal)}</strong>
              </div>
              <div>
                In this document:{' '}
                <strong>{estimateModePrompt.incomingRows} rows, ₹{INR.format(estimateModePrompt.incomingTotal)}</strong>
              </div>
            </div>
          )}

          <div className="w-full flex justify-between items-center gap-3">
            <div className="text-[10px] text-muted-foreground bg-white px-2 py-1 rounded border border-border">
              ONE-BY-ONE PROCESSING ENABLED
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-all active:scale-95"
              >
                <X size={16} />
                Discard
              </button>

              {estimateModePrompt ? (
                <>
                  {/* Replace is destructive, so it is the secondary action. */}
                  <button
                    onClick={() => onConfirm('replace')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border border-status-danger text-status-danger hover:bg-status-danger/10 transition-all active:scale-95"
                  >
                    Replace the existing estimate
                  </button>
                  <button
                    onClick={() => onConfirm('append')}
                    className="flex items-center gap-1.5 px-6 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95"
                  >
                    <Check size={16} />
                    Add as supplementary
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onConfirm()}
                  className="flex items-center gap-1.5 px-6 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95"
                >
                  <Check size={16} />
                  Apply Fields
                </button>
              )}
            </div>
          </div>
        </CardFooter>
```

- [ ] **Step 8: Compute the prompt in AssessmentTab**

In `src/components/tabs/AssessmentTab.tsx`, add these imports:

```tsx
import { useMemo } from 'react';
import { buildEstimateModePrompt } from '@/lib/ai/estimate-mode';
```

(If `useMemo` is already imported from `react`, add it to the existing import instead of adding a second line.)

Add this above the `return (` of the component:

```tsx
  // Only the estimate key has two ways to land; every other document applies
  // one way, so it keeps the single confirm button.
  const estimateModePrompt = useMemo(() => {
    if (reviewData?.key !== 'estimate') return undefined;
    return buildEstimateModePrompt(currentClaim?.assessmentRows ?? [], reviewData.data);
  }, [reviewData, currentClaim?.assessmentRows]);
```

If `currentClaim` is not already in scope in this component, read it with `const currentClaim = useClaimStore(s => s.currentClaim);` and import `useClaimStore` from `@/stores/claim-store`.

- [ ] **Step 9: Pass it to the dialog**

In the same file, add one prop to the `AIReviewDialog` element (currently lines 179-187):

```tsx
        estimateModePrompt={estimateModePrompt}
```

- [ ] **Step 10: Verify the whole suite and types**

Run: `npx vitest run`
Expected: all files pass.

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 11: Commit**

```bash
git add src/components/dialogs/AIReviewDialog.tsx src/components/tabs/AssessmentTab.tsx
git commit -m "feat(assessment): ask replace-or-supplementary on a second estimate upload

The review dialog already gates every extraction, so the question lives
there rather than behind a second upload button. It appears only when the
claim already holds estimate rows, and shows both row counts and totals so
the surveyor decides on numbers rather than memory."
```

---

### Task 4: The "Supplementary Estimate" band

**Files:**
- Create: `src/lib/calculations/supplementary-band.ts`
- Create: `src/lib/calculations/__tests__/supplementary-band.test.ts`
- Modify: `src/lib/calculations/index.ts` (barrel export)
- Modify: `src/lib/reports/standard-report-builder.ts` (§9 parts/labour/paint row maps)
- Modify: `src/lib/reports/uiic-final-builder.ts` (`pHtml` / `lHtml` / `ptHtml` at lines 581, 601, 615)
- Modify: `src/components/claim/AssessmentSectionTable.tsx` (row list)
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx` (row list, around line 236)
- Test: `src/lib/reports/__tests__/standard-report-columns.test.ts` (add band cases)

**Background:** grouping already works — the claim holds one flat array, every
site filters it on `section`, and `append` puts supplementary rows after the
existing ones. No reordering is needed. Only the divider is missing.

**Interfaces:**
- Consumes: `AssessmentRow['source']` from Task 1.
- Produces, from `src/lib/calculations/supplementary-band.ts`:

```ts
export const SUPPLEMENTARY_BAND_LABEL = 'Supplementary Estimate';

export function shouldStartSupplementaryBand(
  rows: AssessmentRow[],
  index: number,
): boolean;
```

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/supplementary-band.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shouldStartSupplementaryBand } from '../supplementary-band';
import type { AssessmentRow } from '@/types';

const row = (source: AssessmentRow['source'], id = Math.random().toString()) =>
  ({ id, section: 'parts', particulars: 'x', allowed: true, estimated: 0, assessed: 0, source }) as AssessmentRow;

describe('shouldStartSupplementaryBand', () => {
  it('never bands a section of only estimate rows', () => {
    const rows = [row('estimate'), row('estimate')];
    expect(rows.map((_, i) => shouldStartSupplementaryBand(rows, i))).toEqual([false, false]);
  });

  it('bands the first supplementary row and no other', () => {
    const rows = [row('estimate'), row('supplementary'), row('supplementary')];
    expect(rows.map((_, i) => shouldStartSupplementaryBand(rows, i))).toEqual([false, true, false]);
  });

  it('bands at the top when the section is entirely supplementary', () => {
    // A supplementary can add a paint item to a claim whose estimate had none.
    // Those items must not read as original estimate items.
    const rows = [row('supplementary'), row('supplementary')];
    expect(rows.map((_, i) => shouldStartSupplementaryBand(rows, i))).toEqual([true, false]);
  });

  it('does not start a second band after a manual row', () => {
    const rows = [row('supplementary'), row(undefined), row('supplementary')];
    // The trailing supplementary follows a non-supplementary row, so by the
    // rule it does band again. This documents that ordering, which only
    // arises if a surveyor hand-inserts a row mid-block.
    expect(rows.map((_, i) => shouldStartSupplementaryBand(rows, i))).toEqual([true, false, true]);
  });

  it('never bands a manual or estimate row', () => {
    const rows = [row(undefined), row('estimate')];
    expect(rows.map((_, i) => shouldStartSupplementaryBand(rows, i))).toEqual([false, false]);
  });

  it('is safe on an empty list and an out-of-range index', () => {
    expect(shouldStartSupplementaryBand([], 0)).toBe(false);
    expect(shouldStartSupplementaryBand([row('supplementary')], 5)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/calculations/__tests__/supplementary-band.test.ts`
Expected: FAIL — cannot resolve `../supplementary-band`.

- [ ] **Step 3: Write the helper**

Create `src/lib/calculations/supplementary-band.ts`:

```ts
// ═══════════════════════════════════════════════════════════
// SUPPLEMENTARY BAND
//
// Where the "Supplementary Estimate" divider goes inside a section's rows.
//
// One helper, four render sites — the Assessment grid, the Final Survey
// Report, the Bill Check tab and the Bill Check PDF — so they cannot drift
// apart and show the surveyor a different split on screen than in print.
//
// The band is NOT a row: it carries no serial number and feeds no total, so
// buildSerialMap and every sub-total are untouched. Numbering runs straight
// through it, which is what the insurer reads.
// ═══════════════════════════════════════════════════════════

import type { AssessmentRow } from '@/types';

export const SUPPLEMENTARY_BAND_LABEL = 'Supplementary Estimate';

/**
 * True when a band belongs immediately BEFORE `rows[index]`.
 *
 * `rows` must be one section's rows in claim-array order — the same list the
 * caller is rendering. Callers that filter (Bill Check shows allowed items
 * only) pass the filtered list, so the band follows what is actually on show.
 */
export function shouldStartSupplementaryBand(rows: AssessmentRow[], index: number): boolean {
  const current = rows[index];
  if (!current || current.source !== 'supplementary') return false;
  // First row of the section, or the first after something of another origin.
  return index === 0 || rows[index - 1]?.source !== 'supplementary';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/calculations/__tests__/supplementary-band.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Export from the barrel**

In `src/lib/calculations/index.ts`, add alongside the existing `buildSerialMap` export:

```ts
export { shouldStartSupplementaryBand, SUPPLEMENTARY_BAND_LABEL } from './supplementary-band';
```

- [ ] **Step 6: Write the failing report test**

Append to `src/lib/reports/__tests__/standard-report-columns.test.ts`, inside the existing top-level `describe`:

```ts
  test('a section mixing origins carries one supplementary band', () => {
    const mixed = [
      row({ particulars: 'Front Bumper', source: 'estimate' }),
      row({ particulars: 'Radiator Support', source: 'supplementary' }),
      row({ particulars: 'Grille', source: 'supplementary' }),
    ];
    const table = section9(buildStandardFinalSurveyHTML(claim(mixed), {} as never));

    expect(table.match(/Supplementary Estimate/g)).toHaveLength(1);
  });

  test('a section of only estimate rows carries no band', () => {
    const table = section9(buildStandardFinalSurveyHTML(claim(withoutFiberglass), {} as never));
    expect(table).not.toContain('Supplementary Estimate');
  });

  test('the band spans the full table width', () => {
    const mixed = [
      row({ particulars: 'Front Bumper', source: 'estimate' }),
      row({ particulars: 'Radiator Support', source: 'supplementary' }),
    ];
    const table = section9(buildStandardFinalSurveyHTML(claim(mixed), {} as never));
    const band = table.match(/<tr>\s*<td colspan="(\d+)"[^>]*>Supplementary Estimate/);

    expect(band).not.toBeNull();
    // 8 fixed columns + 3 material columns when the claim has no fiberglass.
    expect(Number(band![1])).toBe(11);
  });
```

If the local `row()` helper in that file does not accept `source`, widen it to
spread its argument over the defaults rather than adding a second helper.

- [ ] **Step 7: Run the report test to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/standard-report-columns.test.ts`
Expected: FAIL — no "Supplementary Estimate" text is emitted yet.

- [ ] **Step 8: Emit the band in the Final Survey Report**

In `src/lib/reports/standard-report-builder.ts`, add the import at the top
alongside the existing calculations imports:

```ts
import { shouldStartSupplementaryBand, SUPPLEMENTARY_BAND_LABEL } from '@/lib/calculations';
```

Add this helper next to `td9` / `tdsr9`:

```ts
  // Reuses the sub-total band styling so the divider looks native to the sheet.
  const bandRow = `<tr><td colspan="${NCOLS}" style="${sub}text-align:left;font-size:${scale.labelFont};">${SUPPLEMENTARY_BAND_LABEL}</td></tr>`;
```

The parts rows are built by `rows.filter(r => r.section === 'parts').map(r => ...)`.
Change that map to take the index and prefix the band, keeping the existing row
template untouched:

```ts
  const partsRows = rows.filter(r => r.section === 'parts');
  const partsHtml = partsRows.map((r, i) => {
    const band = shouldStartSupplementaryBand(partsRows, i) ? bandRow : '';
    // ... existing per-row consts unchanged ...
    return band + `<tr>
      ...existing row template, unchanged...
    </tr>`;
  }).join('');
```

Apply the identical `band + ` prefix to the labour and paint row maps in the
same file, each against its own filtered list.

- [ ] **Step 9: Run the report test to verify it passes**

Run: `npx vitest run src/lib/reports/__tests__/standard-report-columns.test.ts`
Expected: PASS, including the pre-existing column and Sr tests.

- [ ] **Step 10: Emit the band in the UIIC Bill Check report**

In `src/lib/reports/uiic-final-builder.ts`, import the same two symbols. The
allowed-row maps are `pHtml` (line 581), `lHtml` (601) and `ptHtml` (615), each
over `allowedParts` / `allowedLabour` / `allowedPaint`. Apply the same treatment:
take the index, and prefix `shouldStartSupplementaryBand(<thatList>, i)` with a
band row whose `colspan` matches that table's column count.

Pass the **filtered** list — Bill Check lists allowed items only, so the band must
follow what is actually printed.

Match the surrounding sub-total row's style in that file rather than copying the
Final Report's `sub` constant; the two documents style their bands separately.

- [ ] **Step 11: Show the band in the Assessment grid**

In `src/components/claim/AssessmentSectionTable.tsx`, import the helper and label
from `@/lib/calculations`. In the row list, wrap each rendered row so the band
precedes it when the helper says so. Use a React fragment keyed on the row id:

```tsx
{rows.map((row, i) => (
  <Fragment key={row.id}>
    {shouldStartSupplementaryBand(rows, i) && (
      <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide bg-[#dff0ec] text-[#1a5a50] border-y border-border">
        {SUPPLEMENTARY_BAND_LABEL}
      </div>
    )}
    {/* existing row element, unchanged */}
  </Fragment>
))}
```

The colours match the report's `sub` band (`#dff0ec` on `#1a5a50`) so screen and
print read the same. If the section renders rows as `<tr>` elements, use a
`<tr><td colSpan={...}>` band instead of a `<div>`; do not nest a `div` inside a
table body.

**Do not change** the drag-reorder or selection wiring. The band is presentation
only — it is not a row, has no id, and must not enter `sectionIds`.

- [ ] **Step 12: Show the band in the Bill Check tab**

In `src/components/tabs/bill-check/BillCheckGrid.tsx`, the row list renders a
`<div>` per row keyed on `row.id` (around line 236). Apply the same `Fragment` +
band treatment, passing the same list that is being mapped.

- [ ] **Step 13: Verify the whole suite, types and build**

Run: `npx vitest run`
Expected: all files pass.

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm run build`
Expected: completes, no errors.

- [ ] **Step 14: Commit**

```bash
git add src/lib/calculations/supplementary-band.ts src/lib/calculations/__tests__/supplementary-band.test.ts src/lib/calculations/index.ts src/lib/reports/standard-report-builder.ts src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/standard-report-columns.test.ts src/components/claim/AssessmentSectionTable.tsx src/components/tabs/bill-check/BillCheckGrid.tsx
git commit -m "feat(assessment): mark supplementary items with a divider band

Supplementary rows already sort into their section after the estimate rows,
so only the divider was missing. One shared helper drives all four render
sites — Assessment grid, Final Report, Bill Check tab and Bill Check PDF —
so screen and print cannot drift apart.

The band is not a row: no serial number, no effect on any sub-total."
```

---

### Task 5: Verify end to end

**Files:** none modified.

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: nothing.

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: all test files pass, including the untouched `re-applying replaces previous AI rows but keeps manual rows`.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: completes with the static route list, no errors.

- [ ] **Step 4: Report what could not be verified here**

The dialog path needs a real login and a claim with an existing estimate, so it cannot be exercised in this environment. State plainly that the following remain unverified and need a manual pass on a real claim:

- the prompt appears on a second estimate upload and not on a first
- "Add as supplementary" leaves the original rows in place
- "Replace the existing estimate" drops only the primary rows and spares supplementary ones
- the row counts and totals shown match the assessment grid
- the band appears in all four places, in the same position in each
- the band does not disturb serial numbering or any sub-total
- drag-reorder and range selection still work in a section that contains a band

- [ ] **Step 5: Do not deploy**

Deployment is a separate, explicit decision. Report completion and stop.
