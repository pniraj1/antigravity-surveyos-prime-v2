import { describe, expect, test } from 'vitest';
import { createAssessmentSlice } from '../assessmentSlice';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: 'r1',
    particulars: 'FRONT BUMPER',
    estimated: 10000,
    assessed: 4000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

function harness(r: AssessmentRow) {
  let state: { currentClaim: ClaimData | null; isDirty?: boolean } = {
    currentClaim: { id: 'c1', assessmentRows: [r] } as unknown as ClaimData,
  };
  const set = (fn: (s: typeof state) => Partial<typeof state>) => {
    state = { ...state, ...fn(state) };
  };
  const slice = createAssessmentSlice(set as never, (() => state) as never, {} as never);
  return { slice, row: () => state.currentClaim!.assessmentRows[0] };
}

describe('kept open (K.O.)', () => {
  test('marking K.O. clears a lingering disallow action', () => {
    const h = harness({ ...row(), action: 'disallow' } as AssessmentRow);
    h.slice.toggleRowKeptOpen('r1');
    expect(h.row().action).toBeUndefined();
  });

  test('toggleRowKeptOpen on an allowed row → allowed false, keptOpen true', () => {
    const h = harness(row());
    h.slice.toggleRowKeptOpen('r1');
    expect(h.row().allowed).toBe(false);
    expect(h.row().keptOpen).toBe(true);
  });

  test('toggleRowKeptOpen twice → allowed true, keptOpen false, assessed === estimated', () => {
    const h = harness(row());
    h.slice.toggleRowKeptOpen('r1');
    h.slice.toggleRowKeptOpen('r1');
    expect(h.row().allowed).toBe(true);
    expect(h.row().keptOpen).toBe(false);
    expect(h.row().assessed).toBe(10000);
  });

  test('toggleRowAllowed on a K.O. row → allowed true, keptOpen false, assessed === estimated', () => {
    const h = harness(row({ allowed: false, keptOpen: true }));
    h.slice.toggleRowAllowed('r1');
    expect(h.row().allowed).toBe(true);
    expect(h.row().keptOpen).toBe(false);
    expect(h.row().assessed).toBe(10000);
  });

  test('updateAssessmentRow(id, { allowed: true }) on a K.O. row → keptOpen false', () => {
    const h = harness(row({ allowed: false, keptOpen: true }));
    h.slice.updateAssessmentRow('r1', { allowed: true });
    expect(h.row().allowed).toBe(true);
    expect(h.row().keptOpen).toBe(false);
  });
});
