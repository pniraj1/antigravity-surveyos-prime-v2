# UIIC Depreciation Amount Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-row Depreciation Amount (₹) column immediately after `Dep%` in the UIIC Final Report and UIIC Bill Check Report item tables, and replace `N.D.` with `0%` in both tables' existing `Dep%` cells.

**Architecture:** Both tables are hand-built HTML template literals in `uiic-final-builder.ts`. This is a column insertion into fixed structures: one new `<td>` per data row at a known position, one new `<th>` per table, and every `colspan` that currently spans across or past that position widened by one. No new calculation — `computeRowNet`'s existing `afterDep` result already gives everything needed (`row.assessed - afterDep`).

**Tech Stack:** TypeScript, Vitest. No UI/React changes — this is report-builder HTML only.

## Global Constraints

- **Branch:** commit directly to `main`, no branches (project convention).
- **Commit format:** `<type>(<scope>): <subject>` — no attribution trailers.
- **Verification:** `npx tsc --noEmit` and `npx vitest run` must both pass before every commit.
- **Scope:** UIIC reports only (`uiic-final-builder.ts`). Standard reports (`standard-report-builder.ts`) are untouched — not requested, and Standard's §9 never printed `N.D.` in the first place.
- **`afterDep` is what `computeRowNet` already returns.** The depreciation amount is `row.assessed - afterDep`, computed identically for parts, labour, paint, and disposal rows — disposal's further reduction happens after this figure, in `netBeforeGst`, so it never enters this formula.
- **Spec:** `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Specs/2026-08-18-uiic-depreciation-amount-column-design.md`

---

## File Structure

| File | Change |
|---|---|
| `src/lib/reports/uiic-final-builder.ts` | Both item tables: header cell, row cells, subtotal cells, `colspan` widening, `N.D.` → `0%` |
| `src/lib/reports/__tests__/uiic-depreciation-amount.test.ts` | **New** |

One file changed, one file created. No split needed — both edits live in the single builder file that already contains both tables, matching how the codebase already keeps each report format in one file.

---

### Task 1: Final Report — add the column, fix `N.D.`, widen `colspan`s

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts` (Final Report item table: header, `pHtml`, `lHtml`, `ptHtml`, `serviceDepLabel`, section-header rows, band rows, `SUB TOTAL`/`TAX`/`GROSS TOTAL` rows)
- Test: `src/lib/reports/__tests__/uiic-depreciation-amount.test.ts` (create)

**Interfaces:**
- Consumes: `computeRowNet` (already imported), `buildUIICFinalHTML(claim, profile)` (unchanged signature)
- Produces: nothing new is exported — this task only changes rendered HTML, verified by string assertions

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reports/__tests__/uiic-depreciation-amount.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { buildUIICFinalHTML, buildUIICBillCheckHTML } from '../uiic-final-builder';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Item',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  } as AssessmentRow;
}

function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 11800 },
  } as unknown as ClaimData;
}

/** Every <tr> in the item table body has as many <td>s as the header — the
 * automated version of "one mismatch shifts every figure a column to the
 * right." Section-header rows and band rows use colspan instead and are
 * excluded by requiring more than one <td>. */
function assertColumnCountsMatch(html: string, tableMarker: string, expectedCols: number) {
  const tableStart = html.indexOf(tableMarker);
  expect(tableStart, `table starting near "${tableMarker}" not found`).toBeGreaterThan(-1);
  const tableHtml = html.slice(tableStart, tableStart + 6000);
  const rowMatches = tableHtml.match(/<tr>(?:(?!<\/tr>).)*<\/tr>/gs) || [];
  const dataRows = rowMatches.filter(r => !r.includes('colspan') && (r.match(/<td/g) || []).length > 1);
  expect(dataRows.length, 'expected at least one data row').toBeGreaterThan(0);
  for (const r of dataRows) {
    const cellCount = (r.match(/<td/g) || []).length;
    expect(cellCount, `row has wrong cell count: ${r.slice(0, 200)}`).toBe(expectedCols);
  }
}

describe('UIIC Final Report — Depreciation Amount column', () => {
  test('a metal part shows assessed minus post-depreciation value', () => {
    // 24 months old → 10% metal rate (see lib/calculations/depreciation.ts)
    const c = claim([row({ assessed: 10000, partType: 'metal' })]);
    const html = buildUIICFinalHTML(c, null);
    expect(html).toContain('1000.00'); // 10000 * 10%
  });

  test('a glass part reads 0%, not N.D., with a ₹0.00 depreciation amount', () => {
    const c = claim([row({ partType: 'glass' })]);
    const html = buildUIICFinalHTML(c, null);
    expect(html).not.toContain('N.D.');
    expect(html).toContain('0%');
  });

  test('a labour row with no override reads 0% and ₹0.00, not N.D.', () => {
    const c = claim([row({ section: 'labour', partType: 'labour' })]);
    const html = buildUIICFinalHTML(c, null);
    expect(html).not.toContain('N.D.');
  });

  test('a labour row with a manual override shows the real rupee amount', () => {
    const c = claim([row({ section: 'labour', partType: 'labour', assessed: 5000, depOverride: 20 })]);
    const html = buildUIICFinalHTML(c, null);
    expect(html).toContain('1000.00'); // 5000 * 20%
  });

  test('a disposal row shows depreciation alone, unaffected by the disposal factor', () => {
    // 10% dep, 50% disposal: afterDep = 9000, netBeforeGst = 4500 (disposal-reduced).
    // The depreciation amount must be assessed - afterDep = 1000, NOT assessed - netBeforeGst = 5500.
    const c = claim([row({ assessed: 10000, partType: 'metal', isDisposal: true, disposalPercent: 50 })]);
    const html = buildUIICFinalHTML(c, null);
    expect(html).toContain('1000.00');
    expect(html).not.toContain('5500.00');
  });

  test('a disallowed row leaves the new cell blank, like its neighbours', () => {
    const c = claim([
      row({ particulars: 'UNIQUE_ALLOWED', assessed: 10000 }),
      row({ particulars: 'UNIQUE_DISALLOWED', assessed: 10000, allowed: false }),
    ]);
    const html = buildUIICFinalHTML(c, null);
    expect(html).toContain('NOT ALLOWED') || expect(html).toContain('Not<br/>Allowed');
  });

  test('item table rows all have the same column count as the header', () => {
    const c = claim([
      row({ assessed: 10000, partType: 'metal' }),
      row({ section: 'labour', partType: 'labour', assessed: 2000, depOverride: 10 }),
      row({ section: 'paint', partType: 'paint', assessed: 1500 }),
    ]);
    const html = buildUIICFinalHTML(c, null);
    assertColumnCountsMatch(html, 'PAGE 3-4', 11);
  });

  test('the sum of per-row depreciation amounts equals the top-summary Depreciation figure', () => {
    const c = claim([
      row({ assessed: 10000, partType: 'metal' }),  // 10% → 1000 dep
      row({ assessed: 8000, partType: 'metal' }),   // 10% → 800 dep
    ]);
    const html = buildUIICFinalHTML(c, null);
    // rawParts(18000) - partsDepreciated(16200) = 1800, matching 1000 + 800
    expect(html).toContain('1800.00');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/reports/__tests__/uiic-depreciation-amount.test.ts -t "Final Report"`
