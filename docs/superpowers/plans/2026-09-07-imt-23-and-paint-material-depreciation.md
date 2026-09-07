# IMT-23 and Paint Material Depreciation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the surveyor mark any assessment row as an IMT-23 item so the insurer's liability for it halves, and apply IRDAI GR-9 paint material depreciation, with both stated correctly in the standard report, the UIIC report, the bill check, and the insured report.

**Architecture:** One helper, `effectiveAssessed(row)`, halves the assessed figure for ticked rows at the point every liability calculation starts. Because depreciation, GST, the disposal factor and `min(assessed, billed)` are all pure multipliers, placing the halving there is arithmetically identical to placing it anywhere later, and it makes the printed pre-depreciation subtotal block reconcile exactly even with mixed override rates. Paint material depreciation is an internal per-row effective rate (25% material × 50% = 12.5%), never a section subtraction, so base and GST stay paired; each report format states it in its own language.

**Tech Stack:** TypeScript, Next.js 16, Zustand stores, Vitest, HTML-string report builders.

**Spec:** `docs/superpowers/specs/2026-09-07-imt-23-and-paint-material-depreciation-design.md`

## Global Constraints

- **Regression floor.** With no row ticked and `applyPaintMaterialDep` off, every existing report figure must be byte-identical. Run the full suite after every task.
- **Never auto-detect IMT-23.** No suggestions, no nudges, no heuristics on part names. The checkbox is the only input.
- **`depOverride` always wins** over any automatic rate, everywhere.
- **The 50% is not configurable.** It is fixed by the endorsement wording.
- **Money comparisons in tests use `toBeCloseTo(value, 2)`** unless a figure is exact by construction.
- **These five must keep reading raw `row.assessed`:** `salvageBasis`, the estimate accumulators in `calculateAssessmentSummary`, `billedTotals`, the `estimated − assessed` reducers in `insured-report.ts`, and the insured report's per-row display value. Each gets a comment naming the reason.
- **`uiic-portal-summary.ts` is not touched.** It keeps reading raw `assessed`.
- Commit after every task. Work on `main`.

---

### Task 1: `effectiveAssessed` and the row flag

**Files:**
- Modify: `src/types/assessment.ts` (add `imt23` to `AssessmentRow`)
- Modify: `src/lib/calculations/row-net.ts`
- Test: `src/lib/calculations/__tests__/imt23-core.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `effectiveAssessed(row: AssessmentRow): number`; `computeRowNet(row: AssessmentRow, depRate: number, opts?: { grossOfImt23?: boolean }): RowNetResult`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/imt23-core.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { effectiveAssessed, computeRowNet } from '../row-net';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow> = {}): AssessmentRow => ({
  id: 'r1', particulars: 'x', estimated: 0, assessed: 10000,
  partType: 'metal', gst: 18, section: 'parts', allowed: true,
  isDisposal: false, disposalPercent: 50, ...o,
});

describe('effectiveAssessed', () => {
  it('halves a ticked row and leaves others alone', () => {
    expect(effectiveAssessed(row({ imt23: true }))).toBe(5000);
    expect(effectiveAssessed(row())).toBe(10000);
    expect(effectiveAssessed(row({ imt23: false }))).toBe(10000);
  });
});

describe('computeRowNet with IMT-23', () => {
  it('applies the halving before depreciation', () => {
    // 10000 -> 5000 -> less 25% dep -> 3750
    expect(computeRowNet(row({ imt23: true }), 25).netBeforeGst).toBeCloseTo(3750, 2);
  });

  it('halving then dep then GST equals dep then GST then halving', () => {
    const ours = computeRowNet(row({ imt23: true }), 25).netBeforeGst * 1.18;
    const other = (10000 * 0.75 * 1.18) / 2;
    expect(ours).toBeCloseTo(other, 6);
  });

  it('composes with the disposal factor', () => {
    const r = row({ imt23: true, isDisposal: true, disposalPercent: 50 });
    // 10000 -> 5000 -> less 25% -> 3750 -> 50% disposal -> 1875
    expect(computeRowNet(r, 25).netBeforeGst).toBeCloseTo(1875, 2);
  });

  it('grossOfImt23 returns the un-halved figures for row display', () => {
    const r = row({ imt23: true });
    expect(computeRowNet(r, 25, { grossOfImt23: true }).afterDep).toBeCloseTo(7500, 2);
    expect(computeRowNet(r, 25).afterDep).toBeCloseTo(3750, 2);
  });

  it('is a no-op on rows that are not ticked', () => {
    expect(computeRowNet(row(), 25).netBeforeGst)
      .toBe(computeRowNet(row(), 25, { grossOfImt23: true }).netBeforeGst);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calculations/__tests__/imt23-core.test.ts`
Expected: FAIL — `effectiveAssessed is not a function`.

- [ ] **Step 3: Add the row flag**

In `src/types/assessment.ts`, inside `interface AssessmentRow`, directly after the `depOverride` field:

```ts
  /**
   * Surveyor has marked this row an IMT-23 item: the endorsement restores
   * cover for it but the insured bears 50% of the assessed loss.
   *
   * Never inferred. Which items fall under the endorsement is entirely the
   * surveyor's judgment — see the spec's non-goals.
   */
  imt23?: boolean;
```

- [ ] **Step 4: Implement in `row-net.ts`**

Replace the top of `src/lib/calculations/row-net.ts` (imports through `computeRowNet`) with:

```ts
import type { AssessmentRow } from '@/types/assessment';

export interface RowNetResult {
  /** effectiveAssessed × (1 − depRate/100) */
  afterDep: number;
  isDisposal: boolean;
  /** afterDep × disposalFactor for disposal rows; afterDep for normal rows. GST is NOT included. */
  netBeforeGst: number;
}

/**
 * The assessed figure the insurer's liability is computed from.
 *
 * IMT-23 restores cover for parts the commercial vehicle policy otherwise
 * excludes, on the condition that the insured bears 50% of the assessed loss.
 * The halving lands here — at the assessed level, before depreciation — which
 * is what the market format does and what makes the printed
 * subtotal / less-endorsement / subtotal block reconcile exactly even when the
 * bucket holds rows at different depreciation rates or GST rates.
 *
 * Every later step is a pure multiplier, so this position is arithmetically
 * identical to halving at the end.
 */
export function effectiveAssessed(row: AssessmentRow): number {
  return row.imt23 ? row.assessed / 2 : row.assessed;
}

/**
 * Computes the per-row net amount before GST.
 * For disposal rows: net = assessed × (1 − dep%) × (disposalPercent / 100), no GST applies.
 * For normal rows: net = assessed × (1 − dep%), caller adds GST.
 *
 * `grossOfImt23` ignores the endorsement and returns the row's own full
 * figures. Only the standard report's per-row cells want this: there the rows
 * must sum to the pre-deduction subtotal, with one visible
 * "Less endorsement 23" line beneath. Every other caller wants the default,
 * which is the insurer's actual liability.
 */
export function computeRowNet(
  row: AssessmentRow,
  depRate: number,
  opts?: { grossOfImt23?: boolean },
): RowNetResult {
  const basis = opts?.grossOfImt23 ? row.assessed : effectiveAssessed(row);
  const afterDep = basis * (1 - depRate / 100);
  const isDisposal = !!row.isDisposal;
  const disposalFactor = (row.disposalPercent ?? 50) / 100;
  const netBeforeGst = isDisposal ? afterDep * disposalFactor : afterDep;
  return { afterDep, isDisposal, netBeforeGst };
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/calculations/__tests__/imt23-core.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Run the full suite for the regression floor**

Run: `npx vitest run`
Expected: PASS — 115 files, 921 tests. No row has `imt23` set, so nothing moves.

- [ ] **Step 7: Commit**

```bash
git add src/types/assessment.ts src/lib/calculations/row-net.ts src/lib/calculations/__tests__/imt23-core.test.ts
git commit -m "feat: effectiveAssessed halves IMT-23 rows at the assessed level

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Wire the halving into the summary engine

