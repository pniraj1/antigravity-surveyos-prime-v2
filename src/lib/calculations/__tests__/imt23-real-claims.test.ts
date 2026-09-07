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
