import { describe, expect, test } from 'vitest';
import { createAssessmentSlice } from '../assessmentSlice';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: 'r1',
    particulars: 'BONNET',
    estimated: 8000,
    assessed: 5000, // negotiated down from the garage's figure
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    quantity: 1,
    unitPrice: 8000,
    ...overrides,
  };
}

function harness(rows: AssessmentRow[]) {
  let state: { currentClaim: ClaimData | null; isDirty?: boolean } = {
    currentClaim: { id: 'c1', assessmentRows: rows } as unknown as ClaimData,
  };
  const set = (fn: (s: typeof state) => Partial<typeof state>) => {
    state = { ...state, ...fn(state) };
  };
  const slice = createAssessmentSlice(set as never, (() => state) as never, {} as never);
  return { slice, first: () => state.currentClaim!.assessmentRows[0] };
}

describe('the surveyor assessed figure is never overwritten by the estimate', () => {
  // The assessment is the surveyor's own. Correcting a mistyped estimate,
  // quantity or unit price must not silently restore the garage's number.
  test('correcting the estimate leaves assessed alone', () => {
    const h = harness([row()]);
    h.slice.updateAssessmentRow('r1', { estimated: 8500 });
    expect(h.first().estimated).toBe(8500);
    expect(h.first().assessed).toBe(5000);
  });

  test('editing quantity recomputes the estimate but leaves assessed alone', () => {
    const h = harness([row()]);
    h.slice.updateAssessmentRow('r1', { quantity: 2 });
    expect(h.first().estimated).toBe(16000);
    expect(h.first().assessed).toBe(5000);
  });

  test('editing unit price recomputes the estimate but leaves assessed alone', () => {
    const h = harness([row()]);
    h.slice.updateAssessmentRow('r1', { unitPrice: 9000 });
    expect(h.first().estimated).toBe(9000);
    expect(h.first().assessed).toBe(5000);
  });

  test('re-allowing a disallowed row still restores the full estimate', () => {
    // Unticking takes the row out of the claim, so the old assessed figure
    // has no meaning; ticking it back starts again from the estimate.
    const h = harness([row({ allowed: false })]);
    h.slice.toggleRowAllowed('r1');
    expect(h.first().assessed).toBe(8000);
  });

  test('a quantity of 0 prices the estimate at 0, not at one unit', () => {
    // `quantity || 1` billed a zeroed-out line as a single unit.
    const h = harness([row()]);
    h.slice.updateAssessmentRow('r1', { quantity: 0 });
    expect(h.first().estimated).toBe(0);
  });
});
