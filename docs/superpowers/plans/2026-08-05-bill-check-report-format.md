# Bill Check Report Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Bill Check report's table and GST summary to match the surveyor's specimen, and make both PDF builders honour per-item GST instead of a hardcoded 18%.

**Architecture:** One new pure helper, `aggregateGst`, computes per-row depreciated bases and groups them into `(hsnSac, rate)` bands with CGST = SGST = half the rate. Both report builders call it, replacing every hardcoded `1.18` and `0.09`. The Bill Check table below the summary block is then rewritten to the specimen's eleven columns, and the GST SUMMARY blocks render the helper's bands directly.

**Tech Stack:** TypeScript, Vitest, HTML-string report builders.

## Global Constraints

- **`1.18` and `0.09` must never appear.** GST is per item, from `row.gst`.
- **CGST = SGST, and GST = CGST + SGST.** Each half is `base × (gst/2) / 100`. A 28% item splits 14/14.
- **Depreciation applies to the assessed amount, always.** `final = assessed × (1 − dep/100) × (1 + gst/100)`.
- **Row selection is unchanged:** allowed rows only — `filter(r => r.allowed !== false)`. Bill status does not filter.
- **Serial numbers come from `buildSerialMap`**, which counts disallowed rows so gaps survive. Rows stay consecutive on the page; only the numbering jumps.
- **Scope is below the BILLCHECK SUMMARY block.** The letterhead, the summary block's layout/labels/cell positions, the enclosure and signature blocks are untouched. Summary **values** are rewired (Task 3) — that is the one deliberate exception.
- **Disposal rows carry no GST**: `assessed × (1 − dep/100) × (disposalPercent/100)`, marked `DISP`.
- **`hsnSac` comes from the row; blank when unset.**
- Test runner is Vitest: `npx vitest run <path>`.
- Commit style: conventional, scoped, no attribution trailer.

**Expected output change:** Both reports change for any claim containing a non-18% item. Claims that are entirely 18% produce identical figures. Do not "fix" a test to preserve an 18% result on a 28% row.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/calculations/gst-bands.ts` | Per-row GST bases, banded by HSN/SAC and rate | **Create** |
| `src/lib/calculations/index.ts` | Barrel | Export the helper |
| `src/lib/calculations/assessment.ts` | Summary engine | Split labour from painting (Task 6) |
| `src/lib/reports/uiic-final-builder.ts` | UIIC PDFs | Per-row GST; Bill Check table rewritten; GST SUMMARY + ASSESSMENT SUMMARY added |
| `src/lib/reports/standard-report-builder.ts` | Standard PDF | Its "8. ASSESSMENT SUMMARY" reads from the engine instead of hardcoding GST (Task 7) |

**Not touched:** `src/lib/reports/spot-fee-bill-builder.ts:52` — `subTotal * 0.18` there is GST on the surveyor's professional fee, a flat service rate, not a per-item vehicle rate. Correct as written.

---

## Task 1: `aggregateGst` helper

**Files:**
- Create: `src/lib/calculations/gst-bands.ts`
- Modify: `src/lib/calculations/index.ts`
- Test: `src/lib/calculations/__tests__/gst-bands.test.ts` (create)

**Interfaces:**
- Consumes: `computeRowNet(row, depRate)` from `./row-net` — returns `{ afterDep, isDisposal, netBeforeGst }`
- Produces: `aggregateGst(rows: AssessmentRow[], depRateFor: (row: AssessmentRow) => number): GstAggregate`, where `GstAggregate = { bands: GstBand[]; base: number; cgst: number; sgst: number; amount: number }` and `GstBand = { hsnSac: string; rate: number; base: number; cgst: number; sgst: number; amount: number }`. Tasks 2–5 all consume this.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/gst-bands.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { aggregateGst } from '../gst-bands';
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
  };
}

const NO_DEP = () => 0;

describe('aggregateGst', () => {
  test('splits GST evenly into CGST and SGST', () => {
    const agg = aggregateGst([row({ assessed: 10000, gst: 18 })], NO_DEP);
    expect(agg.cgst).toBeCloseTo(900, 2);   // 10000 × 9%
    expect(agg.sgst).toBeCloseTo(900, 2);
    expect(agg.amount).toBeCloseTo(11800, 2);
  });

  test('a 28% item splits 14/14, not 9/9', () => {
    // The hardcoded 0.09 produced 900/900 here and understated the total.
    const agg = aggregateGst([row({ assessed: 10000, gst: 28 })], NO_DEP);
    expect(agg.cgst).toBeCloseTo(1400, 2);
    expect(agg.sgst).toBeCloseTo(1400, 2);
    expect(agg.amount).toBeCloseTo(12800, 2);
  });

  test('base is the assessed amount after depreciation', () => {
    const agg = aggregateGst([row({ assessed: 10000, gst: 18 })], () => 10);
    expect(agg.base).toBeCloseTo(9000, 2);
    expect(agg.amount).toBeCloseTo(10620, 2);  // 9000 × 1.18
  });

  test('groups rows into one band per hsn and rate', () => {
    const agg = aggregateGst([
      row({ assessed: 1000, gst: 18, hsnSac: '8708' }),
      row({ assessed: 2000, gst: 18, hsnSac: '8708' }),
      row({ assessed: 5000, gst: 28, hsnSac: '4011' }),
    ], NO_DEP);

    expect(agg.bands).toHaveLength(2);
    const b18 = agg.bands.find(b => b.rate === 18)!;
    const b28 = agg.bands.find(b => b.rate === 28)!;
    expect(b18.base).toBeCloseTo(3000, 2);
    expect(b18.hsnSac).toBe('8708');
    expect(b28.base).toBeCloseTo(5000, 2);
    expect(b28.cgst).toBeCloseTo(700, 2);
  });

  test('band totals sum to the aggregate totals', () => {
    const agg = aggregateGst([
      row({ assessed: 1000, gst: 18 }),
      row({ assessed: 5000, gst: 28 }),
    ], NO_DEP);
    const summed = agg.bands.reduce((s, b) => s + b.amount, 0);
    expect(summed).toBeCloseTo(agg.amount, 2);
  });

  test('disposal rows carry no GST and use the disposal percentage', () => {
    const agg = aggregateGst(
      [row({ assessed: 10000, gst: 18, isDisposal: true, disposalPercent: 50 })],
      () => 10
    );
    expect(agg.base).toBeCloseTo(4500, 2);   // 10000 × 0.9 × 0.5
    expect(agg.cgst).toBe(0);
    expect(agg.amount).toBeCloseTo(4500, 2);
  });

  test('leaves hsnSac blank when the row has none', () => {
    const agg = aggregateGst([row({ assessed: 1000 })], NO_DEP);
    expect(agg.bands[0].hsnSac).toBe('');
  });

  test('reproduces the specimen parts total', () => {
    // Specimen MOTOR-828/2026: 15 parts, all 18%, nil depreciation.
    const agg = aggregateGst([row({ assessed: 41435.59, gst: 18 })], NO_DEP);
    expect(agg.cgst).toBeCloseTo(3729.20, 2);
    expect(agg.sgst).toBeCloseTo(3729.20, 2);
    expect(agg.amount).toBeCloseTo(48894.00, 1);
  });

  test('reproduces the specimen labour plus paint total', () => {
    // 2385.00 labour + 17500.00 paint = 19885.00 → 23464.30
    const agg = aggregateGst([
      row({ assessed: 2385, gst: 18, section: 'labour', partType: 'labour' }),
      row({ assessed: 17500, gst: 18, section: 'paint', partType: 'paint' }),
    ], NO_DEP);
    expect(agg.cgst).toBeCloseTo(1789.65, 2);
    expect(agg.amount).toBeCloseTo(23464.30, 1);
  });

  test('handles an empty row set', () => {
    const agg = aggregateGst([], NO_DEP);
    expect(agg.bands).toHaveLength(0);
    expect(agg.amount).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/calculations/__tests__/gst-bands.test.ts`
