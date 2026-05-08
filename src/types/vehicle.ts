// ═══════════════════════════════════════════════════════════
// VEHICLE, DRIVER & POLICY TYPES
// Mirrors legacy Surveyor_V6_MASTER.html field structure
// ═══════════════════════════════════════════════════════════

import type { InsuredReportSettings } from './insured-report';

export type FuelType = 'Petrol' | 'Diesel' | 'CNG' | 'LPG' | 'Electric' | 'Hybrid' | 'Petrol+CNG' | 'Petrol+LPG';

export type VehicleType = 'private' | 'comm-passenger' | 'comm-goods';

export type PolicyType =
  | 'Comprehensive'
  | 'Third Party'
  | 'Standalone OD'
  | 'Package'
  | 'Commercial Comprehensive'
  | 'Commercial TP';

export type DepreciationType = 'standard' | 'nil';

export type DLRelation = 'S/o' | 'D/o' | 'W/o';

export type DLVerificationStatus = 'verified' | 'photocopy' | 'not-available';

export interface VehicleDetails {
  registrationNumber: string;
  make: string;
  model: string;
  yearOfManufacture: number | null;
  chassisNumber: string;
  engineNumber: string;
  cubicCapacity: string;
  colour: string;
  bodyType: string;
  classOfVehicle: string;
  fuel: FuelType | string;
  dateOfRegistration: string; // ISO date
  hypothecation: string;
  fitnessNo: string;
  fitnessValidUpto: string; // ISO date
  route: string;
  grossWeight: number | null;
  unladenWeight: number | null;
  registeredLoadWeight: string;
  actualPayload: string;
  odometer: string;
  preAccidentCondition: string;
  registrationType: string;
  registeringAuthority: string;
  registrationValidUpTo: string; // ISO date
  rcEndorsement: string;
  seatingCapacity: string;
  passengersAtAccident?: string;
  passengerType?: string;
  goodsWeightAtAccident?: string;
  natureOfGoods?: string;
  fitnessType?: string;
  isCommercial: boolean;
  passengersContravention?: string;
  loadChallanNumber?: string;
  loadChallanDate?: string;
  detailsOfGoodsCarried?: string;
}

export interface DriverDetails {
  name: string;
  parentName: string;
  relationType: DLRelation;
  licenceType?: string; // e.g. MCWG, LMV-TR
  licenceNumber: string;
  dateOfBirth: string; // ISO date
  dateOfIssue: string; // ISO date
  address: string; // Added for AI mapping
  issuingAuthority: string;
  vehicleClasses: string;
  validityNonTransport: string; // ISO date
  validityTransport: string; // ISO date
  verificationStatus: DLVerificationStatus;
  invalidRemarks: string;
  badgeNumber: string;
  authorisedToDrive: string;
  verificationDate: string; // ISO date
}

export interface PolicyDetails {
  policyNumber: string;
  claimNumber: string;
  insurerName: string;
  insuredName: string;
  insuredAddress: string;
  insuredMobile: string;
  idv: string;
  policyType: PolicyType | string;
  periodFrom: string; // ISO date
  periodTo: string; // ISO date
  policyIssuingOffice: string;
  appointingOffice: string;
  hpaWith: string;
}

export interface AccidentDetails {
  dateAndTime: string; // ISO datetime-local
  placeOfAccident: string;
  causeOfAccident: string;
  dateOfSurvey: string; // ISO date
  placeOfSurvey: string;
  policeStation: string;
  firNumber: string;
  firDate?: string;
  fireBrigadeReportNo?: string;
  pincode?: string;
  locationCode?: string;
  appointmentDate?: string;
  thirdPartyDetails: string;
  workshopName?: string;
  workshopAddress?: string;
  workshopPhone?: string;
  workshopFax?: string;
  workshopEmail?: string;
  remarks?: string; // Surveyor Remarks
}

export interface SurveyorProfile {
  name: string;
  qualifications: string;
  licenceNumber: string;
  licenceExpiry: string;
  iiislaNumber: string;
  code: string;
  categories: string;
  mobile: string;
  city?: string;
  state?: string;
  email: string;
  address: string;
  gstNumber: string;
  bankName: string;
  bankAccount: string;
  bankIFSC: string;
  panNumber: string;
  // ─── AI Configuration ─────────────────────────────────
  /** Which provider to use as primary */
  aiProvider: 'groq' | 'gemini' | 'nvidia';
  /** Up to 3 Gemini API keys — rotated automatically on rate-limit/error */
  geminiApiKeys: string[];
  /** Up to 3 Groq API keys — rotated automatically on rate-limit/error */
  groqApiKeys: string[];
  /** Up to 3 NVIDIA NIM API keys — used as automatic 3rd-provider fallback */
  nvidiaApiKeys: string[];
  /** @deprecated — use geminiApiKeys[0]. Kept for backward-compat migration. */
  geminiApiKey: string;
  /** @deprecated — use groqApiKeys[0]. Kept for backward-compat migration. */
  groqApiKey: string;
  /** Optional model override for Gemini. Blank = developer default. */
  geminiModel?: string;
  /** Optional model override for Groq. Blank = developer default. */
  groqModel?: string;
  /** Optional model override for NVIDIA NIM. Blank = developer default. */
  nvidiaModel?: string;
  /** Insured Report (Premium) — admin-controlled feature gate */
  insuredReportSettings?: InsuredReportSettings;
  /** Legacy Google OAuth client id */
  googleClientId: string;
  /** Whether to automatically upload photos and documents to Drive */
  autoUploadDrive?: boolean;
  /** Override PDF extraction mode. 'auto' = smart detect (default). */
  aiDocMode?: 'auto' | 'text' | 'vision';
  // ─── Subscription & Administrative ────────────────────
  /** Unique platform ID (e.g. SUS-1001) */
  surveyorId: string;
  /** Sequential counter for spot reports */
  spotSequence?: number;
  /** Sequential counter for final/reinspection/billcheck reports */
  finalSequence?: number;
  /** Sequential counter for fee bills */
  feeSequence?: number;
  /** Current year for report numbering (auto-resets usually) */
  reportYear?: number;
  /** 'active', 'expired', or 'suspended' */
  subscriptionStatus: 'active' | 'expired' | 'suspended' | 'pending';
  /** ISO date string for subscription expiration, null for pending/unset accounts */
  subscriptionExpiry: string | null;
  /** Whether this user can manage other subscriptions */
  isAdmin: boolean;
  // ─── Signature & Stamp ────────────────────────────────
  signatureDataUrl: string | null;
  stampDataUrl: string | null;
  // ─── Access Request ────────────────────────────────────
  /** Set to true once the surveyor submits the registration form */
  accessRequestSubmitted: boolean;
  /** IRDAI Licence number — submitted at registration, editable by surveyor */
  irdaiLicence: string;
  /** Set by admin when dismissing a request, shown to surveyor on re-submit form */
  dismissReason?: string;
}
