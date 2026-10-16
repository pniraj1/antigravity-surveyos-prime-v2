import { describe, it, expect } from 'vitest';
import { buildPortalPacket, buildUiicPacket, CANONICAL_FIELDS, UIIC_FIELDS } from '../packet';
import { uiicPortalSummary } from '@/lib/calculations/uiic-portal-summary';
import { projectForBillCheck } from '@/lib/reports/bill-check-projection';
import uiicMap from '../../../../extension/maps/uiic-claimsurvey.json';
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

  it('salvage follows the bill-check rule: a typed billSalvage wins', async () => {
    const c = claim(); c.feeBill.billSalvage = 250;
    const p = await buildPortalPacket(c, { ageMonths: 24 });
    expect(p.fields.netSalvage).toBe(250);
  });

  it('normalises the mobile to its last ten digits', async () => {
    const c = claim(); c.policy.insuredMobile = '+91 98765 43210';
    const p = await buildPortalPacket(c, { ageMonths: 24 });
    expect(p.fields.claimantMobile).toBe('9876543210');
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

describe('buildUiicPacket', () => {
  const build = (c = claim()) => buildUiicPacket(c, { ageMonths: 24 });

  it('UIIC_FIELDS is exactly what the map reads', () => {
    const read = Object.entries(uiicMap.fields as Record<string, { from?: string }>)
      .map(([name, spec]) => spec.from ?? name);
    // towingCharge / invoiceNo are in the map but deliberately never sent.
    const unsent = ['towingCharge', 'invoiceNo'];
    expect([...UIIC_FIELDS].sort()).toEqual([...new Set(read)].filter((n) => !unsent.includes(n)).sort());
    expect(UIIC_FIELDS).toHaveLength(25);
  });

  it('has the UIIC envelope, a trimmed claim number and no files', () => {
    const p = build();
    expect(p).toMatchObject({ v: 1, portal: 'uiic', flow: 'claimsurvey', claimNo: '3101/00312/24-C', files: [] });
    for (const k of Object.keys(p.fields)) expect(UIIC_FIELDS).toContain(k);
  });

  it('parts buckets, GST slabs and labour equal the portal summary on the bill-check basis', () => {
    const c = claim();
    c.assessmentRows = [
      ...c.assessmentRows,
      row({ id: 'r3', section: 'labour', particulars: 'Fit', partType: undefined, estimated: 500, assessed: 500, billedTaxable: 400, gst: 18 }),
    ];
    const s = uiicPortalSummary(projectForBillCheck(c.assessmentRows), 24, 'standard');
    const f = build(c).fields;
    expect(f.ageBasedDep).toBe(s.parts.ageBasedDep);
    expect(f.dep50).toBe(s.parts.dep50);
    expect(f.dep30).toBe(s.parts.dep30);
    expect(f.nilDep).toBe(s.parts.nilDep);
    for (const g of s.partsGst) expect(f[`gst${g.rate}AmountP` as 'gst18AmountP']).toBe(g.amount);
    for (const g of s.labourGst) expect(f[`gst${g.rate}AmountL` as 'gst18AmountL']).toBe(g.amount);
    expect(f.labourCharge).toBe(s.labour.totalLabour);
  });

  it('drops slabs the portal has no field for and maps a 0% slab to gst0AmountP', () => {
    const c = claim();
    c.assessmentRows = [
      row({ id: 'a', gst: 0, partType: 'metal', billedTaxable: 500 }),
      row({ id: 'b', gst: 14, partType: 'metal', billedTaxable: 500 }),
    ];
    const f = build(c).fields;
    expect(f.gst0AmountP).toBeGreaterThan(0);
    expect(Object.keys(f).some((k) => k.includes('14'))).toBe(false);
  });

  it('maps survey, invoice, deductions and fee bill', () => {
    const c = claim(); c.reportNo = 'R-12'; c.feeBill.haltageCharges = 75;
    const f = build(c).fields;
    expect(f).toMatchObject({
      surveyDate: '2026-09-18', surveyTime: '14:30', surveyPlace: 'Pune',
      claimantMobile: '9876543210', reportNo: 'R-12', workshopInvoiceNo: 'INV-7',
      compulsoryExcess: 1000, voluntaryExcess: 0,
      profFeeAmount: 1500, travelExpense: 300, photoCharge: 200, dailyAllowance: 75,
    });
    expect('towingCharge' in f).toBe(false);
    expect('invoiceNo' in f).toBe(false);
  });

  it('salvage follows the bill-check rule: a typed billSalvage wins', () => {
    const c = claim(); c.feeBill.billSalvage = 250;
    expect(build(c).fields.salvageValue).toBe(250);
  });

  it('takes the last ten digits of the mobile', () => {
    const c = claim(); c.policy.insuredMobile = '+91 98765 43210';
    expect(build(c).fields.claimantMobile).toBe('9876543210');
  });

  it('throws without a claim number', () => {
    const c = claim(); c.policy.claimNumber = '  ';
    expect(() => build(c)).toThrow(/claim number/i);
  });
});
