import { describe, expect, test } from 'vitest';
import { buildStandardBillCheckHTML, buildStandardFinalHTML } from '../standard-report-builder';
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

const ko = row({ particulars: 'Kept Door', estimated: 5000, assessed: 0, allowed: false, keptOpen: true });
const normal = row({ particulars: 'Bumper', assessed: 8000 });
const na = row({ particulars: 'Rejected Lamp', assessed: 0, allowed: false });

function mk(rows: AssessmentRow[], tl = true, missing = false): ClaimData {
  return {
    id: 'c1', assessmentRows: rows, depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: { idv: '500000' }, accident: { dateAndTime: '2026-08-05T10:00' }, driver: {}, spotDetails: {}, reinspection: {},
    feeBill: { salvageValue: 100, billSalvage: 100, compulsoryExcess: 1000, voluntaryExcess: 500, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 11800 },
    isTotalLoss: tl,
    totalLossDetails: tl ? { salvageWithRC: 1000, salvageWithoutRC: 2000, towingExpenses: 0, workshopRent: 0, remarks: '',
      ...(missing ? { missingItems: [{ id: 'm', description: 'Battery', amount: 7000 }] } : {}) } : undefined,
  } as unknown as ClaimData;
}
const plain = (h: string) => h.replace(/,/g, '');
const age = getVehicleAgeMonths('2024-08-05', 2024, '2026-08-05T10:00');

describe('standard report K.O.', () => {
  test('old TL claim: no K.O./Missing, has Assessed repair cost row', () => {
    const h = buildStandardFinalHTML(mk([normal, na]), null);
    expect(h).not.toContain('K.O.');
    expect(h).not.toContain('Missing items');
    expect(h).toContain('Assessed repair cost (incl. GST)');
  });
  test('K.O. row prints KEPT OPEN, not NOT ALLOWED', () => {
    const h = buildStandardFinalHTML(mk([normal, ko], false), null);
    expect(h).toContain('KEPT OPEN');
    expect(h).not.toContain('NOT ALLOWED');
  });
  test('section 8 K.O. line only with K.O. row', () => {
    const withKo = plain(buildStandardFinalHTML(mk([normal, ko], false), null));
    expect(withKo).toContain('K.O. parts (as per estimate incl. GST)');
    expect(withKo).toContain(keptOpenTotal([ko]).toFixed(2));
    expect(buildStandardFinalHTML(mk([normal], false), null)).not.toContain('K.O. parts');
  });
  test('Repair Basis NET = NET ASSESSED LOSS + K.O. total', () => {
    const rows = [normal, ko];
    const net = calculateAssessmentSummary(rows, age, 'standard', 100, 1000, 500).netAssessedLoss;
    const h = plain(buildStandardFinalHTML(mk(rows), null));
    expect(h).toContain(`₹ ${(net + keptOpenTotal(rows)).toFixed(2)}`);
  });
  test('missing items print only in TL columns', () => {
    const h = buildStandardFinalHTML(mk([normal], true, true), null);
    expect(h).toContain('Less: Missing items');
  });
  test('bill check: same renderer, no K.O. row', () => {
    const h = buildStandardBillCheckHTML(mk([normal, ko]), null);
    expect(h).toContain('Assessed repair cost (incl. GST)');
    expect(h).not.toContain('Add: K.O. parts');
  });
});