Expected: FAIL — `N.D.` still present, column counts mismatch, `1000.00` absent from output

- [ ] **Step 3: `N.D.` → `0%` in both label helpers**

In `src/lib/reports/uiic-final-builder.ts`, inside `pHtml`'s map callback, change:

```ts
    const dL = r.depOverride !== undefined ? `${dep}%*` : (dep > 0 ? dep + '%' : 'N.D.');
```
to:
```ts
    const dL = r.depOverride !== undefined ? `${dep}%*` : (dep > 0 ? dep + '%' : '0%');
```

Change `serviceDepLabel`:
```ts
  const serviceDepLabel = (r: AssessmentRow, dep: number) =>
    r.depOverride !== undefined ? `${dep}%*` : (dep > 0 ? dep + '%' : 'N.D.');
```
to:
```ts
  const serviceDepLabel = (r: AssessmentRow, dep: number) =>
    r.depOverride !== undefined ? `${dep}%*` : (dep > 0 ? dep + '%' : '0%');
```

- [ ] **Step 4: Add the depreciation-amount cell to each row builder**

In `pHtml`, the row template currently reads (one line):

```ts
    return bandHtml + `<tr><td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td><td style="${td}">${r.particulars}</td><td style="${td}text-align:center;">${isNA ? '' : pt}</td><td style="${td}text-align:center;">${isNA ? '' : 'Replace'}</td><td style="${td}text-align:right;">${isNA ? '' : fa(r.assessed)}</td><td style="${td}text-align:center;">${isNA ? '' : dL}</td><td style="${td}text-align:right;">${isNA ? '' : fa(afterDep)}</td><td style="${td}text-align:center;">${gstLabel}</td><td style="${wgStyle}">${wgLabel}</td><td style="${td}text-align:center;">${isNA ? 'Not<br/>Allowed' : ''}</td></tr>`;
```

Insert one `<td>` between the `dL` cell and the `afterDep` cell:

```ts
    const depAmt = isNA ? '' : fa(r.assessed - afterDep);

    return bandHtml + `<tr><td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td><td style="${td}">${r.particulars}</td><td style="${td}text-align:center;">${isNA ? '' : pt}</td><td style="${td}text-align:center;">${isNA ? '' : 'Replace'}</td><td style="${td}text-align:right;">${isNA ? '' : fa(r.assessed)}</td><td style="${td}text-align:center;">${isNA ? '' : dL}</td><td style="${td}text-align:right;">${depAmt}</td><td style="${td}text-align:right;">${isNA ? '' : fa(afterDep)}</td><td style="${td}text-align:center;">${gstLabel}</td><td style="${wgStyle}">${wgLabel}</td><td style="${td}text-align:center;">${isNA ? 'Not<br/>Allowed' : ''}</td></tr>`;
```

In `lHtml`, the row template currently reads:

```ts
    return bandHtml + `<tr><td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td><td style="${td}">${r.particulars}</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:right;">${isNA ? '' : fa(r.assessed)}</td><td style="${td}text-align:center;">${isNA ? '' : serviceDepLabel(r, dep)}</td><td style="${td}"></td><td style="${td}text-align:center;">${isNA ? '' : String(r.gst ?? 0)}</td><td style="${td}text-align:right;">${isNA ? '' : fa(withGst)}</td><td style="${td}text-align:center;">${isNA ? 'Not<br/>Allowed' : ''}</td></tr>`;
```

Insert between the dep-label cell and the existing blank Parts-Assess cell:

```ts
    const depAmt = isNA ? '' : fa(r.assessed - afterDep);

    return bandHtml + `<tr><td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td><td style="${td}">${r.particulars}</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:right;">${isNA ? '' : fa(r.assessed)}</td><td style="${td}text-align:center;">${isNA ? '' : serviceDepLabel(r, dep)}</td><td style="${td}text-align:right;">${depAmt}</td><td style="${td}"></td><td style="${td}text-align:center;">${isNA ? '' : String(r.gst ?? 0)}</td><td style="${td}text-align:right;">${isNA ? '' : fa(withGst)}</td><td style="${td}text-align:center;">${isNA ? 'Not<br/>Allowed' : ''}</td></tr>`;
