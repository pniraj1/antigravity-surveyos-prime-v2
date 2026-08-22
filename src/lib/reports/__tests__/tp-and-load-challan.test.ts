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

describe('Third-party involvement on the final reports', () => {
  test('standard final names the TPPD/TPPI type, not just the free text', () => {
    const t = text(buildStandardFinalSurveyHTML(claim(), profile));
    expect(t).toContain('Third Party Involvement');
    expect(t).toContain('TPPD & TPPI');
    expect(t).toContain('One pedestrian injured');
  });

  test('standard final carries the police station and FIR into the TP row', () => {
    const t = text(buildStandardFinalSurveyHTML(claim(), profile));
    expect(t).toContain('Hadapsar');
    expect(t).toContain('FIR/442/2026');
  });

  test('property-damage-only reads as TPPD', () => {
    const t = text(buildStandardFinalSurveyHTML(claim({ spotDetails: { tpInvolved: 'tppd' } }), profile));
    expect(t).toContain('TPPD');
    expect(t).not.toContain('TPPI');
  });

  test('no third party reads as NIL', () => {
    const t = text(buildStandardFinalSurveyHTML(claim({ spotDetails: { tpInvolved: 'no' } }), profile));
    expect(t).toMatch(/Third Party Involvement\s+NIL/);
  });

  test('UIIC final fills its Type of TP Liability row', () => {
    const t = text(buildUIICFinalHTML(claim(), null));
    expect(t).toMatch(/Type of TP Liability\s+TPPD & TPPI/);
  });
});

describe('Load challan section on the standard final report', () => {
  test('prints challan, load and route for a goods vehicle', () => {
    const t = text(buildStandardFinalSurveyHTML(claim(), profile));
    expect(t).toContain('LOAD CHALLAN &amp; GOODS CARRIED');
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
    expect(t).not.toContain('LOAD CHALLAN &amp; GOODS CARRIED');
    expect(t).not.toContain('CN/8891');
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
    expect(t).not.toContain('LOAD CHALLAN &amp; GOODS CARRIED');
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
