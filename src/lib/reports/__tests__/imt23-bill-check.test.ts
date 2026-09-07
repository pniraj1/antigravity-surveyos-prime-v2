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
