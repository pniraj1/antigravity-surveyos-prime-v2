# Bill Check Screen &amp; Report Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Bill Check screen state the same figures the report prints, stop the Assessed cell committing half-typed numbers, and correct four report defects.

**Architecture:** Most of this is subtraction. One substitution rule already lives in `projectForBillCheck`; it gets a name and three callers instead of one. The Assessed cell gains a local draft so the store is written once per edit rather than once per keystroke. The rest is filters, labels and a column width.

**Tech Stack:** TypeScript, React 19, Vitest. No new dependencies.

## Global Constraints

- **Branch:** commit directly to `main`. No branches, no worktrees (project convention).
- **Commit format:** `<type>(<scope>): <subject>`. No attribution trailers.
- **Verification:** `npx tsc --noEmit` and `npx vitest run` must both pass before every commit. Baseline entering this plan: **101 files / 774 tests**.
- **Immutability:** never mutate a row; return new objects.
- **`billedTaxable` is pre-GST. `billedAmount` is GST-inclusive.** Never feed `billedAmount` into a column that is taxed again.
- **The Final Survey Report's output must not change.** Tasks 2 and 5 touch code it shares; each carries a guard proving it didn't.
- **Spec:** `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Specs/2026-08-18-bill-check-screen-corrections-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/reports/bill-check-projection.ts` | **Modify** — export `billCheckAssessed`, the one definition of the bill-check basis |
| `src/components/tabs/bill-check/BillCheckGrid.tsx` | **Modify** — derived cells use that basis; disallowed rows filtered out; Assessed cell delegated to `AllowanceInput` |
| `src/components/tabs/bill-check/AllowanceInput.tsx` | **Create** — number cell that drafts locally and commits on blur/Enter |
| `src/components/dialogs/AllowanceScopeDialog.tsx` | **Modify** — editable amount field |
| `src/lib/reports/standard-report-builder.ts` | **Modify** — serials from `buildSerialMap`; `No Bill` label |
| `src/lib/reports/uiic-final-builder.ts` | **Modify** — `No Bill` label and aggregates that agree with it; `Dep%` width |
| `src/components/evidence/DocumentEvidenceViewer.tsx` | **Modify** — fallback card for unrenderable files |

Task order puts the shared basis first (Tasks 2–6 read it) and the two Final-Report-adjacent changes early, while the suite is quiet enough to attribute a regression.

---

### Task 1: `billCheckAssessed` — one definition of the bill-check basis

**Files:**
- Modify: `src/lib/reports/bill-check-projection.ts`
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx`
- Test: `src/lib/reports/__tests__/bill-check-projection.test.ts` (extend)

**Interfaces:**
- Produces: `billCheckAssessed(r: AssessmentRow): number` — Tasks 3 and 4 reference this name.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/reports/__tests__/bill-check-projection.test.ts`:

```ts
import { billCheckAssessed } from '../bill-check-projection';

describe('billCheckAssessed', () => {
  test('uses the final-survey figure when no allowance was recorded', () => {
    expect(billCheckAssessed(row({ assessed: 1000 }))).toBe(1000);
  });

  test('uses the bill-check allowance when one was recorded', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billAllowed: 700 }))).toBe(700);
  });

  test('an allowance of zero is a decision, not an absence', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billAllowed: 0 }))).toBe(0);
  });

  test('a not-in-bill row carries nothing, whatever was allowed', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billAllowed: 700, billStatus: 'not-in-bill' }))).toBe(0);
  });

  // The guard against screen and report drifting apart again.
  test('the projection routes through it', () => {
    const r = row({ assessed: 1000, billAllowed: 700, billedTaxable: 700 });
    expect(projectForBillCheck([r])[0].assessed).toBe(billCheckAssessed(r));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-projection.test.ts`
Expected: FAIL — `billCheckAssessed is not a function`

- [ ] **Step 3: Export the function and route both existing callers through it**

In `src/lib/reports/bill-check-projection.ts`, add above `projectForBillCheck`:

