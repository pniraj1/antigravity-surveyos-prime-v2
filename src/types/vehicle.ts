// ═══════════════════════════════════════════════════════════
// VEHICLE, DRIVER & POLICY TYPES
// Mirrors legacy Surveyor_V6_MASTER.html field structure
// ═══════════════════════════════════════════════════════════

export type FuelType = 'Petrol' | 'Diesel' | 'CNG' | 'LPG' | 'Electric' | 'Hybrid' | 'Petrol+CNG' | 'Petrol+LPG';

export type VehicleType = 'private' | 'comm-passenger' | 'comm-goods';

export type PolicyType =
  | 'Comprehensive'
  | 'Third Party'
  | 'Standalone OD'
  | 'Package'
  | 'Commercial Comprehensive'
  | 'Commercial TP';

export type DepreciationType = 'standard' | 'nil' | 'zero';

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
  route: string;
  grossWeight: number | null;
  unladenWeight: number | null;
  registeredLoadWeight: string;
  odometer: string;
  preAccidentCondition: string;
  seatingCapacity: string;
}

export interface DriverDetails {
  name: string;
  parentName: string;
  relationType: DLRelation;
  licenceNumber: string;
  dateOfBirth: string; // ISO date
  dateOfIssue: string; // ISO date
  issuingAuthority: string;
  vehicleClasses: string;
  validityNonTransport: string; // ISO date
  validityTransport: string; // ISO date
  verificationStatus: DLVerificationStatus;
  invalidRemarks: string;
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
  thirdPartyDetails: string;
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
  email: string;
  address: string;
  gstNumber: string;
  bankName: string;
  bankAccount: string;
  bankIFSC: string;
  panNumber: string;
  // ─── AI Configuration ─────────────────────────────────
  /** Which provider to use: 'groq' | 'gemini' */
  aiProvider: 'groq' | 'gemini';
  /** Groq API key (free tier, high-speed) */
  groqApiKey: string;
  /** Override model name — defaults are safe but can be changed without rebuilding */
  groqModel: string;
  /** Google Gemini API key (Google AI Studio — free tier) */
  geminiApiKey: string;
  /** Gemini model override — e.g. gemini-2.0-flash, gemini-1.5-pro */
  geminiModel: string;
  /** Legacy Google OAuth client id */
  googleClientId: string;
  // ─── Subscription & Administrative ────────────────────
  /** Unique platform ID (e.g. SUS-1001) */
  surveyorId: string;
  /** 'active', 'expired', or 'suspended' */
  subscriptionStatus: 'active' | 'expired' | 'suspended';
  /** ISO date string for subscription expiration */
  subscriptionExpiry: string;
  /** Whether this user can manage other subscriptions */
  isAdmin: boolean;
  // ─── Signature & Stamp ────────────────────────────────
  signatureDataUrl: string | null;
  stampDataUrl: string | null;
}
