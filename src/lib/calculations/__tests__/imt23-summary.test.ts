import { describe, it, expect } from 'vitest';
import { calculateAssessmentSummary } from '../assessment';
import { salvageBasis } from '../salvage';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow> = {}): AssessmentRow => ({
  id: Math.random().toString(36).slice(2), particulars: 'x',
  estimated: 10000, assessed: 10000, partType: 'metal', gst: 18,
  section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50, ...o,
});

describe('IMT-23 in the assessment summary', () => {
  it('halves the material bucket and its GST together', () => {
    const s = calculateAssessmentSummary([row({ imt23: true })], 0, 'nil', 0, 0, 0);
    expect(s.metalTotal).toBeCloseTo(5000, 2);
    expect(s.metalTotalInclGst).toBeCloseTo(5900, 2);
    expect(s.partsCGST).toBeCloseTo(450, 2);
    expect(s.partsSGST).toBeCloseTo(450, 2);
  });

  it('leaves the estimate totals untouched — an estimate is a fact about the garage document', () => {
    const s = calculateAssessmentSummary([row({ imt23: true })], 0, 'nil', 0, 0, 0);
    expect(s.estimatePartsBase).toBe(10000);
    expect(s.estimateMetalBase).toBe(10000);
    expect(s.estimateGrossTotal).toBeCloseTo(11800, 2);
  });

  it('does not move the salvage basis — salvage is the scrap value of the part', () => {
    const rows = [row({ imt23: true })];
    expect(salvageBasis(rows)).toBe(10000);
  });

  it('halves labour and paint rows too', () => {
    const s = calculateAssessmentSummary([
      row({ section: 'labour', partType: 'labour', imt23: true }),
      row({ section: 'paint', partType: 'paint', imt23: true }),
    ], 0, 'nil', 0, 0, 0);
    expect(s.labourOnlyBase).toBeCloseTo(5000, 2);
    expect(s.paintOnlyBase).toBeCloseTo(5000, 2);
  });

  it('composes with depreciation and reaches the net', () => {
    // 10000 -> 5000 -> less 25% metal dep -> 3750 -> +18% -> 4425
    const s = calculateAssessmentSummary([row({ imt23: true })], 46, 'standard', 0, 0, 0);
    expect(s.netAssessedLoss).toBeCloseTo(4425, 2);
  });
});