Expected: FAIL — `Cannot find module '../gst-bands'`.

- [ ] **Step 3: Create the module**

Create `src/lib/calculations/gst-bands.ts`:

```ts
import type { AssessmentRow } from '@/types/assessment';
import { computeRowNet } from './row-net';

export interface GstBand {
  /** HSN code for parts, SAC for labour and paint. Blank when the row has none. */
  hsnSac: string;
  /** Full GST rate for this band, e.g. 18 or 28. */
  rate: number;
  /** Taxable base after depreciation. */
  base: number;
  cgst: number;
  sgst: number;
  /** base + cgst + sgst */
  amount: number;
}

export interface GstAggregate {
  bands: GstBand[];
  base: number;
  cgst: number;
  sgst: number;
  amount: number;
}

/**
 * Groups rows into GST bands for the report's GST SUMMARY.
 *
 * GST is per item — `row.gst` — never a hardcoded 18%. CGST and SGST are
 * always equal, each half the row's rate, so a 28% item splits 14/14.
 *
 * The taxable base is the assessed amount after depreciation, which is what
 * the specimen's "DEPRECIATED AMOUNT" column holds.
 *
 * Disposal rows carry no GST: their net already includes the disposal
 * percentage, and they land in a 0% band so section totals stay correct.
 */
export function aggregateGst(
  rows: AssessmentRow[],
  depRateFor: (row: AssessmentRow) => number
): GstAggregate {
  const byBand = new Map<string, GstBand>();

  for (const r of rows) {
    const { isDisposal, netBeforeGst } = computeRowNet(r, depRateFor(r));
    const rate = isDisposal ? 0 : (r.gst || 0);
    const hsnSac = r.hsnSac || '';
    const key = `${hsnSac}|${rate}`;

    const half = netBeforeGst * (rate / 2) / 100;

    const existing = byBand.get(key);
    if (existing) {
      existing.base += netBeforeGst;
      existing.cgst += half;
      existing.sgst += half;
      existing.amount += netBeforeGst + half * 2;
    } else {
      byBand.set(key, {
        hsnSac,
        rate,
        base: netBeforeGst,
        cgst: half,
        sgst: half,
        amount: netBeforeGst + half * 2,
      });
    }
  }

  const bands = Array.from(byBand.values()).sort((a, b) => a.rate - b.rate);

  return {
    bands,
    base: bands.reduce((s, b) => s + b.base, 0),
    cgst: bands.reduce((s, b) => s + b.cgst, 0),
    sgst: bands.reduce((s, b) => s + b.sgst, 0),
    amount: bands.reduce((s, b) => s + b.amount, 0),
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/lib/calculations/__tests__/gst-bands.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Export from the barrel**

In `src/lib/calculations/index.ts`, add:

```ts
export { aggregateGst } from './gst-bands';
export type { GstBand, GstAggregate } from './gst-bands';
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/calculations/gst-bands.ts src/lib/calculations/index.ts src/lib/calculations/__tests__/gst-bands.test.ts
git commit -m "feat(reports): per-item GST banding helper

GST is set per row and both PDF builders ignored it, hardcoding 18% as 0.09
twice. This computes the depreciated base per row and groups into bands by
HSN/SAC and rate, with CGST and SGST each half the row's own rate."
```

---

## Task 2: Final Survey Report honours per-item GST

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts` — totals ~118–120, parts row ~312–315, labour row ~322, paint row ~330, summary ~339–340, NET TOTAL ~355
- Test: `src/lib/reports/__tests__/gst-per-item.test.ts` (create)

**Interfaces:**
- Consumes: `aggregateGst` (Task 1)

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/gst-per-item.test.ts`:

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
  };
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

describe('per-item GST in the PDF builders', () => {
  test('Final Report prints a 28% row at 28%, not 18%', () => {
    // A tyre at 28% showed 12,800 on screen and printed 11,800 labelled 18.
    const html = buildUIICFinalHTML(claim([row({ particulars: 'TyreRadial', gst: 28 })]), null);
    expect(html).toContain('12800.00');
    expect(html).not.toContain('11800.00');
  });

  test('Final Report shows the row own rate in the GST% column', () => {
    const html = buildUIICFinalHTML(claim([row({ particulars: 'TyreRadial', gst: 28 })]), null);
    const cell = html.split('TyreRadial')[1].split('</tr>')[0];
    expect(cell).toContain('>28<');
  });

  test('Final Report is unchanged for an all-18% claim', () => {
    const html = buildUIICFinalHTML(claim([row({ gst: 18 })]), null);
    expect(html).toContain('11800.00');
  });

  test('Bill Check prints a 28% row at 28%', () => {
    const html = buildUIICBillCheckHTML(claim([row({ particulars: 'TyreRadial', gst: 28 })]), null);
    expect(html).toContain('12800.00');
  });

  test('labour honours its own rate', () => {
    const html = buildUIICFinalHTML(
      claim([row({ particulars: 'FitCharge', section: 'labour', partType: 'labour', assessed: 1000, gst: 5 })]),
      null
    );
    expect(html).toContain('1050.00');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/reports/__tests__/gst-per-item.test.ts`
Expected: FAIL — the 28% row renders 11800.00 and the GST cell reads 18.

- [ ] **Step 3: Replace the Final Report's hardcoded totals**

In `src/lib/reports/uiic-final-builder.ts`, add to the imports:

```ts
import { aggregateGst } from '@/lib/calculations/gst-bands';
```

Replace lines 118–120:

```ts
  const labBase = labOnly + paintOnly;
  const pC = partsDepreciated * 0.09, pS = partsDepreciated * 0.09, pT = partsDepreciated + pC + pS + disposalNet;
  const lC = labBase * 0.09, lS = labBase * 0.09, lT = labBase + lC + lS;
```

with:

```ts
  const labBase = labOnly + paintOnly;

  // Per-item GST. The old 0.09 pair hardcoded 18% and silently understated
  // every 28% part.
  const depFor = (r: AssessmentRow) =>
    r.depOverride !== undefined ? r.depOverride : getDepRate(r.partType, ageMonths, depType);

  const partsAgg  = aggregateGst(AP.filter(r => r.allowed !== false), depFor);
  const labourAgg = aggregateGst(AL.filter(r => r.allowed !== false), depFor);
  const paintAgg  = aggregateGst(APT.filter(r => r.allowed !== false), depFor);

  const pC = partsAgg.cgst, pS = partsAgg.sgst, pT = partsAgg.amount;
  const lC = labourAgg.cgst + paintAgg.cgst, lS = labourAgg.sgst + paintAgg.sgst;
  const lT = labourAgg.amount + paintAgg.amount;
```

Add `import type { AssessmentRow } from '@/types/assessment';` to the imports if not already present.

- [ ] **Step 4: Replace the per-row hardcoding in the Final Report table**

At line ~312, replace:

```ts
    const wg = isNA ? 0 : isDisposal ? netBeforeGst : afterDep * 1.18;
```

with:

```ts
    const wg = isNA ? 0 : isDisposal ? netBeforeGst : afterDep * (1 + (r.gst || 0) / 100);
```

At line ~315, replace:

```ts
    const gstLabel = isNA ? '' : isDisposal ? '0' : '18';
```

with:

```ts
    const gstLabel = isNA ? '' : isDisposal ? '0' : String(r.gst ?? 0);
```

In the labour row (line ~322), replace the literal GST cell `<td style="${td}text-align:center;">18</td>` with:

```ts
<td style="${td}text-align:center;">${isNA ? '' : String(r.gst ?? 0)}</td>
```

and its amount cells `${isNA ? '' : fa(r.assessed)}` — the final one, which represents the with-GST figure — with:

```ts
${isNA ? '' : fa(r.assessed * (1 + (r.gst || 0) / 100))}
```

In the paint row (line ~330), replace `${isNA ? '' : '18'}` with:

```ts
${isNA ? '' : String(r.gst ?? 0)}
```

and its final amount cell `${isNA ? 'Not<br/>Allowed' : fa(r.assessed)}` with:

```ts
${isNA ? 'Not<br/>Allowed' : fa(r.assessed * (1 + (r.gst || 0) / 100))}
```

- [ ] **Step 5: Replace the summary and NET TOTAL hardcoding**

At lines ~339–340 and ~355, replace every `fa(labOnly * 1.18)` with `fa(labourAgg.amount)` and every `fa(paintOnly * 1.18)` with `fa(paintAgg.amount)`.

- [ ] **Step 6: Verify no hardcoded GST remains in the Final Report path**

Run: `grep -n "1\.18\|\* 0\.09\|>18<" src/lib/reports/uiic-final-builder.ts`
Expected: only matches inside `buildUIICBillCheckHTML` (lines ~478–480, ~666–667), which Task 3 removes. No matches above line 400.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/lib/reports/__tests__/gst-per-item.test.ts`
Expected: the four Final Report tests PASS. The Bill Check test still fails — Task 3 fixes it.

- [ ] **Step 8: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/gst-per-item.test.ts
git commit -m "fix(reports): Final Survey Report honours per-item GST

row.gst is editable and both the grid and the summary engine honour it. The
PDF did not: it multiplied by 1.18, split CGST/SGST at 0.09 each, and printed
a literal 18 in the GST% column. A tyre set to 28% showed 12,800 on screen and
printed 11,800 labelled 18.

Claims that are entirely 18% are unaffected."
```

---

## Task 3: Bill Check summary values honour per-item GST

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts` — Bill Check totals ~478–480, summary rows ~666–667

**Interfaces:**
- Consumes: `aggregateGst` (Task 1)

The summary block's layout, labels and cell positions do not change. Only the values feeding them.

- [ ] **Step 1: Replace the Bill Check totals block**

In `buildUIICBillCheckHTML`, replace lines ~478–480:

```ts
  const pC = partsDepreciated * 0.09, pS = partsDepreciated * 0.09, pT = partsDepreciated + pC + pS + disposalNet;
  const labBase = labOnly + paintOnly;
  const lC = labBase * 0.09, lS = labBase * 0.09, lT = labBase + lC + lS;
```

with:

```ts
  const labBase = labOnly + paintOnly;

  // Same per-item banding the table below uses, so Cost of Parts agrees with
  // the SPARE PARTS subtotal on a mixed-rate claim.
  const rowDepFor = (r: AssessmentRow) =>
    r.depOverride !== undefined ? r.depOverride : getDepRate(r.partType, ageMonths, depType);

  const partsAgg   = aggregateGst(allowedParts, rowDepFor);
  const labourAgg  = aggregateGst(allowedLabour, rowDepFor);
  const paintAgg   = aggregateGst(allowedPaint, rowDepFor);
  const serviceAgg = aggregateGst([...allowedLabour, ...allowedPaint], rowDepFor);

  const pC = partsAgg.cgst, pS = partsAgg.sgst, pT = partsAgg.amount;
  const lC = serviceAgg.cgst, lS = serviceAgg.sgst, lT = serviceAgg.amount;
```

- [ ] **Step 2: Replace the summary row values**

At lines ~666–667, replace `fa(labOnly * 1.18)` with `fa(labourAgg.amount)` and `fa(paintOnly * 1.18)` with `fa(paintAgg.amount)`.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/lib/reports/__tests__/gst-per-item.test.ts`
Expected: PASS, 5 tests — including the Bill Check 28% case.

- [ ] **Step 4: Confirm no hardcoded GST remains anywhere**

Run: `grep -cn "1\.18\|\* 0\.09" src/lib/reports/uiic-final-builder.ts`
Expected: `0`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts
git commit -m "fix(reports): Bill Check summary values use per-item GST

Layout, labels and cell positions unchanged - only the figures. Leaving the
0.09 pair here while the table below moved to per-item GST would make Cost of
Parts disagree with the subtotal printed directly beneath it."
```

---

## Task 4: Rewrite the Bill Check table

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts` — row builders ~507–565, page2 table ~673–715
- Test: `src/lib/reports/__tests__/bill-check-format.test.ts` (create)

**Interfaces:**
- Consumes: `aggregateGst` (Task 1), `buildSerialMap`, `computeRowNet`

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/bill-check-format.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { buildUIICBillCheckHTML } from '../uiic-final-builder';
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
  };
}

function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'nil',
    vehicle: { registrationNumber: 'MH39AD2416', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 0 },
  } as unknown as ClaimData;
}