```ts
/**
 * The assessed figure this document works from — the surveyor's bill-check
 * allowance where one was recorded, otherwise the final-survey figure.
 *
 * One definition, three callers: the report's projection, the grid's derived
 * cells, and the missing-remark check. The grid used to inline `row.assessed`
 * instead, so the screen showed Net and Price+GST that ignored an allowance
 * the report had already applied.
 */
export function billCheckAssessed(r: AssessmentRow): number {
  return r.billStatus === 'not-in-bill' ? 0 : (r.billAllowed ?? r.assessed);
}
```

Replace the body of `projectForBillCheck`:

```ts
export function projectForBillCheck(rows: AssessmentRow[]): AssessmentRow[] {
  return rows.map(r =>
    r.billStatus === 'not-in-bill'
      ? { ...r, estimated: 0, assessed: 0 }
      : { ...r, estimated: r.billedTaxable ?? 0, assessed: billCheckAssessed(r) },
  );
}
```

Inside `rowsNeedingRemark`, replace `const allowed = r.billAllowed ?? r.assessed;` with:

```ts
      const allowed = billCheckAssessed(r);
```

- [ ] **Step 4: Point the grid's derived cells at the same basis**

In `src/components/tabs/bill-check/BillCheckGrid.tsx`, extend the calculations import:

```tsx
import { computeRowNet, getDepreciationRate } from '@/lib/calculations';
import { billCheckAssessed } from '@/lib/reports/bill-check-projection';
```

Immediately below the existing `depRateFor` helper, add:

```tsx
  /**
   * The row as this document values it. computeRowNet reads `assessed`, so a
   * raw row makes the screen ignore an allowance the report already applied.
   */
  const asBilled = (row: AssessmentRow): AssessmentRow =>
    ({ ...row, assessed: billCheckAssessed(row) });
```

Replace the three derived cells — Net and Price+GST both take the projected row:

```tsx
                <div className="text-sm font-medium text-right" style={{ color: 'var(--color-neutral-600)' }}>
                  {fmt(computeRowNet(asBilled(row), depRateFor(row)).netBeforeGst)}
                </div>
                {visible.priceWithGst && (
                  <div className="text-sm font-medium text-right" style={{ color: 'var(--color-neutral-600)' }}>
                    {(() => {
                      const { isDisposal, netBeforeGst } = computeRowNet(asBilled(row), depRateFor(row));
                      return fmt(isDisposal ? netBeforeGst : netBeforeGst * (1 + (row.gst ?? 18) / 100));
                    })()}
                  </div>
                )}
```

The `Dep%` cell is unchanged — a depreciation *rate* does not depend on the amount.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-projection.test.ts`
Expected: PASS — 11 passed

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → 774 passed, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/bill-check-projection.ts src/components/tabs/bill-check/BillCheckGrid.tsx src/lib/reports/__tests__/bill-check-projection.test.ts
git commit -m "fix(bill-check): recalculate Net and Price+GST from the bill basis

The Assessed cell writes billAllowed, but the Net and Price+GST cells
beside it called computeRowNet on the raw row, and computeRowNet reads
row.assessed. So the figure just typed was ignored by the two cells that
should follow it, while the report — which projects first — was correct.

billCheckAssessed names the substitution the projection was already
doing. Three callers share it now, so screen and report cannot drift
apart again."
```

---

### Task 2: Standard Bill Check serials come from the assessment sheet

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts:219-224` (parts), `:270-271` (labour/paint)
- Test: `src/lib/reports/__tests__/standard-bill-check.test.ts` (extend)

**Interfaces:**
- Consumes: `buildSerialMap(rows: AssessmentRow[]): Map<string, number>` from `@/lib/calculations/serial-numbers`

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('Standard Bill Check report', …)` block:

