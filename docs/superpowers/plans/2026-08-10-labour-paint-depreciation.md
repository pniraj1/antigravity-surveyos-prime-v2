# Labour & Paint Depreciation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a surveyor enter a depreciation percentage on Labour and Paint rows, make every report print the same figure the screen shows, and print the Labour/Paint estimates the UIIC Bill Check report currently omits.

**Architecture:** Task 1 makes the three report builders depreciation-aware for Labour and Paint while the rate is still always zero — a pure no-op refactor guarded by a regression test. Task 2 then unlocks the UI, at which point the reports are already correct. Task 3 is the independent estimate-printing fix. Doing the report work first means the unlock can never ship a report that disagrees with the screen.

**Tech Stack:** TypeScript, React, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-labour-paint-depreciation-design.md`
- Tests: Vitest, colocated in `__tests__/` next to the code. Run with `npx vitest run <path>`.
- **Regression floor:** with no `depOverride` set anywhere, every existing report figure must be byte-identical. The automatic rate for Labour and Paint stays 0, so no stored claim's numbers may move.
- The automatic depreciation rate for `labour` and `paint` stays **0**. No tariff rate is introduced.
- Section moves continue to clear `depOverride`.
- `calculateAssessmentSummary` is already correct and must not be changed.
- A cell showing a **pre**-depreciation figure (the UIIC "Assessed" column, `rawParts` at `:472`, the parts subtotal at `:737`) stays raw. Only post-depreciation cells change.
- Immutable updates only; no `console.log`; commit directly to `main`.

## File structure

| file | change |
|---|---|
| `src/lib/reports/uiic-final-builder.ts` | Labour/Paint rows and accumulators become dep-aware in **both** exported documents; Bill Check gains Estimate cells |
| `src/lib/reports/standard-report-builder.ts` | Labour/Paint rows become dep-aware; Dep% column prints the real rate |
| `src/components/claim/AssessmentSectionTable.tsx` | Dep% input renders for Labour and Paint |
| `src/lib/utils/grid-paste.ts` | Dep% paste allowed outside Parts |
| `src/lib/calculations/section-move.ts` | comment only — behaviour unchanged |
| `src/lib/calculations/depreciation.ts` | comment only — behaviour unchanged |
| `src/lib/reports/__tests__/labour-paint-depreciation.test.ts` | new: parity, estimates, regression floor |
| `src/lib/calculations/__tests__/section-move.test.ts` | add: override cleared on move |
| `src/lib/utils/__tests__/grid-paste.test.ts` | add: Dep% pastes onto Labour |

---

### Task 1: Make the report builders depreciation-aware for Labour and Paint

Today all three builders compute Labour and Paint money from raw `r.assessed`. That is invisible while the rate is always 0, and becomes a wrong number on a signed document the moment Task 2 lands. This task changes only the maths, so its whole diff must be a no-op on current claims.

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts` (lines 109-110, 112, 325-336, 476-484, 570-595, 745-762)
- Modify: `src/lib/reports/standard-report-builder.ts` (lines 234-252)
- Test: `src/lib/reports/__tests__/labour-paint-depreciation.test.ts` (create)

**Interfaces:**
- Consumes: `computeRowNet(row, depRate)` from `@/lib/calculations/row-net` (already imported by both builders); `aggregateGst(rows, depRateFor)` from `@/lib/calculations/gst-bands`, whose result exposes `.base`, `.cgst`, `.sgst`, `.amount`.
- Produces: no new exports. Later tasks rely only on the behaviour.

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/labour-paint-depreciation.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import { buildUIICFinalHTML, buildUIICBillCheckHTML } from '../uiic-final-builder';
import { calculateAssessmentSummary } from '@/lib/calculations';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

/**
 * Labour and Paint carry no automatic depreciation, but a surveyor may set a
 * manual `depOverride`. Every builder used to compute those rows straight from
 * `r.assessed`, so an override showed on screen and in the Dep% column while
 * the money beside it ignored it.
 */

