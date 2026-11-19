import { describe, expect, test } from 'vitest';
import { keptOpenRows, keptOpenTotal, liabilityComparison, type ComparisonInput } from '../kept-open';
import type { AssessmentRow } from '@/types/assessment';

const r = (o: Partial<AssessmentRow>) => ({ id: 'x', estimated: 0, gst: 18, allowed: true, ...o }) as AssessmentRow;

describe('keptOpenTotal', () => {
  test('sums estimated × (1+gst) over K.O. rows only', () => {
    const rows = [
      r({ keptOpen: true, allowed: false, estimated: 10000, gst: 18 }),
      r({ keptOpen: true, allowed: false, estimated: 5000, gst: undefined as never }),
      r({ estimated: 99999 }),
    ];
    expect(keptOpenRows(rows)).toHaveLength(2);
    expect(keptOpenTotal(rows)).toBeCloseTo(16800);
  });
});

const input = (tl: Partial<ComparisonInput['tl']> = {}, o: Partial<ComparisonInput> = {}): ComparisonInput => ({
  idv: 500000, excess: 2000, repairGrandInclGst: 240000, repairTowing: 3000, repairSalvage: 5000, keptOpen: 60000,
  tl: { salvageWithRC: 120000, salvageWithoutRC: 80000, towingExpenses: 3000, workshopRent: 0,
    missingItems: [{ id: 'm', description: 'x', amount: 15000 }], ...tl },
  ...o,
});

describe('liabilityComparison', () => {
  test('spec worked example', () => {
    const c = liabilityComparison(input());
    expect(c.repair.net).toBe(296000);
    expect(c.totalLoss).toBe(486000);
    expect(c.netWithRC).toBe(366000);
    expect(c.netWithoutRC).toBe(406000);
  });
  test('missing > idv → totalLoss === addl, nothing negative', () => {
    const c = liabilityComparison(input({ missingItems: [{ id: 'm', description: 'x', amount: 900000 }] }));
    expect(c.totalLoss).toBe(c.addl);
    expect(c.netWithRC).toBe(c.addl);
  });
  test('missingItems undefined → missing 0', () => {
    expect(liabilityComparison(input({ missingItems: undefined })).missing).toBe(0);
  });
});

describe('liabilityComparison missing items', () => {
  test('negative and NaN amounts never raise the TL base', () => {
    const c = liabilityComparison(input({ missingItems: [
      { id: 'a', description: 'x', amount: -5000 }, { id: 'b', description: 'y', amount: NaN }, { id: 'c', description: 'z', amount: 1000 },
    ] }));
    expect(c.missing).toBe(1000);
    expect(c.totalLoss).toBe(500000 - 2000 - 1000 + 3000);
  });
});
