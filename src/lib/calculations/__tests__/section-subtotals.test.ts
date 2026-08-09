import { describe, expect, test } from 'vitest';
import { sectionSubtotals } from '../section-subtotals';
import { calculateAssessmentSummary } from '../assessment';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Item',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

describe('sectionSubtotals', () => {
  test('each section total equals the engine figure it came from', () => {
    const rows = [
      row({ partType: 'metal', assessed: 10000, section: 'parts' }),
      row({ partType: 'labour', assessed: 2000, section: 'labour' }),
      row({ partType: 'paint', assessed: 5000, section: 'paint' }),
    ];
    const summary = calculateAssessmentSummary(rows, 38, 'standard');
    const s = sectionSubtotals(summary);

    expect(s.parts.base).toBe(summary.partsBase);
    expect(s.parts.total).toBe(summary.partsTotal);
    expect(s.labour.base).toBe(summary.labourOnlyBase);
    expect(s.labour.total).toBe(summary.labourOnlyTotal);
    expect(s.paint.base).toBe(summary.paintOnlyBase);
    expect(s.paint.total).toBe(summary.paintOnlyTotal);
  });

  test('gst is the difference between total and base', () => {
    const rows = [row({ partType: 'metal', assessed: 10000, gst: 28 })];
    const summary = calculateAssessmentSummary(rows, 38, 'standard');
    const s = sectionSubtotals(summary);

    // 10000 at 25% dep = 7500 base; 28% GST = 2100
    expect(s.parts.base).toBeCloseTo(7500, 2);
    expect(s.parts.gst).toBeCloseTo(2100, 2);
    expect(s.parts.total).toBeCloseTo(9600, 2);
  });

  test('the three section totals sum to the grand total', () => {
    const rows = [
      row({ partType: 'metal', assessed: 10000, section: 'parts' }),
      row({ partType: 'plastic', assessed: 4000, section: 'parts' }),
      row({ partType: 'labour', assessed: 2000, section: 'labour' }),
      row({ partType: 'paint', assessed: 5000, section: 'paint' }),
    ];
    const summary = calculateAssessmentSummary(rows, 38, 'standard');
    const s = sectionSubtotals(summary);

    expect(s.parts.total + s.labour.total + s.paint.total).toBeCloseTo(summary.grandTotal, 2);
  });

  test('an empty claim gives three zeroed sections', () => {
    const summary = calculateAssessmentSummary([], 38, 'standard');
    const s = sectionSubtotals(summary);
    for (const key of ['parts', 'labour', 'paint'] as const) {
      expect(s[key]).toEqual({ base: 0, gst: 0, total: 0 });
    }
  });
});
