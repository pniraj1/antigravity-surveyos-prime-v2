import { describe, it, expect } from 'vitest';
import { claimSurveyDate } from '../survey-date';

const base = {
  accident: { dateOfSurvey: '2026-10-01' },
  spotDetails: { surveyDatetime: '2026-09-30T14:20' },
  valuationDetails: { inspectionDate: '2026-09-29' },
} as any;

describe('claimSurveyDate', () => {
  it('final uses accident.dateOfSurvey', () => {
    expect(claimSurveyDate({ ...base, surveyType: 'final' })).toBe('2026-10-01');
  });

  it('spot uses the date part of spotDetails.surveyDatetime', () => {
    expect(claimSurveyDate({ ...base, surveyType: 'spot' })).toBe('2026-09-30');
  });

  it('valuation uses valuationDetails.inspectionDate', () => {
    expect(claimSurveyDate({ ...base, surveyType: 'valuation' })).toBe('2026-09-29');
  });

  it('blank or missing returns empty string', () => {
    expect(claimSurveyDate({ surveyType: 'spot' } as any)).toBe('');
  });
});
