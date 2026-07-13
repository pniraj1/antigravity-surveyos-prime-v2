import { describe, it, expect } from 'vitest';
import { applyEstimate } from '../aiDataSlice';
import type { ClaimData } from '@/types';

const baseClaim = { assessmentRows: [], accident: {} } as unknown as ClaimData;

// Typical dealer estimate where serial numbers RESTART per section
// (parts 1..2, labour 1..2, paint 1) — must NOT interleave.
const estimate = {
  spare_parts: [
    { sr_no: 1, description: 'Front Bumper', taxable_amount: 5000 },
    { sr_no: 2, description: 'Grille', taxable_amount: 2000 },
  ],
  labour_items: [
    { sr_no: 1, description: 'R & R Bumper', taxable_amount: 500 },
    { sr_no: 2, description: 'Denting', taxable_amount: 600 },
  ],
  painting_items: [{ sr_no: 1, description: 'Painting Bumper', taxable_amount: 700 }],
};

describe('applyEstimate', () => {
  it('keeps sections grouped when serial numbers restart per section', () => {
    const claim = applyEstimate(baseClaim, estimate);
    expect(claim.assessmentRows.map((r) => r.section)).toEqual([
      'parts', 'parts', 'labour', 'labour', 'paint',
    ]);
    expect(claim.assessmentRows.map((r) => r.particulars)).toEqual([
      'Front Bumper', 'Grille', 'R & R Bumper', 'Denting', 'Painting Bumper',
    ]);
  });

  it('tags AI-created rows with source: estimate', () => {
    const claim = applyEstimate(baseClaim, estimate);
    expect(claim.assessmentRows.every((r) => r.source === 'estimate')).toBe(true);
  });

  it('re-applying replaces previous AI rows but keeps manual rows', () => {
    const once = applyEstimate(baseClaim, estimate);
    const manualRow = {
      ...once.assessmentRows[0],
      id: 'manual-1',
      source: undefined,
      particulars: 'Towing charges (manual)',
    };
    const withManual = { ...once, assessmentRows: [...once.assessmentRows, manualRow] };

    const twice = applyEstimate(withManual, estimate);

    // 5 fresh AI rows + 1 manual row — no duplicates
    expect(twice.assessmentRows).toHaveLength(6);
    expect(twice.assessmentRows.filter((r) => r.particulars === 'Front Bumper')).toHaveLength(1);
    expect(twice.assessmentRows.some((r) => r.particulars === 'Towing charges (manual)')).toBe(true);
  });
});
