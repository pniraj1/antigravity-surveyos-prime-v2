import { describe, expect, test } from 'vitest';
import { buildUIICBillCheckHTML } from '../uiic-final-builder';
import { buildStandardBillCheckHTML, buildStandardFinalHTML } from '../standard-report-builder';
import { calculateAssessmentSummary, calculateBillCheckSummary, getVehicleAgeMonths } from '@/lib/calculations';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

// Awkward paise on purpose: mixed GST, depreciation, a part-billed row, a row
// not in the bill. If any screen or report rounds, one of these figures moves.
function row(o: Partial<AssessmentRow>): AssessmentRow {
  return {
    id: `r${Math.random()}`, particulars: 'Item', estimated: 10000, assessed: 10000,
    partType: 'metal', gst: 18, section: 'parts', allowed: true, isDisposal: false,
    disposalPercent: 50, ...o,
  } as AssessmentRow;
}

const rows = [
  row({ assessed: 18345.67, estimated: 19000.5, billedTaxable: 18345.67, billStatus: 'in-bill' }),
  row({ assessed: 4321.09, partType: 'plastic', gst: 28, billedTaxable: 4100.33, billStatus: 'in-bill' }),
  row({ assessed: 2210.45, partType: 'glass', gst: 28, billedTaxable: 2210.45, billStatus: 'in-bill' }),
  row({ section: 'labour', partType: 'labour', assessed: 3333.33, gst: 18, billedTaxable: 3333.33, billStatus: 'in-bill' }),
  row({ section: 'paint', partType: 'labour', assessed: 7777.77, gst: 18, billedTaxable: 7777.77, billStatus: 'in-bill' }),
  row({ assessed: 999.99, billStatus: 'not-in-bill', billedTaxable: 0 }),
];

const claim = {
  id: 'c1', assessmentRows: rows, depreciationType: 'standard',
  vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
  policy: {}, accident: { dateAndTime: '2026-08-05T10:00' }, driver: {}, spotDetails: {}, reinspection: {},
  feeBill: { salvageValue: 1234.56, billSalvage: 1234.56, compulsoryExcess: 1000, voluntaryExcess: 500.5, travelExpenses: 0 },
  billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 11800 },
} as unknown as ClaimData;

const age = getVehicleAgeMonths('2024-08-05', 2024, '2026-08-05T10:00');
const plain = (html: string) => html.replace(/,/g, '');

describe('one net liability, everywhere', () => {
  const tab = calculateBillCheckSummary(rows, age, 'standard', 1234.56, 1000, 500.5).netLiability;
  const net = tab.toFixed(2);

  test('the figure is not a whole rupee (the test would prove nothing otherwise)', () => {
    expect(Number.isInteger(tab)).toBe(false);
  });

  test('UIIC bill check prints the tab figure', () => {
    expect(plain(buildUIICBillCheckHTML(claim, null))).toContain(net);
  });

  test('Standard bill check prints the tab figure', () => {
    expect(plain(buildStandardBillCheckHTML(claim, null))).toContain(net);
  });

  test('Standard final report prints the Assessment tab figure', () => {
    const fin = calculateAssessmentSummary(rows, age, 'standard', 1234.56, 1000, 500.5).netAssessedLoss;
    expect(plain(buildStandardFinalHTML(claim, null))).toContain(fin.toFixed(2));
  });
});
