import { expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import type { ClaimData, SurveyorProfile } from '@/types';

test('standard final report prints the policy issuing office', () => {
  const claim = {
    id: 'c1', vehicleType: 'private', assessmentRows: [], depreciationType: 'standard',
    vehicle: {}, policy: { policyIssuingOffice: 'UIIC DO-3 Pune' },
    accident: {}, driver: {}, spotDetails: {}, reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: {},
  } as unknown as ClaimData;
  const html = buildStandardFinalSurveyHTML(claim, { name: 'S' } as SurveyorProfile);
  expect(html).toContain('Issuing Office');
  expect(html).toContain('UIIC DO-3 Pune');
});