```ts
  test('serials keep the assessment sheet numbering, so the gap shows a rejection', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ id: 'a', particulars: 'FIRST_PART', assessed: 10000 }),
      row({ id: 'b', particulars: 'REJECTED_PART', assessed: 5000, allowed: false }),
      row({ id: 'c', particulars: 'THIRD_PART', assessed: 3000 }),
    ]), profile, 'bill-check');

    const srOf = (name: string) => {
      const at = html.indexOf(name);
      const tr = html.slice(html.lastIndexOf('<tr>', at), at);
      return (tr.match(/>(\d+)</) || [])[1];
    };
    expect(srOf('FIRST_PART')).toBe('1');
    // 2 is the rejected row, absent from this report — the gap is the information
    expect(srOf('THIRD_PART')).toBe('3');
  });

  test('final mode numbering is unchanged by the switch', () => {
    const rows = [
      row({ id: 'a', particulars: 'P1', assessed: 10000 }),
      row({ id: 'b', particulars: 'P2', assessed: 5000, allowed: false }),
      row({ id: 'c', particulars: 'P3', assessed: 3000 }),
    ];
    const html = buildStandardFinalSurveyHTML(claim(rows), profile, 'final');
    for (const [name, sr] of [['P1', '1'], ['P2', '2'], ['P3', '3']] as const) {
      const at = html.indexOf(`>${name}<`);
      const tr = html.slice(html.lastIndexOf('<tr>', at), at);
      expect((tr.match(/>(\d+)</) || [])[1], `${name} should be Sr ${sr}`).toBe(sr);
    }
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts -t 'serials keep'`
Expected: FAIL — `THIRD_PART` reads `2`, because `psn++` renumbers over the filtered list

- [ ] **Step 3: Switch both counters to the shared map**

In `src/lib/reports/standard-report-builder.ts`, add to the imports:

```ts
import { buildSerialMap } from '@/lib/calculations/serial-numbers';
```

Immediately above `const partRows = …`, replace the `let psn = 1;` line with:

```ts
  // Numbered across every row, rejected included, so a gap in the Bill Check
  // tells the insurer an item was refused without cross-referencing. `rows` is
  // unfiltered here even in bill-check mode — the filter happens below.
  const serials = buildSerialMap(rows);
```

In the parts row template, replace `${psn++}` with:

```ts
      <td style="${tdsr9}">${serials.get(r.id) ?? 0}</td>
```

In `serviceRowHtml`, delete the `let sn = 1;` line and replace `${sn++}` with:

```ts
      <td style="${tdsr9}">${serials.get(r.id) ?? 0}</td>
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts`
Expected: PASS — 16 passed

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → 776 passed

If `standard-report-columns.test.ts` or `standard-summary-consistency.test.ts` goes red, the switch changed the Final Survey Report — fix the switch, not the test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts src/lib/reports/__tests__/standard-bill-check.test.ts
git commit -m "fix(bill-check): keep assessment-sheet serials in the Standard report

psn++ and sn++ counted over rows already filtered by allowed, so the
Bill Check renumbered 1..n and could not be tallied line-for-line
against the Final Survey Report.

buildSerialMap counts across every row, which is what the UIIC reports
already do — the gap is the information. Final mode is unaffected: with
nothing filtered the two produce identical numbering, and a test pins
that."
```

---

### Task 3: `No Bill` in the Standard Bill Check

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts` (parts row, `serviceRowHtml`)
- Test: `src/lib/reports/__tests__/standard-bill-check.test.ts` (extend)

**Interfaces:**
- Consumes: `billCheckAssessed` semantics from Task 1 — a not-in-bill row arrives projected to `estimated: 0`

- [ ] **Step 1: Write the failing test**

```ts
  test('a not-in-bill row says No Bill rather than 0.00', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'GRILLE', assessed: 3400, billStatus: 'not-in-bill' }),
    ]), profile, 'bill-check');
    const at = html.indexOf('GRILLE');
    const tr = html.slice(html.lastIndexOf('<tr>', at), html.indexOf('</tr>', at));
    expect(tr).toContain('No Bill');
  });

  test('No Bill never appears in the final report', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'GRILLE', assessed: 3400, billStatus: 'not-in-bill' }),
    ]), profile, 'final');
    expect(html).not.toContain('No Bill');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts -t 'No Bill'`
Expected: FAIL — the row prints `0.00`

- [ ] **Step 3: Label the Bill column**

In the parts row template, replace the Bill/Estimate cell:

```ts
      <td style="${tdr9}">${m9(r.estimated)}</td>
```

with:

```ts
      <td style="${tdr9}">${isBillCheck && r.billStatus === 'not-in-bill' ? 'No Bill' : m9(r.estimated)}</td>
```

Make the identical replacement in `serviceRowHtml`'s row template.

