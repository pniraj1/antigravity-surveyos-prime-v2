import { describe, expect, test } from 'vitest';
import { extractTotals, scoreAccuracy } from '../probe-accuracy';

/**
 * The estimate schema (src/lib/ai/prompts.ts) puts the document grand total in
 * the ROOT field `gross_amount`. The name `total_amount` also exists, but only
 * inside each line item, where it means that row's GST-inclusive amount.
 * Reading it would silently score against one row instead of the document.
 */
const EXTRACTION = {
  gross_amount: 62392.5,
  subtotal_parts_taxable: 52875,
  spare_parts: [
    { description: 'BUMPER', total_amount: 2891 },
    { description: 'GRILLE', total_amount: 1392.4 },
  ],
  labour_items: [{ description: 'PANEL BEATING', total_amount: 4130 }],
  painting_items: [{ description: 'PAINTING', total_amount: 7316 }],
};

describe('extractTotals', () => {
  test('reads the root gross_amount, not a line item total_amount', () => {
    expect(extractTotals(EXTRACTION).total).toBe(62392.5);
  });

  test('counts line items across all three sections', () => {
    expect(extractTotals(EXTRACTION).itemCount).toBe(4);
  });

  test('returns nulls for a result with no usable total', () => {
    expect(extractTotals({ spare_parts: [] })).toEqual({ total: null, itemCount: 0 });
  });

  test('survives null, undefined and non-object input', () => {
    expect(extractTotals(null)).toEqual({ total: null, itemCount: null });
    expect(extractTotals(undefined)).toEqual({ total: null, itemCount: null });
    expect(extractTotals('nope')).toEqual({ total: null, itemCount: null });
  });

  test('ignores a non-numeric gross_amount', () => {
    expect(extractTotals({ gross_amount: 'N/A' }).total).toBeNull();
  });
});

const BASE = {
  modelId: 'meta/llama-3.2-90b-vision-instruct',
  expectedTotal: 62392.5,
  expectedItemCount: 4,
  ms: 250_000,
  pages: 5,
  benchmarkFileName: 'estimate.pdf',
  now: 1000,
};

describe('scoreAccuracy verdict bands', () => {
  test('an exact match is exact', () => {
    const r = scoreAccuracy({ ...BASE, data: EXTRACTION, error: null });
    expect(r.verdict).toBe('exact');
    expect(r.extractedTotal).toBe(62392.5);
    expect(r.totalDeltaPct).toBeCloseTo(0, 5);
  });

  test('0.5% off is still exact (boundary)', () => {
    const data = { ...EXTRACTION, gross_amount: 62392.5 * 1.005 };
    expect(scoreAccuracy({ ...BASE, data, error: null }).verdict).toBe('exact');
  });

  test('1% off is close', () => {
    const data = { ...EXTRACTION, gross_amount: 62392.5 * 1.01 };
    expect(scoreAccuracy({ ...BASE, data, error: null }).verdict).toBe('close');
  });

  test('2% off is still close (boundary)', () => {
    const data = { ...EXTRACTION, gross_amount: 62392.5 * 1.02 };
    expect(scoreAccuracy({ ...BASE, data, error: null }).verdict).toBe('close');
  });

  test('dropping GST lands firmly in wrong', () => {
    // 52875 taxable vs 62392.50 gross — the exact failure seen from a model
    // that copied `rate` into `amount` and lost the 18%.
    const data = { ...EXTRACTION, gross_amount: 52875 };
    const r = scoreAccuracy({ ...BASE, data, error: null });
    expect(r.verdict).toBe('wrong');
    expect(r.totalDeltaPct).toBeGreaterThan(14);
  });

  test('no extractable total is wrong, not a crash', () => {
    const r = scoreAccuracy({ ...BASE, data: { spare_parts: [] }, error: null });
    expect(r.verdict).toBe('wrong');
    expect(r.extractedTotal).toBeNull();
    expect(r.totalDeltaPct).toBeNull();
  });

  test('a thrown extraction is failed and keeps the message', () => {
    const r = scoreAccuracy({ ...BASE, data: null, error: 'nvidia API Error: 400' });
    expect(r.verdict).toBe('failed');
    expect(r.error).toBe('nvidia API Error: 400');
  });

  test('an item-count mismatch does not change the verdict', () => {
    const data = { ...EXTRACTION, spare_parts: [{ description: 'ONLY ONE', total_amount: 1 }] };
    const r = scoreAccuracy({ ...BASE, data, error: null });
    expect(r.verdict).toBe('exact');
    expect(r.extractedItemCount).toBe(3);
    expect(r.expectedItemCount).toBe(4);
  });

  test('carries the benchmark file name so stale results are detectable', () => {
    expect(scoreAccuracy({ ...BASE, data: EXTRACTION, error: null }).benchmarkFileName)
      .toBe('estimate.pdf');
  });
});
