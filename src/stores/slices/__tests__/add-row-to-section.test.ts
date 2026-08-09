import { describe, expect, test } from 'vitest';
import { createAssessmentSlice } from '../assessmentSlice';
import type { ClaimData } from '@/types';
import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

function row(id: string, section: AssessmentSection): AssessmentRow {
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

function harness(rows: AssessmentRow[]) {
  let state: { currentClaim: ClaimData | null; isDirty?: boolean } = {
    currentClaim: { id: 'c1', assessmentRows: rows } as unknown as ClaimData,
  };
  const set = (fn: (s: typeof state) => Partial<typeof state>) => {
    state = { ...state, ...fn(state) };
  };
  const slice = createAssessmentSlice(set as never, (() => state) as never, {} as never);
  return { slice, rows: () => state.currentClaim!.assessmentRows };
}

describe('addAssessmentRowToSection', () => {
  test('inserts after the last row of its own section', () => {
    const h = harness([row('p1', 'parts'), row('l1', 'labour'), row('t1', 'paint')]);
    h.slice.addAssessmentRowToSection('parts');
    const sections = h.rows().map(r => r.section);
    expect(sections).toEqual(['parts', 'parts', 'labour', 'paint']);
  });

  test('appends to the end when the section has no rows yet', () => {
    const h = harness([row('p1', 'parts')]);
    h.slice.addAssessmentRowToSection('paint');
    expect(h.rows().map(r => r.section)).toEqual(['parts', 'paint']);
    expect(h.rows()[1].partType).toBe('paint');
  });

  test('the new row carries the right section and part type', () => {
    const h = harness([]);
    h.slice.addAssessmentRowToSection('labour');
    expect(h.rows()).toHaveLength(1);
    expect(h.rows()[0].section).toBe('labour');
    expect(h.rows()[0].partType).toBe('labour');
  });
});