Only this one cell changes. The remaining money columns already read `0.00` because the projection zeroed them, and that keeps every column footing exactly as it does today.

- [ ] **Step 4: Verify**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts` → 18 passed
Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → 778 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts src/lib/reports/__tests__/standard-bill-check.test.ts
git commit -m "feat(bill-check): say No Bill where the workshop billed nothing

A not-in-bill row projects to zero, so the report printed 0.00 across
the row — indistinguishable from an item genuinely worth nothing. The
Bill column now says so in words. Totals are untouched: the row already
contributed zero."
```

---

### Task 4: `No Bill` in the UIIC Bill Check, and subtotals that agree with it

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts` (`buildUIICBillCheckHTML`)
- Test: `src/lib/reports/__tests__/uiic-no-bill.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks. `buildUIICBillCheckHTML(claim, profile)` signature unchanged.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reports/__tests__/uiic-no-bill.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { buildUIICBillCheckHTML } from '../uiic-final-builder';
import { calculateBillCheckSummary, getVehicleAgeMonths } from '@/lib/calculations';
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
    depreciationType: 'nil',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 0 },
  } as unknown as ClaimData;
}

describe('UIIC Bill Check — not-in-bill rows', () => {
  test('the row says No Bill', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ particulars: 'GRILLE', assessed: 3400, billStatus: 'not-in-bill' }),
    ]), null);
    expect(html).toContain('GRILLE');
    expect(html).toContain('No Bill');
  });

  // The older defect: the item table claimed the row while page 1 excluded it.
  test('the item table no longer claims money page 1 excludes', () => {
    const rows = [
      row({ particulars: 'BILLED', assessed: 10000 }),
      row({ particulars: 'GRILLE', assessed: 3400, billStatus: 'not-in-bill' }),
    ];
    const html = buildUIICBillCheckHTML(claim(rows), null);
    // Nil depreciation, 18% GST: only the billed row carries money — 11,800.00
    expect(html).toContain('11800.00');
    // 3400 x 1.18 = 4012.00 must appear nowhere; the grille is not claimed
    expect(html).not.toContain('4012.00');
  });

  test('the summary engine already excluded it, and still does', () => {
    const rows = [
      row({ particulars: 'BILLED', assessed: 10000 }),
      row({ particulars: 'GRILLE', assessed: 3400, billStatus: 'not-in-bill' }),
    ];
    const age = getVehicleAgeMonths('2024-08-05', 2024, '2026-08-05T10:00');
    const s = calculateBillCheckSummary(rows, age, 'nil', 0, 0, 0);
    expect(s.grandTotalBilled).toBe(11800);
    expect(s.notInBillTotal).toBe(3400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/uiic-no-bill.test.ts`
Expected: FAIL — `4012.00` is present; the table claims the grille

- [ ] **Step 3: Separate what is rendered from what is counted**

In `buildUIICBillCheckHTML`, immediately after the three `allowedParts` / `allowedLabour` / `allowedPaint` declarations, add:

```ts
  // Rendered and counted are not the same set. A not-in-bill row still prints —
  // the insurer should see the item was assessed and no bill came — but it
  // carries no liability, which is what calculateBillCheckSummary has always
  // said. The aggregates used to disagree with it.
  const inBill = (rs: AssessmentRow[]) => rs.filter(r => r.billStatus !== 'not-in-bill');
  const billedParts  = inBill(allowedParts);
  const billedLabour = inBill(allowedLabour);
  const billedPaint  = inBill(allowedPaint);
```

Repoint every aggregate and subtotal from the `allowed*` arrays to the `billed*` arrays. The sites are:

- `const partsAgg   = aggregateGst(allowedParts, rowDepFor);` → `billedParts`
- `const labourAgg  = aggregateGst(allowedLabour, rowDepFor);` → `billedLabour`
- `const paintAgg   = aggregateGst(allowedPaint, rowDepFor);` → `billedPaint`
- `const serviceAgg = aggregateGst([...allowedLabour, ...allowedPaint], rowDepFor);` → `[...billedLabour, ...billedPaint]`
- every `allowedParts.reduce(…)`, `allowedLabour.reduce(…)`, `allowedPaint.reduce(…)` in the SUB TOTAL and TOTAL rows → the matching `billed*` array

Leave the three `.map()` calls that build `pHtml`, `lHtml` and `ptHtml` on the `allowed*` arrays, so the rows still render.

- [ ] **Step 4: Label the money columns on a not-in-bill row**

In `pHtml`, replace the four money cells with a guarded form:

```ts
  const pHtml = allowedParts.map((r, idx) => {
    const { isDisposal, afterDep, netBeforeGst } = computeRowNet(r, rowDepFor(r));
    const finalAmt = isDisposal ? netBeforeGst : netBeforeGst * (1 + (r.gst || 0) / 100);
    const noBill = r.billStatus === 'not-in-bill';
    return band(allowedParts, idx) + `<tr>
      <td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">${partTypeLabel(r)}</td>
      <td style="${td}text-align:center;">${jobTypeLabel(r)}</td>
      <td style="${td}text-align:right;">${noBill ? 'No Bill' : fa(r.estimated)}</td>
      <td style="${td}text-align:center;">${depLabel(r)}</td>
      <td style="${td}text-align:right;">${noBill ? '—' : fa(r.assessed - afterDep)}</td>
      <td style="${td}text-align:right;">${noBill ? '—' : fa(r.assessed)}</td>
      <td style="${td}text-align:center;">${isDisposal ? '0' : String(r.gst ?? 0)}</td>
      <td style="${td}text-align:right;">${noBill ? '—' : (isDisposal ? `${fa(netBeforeGst)} DISP` : fa(finalAmt))}</td>
      ${blank}${blank}
    </tr>`;
  }).join('');
```

In `lHtml`, add `const noBill = r.billStatus === 'not-in-bill';` alongside the existing destructure and guard the two money cells:

```ts
      <td style="${td}text-align:right;">${noBill ? 'No Bill' : fa(r.estimated)}</td>
```
```ts
      <td style="${td}text-align:right;">${noBill ? '—' : fa(r.assessed - afterDep)}</td>
```
```ts
      <td style="${td}text-align:right;">${noBill ? '—' : fa(netBeforeGst)}</td>
```

Make the same three replacements in `ptHtml`.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/lib/reports/__tests__/uiic-no-bill.test.ts` → 3 passed
Run: `npx vitest run src/lib/reports/__tests__/bill-check-format.test.ts` → 23 passed
Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → 781 passed

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/uiic-no-bill.test.ts
git commit -m "fix(uiic): stop the bill check claiming rows page 1 excludes

buildUIICBillCheckHTML filtered on allowed and never checked
not-in-bill, so a row the workshop never billed printed its full money
in the item table while calculateBillCheckSummary left it out of the
total. The two disagreed with nothing on the page explaining the gap.

Rendered and counted are now separate sets: the row still prints, so
the insurer sees the item was assessed and no bill came, but it says
No Bill and carries nothing into any aggregate."
```

---

### Task 5: UIIC Final Report `Dep%` column holds `12.5%*`

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts` (Final Report item-table header)
- Test: `src/lib/reports/__tests__/uiic-labour-column.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

```ts
  test('Dep% is wide enough for an overridden 12.5%, and widths still sum to 100', () => {
    const html = buildUIICFinalHTML(claim([row()]), null);
    const head = html.split('DETAILS OF ASSESSMENT')[1].split('</thead>')[0];
    const widths = [...head.matchAll(/width:(\d+)%/g)].map(m => Number(m[1]));
    expect(widths).toHaveLength(12);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(100);
    // Dep% is the sixth column; 12.5%* needs 21.8pt and 5% gives only 19.4pt
    expect(widths[5]).toBeGreaterThanOrEqual(7);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/uiic-labour-column.test.ts -t 'Dep% is wide'`
Expected: FAIL — `expected 5 to be greater than or equal to 7`

- [ ] **Step 3: Move two points from Part Name to Dep%**

In the Final Report item-table header, change `Part Name` from `width:18%` to `width:16%` and `Dep%` from `width:5%` to `width:7%`:

```ts
<th style="${th}text-align:left;width:16%;">Part Name</th>
```
```ts
<th style="${th}width:7%;">Dep%</th>
```

At 186mm printable, 7% gives 30.1pt of text room against the 21.8pt `12.5%*` needs. Part Name wraps by design, so losing two points costs nothing.

- [ ] **Step 4: Verify**

Run: `npx vitest run src/lib/reports/__tests__/uiic-labour-column.test.ts` → 9 passed
Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → 782 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/uiic-labour-column.test.ts
git commit -m "fix(uiic): widen Dep% so an overridden 12.5% fits on one line

Paint at 12.5% must be a manual override — getDepreciationRate returns
0 for paint — so the cell always renders 12.5%*, which needs 21.8pt in
a column offering 19.4pt. It wrapped, making the row two lines tall.

7% gives 30.1pt. The two points come from Part Name, which wraps by
design, and the twelve widths still sum to 100."
```

---

### Task 6: Disallowed rows leave the grid

**Files:**
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx:346`

- [ ] **Step 1: Filter the section**

Replace:

```tsx
          const sectionRows = allRows.filter(r => r.section === section);
```

with:

```tsx
          // Rejected at final survey — already absent from every Bill Check
          // report, and nothing here can give them liability. The header count
          // states how many, and the serial gaps show where they sat.
          const sectionRows = allRows.filter(r => r.section === section && r.allowed);
```

- [ ] **Step 2: Confirm nothing downstream assumed they were present**

Read the three consumers of `sectionRows` in that block and confirm each is still correct:

- `sectionIds` — feeds select-all. Now covers only visible rows, which is right.
- `billedTotals(sectionRows.filter(r => r.allowed))` — the inner filter is now redundant but harmless; leave it, it documents intent.
- `shouldStartSupplementaryBand(sectionRows, idx)` — computed over what is rendered, which matches how both report builders do it.

The `isDisallowed` branch of the status cell becomes unreachable. **Leave it in place** — Task 6 of the follow-on flag spec restores a stronger version of that signal, and deleting it now only to re-add it is churn.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → 782 passed

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/bill-check/BillCheckGrid.tsx
git commit -m "feat(bill-check): drop rejected rows from the grid

They are already absent from every Bill Check report and nothing on this
screen can give them liability, so they were rows to scroll past. The
header count still states how many, and buildSerialMap keeps the serial
gaps, so the screen reads the way the report prints."
```

---

### Task 7: The Assessed cell stops committing half-typed numbers

**Files:**
- Create: `src/components/tabs/bill-check/AllowanceInput.tsx`
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx` (Assessed cell, Billed Taxable cell)
- Modify: `src/components/dialogs/AllowanceScopeDialog.tsx`

**Interfaces:**
- Produces: `<AllowanceInput value={number} disabled={boolean} highlighted={boolean} title={string | undefined} onCommit={(n: number) => void} />`
- Modifies: `AllowanceScopeDialog`'s `onChoose` becomes `(scope: 'bill-check' | 'both', amount: number) => void`

- [ ] **Step 1: Create the input**

Create `src/components/tabs/bill-check/AllowanceInput.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

interface AllowanceInputProps {
  /** The committed figure. Re-synced whenever it changes from outside. */
  value: number;
  disabled: boolean;
  /** Renders in the warning colour — used when a bill-check allowance is set. */
  highlighted: boolean;
  title?: string;
  onCommit: (value: number) => void;
}

/**
 * A number cell that keeps what you type to itself until you leave it.
 *
 * Committing on every keystroke put a half-typed number in front of the
 * allowance dialog: one backspace on 950 opened it quoting 95, and choosing
 * "Both reports" wrote 95 into a Final Survey Report already filed. The store
 * is written once per edit now — on blur or Enter. Escape abandons the edit.
 */
export function AllowanceInput({ value, disabled, highlighted, title, onCommit }: AllowanceInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  // A commit elsewhere (the scope dialog, a bulk action) must win over a stale
  // draft, otherwise the cell keeps showing a number nothing else agrees with.
  useEffect(() => { setDraft(null); }, [value]);

  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    setDraft(null);
    // An emptied cell is not a decision to allow nothing; leave the figure be.
    if (trimmed === '') return;
    const next = Number(trimmed);
    if (!Number.isFinite(next) || next === value) return;
    onCommit(next);
  };

  return (
    <input
      type="number"
      value={draft ?? String(value ?? '')}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); }
      }}
      disabled={disabled}
      title={title}
      className="px-2 py-1 rounded-lg text-sm text-right border outline-none w-full border-border font-medium"
      style={{
        background: disabled ? 'var(--color-neutral-100)' : 'var(--color-neutral-50)',
        color: highlighted ? 'var(--color-status-warning)' : 'var(--color-foreground)',
      }}
    />
  );
}
```

- [ ] **Step 2: Use it for the Assessed cell**

In `BillCheckGrid.tsx`, add the import:

```tsx
import { AllowanceInput } from './AllowanceInput';
```

Replace the Assessed `<input>` block entirely with:

```tsx
                <AllowanceInput
                  value={row.billAllowed ?? row.assessed ?? 0}
                  disabled={isDisallowed}
                  highlighted={row.billAllowed !== undefined}
                  title={row.billAllowed !== undefined ? `Allowed against an assessed value of ₹${row.assessed}` : undefined}
                  onCommit={next => commitAllowance(row, next)}
                />