function row(o: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`, particulars: 'Item', estimated: 12000, assessed: 10000,
    partType: 'metal', gst: 18, section: 'parts', allowed: true, isDisposal: false,
    disposalPercent: 50, ...o,
  } as AssessmentRow;
}

/** Registration 2023-04-11, accident 2026-06-14 → 38 months (metal 25%). */
function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'c1', reportNo: 'R1', reportDate: '2026-08-10',
    assessmentRows: rows, depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2023-04-11', yearOfManufacture: 2023 },
    policy: { idv: '650000' },
    accident: { dateAndTime: '2026-06-14T18:30' },
    driver: {}, spotDetails: {}, reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: {},
  } as unknown as ClaimData;
}

const BUILDERS: [string, (c: ClaimData) => string][] = [
  ['standard final survey', c => buildStandardFinalSurveyHTML(c, {} as never)],
  ['UIIC final', c => buildUIICFinalHTML(c, null)],
  ['UIIC bill check', c => buildUIICBillCheckHTML(c, null)],
];

/** Amounts are formatted with thousands separators in some builders, not others. */
function money(html: string): string {
  return html.replace(/,/g, '');
}

describe('Labour and Paint honour a manual depreciation override', () => {
  // 10000 assessed at 30% dep → 7000 base. The un-depreciated 10000 must not
  // appear as a standalone amount anywhere.
  test.each(BUILDERS)('%s applies the override to a labour row', (_name, build) => {
    const html = money(build(claim([row({ section: 'labour', partType: 'labour', depOverride: 30 })])));
    expect(html).toContain('7000.00');
  });

  test.each(BUILDERS)('%s applies the override to a paint row', (_name, build) => {
    const html = money(build(claim([row({ section: 'paint', partType: 'paint', depOverride: 30 })])));
    expect(html).toContain('7000.00');
  });

  test('the engine agrees with the builders on the labour base', () => {
    const rows = [row({ section: 'labour', partType: 'labour', depOverride: 30 })];
    const summary = calculateAssessmentSummary(rows, 38, 'standard', 0, 0, 0);
    // The engine already applied the override before this change; the builders
    // are what had to catch up.
    expect(summary.labourBase).toBeCloseTo(7000, 2);
  });
});

describe('regression floor: no override changes nothing', () => {
  const rows = [
    row({ particulars: 'Bumper', partType: 'plastic' }),
    row({ particulars: 'Fitting', section: 'labour', partType: 'labour', assessed: 4000 }),
    row({ particulars: 'Painting', section: 'paint', partType: 'paint', assessed: 6000 }),
  ];

  test.each(BUILDERS)('%s still prints the undepreciated labour and paint amounts', (_name, build) => {
    const html = money(build(claim(rows)));
    // Auto rate for labour and paint is 0, so the base is the assessed figure.
    expect(html).toContain('4000.00');
    expect(html).toContain('6000.00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/labour-paint-depreciation.test.ts`

Expected: the six "applies the override" cases FAIL (the builders print `10000.00`, not `7000.00`). The three regression-floor cases PASS already — they are the guard, not the target.

- [ ] **Step 3: Make the UIIC Final report's Labour and Paint rows dep-aware**

In `src/lib/reports/uiic-final-builder.ts`, replace `lHtml` and `ptHtml` inside `buildUIICFinalHTML` (lines 325-336):

```typescript
  // Labour and Paint carry no automatic depreciation, but a surveyor may set a
  // manual override. These rows used to print `r.assessed` with a hardcoded
  // "N.D." — so an override was invisible AND uncharged.
  const serviceDepLabel = (r: AssessmentRow, dep: number) =>
    r.depOverride !== undefined ? `${dep}%*` : (dep > 0 ? dep + '%' : 'N.D.');

  const lHtml = AL.map(r => {
    const isNA = r.allowed === false;
    const dep = depFor(r);
    const { afterDep } = computeRowNet(r, dep);
    const withGst = afterDep * (1 + (r.gst || 0) / 100);
    return `<tr><td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td><td style="${td}">${r.particulars}</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:right;">${isNA ? '' : fa(r.assessed)}</td><td style="${td}text-align:center;">${isNA ? '' : serviceDepLabel(r, dep)}</td><td style="${td}"></td><td style="${td}text-align:center;">${isNA ? '' : String(r.gst ?? 0)}</td><td style="${td}text-align:right;">${isNA ? '' : fa(withGst)}</td><td style="${td}text-align:center;">${isNA ? 'Not<br/>Allowed' : ''}</td></tr>`;
  }).join('');

  // Disallowed paint is listed and tagged, exactly as parts and labour are.
  // Filtering it out here also renumbered the survivors, which is what made
  // paint serials disagree with the Bill Check report.
  const ptHtml = APT.map(r => {
    const isNA = r.allowed === false;
    const dep = depFor(r);
    const { afterDep } = computeRowNet(r, dep);
    const withGst = afterDep * (1 + (r.gst || 0) / 100);
    return `<tr><td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td><td style="${td}">${r.particulars}</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:center;">Paint</td><td style="${td}text-align:right;">${isNA ? '' : fa(r.assessed)}</td><td style="${td}text-align:center;">${isNA ? '' : serviceDepLabel(r, dep)}</td><td style="${td}"></td><td style="${td}text-align:center;">${isNA ? '' : String(r.gst ?? 0)}</td><td style="${td}"></td><td style="${td}text-align:right;">${isNA ? 'Not<br/>Allowed' : fa(withGst)}</td></tr>`;
  }).join('');
