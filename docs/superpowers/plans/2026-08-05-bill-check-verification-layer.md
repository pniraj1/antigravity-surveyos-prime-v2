# Bill Check Verification Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Bill Check a verification layer over the Final Report sheet — one shared calculation, one shared serial numbering — and give unmatched bill items a way into the assessment.

**Architecture:** Bill Check currently has its own copy of depreciation and GST arithmetic. That copy is deleted. A new per-row helper `computeRowLiability` lives beside the existing `computeRowNet`, and both `calculateBillCheckSummary` and the PDF builder call it, so screen and report cannot diverge. Serial numbers come from one shared map used by both report builders and the grid. The final-bill matcher is fixed so wording and section differences stop producing false "extra" items, and the extra-items panel gains Link and Add actions.

**Tech Stack:** TypeScript, Next.js 16, Zustand, Vitest.

## Global Constraints

- **The Final Report is the assessment. Bill Check verifies it and computes nothing of its own.**
- **Bill Check report lists insurer-liability items only.** `allowed: false` → excluded. The existing `filter(r => r.allowed !== false)` in the Bill Check builder is correct and must stay.
- **Final Report lists disallowed items** tagged "Not Allowed" — including paint, which currently drops them.
- **Serial numbers run across all rows in a section, disallowed included**, so numbering gaps survive (1, 4, 5…). Rows on the page stay consecutive; no blank placeholder rows.
- **Liability per row = min(assessedNet, billedNet), capped at assessed. `not-in-bill` → 0.**
- **`billedTaxable` is the pre-GST basis for all calculation. `billedAmount` is the incl-GST display figure.** Never start a calculation from `billedAmount`.
- **Where `billedTaxable` is absent, fall back to `assessedNet` — never to zero.**
- GST is applied **once**, at the row's own `r.gst`. No hardcoded `1.18`.
- Disposal rows (`isDisposal`) carry **no GST**; net = `assessed × (1 − dep%) × (disposalPercent / 100)`.
- Immutability: never mutate an input object. Return new objects.
- Test runner is Vitest. Run a single file with `npx vitest run <path>`.
- Commit style: conventional, scoped, no attribution trailer (matches repo history).

**Expected output change:** Final Liability drops ~15–18% versus what the app shows today, more on parts-heavy claims. Current figures double-count GST. This is the correction, not a regression — do not "fix" tests to preserve old numbers.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/calculations/row-net.ts` | Per-row money maths | Add `computeRowLiability` beside `computeRowNet` |
| `src/lib/calculations/serial-numbers.ts` | Per-section serial map | **Create** |
| `src/lib/calculations/assessment.ts` | Claim-level summaries | `calculateBillCheckSummary` rewritten onto the shared helper |
| `src/lib/calculations/index.ts` | Barrel | Export the new helpers |
| `src/lib/reports/uiic-final-builder.ts` | Both PDFs | Delete own billed totals; shared serials; unfilter paint |
| `src/stores/slices/aiDataSlice.ts` | AI apply + matcher | Matcher quality; preserve curation; richer extras |
| `src/stores/slices/assessmentSlice.ts` | Row actions | `linkExtraBillItem`, `promoteExtraBillItem` |
| `src/types/assessment.ts` | Types | `ExtraBillItem` gains the fields promotion needs |
| `src/components/tabs/bill-check/ExtraBillItemsPanel.tsx` | Extras UI | Link / Add actions |
| `src/components/tabs/bill-check/BillCheckGrid.tsx` | Verification grid | Unit fix, report serial, match reason |
| `src/components/tabs/BillCheckTab.tsx` | Tab shell | Surface preview errors |

---

## Task 1: Per-row liability helper

**Files:**
- Modify: `src/lib/calculations/row-net.ts`
- Test: `src/lib/calculations/__tests__/row-liability.test.ts` (create)

**Interfaces:**
- Consumes: `computeRowNet(row, depRate)` — existing, returns `{ afterDep, isDisposal, netBeforeGst }`
- Produces: `computeRowLiability(row: AssessmentRow, depRate: number): RowLiabilityResult` where `RowLiabilityResult = { assessedNet: number; billedNet: number; liability: number }`. Tasks 2 and 4 both consume this.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/row-liability.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { computeRowLiability } from '../row-net';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: 'r1',
    particulars: 'Bumper',
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

describe('computeRowLiability', () => {
  test('depreciates the taxable amount, then adds GST once', () => {
    // The bug this whole change exists for: billedAmount (11,800) already
    // includes GST. Starting from it and adding GST again gave 12,532.
    const r = row({ billedTaxable: 10000, billedAmount: 11800, billStatus: 'in-bill' });
    const { liability } = computeRowLiability(r, 10);
    expect(Math.round(liability)).toBe(10620); // 10000 × 0.90 × 1.18
  });

  test('a row not in the bill contributes nothing', () => {
    const r = row({ billedTaxable: 10000, billStatus: 'not-in-bill' });
    expect(computeRowLiability(r, 10).liability).toBe(0);
  });

  test('under-billing takes the lower billed figure', () => {
    const r = row({ billedTaxable: 7000, billStatus: 'partial' });
    const { liability } = computeRowLiability(r, 10);
    expect(Math.round(liability)).toBe(7434); // 7000 × 0.90 × 1.18
  });

  test('over-billing is capped at the surveyor assessment', () => {
    const r = row({ billedTaxable: 12000, billStatus: 'in-bill' });
    const { liability } = computeRowLiability(r, 10);
    expect(Math.round(liability)).toBe(10620); // capped, not 12742
  });

  test('a missing billedTaxable falls back to assessed, never to zero', () => {
    // min() against a zero billedNet would silently drop the item from the
    // insurer's liability — the same shape of bug as the double-GST fallback.
    const r = row({ billedTaxable: undefined, billStatus: 'in-bill' });
    const { liability } = computeRowLiability(r, 10);
    expect(Math.round(liability)).toBe(10620);
  });

  test('disposal rows carry no GST and take the disposal percentage', () => {
    const r = row({ isDisposal: true, disposalPercent: 50, billedTaxable: 10000, billStatus: 'in-bill' });
    const { liability } = computeRowLiability(r, 10);
    expect(Math.round(liability)).toBe(4500); // 10000 × 0.90 × 0.50, no GST
  });

  test('uses the row own GST rate, not a hardcoded 18%', () => {
    const r = row({ gst: 28, billedTaxable: 10000, billStatus: 'in-bill' });
    const { liability } = computeRowLiability(r, 0);
    expect(Math.round(liability)).toBe(12800);
  });

  test('does not mutate the row it is given', () => {
    const r = row({ billedTaxable: 10000, billStatus: 'in-bill' });
    const snapshot = JSON.stringify(r);
    computeRowLiability(r, 10);
    expect(JSON.stringify(r)).toBe(snapshot);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/calculations/__tests__/row-liability.test.ts`
Expected: FAIL — `computeRowLiability is not a function` / no matching export.

- [ ] **Step 3: Implement the helper**

Append to `src/lib/calculations/row-net.ts`:

