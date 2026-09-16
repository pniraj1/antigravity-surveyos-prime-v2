// src/lib/ai/__tests__/second-opinion.test.ts
import { describe, it, expect } from 'vitest';
import { needsSecondOpinion } from '../processor';

const good = { gross_amount: 300, subtotal_parts_taxable: 200, subtotal_labour_taxable: 100,
  spare_parts: [{ taxable_amount: 200, total_amount: 200 }], labour_items: [{ taxable_amount: 100, total_amount: 100 }], painting_items: [] };

describe('needsSecondOpinion', () => {
  it('false when rows add up', () => { expect(needsSecondOpinion('estimate', good)).toBe(false); });
  it('true when a row is missing (sum ≠ gross)', () => {
    expect(needsSecondOpinion('estimate', { ...good, spare_parts: [] })).toBe(true);
  });
  it('never for non-money documents', () => {
    expect(needsSecondOpinion('rc', { anything: 1 })).toBe(false);
  });
});
