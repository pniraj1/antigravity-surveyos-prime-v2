import { describe, it, expect } from 'vitest';
import { buildPortalPacket, buildUiicPacket, buildOicPacket, splitIndianDl, oicRegNumber, oicNetLiability, CANONICAL_FIELDS, UIIC_FIELDS, OIC_FIELDS } from '../packet';
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

  const DL_KEYS = ['driverName', 'driverLicenceNo', 'licenceIssuingAuthority', 'licenceIssueDate',
    'licenceExpiryDate', 'driverDob', 'badgeNumber'];

  it('sends the driver and DL fields from the claim', async () => {
    const c = claim();
    Object.assign(c.driver, {
      name: 'A Driver', licenceNumber: 'MH15 2011-0012345', issuingAuthority: 'RTO Nashik',
      dateOfIssue: '2011-05-02', validityNonTransport: '2031-05-01', validityTransport: '',
      dateOfBirth: '1990-01-15', badgeNumber: 'B 123',
    });
    const p = await buildPortalPacket(c, { ageMonths: 24 });
    expect(p.fields.driverName).toBe('A Driver');
    expect(p.fields.driverLicenceNo).toBe('MH1520110012345');
    expect(p.fields.licenceIssuingAuthority).toBe('RTO Nashik');
    expect(p.fields.licenceIssueDate).toBe('2011-05-02');
    expect(p.fields.licenceExpiryDate).toBe('2031-05-01');
    expect(p.fields.driverDob).toBe('1990-01-15');
    expect(p.fields.badgeNumber).toBe('B 123');
  });

  it('leaves blank driver fields out', async () => {
    const p = await buildPortalPacket(claim(), { ageMonths: 24 });
    for (const k of DL_KEYS) expect(k in p.fields, k).toBe(false);
  });

  it('leaves the expiry out when both validities are set', async () => {
    const c = claim();
    c.driver.validityTransport = '2027-01-01';
    c.driver.validityNonTransport = '2031-05-01';
    const p = await buildPortalPacket(c, { ageMonths: 24 });
    expect('licenceExpiryDate' in p.fields).toBe(false);
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

describe('buildOicPacket', () => {
  it('emits portal: oic, flow: assessment, OIC_FIELDS, and one Excel file', async () => {
    const c = claim();
    c.vehicle.registrationNumber = 'MH 02 DW 3096';
    c.vehicle.make = 'SKODA';
    c.vehicle.model = 'RAPID';
    c.vehicle.chassisNumber = 'TMB123456';
    c.vehicle.engineNumber = 'ENG98765';
    c.vehicle.yearOfManufacture = 2018;
    c.vehicle.colour = 'White';
    c.vehicle.fuel = 'Diesel';
    c.driver.name = 'Virendrakumar Jain';
    c.driver.licenceNumber = 'MH02201800123';
    c.accident.causeOfAccident = 'Frontal collision with divider';
    c.accident.workshopName = 'Skoda Workshop Pune';

    const p = await buildOicPacket(c, { ageMonths: 80, paintingMode: 'net_single' });
    expect(p.v).toBe(1);
    expect(p.portal).toBe('oic');
    expect(p.flow).toBe('assessment');
    expect(p.claimNo).toBe('3101/00312/24-C');
    for (const k of Object.keys(p.fields)) expect(OIC_FIELDS).toContain(k);

    expect(p.fields.regNumber).toBe('MH 02 DW 3096');
    expect(p.fields.rto).toBe('MH02');
    expect(p.fields.make).toBe('SKODA');
    expect(p.fields.model).toBe('RAPID');
    expect(p.fields.chasisNumber).toBe('TMB123456');
    expect(p.fields.engineNumber).toBe('ENG98765');
    expect(p.fields.manufacturingYear).toBe('2018');
    expect(p.fields.colorOfVehicle).toBe('White');
    expect(p.fields.typeOfFuel).toBe('Diesel');
    expect(p.fields.driverName).toBe('Virendrakumar Jain');
    expect(p.fields.driverLicenseNoOne).toBe('MH');
    expect(p.fields.driverLicenseNoTwo).toBe('0220180');
    expect(p.fields.driverLicenseNoThree).toBe('0123');
    expect(p.fields.lossDescription).toBe('Frontal collision with divider');
    expect(p.fields.workshopName).toBe('Skoda Workshop Pune');
    expect(p.fields.workshopEstimateAmount).toBe(5000);

    expect(p.files).toHaveLength(1);
    expect(p.files[0].slot).toBe('assessmentExcel');
    expect(p.files[0].name).toBe('3101_00312_24-C_OIC_Assessment.xlsx');
  });

  it('throws without a claim number', async () => {
    const c = claim();
    c.policy.claimNumber = '  ';
    await expect(buildOicPacket(c, { ageMonths: 24 })).rejects.toThrow(/claim number/i);
  });
});

describe('OIC helpers', () => {
  it('splitIndianDl: 2 / middle / last 4', () => {
    expect(splitIndianDl('MH1820100012611')).toEqual({ one: 'MH', two: '182010001', three: '2611' });
    expect(splitIndianDl('MH-18 2010 0012611')).toEqual({ one: 'MH', two: '182010001', three: '2611' });
    expect(splitIndianDl('GJ0119')).toEqual({ two: 'GJ0119' });
  });
  it('oicRegNumber spaces the groups', () => {
    expect(oicRegNumber('MH19DV9776')).toBe('MH 19 DV 9776');
    expect(oicRegNumber('mh 19 dv 9776')).toBe('MH 19 DV 9776');
    expect(oicRegNumber('MH12A5')).toBe('MH 12 A 5');
    expect(oicRegNumber('22BH1234AA')).toBe('22BH1234AA');
  });
  it('oicNetLiability ignores rows the Excel leaves out', () => {
    const base = claim();
    const keep = row({});
    const withNot = { ...base, assessmentRows: [keep, row({ id: 'x', billStatus: 'not-in-bill' })] };
    const without = { ...base, assessmentRows: [keep] };
    expect(oicNetLiability(withNot, 24)).toBe(oicNetLiability(without, 24));
    const withNA = { ...base, assessmentRows: [keep, row({ id: 'y', billStatus: 'not-allowed' })] };
    expect(oicNetLiability(withNA, 24)).toBe(oicNetLiability(without, 24));
  });
});

describe('buildOicPacket new values', () => {
  const build = (mut: (c: ReturnType<typeof claim>) => void = () => {}) => {
    const c = claim();
    mut(c);
    return buildOicPacket(c, { ageMonths: 100, includeExcel: false });
  };

  it('driver and licence values', async () => {
    const p = await build((c) => {
      c.driver.dateOfBirth = '1985-02-03';
      c.driver.dateOfIssue = '2010-04-05';
      c.driver.validityNonTransport = '2030-04-04';
      c.driver.validityTransport = '2028-01-01';
      c.driver.licenceType = 'MCWG, LMV';
      c.driver.invalidRemarks = 'fake remark';
    });
    expect(p.fields.driverDob).toBe('1985-02-03');
    expect(p.fields.dlValidFrom).toBe('2010-04-05');
    expect(p.fields.dlValidUpTo).toBe('2030-04-04');
    expect(p.fields.licenseType).toBe('LIGHT MOTOR VEHICLE - NON TRANSPORT');
    expect(p.fields.dlVerifiedRemarks).toBe('fake remark');
    const q = await build((c) => {
      c.vehicle.isCommercial = true;
      c.driver.validityNonTransport = '2030-04-04';
      c.driver.validityTransport = '2028-01-01';
      c.driver.licenceType = 'MCWG, LMV-TR';
    });
    expect(q.fields.dlValidUpTo).toBe('2028-01-01');
    // goods vs passenger is unknown for LMV-TR: left blank
    expect(q.fields.licenseType).toBeUndefined();
    const hgv = await build((c) => { c.vehicle.isCommercial = true; c.driver.licenceType = 'LMV, HGV'; });
    expect(hgv.fields.licenseType).toBe('HGV');
    const wog = await build((c) => { c.vehicle.classOfVehicle = 'Scooter'; c.driver.licenceType = 'MCWOG'; });
    expect(wog.fields.licenseType).toBe('MOTOR CYCLE WITHOUT GEAR');
    const r = await build((c) => { c.driver.licenceType = 'MCWG'; });
    expect(r.fields.licenseType).toBeUndefined();
    const two = await build((c) => { c.vehicle.classOfVehicle = 'M-Cycle/Scooter'; c.driver.licenceType = 'MCWG, LMV'; });
    expect(two.fields.licenseType).toBe('MOTOR CYCLE WITH GEAR');
    const wd = await build((c) => { c.vehicle.classOfVehicle = 'LMV 2WD'; c.driver.licenceType = 'MCWG, LMV'; });
    expect(wd.fields.licenseType).toBe('LIGHT MOTOR VEHICLE - NON TRANSPORT');
    const tw = await build((c) => { c.vehicle.classOfVehicle = '2W'; c.driver.licenceType = 'MCWG, LMV'; });
    expect(tw.fields.licenseType).toBe('MOTOR CYCLE WITH GEAR');
    const none = await build((c) => { c.driver.licenceType = ''; });
    expect(none.fields.licenseType).toBeUndefined();
  });

  it('ownerDriver, thirdPartyInvolved, nilDepCover', async () => {
    const yes = await build((c) => { c.driver.name = 'Mr. Ramesh  Patil'; c.policy.insuredName = 'RAMESH PATIL'; });
    expect(yes.fields.ownerDriver).toBe('yes');
    const no = await build((c) => { c.driver.name = 'Sunil Rao'; c.policy.insuredName = 'RAMESH PATIL'; });
    expect(no.fields.ownerDriver).toBe('no');
    const absent = await build((c) => { c.driver.name = ''; c.policy.insuredName = 'RAMESH PATIL'; });
    expect(absent.fields.ownerDriver).toBeUndefined();
    const tp = await build((c) => { c.accident.thirdPartyDetails = ' a car '; });
    expect(tp.fields.thirdPartyInvolved).toBe('yes');
    const notp = await build((c) => { c.accident.thirdPartyDetails = '  '; });
    expect(notp.fields.thirdPartyInvolved).toBe('no');
    const nd = await build((c) => { c.policyCheck = { nilDep: 'no' }; });
    expect(nd.fields.nilDepCover).toBe('no');
    const ai = await build((c) => { c.policyCheck = { aiRead: { nilDep: 'yes' } }; });
    expect(ai.fields.nilDepCover).toBeUndefined();
  });

  it('dates, amounts, text, spot flag', async () => {
    const p = await build((c) => {
      c.accident.remarks = 'obs text';
      c.accident.causeOfAccident = 'cause text';
      c.accident.appointmentDate = '2026-09-10';
      c.policy.insuredMobile = '+91 98765-43210';
    });
    const t = new Date();
    const local = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    expect(p.fields.finalDocumentDate).toBe(local);
    expect(p.fields.initialLossAmount).toBe(oicNetLiability(claim(), 100));
    expect(p.fields.workshopEstimateAmount).toBe(5000);
    expect(p.fields.workshopEstimateDate).toBe('2026-09-19');
    expect(p.fields.surveyorObservation).toBe('obs text');
    expect(p.fields.causeOfAccident).toBe('cause text');
    expect(p.fields.surveyorAppointedDate).toBe('2026-09-10');
    expect(p.fields.claimantMobile).toBe('9876543210');
    const z = await build((c) => { c.policy.insuredMobile = '09876543210'; });
    expect(z.fields.claimantMobile).toBe('9876543210');
    expect(p.fields.spotSurveyDone).toBe('no');
    const spot = await build((c) => { c.spotDetails = { ...c.spotDetails, comments: 'checked' }; });
    expect(spot.fields.spotSurveyDone).toBe('yes');
  });

  it('no billCheck: no workshop estimate, still initialLossAmount', async () => {
    const p = await build((c) => { delete (c as { billCheck?: unknown }).billCheck; });
    expect(p.fields.workshopEstimateAmount).toBeUndefined();
    expect(p.fields.workshopEstimateDate).toBeUndefined();
    expect(p.fields.initialLossAmount).toBeDefined();
  });

  it('no row in the Excel: no initialLossAmount', async () => {
    const p = await build((c) => { c.assessmentRows = [row({ billStatus: 'not-in-bill' })]; });
    expect(p.fields.initialLossAmount).toBeUndefined();
  });
});
