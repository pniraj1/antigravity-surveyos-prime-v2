import { describe, expect, test } from 'vitest';
import { buildUIICFinalHTML, buildUIICBillCheckHTML } from '../uiic-final-builder';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Windshield Glass',
    estimated: 5000,
    assessed: 5000,
    partType: 'glass',
    gst: 0,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 0,
    ...overrides,
  } as AssessmentRow;
}

function makeClaim(feeBillOverrides: Record<string, unknown> = {}, rows: AssessmentRow[] = [row()]): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'nil',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: {
      travelExpenses: 1500,
      towingCharges: 1000,
      salvageValue: 0,
      compulsoryExcess: 0,
      voluntaryExcess: 0,
      ...feeBillOverrides,
    },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 5000 },
  } as unknown as ClaimData;
}

describe('UIIC Report Builder — Towing Charges Mapping', () => {
  describe('buildUIICFinalHTML', () => {
    test('renders feeBill.towingCharges (1000.00) in Towing Charges cell, not travelExpenses (1500.00)', () => {
      const claim = makeClaim({
        travelExpenses: 1500,
        towingCharges: 1000,
        salvageValue: 0,
        compulsoryExcess: 0,
        voluntaryExcess: 0,
      });
      const html = buildUIICFinalHTML(claim, null);

      expect(html).toMatch(/Towing Charges<\/td><td style="[^"]*text-align:right;">1000\.00<\/td>/);
      expect(html).not.toMatch(/Towing Charges<\/td><td style="[^"]*text-align:right;">1500\.00<\/td>/);

      // Gross Assessment = 5000 (parts) + 1000 (towing) = 6000.00 (not 6500.00)
      expect(html).toMatch(/Gross Assessment<\/td><td style="[^"]*text-align:right;">6000\.00<\/td>/);
      expect(html).not.toMatch(/Gross Assessment<\/td><td style="[^"]*text-align:right;">6500\.00<\/td>/);

      // Assessed Loss = 6000.00 (not 6500.00)
      expect(html).toMatch(/Assessed Loss<\/td><td style="[^"]*text-align:right;[^"]*">6000\.00<\/td>/);
      expect(html).not.toMatch(/Assessed Loss<\/td><td style="[^"]*text-align:right;[^"]*">6500\.00<\/td>/);
    });

    test('when towingCharges is 0 and travelExpenses is 1500, renders 0.00 and excludes travelExpenses from Assessed Loss', () => {
      const claim = makeClaim({
        travelExpenses: 1500,
        towingCharges: 0,
        salvageValue: 0,
        compulsoryExcess: 0,
        voluntaryExcess: 0,
      });
      const html = buildUIICFinalHTML(claim, null);

      expect(html).toMatch(/Towing Charges<\/td><td style="[^"]*text-align:right;">0\.00<\/td>/);
      expect(html).not.toMatch(/Towing Charges<\/td><td style="[^"]*text-align:right;">1500\.00<\/td>/);

      expect(html).toMatch(/Assessed Loss<\/td><td style="[^"]*text-align:right;[^"]*">5000\.00<\/td>/);
      expect(html).not.toMatch(/Assessed Loss<\/td><td style="[^"]*text-align:right;[^"]*">6500\.00<\/td>/);
    });

    test('when towingCharges is undefined and travelExpenses is 1500, renders 0.00 and excludes travelExpenses from Assessed Loss', () => {
      const claim = makeClaim({
        travelExpenses: 1500,
        towingCharges: undefined,
        salvageValue: 0,
        compulsoryExcess: 0,
        voluntaryExcess: 0,
      });
      const html = buildUIICFinalHTML(claim, null);

      expect(html).toMatch(/Towing Charges<\/td><td style="[^"]*text-align:right;">0\.00<\/td>/);
      expect(html).not.toMatch(/Towing Charges<\/td><td style="[^"]*text-align:right;">1500\.00<\/td>/);

      expect(html).toMatch(/Assessed Loss<\/td><td style="[^"]*text-align:right;[^"]*">5000\.00<\/td>/);
      expect(html).not.toMatch(/Assessed Loss<\/td><td style="[^"]*text-align:right;[^"]*">6500\.00<\/td>/);
    });
  });

  describe('buildUIICBillCheckHTML', () => {
    test('renders feeBill.towingCharges (1000.00) in Towing Charges cell, not travelExpenses (1500.00)', () => {
      const claim = makeClaim({
        travelExpenses: 1500,
        towingCharges: 1000,
        salvageValue: 0,
        compulsoryExcess: 0,
        voluntaryExcess: 0,
      });
      const html = buildUIICBillCheckHTML(claim, null);

      expect(html).toMatch(/Towing Charges<\/td><td style="[^"]*text-align:right;">1000\.00<\/td>/);
      expect(html).not.toMatch(/Towing Charges<\/td><td style="[^"]*text-align:right;">1500\.00<\/td>/);

      // Gross Assessment = 5000 (parts) + 1000 (towing) = 6000.00 (not 6500.00)
      expect(html).toMatch(/Gross Assessment<\/td><td style="[^"]*text-align:right;">6000\.00<\/td>/);
      expect(html).not.toMatch(/Gross Assessment<\/td><td style="[^"]*text-align:right;">6500\.00<\/td>/);

      // Assessed Loss = 6000.00 (not 6500.00)
      expect(html).toMatch(/Assessed Loss<\/td><td style="[^"]*text-align:right;[^"]*">6000\.00<\/td>/);
      expect(html).not.toMatch(/Assessed Loss<\/td><td style="[^"]*text-align:right;[^"]*">6500\.00<\/td>/);
    });

    test('when towingCharges is 0 and travelExpenses is 1500, renders 0.00 and excludes travelExpenses from Assessed Loss', () => {
      const claim = makeClaim({
        travelExpenses: 1500,
        towingCharges: 0,
        salvageValue: 0,
        compulsoryExcess: 0,
        voluntaryExcess: 0,
      });
      const html = buildUIICBillCheckHTML(claim, null);

      expect(html).toMatch(/Towing Charges<\/td><td style="[^"]*text-align:right;">0\.00<\/td>/);
      expect(html).not.toMatch(/Towing Charges<\/td><td style="[^"]*text-align:right;">1500\.00<\/td>/);

      expect(html).toMatch(/Assessed Loss<\/td><td style="[^"]*text-align:right;[^"]*">5000\.00<\/td>/);
      expect(html).not.toMatch(/Assessed Loss<\/td><td style="[^"]*text-align:right;[^"]*">6500\.00<\/td>/);
    });

    test('when towingCharges is undefined and travelExpenses is 1500, renders 0.00 and excludes travelExpenses from Assessed Loss', () => {
      const claim = makeClaim({
        travelExpenses: 1500,
        towingCharges: undefined,
        salvageValue: 0,
        compulsoryExcess: 0,
        voluntaryExcess: 0,
      });
      const html = buildUIICBillCheckHTML(claim, null);

      expect(html).toMatch(/Towing Charges<\/td><td style="[^"]*text-align:right;">0\.00<\/td>/);
      expect(html).not.toMatch(/Towing Charges<\/td><td style="[^"]*text-align:right;">1500\.00<\/td>/);

      expect(html).toMatch(/Assessed Loss<\/td><td style="[^"]*text-align:right;[^"]*">5000\.00<\/td>/);
      expect(html).not.toMatch(/Assessed Loss<\/td><td style="[^"]*text-align:right;[^"]*">6500\.00<\/td>/);
    });
  });
});
