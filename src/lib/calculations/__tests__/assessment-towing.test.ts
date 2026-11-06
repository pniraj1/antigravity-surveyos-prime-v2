import { describe, it, expect } from 'vitest';
import { calculateAssessmentSummary, calculateBillCheckSummary } from '../assessment';
import { createBlankClaim } from '@/types/claim';
import type { AssessmentRow } from '@/types/assessment';

function makeRow(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r-${Math.random()}`,
    particulars: 'Test Item',
    estimated: 10000,
    assessed: 10000,
    partType: 'glass',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

describe('Assessment Towing Charges', () => {
  it('incorporates towing charges into netAssessedLoss', () => {
    const summary = calculateAssessmentSummary([], 0, 'standard', 0, 0, 0, undefined, 1500);
    expect(summary.towingCharges).toBe(1500);
    expect(summary.netAssessedLoss).toBe(1500);
  });

  it('defaults towing charges to 0 in calculateAssessmentSummary', () => {
    const summary = calculateAssessmentSummary([], 0, 'standard', 0, 0, 0);
    expect(summary.towingCharges).toBe(0);
    expect(summary.netAssessedLoss).toBe(0);
  });

  it('incorporates towing charges into netLiability in calculateBillCheckSummary', () => {
    const summary = calculateBillCheckSummary([], 0, 'standard', 0, 0, 0, undefined, 1200);
    expect(summary.towingCharges).toBe(1200);
    expect(summary.netLiability).toBe(1200);
  });

  it('initializes towingCharges to 0 in createBlankClaim feeBill', () => {
    const claim = createBlankClaim();
    expect(claim.feeBill.towingCharges).toBe(0);
  });

  describe('realistic claim with parts, labour, GST, salvage, and excess', () => {
    const rows: AssessmentRow[] = [
      makeRow({
        partType: 'glass',
        section: 'parts',
        assessed: 10000,
        gst: 18,
      }),
      makeRow({
        partType: 'labour',
        section: 'labour',
        assessed: 5000,
        gst: 18,
      }),
    ];

    it('correctly calculates netAssessedLoss including towing charges', () => {
      // Glass (0% dep) = 10000 + 1800 = 11800
      // Labour = 5000 + 900 = 5900
      // Grand Total = 17700
      // Salvage = 500, Compulsory Excess = 1000, Voluntary Excess = 200
      // Without towing: 17700 - 500 - 1200 = 16000
      // With towing 1500: 17700 + 1500 - 500 - 1200 = 17500
      const summaryWithTowing = calculateAssessmentSummary(
        rows, 0, 'standard', 500, 1000, 200, undefined, 1500
      );
      const summaryWithoutTowing = calculateAssessmentSummary(
        rows, 0, 'standard', 500, 1000, 200, undefined, 0
      );

      expect(summaryWithTowing.grandTotal).toBe(17700);
      expect(summaryWithTowing.towingCharges).toBe(1500);
      expect(summaryWithTowing.netAssessedLoss).toBe(17500);
      expect(summaryWithoutTowing.netAssessedLoss).toBe(16000);
      expect(summaryWithTowing.netAssessedLoss - summaryWithoutTowing.netAssessedLoss).toBe(1500);
    });

    it('reflects towing-adjusted net in netInWords', () => {
      const summaryWithTowing = calculateAssessmentSummary(
        rows, 0, 'standard', 500, 1000, 200, undefined, 1500
      );
      const summaryWithoutTowing = calculateAssessmentSummary(
        rows, 0, 'standard', 500, 1000, 200, undefined, 0
      );

      expect(summaryWithTowing.netInWords).toBe('RUPEES SEVENTEEN THOUSAND FIVE HUNDRED ONLY');
      expect(summaryWithoutTowing.netInWords).toBe('RUPEES SIXTEEN THOUSAND ONLY');
    });

    it('correctly calculates BillCheck netLiability and netInWords with towing charges', () => {
      const bcSummaryWithTowing = calculateBillCheckSummary(
        rows, 0, 'standard', 500, 1000, 200, undefined, 1500
      );
      expect(bcSummaryWithTowing.towingCharges).toBe(1500);
      expect(bcSummaryWithTowing.netLiability).toBe(17500);
      expect(bcSummaryWithTowing.netInWords).toBe('RUPEES SEVENTEEN THOUSAND FIVE HUNDRED ONLY');
    });
  });

  describe('clamping at zero', () => {
    const smallRow: AssessmentRow[] = [
      makeRow({
        partType: 'glass',
        section: 'parts',
        assessed: 1000,
        gst: 0,
      }),
    ];

    it('clamps netAssessedLoss at 0 when salvage and excess exceed grand total plus towing', () => {
      // grandTotal = 1000, towing = 500 -> sum = 1500
      // salvage = 1000, compulsoryExcess = 1000 -> deductions = 2000
      // 1500 - 2000 = -500 -> clamped to 0
      const summary = calculateAssessmentSummary(
        smallRow, 0, 'standard', 1000, 1000, 0, undefined, 500
      );
      expect(summary.grandTotal).toBe(1000);
      expect(summary.towingCharges).toBe(500);
      expect(summary.netAssessedLoss).toBe(0);
      expect(summary.netInWords).toBe('RUPEES ZERO ONLY');
    });

    it('clamps BillCheck netLiability at 0 when deductions exceed assessment plus towing', () => {
      const bcSummary = calculateBillCheckSummary(
        smallRow, 0, 'standard', 1000, 1000, 0, undefined, 500
      );
      expect(bcSummary.towingCharges).toBe(500);
      expect(bcSummary.netLiability).toBe(0);
      expect(bcSummary.netInWords).toBe('RUPEES ZERO ONLY');
    });
  });
});
