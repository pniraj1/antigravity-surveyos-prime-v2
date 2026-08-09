import { describe, expect, test } from 'vitest';
import { buildSerialMap } from '../serial-numbers';
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

const SECTION_ORDER: AssessmentSection[] = ['parts', 'labour', 'paint'];

/** How the sectioned grid renders: same rows, grouped, relative order kept. */
function grouped(rows: AssessmentRow[]): AssessmentRow[] {
  return SECTION_ORDER.flatMap(s => rows.filter(r => r.section === s));
}

describe('serial numbers under section grouping', () => {
  test('grouping interleaved rows does not renumber them', () => {
    const interleaved = [
      row('p1', 'parts'),
      row('l1', 'labour'),
      row('p2', 'parts'),
      row('t1', 'paint'),
      row('l2', 'labour'),
      row('p3', 'parts'),
    ];

    const before = buildSerialMap(interleaved);
    const after = buildSerialMap(grouped(interleaved));

    for (const r of interleaved) {
      expect(after.get(r.id)).toBe(before.get(r.id));
    }
  });

  test('serials count within a section, not across the claim', () => {
    const rows = [row('p1', 'parts'), row('l1', 'labour'), row('p2', 'parts')];
    const map = buildSerialMap(rows);
    expect(map.get('p1')).toBe(1);
    expect(map.get('p2')).toBe(2);
    expect(map.get('l1')).toBe(1);
  });

  test('reordering within a section does renumber that section only', () => {
    const rows = [row('p1', 'parts'), row('p2', 'parts'), row('l1', 'labour')];
    const swapped = [rows[1], rows[0], rows[2]];
    const map = buildSerialMap(swapped);
    expect(map.get('p2')).toBe(1);
    expect(map.get('p1')).toBe(2);
    expect(map.get('l1')).toBe(1);
  });
});