```

`depFor` is declared at line 116, *after* these blocks. Move its declaration (lines 116-117) to just above the `pHtml` block at line 312 so all three row builders share it.

- [ ] **Step 4: Make the UIIC Final report's accumulators dep-aware**

In the same function, replace lines 109-112:

```typescript
  AL.forEach(r => { if (r.allowed !== false) labOnly += computeRowNet(r, depFor(r)).netBeforeGst; });
  APT.forEach(r => { if (r.allowed !== false) paintOnly += computeRowNet(r, depFor(r)).netBeforeGst; });

  // Was `labOnly + paintOnly` accumulated raw. serviceAgg computes the same
  // quantity depreciation-aware, so the taxable base at :358/:372/:373 now
  // agrees with the CGST/SGST cells printed beside it.
  const labBase = serviceAgg.base;
```

This requires `depFor` and `serviceAgg` to exist before line 109. Move the `depFor` declaration and the four `aggregateGst` calls (lines 116-122) above the `AP.forEach` block at line 97, and add `serviceAgg`:

```typescript
  const depFor = (r: AssessmentRow) =>
    r.depOverride !== undefined ? r.depOverride : getDepRate(r.partType, ageMonths, depType);

  const partsAgg  = aggregateGst(AP.filter(r => r.allowed !== false), depFor);
  const labourAgg = aggregateGst(AL.filter(r => r.allowed !== false), depFor);
  const paintAgg  = aggregateGst(APT.filter(r => r.allowed !== false), depFor);
  const serviceAgg = aggregateGst(
    [...AL, ...APT].filter(r => r.allowed !== false), depFor);
```

- [ ] **Step 5: Make the UIIC Bill Check report dep-aware**

In `buildUIICBillCheckHTML`, replace lines 475-484:

```typescript
  allowedLabour.forEach(r => {
    labOnly += computeRowNet(r, rowDep(r)).netBeforeGst;
    billedLabourTotal += computeRowLiability(r, rowDep(r)).liability;
  });
  allowedPaint.forEach(r => {
    paintOnly += computeRowNet(r, rowDep(r)).netBeforeGst;
    billedPaintTotal += computeRowLiability(r, rowDep(r)).liability;
  });
```

Then replace the `labBase` declaration at line 484 with an assignment placed *after* `serviceAgg` is declared at line 494:

```typescript
  // Same quantity as labOnly + paintOnly, but computed by the shared aggregator
  // so the base cannot drift from the CGST/SGST printed beside it.
  const labBase = serviceAgg.base;
```

Replace the per-row amounts at lines 580 and 594. In `lHtml`, change the final amount cell:

```typescript
      <td style="${td}text-align:right;">${fa(computeRowNet(r, rowDepFor(r)).netBeforeGst)}</td>
```

In `ptHtml`, change its final amount cell the same way:

```typescript
      <td style="${td}text-align:right;">${fa(computeRowNet(r, rowDepFor(r)).netBeforeGst)}</td>
```

Replace the two subtotal sums at lines 747 and 761:

```typescript
  <td style="${td}text-align:right;">${fa(labourAgg.base)}</td>
```

```typescript
  <td style="${td}text-align:right;">${fa(paintAgg.base)}</td>
