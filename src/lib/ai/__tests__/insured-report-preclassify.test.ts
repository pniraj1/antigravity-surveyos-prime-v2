import { describe, test, expect, vi } from 'vitest';

// Stub out the AI gateway (and transitively Firebase) so the module can be
// imported without NEXT_PUBLIC_FIREBASE_API_KEY being present in the env.
vi.mock('../service', () => ({ callAIGateway: vi.fn() }));

import { buildPreClassifiedExplanations } from '../insured-report';

const baseRow = {
  id: 'r1', particulars: 'Bonnet', section: 'parts',
  estimated: 8000, assessed: 5600, billedTaxable: 8000,
  allowed: true, action: 'allow', isDisposal: false,
  remarks: '', depOverride: undefined, deductionCategory: undefined,
};

// Helper: flatten both buckets into one searchable array
function allRows(claim: any) {
  const { autoClassified, taggedRows } = buildPreClassifiedExplanations(claim, false);
  return [...autoClassified, ...taggedRows];
}

describe('buildPreClassifiedExplanations', () => {
  test('standard depreciation row is pre-classified as depreciation', () => {
    const claim = { assessmentRows: [baseRow] } as any;
    const entry = allRows(claim).find(e => e.assessmentRowId === 'r1');
    expect(entry).toBeDefined();
    expect(entry!.deductionCategory).toBe('depreciation');
    expect(entry!.isFlagged).toBe(false);
  });

  test('surveyor-tagged row uses the tag category directly', () => {
    const claim = { assessmentRows: [{ ...baseRow, deductionCategory: 'consumable' }] } as any;
    const entry = allRows(claim).find(e => e.assessmentRowId === 'r1');
    expect(entry).toBeDefined();
    expect(entry!.deductionCategory).toBe('consumable');
  });

  test('depOverride row is NOT pre-classified (must go to AI)', () => {
    const claim = { assessmentRows: [{ ...baseRow, depOverride: 50 }] } as any;
    const entry = allRows(claim).find(e => e.assessmentRowId === 'r1');
    expect(entry).toBeUndefined();
  });

  test('disposal row is pre-classified as salvage (existing behaviour preserved)', () => {
    const claim = { assessmentRows: [{ ...baseRow, isDisposal: true }] } as any;
    const entry = allRows(claim).find(e => e.assessmentRowId === 'r1');
    expect(entry).toBeDefined();
    expect(entry!.deductionCategory).toBe('salvage');
  });

  test('fully approved row (dep=0, assessed=estimated) is pre-classified as approved', () => {
    const approvedRow = { ...baseRow, assessed: 8000, billedTaxable: 8000 };
    const claim = { assessmentRows: [approvedRow] } as any;
    const { autoClassified } = buildPreClassifiedExplanations(claim, false);
    const entry = autoClassified.find(e => e.assessmentRowId === 'r1');
    expect(entry).toBeDefined();
    expect(entry!.deductionCategory).toBe('approved');
  });
});
