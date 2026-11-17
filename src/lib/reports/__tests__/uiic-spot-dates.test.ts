import { describe, it, expect } from 'vitest';
import { buildUIICFinalHTML } from '../uiic-final-builder';
import { createBlankClaim } from '@/types/claim';

// "SPOT SURVEY DETAILS" is a separate event from the final survey. The store mirrors
// final-survey dates into spotDetails.*, so the UIIC column must not read those.
const cell = (html: string, label: string) =>
  html.match(new RegExp(`${label}</td><td[^>]*>([^<]*)<`))?.[1];

describe('UIIC final report — spot survey column', () => {
  const claim = () => {
    const c = createBlankClaim('final');
    c.accident = { ...c.accident, appointmentDate: '2026-11-10', dateOfSurvey: '2026-11-12', timeOfSurvey: '11:00' };
    c.spotDetails = { ...c.spotDetails, allotmentDate: '2026-11-10', surveyDatetime: '2026-11-12T11:00', reportDate: '2026-11-17' };
    return c;
  };

  it('does not print the final survey dates as spot survey dates', () => {
    const html = buildUIICFinalHTML(claim(), null);
    expect(cell(html, 'Spot Survey Appointment Date')).toBe('');
    expect(cell(html, 'Spot Survey Date')).toBe('');
    expect(cell(html, 'Spot Survey Report Date')).toBe('');
    expect(cell(html, 'Final Survey Appointment Date')).toBe('10.11.2026');
  });

  it('prints the spot dates the surveyor entered before printing', () => {
    const c = claim();
    c.reinspection = { ...c.reinspection, spotAppointmentDate: '2026-11-05', spotSurveyDate: '2026-11-06', spotReportDate: '2026-11-07' };
    const html = buildUIICFinalHTML(c, null);
    expect(cell(html, 'Spot Survey Appointment Date')).toBe('05.11.2026');
    expect(cell(html, 'Spot Survey Date')).toBe('06.11.2026');
    expect(cell(html, 'Spot Survey Report Date')).toBe('07.11.2026');
  });
});
