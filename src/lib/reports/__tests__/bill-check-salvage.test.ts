import { describe, expect, test } from 'vitest';
import { resolveBillSalvage } from '../bill-check-projection';
import type { AssessmentRow, FeeBill } from '@/types/assessment';

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

function fee(overrides: Partial<FeeBill> = {}): FeeBill {
  return { salvageValue: 1600, compulsoryExcess: 0, voluntaryExcess: 0, ...overrides } as FeeBill;
}

// Two allowed metal parts at 10,000 each, 18% GST → a final basis of 23,600.
const twoParts = () => [
  row({ id: 'fender', assessed: 10000 }),
  row({ id: 'bonnet', assessed: 10000 }),
];

describe('resolveBillSalvage', () => {
  test('a figure typed on the Bill Check tab wins', () => {
    expect(resolveBillSalvage(fee({ billSalvage: 999 }), twoParts())).toBe(999);
  });

  // undefined means "automatic"; zero is a decision, and must survive.
  test('a typed zero is honoured, not treated as absent', () => {
    expect(resolveBillSalvage(fee({ billSalvage: 0 }), twoParts())).toBe(0);
  });

  test('an unchanged bill leaves the salvage alone', () => {
    expect(resolveBillSalvage(fee(), twoParts())).toBe(1600);
  });

  test('a basis cut to a quarter cuts the salvage to a quarter', () => {
    // fender capped to 5,000 (= 5,900 with GST), bonnet never billed (= 0).
    // 5,900 / 23,600 = 0.25, so 1,600 → 400.
    const rows = [
      row({ id: 'fender', assessed: 10000, billedTaxable: 5000 }),
      row({ id: 'bonnet', assessed: 10000, billStatus: 'not-in-bill', billedTaxable: 0 }),
    ];
    expect(resolveBillSalvage(fee(), rows)).toBe(400);
  });

  test('a risen basis raises the salvage', () => {
    // bonnet allowed at 20,000 (= 23,600) plus fender 11,800 → 35,400.
    // 35,400 / 23,600 = 1.5, so 1,600 → 2,400.
    const rows = [
      row({ id: 'fender', assessed: 10000 }),
      row({ id: 'bonnet', assessed: 10000, billedTaxable: 25000, billAllowed: 20000 }),
    ];
    expect(resolveBillSalvage(fee(), rows)).toBe(2400);
  });

  test('no allowed metal at all carries the figure through unchanged', () => {
    // No ratio exists, and inventing one is worse than leaving the number be.
    expect(resolveBillSalvage(fee(), [row({ partType: 'plastic' })])).toBe(1600);
  });

  test('a salvage of zero stays zero whatever the bases do', () => {
    const rows = [row({ assessed: 10000, billedTaxable: 5000 })];
    expect(resolveBillSalvage(fee({ salvageValue: 0 }), rows)).toBe(0);
  });

  test('no fee bill at all is zero', () => {
    expect(resolveBillSalvage(undefined, twoParts())).toBe(0);
  });

  test('the result is a whole rupee', () => {
    // 3,333 taxable is 3,932.94 with GST, against a final basis of 23,600 —
    // a ratio that does not divide cleanly into 1,600.
    const rows = [
      row({ id: 'fender', assessed: 10000, billedTaxable: 3333 }),
      row({ id: 'bonnet', assessed: 10000, billStatus: 'not-in-bill', billedTaxable: 0 }),
    ];
    expect(Number.isInteger(resolveBillSalvage(fee(), rows))).toBe(true);
  });
});
