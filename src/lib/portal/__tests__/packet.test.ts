import { describe, it, expect } from 'vitest';
import { buildPortalPacket, CANONICAL_FIELDS } from '../packet';
import { createBlankClaim } from '@/types/claim';
import type { AssessmentRow } from '@/types/assessment';

const row = (p: Partial<AssessmentRow>): AssessmentRow =>
  ({
    id: 'r1', section: 'parts', particulars: 'Bumper', partType: 'plastic',
    estimated: 1000, assessed: 1000, gst: 18, allowed: true, billedTaxable: 900,
    ...p,
  }) as AssessmentRow;

function claim() {
  const c = createBlankClaim('final', 'private');
  c.policy.claimNumber = ' 3101/00312/24-C ';
  c.policy.insuredMobile = '9876543210';
  c.accident.dateOfSurvey = '2026-09-18';
  c.accident.timeOfSurvey = '14:30';
  c.accident.placeOfSurvey = 'Pune';
  c.billCheck = { billNo: 'INV-7', billDate: '2026-09-19', billTotal: 5000 };
  c.feeBill.billDate = '2026-09-20';
  c.feeBill.professionalFee = 1500;
  c.feeBill.photosCount = 10; c.feeBill.photoRate = 20;
  c.feeBill.distanceKm = 30; c.feeBill.ratePerKm = 10;
  c.feeBill.postalCharges = 50; c.feeBill.haltageCharges = 0;
  c.feeBill.includeGST = true;
  c.feeBill.compulsoryExcess = 1000; c.feeBill.voluntaryExcess = 0;
  c.feeBill.salvageValue = 300;
  c.assessmentRows = [
    row({}),
    row({ id: 'r2', section: 'paint', particulars: 'Bumper paint', estimated: 2000, assessed: 2000, billedTaxable: 2000 }),
  ];
  return c;
}

describe('buildPortalPacket', () => {
  it('emits only canonical keys, trimmed claim number, one Excel file', async () => {
    const p = await buildPortalPacket(claim(), { ageMonths: 24 });
    expect(p.v).toBe(1);
    expect(p.portal).toBe('nia');
    expect(p.flow).toBe('nontieup');
    expect(p.claimNo).toBe('3101/00312/24-C');
    for (const k of Object.keys(p.fields)) expect(CANONICAL_FIELDS).toContain(k);
    expect(p.files).toHaveLength(1);
    expect(p.files[0].slot).toBe('assessmentExcel');
    expect(p.files[0].name).toBe('3101_00312_24-C_Primary_Assessment_Template.xlsx');
    expect(p.files[0].base64.length).toBeGreaterThan(100);
  });

  it('maps survey, invoice, deductions and fee fields', async () => {
    const p = await buildPortalPacket(claim(), { ageMonths: 24 });
    expect(p.fields.surveyDate).toBe('2026-09-18');
    expect(p.fields.surveyTime).toBe('14:30');
    expect(p.fields.surveyPlace).toBe('Pune');
    expect(p.fields.claimantMobile).toBe('9876543210');
    expect(p.fields.vendorInvoiceNo).toBe('INV-7');
    expect(p.fields.vendorInvoiceDate).toBe('2026-09-19');
    expect(p.fields.gstApplicable).toBe('Y');
    expect(p.fields.noOfInvoices).toBe('1');
    expect(p.fields.netSalvage).toBe(300);
    expect(p.fields.compulsoryExcess).toBe(1000);
    expect(p.fields.voluntaryExcess).toBe(0);
    expect(p.fields.feeInvoiceDate).toBe('2026-09-20');
    expect(p.fields.professionalFee).toBe(1500);
    expect(p.fields.photosAmount).toBe(200);
    expect(p.fields.conveyanceAmount).toBe(300);
    expect(p.fields.feeOthers).toBe(50);
    expect(p.fields.feeGstApplicable).toBe('Y');
    expect(p.fields.feeGstPercent).toBe(18);
  });

  it('sends painting on a standard policy and omits it on nil-dep', async () => {
    const std = await buildPortalPacket(claim(), { ageMonths: 24 });
    expect(std.fields.paintingEstimate).toBe(2000);
    expect(std.fields.paintingAssessed).toBe(2000);
    const c = claim(); c.depreciationType = 'nil';
    const nil = await buildPortalPacket(c, { ageMonths: 24 });
    expect(nil.fields.paintingEstimate).toBeUndefined();
    expect(nil.fields.paintingAssessed).toBeUndefined();
  });

  it('omits empty strings rather than sending them', async () => {
    const c = claim(); c.accident.placeOfSurvey = ''; c.policy.insuredMobile = '';
    const p = await buildPortalPacket(c, { ageMonths: 24 });
    expect('surveyPlace' in p.fields).toBe(false);
    expect('claimantMobile' in p.fields).toBe(false);
  });

  it('throws without a claim number', async () => {
    const c = claim(); c.policy.claimNumber = '  ';
    await expect(buildPortalPacket(c, { ageMonths: 24 })).rejects.toThrow(/claim number/i);
  });
});
