import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import type { ClaimData, SurveyorProfile } from '@/types';

function claim(vehicleType = 'comm-goods'): ClaimData {
  return {
    id: 'c1',
    vehicleType,
    assessmentRows: [],
    depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234' },
    policy: {},
    accident: { dateAndTime: '2026-06-24T10:00' },
    driver: {},
    spotDetails: {
      permitNo: 'PMT/551', permitType: 'National', natureOfPermit: 'Goods Carriage',
      permitTo: '2027-03-01', authNo: 'AUTH/9', authValid: '2027-04-02',
      areaOfOperation: 'All India',
      challanNo: 'CN/8891', challanDate: '2026-06-24', actualLoad: 12400,
      loadDesc: 'Cement bags', loadOrigin: 'Pune', loadDest: 'Solapur',
    },
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: {},
  } as unknown as ClaimData;
}

const profile = { name: 'SURVEYOR' } as SurveyorProfile;

describe('Standard final permit block', () => {
  test('prints every field the Permit, Load & Challan form writes', () => {
    const html = buildStandardFinalSurveyHTML(claim(), profile);
    for (const v of [
      'PMT/551', 'National', 'Goods Carriage', 'AUTH/9', 'All India',
      'CN/8891', '12400', 'Cement bags', 'Pune', 'Solapur',
    ]) {
      expect(html, `missing ${v}`).toContain(v);
    }
    expect(html).toContain('01.03.2027'); // permitTo, formatted
    expect(html).toContain('02.04.2027'); // authValid, formatted
  });

  test('prints none of it for a private vehicle', () => {
    const html = buildStandardFinalSurveyHTML(claim('private'), profile);
    expect(html).not.toContain('PMT/551');
    expect(html).not.toContain('CN/8891');
  });
});
