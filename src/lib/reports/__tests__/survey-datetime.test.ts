import { describe, it, expect } from 'vitest';
import { formatSurveyDateTime } from '../report-utils';

describe('formatSurveyDateTime', () => {
  it('joins the survey date and time', () => {
    expect(formatSurveyDateTime('2026-06-10', '11:30')).toBe('10.06.2026 at 11:30 hrs');
  });

  it('falls back to the date alone when no time was recorded', () => {
    // An absent time must never render as 00:00 — that would assert a midnight
    // survey that did not happen, in a document the surveyor signs.
    expect(formatSurveyDateTime('2026-06-10', '')).toBe('10.06.2026');
    expect(formatSurveyDateTime('2026-06-10', undefined)).toBe('10.06.2026');
    expect(formatSurveyDateTime('2026-06-10', null)).toBe('10.06.2026');
  });

  it('shows the em dash when no date is recorded, even if a time is', () => {
    expect(formatSurveyDateTime('', '11:30')).toBe('—');
    expect(formatSurveyDateTime(null, '11:30')).toBe('—');
  });

  it('reads Indian DD-MM-YYYY input without flipping day and month', () => {
    expect(formatSurveyDateTime('10-06-2026', '09:00')).toBe('10.06.2026 at 09:00 hrs');
  });

  it('keeps midnight when the surveyor genuinely entered it', () => {
    // Distinct from the absent-time case above: 00:00 typed deliberately is a
    // real value and must survive.
    expect(formatSurveyDateTime('2026-06-10', '00:00')).toBe('10.06.2026 at 00:00 hrs');
  });
});
