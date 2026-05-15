import { describe, test, expect } from 'vitest';
import { computeInsuredFinancialSummary } from '../insured-report';
import type { ClaimData } from '@/types/claim';

const mockClaim = {
  feeBill: { compulsoryExcess: 1000, voluntaryExcess: 0, salvageValue: 0, billTotal: 0 },
  billCheck: { billTotal: 0 },
  assessmentRows: [
    {
      id: 'r1', section: 'parts', particulars: 'Bonnet',
      estimated: 8000, assessed: 5600, billedTaxable: 8000,
      gst: 18, allowed: true, action: 'allow', isDisposal: false,
    },
    {
      id: 'r2', section: 'parts', particulars: 'Headlamp RH',
      estimated: 3000, assessed: 2100, billedTaxable: 3000,
      gst: 18, allowed: true, action: 'allow', isDisposal: false,
    },
    {
      id: 'r3', section: 'labour', particulars: 'Denting',
      estimated: 5000, assessed: 5000, billedTaxable: 5000,
      gst: 18, allowed: true, action: 'allow', isDisposal: false,
    },
  ],
  depreciationType: 'standard',
  vehicle: { dateOfRegistration: null, yearOfManufacture: null },
  accident: { dateAndTime: null },
  policy: {},
} as unknown as ClaimData;

describe('computeInsuredFinancialSummary', () => {
  test('depreciationBreakdown contains only parts rows with a reduction', () => {
    const summary = computeInsuredFinancialSummary(mockClaim, 36);
    expect(summary.depreciationBreakdown).toHaveLength(2);
    expect(summary.depreciationBreakdown.map(r => r.particulars)).toEqual(['Bonnet', 'Headlamp RH']);
  });

  test('depreciationBreakdown entries have correct amounts', () => {
    const summary = computeInsuredFinancialSummary(mockClaim, 36);
    expect(summary.depreciationBreakdown[0]).toEqual({
      particulars: 'Bonnet',
      billed: 8000,
      assessed: 5600,
      deductionAmount: 2400,
    });
    expect(summary.depreciationBreakdown[1]).toEqual({
      particulars: 'Headlamp RH',
      billed: 3000,
      assessed: 2100,
      deductionAmount: 900,
    });
  });

  test('depreciationTotal equals sum of depreciationBreakdown deductionAmounts', () => {
    const summary = computeInsuredFinancialSummary(mockClaim, 36);
    const fromBreakdown = summary.depreciationBreakdown.reduce((acc, r) => acc + r.deductionAmount, 0);
    expect(summary.depreciationTotal).toBe(fromBreakdown);
  });
});