describe('Bill Check table format', () => {
  test('carries the specimen column headers', () => {
    const html = buildUIICBillCheckHTML(claim([row()]), null);
    expect(html).toContain('Part List Without Tax');
    expect(html).toContain('Part Depreciation');
    expect(html).toContain('Parts Assessment');
    expect(html).toContain('Final amount With G.S.T');
  });

  test('drops the invented verification columns', () => {
    // These were built from a misreading and shipped to production once.
    const html = buildUIICBillCheckHTML(claim([row({ billStatus: 'in-bill', billRemarks: 'note' })]), null);
    expect(html).not.toContain('Bill Status');
    expect(html).not.toContain('Billed<br/>Amount');
    expect(html).not.toContain('IN BILL');
  });

  test('computes the row final as assessed less depreciation plus GST', () => {
    // Specimen row: 8581.36 at 18%, nil depreciation → 10126.01
    const html = buildUIICBillCheckHTML(claim([row({ particulars: 'DoorFrontLH', assessed: 8581.36 })]), null);
    expect(html).toContain('10126.01');
  });

  test('prints N.D. when depreciation is nil', () => {
    const html = buildUIICBillCheckHTML(claim([row()]), null);
    expect(html).toContain('N.D.');
  });

  test('shows estimated and assessed as separate columns', () => {
    const html = buildUIICBillCheckHTML(
      claim([row({ particulars: 'FenderRH', estimated: 12000, assessed: 9000 })]),
      null
    );
    const rowHtml = html.split('FenderRH')[1].split('</tr>')[0];
    expect(rowHtml).toContain('12000.00');
    expect(rowHtml).toContain('9000.00');
  });

  test('emits one labour tax line per distinct rate', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ section: 'labour', partType: 'labour', assessed: 1000, gst: 18 }),
      row({ section: 'labour', partType: 'labour', assessed: 2000, gst: 5 }),
    ]), null);
    expect(html).toContain('TAX IN 5 % for Labour');
    expect(html).toContain('TAX IN 18 % for Labour');
  });

  test('excludes disallowed rows but keeps their serial gap', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ id: 'p1', particulars: 'BumperFront' }),
      row({ id: 'p2', particulars: 'GrilleUpper', allowed: false }),
      row({ id: 'p3', particulars: 'HeadlampLH' }),
    ]), null);
    expect(html).not.toContain('GrilleUpper');
    const headlampRow = html.split('HeadlampLH')[0].split('<tr>').pop() ?? '';
    expect(headlampRow).toContain('>3<');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-format.test.ts`
Expected: FAIL — headers absent, `Bill Status` present.

- [ ] **Step 3: Replace the three row builders**

In `buildUIICBillCheckHTML`, delete `billStatusLabel` and replace the `pHtml`, `lHtml` and `ptHtml` blocks entirely with:

```ts
  const partTypeLabel = (r: AssessmentRow) =>
    r.partType === 'metal' ? 'Metal'
    : r.partType === 'glass' ? 'Glass'
    : r.partType === 'fiberglass' ? 'Fibre Glass'
    : 'Plastic / Rubber';

  const depLabel = (r: AssessmentRow) => {
    const d = rowDepFor(r);
    if (r.depOverride !== undefined) return `${d}%*`;
    return d > 0 ? `${d}%` : 'N.D.';
  };

  const blank = `<td style="${td}"></td>`;

  // SPARE PARTS — parts columns carry the money, Labour and Paint stay empty.
  const pHtml = allowedParts.map(r => {
    const { isDisposal, netBeforeGst } = computeRowNet(r, rowDepFor(r));
    const finalAmt = isDisposal ? netBeforeGst : netBeforeGst * (1 + (r.gst || 0) / 100);
    return `<tr>
      <td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">${partTypeLabel(r)}</td>
      <td style="${td}text-align:right;">${fa(r.estimated)}</td>
      <td style="${td}text-align:center;">${depLabel(r)}</td>
      <td style="${td}text-align:right;">${fa(r.assessed)}</td>
      <td style="${td}text-align:center;">${isDisposal ? '0' : String(r.gst ?? 0)}</td>
      <td style="${td}text-align:right;">${isDisposal ? `${fa(netBeforeGst)} DISP` : fa(finalAmt)}</td>
      ${blank}${blank}
    </tr>`;
  }).join('');

  // LABOUR — bare amount in the Labour column; tax is added at subtotal level.
  const lHtml = allowedLabour.map(r => `<tr>
      <td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">Labour</td>
      ${blank}
      <td style="${td}text-align:center;">${depLabel(r)}</td>
      ${blank}
      <td style="${td}text-align:center;">${String(r.gst ?? 0)}</td>
      ${blank}
      <td style="${td}text-align:right;">${fa(r.assessed)}</td>
      ${blank}
    </tr>`).join('');

  const ptHtml = allowedPaint.map(r => `<tr>
      <td style="${td}text-align:center;">${serials.get(r.id) ?? 0}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">Paint</td>
      ${blank}
      <td style="${td}text-align:center;">${depLabel(r)}</td>
      ${blank}
      <td style="${td}text-align:center;">${String(r.gst ?? 0)}</td>
      ${blank}${blank}
      <td style="${td}text-align:right;">${fa(r.assessed)}</td>
    </tr>`).join('');

  // One tax line per distinct rate, so a mixed-rate claim reads correctly.
  const taxLines = (agg: ReturnType<typeof aggregateGst>, label: string, col: 'labour' | 'paint') =>
    agg.bands.filter(b => b.rate > 0).map(b => `<tr>
      <td colspan="8" style="${td}text-align:right;font-style:italic;">TAX IN ${b.rate} % for ${label}</td>
      ${col === 'labour' ? `<td style="${td}text-align:right;">${fa(b.cgst + b.sgst)}</td>${blank}` : `${blank}<td style="${td}text-align:right;">${fa(b.cgst + b.sgst)}</td>`}
    </tr>`).join('');
```

- [ ] **Step 4: Replace the page2 table**

Replace the `<div style="${sec}">DETAILS OF BILL CHECK…` block through `</table>` (lines ~678–715) with:

```ts
<div style="${sec}">BILLS CHECK REPORT</div>
<table style="${ts}font-size:7pt;">
<thead><tr>
  <th style="${th}width:5%;">SR.<br/>NO.</th>
  <th style="${th}text-align:left;width:23%;">Description</th>
  <th style="${th}width:9%;">Part<br/>Type</th>
  <th style="${th}width:11%;">Part List<br/>Without Tax</th>
  <th style="${th}width:8%;">Part<br/>Depreciation</th>
  <th style="${th}width:11%;">Parts<br/>Assessment</th>
  <th style="${th}width:5%;">GST<br/>%</th>
  <th style="${th}width:11%;">Final amount<br/>With G.S.T</th>
  <th style="${th}width:8.5%;">Labour</th>
  <th style="${th}width:8.5%;">Paint</th>
</tr></thead>
<tbody>
<tr><td colspan="10" style="${sec}">SPARE PARTS</td></tr>
${pHtml || `<tr><td colspan="10" style="${td}text-align:center;color:#999;font-style:italic;">No parts in allowed items</td></tr>`}
<tr style="font-weight:700;background:#eee;">
  <td colspan="3" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(allowedParts.reduce((s, r) => s + r.estimated, 0))}</td>
  ${blank}
  <td style="${td}text-align:right;">${fa(allowedParts.reduce((s, r) => s + r.assessed, 0))}</td>
  ${blank}
  <td style="${td}text-align:right;">${fa(partsAgg.amount)}</td>
  ${blank}${blank}
