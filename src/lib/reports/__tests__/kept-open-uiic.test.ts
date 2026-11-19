import { describe, expect, test } from 'vitest';
import { buildUIICBillCheckHTML, buildUIICFinalHTML } from '../uiic-final-builder';
import { calculateAssessmentSummary, getVehicleAgeMonths, keptOpenTotal } from '@/lib/calculations';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(o: Partial<AssessmentRow>): AssessmentRow {
  return {
    id: `r${Math.random()}`, particulars: 'Item', estimated: 10000, assessed: 10000,
    partType: 'metal', gst: 18, section: 'parts', allowed: true, isDisposal: false,
    disposalPercent: 50, ...o,
  } as AssessmentRow;
}
const normal = row({ particulars: 'Bumper', assessed: 8000 });
const ko = row({ particulars: 'Kept Door', estimated: 5000, assessed: 0, allowed: false, keptOpen: true });

function mk(rows: AssessmentRow[], tl: boolean): ClaimData {
  return {
    id: 'c1', assessmentRows: rows, depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: { idv: '500000' }, accident: { dateAndTime: '2026-08-05T10:00' }, driver: {}, spotDetails: {}, reinspection: {},
    feeBill: { salvageValue: 100, billSalvage: 100, compulsoryExcess: 1000, voluntaryExcess: 500, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 11800 },
    isTotalLoss: tl,
    totalLossDetails: tl ? { salvageWithRC: 1000, salvageWithoutRC: 2000, towingExpenses: 0, workshopRent: 0, remarks: '' } : undefined,
  } as unknown as ClaimData;
}
const plain = (h: string) => h.replace(/,/g, '');
const age = getVehicleAgeMonths('2024-08-05', 2024, '2026-08-05T10:00');

describe('UIIC K.O.', () => {
  test('K.O. row reads Kept Open, not Not Allowed', () => {
    const h = buildUIICFinalHTML(mk([normal, ko], false), null);
    expect(h).toContain('Kept Open');
    expect(h).not.toContain('Not Allowed');
  });
  test('comparison table sits after DETAILS OF ASSESSMENT and before GST SUMMARY', () => {
    const h = buildUIICFinalHTML(mk([normal], true), null);
    const a = h.indexOf('DETAILS OF ASSESSMENT');
    const t = h.indexOf('Assessed repair cost (incl. GST)');
    const g = h.indexOf('GST SUMMARY');
    expect(a).toBeGreaterThan(-1);
    expect(t).toBeGreaterThan(a);
    expect(g).toBeGreaterThan(t);
  });
  test('no comparison table when not total loss', () => {
    expect(buildUIICFinalHTML(mk([normal], false), null)).not.toContain('Assessed repair cost (incl. GST)');
  });
  test('Repair Basis NET = Net Assessment + K.O. total', () => {
    const rows = [normal, ko];
    const net = calculateAssessmentSummary(rows, age, 'standard', 100, 1000, 500).netAssessedLoss;
    expect(plain(buildUIICFinalHTML(mk(rows, true), null))).toContain(`₹ ${(net + keptOpenTotal(rows)).toFixed(2)}`);
  });
  test('Bill Check old TL claim: no K.O./Missing rows, build-up present', () => {
    const h = buildUIICBillCheckHTML(mk([normal], true), null);
    expect(h).not.toContain('K.O.');
    expect(h).not.toContain('Missing items');
    expect(h).toContain('Assessed repair cost (incl. GST)');
  });
});
