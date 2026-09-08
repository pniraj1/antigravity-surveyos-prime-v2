import { describe, it, expect } from 'vitest';
import { buildClaimRow } from '../irdai-summary-builder';
import { calculateAssessmentSummary } from '@/lib/calculations/assessment';
import { toDepreciationType } from '@/lib/calculations/depreciation';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import type { ClaimData } from '@/types/claim';

// A nil-depreciation final claim with a voluntary excess. The regulatory return
// must foot to the signed report: no age depreciation, voluntary excess netted.
const claim = {
  surveyType: 'final',
  depreciationType: 'Nil Depreciation',
  reportNo: 'R1',
  createdAt: '2025-05-01',
  reportDate: '2025-05-01',
  isActive: true,
  isCompleted: true,
  policy: {},
  vehicle: { dateOfRegistration: '2019-01-01', yearOfManufacture: 2019, registrationNumber: 'MH12AB1234' },
  accident: { dateAndTime: '2024-02-01T10:00' },
  feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 2000, travelExpenses: 0 },
  assessmentRows: [
    {
      id: 'r1', section: 'parts', particulars: 'Bonnet', partType: 'metal',
      estimated: 10000, assessed: 10000, gst: 18,
      allowed: true, action: 'allow', isDisposal: false,
    },
  ],
} as unknown as ClaimData;

describe('irdai-summary buildClaimRow — foots to signed report', () => {
  it('honours nil depreciation and nets voluntary excess', () => {
    const age = getVehicleAgeMonths(
      claim.vehicle!.dateOfRegistration ?? null,
      claim.vehicle!.yearOfManufacture ?? null,
      claim.accident!.dateAndTime ?? null,
    );
    const expected = calculateAssessmentSummary(
      claim.assessmentRows!, age, toDepreciationType(claim.depreciationType),
      0, 0, claim.feeBill!.voluntaryExcess ?? 0, claim,
    ).netAssessedLoss;

    const row = buildClaimRow(claim, 0);
    expect(row.netAssessedLoss).toBe(expected);
    expect(row.netAssessedLoss).toBe(9800);
  });
});
