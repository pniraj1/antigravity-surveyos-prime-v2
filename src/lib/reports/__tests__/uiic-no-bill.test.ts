import { describe, expect, test } from 'vitest';
import { buildUIICBillCheckHTML } from '../uiic-final-builder';
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
  } as AssessmentRow;
}

function claim(rows: AssessmentRow[]): ClaimData {
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
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 0 },
  } as unknown as ClaimData;
}

describe('UIIC Bill Check — not-in-bill rows', () => {
  test('the row says No Bill', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ particulars: 'GRILLE', assessed: 3400, billStatus: 'not-in-bill' }),
    ]), null);
    expect(html).toContain('GRILLE');
    expect(html).toContain('No Bill');
  });

  // The older defect: the item table claimed the row while page 1 excluded it.
  test('the item table no longer claims money page 1 excludes', () => {
    const rows = [
      row({ particulars: 'BILLED', assessed: 10000 }),
      row({ particulars: 'GRILLE', assessed: 3400, billStatus: 'not-in-bill' }),
    ];
    const html = buildUIICBillCheckHTML(claim(rows), null);
    // Nil depreciation, 18% GST: only the billed row carries money — 11,800.00
    expect(html).toContain('11800.00');
    // 3400 x 1.18 = 4012.00 must appear nowhere; the grille is not claimed
    expect(html).not.toContain('4012.00');
  });

  test('the summary engine already excluded it, and still does', () => {
    const rows = [
      row({ particulars: 'BILLED', assessed: 10000 }),
      row({ particulars: 'GRILLE', assessed: 3400, billStatus: 'not-in-bill' }),
    ];
    const age = getVehicleAgeMonths('2024-08-05', 2024, '2026-08-05T10:00');
    const s = calculateBillCheckSummary(rows, age, 'nil', 0, 0, 0);
    expect(s.grandTotalBilled).toBe(11800);
    expect(s.notInBillTotal).toBe(3400);
  });
});
