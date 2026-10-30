import React from 'react';
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpotPrintReport } from '@/components/print/SpotPrintReport';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import { buildUIICFinalHTML } from '../uiic-final-builder';
import { buildValuationReportHTML } from '../valuation-report-builder';
import type { ClaimData, SurveyorProfile } from '@/types';

/** Strip tags so a label and its value can be matched as plain text. */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

function claim(over: Record<string, unknown> = {}, vehicleType = 'goods'): ClaimData {
  const { spotDetails, vehicle, policy, accident, valuationDetails, ...rest } = over;
  return {
    id: 'c1',
    vehicleType,
    surveyType: 'spot',
    assessmentRows: [],
    spotDamageRows: [],
    depreciationType: 'standard',
    vehicle: {
      registrationNumber: 'MH12AB1234',
      dateOfRegistration: '2024-08-05',
      yearOfManufacture: 2024,
      ...(vehicle as object),
    },
    policy: {
      insurerName: 'National Insurance Co. Ltd.',
      ...(policy as object),
    },
    accident: {
      dateAndTime: '2026-06-24T10:00',
      policeStation: 'Hadapsar',
      firNumber: 'FIR/442/2026',
      thirdPartyDetails: 'One pedestrian injured, admitted at Sassoon',
      ...(accident as object),
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
      ...(spotDetails as object),
    },
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: {},
    valuationDetails: {
      odometer: '',
      ...(valuationDetails as object),
    },
    documentVerification: {},
    ...rest,
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

describe('Cross-fallbacks for load and weights on standard final report', () => {
  test('prints Load at Accident when load was provided only via vehicle.goodsWeightAtAccident', () => {
    const c = claim({
      vehicle: {
        registrationNumber: 'MH12AB1234',
        goodsWeightAtAccident: '11500',
      },
      spotDetails: {
        actualLoad: undefined,
      },
    });
    const t = text(buildStandardFinalSurveyHTML(c, profile));
    expect(t).toContain('11500');
  });

  test('prints GVW in Section 2 when provided only via spotDetails.gvw', () => {
    const c = claim({
      vehicle: {
        registrationNumber: 'MH12AB1234',
        registeredLoadWeight: '',
      },
      spotDetails: {
        gvw: 16200,
      },
    });
    const t = text(buildStandardFinalSurveyHTML(c, profile));
    expect(t).toContain('16200 kg');
  });
});

describe('Report builder cross-fallbacks for goods description, HPA/financier, and odometer', () => {
  // 1. Spot Report tests
  test('Spot Report prints Goods / Passengers Carried when populated only via vehicle.natureOfGoods', () => {
    const c = claim({
      vehicle: {
        registrationNumber: 'MH12AB1234',
        natureOfGoods: 'Industrial Machinery',
      },
      spotDetails: {
        loadDesc: '',
      },
    });
    const html = renderToStaticMarkup(React.createElement(SpotPrintReport, { claim: c, profile }));
    const t = text(html);
    expect(t).toContain('Goods / Passengers Carried');
    expect(t).toContain('Industrial Machinery');
  });

  test('Spot Report prints HPA when populated only via vehicle.hypothecation or vehicle.rcEndorsement', () => {
    // Via hypothecation
    const c1 = claim({
      policy: { hpaWith: '' },
      vehicle: {
        registrationNumber: 'MH12AB1234',
        hypothecation: 'HDFC Bank Ltd',
        rcEndorsement: '',
      },
    });
    const html1 = renderToStaticMarkup(React.createElement(SpotPrintReport, { claim: c1, profile }));
    expect(text(html1)).toContain('HDFC Bank Ltd');

    // Via rcEndorsement
    const c2 = claim({
      policy: { hpaWith: '' },
      vehicle: {
        registrationNumber: 'MH12AB1234',
        hypothecation: '',
        rcEndorsement: 'ICICI Bank Ltd',
      },
    });
    const html2 = renderToStaticMarkup(React.createElement(SpotPrintReport, { claim: c2, profile }));
    expect(text(html2)).toContain('ICICI Bank Ltd');
  });

  // 2. Standard Final Report tests
  test('Standard Final Report prints Description of Goods / Passengers when populated only via vehicle.natureOfGoods', () => {
    const c = claim({
      vehicle: {
        registrationNumber: 'MH12AB1234',
        natureOfGoods: 'Electronics & Hardware',
      },
      spotDetails: {
        loadDesc: '',
      },
    });
    const t = text(buildStandardFinalSurveyHTML(c, profile));
    expect(t).toContain('Description of Goods / Passengers');
    expect(t).toContain('Electronics & Hardware');
  });

  test('Standard Final Report prints HPA when populated only via vehicle.rcEndorsement', () => {
    const c = claim({
      policy: { hpaWith: '' },
      vehicle: {
        registrationNumber: 'MH12AB1234',
        hypothecation: '',
        rcEndorsement: 'Kotak Mahindra Bank',
      },
    });
    const t = text(buildStandardFinalSurveyHTML(c, profile));
    expect(t).toContain('H.P.A.');
    expect(t).toContain('Kotak Mahindra Bank');
  });

  // 3. UIIC Final Report tests
  test('UIIC Final Report prints both Details of Goods and Nature of Goods when either is filled', () => {
    // When only natureOfGoods is provided
    const c1 = claim({
      vehicle: {
        registrationNumber: 'MH12AB1234',
        natureOfGoods: 'Textiles',
        detailsOfGoodsCarried: '',
      },
      spotDetails: {
        loadDesc: '',
      },
    });
    const t1 = text(buildUIICFinalHTML(c1, null));
    expect(t1).toContain('Details of goods carried at the time of accident');
    expect(t1).toContain('Nature of goods carried');
    const countTextiles = t1.split('Textiles').length - 1;
    expect(countTextiles).toBeGreaterThanOrEqual(2);

    // When only detailsOfGoodsCarried is provided
    const c2 = claim({
      vehicle: {
        registrationNumber: 'MH12AB1234',
        natureOfGoods: '',
        detailsOfGoodsCarried: 'Auto Spare Parts',
      },
      spotDetails: {
        loadDesc: '',
      },
    });
    const t2 = text(buildUIICFinalHTML(c2, null));
    const countParts = t2.split('Auto Spare Parts').length - 1;
    expect(countParts).toBeGreaterThanOrEqual(2);

    // When only spotDetails.loadDesc is provided
    const c3 = claim({
      vehicle: {
        registrationNumber: 'MH12AB1234',
        natureOfGoods: '',
        detailsOfGoodsCarried: '',
      },
      spotDetails: {
        loadDesc: 'Raw Cotton',
      },
    });
    const t3 = text(buildUIICFinalHTML(c3, null));
    const countCotton = t3.split('Raw Cotton').length - 1;
    expect(countCotton).toBeGreaterThanOrEqual(2);
  });

  test('UIIC Final Report prints FINANCIER INTEREST and RC endorsement when populated via any of policy.hpaWith, vehicle.hypothecation, or vehicle.rcEndorsement', () => {
    // Via policy.hpaWith
    const c1 = claim({
      policy: { hpaWith: 'SBI Bank' },
      vehicle: { registrationNumber: 'MH12AB1234', hypothecation: '', rcEndorsement: '' },
    });
    const t1 = text(buildUIICFinalHTML(c1, null));
    expect(t1).toContain('FINANCIER INTEREST SBI Bank');
    expect(t1).toContain('RC endorsement on financier interest SBI Bank');

    // Via vehicle.hypothecation
    const c2 = claim({
      policy: { hpaWith: '' },
      vehicle: { registrationNumber: 'MH12AB1234', hypothecation: 'Axis Bank Ltd', rcEndorsement: '' },
    });
    const t2 = text(buildUIICFinalHTML(c2, null));
    expect(t2).toContain('FINANCIER INTEREST Axis Bank Ltd');
    expect(t2).toContain('RC endorsement on financier interest Axis Bank Ltd');

    // Via vehicle.rcEndorsement
    const c3 = claim({
      policy: { hpaWith: '' },
      vehicle: { registrationNumber: 'MH12AB1234', hypothecation: '', rcEndorsement: 'Bank of Baroda' },
    });
    const t3 = text(buildUIICFinalHTML(c3, null));
    expect(t3).toContain('FINANCIER INTEREST Bank of Baroda');
    expect(t3).toContain('RC endorsement on financier interest Bank of Baroda');
  });

  // 4. Valuation Report tests
  test('Valuation Report builder prints Kilometerage when odometer was provided only via vehicle.odometer (with valuationDetails.odometer: "")', () => {
    const c = claim({
      vehicle: {
        registrationNumber: 'MH12AB1234',
        odometer: '67450',
      },
      valuationDetails: {
        odometer: '',
      },
    });
    const t = text(buildValuationReportHTML(c, profile));
    expect(t).toContain('Kilometerage');
    expect(t).toContain('67450');
  });
});


