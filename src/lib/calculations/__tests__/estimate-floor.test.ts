import { describe, it, expect } from 'vitest';
import { estimateShortRows, overBilledRows } from '../estimate-floor';
import { billPendingRows } from '@/lib/reports/oic-assessment-excel';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow>): AssessmentRow =>
  ({ id: 'r', particulars: 'Bumper', estimated: 1000, assessed: 900, partType: 'plastic', gst: 18, section: 'parts', allowed: true, ...o }) as AssessmentRow;

describe('estimateShortRows (Assessment)', () => {
  it('flags an estimate below assessed, not equal or above', () => {
    expect(estimateShortRows([row({ assessed: 1200 })])).toEqual([{ rowId: 'r', particulars: 'Bumper', detail: 'estimate ₹1,000, assessed ₹1,200' }]);
    expect(estimateShortRows([row({ assessed: 1000 })])).toEqual([]);
    expect(estimateShortRows([row({ assessed: 1000.004 })])).toEqual([]);
  });

  it('skips disallowed rows; a missing estimate counts as 0', () => {
    expect(estimateShortRows([row({ assessed: 5000, allowed: false })])).toEqual([]);
    expect(estimateShortRows([row({ estimated: undefined as unknown as number })])[0].detail).toBe('estimate ₹0, assessed ₹900');
  });
});

describe('overBilledRows (Bill Check)', () => {
  it('flags allowed (else assessed) above the billed amount', () => {
    expect(overBilledRows([row({ assessed: 3000, billedTaxable: 2500 })])).toEqual([{ rowId: 'r', particulars: 'Bumper', detail: 'allowed ₹3,000, billed ₹2,500' }]);
    expect(overBilledRows([row({ assessed: 3000, billAllowed: 2500, billedTaxable: 2500 })])).toEqual([]);
    expect(overBilledRows([row({ assessed: 2000, billAllowed: 2600, billedTaxable: 2500 })])[0].detail).toBe('allowed ₹2,600, billed ₹2,500');
  });

  it('a bill above the estimate is not a problem (owner, 2026-11-10)', () => {
    expect(overBilledRows([row({ estimated: 3000, assessed: 3000, billAllowed: 3690.69, billedTaxable: 3690.69 })])).toEqual([]);
  });

  it('skips pending, disallowed, not-in-bill and not-allowed rows', () => {
    expect(overBilledRows([row({ assessed: 3000 })])).toEqual([]);
    expect(overBilledRows([row({ billedTaxable: 0, allowed: false })])).toEqual([]);
    expect(overBilledRows([row({ billedTaxable: 0, billStatus: 'not-in-bill' })])).toEqual([]);
    expect(overBilledRows([row({ billedTaxable: 0, billStatus: 'not-allowed' })])).toEqual([]);
  });
});

describe('billPendingRows (OIC Excel)', () => {
  it('lists Excel rows with no billed amount', () => {
    expect(billPendingRows([row({})])).toEqual([{ rowId: 'r', particulars: 'Bumper', detail: 'no billed amount' }]);
    expect(billPendingRows([row({ billedTaxable: 900, billStatus: 'in-bill' })])).toEqual([]);
  });

  it('ignores rows the Excel leaves out', () => {
    expect(billPendingRows([row({ allowed: false })])).toEqual([]);
    expect(billPendingRows([row({ billStatus: 'not-in-bill' })])).toEqual([]);
    expect(billPendingRows([row({ assessed: 0 })])).toEqual([]);
  });
});
