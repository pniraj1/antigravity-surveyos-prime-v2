import { describe, expect, test } from 'vitest';
import { clampRangeToSection, sectionTickState } from '../useGridSelection';
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

const ROWS = [
  row('p1', 'parts'),
  row('p2', 'parts'),
  row('l1', 'labour'),
  row('l2', 'labour'),
  row('t1', 'paint'),
];

describe('clampRangeToSection', () => {
  test('a range inside one section is returned whole', () => {
    expect(clampRangeToSection(ROWS, 'p1', 'p2')).toEqual({ startIdx: 0, endIdx: 1 });
  });

  test('a range crossing into another section stops at the boundary', () => {
    // Anchored in parts, dragged down into labour: the selection must not
    // extend past the last parts row, because in a sectioned view that
    // renders as a highlight jumping between tables.
    expect(clampRangeToSection(ROWS, 'p1', 'l2')).toEqual({ startIdx: 0, endIdx: 1 });
  });

  test('an upward range crossing a boundary clamps to the section start', () => {
    expect(clampRangeToSection(ROWS, 'l2', 'p1')).toEqual({ startIdx: 2, endIdx: 3 });
  });

  test('a single-row range is valid', () => {
    expect(clampRangeToSection(ROWS, 't1', 't1')).toEqual({ startIdx: 4, endIdx: 4 });
  });

  test('an unknown id yields no range', () => {
    expect(clampRangeToSection(ROWS, 'ghost', 'p1')).toBeNull();
  });
});

describe('sectionTickState', () => {
  test('none when nothing in the section is selected', () => {
    expect(sectionTickState(['p1', 'p2'], new Set())).toBe('none');
  });

  test('some when part of the section is selected', () => {
    expect(sectionTickState(['p1', 'p2'], new Set(['p1']))).toBe('some');
  });

  test('all when every row in the section is selected', () => {
    expect(sectionTickState(['p1', 'p2'], new Set(['p1', 'p2']))).toBe('all');
  });

  test('an empty section is none, never all', () => {
    expect(sectionTickState([], new Set(['p1']))).toBe('none');
  });

  test('selections in other sections do not affect this one', () => {
    expect(sectionTickState(['p1'], new Set(['p1', 'l1', 't1']))).toBe('all');
  });
});
