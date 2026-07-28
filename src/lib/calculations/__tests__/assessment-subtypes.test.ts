import { describe, test, expect } from 'vitest';
import { calculateAssessmentSummary } from '../assessment';
import type { AssessmentRow } from '@/types';

const mk = (o: Partial<AssessmentRow>): AssessmentRow => ({
  id: Math.random().toString(36).slice(2),
  particulars: '', estimated: 0, assessed: 0,
  partType: 'metal', gst: 18, section: 'parts', allowed: true,
  isDisposal: false, ...o,
});

describe('per-material estimate subtotals', () => {
  const rows: AssessmentRow[] = [
    mk({ partType: 'metal', estimated: 600, assessed: 600 }),
    mk({ partType: 'metal', estimated: 400, assessed: 400 }),
    mk({ partType: 'plastic', estimated: 250, assessed: 250 }),
    mk({ partType: 'glass', estimated: 150, assessed: 150 }),
    mk({ partType: 'metal', estimated: 999, assessed: 999, allowed: false }), // disallowed → excluded
    mk({ partType: 'labour', section: 'labour', estimated: 500, assessed: 500 }),
  ];
  // age 0, no depreciation so assessed == base
  const s = calculateAssessmentSummary(rows, 0, 'standard');

  test('buckets allowed metal estimate only', () => {
    expect(s.estimateMetalBase).toBe(1000); // 600+400, disallowed 999 excluded
    expect(s.estimatePlasticBase).toBe(250);
    expect(s.estimateGlassBase).toBe(150);
    expect(s.estimateFiberglassBase).toBe(0);
  });

  test('salvage 5-10% of metal estimate', () => {
    expect(Math.round(s.estimateMetalBase * 0.05)).toBe(50);
    expect(Math.round(s.estimateMetalBase * 0.10)).toBe(100);
  });
});
