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
  const ids = (r: Set<string>) => [...r].sort();

  test('a range inside one section is returned whole', () => {
    expect(ids(clampRangeToSection(ROWS, 'p1', 'p2'))).toEqual(['p1', 'p2']);
  });

  test('a range crossing into another section stops at the boundary', () => {
    // Anchored in parts, dragged down into labour: the selection must not
    // extend past the last parts row.
    expect(ids(clampRangeToSection(ROWS, 'p1', 'l2'))).toEqual(['p1', 'p2']);
  });

  test('an upward range crossing a boundary clamps to the section start', () => {
    expect(ids(clampRangeToSection(ROWS, 'l2', 'p1'))).toEqual(['l1', 'l2']);
  });

  test('a single-row range is valid', () => {
    expect(ids(clampRangeToSection(ROWS, 't1', 't1'))).toEqual(['t1']);
  });

  test('an unknown anchor yields nothing', () => {
    expect(clampRangeToSection(ROWS, 'ghost', 'p1').size).toBe(0);
  });

  test('an unknown focus selects the anchor alone', () => {
    expect(ids(clampRangeToSection(ROWS, 'p1', 'ghost'))).toEqual(['p1']);
  });

  test('rows adjacent on screen but split in the array are both selected', () => {
    // THE REGRESSION. The claim array is interleaved -- AI extraction writes
    // rows in estimate order, so [part, labour, part] is normal and the three
    // tables come from filtering at render time. In the Parts table the user
    // sees p1 then p2 adjacent and shift-clicks p2. An implementation walking
    // the FLAT array stops dead at l1 and selects p1 alone.
    const interleaved = [
      row('p1', 'parts'),
      row('l1', 'labour'),
      row('p2', 'parts'),
      row('t1', 'paint'),
      row('p3', 'parts'),
    ];
    expect(ids(clampRangeToSection(interleaved, 'p1', 'p3'))).toEqual(['p1', 'p2', 'p3']);
    expect(clampRangeToSection(interleaved, 'p1', 'p3').has('l1')).toBe(false);
    expect(clampRangeToSection(interleaved, 'p1', 'p3').has('t1')).toBe(false);
  });

  test('a range never includes a row from another section', () => {
    const interleaved = [
      row('p1', 'parts'), row('l1', 'labour'), row('p2', 'parts'), row('l2', 'labour'),
    ];
    for (const [a, f] of [['p1', 'p2'], ['p1', 'l2'], ['l1', 'l2'], ['l2', 'p1']] as const) {
      const picked = clampRangeToSection(interleaved, a, f);
      const anchorSection = interleaved.find(r => r.id === a)!.section;
      for (const id of picked) {
        expect(interleaved.find(r => r.id === id)!.section).toBe(anchorSection);
      }
    }
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