```

- [ ] **Step 3: Stop an emptied Billed Taxable meaning "billed nothing"**

Replace that input's `onChange` with:

```tsx
                    onChange={e => {
                      const raw = e.target.value.trim();
                      const gstPct = row.gst ?? 18;
                      // Cleared means not checked yet, which is what the print
                      // gate reads. Zero would mean the workshop billed nothing.
                      if (raw === '') {
                        updateAssessmentRow(row.id, { billedTaxable: undefined, billedAmount: undefined });
                        return;
                      }
                      const tax = Number(raw);
                      if (!Number.isFinite(tax)) return;
                      updateAssessmentRow(row.id, { billedTaxable: tax, billedAmount: Math.round(tax * (1 + gstPct / 100)) });
                    }}
```

- [ ] **Step 4: Give the dialog an editable amount**

In `AllowanceScopeDialog.tsx`, change the props and add local state:

```tsx
import React, { useState } from 'react';

interface AllowanceScopeDialogProps {
  assessed: number;
  proposed: number;
  onChoose: (scope: 'bill-check' | 'both', amount: number) => void;
  onCancel: () => void;
}
```

Inside the component, above the returned JSX:

```tsx
  const [amount, setAmount] = useState(String(proposed));
  const parsed = Number(amount);
  const valid = amount.trim() !== '' && Number.isFinite(parsed);
