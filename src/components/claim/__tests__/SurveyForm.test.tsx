import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { SurveyForm } from '../SurveyForm';
import { createBlankClaim } from '@/types';

describe('SurveyForm unified date & time of survey', () => {
  it('renders a single Date & Time of Survey datetime-local input for final claims', () => {
    const claim = {
      ...createBlankClaim('final', 'private'),
      accident: {
        ...createBlankClaim('final', 'private').accident,
        dateOfSurvey: '2026-10-15',
        timeOfSurvey: '14:30',
      },
    };
    const html = renderToStaticMarkup(<SurveyForm claim={claim} />);
    expect(html).toContain('Date &amp; Time of Survey');
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain('value="2026-10-15T14:30"');
    // Does NOT render separate Date of Survey / Time of Survey inputs
    expect(html).not.toContain('>Date of Survey<');
    expect(html).not.toContain('>Time of Survey<');
    expect(html).not.toContain('Survey Datetime (Actual)');
  });

  it('renders unified Date & Time of Survey for spot claims without duplicate Survey Datetime (Actual)', () => {
    const claim = {
      ...createBlankClaim('spot', 'private'),
      spotDetails: {
        ...createBlankClaim('spot', 'private').spotDetails,
        surveyDatetime: '2026-10-16T11:00',
      },
    };
    const html = renderToStaticMarkup(<SurveyForm claim={claim} />);
    expect(html).toContain('Date &amp; Time of Survey');
    expect(html).toContain('value="2026-10-16T11:00"');
    expect(html).not.toContain('Survey Datetime (Actual)');
  });
});
