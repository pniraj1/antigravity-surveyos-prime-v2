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