```ts
export interface RowLiabilityResult {
  /** Surveyor's assessed figure after depreciation and GST. The ceiling. */
  assessedNet: number;
  /** Workshop's billed taxable figure through the same treatment. */
  billedNet: number;
  /** min(assessedNet, billedNet); 0 when the item was not billed. */
  liability: number;
}

/** Applies GST at the row's own rate. Disposal rows carry none. */
function withGst(netBeforeGst: number, isDisposal: boolean, gstPercent: number): number {
  return isDisposal ? netBeforeGst : netBeforeGst * (1 + gstPercent / 100);
}

/**
 * Per-row insurer liability for Bill Check.
 *
 * Bill Check does not assess — it verifies the Final Report sheet. So the
 * assessed side is computed exactly as the Final Report computes it, and the
 * billed side gets the identical treatment so the two are comparable.
 *
 * The billed basis is `billedTaxable` (pre-GST), never `billedAmount`, which
 * already includes GST.
 */
export function computeRowLiability(row: AssessmentRow, depRate: number): RowLiabilityResult {
  const { isDisposal, netBeforeGst } = computeRowNet(row, depRate);
  const assessedNet = withGst(netBeforeGst, isDisposal, row.gst);

  let billedNet: number;
  if (row.billedTaxable === undefined || row.billedTaxable === null) {
    // "Billed as assessed." Falling back to 0 here would drop the item from
    // the insurer's liability the moment min() saw it.
    billedNet = assessedNet;
  } else {
    const billedAfterDep = row.billedTaxable * (1 - depRate / 100);
    const disposalFactor = (row.disposalPercent ?? 50) / 100;
    const billedBeforeGst = isDisposal ? billedAfterDep * disposalFactor : billedAfterDep;
    billedNet = withGst(billedBeforeGst, isDisposal, row.gst);
  }

  const liability = row.billStatus === 'not-in-bill' ? 0 : Math.min(assessedNet, billedNet);
  return { assessedNet, billedNet, liability };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/lib/calculations/__tests__/row-liability.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Export from the barrel**

In `src/lib/calculations/index.ts`, add:

```ts
export { computeRowNet, computeRowLiability } from './row-net';
export type { RowNetResult, RowLiabilityResult } from './row-net';
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/calculations/row-net.ts src/lib/calculations/index.ts src/lib/calculations/__tests__/row-liability.test.ts
git commit -m "feat(bill-check): add per-row liability helper

Bill Check must verify the Final Report sheet, not re-assess it. This computes
the assessed side exactly as the Final Report does, gives the billed side the
same treatment so they are comparable, and caps liability at assessed.

Takes billedTaxable as the basis. billedAmount already includes GST; starting
from it is what made on-screen liability run 18% high."
```

---

## Task 2: Rewrite the Bill Check summary onto the shared helper

**Files:**
- Modify: `src/lib/calculations/assessment.ts:168-219`
- Test: `src/lib/calculations/__tests__/bill-check-summary.test.ts` (create)

**Interfaces:**
- Consumes: `computeRowLiability` (Task 1), `getDepreciationRate(partType, ageMonths, policyType)`
- Produces: `calculateBillCheckSummary(rows, ageMonths, depType, salvage?, compulsoryExcess?, voluntaryExcess?): BillCheckSummary` — same signature as today. Task 4 consumes it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/bill-check-summary.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { calculateBillCheckSummary } from '../assessment';
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

// 24 months → metal depreciation is 10% on the standard IRDAI scale.
const AGE_24M = 24;

describe('calculateBillCheckSummary', () => {
  test('does not double-count GST', () => {
    const rows = [row({ billedTaxable: 10000, billedAmount: 11800, billStatus: 'in-bill' })];
    const s = calculateBillCheckSummary(rows, AGE_24M, 'standard');
    expect(Math.round(s.grandTotalBilled)).toBe(10620); // was 12532
  });

  test('excludes disallowed rows entirely', () => {
    const rows = [
      row({ billedTaxable: 10000, billStatus: 'in-bill' }),
      row({ allowed: false, billedTaxable: 5000, billStatus: 'not-allowed' }),
    ];
    const s = calculateBillCheckSummary(rows, AGE_24M, 'standard');
    expect(Math.round(s.grandTotalBilled)).toBe(10620);
  });

  test('items not in the bill become the saving to the insurer', () => {
    const rows = [
      row({ billedTaxable: 10000, billStatus: 'in-bill' }),
      row({ assessed: 4000, billStatus: 'not-in-bill' }),
    ];
    const s = calculateBillCheckSummary(rows, AGE_24M, 'standard');
    expect(Math.round(s.grandTotalBilled)).toBe(10620);
    expect(s.notInBillTotal).toBe(4000);
  });

  test('deducts salvage and both excesses from the net liability', () => {
    const rows = [row({ billedTaxable: 10000, billStatus: 'in-bill' })];
    const s = calculateBillCheckSummary(rows, AGE_24M, 'standard', 1000, 500, 200);
    expect(Math.round(s.netLiability)).toBe(8920); // 10620 − 1700
  });

  test('never returns a negative liability', () => {
    const rows = [row({ assessed: 1000, billedTaxable: 1000, billStatus: 'in-bill' })];
    const s = calculateBillCheckSummary(rows, AGE_24M, 'standard', 99999);
    expect(s.netLiability).toBe(0);
  });

  test('honours a per-row depreciation override', () => {
    const rows = [row({ depOverride: 0, billedTaxable: 10000, billStatus: 'in-bill' })];
    const s = calculateBillCheckSummary(rows, AGE_24M, 'standard');
    expect(Math.round(s.grandTotalBilled)).toBe(11800); // no depreciation
  });

  test('nil-depreciation policy applies no depreciation', () => {
    const rows = [row({ billedTaxable: 10000, billStatus: 'in-bill' })];
    const s = calculateBillCheckSummary(rows, AGE_24M, 'nil');
    expect(Math.round(s.grandTotalBilled)).toBe(11800);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/calculations/__tests__/bill-check-summary.test.ts`
Expected: FAIL — first test reports ~12532, not 10620.

- [ ] **Step 3: Replace the function body**

In `src/lib/calculations/assessment.ts`, replace the whole body of `calculateBillCheckSummary` (currently lines 168–219) with:

```ts
export function calculateBillCheckSummary(
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType,
  salvage: number = 0,
  compulsoryExcess: number = 0,
  voluntaryExcess: number = 0
): BillCheckSummary {
  let assessedBaseSum = 0;
  let billedBaseSum = 0;
  let notInBillTotal = 0;
  let billedGrandTotal = 0;

  rows.forEach(r => {
    // Disallowed items are not insurer liability, so they are not verified here.
    if (!r.allowed) return;

    const depRate = r.depOverride !== undefined
      ? r.depOverride
      : getDepreciationRate(r.partType, ageMonths, depType);

    const { liability } = computeRowLiability(r, depRate);

    assessedBaseSum += r.assessed;
    billedBaseSum += r.billStatus === 'not-in-bill' ? 0 : (r.billedTaxable ?? r.assessed);

    if (r.billStatus === 'not-in-bill') {
      notInBillTotal += r.assessed;
    } else {
      billedGrandTotal += liability;
    }
  });

  const totalExcess = compulsoryExcess + voluntaryExcess;
  const netLiability = Math.max(0, billedGrandTotal - salvage - totalExcess);

  return {
    grandTotalAssessed: assessedBaseSum,
    grandTotalBilled: billedGrandTotal,
    notInBillTotal,
    variance: assessedBaseSum - billedBaseSum,
    salvage,
    compulsoryExcess,
    voluntaryExcess,
    excess: totalExcess,
    netLiability,
    netInWords: `RUPEES ${numberToWords(netLiability)} ONLY`,
  };
}
```

Add the import at the top of the file if not already present:

```ts
import { computeRowLiability } from './row-net';
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/lib/calculations/__tests__/bill-check-summary.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the whole calculations suite for regressions**

Run: `npx vitest run src/lib/calculations`
Expected: PASS. If `insured-report.test.ts` fails on a liability figure, read the assertion — a pre-existing expectation baked in the inflated number is a **finding to report, not a test to edit**. Stop and flag it.

- [ ] **Step 6: Commit**

```bash
git add src/lib/calculations/assessment.ts src/lib/calculations/__tests__/bill-check-summary.test.ts
git commit -m "fix(bill-check): stop double-counting GST in the liability summary

