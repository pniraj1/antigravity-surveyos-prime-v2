import { describe, it, expect } from 'vitest';
import {
  composeFinalSurveyPreamble,
  estimateTotalInclGst,
} from '../final-survey-preamble';
import type { AssessmentRow } from '@/types';

const row = (over: Partial<AssessmentRow>): AssessmentRow => ({
  id: 'r', particulars: '', estimated: 0, assessed: 0,
  partType: 'metal', gst: 18, section: 'parts', allowed: true,
  isDisposal: false, disposalPercent: 50, ...over,
});

describe('estimateTotalInclGst', () => {
  it('adds GST to normal rows and skips GST on disposal rows', () => {
    const rows = [
      row({ estimated: 1000, gst: 18 }),                  // 1180
      row({ estimated: 500, gst: 18, isDisposal: true }), // 500 (no GST)
    ];
    expect(estimateTotalInclGst(rows)).toBeCloseTo(1680, 2);
  });

  it('defaults missing gst to 18%', () => {
    const rows = [row({ estimated: 200, gst: undefined as unknown as number })];
    expect(estimateTotalInclGst(rows)).toBeCloseTo(236, 2);
  });
});

describe('composeFinalSurveyPreamble', () => {
  it('fills all slots with provided values', () => {
    const text = composeFinalSurveyPreamble({
      appointingOffice: 'DO-12 Pune',
      insurerName: 'United India',
      placeOfSurvey: 'ABC Motors',
      estimateTotal: 1680,
      assessedTotal: 1180,
    });
    expect(text).toContain('As per instructions received from DO-12 Pune');
    expect(text).toContain('at ABC Motors');
    expect(text).toContain('Rs. 1,680.00');
    expect(text).toContain('Rs. 1,180.00');
    expect(text).toContain('worked out in detail as follows');
  });

  it('falls back to insurer when appointing office is blank', () => {
    const text = composeFinalSurveyPreamble({
      appointingOffice: '', insurerName: 'United India',
      placeOfSurvey: '', estimateTotal: 0, assessedTotal: 0,
    });
    expect(text).toContain('received from United India');
    expect(text).toContain('at the workshop');
  });

  it('falls back to "the insurer" when both office and insurer are blank', () => {
    const text = composeFinalSurveyPreamble({
      estimateTotal: 0, assessedTotal: 0,
    });
    expect(text).toContain('received from the insurer');
  });
});