`calculateAssessmentSummary` duplicates `computeRowNet`'s arithmetic inline rather than calling it, so the halving needs adding there too. The estimate accumulators in the same function must NOT change.

**Files:**
- Modify: `src/lib/calculations/assessment.ts:88`
- Test: `src/lib/calculations/__tests__/imt23-summary.test.ts` (create)

**Interfaces:**
- Consumes: `effectiveAssessed` from Task 1.
- Produces: `AssessmentSummary` whose material buckets, GST accumulators, `grandTotal` and `netAssessedLoss` are net of IMT-23; its `estimate*` fields are unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/imt23-summary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calculateAssessmentSummary } from '../assessment';
import { salvageBasis } from '../salvage';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow> = {}): AssessmentRow => ({
  id: Math.random().toString(36).slice(2), particulars: 'x',
  estimated: 10000, assessed: 10000, partType: 'metal', gst: 18,
  section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50, ...o,
});

describe('IMT-23 in the assessment summary', () => {
  it('halves the material bucket and its GST together', () => {
    const s = calculateAssessmentSummary([row({ imt23: true })], 0, 'nil', 0, 0, 0);
    expect(s.metalTotal).toBeCloseTo(5000, 2);
    expect(s.metalTotalInclGst).toBeCloseTo(5900, 2);
    expect(s.partsCGST).toBeCloseTo(450, 2);
    expect(s.partsSGST).toBeCloseTo(450, 2);
  });

  it('leaves the estimate totals untouched — an estimate is a fact about the garage document', () => {
    const s = calculateAssessmentSummary([row({ imt23: true })], 0, 'nil', 0, 0, 0);
    expect(s.estimatePartsBase).toBe(10000);
    expect(s.estimateMetalBase).toBe(10000);
    expect(s.estimateGrossTotal).toBeCloseTo(11800, 2);
  });

  it('does not move the salvage basis — salvage is the scrap value of the part', () => {
    const rows = [row({ imt23: true })];
    expect(salvageBasis(rows)).toBe(10000);
  });

  it('halves labour and paint rows too', () => {
    const s = calculateAssessmentSummary([
      row({ section: 'labour', partType: 'labour', imt23: true }),
      row({ section: 'paint', partType: 'paint', imt23: true }),
    ], 0, 'nil', 0, 0, 0);
    expect(s.labourOnlyBase).toBeCloseTo(5000, 2);
    expect(s.paintOnlyBase).toBeCloseTo(5000, 2);
  });

  it('composes with depreciation and reaches the net', () => {
    // 10000 -> 5000 -> less 25% metal dep -> 3750 -> +18% -> 4425
    const s = calculateAssessmentSummary([row({ imt23: true })], 46, 'standard', 0, 0, 0);
    expect(s.netAssessedLoss).toBeCloseTo(4425, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calculations/__tests__/imt23-summary.test.ts`
Expected: FAIL — `metalTotal` is 10000, expected 5000.

- [ ] **Step 3: Implement**

In `src/lib/calculations/assessment.ts`, add to the imports at the top:

```ts
import { computeRowLiability, effectiveAssessed } from './row-net';
```

(The file already imports `computeRowLiability` from `./row-net`; add `effectiveAssessed` to that same import.)

Then replace line 88:

```ts
    const valueAfterDep = r.assessed * (1 - depRate / 100);
```

with:

```ts
    // effectiveAssessed, not r.assessed: an IMT-23 row is halved before
    // depreciation, so the bucket and its GST both carry the reduced figure.
    // The estimate accumulators further down deliberately keep reading
    // r.estimated — an estimate is a fact about the garage's document and
    // nothing the surveyor ticks changes it.
    const valueAfterDep = effectiveAssessed(r) * (1 - depRate / 100);
```

- [ ] **Step 4: Add the exclusion comment to `salvage.ts`**

In `src/lib/calculations/salvage.ts`, above the `salvageBasis` export, append to the existing doc comment:

```ts
 * IMT-23 is deliberately ignored here. Salvage is the scrap value of the
 * physical part that came off; the endorsement changes who pays for the new
 * one, not what the old one is worth. Reads r.assessed, never effectiveAssessed.
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/calculations/__tests__/imt23-summary.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS, all tests. Regression floor holds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/calculations/assessment.ts src/lib/calculations/salvage.ts src/lib/calculations/__tests__/imt23-summary.test.ts
git commit -m "feat: apply IMT-23 in the assessment summary engine

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The three real claims as fixtures

Locks the arithmetic against three settled reports before any UI or report work begins. If a later task breaks the money, this is what says so.

**Files:**
- Test: `src/lib/calculations/__tests__/imt23-real-claims.test.ts` (create)

**Interfaces:**
- Consumes: `calculateAssessmentSummary`, `computeRowNet`, `effectiveAssessed`.
- Produces: nothing.

- [ ] **Step 1: Write the test**

Create `src/lib/calculations/__tests__/imt23-real-claims.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calculateAssessmentSummary } from '../assessment';
import { computeRowNet } from '../row-net';
import type { AssessmentRow } from '@/types/assessment';

const r = (o: Partial<AssessmentRow>): AssessmentRow => ({
  id: Math.random().toString(36).slice(2), particulars: 'x',
  estimated: 0, assessed: 0, partType: 'metal', gst: 18,
  section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50, ...o,
});

// Claim A — TATA SIGNA 4825, MOTOR-759/2025. Standard dep, 46 months.
// Rows collapsed per bucket; the IMT-23 portion is split into its own row so
// the halving is exercised. Metal 25%, plas/rub 50%, glass 0%, paint 12.5%.
describe('Claim A — TATA SIGNA 4825 (standard dep)', () => {
  const rows = [
    r({ assessed: 15927.00, partType: 'glass' }),
    r({ assessed: 877801.79 - 16433.91, partType: 'metal' }),
    r({ assessed: 16433.91, partType: 'metal', imt23: true }),
    r({ assessed: 409757.50 - 10443.22, partType: 'plastic' }),
    r({ assessed: 10443.22, partType: 'plastic', imt23: true }),
    r({ assessed: 98960.00, section: 'labour', partType: 'labour' }),
    r({ assessed: 20000.00, section: 'paint', partType: 'paint', imt23: true, depOverride: 12.5 }),
  ];
  const s = calculateAssessmentSummary(rows, 46, 'standard', 43650, 1500, 0);

  // Every assertion must run product code. `expect(16433.91 / 2).toBe(...)`
  // tests arithmetic on literals and would pass with the engine deleted.
  const share = (row: AssessmentRow) =>
    computeRowNet(row, 0, { grossOfImt23: true }).netBeforeGst
    - computeRowNet(row, 0).netBeforeGst;

  it('deducts the endorsement share per bucket', () => {
    expect(share(rows[2])).toBeCloseTo(8216.95, 2);  // metal
    expect(share(rows[4])).toBeCloseTo(5221.61, 2);  // plas/rub
    expect(share(rows[6])).toBeCloseTo(10000.00, 2); // paint
  });

  it("totals the insured's contribution", () => {
    const total = rows.reduce((s, r) => s + share(r), 0);
    expect(total).toBeCloseTo(23438.56, 2);
  });

  it('reaches each bucket after depreciation and GST', () => {
    expect(s.glassTotalInclGst).toBeCloseTo(18793.86, 1);
    expect(s.metalTotalInclGst).toBeCloseTo(769582.58, 1);
    expect(s.plasticTotalInclGst).toBeCloseTo(238676.17, 1);
    expect(s.partsTotal).toBeCloseTo(1027052.61, 1);
  });

  it('reaches the settled net assessed loss', () => {
    expect(s.labourTotal).toBeCloseTo(127097.80, 1);
    expect(s.grandTotal).toBeCloseTo(1154150.41, 1);
    expect(s.netAssessedLoss).toBeCloseTo(1109000.41, 1);
  });
});

// Claim B — TATA LPT 4825, MOTOR-801/2026. Nil dep, GST zeroed by the
// surveyor (no GST bills, disposal parts). Enumerated row by row.
describe('Claim B — TATA LPT 4825 (nil dep)', () => {
  const rows = [
    r({ assessed: 2200.00, partType: 'glass', gst: 0 }),
    r({ assessed: 400.00, partType: 'plastic', gst: 0 }),
    r({ assessed: 2400.00, partType: 'plastic', gst: 0, imt23: true }),
    r({ assessed: 5000.00, partType: 'metal', gst: 0, imt23: true }),
    r({ assessed: 5200.00, partType: 'metal', gst: 0 }),
    r({ assessed: 5200.00, partType: 'metal', gst: 0 }),
    r({ assessed: 4000.00, partType: 'metal', gst: 0 }),
    r({ assessed: 15000.00, section: 'labour', partType: 'labour', gst: 0 }),
    r({ assessed: 70000.00, section: 'labour', partType: 'labour', gst: 0 }),
    r({ assessed: 600.00, section: 'labour', partType: 'labour', gst: 0 }),
    r({ assessed: 18000.00, section: 'paint', partType: 'paint', gst: 0, imt23: true }),
  ];
  const s = calculateAssessmentSummary(rows, 41, 'nil', 1800, 1500, 0);

  it("totals the insured's contribution", () => {
    const total = rows.reduce((s, r) =>
      s + computeRowNet(r, 0, { grossOfImt23: true }).netBeforeGst
        - computeRowNet(r, 0).netBeforeGst, 0);
    expect(total).toBeCloseTo(12700.00, 2);
  });

  it('applies no paint material depreciation under a nil-dep policy', () => {
    expect(s.paintOnlyBase).toBeCloseTo(9000.00, 2);
  });

  it('reaches the settled net', () => {
    expect(s.partsBase).toBeCloseTo(20700.00, 2);
    expect(s.labourBase).toBeCloseTo(94600.00, 2);
    expect(s.grandTotal).toBeCloseTo(115300.00, 2);
    expect(s.netAssessedLoss).toBeCloseTo(112000.00, 2);
  });
});

// Claim C — TATA LPT 3118, MOTOR-867/2026, UIIC format. Row-level checks
// only; the summary box's stated Depreciation 86,499.76 could not be
// reconciled from the rendered pages and is deliberately not asserted.
describe('Claim C — TATA LPT 3118 (UIIC format)', () => {
  it('halves before depreciation, per row', () => {
    const indicator = r({ assessed: 300.00, partType: 'plastic', gst: 0, imt23: true });
    expect(computeRowNet(indicator, 50).netBeforeGst).toBeCloseTo(75.00, 2);

    const bumper = r({ assessed: 4500.00, partType: 'glass', gst: 0, imt23: true });
    expect(computeRowNet(bumper, 0).netBeforeGst).toBeCloseTo(2250.00, 2);

    const tyre = r({ assessed: 42372.00, partType: 'plastic', gst: 18, imt23: true });
    const net = computeRowNet(tyre, 50).netBeforeGst;
    expect(net).toBeCloseTo(10593.00, 2);
    expect(net * 1.18).toBeCloseTo(12499.74, 2);
  });

  it('reconciles the three tagged rows against the printed deduction', () => {
    // The report's parts column reads
    //   287,621.70 list − 23,586.00 IMT-23 − 73,867.00 dep = 190,168.70.
    // Only the middle term is ours to prove; assert it from the rows, not
    // from the subtraction.
    const tagged = [
      r({ assessed: 300.00, partType: 'plastic', gst: 0, imt23: true }),
      r({ assessed: 4500.00, partType: 'glass', gst: 0, imt23: true }),
      r({ assessed: 42372.00, partType: 'plastic', gst: 18, imt23: true }),
    ];
    const deduction = tagged.reduce((s, row) =>
      s + computeRowNet(row, 0, { grossOfImt23: true }).netBeforeGst
        - computeRowNet(row, 0).netBeforeGst, 0);
    expect(deduction).toBeCloseTo(23586.00, 2);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/lib/calculations/__tests__/imt23-real-claims.test.ts`
Expected: PASS, 10 tests. If a bucket total is off by more than ₹0.10, stop — the engine is wrong, not the fixture.

- [ ] **Step 3: Commit**

```bash
git add src/lib/calculations/__tests__/imt23-real-claims.test.ts
git commit -m "test: three settled claims as IMT-23 fixtures

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Paint material depreciation

Internal per-row effective rate. Never displayed as a rate by the standard report; the UIIC report does print `12.5%`.

**Files:**
- Modify: `src/types/claim.ts` (three optional fields + `createClaim` default)
- Modify: `src/lib/calculations/depreciation.ts`
- Test: `src/lib/calculations/__tests__/paint-material-dep.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `paintMaterialRate(claim: Pick<ClaimData, 'depreciationType' | 'applyPaintMaterialDep' | 'paintMaterialPercent' | 'paintMaterialDepPercent'>): number` returning the effective percentage (12.5 by default, 0 when inactive).

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/paint-material-dep.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { paintMaterialRate } from '../depreciation';

const claim = (o: Record<string, unknown> = {}) => ({
  depreciationType: 'standard' as const,
  applyPaintMaterialDep: true,
  paintMaterialPercent: undefined,
  paintMaterialDepPercent: undefined,
  ...o,
});

describe('paintMaterialRate', () => {
  it('is 12.5% by default — 25% material at 50% depreciation', () => {
    expect(paintMaterialRate(claim())).toBeCloseTo(12.5, 6);
  });

  it('is 0 when the surveyor has not switched it on', () => {
    expect(paintMaterialRate(claim({ applyPaintMaterialDep: false }))).toBe(0);
    expect(paintMaterialRate(claim({ applyPaintMaterialDep: undefined }))).toBe(0);
  });

  it('is 0 under a nil-depreciation policy', () => {
    expect(paintMaterialRate(claim({ depreciationType: 'nil' }))).toBe(0);
  });

  it('follows the surveyor’s own percentages', () => {
    expect(paintMaterialRate(claim({ paintMaterialPercent: 30 }))).toBeCloseTo(15, 6);
    expect(paintMaterialRate(claim({ paintMaterialPercent: 30, paintMaterialDepPercent: 40 })))
      .toBeCloseTo(12, 6);
  });

  it('reduces the taxable base, so GST applies to what remains', () => {
    // The whole point: (10000 - 1250) x 1.18 = 10325, NOT 10000 x 1.18 - 1250 = 10550
    const rate = paintMaterialRate(claim());
    const net = 10000 * (1 - rate / 100);
    expect(net).toBeCloseTo(8750, 2);
    expect(net * 1.18).toBeCloseTo(10325, 2);
    expect(net * 1.18).not.toBeCloseTo(10550, 2);
  });

  it("matches Claim C's printed paint chain", () => {
    // UIIC sample MOTOR-867/2026: 24,000 painting, IMT-23 tagged.
    // 24,000 -> less Imt 23 12,000 -> LESS PAINT DEP: 12.5% 1,500 -> 10,500
    const afterImt23 = 24000 / 2;
    const rate = paintMaterialRate(claim());
    expect(afterImt23 * (rate / 100)).toBeCloseTo(1500.00, 2);
    expect(afterImt23 * (1 - rate / 100)).toBeCloseTo(10500.00, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calculations/__tests__/paint-material-dep.test.ts`
Expected: FAIL — `paintMaterialRate is not a function`.

- [ ] **Step 3: Add the claim fields**

In `src/types/claim.ts`, inside the `ClaimData` interface, directly after `depreciationType`:

```ts
  /**
   * Apply IRDAI GR-9 paint material depreciation on this claim.
   *
   * Absent means off, so no claim already stored changes. `createClaim` sets it
   * true, and `paintMaterialRate` additionally requires a standard-depreciation
   * policy — under nil dep there is no material deduction at all.
   */
  applyPaintMaterialDep?: boolean;
  /** Material share of a consolidated painting charge. GR-9 default: 25. */
  paintMaterialPercent?: number;
  /** Depreciation on that material. GR-9 default: 50. */
  paintMaterialDepPercent?: number;
```

In the same file, inside `createClaim`'s returned object, directly after `depreciationType: 'standard',`:

```ts
    applyPaintMaterialDep: true,
```

- [ ] **Step 4: Implement the rate**

Append to `src/lib/calculations/depreciation.ts`:

```ts
/**
 * Effective per-row depreciation rate for a painting line.
 *
 * IRDAI modified GR-9 with effect from 01 Feb 2013: depreciation of 50% applies
 * only to the MATERIAL cost of painting charges, and where the bill is
 * consolidated the material component is taken as 25% of the total. That is
 * 12.5% of the line.
 *
 * It is expressed as a rate, not as a deduction from the section subtotal, for
 * two reasons. A subtotal subtraction would leave the per-row GST attached to a
 * base that no longer exists, and paint rows can carry different GST rates,
 * which a single section figure cannot reverse out. The rate is never printed
 * as "12.5%" by the standard report — that report states the 50%-on-material
 * rule and shows the split. The UIIC report does print it, because that is its
 * own convention.
 */
export function paintMaterialRate(claim: {
  depreciationType?: string | null;
  applyPaintMaterialDep?: boolean;
  paintMaterialPercent?: number;
  paintMaterialDepPercent?: number;
}): number {
  if (!claim.applyPaintMaterialDep) return 0;
  if (toDepreciationType(claim.depreciationType) === 'nil') return 0;
  const material = claim.paintMaterialPercent ?? 25;
  const dep = claim.paintMaterialDepPercent ?? 50;
  return (material / 100) * (dep / 100) * 100;
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/calculations/__tests__/paint-material-dep.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS. `paintMaterialRate` has no callers yet, so nothing moves.

- [ ] **Step 7: Commit**

```bash
git add src/types/claim.ts src/lib/calculations/depreciation.ts src/lib/calculations/__tests__/paint-material-dep.test.ts
git commit -m "feat: GR-9 paint material depreciation as an effective rate

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Apply the paint rate at every depreciation-rate call site

There are eight places that compute a row's rate with the same expression. This task routes them all through one function so paint picks up its rate everywhere at once.

**Files:**
- Create: `src/lib/calculations/row-dep-rate.ts`
- Modify: `src/lib/calculations/assessment.ts:87`, `:231`
- Modify: `src/lib/reports/standard-report-builder.ts:106`, `:278`, `:325`
- Modify: `src/lib/reports/uiic-final-builder.ts` (both `rowDepFor` definitions)
- Modify: `src/components/claim/AssessmentSectionTable.tsx` (the local `depRate`)
- Test: `src/lib/calculations/__tests__/row-dep-rate.test.ts` (create)

**Interfaces:**
- Consumes: `paintMaterialRate` from Task 4, `getDepreciationRate` from `depreciation.ts`.
- Produces: `rowDepRate(row: AssessmentRow, ageMonths: number, claim: PaintDepClaim): number` where `PaintDepClaim` is the same structural type `paintMaterialRate` takes.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/row-dep-rate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rowDepRate } from '../row-dep-rate';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow> = {}): AssessmentRow => ({
  id: 'r', particulars: 'x', estimated: 0, assessed: 100,
  partType: 'metal', gst: 18, section: 'parts', allowed: true,
  isDisposal: false, disposalPercent: 50, ...o,
});
const claim = { depreciationType: 'standard', applyPaintMaterialDep: true };

describe('rowDepRate', () => {
  it('gives paint rows the material rate', () => {
    expect(rowDepRate(row({ section: 'paint', partType: 'paint' }), 46, claim)).toBeCloseTo(12.5, 6);
  });

  it('leaves labour at zero', () => {
    expect(rowDepRate(row({ section: 'labour', partType: 'labour' }), 46, claim)).toBe(0);
  });

  it('keeps the IRDAI scale for parts', () => {
    expect(rowDepRate(row(), 46, claim)).toBe(25);
    expect(rowDepRate(row({ partType: 'plastic' }), 46, claim)).toBe(50);
  });

  it('lets a surveyor override beat the paint rate', () => {
    const r = row({ section: 'paint', partType: 'paint', depOverride: 40 });
    expect(rowDepRate(r, 46, claim)).toBe(40);
  });

  it('respects an explicit zero override', () => {
    const r = row({ section: 'paint', partType: 'paint', depOverride: 0 });
    expect(rowDepRate(r, 46, claim)).toBe(0);
  });

  it('gives paint nothing when the claim switch is off', () => {
    const r = row({ section: 'paint', partType: 'paint' });
    expect(rowDepRate(r, 46, { depreciationType: 'standard' })).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calculations/__tests__/row-dep-rate.test.ts`
Expected: FAIL — cannot resolve `../row-dep-rate`.

- [ ] **Step 3: Create the module**

Create `src/lib/calculations/row-dep-rate.ts`:

```ts
import type { AssessmentRow } from '@/types/assessment';
import { getDepreciationRate, paintMaterialRate, toDepreciationType } from './depreciation';

export interface PaintDepClaim {
  depreciationType?: string | null;
  applyPaintMaterialDep?: boolean;
  paintMaterialPercent?: number;
  paintMaterialDepPercent?: number;
}

/**
 * The depreciation rate for one row.
 *
 * The expression `r.depOverride !== undefined ? r.depOverride : getDepreciationRate(...)`
 * had eight copies across the engine, the two report builders and the grid.
 * Paint's GR-9 rate has to reach every one of them, so they now share this.
 *
 * Order matters: a surveyor's override always wins, including an explicit 0.
 */
export function rowDepRate(
  row: AssessmentRow,
  ageMonths: number,
  claim: PaintDepClaim,
): number {
  if (row.depOverride !== undefined) return row.depOverride;
  if (row.section === 'paint') return paintMaterialRate(claim);
  return getDepreciationRate(row.partType, ageMonths, toDepreciationType(claim.depreciationType));
}
```

- [ ] **Step 4: Run the new test**

Run: `npx vitest run src/lib/calculations/__tests__/row-dep-rate.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Route `calculateAssessmentSummary` through it**

`calculateAssessmentSummary` currently takes `depType` but not the paint fields. Add an optional last parameter rather than changing every caller.

In `src/lib/calculations/assessment.ts`, add to the imports:

```ts
import { rowDepRate, type PaintDepClaim } from './row-dep-rate';
```

Change the signature of `calculateAssessmentSummary` from:

```ts
  voluntaryExcess: number = 0
): AssessmentSummary {
```

to:

```ts
  voluntaryExcess: number = 0,
  // Paint's GR-9 rate is a claim-level setting, so the engine needs the claim's
  // three paint fields. Optional: omitted means no paint material depreciation,
  // which is exactly how every stored claim behaved before this existed.
  paintDep: PaintDepClaim = { depreciationType: depType }
): AssessmentSummary {
```

Then replace line 87:

```ts
    const depRate = r.depOverride !== undefined ? r.depOverride : getDepreciationRate(r.partType, ageMonths, depType);
```

with:

```ts
    const depRate = rowDepRate(r, ageMonths, { ...paintDep, depreciationType: depType });
```

Apply the identical replacement inside `calculateBillCheckSummary` at line 231, and add the same optional `paintDep` parameter to its signature.

- [ ] **Step 6: Route the two report builders and the grid through it**

In `src/lib/reports/standard-report-builder.ts`, add `import { rowDepRate } from '@/lib/calculations/row-dep-rate';` and replace all three occurrences of

```ts
const dep = r.depOverride !== undefined ? r.depOverride : getDepreciationRate(r.partType, ageMonths, depType);
```

(at `:106`, `:278`, `:325`) with:

```ts
const dep = rowDepRate(r, ageMonths, claim);
```

Do the same in `src/lib/reports/uiic-final-builder.ts` for each `rowDepFor` definition, and in `src/components/claim/AssessmentSectionTable.tsx` for its local `depRate`, passing `currentClaim` as the third argument.

- [ ] **Step 7: Pass the paint fields from the summary's callers**

Every call to `calculateAssessmentSummary` that has a claim in scope gains a final argument. In `src/components/claim/AssessmentGrid.tsx`, `src/components/claim/AssessmentSummary.tsx`, `src/components/tabs/BillCheckTab.tsx`, `src/components/tabs/DetailsTab.tsx`, `src/components/tabs/ReportTab.tsx`, `src/lib/reports/standard-report-builder.ts` and `src/lib/reports/uiic-final-builder.ts`, append `currentClaim` (or the local `claim`) as the last argument.

Leave `src/lib/reports/irdai-summary-builder.ts` and `src/components/tabs/FeesTab.tsx` alone — the first is a regulatory roll-up and the second reads only estimate totals.

- [ ] **Step 8: Run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass. Stored claims have no `applyPaintMaterialDep`, so paint stays at 0%.

- [ ] **Step 9: Commit**

```bash
git add -A src/lib src/components
git commit -m "refactor: one rowDepRate for all eight depreciation-rate call sites

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The IMT-23 column in the assessment grid

**Files:**
- Modify: `src/components/claim/assessment-grid-config.ts`
- Modify: `src/components/claim/AssessmentSectionTable.tsx`
- Test: `src/components/claim/__tests__/imt23-column.test.ts` (create)

**Interfaces:**
- Consumes: `imt23` on `AssessmentRow` from Task 1.
- Produces: `'imt23'` as a member of `OptionalColumn`; a checkbox cell calling `updateAssessmentRow(row.id, { imt23: !row.imt23 })`.

- [ ] **Step 1: Write the failing test**

Create `src/components/claim/__tests__/imt23-column.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { OPTIONAL_COLUMNS, DEFAULT_VISIBLE, loadVisibility } from '../assessment-grid-config';

describe('IMT-23 column configuration', () => {
  it('is offered in the column picker', () => {
    const col = OPTIONAL_COLUMNS.find(c => c.key === 'imt23');
    expect(col).toBeDefined();
    expect(col!.label).toBe('IMT 23');
  });

  it('is visible by default and can be hidden', () => {
    expect(DEFAULT_VISIBLE.imt23).toBe(true);
    expect(loadVisibility().imt23).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/claim/__tests__/imt23-column.test.ts`
Expected: FAIL — `col` is undefined.

- [ ] **Step 3: Add the column to the config**

In `src/components/claim/assessment-grid-config.ts`:

Add `| 'imt23'` to the `OptionalColumn` union.

Add to `OPTIONAL_COLUMNS`, after the `disposal` entry:

```ts
  { key: 'imt23',      label: 'IMT 23',              description: 'Endorsement IMT-23 part — insurer bears 50% of the assessed loss' },
```

Add to `DEFAULT_VISIBLE`, after `disposal: true,`:

```ts
  imt23: true,
```

- [ ] **Step 4: Run the config test**

Run: `npx vitest run src/components/claim/__tests__/imt23-column.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Render the column**

In `src/components/claim/AssessmentSectionTable.tsx`, add a header cell alongside the existing `disposal` header, guarded the same way that file guards its other optional columns:

```tsx
{visible.imt23 && (
  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground whitespace-nowrap" title="Endorsement IMT-23 — insurer bears 50% of the assessed loss">
    IMT 23
  </th>
)}
```

And the matching body cell, alongside the existing disposal cell:

```tsx
{visible.imt23 && (
  <td className="px-2 py-1.5 text-center">
    <input
      type="checkbox"
      checked={!!row.imt23}
      onChange={() => updateAssessmentRow(row.id, { imt23: !row.imt23 })}
      className="rounded border-border h-3.5 w-3.5 cursor-pointer accent-primary"
      aria-label="IMT-23 part"
    />
  </td>
)}
```

Give a ticked row the same treatment the file already gives disposal rows, by appending to the `SortableRow` className expression:

```tsx
${row.imt23 && row.allowed ? 'bg-primary/5' : ''}
```

Do **not** change the row's Assessed or Price+GST cells. Rows keep showing the part's own figures; the deduction appears in the section footer (Task 7).

- [ ] **Step 6: Verify in the browser**

Start the dev server and open a claim's Assessment tab. Confirm the `IMT 23` column renders, the checkbox persists across a tab switch, and the column disappears when unticked in the column picker.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and passing.

- [ ] **Step 8: Commit**

```bash
git add src/components/claim/assessment-grid-config.ts src/components/claim/AssessmentSectionTable.tsx src/components/claim/__tests__/imt23-column.test.ts
git commit -m "feat(grid): IMT-23 checkbox column

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Grid section footers and the paint controls

The grid must preview the report: the same deduction lines, in the same order and wording, so nothing is discovered at print time.

**Files:**
- Create: `src/lib/calculations/imt23-totals.ts`
- Modify: `src/components/claim/AssessmentSectionTable.tsx` (footer + paint header controls)
- Test: `src/lib/calculations/__tests__/imt23-totals.test.ts` (create)

**Interfaces:**
- Consumes: `AssessmentRow.imt23`, `paintMaterialRate`.
- Produces: `imt23Totals(rows: AssessmentRow[]): Record<AssessmentSection, { amount: number; count: number }>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/imt23-totals.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { imt23Totals } from '../imt23-totals';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow>): AssessmentRow => ({
  id: Math.random().toString(36).slice(2), particulars: 'x',
  estimated: 0, assessed: 0, partType: 'metal', gst: 18,
  section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50, ...o,
});

describe('imt23Totals', () => {
  it('sums half of each ticked row, per section', () => {
    const t = imt23Totals([
      row({ assessed: 4100, imt23: true }),
      row({ assessed: 1472 }),
      row({ assessed: 20000, section: 'paint', imt23: true }),
    ]);
    expect(t.parts.amount).toBeCloseTo(2050, 2);
    expect(t.parts.count).toBe(1);
    expect(t.paint.amount).toBeCloseTo(10000, 2);
    expect(t.labour.amount).toBe(0);
    expect(t.labour.count).toBe(0);
  });

  it('ignores disallowed rows — they were never a liability', () => {
    const t = imt23Totals([row({ assessed: 4100, imt23: true, allowed: false })]);
    expect(t.parts.amount).toBe(0);
    expect(t.parts.count).toBe(0);
  });

  it('contributes nothing for a row that was never billed', () => {
    // Bill-check projection zeroes assessed on a not-in-bill row, so the
    // deduction vanishes with it and no line should be rendered.
    const t = imt23Totals([row({ assessed: 0, imt23: true, billStatus: 'not-in-bill' })]);
    expect(t.parts.amount).toBe(0);
    expect(t.parts.count).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calculations/__tests__/imt23-totals.test.ts`
Expected: FAIL — cannot resolve `../imt23-totals`.

- [ ] **Step 3: Create the module**

Create `src/lib/calculations/imt23-totals.ts`:

```ts
import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

export interface Imt23SectionTotal {
  /** The insured's 50% share for this section, on the pre-depreciation assessed figure. */
  amount: number;
  /** Rows actually contributing to `amount` — printed as "N items". */
  count: number;
}

/**
 * The printed "Less endorsement 23" figure, per section.
 *
 * Computed on the pre-depreciation assessed amount, which is what the market
 * format prints and what makes the subtotal block reconcile whatever mix of
 * depreciation rates the bucket holds.
 *
 * A row contributes only when it carries money: disallowed rows were never a
 * liability, and a not-in-bill row arrives here already zeroed by the bill-check
 * projection. Callers render the line only when `amount > 0`, never merely
 * because a ticked row exists — otherwise a bill check with an unbilled IMT-23
 * part prints a zero-value deduction the sample reports do not have.
 */
export function imt23Totals(
  rows: AssessmentRow[],
): Record<AssessmentSection, Imt23SectionTotal> {
  const out: Record<AssessmentSection, Imt23SectionTotal> = {
    parts:  { amount: 0, count: 0 },
    labour: { amount: 0, count: 0 },
    paint:  { amount: 0, count: 0 },
  };
  for (const r of rows) {
    if (!r.imt23 || r.allowed === false || !r.assessed) continue;
    out[r.section].amount += r.assessed / 2;
    out[r.section].count += 1;
  }
  return out;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/calculations/__tests__/imt23-totals.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Add the footer line to the grid**

In `src/components/claim/AssessmentSectionTable.tsx`, immediately above the existing section subtotal footer row, render:

```tsx
{sectionImt23.amount > 0 && (
  <tr className="bg-primary/5 text-primary">
    <td colSpan={leadingColSpan} className="px-2 py-1 text-right text-[11px]">
      Less endorsement 23 (50% insured&apos;s share, {sectionImt23.count} item{sectionImt23.count === 1 ? '' : 's'})
    </td>
    <td className="px-2 py-1 text-right text-[11px] tabular-nums">
      {sectionImt23.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </td>
    <td colSpan={trailingColSpan} />
  </tr>
)}
```

where `sectionImt23 = imt23Totals(rows)[section]`, and `leadingColSpan` / `trailingColSpan` match the existing subtotal row's own column arithmetic in that file.

- [ ] **Step 6: Add the paint controls to the Painting section header**

Rendered only when the section is `paint` and the claim is standard depreciation:

```tsx
{section === 'paint' && toDepreciationType(currentClaim.depreciationType) === 'standard' && (
  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={!!currentClaim.applyPaintMaterialDep}
        onChange={() => updateClaim({ applyPaintMaterialDep: !currentClaim.applyPaintMaterialDep })}
        className="rounded border-border h-3.5 w-3.5 cursor-pointer accent-primary"
      />
      Paint material dep
    </label>
    <span>
      material
      <input
        type="number" min={0} max={100}
        value={currentClaim.paintMaterialPercent ?? 25}
        onChange={(e) => updateClaim({ paintMaterialPercent: Number(e.target.value) })}
        className="w-12 mx-1 px-1 border border-border rounded text-right"
      />
      % @
      <input
        type="number" min={0} max={100}
        value={currentClaim.paintMaterialDepPercent ?? 50}
        onChange={(e) => updateClaim({ paintMaterialDepPercent: Number(e.target.value) })}
        className="w-12 mx-1 px-1 border border-border rounded text-right"
      />
      % dep
    </span>
  </div>
)}
```

- [ ] **Step 7: Verify in the browser**

Open a commercial claim's Assessment tab. Tick an IMT-23 row and confirm the deduction line appears under that section's subtotal with the right amount and item count. Untick it and confirm the line disappears entirely. Toggle the paint switch and confirm the painting subtotal moves by 12.5%.

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and passing.

- [ ] **Step 9: Commit**

```bash
git add -A src/lib/calculations src/components/claim
git commit -m "feat(grid): endorsement 23 footer line and paint material controls

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The standard report

Rows render **gross** so they sum to the pre-deduction subtotal, exactly as the sample does. The deduction is one visible line beneath.

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts`
- Test: `src/lib/reports/__tests__/imt23-standard-report.test.ts` (create)

**Interfaces:**
- Consumes: `imt23Totals`, `computeRowNet(..., { grossOfImt23: true })`, `paintMaterialRate`.
- Produces: report HTML only.

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/imt23-standard-report.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildStandardReportHTML } from '../standard-report-builder';
import { createClaim } from '@/types/claim';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow>): AssessmentRow => ({
  id: Math.random().toString(36).slice(2), particulars: 'BUMPER',
  estimated: 4100, assessed: 4100, partType: 'metal', gst: 18,
  section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50, ...o,
});

function claimWith(rows: AssessmentRow[]) {
  const c = createClaim('final', 'commercial');
  return { ...c, assessmentRows: rows, depreciationType: 'nil' as const };
}

describe('standard report — IMT-23', () => {
  it('prints the deduction line with the item count', () => {
    const html = buildStandardReportHTML(claimWith([row({ imt23: true })]), null);
    expect(html).toContain('Less endorsement 23');
    expect(html).toContain('1 item');
  });

  it('prints no deduction line when nothing is ticked', () => {
    const html = buildStandardReportHTML(claimWith([row()]), null);
    expect(html).not.toContain('Less endorsement 23');
  });

  it('tags the row and leaves the stored particulars alone', () => {
    const rows = [row({ imt23: true })];
    const html = buildStandardReportHTML(claimWith(rows), null);
    expect(html).toContain('BUMPER - IMT 23');
    expect(rows[0].particulars).toBe('BUMPER');
  });

  it('shows the row at its full figure, not halved', () => {
    const html = buildStandardReportHTML(claimWith([row({ imt23: true })]), null);
    expect(html).toContain('4,100.00');
    expect(html).not.toContain('2,050.00');
  });

  it('states the paint rule, never the derived percentage', () => {
    const c = { ...claimWith([row({ section: 'paint', partType: 'paint', assessed: 10000 })]),
                depreciationType: 'standard' as const, applyPaintMaterialDep: true };
    const html = buildStandardReportHTML(c, null);
    expect(html).toContain('Less 50% dep. on paint material');
    expect(html).toContain('Painting material @ 25%');
    expect(html).not.toContain('12.5%');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/imt23-standard-report.test.ts`
Expected: FAIL — HTML does not contain `Less endorsement 23`.

- [ ] **Step 3: Render rows gross and tag them**

In `src/lib/reports/standard-report-builder.ts`, in the parts row map at `:281`, change:

```ts
const { isDisposal, afterDep, netBeforeGst } = disallowed ? { isDisposal: false, afterDep: 0, netBeforeGst: 0 } : computeRowNet(r, dep);
```

to:

```ts
// grossOfImt23: this report's rows must sum to the pre-deduction subtotal,
// with one "Less endorsement 23" line beneath, exactly as the market format
// does. The halving is taken at the subtotal, not on the row.
const { isDisposal, afterDep, netBeforeGst } = disallowed
  ? { isDisposal: false, afterDep: 0, netBeforeGst: 0 }
  : computeRowNet(r, dep, { grossOfImt23: true });
```

Apply the same change in `serviceRowHtml` at `:328`.

In both row templates, replace the particulars cell body `${r.particulars}` with `${partLabel(r)}`, and add this helper above `partsHtml`:

```ts
// The tag is derived from the checkbox and never written to r.particulars —
// the surveyor types the part name, the report adds the endorsement marker.
const partLabel = (r: AssessmentRow) =>
  r.imt23 ? `<b>${r.particulars} - IMT 23</b>` : r.particulars;
```

- [ ] **Step 4: Add the deduction rows**

Add near the other calculations, after `assessedPaintRaw`:

```ts
const imt23 = imt23Totals(rows.filter(r => !isBillCheck || r.allowed !== false));

const imt23Row = (t: { amount: number; count: number }, trailing: number) =>
  t.amount <= 0 ? '' : `<tr>
    <td colspan="4" style="${sub}text-align:right;font-size:${scale.labelFont};">Less endorsement 23 (50% insured's share, ${t.count} item${t.count === 1 ? '' : 's'})</td>
    <td style="${sub}text-align:right;font-weight:700;">${m9(t.amount)}</td>
    <td colspan="${trailing}" style="${sub}"></td>
  </tr>`;
```

with `import { imt23Totals } from '@/lib/calculations/imt23-totals';` at the top.

Insert `${imt23Row(imt23.parts, NCOLS - 5)}` immediately **after** the Sub-Total Parts row at `:812`, `${imt23Row(imt23.labour, NCOLS - 5)}` after the Sub-Total Labour row at `:823`, and `${imt23Row(imt23.paint, NCOLS - 5)}` after the Sub-Total Painting row at `:834`.

- [ ] **Step 5: Add the paint material note**

Compute the three figures once, beside the other calculations near `assessedPaintRaw`:

```ts
const mPct = claim.paintMaterialPercent ?? 25;
const mDepPct = claim.paintMaterialDepPercent ?? 50;
const paintBaseAfterImt23 = assessedPaintRaw - imt23.paint.amount;
const paintMaterialBase = paintBaseAfterImt23 * (mPct / 100);
const paintMaterialDed = paintMaterialBase * (mDepPct / 100);
```

Then emit this row immediately after the painting deduction row:

```ts
${paintMaterialRate(claim) > 0 && paintBaseAfterImt23 > 0 ? `<tr>
  <td colspan="${NCOLS}" style="${td9}font-size:${scale.labelFont};color:#444;">
    Less ${mDepPct}% dep. on paint material (${m9(paintMaterialBase)} of ${m9(paintBaseAfterImt23)} @ ${mPct}%) &nbsp;=&nbsp; ${m9(paintMaterialDed)}
    &nbsp;·&nbsp; Painting labour @ ${100 - mPct}% &nbsp;·&nbsp; Painting material @ ${mPct}%
  </td>
</tr>` : ''}
```

The note states the tariff's own rule — 50% on the material — and shows the split. It must never print the derived 12.5%; that form belongs to the UIIC report only (Task 10).

- [ ] **Step 6: Add the contribution line and the policy banner**

In section 8's insurer-information block, when `imt23.parts.amount + imt23.labour.amount + imt23.paint.amount > 0`, add a row:

```
Contribution of insured under IMT-23     <total>
```

And print the existing `depLabel` (`:358`) prominently in the report header, alongside the report number, in the manner of the sample's `Note : ( 0% Dep. Policy)`.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/lib/reports/__tests__/imt23-standard-report.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 8: Run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and passing — the regression floor proves untagged claims are unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts src/lib/reports/__tests__/imt23-standard-report.test.ts
git commit -m "feat(report): endorsement 23 and paint material lines in the standard report

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: The standard bill check `*` column

The bill check is the same builder in `isBillCheck` mode. Only the marker differs — the sample bill check uses an asterisk column where the final uses bold text.

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts`
- Test: `src/lib/reports/__tests__/imt23-bill-check.test.ts` (create)

**Interfaces:**
- Consumes: everything from Task 8.
- Produces: report HTML only.

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/imt23-bill-check.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeRowLiability } from '@/lib/calculations/row-net';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow>): AssessmentRow => ({
  id: 'r', particulars: 'HEAD LAMP', estimated: 0, assessed: 5076.27,
  partType: 'plastic', gst: 18, section: 'parts', allowed: true,
  isDisposal: false, disposalPercent: 50, ...o,
});

describe('bill check — IMT-23', () => {
  it('caps at the assessed figure before halving, unlike the sample', () => {
    // Sample paid the billed 5,260.17; we cap at the assessed 5,076.27.
    const r = row({ imt23: true, billedTaxable: 5260.17, billStatus: 'in-bill' });
    const { liability } = computeRowLiability(r, 0);
    expect(liability).toBeCloseTo((5076.27 / 2) * 1.18, 2);
  });

  it('min then halve equals halve then min', () => {
    expect(Math.min(4100, 4223.73) / 2).toBeCloseTo(Math.min(4100 / 2, 4223.73 / 2), 6);
  });

  it('contributes nothing when the item was never billed', () => {
    const r = row({ imt23: true, billStatus: 'not-in-bill' });
    expect(computeRowLiability(r, 0).liability).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run src/lib/reports/__tests__/imt23-bill-check.test.ts`
Expected: PASS already — `computeRowLiability` calls `computeRowNet`, which Task 1 made IMT-23-aware. This test exists to lock that in, and to record the deliberate divergence from the sample.

- [ ] **Step 3: Add the marker column**

In `src/lib/reports/standard-report-builder.ts`, when `isBillCheck` is true, add a narrow trailing header cell `<th style="${th}width:2%;text-align:center;">23</th>` and a matching body cell on every row:

```ts
${isBillCheck ? `<td style="${tdr9}text-align:center;font-weight:700;">${r.imt23 ? '*' : ''}</td>` : ''}
```

The marker renders on `not-in-bill` and disallowed rows too — the tag belongs to the part, not to the money. Increment `NCOLS` by one in bill-check mode so every `colspan` in the table stays correct.

- [ ] **Step 4: Run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts src/lib/reports/__tests__/imt23-bill-check.test.ts
git commit -m "feat(report): IMT-23 marker column in the standard bill check

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: The UIIC report

Different shape, same data: IMT-23 is a per-row `Less Imt 23` line carrying the halved figure, and painting takes a section block that prints the effective rate.

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts`
- Test: `src/lib/reports/__tests__/imt23-uiic-report.test.ts` (create)

**Interfaces:**
- Consumes: `effectiveAssessed`, `imt23Totals`, `paintMaterialRate`.
- Produces: report HTML only.

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/imt23-uiic-report.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildUIICFinalHTML } from '../uiic-final-builder';
import { createClaim } from '@/types/claim';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow>): AssessmentRow => ({
  id: Math.random().toString(36).slice(2), particulars: 'INDICATOR FR RH',
  estimated: 300, assessed: 300, partType: 'plastic', gst: 0,
  section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50, ...o,
});

function claimWith(rows: AssessmentRow[], extra: Record<string, unknown> = {}) {
  return { ...createClaim('final', 'commercial'), assessmentRows: rows, ...extra };
}

describe('UIIC report — IMT-23', () => {
  it('prints a per-row Less Imt 23 line with the halved figure', () => {
    const html = buildUIICFinalHTML(claimWith([row({ imt23: true })]), null);
    expect(html).toContain('Less Imt 23');
    expect(html).toContain('150.00');
  });

  it('prints no per-row line for an untagged row', () => {
    const html = buildUIICFinalHTML(claimWith([row()]), null);
    expect(html).not.toContain('Less Imt 23');
  });

  it('prints the paint block with the effective rate, as this format does', () => {
    const html = buildUIICFinalHTML(claimWith(
      [row({ section: 'paint', partType: 'paint', assessed: 24000, imt23: true })],
      { depreciationType: 'standard', applyPaintMaterialDep: true },
    ), null);
    expect(html).toContain('LESS PAINT DEP: 12.5%');
    expect(html).toContain('12,000.00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/imt23-uiic-report.test.ts`
Expected: FAIL — HTML does not contain `Less Imt 23`.

- [ ] **Step 3: Add the per-row line**

In `buildUIICFinalHTML`'s parts and labour row maps, append a second `<tr>` immediately after each tagged row, carrying the halved figure in the same column as the part's list price:

```ts
${r.imt23 ? `<tr>
  <td style="${td}"></td>
  <td style="${td}font-weight:700;">Less Imt 23</td>
  <td style="${tdr}font-weight:700;">${fa(r.assessed / 2)}</td>
  <td colspan="${remainingCols}" style="${td}"></td>
</tr>` : ''}
```

where `remainingCols` is that table's column count minus three. The row above it keeps printing `r.assessed` as the list price; every downstream figure on that row already uses `computeRowNet`, which halves.

- [ ] **Step 4: Add the painting block**

After the painting section's rows, emit:

```ts
<tr><td colspan="${NC - 1}" style="${sub}text-align:right;">SUB TOTAL</td><td style="${subr}">${fa(paintRaw)}</td></tr>
${imt23.paint.amount > 0 ? `<tr><td colspan="${NC - 1}" style="${sub}text-align:right;font-weight:700;">Less Imt 23</td><td style="${subr}font-weight:700;">${fa(imt23.paint.amount)}</td></tr>
<tr><td colspan="${NC - 1}" style="${sub}text-align:right;">SUB TOTAL</td><td style="${subr}">${fa(paintRaw - imt23.paint.amount)}</td></tr>` : ''}
${pmRate > 0 ? `<tr><td colspan="${NC - 1}" style="${sub}text-align:right;font-weight:700;">LESS PAINT DEP: ${pmRate}%</td><td style="${subr}">${fa((paintRaw - imt23.paint.amount) * pmRate / 100)}</td></tr>` : ''}
```

with `const pmRate = paintMaterialRate(claim);` and `const paintRaw = ...` the sum of allowed paint rows' `assessed`.

- [ ] **Step 5: Add the contribution line**

In the UIIC summary box, add a `Contribution of insured under IMT-23` row when the total is greater than zero. **Leave `Amount Payable by Insured` computing exactly as it does today** — depreciation + salvage + excess — matching the sample. Add a comment saying so, so it is not "corrected" later.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/lib/reports/__tests__/imt23-uiic-report.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and passing.

- [ ] **Step 8: Commit**

```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/imt23-uiic-report.test.ts
git commit -m "feat(report): per-row Less Imt 23 and paint block in the UIIC format

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: The insured report clause

IMT-23 is a benefit. Without the endorsement these parts carry no cover at all, and the clause must say so.

**Files:**
- Modify: `src/lib/calculations/depreciation.ts` (`getIRDAIStandardClauses`)
- Modify: `src/types/insured-report.ts` (add `'imt-23'` to the clause-type union)
- Modify: `src/lib/calculations/insured-report.ts` (exclusion comments)
- Test: `src/lib/calculations/__tests__/imt23-insured-clause.test.ts` (create)

**Interfaces:**
- Consumes: `imt23Totals`.
- Produces: `getIMT23Clause(): InsuredReportPolicyClause`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/imt23-insured-clause.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getIMT23Clause } from '../depreciation';

describe('IMT-23 insured clause', () => {
  it('leads with the cover the endorsement restores, not the deduction', () => {
    const c = getIMT23Clause();
    expect(c.clauseType).toBe('imt-23');
    expect(c.plainLanguage).toContain('not covered at all');
    expect(c.plainLanguage).toContain('in full');
  });

  it('states the conditions that limit the cover', () => {
    const c = getIMT23Clause();
    expect(c.policyText).toContain('50%');
    expect(c.policyText).toContain('also damaged in the same incident');
    expect(c.policyText).toContain('Theft');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calculations/__tests__/imt23-insured-clause.test.ts`
Expected: FAIL — `getIMT23Clause is not a function`.

- [ ] **Step 3: Add `'imt-23'` to the clause-type union**

In `src/types/insured-report.ts`, add `| 'imt-23'` to the `clauseType` union on `InsuredReportPolicyClause`.

- [ ] **Step 4: Implement the clause**

Append to `src/lib/calculations/depreciation.ts`:

```ts
/**
 * IMT-23 is a benefit, not a penalty.
 *
 * Under a standard commercial vehicle policy these parts carry NO cover (the
 * IMT-21 exclusion). The endorsement buys back half. An insured who reads this
 * as a deduction has been told the opposite of what happened, so the plain
 * language leads with the cover restored.
 *
 * Surfaced only when the claim actually has IMT-23 rows.
 */
export function getIMT23Clause(): InsuredReportPolicyClause {
  return {
    clauseType: 'imt-23',
    clauseTitle: 'Endorsement IMT-23 — cover restored on specified parts',
    policyText:
      'Under a standard commercial vehicle package policy, loss of or damage to lamps, tyres/tubes, mudguards, bonnet/side parts, bumpers, headlights and paintwork is excluded. Endorsement IMT-23 restores cover for these items, subject to the insured bearing 50% of the assessed loss on each such item, and provided the vehicle is also damaged in the same incident. Theft of these items is excluded under all circumstances.',
    plainLanguage:
      'Parts such as your bumper, headlamps, mudguards and paintwork are normally not covered at all under a commercial vehicle policy. Your policy carries Endorsement IMT-23, which brings them back into cover: the insurer pays half of their assessed cost and you bear the other half. Without this endorsement you would have had to pay for these parts in full.',
    source: 'irdai-standard',
  };
}
```

- [ ] **Step 5: Surface it only when the claim uses it**

Where the insured report assembles its clause list, append `getIMT23Clause()` when any row has `imt23` set.

- [ ] **Step 6: Add the exclusion comments**

In `src/lib/calculations/insured-report.ts`, above the `negotiatedSavings` reducer and each of the `overpricing` / `partial-repair` reducers:

```ts
  // Raw r.assessed, never effectiveAssessed. These compare the garage's figure
  // against the surveyor's; halving the surveyor's side would invent negotiated
  // savings equal to half the part's value and report them to the insured.
```

And above the per-row `assessed: r.assessed` in the line-item map:

```ts
  // The insured sees the part at its true assessed value. The IMT-23 share is a
  // separate named line, not a silently halved figure that reads as
  // undervaluing their part.
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/lib/calculations/__tests__/imt23-insured-clause.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 8: Run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and passing.

- [ ] **Step 9: Fix the false claim in the Assessment tab**

`src/components/tabs/AssessmentTab.tsx:83` currently reads *"Calculations apply IMT-23 and GST automatically based on part types."* That was untrue when written and is still misleading — IMT-23 is never automatic. Replace with:

```tsx
Build the assessment grid. GST and depreciation apply automatically by part type; tick IMT 23 on a row to apply the endorsement.
```

- [ ] **Step 10: Commit**

```bash
git add -A src/lib/calculations src/types/insured-report.ts src/components/tabs/AssessmentTab.tsx src/lib/calculations/__tests__/imt23-insured-clause.test.ts
git commit -m "feat: IMT-23 clause in the insured report, framed as cover restored

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage.** Part 1 → Task 1. Part 2 → Tasks 1, 2, 5. Part 3 exclusions → Tasks 2, 11 (comments) and tested in Task 2. Part 4 paint → Tasks 4, 5. Part 5 data model → Tasks 1, 4. Part 6 summary fields → replaced by `imt23Totals` (Task 7) plus the builder's existing `rawAssessed`, which already gives the pre-depreciation subtotal; the spec's `*PreDep` fields turned out unnecessary. Part 7 grid → Tasks 6, 7. Part 8 standard report → Tasks 8, 9. Part 8b UIIC → Task 10. Part 9 insured report → Task 11. Testing section → Tasks 1–4, 7–11, with the three real claims in Task 3.

**Placeholder scan.** One weakness remains and is called out rather than hidden: Tasks 7, 8, 9 and 10 reference `leadingColSpan` / `trailingColSpan` / `remainingCols` / `NC` rather than literal numbers, because the column count in those tables is computed from `hasFiberglass` and `isBillCheck` and cannot be written as a constant. The implementer must read the surrounding subtotal row and match its own arithmetic. Every other step carries complete code.

**Type consistency.** `effectiveAssessed`, `computeRowNet(row, depRate, opts)`, `rowDepRate(row, ageMonths, claim)`, `paintMaterialRate(claim)`, `imt23Totals(rows)`, `getIMT23Clause()` are used with the same names and signatures wherever they appear. `AssessmentRow.imt23`, `ClaimData.applyPaintMaterialDep`, `paintMaterialPercent`, `paintMaterialDepPercent` likewise.

**Known deviation from the spec.** The spec proposed `partsBasePreDep` and four `*PreDep` bucket fields on `AssessmentSummary`. Reading the builder showed `rawAssessed()` already computes exactly that and is already printed in the Assessed column, so the fields would have been dead weight. Dropped.
