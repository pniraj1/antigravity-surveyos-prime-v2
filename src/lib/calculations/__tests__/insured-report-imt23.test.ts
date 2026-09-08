import { describe, test, expect } from 'vitest';
import { computeInsuredFinancialSummary } from '../insured-report';
import type { ClaimData } from '@/types/claim';

// Bumper, metal, assessed 20,000, IMT-23 ticked, 24 months => metal dep 10%.
// effectiveAssessed = 10,000; afterDep = 9,000.
// True depreciation is 10,000 - 9,000 = 1,000.
// The endorsement share (20,000 / 2 = 10,000) is its own named line, NOT
// depreciation.
const claim = {
  feeBill: { compulsoryExcess: 0, voluntaryExcess: 0, salvageValue: 0, billTotal: 0 },
  billCheck: { billTotal: 0 },
  assessmentRows: [
    {
      id: 'r1', section: 'parts', particulars: 'Bumper', partType: 'metal',
      estimated: 20000, assessed: 20000, billedTaxable: 20000,
      gst: 18, allowed: true, action: 'allow', isDisposal: false, imt23: true,
    },
  ],
  depreciationType: 'standard',
  vehicle: { dateOfRegistration: null, yearOfManufacture: null },
  accident: { dateAndTime: null },
  policy: {},
} as unknown as ClaimData;

describe('computeInsuredFinancialSummary — IMT-23 basis', () => {
  test('deduction billed as depreciation is the true dep only, not the endorsement share', () => {
    const s = computeInsuredFinancialSummary(claim, 24);
    expect(s.depreciationBreakdown[0].deductionAmount).toBe(1000);
    expect(s.depreciationTotal).toBe(1000);
  });

  test('the endorsement share is reported on its own imt23Total line', () => {
    const s = computeInsuredFinancialSummary(claim, 24);
    expect(s.imt23Total).toBe(10000);
  });
});
