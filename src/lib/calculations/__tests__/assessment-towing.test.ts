import { describe, it, expect } from 'vitest';
import { calculateAssessmentSummary, calculateBillCheckSummary } from '../assessment';
import { createBlankClaim } from '@/types/claim';

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
});
