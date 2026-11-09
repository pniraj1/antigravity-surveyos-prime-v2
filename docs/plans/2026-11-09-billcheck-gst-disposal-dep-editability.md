# Bill Check GST, Disposal & Depreciation Editability Implementation Plan

> **For Claude / Agent:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make GST%, Disposal (Yes/No + %), and Depreciation% fully editable in the Bill Check tab matching the Assessment tab, synchronize billed taxable calculations with statutory GST, and ensure Bill Check reports (UIIC and Standard) accurately reflect any edited allowance, GST, disposal, or depreciation overrides.

**Architecture:** 
1. In `src/components/tabs/bill-check/config.ts`, include `disposal` in `OptionalColumn`, `OPTIONAL_COLUMN_ORDER`, and `DEFAULT_VISIBLE`.
2. In `src/components/tabs/bill-check/BillCheckGrid.tsx`:
   - Replace static GST `<div>` with `FormulaNumericInput`, updating `row.gst` and syncing `billedAmount` from `row.billedTaxable`.
   - Add the `disposal` column with a toggle checkbox and disposal percentage input. Unchecking disposal restores statutory GST (e.g. 18%) and removes the 50% salvage cut.
   - Replace static Dep% `<div>` with an interactive number input for `depOverride`.
3. In `src/lib/reports/uiic-final-builder.ts` and `src/lib/reports/standard-report-builder.ts`:
   - When in bill-check mode, compute row assessed basis using `r.billAllowed ?? r.assessed`.
   - Ensure GST bands, Price+GST, and net liabilities strictly calculate on the effective assessed and GST values.
4. Add comprehensive unit tests in Vitest covering grid interactions and report outputs.

**Tech Stack:** TypeScript, React, Next.js 16, Zustand, Vitest.

---

### Task 1: Bill Check Grid Column Configuration for Disposal

**Files:**
- Modify: `src/components/tabs/bill-check/config.ts`
- Test: `src/components/tabs/__tests__/BillCheckGridEditability.test.tsx`

**Step 1: Write the failing test**
Create `src/components/tabs/__tests__/BillCheckGridEditability.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { OPTIONAL_COLUMNS, DEFAULT_VISIBLE, COL_WIDTHS } from '../bill-check/config';

describe('BillCheck Column Configuration', () => {
  it('includes disposal in optional columns and default visible', () => {
    const keys = OPTIONAL_COLUMNS.map(c => c.key);
    expect(keys).toContain('disposal');
    expect(DEFAULT_VISIBLE.disposal).toBe(true);
    expect(COL_WIDTHS.disposal).toBe('110px');
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/tabs/__tests__/BillCheckGridEditability.test.tsx`
Expected: FAIL (disposal not in `OPTIONAL_COLUMNS` / `DEFAULT_VISIBLE`).

**Step 3: Modify `src/components/tabs/bill-check/config.ts`**
1. Add `'disposal'` to `OptionalColumn` union type:
```typescript
export type OptionalColumn =
  | 'partNumber'
  | 'hsnSac'
  | 'section'
  | 'quantity'
  | 'unitPrice'
  | 'gst'
  | 'disposal'
  | 'priceWithGst'
  | 'billedTaxable'
  | 'refSrNo'
  | 'remarks';
```
2. Add `'disposal'` to `OPTIONAL_COLUMN_ORDER` right after `'gst'`.
3. Add `disposal: true` to `DEFAULT_VISIBLE`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/tabs/__tests__/BillCheckGridEditability.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/tabs/bill-check/config.ts src/components/tabs/__tests__/BillCheckGridEditability.test.tsx
git commit -m "feat(bill-check): add disposal column to bill check grid configuration"
```

---

### Task 2: Make GST, Disposal, and Dep% Editable in `BillCheckGrid.tsx`

**Files:**
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx`
- Test: `src/components/tabs/__tests__/BillCheckGridEditability.test.tsx`

