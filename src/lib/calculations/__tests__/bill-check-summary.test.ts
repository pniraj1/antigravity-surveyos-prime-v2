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
