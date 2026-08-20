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
    mk({ partType: 'metal', estimated: 999, assessed: 999, allowed: false }), // disallowed → still estimated
    mk({ partType: 'labour', section: 'labour', estimated: 500, assessed: 500 }),
  ];
  // age 0, no depreciation so assessed == base
  const s = calculateAssessmentSummary(rows, 0, 'standard');

  test('buckets every metal estimate, rejected included', () => {
    // An estimate is a fact about the garage's document — rejecting an item
    // does not change what was estimated for it. This split used to filter on
    // `allowed` while estimatePartsBase beside it did not, so the two
    // disagreed and any report printing both showed a breakdown that did not
    // sum to its own heading.
    expect(s.estimateMetalBase).toBe(1999); // 600 + 400 + 999
    expect(s.estimatePlasticBase).toBe(250);
    expect(s.estimateGlassBase).toBe(150);
    expect(s.estimateFiberglassBase).toBe(0);
  });

  test('salvage 5-10% of metal estimate', () => {
    // Deliberate: the salvage hint reads the same unfiltered metal estimate, so
    // a rejected metal part raises the suggestion even though that part is
    // never removed from the vehicle. Considered and kept on 2026-08-18 — do
    // not "fix" this back to an allowed-only figure without asking first.
    expect(Math.round(s.estimateMetalBase * 0.05)).toBe(100);
    expect(Math.round(s.estimateMetalBase * 0.10)).toBe(200);
  });
});
