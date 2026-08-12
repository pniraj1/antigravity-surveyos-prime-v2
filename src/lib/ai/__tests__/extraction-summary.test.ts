import { describe, it, expect } from 'vitest';
import { summariseExtraction, hasLineItems } from '../extraction-summary';

describe('hasLineItems', () => {
  it('covers only the two line-item document types', () => {
    expect(hasLineItems('estimate')).toBe(true);
    expect(hasLineItems('final-bill')).toBe(true);
    expect(hasLineItems('rc')).toBe(false);
    expect(hasLineItems('dl')).toBe(false);
  });
});

describe('summariseExtraction', () => {
  it('counts and totals each group', () => {
    const s = summariseExtraction({
      spare_parts: [
        { taxable_amount: 1000, total_amount: 1180 },
        { taxable_amount: 500, total_amount: 590 },
      ],
      labour_items: [{ taxable_amount: 300, total_amount: 354 }],
      painting_items: [],
      gross_amount: 2124,
    });

    expect(s.parts).toEqual({ count: 2, taxable: 1500 });
    expect(s.labour).toEqual({ count: 1, taxable: 300 });
    expect(s.painting).toEqual({ count: 0, taxable: 0 });
    expect(s.gross).toBe(2124);
    expect(s.totalItems).toBe(3);
  });

  it('falls back to the gross column when a bill prints only one amount', () => {
    const s = summariseExtraction({
      spare_parts: [{ total_amount: 1180 }],
    });
    expect(s.parts.taxable).toBe(1180);
  });

  it('reads string amounts, since extracted values are not always numbers', () => {
    const s = summariseExtraction({
      spare_parts: [{ taxable_amount: '1500.50' }],
      gross_amount: '2000',
    });
    expect(s.parts.taxable).toBeCloseTo(1500.5);
    expect(s.gross).toBe(2000);
  });

  it('reports a missing grand total as null rather than zero', () => {
    // Zero would read as "the bill totals nothing", which is a different and
    // misleading claim to put in front of a surveyor.
    expect(summariseExtraction({ spare_parts: [] }).gross).toBeNull();
    expect(summariseExtraction({ gross_amount: '' }).gross).toBeNull();
  });

  it('survives missing or malformed arrays', () => {
    const s = summariseExtraction({ spare_parts: null, labour_items: 'nope' });
    expect(s.totalItems).toBe(0);
    expect(s.parts.taxable).toBe(0);
  });

  it('survives being handed nothing at all', () => {
    expect(summariseExtraction(undefined).totalItems).toBe(0);
    expect(summariseExtraction(null).gross).toBeNull();
  });

  // The failure this whole feature exists for: a truncated read is internally
  // consistent, so only the item count and printed total expose it.
  it('reports a truncated read without any internal contradiction', () => {
    const truncated = summariseExtraction({
      spare_parts: Array.from({ length: 12 }, () => ({ taxable_amount: 100 })),
      gross_amount: 1416,
    });
    expect(truncated.totalItems).toBe(12);
    expect(truncated.parts.taxable).toBe(1200);
  });
});