```

Replace the heading with a heading plus an editable field:

```tsx
          <div style={{ flex: 1 }}>
            <h2 className="text-sm font-medium text-foreground">
              Allow how much against an assessment of ₹{INR.format(assessed)}?
            </h2>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              autoFocus
              className="mt-2 w-full px-3 py-2 rounded-lg text-sm text-right border outline-none border-border bg-neutral-50 font-medium text-foreground"
            />
            <p className="text-xs mt-2 text-muted-foreground">
              Correct the figure here if it is not what you meant. How far should this change reach?
            </p>
          </div>
```

Both choice buttons pass the edited amount and go inert while it is unusable:

```tsx
        <button
          onClick={() => onChoose('bill-check', parsed)}
          disabled={!valid}
          className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-primary text-left transition-colors disabled:opacity-50"
        >
```

```tsx
        <button
          onClick={() => onChoose('both', parsed)}
          disabled={!valid}
          className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-status-danger text-left transition-colors disabled:opacity-50"
        >
```

Inside both buttons, replace every `INR.format(proposed)` with `INR.format(valid ? parsed : proposed)` so the descriptions track the field.

- [ ] **Step 5: Take the amount from the dialog, not the pending state**

In `BillCheckGrid.tsx`, update the dialog's render:

```tsx
      {pendingAllowance && (
        <AllowanceScopeDialog
          assessed={pendingAllowance.assessed}
          proposed={pendingAllowance.proposed}
          onCancel={() => setPendingAllowance(null)}
          onChoose={(scope, amount) => {
            updateAssessmentRow(
              pendingAllowance.id,
              scope === 'both'
                ? { assessed: amount, billAllowed: undefined }
                : { billAllowed: amount },
            );
            setPendingAllowance(null);
          }}
        />
      )}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → 782 passed