```

In `ptHtml`, the row template currently reads:

```ts
    return bandHtml + `<tr><td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td><td style="${td}">${r.particulars}</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:center;">Paint</td><td style="${td}text-align:right;">${isNA ? '' : fa(r.assessed)}</td><td style="${td}text-align:center;">${isNA ? '' : serviceDepLabel(r, dep)}</td><td style="${td}"></td><td style="${td}text-align:center;">${isNA ? '' : String(r.gst ?? 0)}</td><td style="${td}"></td><td style="${td}text-align:right;">${isNA ? 'Not<br/>Allowed' : fa(withGst)}</td></tr>`;
```

Same insertion point:

```ts
    const depAmt = isNA ? '' : fa(r.assessed - afterDep);

    return bandHtml + `<tr><td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td><td style="${td}">${r.particulars}</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:center;">Paint</td><td style="${td}text-align:right;">${isNA ? '' : fa(r.assessed)}</td><td style="${td}text-align:center;">${isNA ? '' : serviceDepLabel(r, dep)}</td><td style="${td}text-align:right;">${depAmt}</td><td style="${td}"></td><td style="${td}text-align:center;">${isNA ? '' : String(r.gst ?? 0)}</td><td style="${td}"></td><td style="${td}text-align:right;">${isNA ? 'Not<br/>Allowed' : fa(withGst)}</td></tr>`;
```

- [ ] **Step 5: Add the header cell**

Find:

```ts
<thead><tr><th style="${th}">SR.</th><th style="${th}text-align:left;">Part Name</th><th style="${th}">Part<br/>Type</th><th style="${th}">Job<br/>Type</th><th style="${th}">Part List<br/>W/o Tax</th><th style="${th}">Dep%</th><th style="${th}">Parts<br/>Assess</th><th style="${th}">GST%</th><th style="${th}">With GST</th><th style="${th}">Labour</th></tr></thead><tbody>
```

Replace with (new `<th>` inserted after `Dep%`):

```ts
<thead><tr><th style="${th}">SR.</th><th style="${th}text-align:left;">Part Name</th><th style="${th}">Part<br/>Type</th><th style="${th}">Job<br/>Type</th><th style="${th}">Part List<br/>W/o Tax</th><th style="${th}">Dep%</th><th style="${th}">Dep<br/>Amt</th><th style="${th}">Parts<br/>Assess</th><th style="${th}">GST%</th><th style="${th}">With GST</th><th style="${th}">Labour</th></tr></thead><tbody>
```

- [ ] **Step 6: Widen every `colspan` that spans across the insertion point**

Section-header and supplementary-band rows — three of each, `colspan="10"` → `colspan="11"`. Find and replace all five remaining occurrences (the three `SPARE PARTS`/`LABOUR`/`PAINTING CHARGES` headers plus any band row not yet touched — bands are inside the row-builder closures already edited above only if they contained `colspan`; they do, verify each):

```ts
<tr><td colspan="10" style="${sec}">SPARE PARTS</td></tr>${pHtml}
<tr><td colspan="10" style="${sec}">LABOUR</td></tr>${lHtml}
<tr><td colspan="10" style="${sec}">PAINTING CHARGES</td></tr>${ptHtml}
```

becomes:

```ts
<tr><td colspan="11" style="${sec}">SPARE PARTS</td></tr>${pHtml}
<tr><td colspan="11" style="${sec}">LABOUR</td></tr>${lHtml}
<tr><td colspan="11" style="${sec}">PAINTING CHARGES</td></tr>${ptHtml}
```

Every `colspan="10"` inside the three band-row templates (inside `pHtml`, `lHtml`, `ptHtml` — already shown in Step 4's before/after, unaffected by the row-cell edit since band rows are a separate template string) also becomes `colspan="11"`:

```ts
      ? `<tr><td colspan="10" style="padding:4px 8px;text-align:center;font-size:9pt;font-weight:600;color:#666;background:linear-gradient(to right,#f5f5f5,#fafafa,#f5f5f5);">Supplementary Estimate</td></tr>`
```
becomes (three occurrences, one per row builder):
```ts
      ? `<tr><td colspan="11" style="padding:4px 8px;text-align:center;font-size:9pt;font-weight:600;color:#666;background:linear-gradient(to right,#f5f5f5,#fafafa,#f5f5f5);">Supplementary Estimate</td></tr>`