```

- [ ] **Step 6: Make the standard report's Labour and Paint rows dep-aware**

In `src/lib/reports/standard-report-builder.ts`, replace `serviceRowHtml` (lines 234-252):

```typescript
  const serviceRowHtml = (section: 'labour' | 'paint', typeLabel: string) => {
    let sn = 1;
    return rows.filter(r => r.section === section).map(r => {
      const disallowed = r.allowed === false;
      const dep = r.depOverride !== undefined ? r.depOverride : getDepreciationRate(r.partType, ageMonths, depType);
      const depLabel = r.depOverride !== undefined ? `${dep}%*` : `${dep}%`;
      const gstPct = r.gst || 18;
      const { netBeforeGst } = disallowed ? { netBeforeGst: 0 } : computeRowNet(r, dep);
      const priceGst = disallowed ? 0 : netBeforeGst * (1 + gstPct / 100);
      return `<tr>
      <td style="${td9}text-align:center;">${sn++}</td>
      <td style="${td9}">${r.particulars}</td>
      <td style="${td9}text-align:center;">${typeLabel}</td>
      <td style="${tdr9}">${m9(r.estimated)}</td>
      <td style="${tdr9}${disallowed ? 'color:#a00;font-weight:700;font-size:6.5pt;text-align:center;' : ''}">${disallowed ? 'NOT ALLOWED' : m9(r.assessed)}</td>
      <td style="${tdr9}text-align:center;${r.depOverride !== undefined ? 'color:#b45309;' : ''}">${depLabel}</td>
      <td colspan="${NMAT}" style="${tdr9}text-align:center;">—</td>
      <td style="${tdr9}text-align:center;">${gstPct}%</td>
      <td style="${tdr9}${disallowed ? 'color:#a00;' : 'font-weight:600;'}">${disallowed ? '—' : m9(priceGst)}</td>
    </tr>`;
    }).join('');
  };
```

- [ ] **Step 7: Run the new test to verify it passes**

Run: `npx vitest run src/lib/reports/__tests__/labour-paint-depreciation.test.ts`

Expected: PASS, 9 tests.

- [ ] **Step 8: Verify the regression floor across the whole suite**

Run: `npx vitest run && npx tsc --noEmit`

Expected: all tests PASS and `tsc` exits 0. `depreciation-parity.test.ts`, `standard-summary-consistency.test.ts`, `gst-per-item.test.ts` and `bill-check-format.test.ts` all assert current report figures — if any of them moves, the change was not a no-op and the cause must be found before continuing.

- [ ] **Step 9: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/standard-report-builder.ts src/lib/reports/__tests__/labour-paint-depreciation.test.ts
git commit -m "fix(reports): apply depreciation to labour and paint rows

All three builders computed labour and paint money from raw assessed.
Harmless while the rate is always zero, wrong the moment a surveyor can
set an override. The UIIC bill check even printed a dep% label next to an
amount that ignored it, and the final report's taxable base disagreed
with the CGST/SGST cells beside it."
```

---

### Task 2: Let the surveyor enter a depreciation on Labour and Paint

With the builders correct, unlocking the input is safe.

**Files:**
- Modify: `src/components/claim/AssessmentSectionTable.tsx:443`
- Modify: `src/lib/utils/grid-paste.ts:64`
- Modify: `src/lib/calculations/section-move.ts` (comment only)
- Modify: `src/lib/calculations/depreciation.ts:42`, `:67` (comments only)
- Test: `src/lib/utils/__tests__/grid-paste.test.ts`, `src/lib/calculations/__tests__/section-move.test.ts`

**Interfaces:**
- Consumes: `AssessmentRow.depOverride?: number` (already exists); `resolveSectionMove(row, target): Partial<AssessmentRow>` (unchanged signature).
- Produces: no new exports.

- [ ] **Step 1: Write the failing paste test**

Append to the existing `src/lib/utils/__tests__/grid-paste.test.ts`. The function under test is `buildPasteUpdates(rows, anchorRowId, focusRowId, columnKey, parsedValue)` and it returns a `Record<rowId, Partial<AssessmentRow>>`:

```typescript
describe('Dep% paste target', () => {
  function labourRow(id: string, allowed: boolean): AssessmentRow {
    return {
      id, particulars: 'Fitting', estimated: 0, assessed: 4000, partType: 'labour',
      gst: 18, section: 'labour', allowed,
    } as AssessmentRow;
  }

  it('applies a pasted Dep% to a labour row', () => {
    const rows = [labourRow('l1', true)];
    expect(buildPasteUpdates(rows, 'l1', 'l1', 'depOverride', 30))
      .toEqual({ l1: { depOverride: 30 } });
  });

  it('applies a pasted Dep% to a paint row', () => {
    const rows = [{ ...labourRow('p1', true), section: 'paint', partType: 'paint' } as AssessmentRow];
    expect(buildPasteUpdates(rows, 'p1', 'p1', 'depOverride', 30))
      .toEqual({ p1: { depOverride: 30 } });
  });

  it('still refuses to paste a Dep% onto a disallowed row', () => {
    const rows = [labourRow('l2', false)];
    expect(buildPasteUpdates(rows, 'l2', 'l2', 'depOverride', 30)).toEqual({});
  });
});
```

