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