Then read the three files once more and confirm: no `onChange` on the Assessed cell writes to the store, and `onChoose` has exactly one call site.

- [ ] **Step 7: Commit**

```bash
git add src/components/tabs/bill-check/AllowanceInput.tsx src/components/tabs/bill-check/BillCheckGrid.tsx src/components/dialogs/AllowanceScopeDialog.tsx
git commit -m "fix(bill-check): stop the Assessed cell committing as you type

onChange fired every keystroke while the input was controlled from the
store and the write was gated behind the scope dialog. One backspace on
950 opened the dialog quoting 95, the field could not move while it was
open, and choosing Both reports wrote 95 into a Final Survey Report
already filed.

AllowanceInput keeps the draft local and commits on blur or Enter, so
the dialog only ever sees a finished number. The dialog also gains an
editable amount, so a wrong trigger stays recoverable rather than
forcing a cancel and retype.

An emptied Billed Taxable now clears to undefined rather than 0 — not
checked yet, which the print gate reads, instead of billed nothing."
```

---

### Task 8: Evidence viewer acknowledges a file it cannot render

**Files:**
- Modify: `src/components/evidence/DocumentEvidenceViewer.tsx` (`BlobEntry`, `storeFiles`, the render fallback)

- [ ] **Step 1: Carry the filename and size**

