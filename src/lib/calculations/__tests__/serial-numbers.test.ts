import { describe, expect, test } from 'vitest';
import { buildSerialMap } from '../serial-numbers';
import type { AssessmentRow } from '@/types/assessment';

function row(id: string, section: AssessmentRow['section'], allowed = true): AssessmentRow {
  return {
    id,
    particulars: id,
    estimated: 0,
    assessed: 0,
    partType: section === 'labour' ? 'labour' : section === 'paint' ? 'paint' : 'metal',
    gst: 18,
    section,
    allowed,
    isDisposal: false,
    disposalPercent: 50,
  };
}

describe('buildSerialMap', () => {
  test('numbers each section independently from 1', () => {
    const map = buildSerialMap([
      row('p1', 'parts'),
      row('p2', 'parts'),
      row('l1', 'labour'),
      row('t1', 'paint'),
    ]);
    expect(map.get('p1')).toBe(1);
    expect(map.get('p2')).toBe(2);
    expect(map.get('l1')).toBe(1);
    expect(map.get('t1')).toBe(1);
  });

  test('counts disallowed rows so the gap survives into Bill Check', () => {
    // The insurer reads 1 then 4 and knows 2 and 3 were rejected. Renumbering
    // to 1, 2 would destroy that signal.
    const map = buildSerialMap([
      row('p1', 'parts'),
      row('p2', 'parts', false),
      row('p3', 'parts', false),
      row('p4', 'parts'),
    ]);
    expect(map.get('p1')).toBe(1);
    expect(map.get('p4')).toBe(4);
  });

  test('paint is numbered the same way as parts and labour', () => {
    // Regression: the Final Report filtered disallowed paint and renumbered,
    // so paint serials disagreed between the two documents.
    const map = buildSerialMap([
      row('t1', 'paint'),
      row('t2', 'paint', false),
      row('t3', 'paint'),
    ]);
    expect(map.get('t3')).toBe(3);
  });

  test('handles an empty claim', () => {
    expect(buildSerialMap([]).size).toBe(0);
  });
});