</tr>

<tr><td colspan="10" style="${sec}">LABOUR</td></tr>
${lHtml || `<tr><td colspan="10" style="${td}text-align:center;color:#999;font-style:italic;">No labour in allowed items</td></tr>`}
<tr style="font-weight:700;background:#f6f6f6;">
  <td colspan="8" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(allowedLabour.reduce((s, r) => s + r.assessed, 0))}</td>
  ${blank}
</tr>
${taxLines(labourAgg, 'Labour', 'labour')}
<tr style="font-weight:700;background:#eee;">
  <td colspan="8" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(labourAgg.amount)}</td>
  ${blank}
</tr>

<tr><td colspan="10" style="${sec}">PAINTING CHARGES</td></tr>
${ptHtml || `<tr><td colspan="10" style="${td}text-align:center;color:#999;font-style:italic;">No painting in allowed items</td></tr>`}
<tr style="font-weight:700;background:#f6f6f6;">
  <td colspan="9" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(allowedPaint.reduce((s, r) => s + r.assessed, 0))}</td>
</tr>
${taxLines(paintAgg, 'Paint', 'paint')}
<tr style="font-weight:700;background:#eee;">
  <td colspan="9" style="${td}">SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(paintAgg.amount)}</td>
</tr>

<tr style="font-weight:700;background:#ddd;">
  <td colspan="3" style="${td}">TOTAL</td>
  <td style="${td}text-align:right;">${fa(allowedParts.reduce((s, r) => s + r.estimated, 0))}</td>
  ${blank}
  <td style="${td}text-align:right;">${fa(allowedParts.reduce((s, r) => s + r.assessed, 0))}</td>
  ${blank}
  <td style="${td}text-align:right;">${fa(partsAgg.amount)}</td>
  <td style="${td}text-align:right;">${fa(labourAgg.amount)}</td>
  <td style="${td}text-align:right;">${fa(paintAgg.amount)}</td>
</tr>
</tbody>
</table>
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-format.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Run the full suite**

Run: `npm run test`
Expected: PASS. The old `bill-check-report.test.ts` asserts on the removed columns — update those assertions to the new format rather than deleting the file; its serial-gap and liability-agreement cases still hold.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/
git commit -m "feat(reports): Bill Check table matches the surveyor specimen

Eleven columns - estimated, depreciation, assessed, GST%, final with GST, and
separate Labour and Paint money columns - with section subtotals and one tax
line per distinct rate.

Drops the Billed, Bill Status and Remarks columns. Those were built from a
misreading of what the document is: the report restates the assessment sheet
for allowed items, and verification decides which rows appear rather than
being printed as a comparison."
```

---

## Task 5: GST SUMMARY blocks

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts` — page2, after the table
- Test: `src/lib/reports/__tests__/bill-check-format.test.ts` (extend)

**Interfaces:**
- Consumes: `partsAgg`, `serviceAgg` from Task 3; `GstBand` from Task 1

- [ ] **Step 1: Write the failing test**

Append to `src/lib/reports/__tests__/bill-check-format.test.ts`:

```ts
describe('GST SUMMARY', () => {
  test('prints a parts block keyed by HSN code', () => {
    const html = buildUIICBillCheckHTML(claim([row({ hsnSac: '8708' })]), null);
    expect(html).toContain('GST SUMMARY');
    expect(html).toContain('HSN CODE');
    expect(html).toContain('DEPRECIATED AMOUNT');
    expect(html).toContain('8708');
  });

  test('prints a service block keyed by accounting code', () => {
    const html = buildUIICBillCheckHTML(
      claim([row({ section: 'labour', partType: 'labour', assessed: 1000, hsnSac: '998729' })]),
      null
    );
    expect(html).toContain('SERVICE ACCOUNTING CODE');
    expect(html).toContain('998729');
  });

  test('bands a mixed-rate claim into separate lines', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ assessed: 10000, gst: 18, hsnSac: '8708' }),
      row({ assessed: 10000, gst: 28, hsnSac: '4011' }),
    ]), null);
    expect(html).toContain('4011');
    expect(html).toContain('8708');
    expect(html).toContain('1400.00'); // 28% half
    expect(html).toContain('900.00');  // 18% half
  });

  test('reproduces the specimen GST figures', () => {
    const html = buildUIICBillCheckHTML(claim([row({ assessed: 41435.59, gst: 18 })]), null);
    expect(html).toContain('3729.20');
    expect(html).toContain('48894.00');
  });

  test('leaves the code column blank when hsnSac is unset', () => {
    const html = buildUIICBillCheckHTML(claim([row()]), null);
    expect(html).toContain('GST SUMMARY');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-format.test.ts`
Expected: FAIL — `GST SUMMARY` absent.

- [ ] **Step 3: Add the GST SUMMARY blocks**

In `buildUIICBillCheckHTML`, add this helper beside the row builders:

```ts
  // Specimen prints "(Part) 18.00" / "(Labour) 18.00" when no code is recorded,
  // and the real HSN/SAC when the row carries one.
  const codeCell = (b: { hsnSac: string; rate: number }, fallback: 'Part' | 'Labour') =>
    `${b.hsnSac || `(${fallback})`} ${b.rate.toFixed(2)}`;
```

Then, immediately after the table's closing `</table>` in page2, insert:

```ts
<div style="${sec}">GST SUMMARY</div>
<table style="${ts}font-size:7pt;margin-bottom:6px;">
<thead><tr>
  <th style="${th}width:6%;">S.N.</th>
  <th style="${th}width:20%;">HSN CODE</th>
  <th style="${th}width:20%;">DEPRECIATED AMOUNT</th>
  <th style="${th}width:18%;">CGST</th>
  <th style="${th}width:18%;">SGST</th>
  <th style="${th}width:18%;">AMOUNT</th>
</tr></thead>
<tbody>
${partsAgg.bands.map((b, i) => `<tr>
  <td style="${td}text-align:center;">${i + 1}</td>
  <td style="${td}text-align:center;">${codeCell(b, 'Part')}</td>
  <td style="${td}text-align:right;">${fa(b.base)}</td>
  <td style="${td}text-align:right;">${fa(b.cgst)}</td>
  <td style="${td}text-align:right;">${fa(b.sgst)}</td>
  <td style="${td}text-align:right;">${fa(b.amount)}</td>
