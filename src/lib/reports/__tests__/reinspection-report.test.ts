import { describe, expect, test } from 'vitest';
import { buildReinspectionHTML } from '../reinspection-report-builder';
import { createBlankClaim } from '@/types/claim';
import { DEFAULT_REINSPECTION_REMARKS } from '@/types/assessment';
import type { ClaimData } from '@/types';

function claim(): ClaimData {
  const base = createBlankClaim();
  return {
    ...base,
    reportNo: 'FSR/001',
    reportDate: '2026-09-01',
    policy: {
      ...base.policy,
      insurerName: 'United India',
      policyIssuingOffice: 'Pune DO-3',
      appointingOffice: 'Pune Claims Hub',
    },
    accident: {
      ...base.accident,
      dateAndTime: '2026-08-10T09:30',
      dateOfSurvey: '2026-08-12',
      placeOfSurvey: 'ABC Motors, Pune',
    },
    reinspection: {
      ...base.reinspection,
      refNo: 'RI/007',
      date: '2026-09-10',
      riAppointmentDate: '2026-09-09',
      repairAuthDate: '2026-08-15',
      estCompletionDate: '2026-09-05',
      actualCompletionDate: '2026-09-08',
    },
  };
}

describe('reinspection report fields', () => {
  test('prints the RI reference and the claim-reference fields', () => {
    const html = buildReinspectionHTML(claim(), null);
    for (const s of [
      'RI Ref Number', 'RI/007',
      'Report Number', 'FSR/001',
      'Date of Accident', '10.08.2026',
      'Date of Survey', '12.08.2026',
      'Insurance Company', 'United India',
      'Policy Issuing Office', 'Pune DO-3',
      'Claim Appointing Office', 'Pune Claims Hub',
      'RI Appointment Date', '09.09.2026',
      'Repair Auth. Date', '15.08.2026',
      'Est. Completion Date', '05.09.2026',
      'Actual Completion Date', '08.09.2026',
    ]) expect(html).toContain(s);
  });

  test('no longer prints report date, survey ref or survey date', () => {
    const html = buildReinspectionHTML(claim(), null);
    expect(html).not.toContain('Date of Report');
    expect(html).not.toContain('Survey Ref No');
    expect(html).not.toContain('>Survey Date<');
    expect(html).not.toContain('01.09.2026');
  });

  test('place of re-inspection falls back to the original survey place', () => {
    const html = buildReinspectionHTML(claim(), null);
    expect(html).toContain('Place of Re-inspection');
    expect(html).toContain('ABC Motors, Pune');
  });

  test('place of re-inspection uses the RI value when set', () => {
    const c = claim();
    const html = buildReinspectionHTML(
      { ...c, reinspection: { ...c.reinspection, placeOfSurvey: 'XYZ Body Shop, Mumbai' } },
      null,
    );
    expect(html).toContain('XYZ Body Shop, Mumbai');
    expect(html).not.toContain('ABC Motors, Pune');
  });

  test('prints default surveyor conclusion when observations is default or empty', () => {
    const htmlDefault = buildReinspectionHTML(claim(), null);
    expect(htmlDefault).toContain(DEFAULT_REINSPECTION_REMARKS);

    const cEmpty = claim();
    const htmlEmpty = buildReinspectionHTML(
      { ...cEmpty, reinspection: { ...cEmpty.reinspection, observations: '' } },
      null,
    );
    expect(htmlEmpty).toContain(DEFAULT_REINSPECTION_REMARKS);
  });

  test('prints custom edited observations when surveyor overrides it', () => {
    const cCustom = claim();
    const customText = 'Re-inspected at workshop. Replaced front bumper verified. Salvage retained by insured.';
    const htmlCustom = buildReinspectionHTML(
      { ...cCustom, reinspection: { ...cCustom.reinspection, observations: customText } },
      null,
    );
    expect(htmlCustom).toContain(customText);
    expect(htmlCustom).not.toContain(DEFAULT_REINSPECTION_REMARKS);
  });
});
