import { describe, it, expect } from 'vitest';
import { computeInsuredFinancialSummary } from '../insured-report';
import type { ClaimData } from '@/types/claim';

function makeMinimalClaim(overrides: Partial<ClaimData> = {}): ClaimData {
  return {
    id: 'test-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    surveyType: 'final',
    vehicleType: 'private',
    depreciationType: 'standard',
    isSpotCompleted: false,
    isCompleted: false,
    isActive: true,
    reportNo: '',
    reportDate: '2026-01-01',
    vehicle: { registrationNumber: '', make: '', model: '', yearOfManufacture: 2020, dateOfRegistration: '2020-01-01', chassisNumber: '', engineNumber: '', cubicCapacity: '', colour: '', bodyType: '', classOfVehicle: '', fuel: '', fitnessNo: '', fitnessValidUpto: '', route: '', grossWeight: null, unladenWeight: null, registeredLoadWeight: '', actualPayload: '', odometer: '', preAccidentCondition: '', registrationType: '', registeringAuthority: '', registrationValidUpTo: '', rcEndorsement: '', seatingCapacity: '', passengersAtAccident: '', passengerType: '', goodsWeightAtAccident: '', natureOfGoods: '', fitnessType: 'NORMAL', isCommercial: false, passengersContravention: '', loadChallanNumber: '', loadChallanDate: '', detailsOfGoodsCarried: '', hypothecation: '' },
    driver: { name: '', parentName: '', relationType: 'S/o', licenceType: '', licenceNumber: '', dateOfBirth: '', dateOfIssue: '', address: '', issuingAuthority: '', vehicleClasses: '', validityNonTransport: '', validityTransport: '', verificationStatus: 'verified', invalidRemarks: '', badgeNumber: '', authorisedToDrive: '', verificationDate: '' },
    policy: { policyNumber: '', claimNumber: '', insurerName: '', insuredName: 'Test Insured', insuredAddress: '', insuredMobile: '', idv: '500000', policyType: 'Comprehensive', periodFrom: '', periodTo: '', policyIssuingOffice: '', appointingOffice: '', hpaWith: '' },
    accident: { dateAndTime: '', placeOfAccident: '', causeOfAccident: '', dateOfSurvey: '', placeOfSurvey: '', policeStation: '', firNumber: '', firDate: '', fireBrigadeReportNo: '', pincode: '', locationCode: '', appointmentDate: '', workshopName: '', workshopAddress: '', workshopPhone: '', workshopFax: '', workshopEmail: '', remarks: '', thirdPartyDetails: '' },
    assessmentRows: [],
    spotDetails: { reportNo: '', reportDate: '', allotmentDate: '', surveyDatetime: '', tpInvolved: 'no', policeReported: 'no', panchanama: 'no', damageSeverity: 'moderate', airbags: 'no', drivable: 'yes', comments: '', repairs: '', enclosures: '', permitNo: '', permitType: '', permitFrom: '', permitTo: '', natureOfPermit: '', areaOfOperation: '', fitnessType: '', authNo: '', authValid: '', verificationFlags: { rc: '', dl: '', permit: '', fitness: '', loadChallan: '', fireReport: '', fir: '' }, gvw: null, ulw: null, loadCapacity: null, actualLoad: null, challanNo: '', challanDate: '', loadDesc: '', loadOrigin: '', loadDest: '', repairWorkshop: '' },
    spotDamageRows: [],
    reinspection: { refNo: '', date: '', surveyRef: '', surveyDate: '', repairQuality: 'satisfactory', vehicleCondition: 'roadworthy', salvageStatus: 'na', observations: '', parts: [] },
    feeBill: { billDate: '', professionalFee: 0, riFee: 0, travelExpenses: 0, travelNote: '', photosCount: 0, photoRate: 0, postalCharges: 0, haltageCharges: 0, includeGST: false, advanceReceipt: '', cashReceived: '', salvageValue: 0, lessExcess: 5000, compulsoryExcess: 5000, voluntaryExcess: 0, feePaid: false },
    valuationDetails: { inspectionDate: '', inspectionPlace: '', odometer: '', chassis: '', engineTransmission: '', suspension: '', seats: '', electricals: '', batteryMake: '', batteryCondition: '', tyreCount: '', stepneyCount: '', tyreMake: '', tyreCondition: '', glassCondition: '', panelRows: [], toName: '', toAddress: '', isInsurable: true, coverRecommendation: '', documentVerificationNote: '', enclosures: '', remarks: '' },
    billCheck: { billNo: '', billDate: '', billTotal: 0 },
    extraBillItems: [],
    documentVerification: { rc: { status: 'NO', detail: '' }, dl: { status: 'NO', detail: '' }, permit: { status: 'NO', detail: '' }, loadChallan: { status: 'NO', detail: '' }, fitness: { status: 'NO', detail: '' }, fireReport: { status: 'NO', detail: '' }, fir: { status: 'NO', detail: '' } },
    photos: [],
    photoLayout: 6,
    photoLandscape: false,
    extractedData: {},
    gDriveFolderId: null,
    telemetrySent: false,
    ...overrides,
  } as ClaimData;
}

describe('computeInsuredFinancialSummary', () => {
  it('returns zero insuredPays when no rows and no bill', () => {
    const claim = makeMinimalClaim();
    const result = computeInsuredFinancialSummary(claim, 24);
    expect(result.garageEstimate).toBe(0);
    expect(result.insuredPays).toBe(0);
  });

  it('uses billCheck.billTotal as garageEstimate when bill check is done', () => {
    const claim = makeMinimalClaim({ billCheck: { billNo: 'B1', billDate: '2026-01-01', billTotal: 25000 } });
    const result = computeInsuredFinancialSummary(claim, 24);
    expect(result.garageEstimate).toBe(25000);
  });

  it('computes excessTotal as compulsoryExcess + voluntaryExcess', () => {
    const claim = makeMinimalClaim({
      feeBill: { billDate: '', professionalFee: 0, riFee: 0, travelExpenses: 0, travelNote: '', photosCount: 0, photoRate: 0, postalCharges: 0, haltageCharges: 0, includeGST: false, advanceReceipt: '', cashReceived: '', salvageValue: 0, lessExcess: 3000, compulsoryExcess: 2000, voluntaryExcess: 1000, feePaid: false },
    });
    const result = computeInsuredFinancialSummary(claim, 24);
    expect(result.excessTotal).toBe(3000);
  });

  it('insuredPays = garageEstimate - insurerPays (never negative)', () => {
    const claim = makeMinimalClaim({
      billCheck: { billNo: 'B1', billDate: '2026-01-01', billTotal: 20000 },
      assessmentRows: [
        { id: 'r1', particulars: 'Front bumper', estimated: 10000, assessed: 8000, partType: 'plastic', section: 'parts', allowed: true, action: 'replace', gst: 18, billStatus: 'in-bill', billedAmount: 20000 },
      ],
      feeBill: { billDate: '', professionalFee: 0, riFee: 0, travelExpenses: 0, travelNote: '', photosCount: 0, photoRate: 0, postalCharges: 0, haltageCharges: 0, includeGST: false, advanceReceipt: '', cashReceived: '', salvageValue: 2000, lessExcess: 2000, compulsoryExcess: 2000, voluntaryExcess: 0, feePaid: false },
    });
    const result = computeInsuredFinancialSummary(claim, 24);
    expect(result.insuredPays).toBeGreaterThanOrEqual(0);
    expect(result.insuredPays).toBe(result.garageEstimate - result.insurerPays);
  });
});