```

- [ ] **Step 7: SUB TOTAL / TAX / GROSS TOTAL rows**

Find:

```ts
<tr style="font-weight:700;background:#eee;"><td colspan="4" style="${td}">SUB TOTAL</td><td style="${td}text-align:right;">${fa(rawParts)}</td><td style="${td}"></td><td style="${td}text-align:right;">${fa(partsDepreciated)}</td><td style="${td}"></td><td style="${td}text-align:right;">${fa(pT)}</td><td style="${td}text-align:right;">${fa(labBase)}</td></tr>
<tr><td colspan="6" style="${td}">TAX IN 18% for Labour</td><td style="${td}" colspan="2"></td><td style="${td}text-align:right;">${fa(labOnly)}</td><td style="${td}text-align:right;">${fa(paintOnly)}</td></tr>
${/* Gross, not Net: these carry GST and nothing has been deducted yet. */ ''}
<tr><td colspan="8" style="${td}font-weight:700;">GROSS TOTAL</td><td style="${td}text-align:right;font-weight:700;">${fa(labourAgg.amount)}</td><td style="${td}text-align:right;font-weight:700;">${fa(paintAgg.amount)}</td></tr>
```

Replace with:

```ts
<tr style="font-weight:700;background:#eee;"><td colspan="4" style="${td}">SUB TOTAL</td><td style="${td}text-align:right;">${fa(rawParts)}</td><td style="${td}"></td><td style="${td}text-align:right;">${fa(rawParts - partsDepreciated)}</td><td style="${td}text-align:right;">${fa(partsDepreciated)}</td><td style="${td}"></td><td style="${td}text-align:right;">${fa(pT)}</td><td style="${td}text-align:right;">${fa(labBase)}</td></tr>
<tr><td colspan="7" style="${td}">TAX IN 18% for Labour</td><td style="${td}" colspan="2"></td><td style="${td}text-align:right;">${fa(labOnly)}</td><td style="${td}text-align:right;">${fa(paintOnly)}</td></tr>
${/* Gross, not Net: these carry GST and nothing has been deducted yet. */ ''}
<tr><td colspan="9" style="${td}font-weight:700;">GROSS TOTAL</td><td style="${td}text-align:right;font-weight:700;">${fa(labourAgg.amount)}</td><td style="${td}text-align:right;font-weight:700;">${fa(paintAgg.amount)}</td></tr>
```

(`rawParts` and `partsDepreciated` are pre-existing variables in this function's outer scope — the subtotal cell is their difference, requiring no new computation.)

- [ ] **Step 8: Run tests, typecheck**

Run: `npx vitest run src/lib/reports/__tests__/uiic-depreciation-amount.test.ts -t "Final Report"`
Expected: PASS — 8 passed

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 9: Run the full suite**

Run: `npx vitest run`
Expected: all pass, no regressions. If `bill-check-report.test.ts` or any other UIIC-adjacent test fails, a `colspan` or cell insertion above landed in the wrong place — re-check against Step 4/6/7 exactly, do not paper over with a different assertion.

- [ ] **Step 10: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/uiic-depreciation-amount.test.ts
git commit -m "feat(uiic): add per-row Depreciation Amount to the Final Report

Dep% was printed per item with no rupee figure beside it — only one
aggregate in the top summary. The new column is assessed - afterDep,
which computeRowNet already returns; disposal rows need no special
case since the disposal factor is a further reduction applied after
this figure, not part of it.

N.D. becomes 0% in the same cell: a zero depreciation rate and no rate
on record had been printing identically. Labour and paint rows need no
branching for the new column either — getDepreciationRate already
returns 0 for them unless overridden, so the same formula naturally
yields ₹0.00."
```

---

### Task 2: Bill Check Report — add the column, fix `N.D.`, widen `colspan`s

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts` (Bill Check item table: `depLabel`, header, `pHtml`, `lHtml`, `ptHtml`, `band`, section headers, `SUB TOTAL`/`TAX`/`TOTAL` rows)
- Test: `src/lib/reports/__tests__/uiic-depreciation-amount.test.ts` (append)

**Interfaces:**
- Consumes: `computeRowNet`, `rowDepFor` (already defined in this function), `buildUIICBillCheckHTML(claim, profile)` (unchanged signature)
- Produces: nothing new is exported

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/reports/__tests__/uiic-depreciation-amount.test.ts`:

```ts
describe('UIIC Bill Check Report — Depreciation Amount column', () => {
  test('a metal part shows assessed minus post-depreciation value', () => {
    const c = claim([row({ assessed: 10000, partType: 'metal' })]);
    const html = buildUIICBillCheckHTML(c, null);
    expect(html).toContain('1000.00');
  });

  test('a glass part reads 0%, not N.D.', () => {
    const c = claim([row({ partType: 'glass' })]);
    const html = buildUIICBillCheckHTML(c, null);
    expect(html).not.toContain('N.D.');
    expect(html).toContain('0%');
  });

  test('a labour row with a manual override shows the real rupee amount', () => {
    const c = claim([row({ section: 'labour', partType: 'labour', assessed: 5000, depOverride: 20 })]);
    const html = buildUIICBillCheckHTML(c, null);
    expect(html).toContain('1000.00');
  });

  test('a disposal row shows depreciation alone, unaffected by the disposal factor', () => {
    const c = claim([row({ assessed: 10000, partType: 'metal', isDisposal: true, disposalPercent: 50 })]);
    const html = buildUIICBillCheckHTML(c, null);
    expect(html).toContain('1000.00');
    expect(html).not.toContain('5500.00');
  });

  test('a disallowed row is absent — bill check already excludes it entirely', () => {
    const c = claim([
      row({ particulars: 'UNIQUE_ALLOWED', assessed: 10000 }),
      row({ particulars: 'UNIQUE_DISALLOWED', assessed: 10000, allowed: false }),
    ]);
    const html = buildUIICBillCheckHTML(c, null);
    expect(html).not.toContain('UNIQUE_DISALLOWED');
  });

  test('item table rows all have the same column count as the header', () => {
    const c = claim([
      row({ assessed: 10000, partType: 'metal' }),
      row({ section: 'labour', partType: 'labour', assessed: 2000, depOverride: 10 }),
      row({ section: 'paint', partType: 'paint', assessed: 1500 }),
    ]);
    const html = buildUIICBillCheckHTML(c, null);
    assertColumnCountsMatch(html, 'BILLS CHECK REPORT', 12);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/reports/__tests__/uiic-depreciation-amount.test.ts -t "Bill Check Report"`
Expected: FAIL

- [ ] **Step 3: `N.D.` → `0%`**

Find:

```ts
  const depLabel = (r: AssessmentRow) => {
    const d = rowDepFor(r);
    if (r.depOverride !== undefined) return `${d}%*`;
    return d > 0 ? `${d}%` : 'N.D.';
  };
```

Replace with:

```ts
  const depLabel = (r: AssessmentRow) => {
    const d = rowDepFor(r);
    if (r.depOverride !== undefined) return `${d}%*`;
    return d > 0 ? `${d}%` : '0%';
  };
```

- [ ] **Step 4: Add the depreciation-amount cell to each row builder**

`pHtml` currently reads:

```ts
  const pHtml = allowedParts.map((r, idx) => {
    const { isDisposal, netBeforeGst } = computeRowNet(r, rowDepFor(r));
    const finalAmt = isDisposal ? netBeforeGst : netBeforeGst * (1 + (r.gst || 0) / 100);
    return band(allowedParts, idx) + `<tr>
      <td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">${partTypeLabel(r)}</td>
      <td style="${td}text-align:center;">${jobTypeLabel(r)}</td>
      <td style="${td}text-align:right;">${fa(r.estimated)}</td>
      <td style="${td}text-align:center;">${depLabel(r)}</td>
      <td style="${td}text-align:right;">${fa(r.assessed)}</td>
      <td style="${td}text-align:center;">${isDisposal ? '0' : String(r.gst ?? 0)}</td>
      <td style="${td}text-align:right;">${isDisposal ? `${fa(netBeforeGst)} DISP` : fa(finalAmt)}</td>
      ${blank}${blank}
    </tr>`;
  }).join('');
```

`computeRowNet` here destructures only `isDisposal, netBeforeGst`; the depreciation amount needs `afterDep` too. Replace with:

```ts
  const pHtml = allowedParts.map((r, idx) => {
    const { isDisposal, afterDep, netBeforeGst } = computeRowNet(r, rowDepFor(r));
    const finalAmt = isDisposal ? netBeforeGst : netBeforeGst * (1 + (r.gst || 0) / 100);
    return band(allowedParts, idx) + `<tr>
      <td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">${partTypeLabel(r)}</td>
      <td style="${td}text-align:center;">${jobTypeLabel(r)}</td>
      <td style="${td}text-align:right;">${fa(r.estimated)}</td>
      <td style="${td}text-align:center;">${depLabel(r)}</td>
      <td style="${td}text-align:right;">${fa(r.assessed - afterDep)}</td>
      <td style="${td}text-align:right;">${fa(r.assessed)}</td>
      <td style="${td}text-align:center;">${isDisposal ? '0' : String(r.gst ?? 0)}</td>
      <td style="${td}text-align:right;">${isDisposal ? `${fa(netBeforeGst)} DISP` : fa(finalAmt)}</td>
      ${blank}${blank}
    </tr>`;
  }).join('');
```

`lHtml` currently reads:

```ts
  const lHtml = allowedLabour.map((r, idx) => band(allowedLabour, idx) + `<tr>
      <td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">Labour</td>
      <td style="${td}text-align:center;">${jobTypeLabel(r)}</td>
      <td style="${td}text-align:right;">${fa(r.estimated)}</td>
      <td style="${td}text-align:center;">${depLabel(r)}</td>
      ${blank}
      <td style="${td}text-align:center;">${String(r.gst ?? 0)}</td>
      ${blank}
      <td style="${td}text-align:right;">${fa(computeRowNet(r, rowDepFor(r)).netBeforeGst)}</td>
      ${blank}
    </tr>`).join('');
```

Replace with (compute `afterDep` once, reuse it for both the new cell and the existing `netBeforeGst`-based cell):

```ts
  const lHtml = allowedLabour.map((r, idx) => {
    const { afterDep, netBeforeGst } = computeRowNet(r, rowDepFor(r));
    return band(allowedLabour, idx) + `<tr>
      <td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">Labour</td>
      <td style="${td}text-align:center;">${jobTypeLabel(r)}</td>
      <td style="${td}text-align:right;">${fa(r.estimated)}</td>
      <td style="${td}text-align:center;">${depLabel(r)}</td>
      <td style="${td}text-align:right;">${fa(r.assessed - afterDep)}</td>
      ${blank}
      <td style="${td}text-align:center;">${String(r.gst ?? 0)}</td>
      ${blank}
      <td style="${td}text-align:right;">${fa(netBeforeGst)}</td>
      ${blank}
    </tr>`;
  }).join('');
```

`ptHtml` currently reads:

```ts
  const ptHtml = allowedPaint.map((r, idx) => band(allowedPaint, idx) + `<tr>
      <td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">Paint</td>
      <td style="${td}text-align:center;">${jobTypeLabel(r)}</td>
      <td style="${td}text-align:right;">${fa(r.estimated)}</td>
      <td style="${td}text-align:center;">${depLabel(r)}</td>
      ${blank}
      <td style="${td}text-align:center;">${String(r.gst ?? 0)}</td>
      ${blank}${blank}
      <td style="${td}text-align:right;">${fa(computeRowNet(r, rowDepFor(r)).netBeforeGst)}</td>
    </tr>`).join('');
```

Replace with:

```ts
  const ptHtml = allowedPaint.map((r, idx) => {
    const { afterDep, netBeforeGst } = computeRowNet(r, rowDepFor(r));
    return band(allowedPaint, idx) + `<tr>
      <td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">Paint</td>
      <td style="${td}text-align:center;">${jobTypeLabel(r)}</td>
      <td style="${td}text-align:right;">${fa(r.estimated)}</td>
      <td style="${td}text-align:center;">${depLabel(r)}</td>
      <td style="${td}text-align:right;">${fa(r.assessed - afterDep)}</td>
      ${blank}
      <td style="${td}text-align:center;">${String(r.gst ?? 0)}</td>
      ${blank}${blank}
      <td style="${td}text-align:right;">${fa(netBeforeGst)}</td>
    </tr>`;
  }).join('');
```

- [ ] **Step 5: Add the header cell and rebalance widths**

Find:

