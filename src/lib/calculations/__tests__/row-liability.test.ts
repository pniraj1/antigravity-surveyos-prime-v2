import { describe, expect, test } from 'vitest';
import { computeRowLiability } from '../row-net';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: 'r1',
    particulars: 'Bumper',
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

describe('computeRowLiability', () => {
  test('depreciates the taxable amount, then adds GST once', () => {
    // The bug this whole change exists for: billedAmount (11,800) already
    // includes GST. Starting from it and adding GST again gave 12,532.
    const r = row({ billedTaxable: 10000, billedAmount: 11800, billStatus: 'in-bill' });
    const { liability } = computeRowLiability(r, 10);
    expect(Math.round(liability)).toBe(10620); // 10000 × 0.90 × 1.18
  });

  test('a row not in the bill contributes nothing', () => {
    const r = row({ billedTaxable: 10000, billStatus: 'not-in-bill' });
    expect(computeRowLiability(r, 10).liability).toBe(0);
  });

  test('under-billing takes the lower billed figure', () => {
    const r = row({ billedTaxable: 7000, billStatus: 'partial' });
    const { liability } = computeRowLiability(r, 10);
    expect(Math.round(liability)).toBe(7434); // 7000 × 0.90 × 1.18
  });

  test('over-billing is capped at the surveyor assessment', () => {
    const r = row({ billedTaxable: 12000, billStatus: 'in-bill' });
    const { liability } = computeRowLiability(r, 10);
    expect(Math.round(liability)).toBe(10620); // capped, not 12742
  });

  test('a missing billedTaxable falls back to assessed, never to zero', () => {
    // min() against a zero billedNet would silently drop the item from the
    // insurer's liability — the same shape of bug as the double-GST fallback.
    const r = row({ billedTaxable: undefined, billStatus: 'in-bill' });
    const { liability } = computeRowLiability(r, 10);
    expect(Math.round(liability)).toBe(10620);
  });

  test('disposal rows carry no GST and take the disposal percentage', () => {
    const r = row({ isDisposal: true, disposalPercent: 50, billedTaxable: 10000, billStatus: 'in-bill' });
    const { liability } = computeRowLiability(r, 10);
    expect(Math.round(liability)).toBe(4500); // 10000 × 0.90 × 0.50, no GST
  });

  test('uses the row own GST rate, not a hardcoded 18%', () => {
    const r = row({ gst: 28, billedTaxable: 10000, billStatus: 'in-bill' });
    const { liability } = computeRowLiability(r, 0);
    expect(Math.round(liability)).toBe(12800);
  });

  test('does not mutate the row it is given', () => {
    const r = row({ billedTaxable: 10000, billStatus: 'in-bill' });
    const snapshot = JSON.stringify(r);
    computeRowLiability(r, 10);
    expect(JSON.stringify(r)).toBe(snapshot);
  });
});
