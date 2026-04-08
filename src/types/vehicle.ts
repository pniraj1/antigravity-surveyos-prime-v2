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
  hpa: string; // Alias for consistency
  fitnessNo: string;
  fitnessValidUpto: string; // ISO date
  route: string;
  grossWeight: number | null;
  rlw: string; // Registered Load Weight (string for commercial)
  unladenWeight: number | null;
  registeredLoadWeight: string;
  actualPayload: string;
  odometer: string;
  preAccidentCondition: string;
  condition: string; // Alias for spot report compatibility
  registrationType: string;
  registeringAuthority: string;
  registrationValidUpTo: string; // ISO date
  rcEndorsement: string;
  seatingCapacity: string;
  isCommercial: boolean;
}

export interface DriverDetails {
  name: string;
  parentName: string;
  fatherHusbandName: string; // Mirror AI key
  relationType: DLRelation;
  licenceNumber: string;
  licenseNumber: string;
  dateOfBirth: string; // ISO date
  dob: string; // Alias
  dateOfIssue: string; // ISO date
  address: string; // Added for AI mapping
  issuingAuthority: string;
  vehicleClasses: string;
  vehicleClass: string; // Alias
  validityNonTransport: string; // ISO date
  validityTransport: string; // ISO date
  validTo: string; // Composite alias
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
  hpa: string; // Alias
}

export interface AccidentDetails {
  dateAndTime: string; // ISO datetime-local
  placeOfAccident: string;
  causeOfAccident: string;
  dateOfSurvey: string; // ISO date
  placeOfSurvey: string;
  policeStation: string;
  firNumber: string;
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
  /** Sequential counter for spot reports */
  spotSequence?: number;
  /** Sequential counter for fee bills */
  feeSequence?: number;
  /** Current year for report numbering (auto-resets usually) */
  reportYear?: number;
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
