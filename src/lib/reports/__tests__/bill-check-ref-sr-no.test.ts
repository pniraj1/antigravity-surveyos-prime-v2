import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import { buildUIICBillCheckHTML, buildUIICFinalHTML } from '../uiic-final-builder';
import type { ClaimData, SurveyorProfile } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function makeRow(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r_${Math.random()}`,
    particulars: 'Front Bumper',
    estimated: 8000,
    assessed: 8000,
    partType: 'plastic',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    ...overrides,
  } as AssessmentRow;
}

function makeClaim(rows: AssessmentRow[], billCheckOverrides: Partial<ClaimData['billCheck']> = {}): ClaimData {
  return {
    id: 'claim_ref_test',
    assessmentRows: rows,
    depreciationType: 'standard',
    reportNo: 'BC/2026/999',
    reportDate: '2026-10-27',
    vehicle: { registrationNumber: 'KA01MJ4321', dateOfRegistration: '2025-01-01', yearOfManufacture: 2025 },
    policy: { insurerName: 'United India Insurance Co. Ltd.', claimNumber: 'CLM123', policyNumber: 'POL456', insuredName: 'Rahul Sharma', idv: '500000' },
    accident: { dateAndTime: '2026-10-01T10:00', workshopName: 'Apex Auto', dateOfSurvey: '2026-10-05' },
    driver: { name: 'Rahul Sharma' },
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 1000, voluntaryExcess: 0 },
    billCheck: {
      billNo: 'INV-888',
      billDate: '2026-10-20',
      billTotal: 25000,
      ...billCheckOverrides,
    },
  } as unknown as ClaimData;
}

const profile = { name: 'TEST SURVEYOR' } as SurveyorProfile;

describe('Bill Check Reference Serial Number Column', () => {
  describe('Standard Bill Check Report', () => {
    test('renders default "Bill No." header in bill-check mode when baseDocument is estimate', () => {
      const claim = makeClaim([makeRow({ refSrNo: 12 })]);
      const html = buildStandardFinalSurveyHTML(claim, profile, 'bill-check');
      expect(html).toContain('Bill No.');
      expect(html).toContain('>12</td>');
      expect(html).toMatch(/color:#d32f2f;font-style:italic;font-weight:600;[^"]*">12<\/td>/);
    });

    test('renders default "Est. No." header when baseDocument is final-bill', () => {
      const claim = makeClaim([makeRow({ refSrNo: 7 })], { baseDocument: 'final-bill' });
      const html = buildStandardFinalSurveyHTML(claim, profile, 'bill-check');
      expect(html).toContain('Est. No.');
      expect(html).toContain('>7</td>');
    });

    test('renders custom editable column title when specified', () => {
      const claim = makeClaim([makeRow({ refSrNo: 'B-42' })], { refColumnTitle: 'Custom Ref #' });
      const html = buildStandardFinalSurveyHTML(claim, profile, 'bill-check');
      expect(html).toContain('Custom Ref #');
      expect(html).toContain('>B-42</td>');
    });

    test('renders dash fallback when refSrNo is missing', () => {
      const claim = makeClaim([makeRow({ refSrNo: undefined })]);
      const html = buildStandardFinalSurveyHTML(claim, profile, 'bill-check');
      expect(html).toMatch(/color:#d32f2f;font-style:italic;font-weight:600;[^"]*">—<\/td>/);
    });

    test('does not render reference serial number column in final report mode', () => {
      const claim = makeClaim([makeRow({ refSrNo: 12 })]);
      const html = buildStandardFinalSurveyHTML(claim, profile, 'final');
      expect(html).not.toContain('Bill No.');
      expect(html).not.toContain('Est. No.');
      expect(html).not.toMatch(/color:#d32f2f;font-style:italic;font-weight:600;/);
    });
  });

  describe('UIIC Bill Check Report', () => {
    test('renders default "Bill No." header and 13th cell in UIIC bill check report', () => {
      const partsRow = makeRow({ section: 'parts', refSrNo: 5 });
      const labourRow = makeRow({ section: 'labour', particulars: 'Bumper R&R', refSrNo: 6 });
      const paintRow = makeRow({ section: 'paint', particulars: 'Bumper Painting', refSrNo: 7 });

      const claim = makeClaim([partsRow, labourRow, paintRow]);
      const html = buildUIICBillCheckHTML(claim, profile);

      expect(html).toContain('UIIC BILL CHECK REPORT');
      expect(html).toContain('Bill No.');
      // Each section's row renders refSrNo in red italic
      expect(html).toMatch(/color:#d32f2f;font-style:italic;font-weight:600;">5<\/td>/);
      expect(html).toMatch(/color:#d32f2f;font-style:italic;font-weight:600;">6<\/td>/);
      expect(html).toMatch(/color:#d32f2f;font-style:italic;font-weight:600;">7<\/td>/);
    });

    test('renders "Est. No." when UIIC bill check has baseDocument final-bill', () => {
      const claim = makeClaim([makeRow({ refSrNo: 3 })], { baseDocument: 'final-bill' });
      const html = buildUIICBillCheckHTML(claim, profile);
      expect(html).toContain('Est. No.');
      expect(html).toMatch(/color:#d32f2f;font-style:italic;font-weight:600;">3<\/td>/);
    });

    test('renders custom editable title in UIIC bill check header', () => {
      const claim = makeClaim([makeRow({ refSrNo: 'INV/09' })], { refColumnTitle: 'Workshop Sr.' });
      const html = buildUIICBillCheckHTML(claim, profile);
      expect(html).toContain('Workshop Sr.');
      expect(html).toMatch(/color:#d32f2f;font-style:italic;font-weight:600;">INV\/09<\/td>/);
    });

    test('renders dash fallback when refSrNo is not set on row in UIIC bill check', () => {
      const claim = makeClaim([makeRow({ refSrNo: undefined })]);
      const html = buildUIICBillCheckHTML(claim, profile);
      expect(html).toMatch(/color:#d32f2f;font-style:italic;font-weight:600;">—<\/td>/);
    });

    test('UIIC final report does not render the reference column', () => {
      const claim = makeClaim([makeRow({ refSrNo: 5 })]);
      const html = buildUIICFinalHTML(claim, profile);
      expect(html).not.toContain('Bill No.');
      expect(html).not.toContain('Est. No.');
      expect(html).not.toMatch(/color:#d32f2f;font-style:italic;font-weight:600;/);
    });
  });
});

