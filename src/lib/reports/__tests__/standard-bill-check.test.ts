import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML, buildStandardPrintDocument } from '../standard-report-builder';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';
import type { SurveyorProfile } from '@/types';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Bonnet Assy.',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  } as AssessmentRow;
}

function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'standard',
    reportNo: 'BC/2026/0417',
    reportDate: '2026-08-14',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: { insurerName: 'National Insurance Co. Ltd.', appointingOffice: 'DO-II Pune' },
    accident: { dateAndTime: '2026-06-24T10:00', workshopName: 'Sai Motors', dateOfSurvey: '2026-06-28' },
    driver: { name: 'UNIQUE_DRIVER_NAME' },
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'SM/INV/2026/1188', billDate: '2026-08-09', billTotal: 61832 },
  } as unknown as ClaimData;
}

const profile = { name: 'SURVEYOR' } as SurveyorProfile;

describe('Standard Bill Check report', () => {
  test('is titled as a bill check', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).toContain('MOTOR BILL CHECK REPORT');
    expect(html).not.toContain('MOTOR (FINAL) SURVEY REPORT');
  });

  test('section 9 is DETAILS OF BILL CHECK and its money column reads Bill', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).toContain('9. DETAILS OF BILL CHECK');
    expect(html).toContain('Bill ₹');
    expect(html).not.toContain('Est. ₹');
  });

  test('section 8 heads its first money column Billed', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).toContain('>Billed<');
    expect(html).not.toContain('>Estimated<');
  });

  test('omits driver and cause sections, and carries the invoice instead', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).not.toContain("3. DRIVER'S PARTICULARS");
    expect(html).not.toContain('7. CAUSE &amp; NATURE OF ACCIDENT');
    expect(html).not.toContain('UNIQUE_DRIVER_NAME');
    expect(html).toContain('4. WORKSHOP INVOICE &amp; BILL REFERENCE');
    expect(html).toContain('SM/INV/2026/1188');
  });

  test('keeps insurer and vehicle sections', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).toContain('1. INSURER &amp; INSURED DETAILS');
    expect(html).toContain('National Insurance Co. Ltd.');
    expect(html).toContain('2. VEHICLE PARTICULARS');
  });

  test('the billed figure is what prints in the bill column', () => {
    const html = buildStandardFinalSurveyHTML(claim([row({ billedTaxable: 11500 })]), profile, 'bill-check');
    expect(html).toContain('11,500');
  });

  test('a not-in-bill row carries no liability', () => {
    const kept = buildStandardFinalSurveyHTML(claim([row(), row({ id: 'r2', assessed: 5000, estimated: 5000 })]), profile, 'bill-check');
    const dropped = buildStandardFinalSurveyHTML(
      claim([row(), row({ id: 'r2', assessed: 5000, estimated: 5000, billStatus: 'not-in-bill' })]),
      profile, 'bill-check',
    );
    expect(kept).not.toBe(dropped);
    expect(dropped).toContain('9. DETAILS OF BILL CHECK');
  });

  // The regression guard for the whole design.
  test('billAllowed NEVER reaches the Final Survey Report', () => {
    const c = claim([row({ assessed: 1000, estimated: 1000, billAllowed: 1200, billedTaxable: 1200 })]);
    const final = buildStandardFinalSurveyHTML(c, profile, 'final');
    expect(final).toContain('1,000');
    expect(final).not.toContain('1,200');
  });

  test('defaults to final mode when no mode is given', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile);
    expect(html).toContain('MOTOR (FINAL) SURVEY REPORT');
    expect(html).toContain("3. DRIVER'S PARTICULARS");
  });
});

describe('Bill check print document', () => {
  test('names the window after the bill check, not the final survey', () => {
    const doc = buildStandardPrintDocument(claim([row()]), profile, 'bill-check');
    expect(doc).toContain('Standard Bill Check Report');
    expect(doc).not.toContain('Standard Final Survey Report');
  });

  test('still names the final survey in final mode', () => {
    expect(buildStandardPrintDocument(claim([row()]), profile)).toContain('Standard Final Survey Report');
  });
});