**Step 1: Write tests for GST, Disposal, and Dep% editing**
Add tests in `src/components/tabs/__tests__/BillCheckGridEditability.test.tsx`:
- Test that GST input renders and calls `updateAssessmentRow` with new GST and updated `billedAmount`.
- Test that Disposal checkbox renders, toggles `isDisposal`, and adjusts default GST appropriately.
- Test that Dep% input renders, allows setting `depOverride`, and clearing override.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/tabs/__tests__/BillCheckGridEditability.test.tsx`
Expected: FAIL.

**Step 3: Update `BillCheckGrid.tsx`**
1. Update `buildCols()`:
```typescript
const detailCols = (['partNumber', 'hsnSac', 'section', 'quantity', 'unitPrice', 'gst', 'disposal'] as OptionalColumn[])
  .filter(k => visible[k]).map(k => COL_WIDTHS[k]);
```
2. Header:
Render `{visible.disposal && <span>{GRID_COLUMNS.disposal.label}</span>}` after `{visible.gst}`.
3. Subtotals / Totals rows:
Render `{visible.disposal && <div />}` in both `subtotalRow` and `totalsRow`.
4. Table Rows:
- **GST Cell**:
```tsx
{visible.gst && (
  <div className="flex items-center justify-center">
    <FormulaNumericInput
      integerOnly
      value={row.isDisposal ? 0 : (row.gst ?? 18)}
      onChange={(val) => {
        const gst = Math.max(0, val);
        const updates: Partial<AssessmentRow> = { gst };
        if (row.billedTaxable !== undefined) {
          updates.billedAmount = Math.round(row.billedTaxable * (1 + gst / 100));
        }
        updateAssessmentRow(row.id, updates);
      }}
      className="h-7 w-12 text-[11px] text-center border-transparent hover:border-input focus:bg-background px-0 font-medium"
      placeholder="18"
      min={0}
      max={100}
    />
  </div>
)}
```
- **Disposal Cell**:
```tsx
{visible.disposal && (
  <div className="flex items-center justify-center gap-1">
    <input
      type="checkbox"
      checked={!!row.isDisposal}
      onChange={(e) => {
        const isDisposal = e.target.checked;
        updateAssessmentRow(row.id, {
          isDisposal,
          ...(isDisposal ? { gst: 0 } : (row.gst === 0 ? { gst: 18 } : {})),
        });
      }}
      className="h-3.5 w-3.5 cursor-pointer rounded accent-amber-500 shrink-0"
      title="Disposal / Used Part (No GST)"
    />
    {row.isDisposal && (
      <Input
        type="number"
        value={row.disposalPercent ?? 50}
        onChange={(e) => updateAssessmentRow(row.id, { disposalPercent: parseFloat(e.target.value) || 0 })}
        className="h-6 w-10 text-[11px] text-center px-0 font-medium bg-background"
        style={{ borderColor: 'var(--color-status-warning)', color: 'var(--color-status-warning)' }}
        min={0}
        max={100}
        title="Disposal percentage (default 50%)"
      />
    )}
  </div>
)}
```
- **Dep% Cell**:
```tsx
<div className="flex items-center justify-center">
  {row.allowed ? (
    <input
      type="number"
      min={0}
      max={100}
      step={1}
      value={row.depOverride !== undefined ? row.depOverride : depRateFor(row)}
      onChange={e => {
        const raw = e.target.value;
        const autoRate = depRateFor({ ...row, depOverride: undefined });
        if (raw === '') {
          updateAssessmentRow(row.id, { depOverride: undefined });
        } else {
          const v = Math.min(100, Math.max(0, Number(raw)));
          updateAssessmentRow(row.id, { depOverride: v === autoRate ? undefined : v });
        }
      }}
      className={`w-12 text-center text-[11px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-[var(--color-status-warning)] ${
        row.depOverride !== undefined
          ? 'bg-[var(--color-status-warning-tint)] border-[var(--color-status-warning)] text-[var(--color-status-warning)]'
          : 'bg-transparent border-transparent text-danger hover:border-input'
      }`}
      title={row.depOverride !== undefined ? `Auto: ${depRateFor({ ...row, depOverride: undefined })}% — Click to clear override` : `Auto rate: ${depRateFor(row)}%`}
    />
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  )}
</div>
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/tabs/__tests__/BillCheckGridEditability.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/tabs/bill-check/BillCheckGrid.tsx src/components/tabs/__tests__/BillCheckGridEditability.test.tsx
git commit -m "feat(bill-check): make gst, disposal and depOverride editable in BillCheckGrid"
```

---

### Task 3: Bill Check Reports (UIIC and Standard) Allowance & GST Integration

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts`
- Modify: `src/lib/reports/standard-report-builder.ts`
- Test: `src/lib/reports/__tests__/bill-check-report.test.ts`
- Test: `src/lib/reports/__tests__/standard-bill-check.test.ts`

