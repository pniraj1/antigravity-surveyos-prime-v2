import { describe, expect, test } from 'vitest';
import { buildUIICBillCheckHTML, buildUIICFinalHTML } from '../uiic-final-builder';
import { calculateBillCheckSummary, getVehicleAgeMonths } from '@/lib/calculations';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Item',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 11800 },
  } as unknown as ClaimData;
}

describe('Bill Check report', () => {
  test('prints the same liability the screen shows', () => {
    // The regression guard. Screen and PDF disagreed because the screen
    // depreciated the billed amount and the PDF did not.
    const rows = [
      row({ billedTaxable: 10000, billedAmount: 11800, billStatus: 'in-bill' }),
      row({ section: 'labour', partType: 'labour', assessed: 5000, billedTaxable: 5000, billStatus: 'in-bill' }),
    ];
    const c = claim(rows);
    const ageMonths = getVehicleAgeMonths('2024-08-05', 2024, '2026-08-05T10:00');
    const summary = calculateBillCheckSummary(rows, ageMonths, 'standard', 0, 0, 0);

    const html = buildUIICBillCheckHTML(c, null);
    // The report formats with fa() — two decimals, no thousands separator.
    expect(html).toContain(summary.netLiability.toFixed(2));
    expect(summary.netLiability.toFixed(2)).toBe('16520.00'); // 10620 + 5900
  });

  test('omits disallowed items — they are not insurer liability', () => {
    const html = buildUIICBillCheckHTML(
      claim([row({ particulars: 'CoolantTopUp', allowed: false, billedTaxable: 1200, billStatus: 'not-allowed' })]),
      null
    );
    expect(html).not.toContain('CoolantTopUp');
  });

  test('keeps the serial gap where an item was disallowed', () => {
    const rows = [
      row({ id: 'p1', particulars: 'BumperFront' }),
      row({ id: 'p2', particulars: 'GrilleUpper', allowed: false }),
      row({ id: 'p3', particulars: 'HeadlampLH' }),
    ];
    const html = buildUIICBillCheckHTML(claim(rows), null);
    const headlampRow = html.split('HeadlampLH')[0].split('<tr>').pop() ?? '';
    expect(headlampRow).toContain('>3<');
  });

  test('Final Report lists disallowed paint instead of dropping it', () => {
    const rows = [
      row({ section: 'paint', partType: 'paint', particulars: 'BuffingPanel' }),
      row({ section: 'paint', partType: 'paint', particulars: 'DentingRear', allowed: false }),
    ];
    const html = buildUIICFinalHTML(claim(rows), null);
    expect(html).toContain('DentingRear');
    expect(html).toContain('Not');
  });
});
