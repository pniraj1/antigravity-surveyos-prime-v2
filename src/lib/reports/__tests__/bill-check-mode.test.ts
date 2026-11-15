import { describe, expect, it } from 'vitest';
import { billHeaderFromEstimate, isFromBill, rowsLostOnSwitch, selfBilled, selfBillUpdates } from '../bill-check-mode';
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

describe('rowsLostOnSwitch', () => {
  const claim = (rows: AssessmentRow[], baseDocument: 'estimate' | 'final-bill' = 'estimate') =>
    ({ assessmentRows: rows, billCheck: { baseDocument } }) as unknown as ClaimData;

  it('to estimate: a real bill figure with no ref counts', () =>
    expect(rowsLostOnSwitch(claim([row({ estimated: 5000, billedTaxable: 4200, billedAmount: 4956 })]), 'estimate')).toBe(1));
  it('to estimate: a disallowed row holding a ref counts, once', () =>
    expect(rowsLostOnSwitch(claim([row({ allowed: false, refSrNo: 3 }), row({ refSrNo: 2, billedTaxable: 1 })]), 'estimate')).toBe(2));
  it('to estimate from a from-bill claim is 0', () =>
    expect(rowsLostOnSwitch(claim([row({ refSrNo: 1, billedTaxable: 1 })], 'final-bill'), 'estimate')).toBe(0));
  it('to final-bill from a from-bill claim counts refs and billed figures', () =>
    expect(rowsLostOnSwitch(claim([row({ billedAmount: 5 }), row({ allowed: false, refSrNo: 1 }), row()], 'final-bill'), 'final-bill')).toBe(2));
  it('to final-bill from a normal claim is 0', () =>
    expect(rowsLostOnSwitch(claim([row({ refSrNo: 1 })]), 'final-bill')).toBe(0));
});
