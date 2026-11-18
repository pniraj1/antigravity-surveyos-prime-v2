import { describe, expect, test } from 'vitest';
import { buildUIICBillCheckHTML } from '../uiic-final-builder';
import { buildStandardBillCheckHTML } from '../standard-report-builder';
import { fromBillSelfBillUpdates, selfBilled } from '../bill-check-mode';
import { statusOptions } from '@/components/tabs/bill-check/config';
import { notInDocUpdates } from '@/components/tabs/bill-check/StageAuditView';
import { calculateBillCheckSummary } from '@/lib/calculations';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(o: Partial<AssessmentRow>): AssessmentRow {
  return {
    id: `r${Math.random()}`, particulars: 'Item', estimated: 1000, assessed: 1000,
    partType: 'metal', gst: 18, section: 'parts', allowed: true, isDisposal: false,
    disposalPercent: 50, ...o,
  } as AssessmentRow;
}
const fromBillClaim = (rows: AssessmentRow[]) =>
  ({ assessmentRows: rows, billCheck: { baseDocument: 'final-bill' } }) as unknown as ClaimData;

describe('from-bill claims: status is against the estimate', () => {
  test('the column reads In / Not in Estimate, and keeps Bill wording otherwise', () => {
    expect(statusOptions(true).map((o) => o.label)).toEqual(['Pending', 'In Estimate ✓', 'Not in Estimate ✗']);
    expect(statusOptions(false).map((o) => o.label)).toEqual(['Pending', 'In Bill ✓', 'Not in Bill ✗']);
  });

  test('"Not in estimate" in reconciliation zeroes the billed figure', () => {
    expect(notInDocUpdates(true)).toEqual({
      refSrNo: 'Not in estimate', refStatus: 'manual',
      billStatus: 'not-in-bill', billedTaxable: 0, billedAmount: 0,
    });
  });

  test('self-billing no longer undoes a Not in Estimate row', () => {
    const skipped = row({ billStatus: 'not-in-bill', billedTaxable: 0, billedAmount: 0 });
    const fresh = row({ billStatus: 'pending' });
    const ids = fromBillSelfBillUpdates(fromBillClaim([skipped, fresh])).map((u) => u.id);
    expect(ids).toEqual([fresh.id]);
  });

  test('Not in Estimate carries no liability; the override (In Estimate) pays it', () => {
    const base = { ...notInDocUpdates(true) } as Partial<AssessmentRow>;
    const notIn = row(base);
    const paid = row({ ...base, ...selfBilled(notIn) });
    const net = (r: AssessmentRow) => calculateBillCheckSummary([r], 0, 'standard').netLiability;
    expect(net(notIn)).toBe(0);
    expect(net(paid)).toBe(1180);
  });
});

describe('a Not in Bill row carries no liability in every output', () => {
  const nets = (html: string) =>
    [...html.replace(/<[^>]+>/g, ' ').matchAll(/NET LIABILITY[^0-9]{0,80}([\d,]+\.\d\d)/gi)].map((m) => m[1].replace(/,/g, ''));
  const rows = [
    row({ billedTaxable: 1000, billStatus: 'in-bill' }),
    row({ billStatus: 'not-in-bill', billedTaxable: 0 }),
  ];
  const claim = {
    id: 'c', assessmentRows: rows, depreciationType: 'standard',
    vehicle: { registrationNumber: 'X', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: {}, accident: { dateAndTime: '2026-08-05T10:00' }, driver: {}, spotDetails: {}, reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B', billDate: '2026-08-01', billTotal: 1 },
  } as unknown as ClaimData;

  test('tab, UIIC and Standard bill check print the same net', () => {
    const tab = calculateBillCheckSummary(rows, 24, 'standard').netLiability.toFixed(2);
    expect(nets(buildUIICBillCheckHTML(claim, null))).toContain(tab);
    expect(nets(buildStandardBillCheckHTML(claim, null))).toContain(tab);
  });
});