calculateBillCheckSummary reimplemented computeRowNet and started from
billedAmount, which already includes GST, then added GST again. Every
on-screen Final Liability ran about 18% high.

Now delegates per-row maths to computeRowLiability. Figures drop accordingly;
the old ones were inflated."
```

---

## Task 3: Shared serial numbering

**Files:**
- Create: `src/lib/calculations/serial-numbers.ts`
- Modify: `src/lib/calculations/index.ts`
- Test: `src/lib/calculations/__tests__/serial-numbers.test.ts` (create)

**Interfaces:**
- Produces: `buildSerialMap(rows: AssessmentRow[]): Map<string, number>` — row id → serial within its section. Tasks 4 and 5 consume it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/serial-numbers.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { buildSerialMap } from '../serial-numbers';
import type { AssessmentRow } from '@/types/assessment';

function row(id: string, section: AssessmentRow['section'], allowed = true): AssessmentRow {
  return {
    id,
    particulars: id,
    estimated: 0,
    assessed: 0,
    partType: section === 'labour' ? 'labour' : section === 'paint' ? 'paint' : 'metal',
    gst: 18,
    section,
    allowed,
    isDisposal: false,
    disposalPercent: 50,
  };
}

describe('buildSerialMap', () => {
  test('numbers each section independently from 1', () => {
    const map = buildSerialMap([
      row('p1', 'parts'),
      row('p2', 'parts'),
      row('l1', 'labour'),
      row('t1', 'paint'),
    ]);
    expect(map.get('p1')).toBe(1);
    expect(map.get('p2')).toBe(2);
    expect(map.get('l1')).toBe(1);
    expect(map.get('t1')).toBe(1);
  });

  test('counts disallowed rows so the gap survives into Bill Check', () => {
    // The insurer reads 1 then 4 and knows 2 and 3 were rejected. Renumbering
    // to 1, 2 would destroy that signal.
    const map = buildSerialMap([
      row('p1', 'parts'),
      row('p2', 'parts', false),
      row('p3', 'parts', false),
      row('p4', 'parts'),
    ]);
    expect(map.get('p1')).toBe(1);
    expect(map.get('p4')).toBe(4);
  });

  test('paint is numbered the same way as parts and labour', () => {
    // Regression: the Final Report filtered disallowed paint and renumbered,
    // so paint serials disagreed between the two documents.
    const map = buildSerialMap([
      row('t1', 'paint'),
      row('t2', 'paint', false),
      row('t3', 'paint'),
    ]);
    expect(map.get('t3')).toBe(3);
  });

  test('handles an empty claim', () => {
    expect(buildSerialMap([]).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/calculations/__tests__/serial-numbers.test.ts`
Expected: FAIL — cannot resolve `../serial-numbers`.

- [ ] **Step 3: Create the module**

Create `src/lib/calculations/serial-numbers.ts`:

```ts
import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

/**
 * Serial number per row, counted within its section across ALL rows —
 * disallowed included.
 *
 * The Final Report lists every item with the surveyor's decision on it. Bill
 * Check lists only the insurer-liability ones, but carries these same numbers,
 * so the insurer reading both documents sees 1, 4, 5 and knows 2 and 3 were
 * rejected without cross-referencing. The gap is the information.
 */
export function buildSerialMap(rows: AssessmentRow[]): Map<string, number> {
  const counters: Record<AssessmentSection, number> = { parts: 0, labour: 0, paint: 0 };
  const map = new Map<string, number>();

  for (const row of rows) {
    counters[row.section] += 1;
    map.set(row.id, counters[row.section]);
  }

  return map;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/lib/calculations/__tests__/serial-numbers.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Export from the barrel**

In `src/lib/calculations/index.ts`, add:

```ts
export { buildSerialMap } from './serial-numbers';
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/calculations/serial-numbers.ts src/lib/calculations/index.ts src/lib/calculations/__tests__/serial-numbers.test.ts
git commit -m "feat(reports): one serial numbering source for both reports

Four schemes were in play and paint disagreed between the two documents the
moment an item was disallowed. Numbering counts disallowed rows so the gap
survives into Bill Check, which is what lets an insurer read the two side by
side."
```

---

## Task 4: Report builder — shared calculation, shared serials, paint restored

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts` (final report ~304–325; bill check ~445–561)
- Modify: `src/components/tabs/BillCheckTab.tsx:26-40`
- Test: `src/lib/reports/__tests__/bill-check-report.test.ts` (create)

**Interfaces:**
- Consumes: `calculateBillCheckSummary` (Task 2), `computeRowLiability` (Task 1), `buildSerialMap` (Task 3)

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/bill-check-report.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { buildUIICBillCheckHTML, buildUIICFinalHTML } from '../uiic-final-builder';
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
  };
}

function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 11800 },
  } as unknown as ClaimData;
}

