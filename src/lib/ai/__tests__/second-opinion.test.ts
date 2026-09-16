// src/lib/ai/__tests__/second-opinion.test.ts
import { describe, it, expect } from 'vitest';
import { needsSecondOpinion } from '../processor';

const row = (sr_no: number, total_amount: number) => ({ sr_no, total_amount, taxable_amount: total_amount });
const good = { gross_amount: 300, spare_parts: [row(1, 200)], labour_items: [row(2, 100)], painting_items: [] };

describe('needsSecondOpinion — only a gross mismatch with no serial gap', () => {
  it('false when rows add up', () => { expect(needsSecondOpinion('estimate', good)).toBe(false); });
  it('false when page-level section subtotals disagree (they are never checked)', () => {
    expect(needsSecondOpinion('estimate', { ...good, subtotal_parts_taxable: 53, subtotal_labour_taxable: 17 })).toBe(false);
  });
  it('true when the gross does not reconcile and no serial is missing (an unserialled row is gone)', () => {
    expect(needsSecondOpinion('estimate', { ...good, gross_amount: 999 })).toBe(true);
  });
  it('false when a serial gap explains the mismatch — the gap fill handles that, not a re-read', () => {
    expect(needsSecondOpinion('estimate', { ...good, labour_items: [row(3, 100)] })).toBe(false);   // serial 2 missing
  });
  it('false in text mode when the gross is not printed anywhere', () => {
    expect(needsSecondOpinion('estimate', { ...good, gross_amount: 999 }, ['no such number'])).toBe(false);
  });
  it('never for non-money documents', () => { expect(needsSecondOpinion('rc', { anything: 1 })).toBe(false); });
});
