import { describe, it, expect } from 'vitest';
import { referenceFor, type Reading } from '../agree';
import type { BenchRow, PdfProfile } from '../types';

const profile: PdfProfile = {
  id: 'p', fileName: 'p.pdf', kind: 'digital', pageCount: 1, unreadablePages: [], confirmed: true,
  estimates: [{ label: 'E1', firstPage: 1, lastPage: 1, grandTotal: 300 }],
};
const row = (n: number, d: string, amount: number): BenchRow =>
  ({ section: 'spare_parts', srNo: n, description: d, qty: null, rate: null, amount, taxable: null, page: 1 });
const good = [row(1, 'bumper', 100), row(2, 'headlamp', 200)];
const rd = (cellId: string, model: string, rows: BenchRow[]): Reading => ({ cellId, model, rows, errors: [] });

describe('referenceFor', () => {
  it('gold wins', () => {
    const gold = [row(1, 'x', 5)];
    expect(referenceFor([rd('a', 'm1', good), rd('b', 'm2', good)], profile, gold)).toEqual({ source: 'gold', rows: gold });
  });
  it('two agreeing models give agreement', () => {
    expect(referenceFor([rd('a', 'm1', good), rd('b', 'm2', good)], profile)).toEqual({ source: 'agreement', rows: good });
  });
  it('same model twice does not count', () => {
    expect(referenceFor([rd('a', 'm1', good), rd('b', 'm1', good)], profile)).toBeNull();
  });
  it('disagreement gives null', () => {
    const other = [row(1, 'bumper', 100), row(2, 'headlamp', 250)];
    expect(referenceFor([rd('a', 'm1', good), rd('b', 'm2', other)], profile)).toBeNull();
  });
  it('ignores a reading failing self-check', () => {
    const bad = [row(1, 'bumper', 100), row(2, 'headlamp', 200), row(3, 'extra', 50)];
    expect(referenceFor([rd('a', 'm1', good), rd('b', 'm2', bad), rd('c', 'm3', good)], profile)?.source).toBe('agreement');
    expect(referenceFor([rd('a', 'm1', good), rd('b', 'm2', bad)], profile)).toBeNull();
  });
});
