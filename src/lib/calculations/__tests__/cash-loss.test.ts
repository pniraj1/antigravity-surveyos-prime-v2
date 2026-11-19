import { describe, expect, test } from 'vitest';
import { cashLossBasis, cashLossHold } from '../cash-loss';
import { calculateAssessmentSummary, getCompulsoryExcess } from '../assessment';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(o: Partial<AssessmentRow>): AssessmentRow {
  return {
    id: `r${Math.random()}`, particulars: 'Item', estimated: 100000, assessed: 10000,
    partType: 'metal', gst: 18, section: 'parts', allowed: true, isDisposal: false,
    disposalPercent: 50, depOverride: 0, ...o,
  } as AssessmentRow;
}

function claimOf(rows: AssessmentRow[], cashLoss: ClaimData['cashLoss'] = { enabled: true, notionalPercent: 30 }, fee = {}): ClaimData {
  return {
    id: 'c1', assessmentRows: rows, depreciationType: 'standard', cashLoss,
    vehicle: {}, policy: {}, accident: {}, driver: {}, spotDetails: {}, reinspection: {},
    feeBill: { salvageValue: 7085, compulsoryExcess: 1000, voluntaryExcess: 0, ...fee },
  } as unknown as ClaimData;
}

const sampleRows = [
  row({ section: 'labour', partType: 'labour', assessed: 36750 }),
  row({ assessed: 68960.5 }),
  row({ assessed: 4775, partType: 'plastic' }),
  row({ assessed: 1600, partType: 'glass' }),
];

describe('cashLossBasis', () => {
  test('sample: gross 105000.50, notional 31500.15, net 72500.35', () => {
    const b = cashLossBasis(claimOf(sampleRows), 0)!;
    expect(b.gross).toBeCloseTo(105000.5, 2);
    expect(b.notional).toBeCloseTo(31500.15, 2);
    expect(b.excess).toBe(1000);
    expect(b.net).toBeCloseTo(72500.35, 2);
    expect(b.labour).toBeCloseTo(36750, 2);
    expect(b.parts.metal).toBeCloseTo(68960.5, 2);
    expect(b.parts.fiberglass).toBe(0);
  });

  test('IMT-23 row: gross equals section 8 assessed grand + towing - salvage', () => {
    const rows = [...sampleRows, row({ assessed: 9000, imt23: true, depOverride: 10 })];
    const claim = claimOf(rows, undefined, { towingCharges: 2500 });
    const b = cashLossBasis(claim, 0)!;
    const s = calculateAssessmentSummary(rows, 0, 'standard', 7085, 1000, 0, claim, 2500);
    expect(b.gross).toBeCloseTo(s.partsBase + s.labourBase + 2500 - 7085, 2);
  });

  test('not-allowed and keptOpen rows are excluded', () => {
    const rows = [...sampleRows, row({ assessed: 5000, allowed: false }), row({ assessed: 6000, allowed: false, keptOpen: true })];
    expect(cashLossBasis(claimOf(rows), 0)!.gross).toBeCloseTo(105000.5, 2);
  });

  test('null when cash loss undefined or disabled', () => {
    expect(cashLossBasis(claimOf(sampleRows, { enabled: false, notionalPercent: 30 }), 0)).toBeNull();
    const c = claimOf(sampleRows); delete (c as { cashLoss?: unknown }).cashLoss;
    expect(cashLossBasis(c, 0)).toBeNull();
  });

  test('percent null -> notional 0, no NaN', () => {
    const b = cashLossBasis(claimOf(sampleRows, { enabled: true, notionalPercent: null }), 0)!;
    expect(b.notional).toBe(0);
    expect(b.net).toBeCloseTo(105000.5 - 1000, 2);
    expect(Object.values(b).every((v) => v === null || typeof v === 'object' || !Number.isNaN(v))).toBe(true);
  });

  test('uses getCompulsoryExcess + voluntary', () => {
    const c = claimOf(sampleRows, undefined, { compulsoryExcess: undefined, lessExcess: 400, voluntaryExcess: 100 });
    expect(cashLossBasis(c, 0)!.excess).toBe(getCompulsoryExcess(c.feeBill) + 100);
  });
});

describe('cashLossHold', () => {
  test('null percent -> message', () => {
    expect(cashLossHold(claimOf(sampleRows, { enabled: true, notionalPercent: null }))).toEqual(['Enter the notional deduction % for cash loss']);
  });
  test('120 -> message', () => {
    expect(cashLossHold(claimOf(sampleRows, { enabled: true, notionalPercent: 120 }))).toHaveLength(1);
  });
  test('K.O. row lists particulars', () => {
    const rows = [...sampleRows, row({ particulars: 'Bumper', allowed: false, keptOpen: true }), row({ particulars: 'Hood', allowed: false, keptOpen: true })];
    expect(cashLossHold(claimOf(rows))).toEqual(['Decide these as allowed or not allowed: Bumper, Hood']);
  });
  test('valid -> []', () => {
    expect(cashLossHold(claimOf(sampleRows))).toEqual([]);
  });
  test('cash loss off -> []', () => {
    expect(cashLossHold(claimOf(sampleRows, { enabled: false, notionalPercent: null }))).toEqual([]);
  });
});
