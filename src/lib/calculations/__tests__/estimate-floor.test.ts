import { describe, it, expect } from 'vitest';
import { estimateShortRows } from '../estimate-floor';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow>): AssessmentRow =>
  ({ id: 'r', particulars: 'Bumper', estimated: 1000, assessed: 900, partType: 'plastic', gst: 18, section: 'parts', allowed: true, ...o }) as AssessmentRow;

describe('estimateShortRows', () => {
  it('assessment: flags an estimate below assessed, not equal or above', () => {
    expect(estimateShortRows([row({ assessed: 1200 })], 'assessment')).toEqual([{ rowId: 'r', particulars: 'Bumper', estimated: 1000, floor: 1200 }]);
    expect(estimateShortRows([row({ assessed: 1000 })], 'assessment')).toEqual([]);
    expect(estimateShortRows([row({ assessed: 1000.004 })], 'assessment')).toEqual([]);
  });

  it('bill: the floor is the higher of allowed (else assessed) and billed', () => {
    expect(estimateShortRows([row({ billAllowed: 1100 })], 'bill')[0].floor).toBe(1100);
    expect(estimateShortRows([row({ billedTaxable: 1300, billStatus: 'in-bill' })], 'bill')[0].floor).toBe(1300);
    expect(estimateShortRows([row({ billedTaxable: 950 })], 'bill')).toEqual([]);
  });

  it('skips disallowed, not-in-bill and not-allowed rows', () => {
    expect(estimateShortRows([row({ assessed: 5000, allowed: false })], 'assessment')).toEqual([]);
    expect(estimateShortRows([row({ billedTaxable: 5000, billStatus: 'not-in-bill' })], 'bill')).toEqual([]);
    expect(estimateShortRows([row({ billedTaxable: 5000, billStatus: 'not-allowed' })], 'bill')).toEqual([]);
  });

  it('a missing estimate counts as 0', () => {
    expect(estimateShortRows([row({ estimated: undefined as unknown as number })], 'assessment')[0].estimated).toBe(0);
  });
});
