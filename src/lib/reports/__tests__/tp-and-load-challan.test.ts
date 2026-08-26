import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import { buildUIICFinalHTML } from '../uiic-final-builder';
import type { ClaimData, SurveyorProfile } from '@/types';

/** Strip tags so a label and its value can be matched as plain text. */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

function claim(over: Record<string, unknown> = {}, vehicleType = 'goods'): ClaimData {
  return {
    id: 'c1',
    vehicleType,
    assessmentRows: [],
    depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: { insurerName: 'National Insurance Co. Ltd.' },
    accident: {
      dateAndTime: '2026-06-24T10:00',
      policeStation: 'Hadapsar',
      firNumber: 'FIR/442/2026',
      thirdPartyDetails: 'One pedestrian injured, admitted at Sassoon',
    },
    driver: {},
    spotDetails: {
      tpInvolved: 'both',
      challanNo: 'CN/8891',
      challanDate: '2026-06-24',
      gvw: 16200,
      ulw: 6200,
      loadCapacity: 10000,
      actualLoad: 12400,
      flagOverload: true,
      loadDesc: 'Cement bags',
      loadOrigin: 'Pune',
      loadDest: 'Solapur',
      ...(over.spotDetails as object),
    },
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: {},
    ...over,
  } as unknown as ClaimData;
}

const profile = { name: 'SURVEYOR' } as SurveyorProfile;

describe('Third party as free text', () => {
  test('standard final prints the free text', () => {
    const t = text(buildStandardFinalSurveyHTML(claim(), profile));
    expect(t).toContain('Third Party Details');
    expect(t).toContain('One pedestrian injured, admitted at Sassoon');
  });

  test('standard final no longer prints a TPPD/TPPI classification', () => {
    const t = text(buildStandardFinalSurveyHTML(claim(), profile));
    expect(t).not.toContain('Third Party Involvement');
    expect(t).not.toContain('Property Damage and Injury');
  });

  test('UIIC final prints the free text under a TPPI / TPPD label', () => {
    const t = text(buildUIICFinalHTML(claim(), null));
    expect(t).toMatch(/TPPI \/ TPPD\s+One pedestrian injured/);
  });

  test('UIIC final prints the third-party text once, not twice', () => {
    const t = text(buildUIICFinalHTML(claim(), null));
    const hits = t.split('One pedestrian injured').length - 1;
    expect(hits).toBe(1);
  });

  test('empty third party prints NIL', () => {
    const c = claim({
      accident: {
        dateAndTime: '2026-06-24T10:00',
        policeStation: 'Hadapsar',
        firNumber: 'FIR/442/2026',
        thirdPartyDetails: '',
      },
    });
    expect(text(buildUIICFinalHTML(c, null))).toMatch(/TPPI \/ TPPD\s+NIL/);
  });
});

describe('Load challan section on the standard final report', () => {
  test('prints challan, load and route for a goods vehicle', () => {
    const t = text(buildStandardFinalSurveyHTML(claim(), profile));
    expect(t).toContain('PERMIT, LOAD &amp; CHALLAN');
    expect(t).toContain('CN/8891');
    expect(t).toContain('24.06.2026');
    expect(t).toContain('12400');
    expect(t).toContain('Cement bags');
    expect(t).toContain('Pune');
    expect(t).toContain('Solapur');
  });

  test('flags overload only when the surveyor opted in', () => {
    expect(text(buildStandardFinalSurveyHTML(claim(), profile))).toContain('OVERLOADED');
    const notFlagged = claim({ spotDetails: { flagOverload: false } });
    expect(text(buildStandardFinalSurveyHTML(notFlagged, profile))).not.toContain('OVERLOADED');
  });

  test('is omitted entirely for a private vehicle', () => {
    const t = text(buildStandardFinalSurveyHTML(claim({}, 'private'), profile));
    expect(t).not.toContain('PERMIT, LOAD &amp; CHALLAN');
    expect(t).not.toContain('CN/8891');
  });

  test('prints the load block on a final claim built without a spot survey', () => {
    const c = claim({ surveyType: 'final' });
    const t = text(buildStandardFinalSurveyHTML(c, profile));
    expect(t).toContain('PERMIT, LOAD &amp; CHALLAN');
    expect(t).toContain('CN/8891');
    expect(t).toContain('Cement bags');
  });

  test('does not repeat GVW and ULW that section 2 already prints', () => {
    const t = text(buildStandardFinalSurveyHTML(claim(), profile));
    expect(t).not.toContain('G.V.W. (KG)');
    expect(t).not.toContain('U.L.W. (KG)');
    // Section 2 still carries the vehicle record's GVW.
    expect(t).toContain('GVW');
  });

  test('does not appear in bill check mode', () => {
    const t = text(buildStandardFinalSurveyHTML(claim(), profile, 'bill-check'));
    expect(t).not.toContain('PERMIT, LOAD &amp; CHALLAN');
  });
});

describe('Police reported / panchanama on the standard final report', () => {
  test('mirrors the spot answers', () => {
    const c = claim({ spotDetails: { policeReported: 'yes', panchanama: 'yes' } });
    const t = text(buildStandardFinalSurveyHTML(c, profile));
    expect(t).toMatch(/Panchanama\s+Yes/);
    expect(t).toContain('Diary / FIR: FIR/442/2026');
  });

  test('prints No when the surveyor answered no', () => {
    const c = claim({ spotDetails: { policeReported: 'no', panchanama: 'no' } });
    const t = text(buildStandardFinalSurveyHTML(c, profile));
    expect(t).toMatch(/Panchanama\s+No/);
    expect(t).toMatch(/Police Reported\s+No/);
  });

  test('never asserts No when the question was never asked', () => {
    const c = claim({ spotDetails: { policeReported: '', panchanama: '' } });
    const t = text(buildStandardFinalSurveyHTML(c, profile));
    expect(t).not.toMatch(/Panchanama\s+No/);
    expect(t).not.toMatch(/Police Reported\s+No/);
  });
});