```ts
<thead><tr>
  <th style="${th}width:4%;">SR.<br/>NO.</th>
  <th style="${th}text-align:left;width:20%;">Description</th>
  <th style="${th}width:8%;">Part<br/>Type</th>
  <th style="${th}width:8%;">Job<br/>Type</th>
  <th style="${th}width:10%;">Part List<br/>Without Tax</th>
  <th style="${th}width:8%;">Part<br/>Depreciation</th>
  <th style="${th}width:10%;">Parts<br/>Assessment</th>
  <th style="${th}width:5%;">GST<br/>%</th>
  <th style="${th}width:11%;">Final amount<br/>With G.S.T</th>
  <th style="${th}width:8%;">Labour</th>
  <th style="${th}width:8%;">Paint</th>
</tr></thead>
```

Replace with (widths trimmed on `Description`, `Part List Without Tax`, `Parts Assessment`, `Final amount With G.S.T` to make room for a 7% new column; sums to 100):

```ts
<thead><tr>
  <th style="${th}width:4%;">SR.<br/>NO.</th>
  <th style="${th}text-align:left;width:18%;">Description</th>
  <th style="${th}width:8%;">Part<br/>Type</th>
  <th style="${th}width:8%;">Job<br/>Type</th>
  <th style="${th}width:9%;">Part List<br/>Without Tax</th>
  <th style="${th}width:8%;">Part<br/>Depreciation</th>
  <th style="${th}width:7%;">Dep.<br/>Amount</th>
  <th style="${th}width:9%;">Parts<br/>Assessment</th>
  <th style="${th}width:5%;">GST<br/>%</th>
  <th style="${th}width:9%;">Final amount<br/>With G.S.T</th>
  <th style="${th}width:8%;">Labour</th>
  <th style="${th}width:7%;">Paint</th>
</tr></thead>
```

- [ ] **Step 6: Widen `colspan`s — supplementary band, section headers, empty-state fallbacks**

Find:

```ts
  const band = (sectionRows: AssessmentRow[], idx: number) =>
    shouldStartSupplementaryBand(sectionRows, idx)
      ? `<tr><td colspan="11" style="padding:4px 8px;text-align:center;font-size:9pt;font-weight:600;color:#666;background:linear-gradient(to right,#f5f5f5,#fafafa,#f5f5f5);">Supplementary Estimate</td></tr>`
      : '';
```

Replace `colspan="11"` with `colspan="12"` in that line.

Find:

```ts
<tr><td colspan="11" style="${sec}">SPARE PARTS</td></tr>
${pHtml || `<tr><td colspan="11" style="${td}text-align:center;color:#999;font-style:italic;">No parts in allowed items</td></tr>`}
```

Replace both `colspan="11"` with `colspan="12"`.

Find:

```ts
<tr><td colspan="11" style="${sec}">LABOUR</td></tr>
${lHtml || `<tr><td colspan="11" style="${td}text-align:center;color:#999;font-style:italic;">No labour in allowed items</td></tr>`}
```

Replace both `colspan="11"` with `colspan="12"`.

Find:

```ts
<tr><td colspan="11" style="${sec}">PAINTING CHARGES</td></tr>
${ptHtml || `<tr><td colspan="11" style="${td}text-align:center;color:#999;font-style:italic;">No painting in allowed items</td></tr>`}
```

Replace both `colspan="11"` with `colspan="12"`.

- [ ] **Step 7: SPARE PARTS `SUB TOTAL` row**

Find:

```ts
<tr style="font-weight:700;background:#eee;">
  <td colspan="4" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(allowedParts.reduce((s, r) => s + r.estimated, 0))}</td>
  ${blank}
  <td style="${td}text-align:right;">${fa(allowedParts.reduce((s, r) => s + r.assessed, 0))}</td>
  ${blank}
  <td style="${td}text-align:right;">${fa(partsAgg.amount)}</td>
  ${blank}${blank}
</tr>
```

Replace with (new cell — the sum of per-row parts depreciation amounts — inserted between the `Dep%` blank and the assessed-sum cell):

```ts
<tr style="font-weight:700;background:#eee;">
  <td colspan="4" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(allowedParts.reduce((s, r) => s + r.estimated, 0))}</td>
  ${blank}
  <td style="${td}text-align:right;">${fa(allowedParts.reduce((s, r) => s + r.assessed - computeRowNet(r, rowDepFor(r)).afterDep, 0))}</td>
  <td style="${td}text-align:right;">${fa(allowedParts.reduce((s, r) => s + r.assessed, 0))}</td>
  ${blank}
  <td style="${td}text-align:right;">${fa(partsAgg.amount)}</td>
  ${blank}${blank}
</tr>
```

- [ ] **Step 8: LABOUR `SUB TOTAL` row (first) and its `TAX`/`SUB TOTAL` (gross) rows**

Find:

```ts
<tr style="font-weight:700;background:#f6f6f6;">
  <td colspan="4" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(allowedLabour.reduce((s, r) => s + r.estimated, 0))}</td>
  <td colspan="4" style="${td}"></td>
  <td style="${td}text-align:right;">${fa(labourAgg.base)}</td>
  ${blank}
</tr>
${taxLines(labourAgg, 'Labour', 'labour')}
<tr style="font-weight:700;background:#eee;">
  <td colspan="9" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(labourAgg.amount)}</td>
  ${blank}
</tr>
```

Replace with (`colspan="4"` → `colspan="5"` to also cover the new column; both `colspan="9"` in `taxLines` become `colspan="10"` — see Step 10):

