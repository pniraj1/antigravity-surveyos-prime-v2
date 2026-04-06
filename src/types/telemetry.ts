// ═══════════════════════════════════════════════════════════
// HIVE MIND TELEMETRY PAYLOAD
// ~5-10KB JSON sent silently on report finalization
// See: SURVEYOS_V2_MASTER_BOOK.md Chapter 4
// ═══════════════════════════════════════════════════════════

export interface TelemetryPayload {
  /** Unique claim fingerprint (hashed, not PII) */
  claimHash: string;
  timestamp: string; // ISO

  // ─── Financial & Fraud Metrics ──────────────────────
  estimatedAmount: number;
  assessedAmount: number;
  netAssessedLoss: number;
  idv: number;
  salvageValue: number;
  policyExcess: number;
  /** Repair Cost / IDV ratio — if > 0.75, triggers TOTAL_LOSS flag */
  repairToIdvRatio: number;
  totalLossFlag: boolean;

  // ─── Granular Part Data ─────────────────────────────
  partsCount: number;
  labourCount: number;
  disallowedCount: number;
  depreciationType: string;
  depreciationRate: number; // weighted average

  // ─── Context & Demographics ─────────────────────────
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number | null;
  vehicleAgeMonths: number;
  vehicleType: string;
  fuelType: string;
  odometerReading: string;

  // ─── Spatial & Temporal ─────────────────────────────
  causeOfLoss: string;
  /** GPS coordinates if available */
  gpsLat?: number;
  gpsLng?: number;
  /** State/city derived from registration number */
  regionCode: string;
  dateOfAccident: string;
  dateOfSurvey: string;

  // ─── Entities ───────────────────────────────────────
  insurerName: string;
  workshopCategory: 'authorized' | 'local' | 'unknown';
  surveyType: string;
  reportType: string;

  // ─── Learning Engine Snapshot ───────────────────────
  spotDamageComponents: string[];
  aiExtractionUsed: boolean;
  voiceInputUsed: boolean;
}

export interface LearningData {
  disallowances: DisallowancePattern[];
  depPatterns: DepPattern[];
  feePatterns: FeePattern[];
  damageDescriptions: DamageDescription[];
  spotPhotoPatterns: SpotPhotoPattern[];
}

export interface DisallowancePattern {
  part: string;
  insurer: string;
  vehicleType: string;
  count: number;
  last: string;
  source?: 'manual' | 'photo-final';
  photoSeverity?: string;
  photoDamageType?: string;
  outcome?: 'disallowed' | 'not-assessed' | 'allowed';
}

export interface DepPattern {
  ageMonths: number;
  vehicleType: string;
  depType: string;
  count: number;
}

export interface FeePattern {
  surveyType: string;
  insurer: string;
  prof: number;
  travel: number;
  count: number;
}

export interface DamageDescription {
  text: string;
  vehicleType: string;
  surveyType: string;
  insurer: string;
  count: number;
  last: string;
}

export interface SpotPhotoPattern {
  part: string;
  vehicleType: string;
  count: number;
  notedCount: number;
  majorCount: number;
  photoDamageType: string;
  last: string;
}
