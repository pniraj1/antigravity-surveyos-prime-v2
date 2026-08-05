import { describe, expect, test } from 'vitest';
import { calculateAssessmentSummary } from '../assessment';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Item',
    estimated: 1000,
    assessed: 1000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

describe('calculateAssessmentSummary labour/paint split', () => {
  test('reports labour and painting separately', () => {
    const s = calculateAssessmentSummary([
      row({ section: 'labour', partType: 'labour', estimated: 2000, assessed: 2000 }),
      row({ section: 'paint', partType: 'paint', estimated: 5000, assessed: 5000 }),
    ], 0, 'nil');

    expect(s.labourOnlyBase).toBeCloseTo(2000, 2);
    expect(s.paintOnlyBase).toBeCloseTo(5000, 2);
    expect(s.labourOnlyTotal).toBeCloseTo(2360, 2);   // 2000 × 1.18
    expect(s.paintOnlyTotal).toBeCloseTo(5900, 2);    // 5000 × 1.18
    expect(s.estimateLabourOnlyBase).toBeCloseTo(2000, 2);
    expect(s.estimatePaintOnlyBase).toBeCloseTo(5000, 2);
  });

  test('the split still sums to the combined labour figures', () => {
    const s = calculateAssessmentSummary([
      row({ section: 'labour', partType: 'labour', assessed: 2000, estimated: 2000 }),
      row({ section: 'paint', partType: 'paint', assessed: 5000, estimated: 5000 }),
    ], 0, 'nil');

    expect(s.labourOnlyBase + s.paintOnlyBase).toBeCloseTo(s.labourBase, 2);
    expect(s.labourOnlyTotal + s.paintOnlyTotal).toBeCloseTo(s.labourTotal, 2);
  });

  test('honours a per-item rate on labour', () => {
    const s = calculateAssessmentSummary(
      [row({ section: 'labour', partType: 'labour', assessed: 1000, estimated: 1000, gst: 5 })],
      0, 'nil'
    );
    expect(s.labourOnlyTotal).toBeCloseTo(1050, 2);
  });
});