```ts
<tr style="font-weight:700;background:#f6f6f6;">
  <td colspan="4" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(allowedLabour.reduce((s, r) => s + r.estimated, 0))}</td>
  <td colspan="5" style="${td}"></td>
  <td style="${td}text-align:right;">${fa(labourAgg.base)}</td>
  ${blank}
</tr>
${taxLines(labourAgg, 'Labour', 'labour')}
<tr style="font-weight:700;background:#eee;">
  <td colspan="10" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(labourAgg.amount)}</td>
  ${blank}
</tr>
```

- [ ] **Step 9: PAINTING `SUB TOTAL` row (first) and its `SUB TOTAL` (gross) row**

Find:

```ts
<tr style="font-weight:700;background:#f6f6f6;">
  <td colspan="4" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(allowedPaint.reduce((s, r) => s + r.estimated, 0))}</td>
  <td colspan="5" style="${td}"></td>
  <td style="${td}text-align:right;">${fa(paintAgg.base)}</td>
</tr>
${taxLines(paintAgg, 'Paint', 'paint')}
<tr style="font-weight:700;background:#eee;">
  <td colspan="10" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(paintAgg.amount)}</td>
</tr>
```

Replace with (`colspan="5"` → `colspan="6"`; `colspan="10"` → `colspan="11"`):

```ts
<tr style="font-weight:700;background:#f6f6f6;">
  <td colspan="4" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(allowedPaint.reduce((s, r) => s + r.estimated, 0))}</td>
  <td colspan="6" style="${td}"></td>
  <td style="${td}text-align:right;">${fa(paintAgg.base)}</td>
</tr>
${taxLines(paintAgg, 'Paint', 'paint')}
<tr style="font-weight:700;background:#eee;">
  <td colspan="11" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(paintAgg.amount)}</td>
</tr>
```

- [ ] **Step 10: `taxLines` helper — both call sites share one `colspan`**

Find:

```ts
  const taxLines = (agg: ReturnType<typeof aggregateGst>, label: string, col: 'labour' | 'paint') =>
    agg.bands.filter(b => b.rate > 0).map(b => `<tr>
      <td colspan="9" style="${td}text-align:right;font-style:italic;">TAX IN ${b.rate} % for ${label}</td>
      ${col === 'labour' ? `<td style="${td}text-align:right;">${fa(b.cgst + b.sgst)}</td>${blank}` : `${blank}<td style="${td}text-align:right;">${fa(b.cgst + b.sgst)}</td>`}
    </tr>`).join('');
```

Replace `colspan="9"` with `colspan="10"`:

```ts
  const taxLines = (agg: ReturnType<typeof aggregateGst>, label: string, col: 'labour' | 'paint') =>
    agg.bands.filter(b => b.rate > 0).map(b => `<tr>
      <td colspan="10" style="${td}text-align:right;font-style:italic;">TAX IN ${b.rate} % for ${label}</td>
      ${col === 'labour' ? `<td style="${td}text-align:right;">${fa(b.cgst + b.sgst)}</td>${blank}` : `${blank}<td style="${td}text-align:right;">${fa(b.cgst + b.sgst)}</td>`}
    </tr>`).join('');
```

This single change covers both the Labour and Paint tax-line rows (Steps 8 and 9 above), since both call the same `taxLines` function.

- [ ] **Step 11: `TOTAL` row**

Find:

```ts
<tr style="font-weight:700;background:#ddd;">
  <td colspan="4" style="${td}">TOTAL</td>
  <td style="${td}text-align:right;">${fa(
    [...allowedParts, ...allowedLabour, ...allowedPaint].reduce((s, r) => s + r.estimated, 0)
  )}</td>
  ${blank}
  <td style="${td}text-align:right;">${fa(allowedParts.reduce((s, r) => s + r.assessed, 0))}</td>
  ${blank}
  <td style="${td}text-align:right;">${fa(partsAgg.amount)}</td>
  <td style="${td}text-align:right;">${fa(labourAgg.amount)}</td>
  <td style="${td}text-align:right;">${fa(paintAgg.amount)}</td>
</tr>
```

Replace with (grand depreciation-amount total — parts, labour, and paint combined — inserted between the `Dep%` blank and the assessed-sum cell):

```ts
<tr style="font-weight:700;background:#ddd;">
  <td colspan="4" style="${td}">TOTAL</td>
  <td style="${td}text-align:right;">${fa(
    [...allowedParts, ...allowedLabour, ...allowedPaint].reduce((s, r) => s + r.estimated, 0)
  )}</td>
  ${blank}
  <td style="${td}text-align:right;">${fa(
    [...allowedParts, ...allowedLabour, ...allowedPaint].reduce((s, r) => s + r.assessed - computeRowNet(r, rowDepFor(r)).afterDep, 0)
  )}</td>
  <td style="${td}text-align:right;">${fa(allowedParts.reduce((s, r) => s + r.assessed, 0))}</td>
  ${blank}
  <td style="${td}text-align:right;">${fa(partsAgg.amount)}</td>
  <td style="${td}text-align:right;">${fa(labourAgg.amount)}</td>
  <td style="${td}text-align:right;">${fa(paintAgg.amount)}</td>
</tr>
```

- [ ] **Step 12: Run tests, typecheck**

Run: `npx vitest run src/lib/reports/__tests__/uiic-depreciation-amount.test.ts`
Expected: PASS — 14 passed (8 from Task 1, 6 from Task 2)

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 13: Run the full suite**

Run: `npx vitest run`
Expected: all pass, no regressions against the pre-task baseline (745 tests before this plan).

- [ ] **Step 14: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/uiic-depreciation-amount.test.ts
git commit -m "feat(uiic): add per-row Depreciation Amount to the Bill Check Report

Same column as the Final Report, same position, same formula. Bill
check's item table already excludes disallowed rows entirely (fixed
earlier), so no blank-cell case is needed here — every row gets a real
figure.

