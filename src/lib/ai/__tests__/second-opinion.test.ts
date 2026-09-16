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
  it('false when items reconcile to the gross even though page-level section subtotals do not (5-page DTC, live 2026-09-16)', () => {
    const pageNoise = { ...good, subtotal_parts_taxable: 53, subtotal_labour_taxable: 17 };   // one page's figures, not the document's
    expect(needsSecondOpinion('estimate', pageNoise)).toBe(false);
  });
  it('true when the gross itself does not reconcile', () => {
    expect(needsSecondOpinion('estimate', { ...good, gross_amount: 999 })).toBe(true);
  });
  it('never for non-money documents', () => {
    expect(needsSecondOpinion('rc', { anything: 1 })).toBe(false);
  });
});
