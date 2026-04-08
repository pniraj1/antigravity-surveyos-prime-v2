// ═══════════════════════════════════════════════════════════
// MASTER CLAIM DATA INTERFACE
// The single source of truth for all claim state.
// This structure must be able to perfectly reconstruct
// the entire UI state from a serialized JSON file.
// See: SURVEYOS_V2_MASTER_BOOK.md Chapter 6, Section 4
// ═══════════════════════════════════════════════════════════

import type { VehicleDetails, DriverDetails, PolicyDetails, AccidentDetails, VehicleType, DepreciationType } from './vehicle';
import type { AssessmentRow, SpotDamageRow, SpotSurveyDetails, ReinspectionDetails, FeeBill, PhotoItem, PhotoLayout, BillCheckDetails } from './assessment';
import type { SurveyType } from './report';

export interface ClaimData {
  /** Unique claim identifier */
  id: string;
  /** Creation timestamp */
  createdAt: string; // ISO
  /** Last modified timestamp */
  updatedAt: string; // ISO

  // ─── Claim Classification ──────────────────────────
  surveyType: SurveyType;
  vehicleType: VehicleType;
  depreciationType: DepreciationType;
  /** Whether the spot survey phase is finalized */
  isSpotCompleted: boolean;

  // ─── Report Metadata ───────────────────────────────
  reportNo: string;
  reportDate: string; // ISO date

  // ─── Core Data Sections ────────────────────────────
  vehicle: VehicleDetails;
  driver: DriverDetails;
  policy: PolicyDetails;
  accident: AccidentDetails;

  // ─── Assessment Engine ─────────────────────────────
  assessmentRows: AssessmentRow[];

  // ─── Spot Survey ───────────────────────────────────
  spotDetails: SpotSurveyDetails;
  spotDamageRows: SpotDamageRow[];

  // ─── Reinspection ──────────────────────────────────
  reinspection: ReinspectionDetails;

  // ─── Fee Bill ──────────────────────────────────────
  feeBill: FeeBill;

  // ─── Bill Check Report ─────────────────────────────
  billCheck: BillCheckDetails;

  // ─── Photo Sheet ───────────────────────────────────
  photos: PhotoItem[];
  photoLayout: PhotoLayout;
  photoLandscape: boolean;

  // ─── AI Extraction Cache ───────────────────────────
  extractedData: Record<string, unknown>;

  // ─── Google Drive ──────────────────────────────────
  gDriveFolderId: string | null;

  // ─── Telemetry ─────────────────────────────────────
  telemetrySent: boolean;
}

// ─── Factory: Create a blank claim ──────────────────────
export function createBlankClaim(
  surveyType: SurveyType = 'final',
  vehicleType: VehicleType = 'private'
): ClaimData {
  const now = new Date().toISOString();
  const id = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    createdAt: now,
    updatedAt: now,
    surveyType,
    vehicleType,
    depreciationType: 'standard',
    isSpotCompleted: false,
    reportNo: '',
    reportDate: now.split('T')[0],

    vehicle: {
      registrationNumber: '',
      make: '',
      model: '',
      yearOfManufacture: null,
      chassisNumber: '',
      engineNumber: '',
      cubicCapacity: '',
      colour: '',
      bodyType: '',
      classOfVehicle: '',
      fuel: '',
      dateOfRegistration: '',
      hypothecation: '',
      hpa: '',
      fitnessNo: '',
      fitnessValidUpto: '',
      route: '',
      grossWeight: null,
      rlw: '',
      unladenWeight: null,
      registeredLoadWeight: '',
      actualPayload: '',
      odometer: '',
      preAccidentCondition: '',
      condition: '',
      registrationType: '',
      registeringAuthority: '',
      registrationValidUpTo: '',
      rcEndorsement: '',
      seatingCapacity: '',
      isCommercial: false,
    },

    driver: {
      name: '',
      parentName: '',
      fatherHusbandName: '',
      relationType: 'S/o',
      licenceNumber: '',
      licenseNumber: '',
      dateOfBirth: '',
      dob: '',
      dateOfIssue: '',
      address: '',
      issuingAuthority: '',
      vehicleClasses: '',
      vehicleClass: '',
      validityNonTransport: '',
      validityTransport: '',
      validTo: '',
      verificationStatus: 'verified',
      invalidRemarks: '',
      badgeNumber: '',
      authorisedToDrive: '',
      verificationDate: '',
    },

    policy: {
      policyNumber: '',
      claimNumber: '',
      insurerName: '',
      insuredName: '',
      insuredAddress: '',
      insuredMobile: '',
      idv: '',
      policyType: '',
      periodFrom: '',
      periodTo: '',
      policyIssuingOffice: '',
      appointingOffice: '',
      hpaWith: '',
      hpa: '',
    },

    accident: {
      dateAndTime: '',
      placeOfAccident: '',
      causeOfAccident: '',
      dateOfSurvey: '',
      placeOfSurvey: '',
      policeStation: '',
      firNumber: '',
      thirdPartyDetails: '',
    },

    assessmentRows: [],

    spotDetails: {
      reportNo: '',
      reportDate: '',
      allotmentDate: '',
      surveyDatetime: '',
      surveyPlace: '',
      driverName: '',
      dlParentName: '',
      dlRelation: '',
      mdlNo: '',
      dlAuthority: '',
      dlType: '',
      dlIssueDate: '',
      dlValidNT: '',
      dlValidT: '',
      mdlVerified: '',
      dlInvalidRemarks: '',
      tpInvolved: 'no',
      tpDetails: '',
      policeReported: 'no',
      policeStation: '',
      diaryNo: '',
      panchanama: 'no',
      damageSeverity: 'moderate',
      airbags: 'no',
      drivable: 'yes',
      comments: '',
      repairs: '',
      enclosures: '',
      permitNo: '',
      permitType: '',
      permitFrom: '',
      permitTo: '',
      natureOfPermit: '',
      areaOfOperation: '',
      fitnessNo: '',
      fitnessValid: '',
      fitnessType: '',
      authNo: '',
      authValid: '',
      verificationFlags: {
        rc: '',
        dl: '',
        permit: '',
        fitness: '',
        loadChallan: '',
        fireReport: '',
        fir: '',
      },
      gvw: null,
      ulw: null,
      loadCapacity: null,
      actualLoad: null,
      challanNo: '',
      challanDate: '',
      loadDesc: '',
      loadOrigin: '',
      loadDest: '',
      repairWorkshop: '',
    },

    spotDamageRows: [],

    reinspection: {
      refNo: '',
      date: '',
      surveyRef: '',
      surveyDate: '',
      repairQuality: 'satisfactory',
      vehicleCondition: 'roadworthy',
      salvageStatus: 'na',
      observations: '',
      parts: [],
    },

    feeBill: {
      billDate: '',
      professionalFee: 0,
      riFee: 0,
      travelExpenses: 0,
      travelNote: '',
      photosCount: 0,
      photoRate: 0,
      postalCharges: 0,
      haltageCharges: 0,
      includeGST: false,
      advanceReceipt: '',
      cashReceived: '',
      salvageValue: 0,
      lessExcess: 0,
      compulsoryExcess: 0,
      voluntaryExcess: 0,
    },

    billCheck: {
      billNo: '',
      billDate: '',
      billTotal: 0,
    },

    photos: [],
    photoLayout: 6,
    photoLandscape: false,
    extractedData: {},
    gDriveFolderId: null,
    telemetrySent: false,
  };
}
