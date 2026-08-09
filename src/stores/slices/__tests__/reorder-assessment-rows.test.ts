import { describe, expect, test } from 'vitest';
import { createAssessmentSlice } from '../assessmentSlice';
import type { ClaimData } from '@/types';
import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

function row(id: string, section: AssessmentSection = 'parts'): AssessmentRow {
  return {
    id,
    particulars: id.toUpperCase(),
    estimated: 1000,
    assessed: 1000,
    partType: section === 'labour' ? 'labour' : section === 'paint' ? 'paint' : 'metal',
    gst: 18,
    section,
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
  };
}

/** Minimal harness: runs the slice's set() against a plain state object. */
function harness(rows: AssessmentRow[]) {
  let state: { currentClaim: ClaimData | null; isDirty?: boolean } = {
    currentClaim: { id: 'c1', assessmentRows: rows } as unknown as ClaimData,
  };
  const set = (fn: (s: typeof state) => Partial<typeof state>) => {
    state = { ...state, ...fn(state) };
  };
  const slice = createAssessmentSlice(set as never, (() => state) as never, {} as never);
  return { slice, ids: () => state.currentClaim!.assessmentRows.map(r => r.id) };
}

describe('reorderAssessmentRows', () => {
  test('a full ordered list reorders every row', () => {
    const { slice, ids } = harness([row('a'), row('b'), row('c')]);
    slice.reorderAssessmentRows(['c', 'a', 'b']);
    expect(ids()).toEqual(['c', 'a', 'b']);
  });

  test('rows missing from the list are kept, not deleted', () => {
    // The defect: the action rebuilt assessmentRows from only the ids handed
    // to it, so any caller passing a subset silently dropped every other row —
    // and auto-save persisted the loss. A per-section reorder passes one
    // section's ids, which would have destroyed the other two sections.
    const { slice, ids } = harness([
      row('p1', 'parts'),
      row('l1', 'labour'),
      row('p2', 'parts'),
      row('t1', 'paint'),
    ]);

    slice.reorderAssessmentRows(['p2', 'p1']);

    expect(ids()).toHaveLength(4);
    expect(ids()).toContain('l1');
    expect(ids()).toContain('t1');
  });

  test('a partial reorder rearranges only the rows it names', () => {
    // The named rows take the index positions the named rows already occupied
    // (0 and 2 here), in the new order. Everything else stays where it was.
    const { slice, ids } = harness([
      row('p1', 'parts'),
      row('l1', 'labour'),
      row('p2', 'parts'),
      row('t1', 'paint'),
    ]);

    slice.reorderAssessmentRows(['p2', 'p1']);

    expect(ids()).toEqual(['p2', 'l1', 'p1', 't1']);
  });

  test('unknown ids are ignored rather than corrupting the order', () => {
    const { slice, ids } = harness([row('a'), row('b')]);
    slice.reorderAssessmentRows(['b', 'ghost', 'a']);
    expect(ids()).toEqual(['b', 'a']);
  });

  test('an empty list leaves the rows untouched', () => {
    const { slice, ids } = harness([row('a'), row('b')]);
    slice.reorderAssessmentRows([]);
    expect(ids()).toEqual(['a', 'b']);
  });

  test('a duplicated id does not clone or drop a row', () => {
    const { slice, ids } = harness([row('a'), row('b'), row('c')]);
    slice.reorderAssessmentRows(['b', 'b', 'a']);
    expect(ids()).toHaveLength(3);
    expect(new Set(ids())).toEqual(new Set(['a', 'b', 'c']));
  });
});
