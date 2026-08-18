import { describe, expect, test } from 'vitest';
import { rowsNeedingRemark } from '../bill-check-projection';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Bonnet Assy.',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  } as AssessmentRow;
}

describe('rowsNeedingRemark', () => {
  test('a not-in-bill row with no remark needs one', () => {
    const out = rowsNeedingRemark([row({ billStatus: 'not-in-bill' })]);
    expect(out).toHaveLength(1);
  });

  test('a not-in-bill row WITH a remark does not need one', () => {
    const out = rowsNeedingRemark([row({ billStatus: 'not-in-bill', billRemarks: 'Part not replaced' })]);
    expect(out).toHaveLength(0);
  });

  test('a row billed differently from assessed, with no remark, needs one', () => {
    const out = rowsNeedingRemark([row({ assessed: 1000, billedTaxable: 1200 })]);
    expect(out).toHaveLength(1);
  });

  test('a row billed exactly as assessed does not need one', () => {
    const out = rowsNeedingRemark([row({ assessed: 1000, billedTaxable: 1000 })]);
    expect(out).toHaveLength(0);
  });

  test('a row billed differently from assessed, but with a remark, does not need one', () => {
    const out = rowsNeedingRemark([row({ assessed: 1000, billedTaxable: 1200, billRemarks: 'Supplementary estimate' })]);
    expect(out).toHaveLength(0);
  });

  test('when billAllowed overrides assessed, the check compares against the allowance', () => {
    const out = rowsNeedingRemark([row({ assessed: 1000, billAllowed: 1200, billedTaxable: 1200 })]);
    expect(out).toHaveLength(0);
  });

  test('billed differing from an allowance still needs a remark', () => {
    const out = rowsNeedingRemark([row({ assessed: 1000, billAllowed: 1200, billedTaxable: 1250 })]);
    expect(out).toHaveLength(1);
  });

  test('an untouched pending row is not flagged — that is the print gate\'s job, not this one', () => {
    const out = rowsNeedingRemark([row({ billStatus: 'pending' })]);
    expect(out).toHaveLength(0);
  });

  test('a blank-string remark counts as no remark', () => {
    const out = rowsNeedingRemark([row({ billStatus: 'not-in-bill', billRemarks: '   ' })]);
    expect(out).toHaveLength(1);
  });
});