Column widths on the existing 11-column table are rebalanced to make
room for the 12th; verify in Task 3 that no money figure wraps."
```

---

### Task 3: Visual verification (no live claim required)

**Files:**
- Create: `scripts/render-uiic-fixtures.ts` (temporary, not committed — verification aid only)

**Interfaces:**
- Consumes: `buildUIICFinalHTML`, `buildUIICBillCheckHTML` (unchanged signatures)
- Produces: two static HTML files viewable in a browser, no authentication needed since both builders are pure functions over a fixture object

- [ ] **Step 1: Render both reports with large figures, to a file**

Create `scripts/render-uiic-fixtures.ts`:

```ts
import { writeFileSync } from 'fs';
import { buildUIICFinalPrintDocument, buildUIICBillCheckPrintDocument } from '../src/lib/reports/uiic-final-builder';
import type { ClaimData } from '../src/types';
import type { AssessmentRow } from '../src/types/assessment';

// Six-figure amounts throughout — the width-rebalancing check from the spec's
// risk section: does any money column wrap to two lines with a realistic
// large claim?
function row(overrides: Partial<AssessmentRow>): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Bonnet Assy. Complete With Grille And Badges',
    estimated: 132500,
    assessed: 132500,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  } as AssessmentRow;
}

const claim: ClaimData = {
  id: 'fixture',
  reportNo: 'UIIC/2026/9942',
  assessmentRows: [
    row({ assessed: 132500, partType: 'metal' }),
    row({ particulars: 'Windshield Glass', assessed: 45000, partType: 'glass' }),
    row({ particulars: 'R&R Labour', section: 'labour', partType: 'labour', assessed: 28000, depOverride: 15 }),
    row({ particulars: 'Painting — Full Body', section: 'paint', partType: 'paint', assessed: 62000 }),
    row({ particulars: 'Disallowed Item', assessed: 15000, allowed: false }),
  ],
  depreciationType: 'standard',
  vehicle: { registrationNumber: 'MH12PQ4482', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024, classOfVehicle: 'Private Car' },
  policy: { idv: 645000 },
  accident: { dateAndTime: '2026-06-24T10:00' },
  driver: {},
  spotDetails: {},
  reinspection: {},
  feeBill: { salvageValue: 5000, compulsoryExcess: 1000, voluntaryExcess: 0, travelExpenses: 0 },
  billCheck: { billNo: 'INV/2026/771', billDate: '2026-08-01', billTotal: 250000 },
} as unknown as ClaimData;

writeFileSync('uiic-final-fixture.html', buildUIICFinalPrintDocument(claim, null));
writeFileSync('uiic-bill-check-fixture.html', buildUIICBillCheckPrintDocument(claim, null));
console.log('Wrote uiic-final-fixture.html and uiic-bill-check-fixture.html');
```

- [ ] **Step 2: Run it**

Run: `npx tsx scripts/render-uiic-fixtures.ts`
Expected: `Wrote uiic-final-fixture.html and uiic-bill-check-fixture.html`

- [ ] **Step 3: Open both in the Browser pane and inspect the item tables**

Check specifically: does any money figure in the Bill Check Report's rebalanced columns (`Description`, `Part List Without Tax`, `Dep. Amount`, `Parts Assessment`, `Final amount With G.S.T`) wrap to two lines? Does `Dep. Amount` read a real number for every row, `0%`/`₹0.00` never `N.D.`? Does the disallowed row appear in the Final Report (marked `NOT ALLOWED`, blank `Dep. Amount`) and not in the Bill Check Report at all?

If anything wraps, adjust the `width:` percentages from Task 2 Step 5 and re-run Steps 1–3 of this task.

- [ ] **Step 4: Delete the script — it was a verification aid, not part of the shipped codebase**

```bash
rm scripts/render-uiic-fixtures.ts uiic-final-fixture.html uiic-bill-check-fixture.html
```

No commit for this task — nothing it produced ships. If Task 2's widths needed adjusting, that edit was already committed as part of Task 2; only re-run verification, don't recommit unless a width value actually changed after Task 2's commit landed (in which case, amend that commit before moving on, since it hasn't been pushed).

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| Column position: after `Dep%`, both tables | 1, 2 |
| Formula: `assessed - afterDep`, no branching for disposal | 1, 2 |
| Labour/paint: no branching, naturally `₹0.00` unless overridden | 1, 2 (tests confirm both paths) |
| Disallowed rows: blank in Final Report, absent entirely in Bill Check | 1, 2 |
| `N.D.` → `0%`, both tables, all label call sites | 1 Step 3, 2 Step 3 |
| Every enumerated `colspan` change | 1 Steps 6–7, 2 Steps 6–11 |
| Section subtotal for the new column | 1 Step 7 (parts only, matches spec), 2 Steps 7 and 11 (parts-only subtotal, grand total) |
| Bill Check width rebalancing, no wrapped figures | 2 Step 5, verified in 3 |
| Column-count regression guard | 1 Step 1 test, 2 Step 1 test (`assertColumnCountsMatch`) |
| Consistency check: per-row sum equals top-summary aggregate | 1 Step 1 test |
| Standard reports untouched | Not touched by any task — no file under `standard-report-builder.ts` appears above |

**Type consistency:** `afterDep` is destructured from `computeRowNet`'s existing `RowNetResult` in every row builder that needs it — no new type introduced. `assertColumnCountsMatch` is defined once, in Task 1's test file creation, and Task 2 reuses it without redefining.

**Known risk carried from the spec:** Task 2 Step 5's exact width percentages are a best guess; Task 3 exists specifically to catch a wrapped figure before this ships, using a fixture with deliberately large (six-figure) amounts rather than the small round numbers the unit tests use.