Add `buildPasteUpdates` and the `AssessmentRow` type to the file's existing imports if they are not already there.

- [ ] **Step 2: Run it to verify the first case fails**

Run: `npx vitest run src/lib/utils/__tests__/grid-paste.test.ts`

Expected: the labour and paint cases FAIL (both return `{}`); the disallowed case PASSES.

- [ ] **Step 3: Allow the paste outside Parts**

In `src/lib/utils/grid-paste.ts`, replace line 64:

```typescript
    // Labour and paint have no automatic depreciation, but the surveyor may
    // set one. Only the allowed-row guard remains.
    if (columnKey === 'depOverride' && !row.allowed) continue;
```

- [ ] **Step 4: Run it to verify both pass**

Run: `npx vitest run src/lib/utils/__tests__/grid-paste.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the section-move test**

Append to `src/lib/calculations/__tests__/section-move.test.ts`. The file already imports `resolveSectionMove` and defines a `row(overrides)` helper, and uses `test` rather than `it` — reuse both:

```typescript
describe('depOverride across section moves', () => {
  test('clears a manual override when a part moves into labour', () => {
    // Carrying 50% onto a labour line would re-price it with nothing on screen
    // reporting the change. The surveyor re-enters it after the move.
    const r = row({ partType: 'plastic', section: 'parts', depOverride: 50 });
    expect(resolveSectionMove(r, 'labour')).toMatchObject({
      section: 'labour', partType: 'labour', depOverride: undefined,
    });
  });

  test('clears a manual override set on a labour row moving to paint', () => {
    const r = row({ partType: 'labour', section: 'labour', depOverride: 30 });
    expect(resolveSectionMove(r, 'paint')).toMatchObject({
      section: 'paint', partType: 'paint', depOverride: undefined,
    });
  });
});
```

- [ ] **Step 6: Run it**

Run: `npx vitest run src/lib/calculations/__tests__/section-move.test.ts`

Expected: PASS with no source change — this locks in existing behaviour the spec decided to keep, so it must be green immediately. If it fails, `resolveSectionMove` does not clear the override and the spec's Part 2 assumption is wrong; stop and report.

- [ ] **Step 7: Render the Dep% input for Labour and Paint**

In `src/components/claim/AssessmentSectionTable.tsx`, replace line 443:

```typescript
                      {row.allowed ? (
```

The auto rate is 0 for Labour and Paint, so the input shows `0` until the surveyor types over it — the same behaviour a 0% metal part already has, and `autoDepRate` already comes from the shared engine.

- [ ] **Step 8: Update the two comments that would otherwise mislead**

In `src/lib/calculations/section-move.ts`, replace the paragraph beginning "A manual `depOverride` is cleared on every section change":

```
 * A manual `depOverride` is cleared on every section change. Labour and paint
 * carry no automatic depreciation, but the surveyor may set one by hand — so
 * the reason is no longer "the tariff says Nil". It is that an override set
 * against a plastic bumper must not silently follow the row into Labour and
 * re-price it with nothing on screen reporting the change.
```

In `src/lib/calculations/depreciation.ts`, change the line in the doc block at line 42:

```
 * - Labour/Paint: 0% by default — the surveyor may override per row
```

and the comment above line 67:

```typescript
  // Labour and paint attract no automatic depreciation. A surveyor who needs
  // one sets depOverride on the row; callers read that first.
  if (partType === 'labour' || partType === 'paint') return 0;
```

- [ ] **Step 9: Verify the whole suite and the build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

Expected: all PASS, `tsc` exits 0, build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/components/claim/AssessmentSectionTable.tsx src/lib/utils/grid-paste.ts src/lib/utils/__tests__/grid-paste.test.ts src/lib/calculations/section-move.ts src/lib/calculations/depreciation.ts src/lib/calculations/__tests__/section-move.test.ts
git commit -m "feat(assessment): allow depreciation entry on labour and paint rows

The Dep% cell rendered a dash outside the parts section and the paste
guard dropped the column, so a surveyor could never set a depreciation on
labour or paint even though the engine has honoured depOverride on every
section all along. The automatic rate stays 0; section moves still clear
the override."
```

---

### Task 3: Print the Labour and Paint estimates in the UIIC Bill Check report

Independent of depreciation. `buildUIICFinalHTML` has no Estimate column and is not touched.

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts` (lines 575, 589, 746, 760, 771)
- Test: `src/lib/reports/__tests__/labour-paint-depreciation.test.ts` (extend)

**Interfaces:**
- Consumes: `fa(v)` (module-local formatter); `allowedParts`, `allowedLabour`, `allowedPaint` (already in scope in `buildUIICBillCheckHTML`).
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/reports/__tests__/labour-paint-depreciation.test.ts`:

```typescript
describe('UIIC bill check prints labour and paint estimates', () => {
  const rows = [
    row({ particulars: 'Bumper', partType: 'plastic', estimated: 11000, assessed: 10000 }),
    row({ particulars: 'Fitting', section: 'labour', partType: 'labour', estimated: 4400, assessed: 4000 }),
    row({ particulars: 'Painting', section: 'paint', partType: 'paint', estimated: 6600, assessed: 6000 }),
  ];

  test('each labour and paint row shows its own estimate', () => {
    const html = money(buildUIICBillCheckHTML(claim(rows), null));
    expect(html).toContain('4400.00');
    expect(html).toContain('6600.00');
  });

  test('the grand total estimate covers parts, labour and paint', () => {
    const html = money(buildUIICBillCheckHTML(claim(rows), null));
    // 11000 + 4400 + 6600 = 22000. Previously the total printed 11000.
    expect(html).toContain('22000.00');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/labour-paint-depreciation.test.ts`

Expected: both new cases FAIL — the estimate cells are blank and the total prints `11000.00`.

- [ ] **Step 3: Print the per-row estimates**

In `buildUIICBillCheckHTML`, in `lHtml` replace the `${blank}` that sits immediately after the job-type cell (line 575):

```typescript
      <td style="${td}text-align:right;">${fa(r.estimated)}</td>
```

Make the identical replacement in `ptHtml` at line 589.

- [ ] **Step 4: Give each section subtotal an estimate cell**

Replace the labour subtotal row (lines 745-749):

```typescript
<tr style="font-weight:700;background:#f6f6f6;">
  <td colspan="4" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(allowedLabour.reduce((s, r) => s + r.estimated, 0))}</td>
  <td colspan="4" style="${td}"></td>
  <td style="${td}text-align:right;">${fa(labourAgg.base)}</td>
  ${blank}
</tr>
```

Replace the paint subtotal row (lines 759-762):

```typescript
<tr style="font-weight:700;background:#f6f6f6;">
  <td colspan="4" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(allowedPaint.reduce((s, r) => s + r.estimated, 0))}</td>
  <td colspan="5" style="${td}"></td>
  <td style="${td}text-align:right;">${fa(paintAgg.base)}</td>
</tr>
```

Both rows must still span 11 columns in total — count them before moving on. The header at lines 715-728 defines the column order; the labour amount belongs in the "Labour" column and the paint amount in "Paint".

- [ ] **Step 5: Total the estimate across all three sections**

Replace the grand-total estimate cell at line 771:

```typescript
  <td style="${td}text-align:right;">${fa(
    [...allowedParts, ...allowedLabour, ...allowedPaint].reduce((s, r) => s + r.estimated, 0)
  )}</td>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/lib/reports/__tests__/labour-paint-depreciation.test.ts`

Expected: PASS, 13 tests.

- [ ] **Step 7: Verify the table still renders 11 columns per row**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-format.test.ts`

Expected: PASS. This file asserts the Bill Check document's structure; a miscounted `colspan` shows up here rather than as a visibly broken PDF.

- [ ] **Step 8: Verify the whole suite and the build**

Run: `npm test && npx tsc --noEmit && npm run build`

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/labour-paint-depreciation.test.ts
git commit -m "fix(reports): print labour and paint estimates in UIIC bill check

The estimate column was blank on every labour and paint row, swallowed by
the subtotal colspans, and excluded from the grand total - so the report
understated the workshop estimate by the whole labour + paint amount."
```

---

## Verification checklist

- [ ] `npm test` passes
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` succeeds
- [ ] A claim with no `depOverride` anywhere produces byte-identical reports to before the change
- [ ] Setting 30% on a Labour row changes the figure identically on screen, in the standard report, in the UIIC Final and in the UIIC Bill Check
- [ ] Moving a Parts row with an override into Labour clears the override
- [ ] The UIIC Bill Check grand-total Estimate equals Parts + Labour + Paint
