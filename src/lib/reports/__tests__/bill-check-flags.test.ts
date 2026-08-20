import { describe, expect, test } from 'vitest';
import { billCheckFlags, reconcileInvoice } from '../bill-check-flags';
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
  } as AssessmentRow;
}

describe('billCheckFlags', () => {
  test('a row where the bill agrees with the assessment never flags', () => {
    expect(billCheckFlags([row({ assessed: 1000, billedTaxable: 1000 })])).toHaveLength(0);
  });

  test('a row with no billed figure never flags — that is the pending gate', () => {
    expect(billCheckFlags([row({ assessed: 1000 })])).toHaveLength(0);
  });

  test('billed below the assessment flags, and blocks', () => {
    const [f] = billCheckFlags([row({ estimated: 8500, assessed: 8500, billedTaxable: 6000 })]);
    expect(f.kind).toBe('billed-below');
    expect(f.blocking).toBe(true);
    expect(f.delta).toBe(-2500);
    expect(f.heading).toBe('The workshop billed less than you allowed');
  });

  test('billed above the assessment flags, and blocks', () => {
    const [f] = billCheckFlags([row({ estimated: 6200, assessed: 6200, billedTaxable: 7400 })]);
    expect(f.kind).toBe('billed-above');
    expect(f.blocking).toBe(true);
    expect(f.delta).toBe(1200);
  });

  // The third number does the diagnosing.
  test('billed above, estimate allowed in full — the estimate underpriced it', () => {
    const [f] = billCheckFlags([row({ estimated: 6200, assessed: 6200, billedTaxable: 7400 })]);
    expect(f.detail).toContain('allowed the estimate in full');
  });

  test('billed above, estimate cut at survey — the workshop is pushing back', () => {
    const [f] = billCheckFlags([row({ estimated: 9800, assessed: 7000, billedTaxable: 9200 })]);
    expect(f.detail).toContain('reduced this');
    expect(f.detail).not.toContain('allowed the estimate in full');
  });

  test('a verified row stops flagging', () => {
    const flags = billCheckFlags([
      row({ assessed: 8500, billedTaxable: 6000, billVerified: true }),
    ]);
    expect(flags).toHaveLength(0);
  });

  test('a rejected item the workshop billed flags, but advises only', () => {
    const [f] = billCheckFlags([row({ assessed: 0, allowed: false, billedTaxable: 2400 })]);
    expect(f.kind).toBe('billed-rejected');
    expect(f.blocking).toBe(false);
  });

  test('a rejected item nobody billed does not flag', () => {
    expect(billCheckFlags([row({ assessed: 0, allowed: false })])).toHaveLength(0);
  });

  test('a low-confidence match advises', () => {
    const [f] = billCheckFlags([
      row({ assessed: 1000, billedTaxable: 1000, billRemarks: 'Ambiguous match — please verify' }),
    ]);
    expect(f.kind).toBe('ambiguous');
    expect(f.blocking).toBe(false);
  });

  test('a not-in-bill row is the print gate’s business, not this one’s', () => {
    expect(billCheckFlags([row({ assessed: 1000, billStatus: 'not-in-bill', billedTaxable: 0 })])).toHaveLength(0);
  });
});

describe('reconcileInvoice', () => {
  test('line items matching the invoice reconcile', () => {
    // 10,000 at 18% = 11,800
    const r = reconcileInvoice([row({ assessed: 10000, billedTaxable: 10000, gst: 18 })], 11800);
    expect(r.reconciles).toBe(true);
    expect(r.gap).toBe(0);
  });

  test('a missed line shows as a gap', () => {
    const r = reconcileInvoice([row({ assessed: 10000, billedTaxable: 10000, gst: 18 })], 14200);
    expect(r.reconciles).toBe(false);
    expect(r.gap).toBe(2400);
  });

  test('rounding under a rupee is not a gap', () => {
    const r = reconcileInvoice([row({ assessed: 10000, billedTaxable: 10000, gst: 18 })], 11800.4);
    expect(r.reconciles).toBe(true);
  });

  test('each line is taxed at its own rate', () => {
    // 10,000 at 18% = 11,800 and 5,000 at 28% = 6,400 → 18,200
    const r = reconcileInvoice([
      row({ assessed: 10000, billedTaxable: 10000, gst: 18 }),
      row({ assessed: 5000, billedTaxable: 5000, gst: 28 }),
    ], 18200);
    expect(r.reconciles).toBe(true);
  });

  test('an invoice total of zero is not yet entered, so it cannot fail', () => {
    expect(reconcileInvoice([row({ billedTaxable: 10000 })], 0).reconciles).toBe(true);
  });
});