**Step 1: Write the failing tests**
In `src/lib/reports/__tests__/bill-check-report.test.ts`:
- Add test verifying that when a row has `billAllowed: 8000` (against original assessed 10000) and `gst: 28`, the UIIC Bill Check report item table and GST summary bands calculate on ₹8,000 with 28% GST.
- Add test verifying that when an item had `isDisposal: true` but is changed to `isDisposal: false` with `gst: 18`, GST is properly levied and not suppressed.

In `src/lib/reports/__tests__/standard-bill-check.test.ts`:
- Add test verifying that in Standard Bill Check report, `billAllowed` and updated `gst` are correctly rendered in Column 3 (`Assessed ₹`), Column 9 (`GST%`), and Column 10 (`Price+GST ₹`).

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/reports/__tests__/bill-check-report.test.ts src/lib/reports/__tests__/standard-bill-check.test.ts`
Expected: FAIL.

**Step 3: Update Report Builders**
1. In `src/lib/reports/uiic-final-builder.ts`:
   - Define row projection helper for bill-check rows:
     ```typescript
     const asBillRow = (r: AssessmentRow): AssessmentRow => ({
       ...r,
       assessed: r.billAllowed !== undefined ? r.billAllowed : r.assessed,
     });
     ```
   - Use `asBillRow(r)` in `billedParts`, `billedLabour`, `billedPaint` so all aggregates (`partsAgg`, `labourAgg`, `paintAgg`, `serviceAgg`, `gross`, `net`) and table item rows calculate from the surveyor's active allowance.
2. In `src/lib/reports/standard-report-builder.ts`:
   - When `isBillCheck` is true, map rows with `asBillRow`:
     ```typescript
     const effectiveRow = (r: AssessmentRow) => isBillCheck && r.billAllowed !== undefined ? { ...r, assessed: r.billAllowed } : r;
     ```
   - In Section 9, render `m9(effectiveRow(r).assessed)` under `Assessed ₹`, and compute `computeRowNet(effectiveRow(r), dep)` and `priceGst`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/reports/__tests__/bill-check-report.test.ts src/lib/reports/__tests__/standard-bill-check.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/standard-report-builder.ts src/lib/reports/__tests__/bill-check-report.test.ts src/lib/reports/__tests__/standard-bill-check.test.ts
git commit -m "fix(reports): ensure bill-check reports reflect billAllowed and updated gst"
```

---

### Task 4: Full Test Suite, Type Check, and KnowledgeBase Documentation

**Files:**
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`
- Create: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-11-09-billcheck-gst-disposal-dep-editability.md`

**Step 1: Run type checking**
Run: `npx tsc --noEmit`
Expected: 0 errors.

**Step 2: Run complete test suite**
Run: `npm test -- --run`
Expected: All tests pass.

**Step 3: Document changes**
- Update `Tasks.md` with completed task.
- Update `Changelog.md` with feature entry.
- Create session log in `Sessions/`.

**Step 4: Commit**
```bash
git add SurveyOS-Antigravity-Prime-V2-KnowledgeBase/
git commit -m "docs: record billcheck gst, disposal and dep editability session"
```