describe('Bill Check report', () => {
  test('prints the same liability the screen shows', () => {
    // The regression guard. Screen and PDF disagreed because the screen
    // depreciated the billed amount and the PDF did not.
    const rows = [
      row({ billedTaxable: 10000, billedAmount: 11800, billStatus: 'in-bill' }),
      row({ section: 'labour', partType: 'labour', assessed: 5000, billedTaxable: 5000, billStatus: 'in-bill' }),
    ];
    const c = claim(rows);
    const ageMonths = getVehicleAgeMonths('2024-08-05', 2024, '2026-08-05T10:00');
    const summary = calculateBillCheckSummary(rows, ageMonths, 'standard', 0, 0, 0);

    const html = buildUIICBillCheckHTML(c, null);
    const expected = Math.round(summary.netLiability).toLocaleString('en-IN');
    expect(html).toContain(expected);
  });

  test('omits disallowed items — they are not insurer liability', () => {
    const html = buildUIICBillCheckHTML(
      claim([row({ particulars: 'CoolantTopUp', allowed: false, billedTaxable: 1200, billStatus: 'not-allowed' })]),
      null
    );
    expect(html).not.toContain('CoolantTopUp');
  });

  test('keeps the serial gap where an item was disallowed', () => {
    const rows = [
      row({ id: 'p1', particulars: 'BumperFront' }),
      row({ id: 'p2', particulars: 'GrilleUpper', allowed: false }),
      row({ id: 'p3', particulars: 'HeadlampLH' }),
    ];
    const html = buildUIICBillCheckHTML(claim(rows), null);
    const headlampRow = html.split('HeadlampLH')[0].split('<tr>').pop() ?? '';
    expect(headlampRow).toContain('>3<');
  });

  test('Final Report lists disallowed paint instead of dropping it', () => {
    const rows = [
      row({ section: 'paint', partType: 'paint', particulars: 'BuffingPanel' }),
      row({ section: 'paint', partType: 'paint', particulars: 'DentingRear', allowed: false }),
    ];
    const html = buildUIICFinalHTML(claim(rows), null);
    expect(html).toContain('DentingRear');
    expect(html).toContain('Not');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-report.test.ts`
Expected: FAIL — the liability figures differ, and `DentingRear` is absent from the Final Report.

- [ ] **Step 3: Restore disallowed paint in the Final Report**

In `src/lib/reports/uiic-final-builder.ts`, replace the paint block at line 323–325:

```ts
  const ptHtml = APT.filter(r => r.allowed !== false).map((r, i) =>
    `<tr><td style="${td}text-align:center;">${i + 1}</td>...`
  ).join('');
```

with a version that keeps disallowed rows and tags them, mirroring parts and labour:

```ts
  const ptHtml = APT.map(r => {
    const isNA = r.allowed === false;
    const sr = serials.get(r.id) ?? 0;
    return `<tr><td style="${td}text-align:center;">${sr}</td><td style="${td}">${r.particulars}</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:center;">Paint</td><td style="${td}text-align:right;">${isNA ? '' : fa(r.assessed)}</td><td style="${td}text-align:center;">N.D.</td><td style="${td}"></td><td style="${td}text-align:center;">${isNA ? '' : '18'}</td><td style="${td}"></td><td style="${td}text-align:right;">${isNA ? 'Not<br/>Allowed' : fa(r.assessed)}</td></tr>`;
  }).join('');
```

- [ ] **Step 4: Use the shared serial map in the Final Report**

Immediately above the `pHtml` block (around line 303), replace the `let sn = 1;` / `let ln = 1;` counters with one map:

```ts
  const serials = buildSerialMap(rows);
```

In the parts block, replace `${sn++}` with `${serials.get(r.id) ?? 0}` and delete `let sn = 1;`.
In the labour block, replace `${ln++}` with `${serials.get(r.id) ?? 0}` and delete `let ln = 1;`.

Add to the file's imports:

```ts
import { buildSerialMap, computeRowLiability, calculateBillCheckSummary } from '@/lib/calculations';
```

- [ ] **Step 5: Replace the Bill Check builder's own billed totals**

In `buildUIICBillCheckHTML`, delete the billed accumulators — `billedPartsTotal`, `billedLabourTotal`, `billedPaintTotal` (declared around line 446, accumulated at 457, 461, 465) — and the block at lines 480–483:

```ts
  const billedPartsTotalWithGST = billedPartsTotal * 1.18;
  const billedLabourTotalWithGST = (billedLabourTotal + billedPaintTotal) * 1.18;
  const totalBilled = billedPartsTotalWithGST + billedLabourTotalWithGST + tow;
  const netBilledLiability = Math.max(0, totalBilled - salvage - volExcess - compExcess);
```

Replace with a call to the shared calculation:

```ts
  // One calculation, shared with the screen. The two documents cannot diverge.
  const bcSummary = calculateBillCheckSummary(rows, ageMonths, depType, salvage, compExcess, volExcess);
  const totalBilled = bcSummary.grandTotalBilled + tow;
  const netBilledLiability = Math.max(0, totalBilled - salvage - volExcess - compExcess);
```

Leave the **assessment-side** totals (`partsDepreciated`, `rawParts`, `labOnly`, `paintOnly`, `pT`, `lT`, `gross`, `net`, `depAmt`) untouched — that is the Final Report's own maths and it is correct.

- [ ] **Step 6: Use shared serials and per-row liability in the Bill Check rows**

Delete `partsSrNo`, `labourSrNo` and `paintSrNo` (lines 486–494). Add near the top of the function:

```ts
  const serials = buildSerialMap(rows);
```

In each of the three row blocks (`pHtml`, `lHtml`, `ptHtml`), replace `const srNo = partsSrNo(r.id);` (and the labour/paint equivalents) with:

```ts
    const srNo = serials.get(r.id) ?? 0;
```

and replace the billed figure — `const billed = r.billedAmount ?? afterDep;` in parts, `r.billedAmount ?? r.assessed` in labour and paint — with:

```ts
    const depRateForRow = r.depOverride !== undefined ? r.depOverride : getDepRate(r.partType, ageMonths, depType);
    const billed = computeRowLiability(r, depRateForRow).liability;
```

- [ ] **Step 7: Surface preview errors instead of blanking the panel**

In `src/components/tabs/BillCheckTab.tsx`, replace lines 26–29:

```tsx
function BillCheckPreview({ claim, profile }: { claim: any; profile: any }) {
  const html = useMemo(() => {
    try { return buildUIICBillCheckHTML(claim, profile); } catch { return ''; }
  }, [claim, profile]);
```

with a version that shows the failure:

```tsx
function BillCheckPreview({ claim, profile }: { claim: any; profile: any }) {
  const { html, error } = useMemo(() => {
    try {
      return { html: buildUIICBillCheckHTML(claim, profile), error: null as string | null };
    } catch (e: unknown) {
      // A blank preview used to be indistinguishable from an empty claim.
      return { html: '', error: e instanceof Error ? e.message : 'Report could not be built' };
    }
  }, [claim, profile]);

  if (error) {
    return (
      <div className="rounded-2xl p-6 bg-status-danger/10 border border-status-danger text-sm text-status-danger">
        <strong>Bill Check preview failed to build.</strong>
        <div className="text-xs mt-1 font-mono">{error}</div>
      </div>
    );
  }
```

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-report.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 9: Run the full suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts src/components/tabs/BillCheckTab.tsx src/lib/reports/__tests__/bill-check-report.test.ts
git commit -m "fix(reports): Bill Check PDF uses the shared calculation and serials

The PDF kept its own billed totals - no depreciation, hardcoded 1.18 on a
figure that already included GST - so it printed a different liability than
the screen for the same claim. It now calls calculateBillCheckSummary.

Final Report stops dropping disallowed paint and renumbering the rest, which
was making paint serials disagree between the two documents.

Preview no longer swallows builder errors into a blank panel."
```

---

## Task 5: Grid — unit consistency, report serial, match reason

**Files:**
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx` (status dropdown ~309-326; serial cell ~252)
- Modify: `src/components/tabs/BillCheckTab.tsx` (pass serials into the grid)

**Interfaces:**
- Consumes: `buildSerialMap` (Task 3)
- Produces: `BillCheckGrid` gains a `serials: Map<string, number>` prop.

- [ ] **Step 1: Fix the status dropdown's units**

In `src/components/tabs/bill-check/BillCheckGrid.tsx`, replace the `onChange` of the status `<select>` (lines 311–317):

```tsx
                    onChange={e => {
                      const s = e.target.value as BillStatus;
                      updateAssessmentRow(row.id, {
                        billStatus: s,
                        billedAmount: s === 'not-in-bill' ? 0 : (s === 'in-bill' ? row.assessed : row.billedAmount),
                      });
                    }}
```

with:

```tsx
                    onChange={e => {
                      const s = e.target.value as BillStatus;
                      const gstPct = row.gst ?? 18;
                      if (s === 'in-bill') {
                        // "Billed as assessed." assessed is pre-GST, so it is the
                        // taxable basis; billedAmount is the incl-GST display figure.
                        updateAssessmentRow(row.id, {
                          billStatus: s,
                          billedTaxable: row.assessed,
                          billedAmount: Math.round(row.assessed * (1 + gstPct / 100)),
                        });
                      } else if (s === 'not-in-bill') {
                        // Zero the display figures but keep nothing to restore from —
                        // the surveyor re-enters if they switch back.
                        updateAssessmentRow(row.id, { billStatus: s, billedTaxable: 0, billedAmount: 0 });
                      } else {
                        updateAssessmentRow(row.id, { billStatus: s });
                      }
                    }}
```

- [ ] **Step 2: Show the report serial instead of `srNo`**

Add to the `Props` interface:

```tsx
  serials: Map<string, number>;
```

Add `serials` to the destructured parameters, and replace the serial cell (line 252):

```tsx
                <div className="text-sm font-medium" style={{ color: 'var(--color-neutral-600)' }}>{row.srNo ?? idx + 1}</div>
```

with:

```tsx
                {/* The number the insurer reads in both PDFs, not the estimate's srNo. */}
                <div className="text-sm font-medium" style={{ color: 'var(--color-neutral-600)' }}>{serials.get(row.id) ?? idx + 1}</div>
```

- [ ] **Step 3: Pass serials from the tab**

In `src/components/tabs/BillCheckTab.tsx`, add to the imports:

```tsx
import { buildSerialMap } from '@/lib/calculations';
```

Above the `return`, add:

```tsx
  const serials = buildSerialMap(allRows);
```

and pass it to the grid:

```tsx
            <BillCheckGrid
              allRows={allRows}
              allowedRows={allowedRows}
              notInBillTotal={notInBillTotal}
              serials={serials}
              updateAssessmentRow={updateAssessmentRow}
              deleteAssessmentRow={deleteAssessmentRow}
              deleteAssessmentRows={deleteAssessmentRows}
              claimId={currentClaim.id}
              fmt={fmt}
            />
```

- [ ] **Step 4: Verify in the running app**

Start the dev server via the preview tool (never `npm run dev` in Bash). Open a claim with a final bill, set an item to "In Bill", and confirm the Billed Incl GST column shows the assessed figure plus GST — not the bare assessed figure. Confirm the Sr. column matches the printed report.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/bill-check/BillCheckGrid.tsx src/components/tabs/BillCheckTab.tsx
git commit -m "fix(bill-check): In Bill writes both billed fields in the right units

Picking In Bill wrote the pre-GST assessed figure into a column headed Billed
Incl GST, and left billedTaxable stale. Both are now set consistently.

The grid also shows the serial the insurer will read in the PDFs rather than
the estimate's editable srNo."
```

---

## Task 6: Matcher — stop producing false extras

**Files:**
- Modify: `src/stores/slices/aiDataSlice.ts:194-276`
- Test: `src/stores/slices/__tests__/bill-matcher.test.ts` (create)

**Interfaces:**
- Produces: `matchBillItemsToRows(rows, billItems)` returns `Map<string, { bill: BillItem; reason: 'part' | 'amount' | 'desc'; ambiguous: boolean }>` — `ambiguous` is now returned rather than mutated onto the bill item. Task 7 consumes this shape. Export both `matchBillItemsToRows` and `buildBillItems` for testing.

- [ ] **Step 1: Write the failing test**

Create `src/stores/slices/__tests__/bill-matcher.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { matchBillItemsToRows, buildBillItems } from '../aiDataSlice';
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

describe('matchBillItemsToRows', () => {
  test('matches regardless of word order', () => {
    // The reported bug: the workshop writes BUMPER FRONT, the estimate says
    // FRONT BUMPER, and the item was reported as never assessed.
    const rows = [row({ id: 'r1', particulars: 'FRONT BUMPER', estimated: 0, assessed: 0 })];
    const bill = buildBillItems({ spare_parts: [{ description: 'BUMPER FRONT', total_amount: 11800 }] });
    const m = matchBillItemsToRows(rows, bill);
    expect(m.has('r1')).toBe(true);
  });

  test('matches on part number regardless of formatting', () => {
    const rows = [row({ id: 'r1', partNumber: '56100-0R190' })];
    const bill = buildBillItems({ spare_parts: [{ part_number: '561000R190', total_amount: 11800 }] });
    expect(matchBillItemsToRows(rows, bill).get('r1')?.reason).toBe('part');
  });

  test('still matches when the AI files a part under labour', () => {
    const rows = [row({ id: 'r1', particulars: 'FRONT BUMPER', section: 'parts' })];
    const bill = buildBillItems({ labour_items: [{ description: 'FRONT BUMPER', taxable_amount: 10000, total_amount: 11800 }] });
    expect(matchBillItemsToRows(rows, bill).has('r1')).toBe(true);
  });

  test('one bill item never matches two rows', () => {
    const rows = [
      row({ id: 'r1', particulars: 'FRONT BUMPER' }),
      row({ id: 'r2', particulars: 'FRONT BUMPER' }),
    ];
    const bill = buildBillItems({ spare_parts: [{ description: 'FRONT BUMPER', taxable_amount: 10000, total_amount: 11800 }] });
    const m = matchBillItemsToRows(rows, bill);
    expect([m.has('r1'), m.has('r2')].filter(Boolean)).toHaveLength(1);
  });

  test('flags an ambiguous match without mutating the bill item', () => {
    const rows = [row({ id: 'r1', particulars: 'UNRELATED TEXT', estimated: 10000 })];
    const bill = buildBillItems({
      spare_parts: [
        { description: 'SOMETHING ELSE', taxable_amount: 10000, total_amount: 11800 },
        { description: 'ANOTHER THING', taxable_amount: 10000, total_amount: 11800 },
      ],
    });
    const frozen = JSON.stringify(bill);
    const m = matchBillItemsToRows(rows, bill);
    expect(m.get('r1')?.ambiguous).toBe(true);
    expect(JSON.stringify(bill)).toBe(frozen);
  });

  test('leaves a genuinely new item unmatched', () => {
    const rows = [row({ id: 'r1', particulars: 'FRONT BUMPER' })];
    const bill = buildBillItems({ spare_parts: [{ description: 'RADIATOR ASSY', taxable_amount: 6000, total_amount: 7080 }] });
    expect(matchBillItemsToRows(rows, bill).has('r1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/stores/slices/__tests__/bill-matcher.test.ts`
Expected: FAIL — the functions are not exported, then word-order and cross-section tests fail.

- [ ] **Step 3: Export the helpers and add word-set matching**

In `src/stores/slices/aiDataSlice.ts`, change `function buildBillItems` to `export function buildBillItems` and `function matchBillItemsToRows` to `export function matchBillItemsToRows`.

Add above `matchBillItemsToRows`:

```ts
/** Significant words of a description, lowercased, order-independent. */
function descTokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

/**
 * Fraction of the smaller token set that both descriptions share.
 * "FRONT BUMPER" vs "BUMPER FRONT" scores 1 — substring matching scored 0,
 * which is how genuinely-assessed items ended up reported as extras.
 */
function descOverlap(a: string, b: string): number {
  const ta = descTokens(a);
  const tb = descTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach(w => { if (tb.has(w)) shared += 1; });
  return shared / Math.min(ta.size, tb.size);
}

const DESC_MATCH_THRESHOLD = 0.6;
```

- [ ] **Step 4: Rewrite the match function**

Replace the body of `matchBillItemsToRows` (lines 194–276) with:

```ts
export function matchBillItemsToRows(
  rows: AssessmentRow[],
  billItems: BillItem[]
): Map<string, { bill: BillItem; reason: 'part' | 'amount' | 'desc'; ambiguous: boolean }> {
  const AMT_TOL = 1;
  const normPart = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, '');

  const matchedBillIds = new Set<number>();
  const rowMatches = new Map<string, { bill: BillItem; reason: 'part' | 'amount' | 'desc'; ambiguous: boolean }>();

  // Step 1: exact part-number match — the strongest signal.
  rows.forEach((row) => {
    if (rowMatches.has(row.id)) return;
    const rowPart = normPart(row.partNumber || '');
    if (!rowPart) return;
    const hit = billItems.find((bi) => !matchedBillIds.has(bi.idx) && normPart(bi.partNumber) === rowPart && normPart(bi.partNumber));
    if (hit) {
      matchedBillIds.add(hit.idx);
      rowMatches.set(row.id, { bill: hit, reason: 'part', ambiguous: false });
    }
  });

  // Step 2: taxable amount within tolerance, description breaking ties.
  // Section is a tie-breaker, not a gate: the AI misfiling a part under
  // labour used to make the item unmatchable.
  rows.forEach((row) => {
    if (rowMatches.has(row.id)) return;
    const rowAmt = row.estimated || row.assessed || 0;
    if (rowAmt <= 0) return;

    const candidates = billItems.filter(
      (bi) => !matchedBillIds.has(bi.idx) && Math.abs(bi.taxableAmount - rowAmt) <= AMT_TOL
    );
    if (candidates.length === 0) return;

    const scored = candidates
      .map((c) => ({
        c,
        score: descOverlap(row.particulars, c.description) + (c.section === row.section ? 0.25 : 0),
      }))
      .sort((a, b) => b.score - a.score);

    const ambiguous =
      scored[0].score === 0 || (scored[1] !== undefined && scored[0].score === scored[1].score);

    matchedBillIds.add(scored[0].c.idx);
    rowMatches.set(row.id, { bill: scored[0].c, reason: ambiguous ? 'desc' : 'amount', ambiguous });
  });

  // Step 3: description overlap alone, for rows with no usable amount.
  rows.forEach((row) => {
    if (rowMatches.has(row.id)) return;
    if (!row.particulars) return;

    const scored = billItems
      .filter((bi) => !matchedBillIds.has(bi.idx))
      .map((bi) => ({ bi, score: descOverlap(row.particulars, bi.description) + (bi.section === row.section ? 0.25 : 0) }))
      .filter((s) => s.score >= DESC_MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return;
    matchedBillIds.add(scored[0].bi.idx);
    rowMatches.set(row.id, { bill: scored[0].bi, reason: 'desc', ambiguous: scored.length > 1 && scored[0].score === scored[1].score });
  });

  return rowMatches;
}
```

- [ ] **Step 5: Update the one caller**

In `applyFinalBill` (around line 538), replace the `_ambiguous` read:

```ts
    const remark = m.bill._ambiguous ? 'Ambiguous amount match — please verify' : row.billRemarks;
```

with:

```ts
    const remark = m.ambiguous ? 'Ambiguous match — please verify' : row.billRemarks;
```

Remove `_ambiguous?: boolean;` from the `BillItem` interface (line 160).

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx vitest run src/stores/slices/__tests__/bill-matcher.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add src/stores/slices/aiDataSlice.ts src/stores/slices/__tests__/bill-matcher.test.ts
git commit -m "fix(bill-check): match bill items by word set, not substring

FRONT BUMPER never matched BUMPER FRONT, so genuinely assessed items were
reported as never assessed. Section is now a tie-breaker rather than a gate,
so an AI misfiling a part under labour no longer guarantees a false extra.

Ambiguity is returned in the match result instead of mutated onto the bill
item."
```

---

## Task 7: Preserve curation and carry the full bill data

**Files:**
- Modify: `src/types/assessment.ts:14-20`
- Modify: `src/stores/slices/aiDataSlice.ts:513-563`
- Test: `src/stores/slices/__tests__/apply-final-bill.test.ts` (create)

**Interfaces:**
- Produces: `ExtraBillItem` gains `taxableAmount: number`, `gstPercent: number`, `partNumber?: string`, `hsnSac?: string`, `section: 'parts' | 'labour' | 'paint'`. Tasks 8 and 9 consume these.

- [ ] **Step 1: Extend the type**

In `src/types/assessment.ts`, replace the `ExtraBillItem` interface:

```ts
export interface ExtraBillItem {
  id: string;
  description: string;
  /** Total incl GST, as billed. */
  amount: number;
  /** Pre-GST basis — what promotion to an AssessmentRow needs. */
  taxableAmount: number;
  gstPercent: number;
  partNumber?: string;
  hsnSac?: string;
  section: AssessmentSection;
  category?: 'spare_parts' | 'labour' | 'painting';
  source: 'final-bill';
}
```

- [ ] **Step 2: Write the failing test**

Create `src/stores/slices/__tests__/apply-final-bill.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { applyFinalBill } from '../aiDataSlice';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'FRONT BUMPER',
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

function claim(rows: AssessmentRow[], extras: ClaimData['extraBillItems'] = []): ClaimData {
  return { id: 'c1', assessmentRows: rows, extraBillItems: extras } as unknown as ClaimData;
}

const BILL = {
  bill_number: 'B1',
  bill_date: '2026-08-01',
  total_amount: 18880,
  spare_parts: [
    { description: 'FRONT BUMPER', part_number: 'BP-1', taxable_amount: 10000, total_amount: 11800, gst_percent: 18 },
    { description: 'RADIATOR ASSY', part_number: 'RD-9', taxable_amount: 6000, total_amount: 7080, gst_percent: 18 },
  ],
};

describe('applyFinalBill', () => {
  test('carries the taxable basis onto the matched row', () => {
    const r = row({ id: 'r1' });
    const out = applyFinalBill(claim([r]), BILL);
    const matched = out.assessmentRows.find(x => x.id === 'r1')!;
    expect(matched.billedTaxable).toBe(10000);
    expect(matched.billedAmount).toBe(11800);
    expect(matched.billStatus).toBe('in-bill');
  });

  test('keeps the full bill data on an unmatched item so it can be promoted', () => {
    const out = applyFinalBill(claim([row({ id: 'r1' })]), BILL);
    const extra = out.extraBillItems!.find(e => e.description === 'RADIATOR ASSY')!;
    expect(extra.taxableAmount).toBe(6000);
    expect(extra.gstPercent).toBe(18);
    expect(extra.partNumber).toBe('RD-9');
    expect(extra.section).toBe('parts');
  });

  test('re-uploading the bill does not resurrect a deleted extra', () => {
    // Wholesale overwrite meant deletions came back and promoted items
    // returned as duplicates.
    const first = applyFinalBill(claim([row({ id: 'r1' })]), BILL);
    const curated = { ...first, extraBillItems: [] };
    const second = applyFinalBill(curated as ClaimData, BILL);
    expect(second.extraBillItems).toHaveLength(0);
  });

  test('a newly appearing item is still added on re-upload', () => {
    const first = applyFinalBill(claim([row({ id: 'r1' })]), BILL);
    const withNew = {
      ...BILL,
      spare_parts: [...BILL.spare_parts, { description: 'FOG LAMP', part_number: 'FL-2', taxable_amount: 2000, total_amount: 2360, gst_percent: 18 }],
    };
    const second = applyFinalBill(first as ClaimData, withNew);
    expect(second.extraBillItems!.some(e => e.description === 'FOG LAMP')).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npx vitest run src/stores/slices/__tests__/apply-final-bill.test.ts`
Expected: FAIL — `applyFinalBill` is not exported; then the extras lack `taxableAmount`.

- [ ] **Step 4: Export and rewrite the unmatched-item handling**

Change `function applyFinalBill` to `export function applyFinalBill`.

Replace the `unmatched` block (lines 542–551) and the return (553–562):

```ts
  const extras: ExtraBillItem[] = billItems
    .filter((bi) => !matchedBillIds.has(bi.idx))
    .map((bi) => ({
      // Stable id from content, so a re-upload of the same bill produces the
      // same id and merging can tell a repeat from a new item.
      id: `extra-${bi.section}-${bi.partNumber || bi.description}-${bi.totalAmount}`.replace(/\s+/g, '_'),
      description: bi.description || 'Unnamed item',
      amount: bi.totalAmount,
      taxableAmount: bi.taxableAmount,
      gstPercent: bi.gstPercent,
      partNumber: bi.partNumber || undefined,
      hsnSac: bi.raw?.hsn_sac || bi.raw?.hsn || undefined,
      section: bi.section,
      category:
        bi.section === 'parts' ? 'spare_parts' : bi.section === 'labour' ? 'labour' : 'painting',
      source: 'final-bill' as const,
    }));

  // Merge, don't overwrite: the surveyor may have deleted or promoted items
  // from a previous upload of this bill.
  const seen = new Set((claim.extraBillItems || []).map((e) => e.id));
  const merged = [...(claim.extraBillItems || []), ...extras.filter((e) => !seen.has(e.id))];

  return {
    ...claim,
    billCheck: {
      billNo: data.bill_number || '',
      billDate: data.bill_date || '',
      billTotal: data.total_amount || 0,
    },
    assessmentRows: updatedRows,
    extraBillItems: merged,
  };
```

Note: this merge keeps a previously-deleted item deleted only within the same session's claim state. That is the intended behaviour — deletion is a decision on the claim, and re-uploading the identical bill should not undo it.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run src/stores/slices/__tests__/apply-final-bill.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/types/assessment.ts src/stores/slices/aiDataSlice.ts src/stores/slices/__tests__/apply-final-bill.test.ts
git commit -m "fix(bill-check): keep bill data on extras and stop wiping curation

Unmatched items kept only description, amount and category, so promoting one
to the assessment would have lost the taxable basis, GST rate, part number and
HSN the extraction had already read.

extraBillItems was also overwritten wholesale on every upload, resurrecting
deleted items. Now merged on a content-derived id."
```

---

## Task 8: Store actions for link and promote

**Files:**
- Modify: `src/stores/slices/assessmentSlice.ts`
- Test: `src/stores/slices/__tests__/extra-bill-actions.test.ts` (create)

**Interfaces:**
- Consumes: the extended `ExtraBillItem` (Task 7)
- Produces: `linkExtraBillItem(extraId: string, rowId: string): void` and `promoteExtraBillItem(extraId: string): void` on the store. Task 9 consumes both.

- [ ] **Step 1: Write the failing test**

Create `src/stores/slices/__tests__/extra-bill-actions.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { createAssessmentSlice } from '../assessmentSlice';
import type { ClaimData, ExtraBillItem } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: 'r1',
    particulars: 'FRONT BUMPER',
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

const extra: ExtraBillItem = {
  id: 'e1',
  description: 'RADIATOR ASSY',
  amount: 7080,
  taxableAmount: 6000,
  gstPercent: 18,
  partNumber: 'RD-9',
  section: 'parts',
  category: 'spare_parts',
  source: 'final-bill',
};

/** Minimal harness: runs the slice's set() against a plain state object. */
function harness(claim: ClaimData) {
  let state: { currentClaim: ClaimData | null; isDirty?: boolean } = { currentClaim: claim };
  const set = (fn: (s: typeof state) => Partial<typeof state>) => {
    state = { ...state, ...fn(state) };
  };
  const slice = createAssessmentSlice(set as never, (() => state) as never, {} as never);
  return { slice, get: () => state };
}

describe('linkExtraBillItem', () => {
  test('attaches the bill figures to the chosen row and consumes the extra', () => {
    const claim = { id: 'c1', assessmentRows: [row()], extraBillItems: [extra] } as unknown as ClaimData;
    const { slice, get } = harness(claim);

    slice.linkExtraBillItem('e1', 'r1');

    const r = get().currentClaim!.assessmentRows[0];
    expect(r.billedTaxable).toBe(6000);
    expect(r.billedAmount).toBe(7080);
    expect(r.billStatus).toBe('partial'); // 6000 billed vs 10000 assessed
    expect(get().currentClaim!.extraBillItems).toHaveLength(0);
  });

  test('marks in-bill when the amounts agree', () => {
    const claim = {
      id: 'c1',
      assessmentRows: [row({ assessed: 6000, estimated: 6000 })],
      extraBillItems: [extra],
    } as unknown as ClaimData;
    const { slice, get } = harness(claim);

    slice.linkExtraBillItem('e1', 'r1');

    expect(get().currentClaim!.assessmentRows[0].billStatus).toBe('in-bill');
  });
});

describe('promoteExtraBillItem', () => {
  test('creates a Not Allowed row at zero assessed, carrying the bill data', () => {
    const claim = { id: 'c1', assessmentRows: [], extraBillItems: [extra] } as unknown as ClaimData;
    const { slice, get } = harness(claim);

    slice.promoteExtraBillItem('e1');

    const added = get().currentClaim!.assessmentRows[0];
    expect(added.particulars).toBe('RADIATOR ASSY');
    expect(added.allowed).toBe(false);   // the surveyor decides, not the AI
    expect(added.assessed).toBe(0);
    expect(added.estimated).toBe(0);
    expect(added.billedTaxable).toBe(6000);
    expect(added.billedAmount).toBe(7080);
    expect(added.partNumber).toBe('RD-9');
    expect(added.gst).toBe(18);
    expect(added.section).toBe('parts');
    expect(get().currentClaim!.extraBillItems).toHaveLength(0);
  });

  test('does nothing when the id is unknown', () => {
    const claim = { id: 'c1', assessmentRows: [], extraBillItems: [extra] } as unknown as ClaimData;
    const { slice, get } = harness(claim);

    slice.promoteExtraBillItem('nope');

    expect(get().currentClaim!.assessmentRows).toHaveLength(0);
    expect(get().currentClaim!.extraBillItems).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/stores/slices/__tests__/extra-bill-actions.test.ts`
Expected: FAIL — `linkExtraBillItem is not a function`.

- [ ] **Step 3: Add the actions**

In `src/stores/slices/assessmentSlice.ts`, add to the `AssessmentSlice` interface:

```ts
  linkExtraBillItem: (extraId: string, rowId: string) => void;
  promoteExtraBillItem: (extraId: string) => void;
```

Add to the slice body, after `clearExtraBillItems`:

```ts
  linkExtraBillItem: (extraId, rowId) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const extra = (state.currentClaim.extraBillItems || []).find((i) => i.id === extraId);
      if (!extra) return {};

      const AMT_TOL = 1;
      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: state.currentClaim.assessmentRows.map((r) => {
            if (r.id !== rowId) return r;
            // Same item, worded differently by the workshop. Partial when the
            // workshop billed a different figure than was assessed.
            const partial = Math.abs(extra.taxableAmount - r.assessed) > AMT_TOL;
            return {
              ...r,
              billedTaxable: extra.taxableAmount,
              billedAmount: extra.amount,
              billStatus: partial ? ('partial' as const) : ('in-bill' as const),
              billRemarks: r.billRemarks || `Linked from bill: ${extra.description}`,
            };
          }),
          extraBillItems: (state.currentClaim.extraBillItems || []).filter((i) => i.id !== extraId),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  promoteExtraBillItem: (extraId) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const extra = (state.currentClaim.extraBillItems || []).find((i) => i.id === extraId);
      if (!extra) return {};

      // Lands Not Allowed at zero assessed. The item is now on the record and
      // in the Final Report; whether it is allowed is the surveyor's call.
      const newRow = createAssessmentRow(extra.section, {
        particulars: extra.description,
        partNumber: extra.partNumber,
        hsnSac: extra.hsnSac,
        gst: extra.gstPercent,
        estimated: 0,
        assessed: 0,
        allowed: false,
        billedTaxable: extra.taxableAmount,
        billedAmount: extra.amount,
        billStatus: 'not-allowed',
        billRemarks: 'Added from final bill — not in original assessment',
      });

      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: [...state.currentClaim.assessmentRows, newRow],
          extraBillItems: (state.currentClaim.extraBillItems || []).filter((i) => i.id !== extraId),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/stores/slices/__tests__/extra-bill-actions.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/stores/slices/assessmentSlice.ts src/stores/slices/__tests__/extra-bill-actions.test.ts
git commit -m "feat(bill-check): link or promote an unmatched bill item

Link attaches the bill figures to an existing row for the common case of the
workshop wording an item differently. Promote creates a row in the assessment
carrying the extracted bill data, landing Not Allowed at zero assessed - the
item goes on the record, the allow decision stays with the surveyor."
```

---

## Task 9: Extra items panel — Link and Add

**Files:**
- Modify: `src/components/tabs/bill-check/ExtraBillItemsPanel.tsx`
- Modify: `src/components/tabs/BillCheckTab.tsx`

**Interfaces:**
- Consumes: `linkExtraBillItem`, `promoteExtraBillItem` (Task 8)

- [ ] **Step 1: Rewrite the panel**

Replace `src/components/tabs/bill-check/ExtraBillItemsPanel.tsx` in full:

```tsx
'use client';

import { useState } from 'react';
import { AlertCircle, Trash2, Link2, PlusCircle } from 'lucide-react';
import type { ExtraBillItem, AssessmentRow } from '@/types';

interface Props {
  extraBillItems: ExtraBillItem[];
  assessmentRows: AssessmentRow[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onLink: (extraId: string, rowId: string) => void;
  onPromote: (extraId: string) => void;
  fmt: (n: number) => string;
}

export function ExtraBillItemsPanel({
  extraBillItems, assessmentRows, onDelete, onClearAll, onLink, onPromote, fmt,
}: Props) {
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  if (extraBillItems.length === 0) return null;

  const total = extraBillItems.reduce((s, i) => s + (i.amount || 0), 0);
  const candidates = assessmentRows.filter(r =>
    r.particulars.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-2xl overflow-hidden bg-white border-2 border-status-danger">
      <div className="px-6 py-4 flex items-start justify-between gap-4 border-b border-border bg-status-danger/10">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-status-danger flex-shrink-0" style={{ marginTop: 2 }} />
          <div>
            <div className="text-sm font-medium text-status-danger">
              ⚠ Bill Items Not Matched to the Assessment ({extraBillItems.length})
            </div>
            <div className="text-xs mt-0.5 text-status-danger">
              Usually the workshop worded an item differently — use <strong>Link</strong> to attach it to the
              right row. If it is genuinely new, <strong>Add</strong> puts it in the Final Report as Not Allowed
              for you to decide on.
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm(`Discard all ${extraBillItems.length} unmatched items, totalling ${fmt(total)}? This cannot be undone.`)) onClearAll();
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all hover:opacity-90 bg-status-danger text-white"
        >
          <Trash2 size={14} />
          Clear All
        </button>
      </div>

      {extraBillItems.map((item) => (
        <div key={item.id} className="border-b border-border last:border-b-0">
          <div className="px-6 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{item.description}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {item.partNumber ? `Part ${item.partNumber} · ` : ''}{item.section} · taxable {fmt(item.taxableAmount)} · GST {item.gstPercent}%
              </div>
            </div>
            <div className="text-sm font-medium text-status-danger whitespace-nowrap">{fmt(item.amount)}</div>

            <button
              onClick={() => { setLinkingId(linkingId === item.id ? null : item.id); setSearch(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary text-primary hover:bg-primary/10 transition-colors"
              title="Attach this bill line to an item already in the assessment"
            >
              <Link2 size={13} />
              Link
            </button>

            <button
              onClick={() => {
                if (confirm(`Add "${item.description}" to the Final Report as Not Allowed? You can then allow it and enter your assessed figure.`)) onPromote(item.id);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-neutral-50 transition-colors"
              title="Add as a new item in the Final Report"
            >
              <PlusCircle size={13} />
              Add
            </button>

            <button
              onClick={() => { if (confirm(`Discard "${item.description}" (${fmt(item.amount)})?`)) onDelete(item.id); }}
              className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors hover:bg-status-danger/10 text-status-danger"
              title="Discard this item"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {linkingId === item.id && (
            <div className="px-6 pb-4 bg-neutral-50">
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search assessment items…"
                className="w-full px-3 py-2 rounded-lg text-sm border border-border outline-none mb-2"
              />
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-white">
                {candidates.length === 0 && (
                  <div className="px-3 py-3 text-xs text-muted-foreground">No matching assessment items.</div>
                )}
                {candidates.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { onLink(item.id, r.id); setLinkingId(null); }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-neutral-50 border-b border-border last:border-b-0"
                  >
                    <span className="text-xs font-medium text-foreground truncate">{r.particulars || '—'}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {r.section} · assessed {fmt(r.assessed)}{r.allowed ? '' : ' · not allowed'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="px-6 py-3 flex items-center justify-between border-t border-status-danger/30 bg-status-danger/10">
        <div className="text-xs font-medium uppercase tracking-widest text-status-danger">Unmatched Total</div>
        <div className="text-sm font-medium text-status-danger">{fmt(total)}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the tab**

In `src/components/tabs/BillCheckTab.tsx`, add the two store selectors alongside the existing ones:

```tsx
  const linkExtraBillItem = useClaimStore(s => s.linkExtraBillItem);
  const promoteExtraBillItem = useClaimStore(s => s.promoteExtraBillItem);
```

and replace the panel usage:

```tsx
            <ExtraBillItemsPanel
              extraBillItems={extraBillItems}
              assessmentRows={allRows}
              onDelete={deleteExtraBillItem}
              onClearAll={clearExtraBillItems}
              onLink={linkExtraBillItem}
              onPromote={promoteExtraBillItem}
              fmt={fmt}
            />
```

- [ ] **Step 3: Verify in the running app**

Start the dev server via the preview tool. Upload a final bill containing an item the estimate words differently, confirm it appears in the panel, use **Link** to attach it to the right row, and confirm the row's billed columns fill in and the panel entry disappears. Then use **Add** on a genuinely new item and confirm it appears in the Assessment tab as Not Allowed with zero assessed.

- [ ] **Step 4: Run the full suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/bill-check/ExtraBillItemsPanel.tsx src/components/tabs/BillCheckTab.tsx
git commit -m "feat(bill-check): Link and Add actions for unmatched bill items

The panel offered only delete and clear-all, so an item the workshop worded
differently could only be retyped in the Assessment tab. Link attaches it to
the right row; Add puts a genuinely new item into the Final Report as Not
Allowed. Clear All now states the total being discarded."
```

---

## Self-review notes

**Spec coverage.** M1 → Tasks 1, 2, 4. M2 → Task 5. M3 → Task 1. M4 → Tasks 1, 4. M5 → Task 5 (explicitly not restoring; the surveyor re-enters, recorded in the code comment). M6 → Task 2. S1 → Tasks 3, 4. S2 → Tasks 3, 4, 5. X1, X2, X6, X7 → Task 6. X3 → Task 6 (`ambiguous` returned; surfaced as a row remark by the existing `applyFinalBill` path). X4, X5 → Task 7. P1 → Tasks 8, 9. P2 → Task 9. P3 → Task 4.

**Deferred, matching the spec's out-of-scope list:** supplementary estimate upload; the richer tab (AI controls, re-scan with feedback, chatbot, section grouping, Drive upload, pending-items warning before print).

**Not carried out of the spec:** the spec's §4.5 mentions surfacing the match reason in the grid. Task 6 returns `reason` and `ambiguous` in the match result and `applyFinalBill` writes an "Ambiguous match" remark, but no dedicated grid column is added — the remark column already carries it. Add a column only if the remark proves insufficient in use.

**Type consistency check.** `computeRowLiability` returns `{ assessedNet, billedNet, liability }` in Tasks 1, 2 and 4. `buildSerialMap` returns `Map<string, number>` in Tasks 3, 4 and 5. `ExtraBillItem.taxableAmount` / `gstPercent` / `section` are introduced in Task 7 and consumed with those exact names in Tasks 8 and 9. `linkExtraBillItem(extraId, rowId)` and `promoteExtraBillItem(extraId)` keep the same signatures in Tasks 8 and 9.

**Ordering constraint.** Tasks 1 → 2 → 4 must run in order (4 imports both). Task 3 must precede 4 and 5. Task 7 must precede 8 and 9. Task 6 is independent of 1–5 and can run in parallel with them.