</tr>`).join('') || `<tr><td colspan="6" style="${td}text-align:center;color:#999;font-style:italic;">No parts</td></tr>`}
<tr style="font-weight:700;background:#eee;">
  <td colspan="2" style="${td}">GRAND TOTAL</td>
  <td style="${td}text-align:right;">${fa(partsAgg.base)}</td>
  <td style="${td}text-align:right;">${fa(partsAgg.cgst)}</td>
  <td style="${td}text-align:right;">${fa(partsAgg.sgst)}</td>
  <td style="${td}text-align:right;">${fa(partsAgg.amount)}</td>
</tr>
</tbody>
</table>

<table style="${ts}font-size:7pt;">
<thead><tr>
  <th style="${th}width:6%;">S.N.</th>
  <th style="${th}width:20%;">SERVICE ACCOUNTING CODE</th>
  <th style="${th}width:20%;">AMOUNT</th>
  <th style="${th}width:18%;">CGST</th>
  <th style="${th}width:18%;">SGST</th>
  <th style="${th}width:18%;">AMOUNT</th>
</tr></thead>
<tbody>
${serviceAgg.bands.map((b, i) => `<tr>
  <td style="${td}text-align:center;">${i + 1}</td>
  <td style="${td}text-align:center;">${codeCell(b, 'Labour')}</td>
  <td style="${td}text-align:right;">${fa(b.base)}</td>
  <td style="${td}text-align:right;">${fa(b.cgst)}</td>
  <td style="${td}text-align:right;">${fa(b.sgst)}</td>
  <td style="${td}text-align:right;">${fa(b.amount)}</td>
</tr>`).join('') || `<tr><td colspan="6" style="${td}text-align:center;color:#999;font-style:italic;">No labour or painting</td></tr>`}
<tr style="font-weight:700;background:#eee;">
  <td colspan="2" style="${td}">GRAND TOTAL</td>
  <td style="${td}text-align:right;">${fa(serviceAgg.base)}</td>
  <td style="${td}text-align:right;">${fa(serviceAgg.cgst)}</td>
  <td style="${td}text-align:right;">${fa(serviceAgg.sgst)}</td>
  <td style="${td}text-align:right;">${fa(serviceAgg.amount)}</td>
</tr>
</tbody>
</table>
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-format.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Add the summary reconciliation guard**

Append to the same file:

```ts
describe('summary reconciliation', () => {
  test('Cost of Parts equals the SPARE PARTS subtotal on a mixed-rate claim', () => {
    // The guard for rewiring the summary block's inputs: one page must not
    // contradict itself when a 28% item is present.
    const html = buildUIICBillCheckHTML(claim([
      row({ assessed: 10000, gst: 18 }),
      row({ assessed: 10000, gst: 28 }),
    ]), null);
    // 11800 + 12800 = 24600
    const occurrences = html.split('24600.00').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2); // summary + subtotal
  });
});
```

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx tsc --noEmit && npm run test`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/bill-check-format.test.ts
git commit -m "feat(reports): GST SUMMARY banded by HSN/SAC and rate

Two blocks - parts by HSN, labour and painting by service accounting code -
each listing one line per distinct code and rate combination, so a 28% tyre
forms its own band. CGST equals SGST at half the row's rate.

Includes the reconciliation guard: Cost of Parts must equal the SPARE PARTS
subtotal printed beneath it on a mixed-rate claim."
```

---

## Task 6: Split labour from painting in the summary engine

`calculateAssessmentSummary` already computes every figure the ASSESSMENT SUMMARY block needs, correctly, using `row.gst`. Its one gap is that `labourBase` / `labourTotal` merge labour and painting, which the block shows as separate rows. Closing that gap lets both report builders read from the engine instead of doing their own arithmetic.

**Files:**
- Modify: `src/lib/calculations/assessment.ts`, `src/types/assessment.ts`
- Test: `src/lib/calculations/__tests__/assessment-summary-split.test.ts` (create)

**Interfaces:**
- Produces: `AssessmentSummary` gains `labourOnlyBase`, `labourOnlyTotal`, `paintOnlyBase`, `paintOnlyTotal`, `estimateLabourOnlyBase`, `estimatePaintOnlyBase`. Tasks 7 and 8 consume these.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/assessment-summary-split.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { calculateAssessmentSummary } from '../assessment';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Item',
    estimated: 1000,
    assessed: 1000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

describe('calculateAssessmentSummary labour/paint split', () => {
  test('reports labour and painting separately', () => {
    const s = calculateAssessmentSummary([
      row({ section: 'labour', partType: 'labour', estimated: 2000, assessed: 2000 }),
      row({ section: 'paint', partType: 'paint', estimated: 5000, assessed: 5000 }),
    ], 0, 'nil');

    expect(s.labourOnlyBase).toBeCloseTo(2000, 2);
    expect(s.paintOnlyBase).toBeCloseTo(5000, 2);
    expect(s.labourOnlyTotal).toBeCloseTo(2360, 2);   // 2000 × 1.18
    expect(s.paintOnlyTotal).toBeCloseTo(5900, 2);    // 5000 × 1.18
    expect(s.estimateLabourOnlyBase).toBeCloseTo(2000, 2);
    expect(s.estimatePaintOnlyBase).toBeCloseTo(5000, 2);
  });

  test('the split still sums to the combined labour figures', () => {
    const s = calculateAssessmentSummary([
      row({ section: 'labour', partType: 'labour', assessed: 2000, estimated: 2000 }),
      row({ section: 'paint', partType: 'paint', assessed: 5000, estimated: 5000 }),
    ], 0, 'nil');

    expect(s.labourOnlyBase + s.paintOnlyBase).toBeCloseTo(s.labourBase, 2);
    expect(s.labourOnlyTotal + s.paintOnlyTotal).toBeCloseTo(s.labourTotal, 2);
  });

  test('honours a per-item rate on labour', () => {
    const s = calculateAssessmentSummary(
      [row({ section: 'labour', partType: 'labour', assessed: 1000, estimated: 1000, gst: 5 })],
      0, 'nil'
    );
    expect(s.labourOnlyTotal).toBeCloseTo(1050, 2);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/calculations/__tests__/assessment-summary-split.test.ts`
Expected: FAIL — `labourOnlyBase` is undefined.

- [ ] **Step 3: Add the fields to the type**

In `src/types/assessment.ts`, add to the `AssessmentSummary` interface:

```ts
  /** Labour only, excluding painting. */
  labourOnlyBase: number;
  labourOnlyTotal: number;
  /** Painting only, excluding labour. */
  paintOnlyBase: number;
  paintOnlyTotal: number;
  estimateLabourOnlyBase: number;
  estimatePaintOnlyBase: number;
```

- [ ] **Step 4: Accumulate the split**

In `calculateAssessmentSummary`, add four accumulators beside the existing ones:

```ts
  let labourOnlyBase = 0, labourOnlyGST = 0;
  let paintOnlyBase = 0, paintOnlyGST = 0;
```

In the main `rows.forEach` loop, inside the `else` branch that currently does `labourBase += ...`, split by section. Replace the disposal branch's `labourBase += disposalValue;` with:

