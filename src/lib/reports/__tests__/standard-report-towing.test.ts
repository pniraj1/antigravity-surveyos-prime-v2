import { describe, expect, test } from 'vitest';
import { buildStandardFinalHTML, buildStandardBillCheckHTML } from '../standard-report-builder';
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
    policy: { insurerName: 'National Insurance Co. Ltd.' },
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: { name: 'DR_NAME' },
    spotDetails: {},
    reinspection: {},
    feeBill: {
      travelExpenses: 1500,
      towingCharges: 1200,
      salvageValue: 500,
      compulsoryExcess: 500,
      voluntaryExcess: 0,
      ...feeBillOverrides,
    },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 5000 },
  } as unknown as ClaimData;
}

describe('Standard Report Builder — Towing Charges Mapping', () => {
  describe('buildStandardFinalHTML', () => {
    test('renders Add: Towing Charges in Section 8 summary table with 1,200.00, and NET ASSESSED LOSS includes towing', () => {
      const claim = makeClaim({
        towingCharges: 1200,
        salvageValue: 500,
        compulsoryExcess: 500,
        voluntaryExcess: 0,
      });
      const html = buildStandardFinalHTML(claim, null);

      // Section 8 summary table contains Add: Towing Charges
      expect(html).toContain('Add: Towing Charges');

      // The towing cell renders 1,200.00 (formatted with ₹ in standard report)
      expect(html).toMatch(/Add:\s*Towing Charges<\/td>\s*<td colspan="2"[^>]*><\/td>\s*<td[^>]*>₹?\s*1,200\.00<\/td>/);

      // NET ASSESSED LOSS: 5000 (grand) + 1200 (towing) - 500 (salvage) - 500 (excess) = 5200.00
      expect(html).toMatch(/NET ASSESSED LOSS<\/td>\s*<td colspan="2"[^>]*><\/td>\s*<td[^>]*>₹?\s*5,200\.00<\/td>/);

      // RUPEES in words reflects 5200.00
      expect(html).toContain('RUPEES FIVE THOUSAND TWO HUNDRED ONLY');
    });

    test('when feeBill.towingCharges is 0, renders 0.00 and NET ASSESSED LOSS equals grand - excess - salvage', () => {
      const claim = makeClaim({
        towingCharges: 0,
        salvageValue: 500,
        compulsoryExcess: 500,
        voluntaryExcess: 0,
      });
      const html = buildStandardFinalHTML(claim, null);

      expect(html).toContain('Add: Towing Charges');
      expect(html).toMatch(/Add:\s*Towing Charges<\/td>\s*<td colspan="2"[^>]*><\/td>\s*<td[^>]*>₹?\s*0\.00<\/td>/);

      // NET ASSESSED LOSS = 5000 - 500 - 500 = 4000.00
      expect(html).toMatch(/NET ASSESSED LOSS<\/td>\s*<td colspan="2"[^>]*><\/td>\s*<td[^>]*>₹?\s*4,000\.00<\/td>/);
      expect(html).toContain('RUPEES FOUR THOUSAND ONLY');
    });

    test('when feeBill.towingCharges is undefined, renders 0.00 and NET ASSESSED LOSS equals grand - excess - salvage', () => {
      const claim = makeClaim({
        towingCharges: undefined,
        salvageValue: 500,
        compulsoryExcess: 500,
        voluntaryExcess: 0,
      });
      const html = buildStandardFinalHTML(claim, null);

      expect(html).toContain('Add: Towing Charges');
      expect(html).toMatch(/Add:\s*Towing Charges<\/td>\s*<td colspan="2"[^>]*><\/td>\s*<td[^>]*>₹?\s*0\.00<\/td>/);

      // NET ASSESSED LOSS = 5000 - 500 - 500 = 4000.00
      expect(html).toMatch(/NET ASSESSED LOSS<\/td>\s*<td colspan="2"[^>]*><\/td>\s*<td[^>]*>₹?\s*4,000\.00<\/td>/);
      expect(html).toContain('RUPEES FOUR THOUSAND ONLY');
    });
  });

  describe('buildStandardBillCheckHTML', () => {
    test('renders Add: Towing Charges and NET LIABILITY includes towing when towingCharges > 0', () => {
      const claim = makeClaim({
        towingCharges: 1200,
        salvageValue: 500,
        compulsoryExcess: 500,
        voluntaryExcess: 0,
      });
      const html = buildStandardBillCheckHTML(claim, null);

      expect(html).toContain('Add: Towing Charges');
      expect(html).toMatch(/Add:\s*Towing Charges<\/td>\s*<td colspan="2"[^>]*><\/td>\s*<td[^>]*>₹?\s*1,200\.00<\/td>/);

      // NET LIABILITY = 5000 + 1200 - 500 - 500 = 5200.00
      expect(html).toMatch(/NET LIABILITY<\/td>\s*<td colspan="2"[^>]*><\/td>\s*<td[^>]*>₹?\s*5,200\.00<\/td>/);
      expect(html).toContain('RUPEES FIVE THOUSAND TWO HUNDRED ONLY');
    });
  });
});
