import { describe, it, expect } from 'vitest';
import { paintMaterialRate } from '../depreciation';
import { calculateAssessmentSummary } from '../assessment';
import type { AssessmentRow } from '@/types/assessment';

const claim = (o: Record<string, unknown> = {}) => ({
  depreciationType: 'standard' as const,
  applyPaintMaterialDep: true,
  paintMaterialPercent: undefined,
  paintMaterialDepPercent: undefined,
  ...o,
});

describe('paintMaterialRate', () => {
  it('is 12.5% by default — 25% material at 50% depreciation', () => {
    expect(paintMaterialRate(claim())).toBeCloseTo(12.5, 6);
  });

  it('is 0 when the surveyor has not switched it on', () => {
    expect(paintMaterialRate(claim({ applyPaintMaterialDep: false }))).toBe(0);
    expect(paintMaterialRate(claim({ applyPaintMaterialDep: undefined }))).toBe(0);
  });

  it('is 0 under a nil-depreciation policy', () => {
    expect(paintMaterialRate(claim({ depreciationType: 'nil' }))).toBe(0);
  });

  it('follows the surveyor’s own percentages', () => {
    expect(paintMaterialRate(claim({ paintMaterialPercent: 30 }))).toBeCloseTo(15, 6);
    expect(paintMaterialRate(claim({ paintMaterialPercent: 30, paintMaterialDepPercent: 40 })))
      .toBeCloseTo(12, 6);
  });

  it('reduces the taxable base, so GST applies to what remains', () => {
    // The whole point: (10000 - 1250) x 1.18 = 10325, NOT 10000 x 1.18 - 1250 = 10550
    const rate = paintMaterialRate(claim());
    const net = 10000 * (1 - rate / 100);
    expect(net).toBeCloseTo(8750, 2);
    expect(net * 1.18).toBeCloseTo(10325, 2);
    expect(net * 1.18).not.toBeCloseTo(10550, 2);
  });

  it('the optional 7th parameter of calculateAssessmentSummary is inert by default', () => {
    const mkRow = (o: Partial<AssessmentRow>): AssessmentRow => ({
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
      ...o,
    });
    const rows = [
      mkRow({}),
      mkRow({ section: 'paint', partType: 'paint', particulars: 'Painting' }),
    ];

    const base = calculateAssessmentSummary(rows, 24, 'standard', 0, 0, 0).netAssessedLoss;
    const withEmpty = calculateAssessmentSummary(rows, 24, 'standard', 0, 0, 0, {}).netAssessedLoss;
    const withPaintDep = calculateAssessmentSummary(
      rows, 24, 'standard', 0, 0, 0, { applyPaintMaterialDep: true },
    ).netAssessedLoss;

    expect(withEmpty).toBe(base);
    expect(withPaintDep).toBeLessThan(base);
  });

  it("matches Claim C's printed paint chain", () => {
    // UIIC sample MOTOR-867/2026: 24,000 painting, IMT-23 tagged.
    // 24,000 -> less Imt 23 12,000 -> LESS PAINT DEP: 12.5% 1,500 -> 10,500
    const afterImt23 = 24000 / 2;
    const rate = paintMaterialRate(claim());
    expect(afterImt23 * (rate / 100)).toBeCloseTo(1500.00, 2);
    expect(afterImt23 * (1 - rate / 100)).toBeCloseTo(10500.00, 2);
  });
});