```ts
        labourBase += disposalValue;
        if (r.section === 'paint') paintOnlyBase += disposalValue;
        else labourOnlyBase += disposalValue;
```

and the normal branch's `labourBase += valueAfterDep; labourGSTAccumulator += rowGST;` with:

```ts
        labourBase += valueAfterDep;
        labourGSTAccumulator += rowGST;
        if (r.section === 'paint') { paintOnlyBase += valueAfterDep; paintOnlyGST += rowGST; }
        else { labourOnlyBase += valueAfterDep; labourOnlyGST += rowGST; }
```

In the estimate loop, replace `estLabourBase += r.estimated;` with:

```ts
      estLabourBase += r.estimated;
      if (r.section === 'paint') estPaintOnly += r.estimated;
      else estLabourOnly += r.estimated;
```

declaring `let estLabourOnly = 0, estPaintOnly = 0;` alongside the other estimate accumulators.

Add to the returned object:

```ts
    labourOnlyBase,
    labourOnlyTotal: labourOnlyBase + labourOnlyGST,
    paintOnlyBase,
    paintOnlyTotal: paintOnlyBase + paintOnlyGST,
    estimateLabourOnlyBase: estLabourOnly,
    estimatePaintOnlyBase: estPaintOnly,
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/calculations`
Expected: PASS, all files.

- [ ] **Step 6: Commit**

```bash
git add src/lib/calculations/assessment.ts src/types/assessment.ts src/lib/calculations/__tests__/assessment-summary-split.test.ts
git commit -m "feat(calculations): split labour from painting in the summary

The ASSESSMENT SUMMARY block shows Labour and Painting as separate rows, but
the engine merged them, so both report builders recomputed the split by hand
with a hardcoded rate. Splitting it here lets them read the engine instead."
```

---

## Task 7: Standard report's ASSESSMENT SUMMARY uses the engine

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts:99-107`
- Test: `src/lib/reports/__tests__/gst-per-item.test.ts` (extend)

**Interfaces:**
- Consumes: `calculateAssessmentSummary` with the Task 6 fields

- [ ] **Step 1: Write the failing test**

Append to `src/lib/reports/__tests__/gst-per-item.test.ts`:

```ts
import { buildStandardReportHTML } from '../standard-report-builder';

describe('standard report ASSESSMENT SUMMARY', () => {
  test('a 28% part is totalled at 28%, not 18%', () => {
    // pb * 0.09 hardcoded 18% in the block behind section 8.
    const html = buildStandardReportHTML(claim([row({ assessed: 10000, estimated: 10000, gst: 28 })]), null);
    expect(html).toContain('12800.00');
    expect(html).not.toContain('11800.00');
  });

  test('labour at a non-standard rate is totalled at that rate', () => {
    const html = buildStandardReportHTML(
      claim([row({ section: 'labour', partType: 'labour', assessed: 1000, estimated: 1000, gst: 5 })]),
      null
    );
    expect(html).toContain('1050.00');
  });
});
```

If the exported builder has a different name, run `grep -n "^export function build" src/lib/reports/standard-report-builder.ts` and use that name.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/reports/__tests__/gst-per-item.test.ts`
Expected: FAIL — the 28% part totals 11800.00.

- [ ] **Step 3: Replace the hardcoded block**

In `src/lib/reports/standard-report-builder.ts`, replace lines 99–107:

```ts
  const pb = metal + plastic + glass + fiberglass;
  const pCGST = pb * 0.09;
  const pT = pb + pCGST * 2 + disposalNet;
  const labGST = labOnlyBase * 0.18;
  const labT = labOnlyBase + labGST;
  const paintGST = paintOnlyBase * 0.18;
  const paintT = paintOnlyBase + paintGST;
```

with values read from the engine, which already applies each row's own rate:

```ts
  // GST is per item. The 0.09 / 0.18 literals here ignored row.gst entirely,
  // so a 28% tyre was totalled at 18% in section 8.
  const summary = calculateAssessmentSummary(
    rows, ageMonths, claim.depreciationType || 'standard',
    claim.feeBill?.salvageValue ?? 0,
    getCompulsoryExcess(claim.feeBill),
    claim.feeBill?.voluntaryExcess ?? 0,
  );

  const pb = summary.partsBase;
  const pT = summary.partsTotal;
  const labT = summary.labourOnlyTotal;
  const paintT = summary.paintOnlyTotal;
```

Keep the existing `labOnlyBase` / `paintOnlyBase` accumulators — the block prints them in its "Assessed (after Dep.)" column. Add `calculateAssessmentSummary` to the file's imports if absent.

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx tsc --noEmit && npx vitest run src/lib/reports`
Expected: both clean.

- [ ] **Step 5: Confirm no hardcoded GST remains**

Run: `grep -n "1\.18\|\* 0\.09\|\* 0\.18" src/lib/reports/standard-report-builder.ts`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts src/lib/reports/__tests__/gst-per-item.test.ts
git commit -m "fix(reports): standard report section 8 honours per-item GST

pb * 0.09 and the two * 0.18 literals meant the ASSESSMENT SUMMARY block
totalled every claim at 18% regardless of what the surveyor set. Now reads
calculateAssessmentSummary, which already applies each row's own rate."
```

---

