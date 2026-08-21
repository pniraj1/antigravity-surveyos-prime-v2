import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import { buildUIICBillCheckHTML } from '../uiic-final-builder';
import type { ClaimData, SurveyorProfile } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

const profile = { name: 'SURVEYOR' } as SurveyorProfile;

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
    billStatus: 'in-bill',
    billedTaxable: 10000,
    ...overrides,
  } as AssessmentRow;
}

// Fender capped to 5,000 taxable (5,900 with GST); bonnet never billed (0).
// Final basis 23,600, bill-check basis 5,900 → salvage 1,600 rescales to 400.
function claim(billSalvage?: number): ClaimData {
  return {
    id: 'c1',
    assessmentRows: [
      row({ id: 'fender', particulars: 'Fender LH', assessed: 10000, billedTaxable: 5000 }),
      row({ id: 'bonnet', assessed: 10000, billStatus: 'not-in-bill', billedTaxable: 0 }),
    ],
    depreciationType: 'standard',
    reportNo: 'BC/2026/0417',
    reportDate: '2026-08-14',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: { insurerName: 'National Insurance Co. Ltd.', appointingOffice: 'DO-II Pune' },
    accident: { dateAndTime: '2026-06-24T10:00', workshopName: 'Sai Motors', dateOfSurvey: '2026-06-28' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 1600, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0, billSalvage },
    billCheck: { billNo: 'SM/INV/2026/1188', billDate: '2026-08-09', billTotal: 5900 },
  } as unknown as ClaimData;
}

describe('salvage in the bill-check reports', () => {
  // The regression that matters most: a bill-check figure must never reach
  // the report already filed with the insurer.
  test('the Final Survey Report prints the salvage it was filed with', () => {
    const html = buildStandardFinalSurveyHTML(claim(750), profile, 'final');
    expect(html).toContain('₹ 1,600.00');
    expect(html).not.toContain('₹ 750.00');
  });

  test('the Final Survey Report ignores the rescaling too', () => {
    const html = buildStandardFinalSurveyHTML(claim(), profile, 'final');
    expect(html).toContain('₹ 1,600.00');
    expect(html).not.toContain('₹ 400.00');
  });

  test('the Standard Bill Check prints the rescaled figure', () => {
    const html = buildStandardFinalSurveyHTML(claim(), profile, 'bill-check');
    expect(html).toContain('₹ 400.00');
    expect(html).not.toContain('₹ 1,600.00');
  });

  test('the Standard Bill Check prints a typed figure as typed', () => {
    const html = buildStandardFinalSurveyHTML(claim(750), profile, 'bill-check');
    expect(html).toContain('₹ 750.00');
  });

  test('the UIIC Bill Check prints the rescaled figure', () => {
    const html = buildUIICBillCheckHTML(claim(), null);
    expect(html).toContain('400.00');
    expect(html).not.toContain('1,600.00');
  });

  test('the UIIC Bill Check prints a typed figure as typed', () => {
    const html = buildUIICBillCheckHTML(claim(750), null);
    expect(html).toContain('750.00');
  });
});
