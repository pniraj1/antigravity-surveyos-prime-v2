import { describe, it, expect } from 'vitest';
import { rowDepRate } from '../row-dep-rate';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow> = {}): AssessmentRow => ({
  id: 'r', particulars: 'x', estimated: 0, assessed: 100,
  partType: 'metal', gst: 18, section: 'parts', allowed: true,
  isDisposal: false, disposalPercent: 50, ...o,
});
const claim = { depreciationType: 'standard', applyPaintMaterialDep: true };

describe('rowDepRate', () => {
  it('gives paint rows the material rate', () => {
    expect(rowDepRate(row({ section: 'paint', partType: 'paint' }), 46, claim)).toBeCloseTo(12.5, 6);
  });

  it('leaves labour at zero', () => {
    expect(rowDepRate(row({ section: 'labour', partType: 'labour' }), 46, claim)).toBe(0);
  });

  it('keeps the IRDAI scale for parts', () => {
    expect(rowDepRate(row(), 46, claim)).toBe(25);
    expect(rowDepRate(row({ partType: 'plastic' }), 46, claim)).toBe(50);
  });

  it('lets a surveyor override beat the paint rate', () => {
    const r = row({ section: 'paint', partType: 'paint', depOverride: 40 });
    expect(rowDepRate(r, 46, claim)).toBe(40);
  });

  it('respects an explicit zero override', () => {
    const r = row({ section: 'paint', partType: 'paint', depOverride: 0 });
    expect(rowDepRate(r, 46, claim)).toBe(0);
  });

  it('gives paint nothing when the claim switch is off', () => {
    const r = row({ section: 'paint', partType: 'paint' });
    expect(rowDepRate(r, 46, { depreciationType: 'standard' })).toBe(0);
  });
});
