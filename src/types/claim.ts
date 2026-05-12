// ═══════════════════════════════════════════════════════════
// MASTER CLAIM DATA INTERFACE
// The single source of truth for all claim state.
// This structure must be able to perfectly reconstruct
// the entire UI state from a serialized JSON file.
// See: SURVEYOS_V2_MASTER_BOOK.md Chapter 6, Section 4
// ═══════════════════════════════════════════════════════════

import type { VehicleDetails, DriverDetails, PolicyDetails, AccidentDetails, VehicleType, DepreciationType } from './vehicle';
import type { AssessmentRow, SpotDamageRow, SpotSurveyDetails, ReinspectionDetails, FeeBill, PhotoItem, PhotoLayout, BillCheckDetails, ExtraBillItem, ValuationDetails } from './assessment';
import type { SurveyType } from './report';

// ─── Report Settings ───────────────────────────────────
/**
 * Controls font density across all report formats (HTML/PDF/Word).
 * - compact   : Current default. Matches existing tight layout exactly.
 * - standard  : Slightly larger — comfortable for screen reading.
 * - large-print: Maximum readability for client-facing sharing.
 */
export type FontScale = 'compact' | 'standard' | 'large-print';

export interface ReportSettings {
  fontScale: FontScale;
}

export interface ClaimData {
  /** Unique claim identifier */
  id: string;
  /** Firebase UID of the user who owns this claim */
  ownerId?: string;
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
  /** Whether the final survey report is fully completed */
  isCompleted: boolean;
  /** Whether this claim is active (false = archived/inactive) */
  isActive: boolean;

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

  // ─── Valuation / Break-in Inspection ──────────────
  valuationDetails: ValuationDetails;

  // ─── Bill Check Report ─────────────────────────────
  billCheck: BillCheckDetails;
  /** Items present in the final workshop bill that did not match any assessment row */
  extraBillItems?: ExtraBillItem[];

  // ─── Document Verification Statuses (Main Claim) ───
  documentVerification: {
    rc: { status: string; detail: string };
    dl: { status: string; detail: string };
    permit: { status: string; detail: string };
    loadChallan: { status: string; detail: string };
    fitness: { status: string; detail: string };
    fireReport: { status: string; detail: string };
    fir: { status: string; detail: string };
  };

  // ─── Photo Sheet ───────────────────────────────────
  photos: PhotoItem[];
  photoLayout: PhotoLayout;
  photoLandscape: boolean;

  // ─── Total Loss Settlement ─────────────────────────
  /**
   * Surveyor-confirmed flag. System may SUGGEST this when Assessment > 75% IDV,
   * but the surveyor must explicitly enable it via the toggle in the Report tab.
   * Defaults to false / undefined on older claims.
   */
  isTotalLoss?: boolean;
  /**
   * Only populated when the surveyor has enabled Total Loss mode.
   * The 4 values feed the UIIC 4-way liability comparison table.
   */
  totalLossDetails?: {
    salvageWithRC: number;
    salvageWithoutRC: number;
    towingExpenses: number;
    workshopRent: number;
    remarks: string;
  };

  // ─── Report Settings ───────────────────────────────
  /**
   * Per-claim font scale preference.
   * Stored here so each claim can have its own density.
   * Falls back to 'compact' on old claims that predate this field.
   */
  reportSettings?: ReportSettings;

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
    isCompleted: false,
    isActive: true,
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
      fitnessNo: '',
      fitnessValidUpto: '',
      route: '',
      grossWeight: null,
      unladenWeight: null,
      registeredLoadWeight: '',
      actualPayload: '',
      odometer: '',
      preAccidentCondition: '',
      registrationType: '',
      registeringAuthority: '',
      registrationValidUpTo: '',
      rcEndorsement: '',
      seatingCapacity: '',
      passengersAtAccident: '',
      passengerType: '',
      goodsWeightAtAccident: '',
      natureOfGoods: '',
      fitnessType: 'NORMAL',
      isCommercial: false,
      passengersContravention: '',
      loadChallanNumber: '',
      loadChallanDate: '',
      detailsOfGoodsCarried: '',
    },

    driver: {
      name: '',
      parentName: '',
      relationType: 'S/o',
      licenceType: '',
      licenceNumber: '',
      dateOfBirth: '',
      dateOfIssue: '',
      address: '',
      issuingAuthority: '',
      vehicleClasses: '',
      validityNonTransport: '',
      validityTransport: '',
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
    },

    accident: {
      dateAndTime: '',
      placeOfAccident: '',
      causeOfAccident: '',
      dateOfSurvey: '',
      placeOfSurvey: '',
      policeStation: '',
      firNumber: '',
      firDate: '',
      fireBrigadeReportNo: '',
      pincode: '',
      locationCode: '',
      appointmentDate: '',
      workshopName: '',
      workshopAddress: '',
      workshopPhone: '',
      workshopFax: '',
      workshopEmail: '',
      remarks: '',
      thirdPartyDetails: '',
    },

    assessmentRows: [],

    spotDetails: {
      reportNo: '',
      reportDate: '',
      allotmentDate: '',
      surveyDatetime: '',
      tpInvolved: 'no',
      policeReported: 'no',
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
      riAppointmentDate: '',
      repairsAsAssessed: 'YES',
      repairAuthDate: '',
      estCompletionDate: '',
      actualCompletionDate: '',
      parts: [],
    },

    feeBill: {
      billDate: '',
      professionalFee: 0,
      riFee: 0,
      travelExpenses: 0,
      travelNote: '',
      distanceKm: 0,
      ratePerKm: 0,
      tollCharges: 0,
      tollNote: '',
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
      feePaid: false,
    },

    valuationDetails: {
      inspectionDate: '',
      inspectionPlace: '',
      odometer: '',
      chassis: '',
      engineTransmission: '',
      suspension: '',
      seats: '',
      electricals: '',
      batteryMake: '',
      batteryCondition: '',
      tyreCount: '',
      stepneyCount: '',
      tyreMake: '',
      tyreCondition: '',
      glassCondition: '',
      panelRows: [],
      toName: '',
      toAddress: '',
      isInsurable: true,
      coverRecommendation: '',
      documentVerificationNote: '',
      enclosures: '',
      remarks: '',
    },

    billCheck: {
      billNo: '',
      billDate: '',
      billTotal: 0,
    },
    extraBillItems: [],

    documentVerification: {
      rc: { status: 'NO', detail: '' },
      dl: { status: 'NO', detail: '' },
      permit: { status: 'NO', detail: '' },
      loadChallan: { status: 'NO', detail: '' },
      fitness: { status: 'NO', detail: '' },
      fireReport: { status: 'NO', detail: '' },
      fir: { status: 'NO', detail: '' },
    },

    photos: [],
    photoLayout: 6,
    photoLandscape: false,
    isTotalLoss: false,
    totalLossDetails: {
      salvageWithRC: 0,
      salvageWithoutRC: 0,
      towingExpenses: 0,
      workshopRent: 0,
      remarks: 'NOTE: Since the assessed repair cost is substantial relative to the IDV, the settlement comparison is provided above for the insurer\'s final decision.'
    },
    reportSettings: { fontScale: 'compact' },
    extractedData: {},
    gDriveFolderId: null,
    telemetrySent: false,
  };
}
