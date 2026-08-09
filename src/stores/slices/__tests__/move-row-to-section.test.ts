import { describe, expect, test } from 'vitest';
import { createAssessmentSlice } from '../assessmentSlice';
import type { ClaimData } from '@/types';
import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

function row(id: string, section: AssessmentSection, overrides: Partial<AssessmentRow> = {}): AssessmentRow {
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
    ...overrides,
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
  return {
    slice,
    rows: () => state.currentClaim!.assessmentRows,
    ids: () => state.currentClaim!.assessmentRows.map(r => r.id),
    byId: (id: string) => state.currentClaim!.assessmentRows.find(r => r.id === id)!,
  };
}

describe('moveRowToSection', () => {
  test('changes the row section and repositions it', () => {
    const h = harness([row('p1', 'parts'), row('p2', 'parts'), row('l1', 'labour')]);
    h.slice.moveRowToSection('p2', 'labour', 2);
    expect(h.byId('p2').section).toBe('labour');
    expect(h.ids()).toEqual(['p1', 'l1', 'p2']);
  });

  test('a plastic part survives a round trip through labour', () => {
    const h = harness([row('p1', 'parts', { partType: 'plastic' })]);
    h.slice.moveRowToSection('p1', 'labour', 0);
    expect(h.byId('p1').partType).toBe('labour');
    h.slice.moveRowToSection('p1', 'parts', 0);
    expect(h.byId('p1').partType).toBe('plastic');
    expect(h.byId('p1').previousPartType).toBeUndefined();
  });

  test('clears a manual depreciation override', () => {
    const h = harness([row('p1', 'parts', { depOverride: 40 })]);
    h.slice.moveRowToSection('p1', 'labour', 0);
    expect(h.byId('p1').depOverride).toBeUndefined();
  });

  test('leaves every other row untouched', () => {
    const h = harness([row('p1', 'parts'), row('l1', 'labour'), row('t1', 'paint')]);
    // Deep copy, not a live reference: the row object in state is never
    // replaced, so comparing it to a captured reference would be comparing it
    // to itself and could not fail even if the action mutated it in place.
    const before = structuredClone(h.byId('l1'));
    h.slice.moveRowToSection('p1', 'paint', 2);
    expect(h.rows()).toHaveLength(3);
    expect(h.byId('l1')).toEqual(before);
  });

  test('an unknown row id is a no-op', () => {
    const h = harness([row('p1', 'parts')]);
    h.slice.moveRowToSection('ghost', 'labour', 0);
    expect(h.ids()).toEqual(['p1']);
    expect(h.byId('p1').section).toBe('parts');
  });

  test('a same-section move still repositions the row', () => {
    // resolveSectionMove returns no field changes, but the row is still
    // removed and reinserted at the target index -- this is the path a
    // within-section drag would take if it ever routed through here.
    const h = harness([row('p1', 'parts'), row('p2', 'parts')]);
    h.slice.moveRowToSection('p1', 'parts', 1);
    expect(h.ids()).toEqual(['p2', 'p1']);
    expect(h.byId('p1').partType).toBe('metal');
    expect(h.byId('p1').previousPartType).toBeUndefined();
  });

  test('an out-of-range index clamps instead of creating holes', () => {
    const h = harness([row('p1', 'parts'), row('l1', 'labour')]);
    h.slice.moveRowToSection('p1', 'labour', 99);
    expect(h.rows()).toHaveLength(2);
    expect(h.rows().every(Boolean)).toBe(true);
    expect(h.ids()).toEqual(['l1', 'p1']);
  });
});
