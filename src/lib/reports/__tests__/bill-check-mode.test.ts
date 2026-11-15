import { describe, expect, it } from 'vitest';
import { billHeaderFromEstimate, isFromBill, selfBilled, selfBillUpdates } from '../bill-check-mode';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'FRONT BUMPER',
    partNumber: 'BP-1',
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

describe('bill-check-mode', () => {
  it('isFromBill reads baseDocument', () => {
    expect(isFromBill({ billCheck: { baseDocument: 'final-bill' } })).toBe(true);
    expect(isFromBill({ billCheck: { baseDocument: 'estimate' } })).toBe(false);
    expect(isFromBill(null)).toBe(false);
  });
  it('selfBilled uses the estimated figure and the row GST', () =>
    expect(selfBilled(row({ estimated: 1000, gst: 28 }))).toEqual({ billedTaxable: 1000, billedAmount: 1280, billStatus: 'in-bill' }));
  it('selfBillUpdates skips disallowed rows and rows already at their own figures', () => {
    const done = row({ id: 'a', estimated: 100, gst: 18, billedTaxable: 100, billedAmount: 118, billStatus: 'in-bill' });
    const off = row({ id: 'b', allowed: false });
    expect(selfBillUpdates([done, off])).toEqual([]);
  });
  it('selfBillUpdates repairs figures an estimate upload overwrote', () => {
    const hurt = row({ id: 'c', estimated: 5000, gst: 18, billedTaxable: 4200, billedAmount: 4956, billStatus: 'in-bill' });
    expect(selfBillUpdates([hurt])).toEqual([{ id: 'c', updates: { billedTaxable: 5000, billedAmount: 5900, billStatus: 'in-bill' } }]);
  });
  it('billHeaderFromEstimate fills only empty fields', () => {
    const c = { billCheck: { billNo: 'KEEP', billDate: '', billTotal: 0 },
      extractedData: { estimate: { bill_number: 'INV-9', estimate_date: '2026-06-03', gross_amount: 250000 } } } as unknown as ClaimData;
    expect(billHeaderFromEstimate(c)).toEqual({ billDate: '2026-06-03', billTotal: 250000 });
  });
});
