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

describe('buildPreClassifiedExplanations', () => {
  test('standard depreciation row is pre-classified as depreciation', () => {
    const claim = { assessmentRows: [baseRow] } as any;
    const results = buildPreClassifiedExplanations(claim, false);
    const entry = results.find(e => e.assessmentRowId === 'r1');
    expect(entry).toBeDefined();
    expect(entry!.deductionCategory).toBe('depreciation');
    expect(entry!.isFlagged).toBe(false);
  });

  test('surveyor-tagged row uses the tag category directly', () => {
    const claim = { assessmentRows: [{ ...baseRow, deductionCategory: 'consumable' }] } as any;
    const results = buildPreClassifiedExplanations(claim, false);
    const entry = results.find(e => e.assessmentRowId === 'r1');
    expect(entry).toBeDefined();
    expect(entry!.deductionCategory).toBe('consumable');
  });

  test('depOverride row is NOT pre-classified (must go to AI)', () => {
    const claim = { assessmentRows: [{ ...baseRow, depOverride: 50 }] } as any;
    const results = buildPreClassifiedExplanations(claim, false);
    const entry = results.find(e => e.assessmentRowId === 'r1');
    expect(entry).toBeUndefined();
  });

  test('disposal row is pre-classified as salvage (existing behaviour preserved)', () => {
    const claim = { assessmentRows: [{ ...baseRow, isDisposal: true }] } as any;
    const results = buildPreClassifiedExplanations(claim, false);
    const entry = results.find(e => e.assessmentRowId === 'r1');
    expect(entry).toBeDefined();
    expect(entry!.deductionCategory).toBe('salvage');
  });
});
