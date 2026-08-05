import { describe, expect, test } from 'vitest';
import { aggregateGst } from '../gst-bands';
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

const NO_DEP = () => 0;

describe('aggregateGst', () => {
  test('splits GST evenly into CGST and SGST', () => {
    const agg = aggregateGst([row({ assessed: 10000, gst: 18 })], NO_DEP);
    expect(agg.cgst).toBeCloseTo(900, 2);   // 10000 × 9%
    expect(agg.sgst).toBeCloseTo(900, 2);
    expect(agg.amount).toBeCloseTo(11800, 2);
  });

  test('a 28% item splits 14/14, not 9/9', () => {
    // The hardcoded 0.09 produced 900/900 here and understated the total.
    const agg = aggregateGst([row({ assessed: 10000, gst: 28 })], NO_DEP);
    expect(agg.cgst).toBeCloseTo(1400, 2);
    expect(agg.sgst).toBeCloseTo(1400, 2);
    expect(agg.amount).toBeCloseTo(12800, 2);
  });

  test('base is the assessed amount after depreciation', () => {
    const agg = aggregateGst([row({ assessed: 10000, gst: 18 })], () => 10);
    expect(agg.base).toBeCloseTo(9000, 2);
    expect(agg.amount).toBeCloseTo(10620, 2);  // 9000 × 1.18
  });

  test('groups rows into one band per hsn and rate', () => {
    const agg = aggregateGst([
      row({ assessed: 1000, gst: 18, hsnSac: '8708' }),
      row({ assessed: 2000, gst: 18, hsnSac: '8708' }),
      row({ assessed: 5000, gst: 28, hsnSac: '4011' }),
    ], NO_DEP);

    expect(agg.bands).toHaveLength(2);
    const b18 = agg.bands.find(b => b.rate === 18)!;
    const b28 = agg.bands.find(b => b.rate === 28)!;
    expect(b18.base).toBeCloseTo(3000, 2);
    expect(b18.hsnSac).toBe('8708');
    expect(b28.base).toBeCloseTo(5000, 2);
    expect(b28.cgst).toBeCloseTo(700, 2);
  });

  test('band totals sum to the aggregate totals', () => {
    const agg = aggregateGst([
      row({ assessed: 1000, gst: 18 }),
      row({ assessed: 5000, gst: 28 }),
    ], NO_DEP);
    const summed = agg.bands.reduce((s, b) => s + b.amount, 0);
    expect(summed).toBeCloseTo(agg.amount, 2);
  });

  test('disposal rows carry no GST and use the disposal percentage', () => {
    const agg = aggregateGst(
      [row({ assessed: 10000, gst: 18, isDisposal: true, disposalPercent: 50 })],
      () => 10
    );
    expect(agg.base).toBeCloseTo(4500, 2);   // 10000 × 0.9 × 0.5
    expect(agg.cgst).toBe(0);
    expect(agg.amount).toBeCloseTo(4500, 2);
  });

  test('leaves hsnSac blank when the row has none', () => {
    const agg = aggregateGst([row({ assessed: 1000 })], NO_DEP);
    expect(agg.bands[0].hsnSac).toBe('');
  });

  test('reproduces the specimen parts total', () => {
    // Specimen MOTOR-828/2026: 15 parts, all 18%, nil depreciation.
    const agg = aggregateGst([row({ assessed: 41435.59, gst: 18 })], NO_DEP);
    expect(agg.cgst).toBeCloseTo(3729.20, 2);
    expect(agg.sgst).toBeCloseTo(3729.20, 2);
    expect(agg.amount).toBeCloseTo(48894.00, 1);
  });

  test('reproduces the specimen labour plus paint total', () => {
    // 2385.00 labour + 17500.00 paint = 19885.00 → 23464.30
    const agg = aggregateGst([
      row({ assessed: 2385, gst: 18, section: 'labour', partType: 'labour' }),
      row({ assessed: 17500, gst: 18, section: 'paint', partType: 'paint' }),
    ], NO_DEP);
    expect(agg.cgst).toBeCloseTo(1789.65, 2);
    expect(agg.amount).toBeCloseTo(23464.30, 1);
  });

  test('handles an empty row set', () => {
    const agg = aggregateGst([], NO_DEP);
    expect(agg.bands).toHaveLength(0);
    expect(agg.amount).toBe(0);
  });
});
