import { describe, expect, it } from 'vitest';
import { fromBillSelfBillUpdates, finalBillReadBlocked, estimateHeads, estimateTotals, needsEstimateHeads, billHeaderFromEstimate, isFromBill, rowsLostOnSwitch, selfBilled, selfBillUpdates } from '../bill-check-mode';
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

  describe('estimate heads', () => {
    const line = (o: Record<string, unknown> = {}) => ({ id: 'L1', description: 'x', amount: 10620, taxableAmount: 9000, gstPercent: 18, section: 'parts', source: 'final-bill', ...o });
    const fb = (rows: AssessmentRow[], extras: unknown[] = [], heads?: unknown) => ({
      assessmentRows: rows, extraBillItems: extras,
      billCheck: { baseDocument: 'final-bill', estimateHeads: heads },
      extractedData: { 'final-bill': { total_amount: 20000 } },
    }) as unknown as ClaimData;
    it('splits a matched metal row and an unmatched glass line', () => {
      const c = fb([row({ estimateAmount: 9000 })], [line({ id: 'G', taxableAmount: 1500, amount: 1770, material: 'glass' })]);
      expect(estimateHeads(c)).toEqual({ metal: 9000, plastic: 0, glass: 1500, fiberglass: 0, labour: 0, paint: 0 });
    });
    it('counts a shared line once', () => {
      const l = line();
      const a = row({ estimateAmount: 9000, refMatch: { bill: l, score: 100, reasons: [] } as never });
      const b = row({ refMatch: { bill: l, score: 100, refOnly: true, reasons: [] } as never });
      expect(estimateTotals(fb([a, b]))).toEqual({ linesInclGst: 10620, printed: 20000 });
    });
    it('needsEstimateHeads', () => {
      const x = [line()];
      expect(needsEstimateHeads({ assessmentRows: [], extraBillItems: x, billCheck: { baseDocument: 'estimate' } } as unknown as ClaimData)).toBe(false);
      expect(needsEstimateHeads(fb([], x))).toBe(true);
      expect(needsEstimateHeads(fb([], x, estimateHeads(fb([], x))))).toBe(false);
    });
  });
});

describe('fromBillSelfBillUpdates (I1)', () => {
  const stale = row({ id: 's', estimated: 5400, gst: 18, billedTaxable: 4500, billedAmount: 5310, billStatus: 'in-bill' });
  const mk = (baseDocument: 'estimate' | 'final-bill') => ({ assessmentRows: [stale], billCheck: { baseDocument } }) as unknown as ClaimData;
  it('from-bill claim: a row whose estimated changed after self-billing gets the new figures', () =>
    expect(fromBillSelfBillUpdates(mk('final-bill'))).toEqual([{ id: 's', updates: { billedTaxable: 5400, billedAmount: 6372, billStatus: 'in-bill' } }]));
  it('normal claim: nothing', () => expect(fromBillSelfBillUpdates(mk('estimate'))).toEqual([]));
});

describe('finalBillReadBlocked (I3)', () => {
  const c = (baseDocument: 'estimate' | 'final-bill') => ({ billCheck: { baseDocument } }) as unknown as ClaimData;
  it('from-bill + final-bill read started elsewhere: blocked', () => expect(finalBillReadBlocked(c('final-bill'), 'final-bill', 'documents')).toBe(true));
  it('started in Bill Check: applied', () => expect(finalBillReadBlocked(c('final-bill'), 'final-bill', 'bill-check')).toBe(false));
  it('normal claim: applied', () => expect(finalBillReadBlocked(c('estimate'), 'final-bill', 'documents')).toBe(false));
  it('other documents: applied', () => expect(finalBillReadBlocked(c('final-bill'), 'rc', 'documents')).toBe(false));
});

describe('estimate heads skip lines held by a row (I2c)', () => {
  const line = { id: 'L1', description: 'X', amount: 1180, taxableAmount: 1000, gstPercent: 18, section: 'parts' as const, source: 'final-bill' as const };
  const claim = {
    assessmentRows: [row({ refMatch: { bill: line, score: 100, reasons: [] } })],
    extraBillItems: [line],
  } as unknown as ClaimData;
  it('heads do not count the held line twice', () => expect(estimateHeads(claim).plastic + estimateHeads(claim).metal).toBe(0));
  it('totals do not count the held line twice', () => expect(estimateTotals(claim)?.linesInclGst).toBe(1180));
});
