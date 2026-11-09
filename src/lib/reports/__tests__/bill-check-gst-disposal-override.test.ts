import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import { buildUIICBillCheckHTML, buildUIICFinalHTML } from '../uiic-final-builder';
import type { ClaimData, SurveyorProfile } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

const profile = { name: 'SURVEYOR' } as SurveyorProfile;

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r_${Math.random()}`,
    particulars: 'Item',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    billStatus: 'in-bill',
    billedTaxable: 10000,
    ...overrides,
  } as AssessmentRow;
}

function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'claim_override_test',
    assessmentRows: rows,
    depreciationType: 'standard',
    reportNo: 'BC/2026/0888',
    reportDate: '2026-11-09',
    vehicle: { registrationNumber: 'DL01AB1234', dateOfRegistration: '2024-11-01', yearOfManufacture: 2024 },
    policy: { insurerName: 'United India Insurance Co. Ltd.' },
    accident: { dateAndTime: '2026-11-01T10:00' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'INV-101', billDate: '2026-11-05', billTotal: 15000 },
  } as unknown as ClaimData;
}

describe('Bill Check reports - billAllowed, GST, disposal, and depOverride reactivity', () => {
  test('billAllowed in Standard Bill Check report updates assessed amount and liability while Final Survey Report retains original assessed', () => {
    const r = row({
      particulars: 'BONNET ASSY',
      assessed: 10000,
      billAllowed: 12000,
      billedTaxable: 12000,
      gst: 18,
      depOverride: 0,
    });
    const c = claim([r]);

    // Bill Check mode
    const billCheckHtml = buildStandardFinalSurveyHTML(c, profile, 'bill-check');
    expect(billCheckHtml).toContain('12,000.00');
    expect(billCheckHtml).toContain('14,160.00'); // 12000 * 1.18

    // Final Survey mode
    const finalHtml = buildStandardFinalSurveyHTML(c, profile, 'final');
    expect(finalHtml).toContain('10,000.00');
    expect(finalHtml).toContain('11,800.00'); // 10000 * 1.18
    expect(finalHtml).not.toContain('12,000.00');
    expect(finalHtml).not.toContain('14,160.00');
  });

  test('billAllowed in UIIC Bill Check report updates assessed amount and net liability while UIIC Final retains original', () => {
    const r = row({
      particulars: 'FENDER LH',
      assessed: 10000,
      billAllowed: 12000,
      billedTaxable: 12000,
      gst: 18,
      depOverride: 0,
    });
    const c = claim([r]);

    const uiicBillCheckHtml = buildUIICBillCheckHTML(c, profile);
    expect(uiicBillCheckHtml).toContain('12000.00');
    expect(uiicBillCheckHtml).toContain('14160.00');

    const uiicFinalHtml = buildUIICFinalHTML(c, profile);
    expect(uiicFinalHtml).toContain('10000.00');
    expect(uiicFinalHtml).toContain('11800.00');
  });

  test('User Scenario: Insured fitted new part instead of disposal part; surveyor marks isDisposal: false and gst: 18', () => {
    // Insured originally planned disposal, but in Bill Check surveyor allowed new part at 10,000 with 10% dep and 18% GST
    const r = row({
      particulars: 'DOOR FRONT RH',
      isDisposal: false, // switched off in bill check
      disposalPercent: 50,
      gst: 18, // restored to 18%
      depOverride: 10, // 10% depreciation
      billAllowed: 10000,
      billedTaxable: 10000,
    });
    const c = claim([r]);

    // Standard Bill Check
    const stdHtml = buildStandardFinalSurveyHTML(c, profile, 'bill-check');
    // Dep = 10% on 10,000 => 9,000 net before GST
    // GST = 18% => 9,000 * 1.18 = 10,620.00 Price+GST
    expect(stdHtml).toContain('10,000.00');
    expect(stdHtml).toContain('9,000.00');
    expect(stdHtml).toContain('10,620.00');
    expect(stdHtml).not.toContain('DISP');

    // UIIC Bill Check
    const uiicHtml = buildUIICBillCheckHTML(c, profile);
    expect(uiicHtml).toContain('10000.00');
    expect(uiicHtml).toContain('9000.00');
    expect(uiicHtml).toContain('10620.00');
    expect(uiicHtml).not.toContain('DISP');
  });

  test('Surveyor edits GST from 18% to 28% (e.g. for tyre) in Bill Check', () => {
    const r = row({
      particulars: 'TYRE LH',
      partType: 'plastic',
      assessed: 10000,
      billedTaxable: 10000,
      depOverride: 50, // 50% dep on tyre
      gst: 28, // edited to 28%
    });
    const c = claim([r]);

    // 10,000 - 50% = 5,000. 5,000 * 1.28 = 6,400.00
    const stdHtml = buildStandardFinalSurveyHTML(c, profile, 'bill-check');
    expect(stdHtml).toContain('28%');
    expect(stdHtml).toContain('5,000.00');
    expect(stdHtml).toContain('6,400.00');

    const uiicHtml = buildUIICBillCheckHTML(c, profile);
    expect(uiicHtml).toContain('28');
    expect(uiicHtml).toContain('5000.00');
    expect(uiicHtml).toContain('6400.00');
  });
});