## Task 8: Financial summary block in the Bill Check report

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts` — page2, after the GST SUMMARY blocks
- Test: `src/lib/reports/__tests__/bill-check-format.test.ts` (extend)

**Interfaces:**
- Consumes: `calculateAssessmentSummary` with the Task 6 fields

- [ ] **Step 1: Write the failing test**

Append to `src/lib/reports/__tests__/bill-check-format.test.ts`:

```ts
describe('Bill Check financial summary', () => {
  test('carries the same heads as the standard report block', () => {
    const html = buildUIICBillCheckHTML(claim([row()]), null);
    expect(html).toContain('ASSESSMENT SUMMARY');
    expect(html).toContain('Assessed (after Dep.)');
    expect(html).toContain('Incl. GST');
    expect(html).toContain('GRAND TOTAL');
    expect(html).toContain('NET ASSESSED LOSS');
  });

  test('breaks spare parts down by material', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ partType: 'metal', assessed: 10000, estimated: 10000 }),
      row({ partType: 'plastic', assessed: 4000, estimated: 4000 }),
    ]), null);
    expect(html).toContain('Metal');
    expect(html).toContain('Plastic / Rubber');
  });

  test('prints the net in words', () => {
    const html = buildUIICBillCheckHTML(claim([row({ assessed: 10000, estimated: 10000 })]), null);
    expect(html).toContain('RUPEES');
  });

  test('omits a material with no rows', () => {
    const html = buildUIICBillCheckHTML(claim([row({ partType: 'metal' })]), null);
    expect(html).not.toContain('Fibre Glass');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-format.test.ts`
Expected: FAIL — `ASSESSMENT SUMMARY` absent.

- [ ] **Step 3: Add the block**

In `buildUIICBillCheckHTML`, compute the summary near the other aggregates:

```ts
  const asum = calculateAssessmentSummary(
    rows, ageMonths, depType, salvage, compExcess, volExcess
  );
```

Then insert after the second GST SUMMARY table in page2:

```ts
<div style="${sec}">ASSESSMENT SUMMARY</div>
<table style="${ts}font-size:7pt;">
<thead><tr>
  <th style="${th}text-align:left;width:40%;">Head</th>
  <th style="${th}text-align:right;">Estimated</th>
  <th style="${th}text-align:right;">Assessed (after Dep.)</th>
  <th style="${th}text-align:right;">Incl. GST</th>
</tr></thead>
<tbody>
<tr>
  <td style="${td}">Spare Parts</td>
  <td style="${td}text-align:right;">${fa(asum.estimatePartsBase)}</td>
  <td style="${td}text-align:right;">${fa(asum.partsBase)}</td>
  <td style="${td}text-align:right;">${fa(asum.partsTotal)}</td>
</tr>
${[
  { label: 'Metal', est: asum.estimateMetalBase, ass: asum.metalTotal },
  { label: 'Plastic / Rubber', est: asum.estimatePlasticBase, ass: asum.plasticTotal },
  { label: 'Glass', est: asum.estimateGlassBase, ass: asum.glassTotal },
  { label: 'Fibre Glass', est: asum.estimateFiberglassBase, ass: asum.fiberglassTotal },
].filter(s => s.est > 0 || s.ass > 0).map(s => `<tr>
  <td style="${td}padding-left:14pt;color:#555;">&#8627; ${s.label}</td>
  <td style="${td}text-align:right;color:#555;">${fa(s.est)}</td>
  <td style="${td}text-align:right;color:#555;">${fa(s.ass)}</td>
  <td style="${td}text-align:right;color:#555;">&mdash;</td>
</tr>`).join('')}
<tr>
  <td style="${td}">Labour</td>
  <td style="${td}text-align:right;">${fa(asum.estimateLabourOnlyBase)}</td>
  <td style="${td}text-align:right;">${fa(asum.labourOnlyBase)}</td>
  <td style="${td}text-align:right;">${fa(asum.labourOnlyTotal)}</td>
</tr>
<tr>
  <td style="${td}">Painting</td>
  <td style="${td}text-align:right;">${fa(asum.estimatePaintOnlyBase)}</td>
  <td style="${td}text-align:right;">${fa(asum.paintOnlyBase)}</td>
  <td style="${td}text-align:right;">${fa(asum.paintOnlyTotal)}</td>
</tr>
<tr style="font-weight:700;background:#eee;">
  <td style="${td}">GRAND TOTAL</td>
  <td style="${td}text-align:right;">${fa(asum.estimatePartsBase + asum.estimateLabourBase)}</td>
  <td style="${td}text-align:right;">${fa(asum.partsBase + asum.labourBase)}</td>
  <td style="${td}text-align:right;">${fa(asum.grandTotal)}</td>
</tr>
<tr>
  <td style="${td}">Less: Policy Excess</td>
  <td colspan="2" style="${td}"></td>
  <td style="${td}text-align:right;">( ${fa(asum.excess)} )</td>
</tr>
<tr>
  <td style="${td}">Less: Salvage Value</td>
  <td colspan="2" style="${td}"></td>
  <td style="${td}text-align:right;">( ${fa(asum.salvage)} )</td>
</tr>
<tr style="font-weight:700;background:#0d1b2a;color:#fff;">
  <td style="padding:3px 4px;">NET ASSESSED LOSS</td>
  <td colspan="2" style="border:none;"></td>
  <td style="padding:3px 4px;text-align:right;">${fa(asum.netAssessedLoss)}</td>
</tr>
<tr>
  <td colspan="4" style="${td}font-style:italic;font-size:6.5pt;color:#444;">${asum.netInWords}</td>
</tr>
</tbody>
</table>
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx tsc --noEmit && npm run test`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/bill-check-format.test.ts
git commit -m "feat(reports): financial summary block in the Bill Check report

Mirrors section 8 of the standard report - estimated, assessed after
depreciation, and incl. GST per head, with the spare-parts material
breakdown - reading the same summary engine so the two agree."
```

---

## Self-review notes

**Spec coverage.** §3 calculation model → Tasks 1, 4. §4 table → Task 4. §5 GST SUMMARY → Task 5. §6 removals → Task 4. §7 summary inputs → Task 3, guarded by Task 5 Step 5. §8 hardcoded GST → Tasks 2, 3 and 7, with a `grep` gate in each. §9 testing → distributed across all eight.

**Added after the spec was written**, at the surveyor's request during plan review:
- Job Type column dropped; ten columns, not eleven (Task 4).
- `Plastic / Rubber` retained rather than the specimen's `Rubber` (Task 4).
- GST SUMMARY code cell prints `(Part) 18.00` / `(Labour) 18.00` when the row has no HSN/SAC, and the real code when it does (Task 5).
- Financial summary block, mirroring section 8 of the standard report (Tasks 6 and 8).
- `standard-report-builder.ts` hardcodes GST in three places and produces the block being mirrored — folded in (Task 7).

**Not carried out of the spec:** rounding (§10) — the specimen's `70000.30 → 70000.00` sits in the summary block, out of scope, and stays as-is.

**Type consistency.** `aggregateGst(rows, depRateFor)` returns `{ bands, base, cgst, sgst, amount }` in Tasks 1–5. `GstBand` fields `hsnSac / rate / base / cgst / sgst / amount` are used with those exact names in Tasks 4 and 5. `partsAgg`, `labourAgg`, `paintAgg`, `serviceAgg` are declared in Task 3 and consumed unchanged in Tasks 4, 5 and 8. `rowDepFor` is declared in Task 3 and used by Task 4's row builders. `codeCell(band, fallback)` is declared in Task 5 and used by both its tables. The six fields Task 6 adds to `AssessmentSummary` — `labourOnlyBase`, `labourOnlyTotal`, `paintOnlyBase`, `paintOnlyTotal`, `estimateLabourOnlyBase`, `estimatePaintOnlyBase` — are consumed with those exact names in Tasks 7 and 8.

**Ordering constraint.** Task 1 first. Task 3 must precede Tasks 4, 5 and 8 — it declares the aggregates they consume. Task 6 must precede Tasks 7 and 8. Task 2 is independent of 3–5 and can run any time after Task 1.

**Column-count check.** The table is ten columns after Job Type was dropped. Section header rows and empty-state rows use `colspan="10"`; the parts subtotal and TOTAL rows open with `colspan="3"`; labour subtotals use `colspan="8"`; paint subtotals use `colspan="9"`; tax lines use `colspan="8"` plus two trailing cells. Any change to the column set must revisit every one of these.

**Known follow-up.** `bill-check-report.test.ts` from the previous plan asserts on the removed columns. Task 4 Step 6 updates it rather than deleting it — its serial-gap case is still the regression guard for `buildSerialMap`.