Extend the entry type:

```ts
interface BlobEntry {
  url: string;
  mimeType: string;
  name: string;
  size: number;
}
```

And the place they are built, inside `storeFiles`:

```ts
    const entries = files.map((f) => ({
      url: URL.createObjectURL(f),
      mimeType: f.type,
      name: f.name,
      size: f.size,
    }));
```

- [ ] **Step 2: Replace the silent `null`**

The render currently ends `) : null;` for anything that is neither PDF nor image, so an unrecognised file shows as blank space. Replace that branch:

```tsx
                  ) : (
                    <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-2">
                      <div className="text-sm font-medium text-foreground break-all">{entry.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.mimeType || 'Type not recognised'} · {(entry.size / 1024).toFixed(0)} KB
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This file cannot be shown here. Open it to check the figures against it.
                      </p>
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="self-start px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground"
                      >
                        Open in new tab
                      </a>
                    </div>
                  )}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → 782 passed

- [ ] **Step 4: Commit**

```bash
git add src/components/evidence/DocumentEvidenceViewer.tsx
git commit -m "fix(evidence): show a file the viewer cannot render

Anything that was not a PDF or an image fell through to null, so the
surveyor uploaded a document and the panel showed blank space with no
sign a file was there.

It now names the file, states its type and size, and offers to open it,
so the document can still be checked against the figures in whatever
application does open it."
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| §1 Screen recalculates from the bill-check basis | 1 |
| §2 Assessed cell commits on blur; dialog editable; billedTaxable clears to undefined | 7 |
| §3 Disallowed rows leave the grid (no footer) | 6 |
| §4 Standard Bill Check serials from the assessment sheet | 2 |
| §5 `No Bill` replaces `0.00`, both reports, UIIC disagreement settled | 3, 4 |
| §6 UIIC Final Report `Dep%` widened | 5 |
| §7 Evidence viewer fallback | 8 |
| Final Survey Report output unchanged | 2 (explicit test), 3 (explicit test) |

No gaps.

**Type consistency:** `billCheckAssessed(r: AssessmentRow): number` is defined in Task 1 and referenced under that name in Tasks 3 and 4. `AllowanceInput`'s props and the widened `onChoose(scope, amount)` signature are defined and consumed within Task 7, which changes both sides together.

**Known risks**

- **Task 4 is the largest.** Repointing every aggregate from `allowed*` to `billed*` is mechanical but repetitive; a missed site leaves the table disagreeing with page 1 in the opposite direction. The `4012.00` assertion catches any aggregate still counting the row.
- **Task 7 is not unit-tested.** Draft-commit is interaction, not output. The verification is reading the three files and confirming no `onChange` writes to the store. If `commit()` grows a second condition, give it a test.
- **Task 6 removes a signal.** The `⚠ Billed (Not Allowed)` badge was the only place the surveyor saw a workshop billing for a rejected item. Hiding those rows removes it until the flag spec restores it. See the note carried to the handoff.
