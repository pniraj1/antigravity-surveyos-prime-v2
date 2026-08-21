// ═══════════════════════════════════════════════════════════
// ASSESSMENT ENGINE TYPES
// Mirrors: assessRows[], spotDamageRows[], riParts[], recalcSummary()
// from Surveyor_V6_MASTER.html
// ═══════════════════════════════════════════════════════════

import type { DeductionCategory } from '@/lib/constants/deduction-categories';

export type PartType = 'metal' | 'plastic' | 'glass' | 'fiberglass' | 'labour' | 'paint';
export type AssessmentSection = 'parts' | 'labour' | 'paint';

export type BillStatus = 'in-bill' | 'not-in-bill' | 'pending' | 'not-allowed';

export interface ExtraBillItem {
  id: string;
  description: string;
  /** Total incl GST, as billed. */
  amount: number;
  /** Pre-GST basis — what promotion to an AssessmentRow needs. */
  taxableAmount: number;
  gstPercent: number;
  partNumber?: string;
  hsnSac?: string;
  section: AssessmentSection;
  category?: 'spare_parts' | 'labour' | 'painting';
  source: 'final-bill';
}


export interface AssessmentRow {
  id: string;
  /** Original serial number from the estimate (preserves invoice order) */
  srNo?: number;
  particulars: string;
  /** OEM part number (e.g. "56100-0R190") */
  partNumber?: string;
  /** HSN code for parts (87xx) or SAC code for labour/paint (9987xx) */
  hsnSac?: string;
  /** Quantity from the estimate */
  quantity?: number;
  /** Per-unit price before tax */
  unitPrice?: number;
  estimated: number;
  assessed: number;
  /** Billed taxable (net) amount — before GST, from workshop's final bill */
  billedTaxable?: number;
  /** Billed total (incl GST) from workshop's final bill */
  billedAmount?: number;
  billStatus?: BillStatus;
  billRemarks?: string;
  /**
   * Bill-check allowance, pre-GST. When set, the Bill Check report uses this
   * in place of `assessed`. The Final Survey Report never reads it, so allowing
   * a workshop's higher figure cannot rewrite a report already filed.
   */
  billAllowed?: number;
  /**
   * The surveyor has looked at this row's billed figure against the bill.
   *
   * Set by either button on a divergence flag. Nothing else derives from it —
   * the flag itself is computed, not stored — but printing is gated on every
   * divergent row carrying it.
   */
  billVerified?: boolean;
  partType: PartType;
  /**
   * The partType this row carried before it was last moved out of the `parts`
   * section. Restores the original type when the row is moved back, so a round
   * trip through Labour cannot silently re-price the item.
   */
  previousPartType?: PartType;
  gst: number; // percentage, default 18
  section: AssessmentSection;
  allowed: boolean;
  /** Surveyor action: REPLACE / REPAIR / DISALLOW */
  action?: 'replace' | 'repair' | 'disallow' | '';
  /** Surveyor remarks for this line item */
  remarks?: string;
  /**
   * Disposal / used part flag.
   * When true: no GST is applied on this row.
   * Net = assessed × (1 − dep%) × (disposalPercent / 100)
   */
  isDisposal?: boolean;
  /**
   * Surveyor's allowed percentage of the depreciated value for a disposal item.
   * Industry norm is 50%. Range 0–100. Only meaningful when isDisposal = true.
   */
  disposalPercent?: number;
  /**
   * Surveyor's manual depreciation override for this row (0–100).
   * When set, supersedes the IRDAI auto-calculated rate.
   * Leave undefined to revert to the standard rate.
   */
  depOverride?: number;
  /** Set by surveyor via tag pills in AssessmentGrid. Skips AI classification when present. */
  deductionCategory?: DeductionCategory;
  /**
   * Row origin.
   *   undefined       = added by hand by the surveyor. Never touched by an upload.
   *   'estimate'      = created from the primary estimate. Replaced when that
   *                     estimate is re-scanned.
   *   'supplementary' = created from a supplementary estimate. Only ever appended;
   *                     re-scanning the primary leaves these alone.
   */
  source?: 'estimate' | 'supplementary';
}

export interface AssessmentSummary {
  // Parts breakdown (after depreciation)
  metalTotal: number;
  plasticTotal: number;
  glassTotal: number;
  fiberglassTotal: number;
  partsBase: number; // metal + plastic + glass + fiberglass
  partsCGST: number; // partsBase * 0.09
  partsSGST: number; // partsBase * 0.09
  partsTotal: number; // partsBase + CGST + SGST

  // Labour + Paint
  labourBase: number;
  labourGST: number; // labourBase * 0.18
  labourTotal: number; // labourBase + labourGST

  /**
   * Per-material totals including GST, accumulated per row at that row's own
   * rate. Never `base × 1.18` — a claim can hold several rates.
   * These four sum to `partsTotal`.
   */
  metalTotalInclGst: number;
  plasticTotalInclGst: number;
  glassTotalInclGst: number;
  fiberglassTotalInclGst: number;

  /** Labour only, excluding painting. */
  labourOnlyBase: number;
  labourOnlyTotal: number;
  /** Painting only, excluding labour. */
  paintOnlyBase: number;
  paintOnlyTotal: number;
  estimateLabourOnlyBase: number;
  estimatePaintOnlyBase: number;

  // Totals
  grandTotal: number; // partsTotal + labourTotal
  salvage: number;
  compulsoryExcess: number;
  voluntaryExcess: number;
  excess: number; // For legacy support/total
  netAssessedLoss: number; // max(0, grandTotal - salvage - compulsoryExcess - voluntaryExcess)
  netInWords: string;

  // ─── Estimated Totals (from Invoice) ────────────────
  totalEstimated: number;
  estimatePartsBase: number;
  // Per-material estimate subtotals, every row — an estimate is a fact about
  // the garage's document, unlike metalTotal etc. which are allowed-only.
  estimateMetalBase: number;
  estimatePlasticBase: number;
  estimateGlassBase: number;
  estimateFiberglassBase: number;
  estimatePartsGST: number;
  estimatePartsTotal: number;
  estimateLabourBase: number;
  estimateLabourGST: number;
  estimateLabourTotal: number;
  estimateGrossTotal: number;
}

// ─── SPOT SURVEY DAMAGE ─────────────────────────────────
export interface SpotDamageRow {
  id: string;
  component: string;
  damage: string;
}

export type DamageSeverity = 'minor' | 'moderate' | 'major';

export interface SpotSurveyDetails {
  // ─── Spot Report Metadata ────────────────────────────
  reportNo: string;
  reportDate: string;
  allotmentDate: string;
  surveyDatetime: string;

  // ─── Spot-Only Scene Assessment ──────────────────────
  // NOTE: Driver fields (name, DL, validity) live in ClaimData.driver
  // NOTE: Accident fields (policeStation, FIR, place) live in ClaimData.accident
  // NOTE: Vehicle fields (fitnessNo, fitnessValidUpto) live in ClaimData.vehicle
  tpInvolved: string;          // Enriched enum: no | tppd | tppi | both
  policeReported: string;      // yes | no
  panchanama: string;          // yes | no
  damageSeverity: DamageSeverity;
  airbags: string;
  drivable: string;
  comments: string;
  repairs: string;
  enclosures: string;

  // ─── Commercial (Spot-Only) ──────────────────────────
  permitNo: string;
  permitType: string;
  permitFrom: string;
  permitTo: string;
  natureOfPermit: string;
  areaOfOperation: string;
  fitnessType: string;
  authNo: string;
  authValid: string;
  verificationFlags: {
    rc: string;
    dl: string;
    permit: string;
    fitness: string;
    loadChallan: string;
    fireReport: string;
    fir: string;
  };

  // ─── Goods / Load Details ────────────────────────────
  gvw: number | null;
  ulw: number | null;
  loadCapacity: number | null;
  actualLoad: number | null;
  /** Surveyor's explicit choice to flag overload/overweight in the report.
   *  Overload is NOT auto-flagged red — the surveyor opts in via the Spot tab. */
  flagOverload: boolean;
  challanNo: string;
  challanDate: string;
  loadDesc: string;
  loadOrigin: string;
  loadDest: string;
  repairWorkshop: string;
}

// ─── RE-INSPECTION ──────────────────────────────────────
export type RIPartStatus = 'replaced' | 'repaired' | 'not-replaced';

export interface RIPart {
  id: string;
  particulars: string;
  assessed: number;
  status: RIPartStatus;
  remarks: string;
}

export type RepairQuality = 'satisfactory' | 'good' | 'partial' | 'unsatisfactory';
export type VehicleCondition = 'roadworthy' | 'needs-attention' | 'not-roadworthy';
export type SalvageStatus = 'collected' | 'not-collected' | 'partial' | 'na';

export interface ReinspectionDetails {
  refNo: string;
  date: string;
  surveyRef: string;
  surveyDate: string;
  riAppointmentDate?: string;
  repairsAsAssessed?: 'YES' | 'NO' | 'PARTIAL';
  repairAuthDate?: string;
  estCompletionDate?: string;
  actualCompletionDate?: string;
  repairQuality: RepairQuality;
  vehicleCondition: VehicleCondition;
  salvageStatus: SalvageStatus;
  observations: string;
  parts: RIPart[];
}

// ─── FEE BILL ───────────────────────────────────────────
export interface FeeBill {
  billDate: string;
  professionalFee: number;
  riFee: number;
  /** @deprecated Retained for backward compatibility with older claims; new code should use distanceKm/ratePerKm + tollCharges. */
  travelExpenses: number;
  travelNote: string;
  distanceKm: number;
  ratePerKm: number;
  tollCharges: number;
  tollNote: string;
  photosCount: number;
  photoRate: number;
  postalCharges: number;
  haltageCharges: number;
  includeGST: boolean;
  advanceReceipt: string;
  cashReceived: string;
  salvageValue: number;
  /**
   * Bill-check-only salvage. `undefined` means "rescale salvageValue by how
   * far the metal basis has moved"; a number is the surveyor's decision and
   * is used as typed. Zero is a decision, which is why this is optional with
   * no default rather than defaulting to 0.
   */
  billSalvage?: number;
  lessExcess: number; // Compulsory Excess
  voluntaryExcess: number;
  compulsoryExcess: number;
  /** Whether the surveyor fee has been received from the insurer */
  feePaid: boolean;
}

// ─── PHOTO SHEET ────────────────────────────────────────
export interface PhotoItem {
  dataUrl: string;
  name: string;
  /** Original pixel width captured at upload time (used for orientation detection) */
  w?: number;
  /** Original pixel height captured at upload time (used for orientation detection) */
  h?: number;
  /**
   * Which output this image belongs to. 'document' items render in the Document
   * Annexure and never in the damage photo sheet. Undefined is treated as
   * 'damage', which keeps every claim created before this field existed valid.
   */
  kind?: 'damage' | 'document';
}

/** Number of photos to show per A4 page */
export type PhotoLayout = 2 | 4 | 6 | 8 | 9;

/** Runtime options for the PDF photo sheet (not persisted to claim) */
export type PageOrientation = 'portrait' | 'landscape';

export interface PhotoSheetOptions {
  /** Page padding in points (15–45, default 30) */
  pagePadding: number;
  /** Gap between photo cells in points (4–20, default 10) */
  cellGap: number;
  /** Show border around each photo cell */
  showBorder: boolean;
  /** Border colour (CSS hex) */
  borderColor: string;
  /** Manual page orientation override */
  pageOrientation?: PageOrientation;
}

// ─── DOCUMENT ANNEXURE ──────────────────────────────────
/** Number of documents per A4 page. */
export type DocumentLayout = 1 | 2 | 4;

/**
 * Persisted on the claim (unlike PhotoSheetOptions, which is runtime-only)
 * because the surveyor customises the attestation strip per claim.
 */
export interface DocumentAnnexureOptions {
  layout: DocumentLayout;
  pageOrientation: PageOrientation;
  /** Master toggle. When false no attestation strip is rendered at all. */
  verified: boolean;
  /** Include the "IRDAI: … · IIISLA: …" line. */
  showLicence: boolean;
  /** Include the "<place> · <date>" line. */
  showDatePlace: boolean;
  place: string;
  /** ISO date (YYYY-MM-DD). */
  verifiedDate: string;
  pagePadding: number;
  cellGap: number;
  showBorder: boolean;
  borderColor: string;
}

export interface BillCheckDetails {
  billNo: string;
  billDate: string;
  billTotal: number;
}

export interface BillCheckSummary {
  grandTotalAssessed: number;
  grandTotalBilled: number;
  notInBillTotal: number;
  variance: number;
  salvage: number;
  compulsoryExcess: number;
  voluntaryExcess: number;
  excess: number;
  netLiability: number;
  netInWords: string;
}

// ─── Valuation / Break-in Inspection ──────────────────────────────────────────

export interface ValuationConditionRow {
  id: string;
  component: string;
  condition: string;
}

export interface ValuationDetails {
  inspectionDate: string;
  inspectionPlace: string;
  odometer: string;

  chassis: string;
  engineTransmission: string;
  suspension: string;
  seats: string;
  electricals: string;

  batteryMake: string;
  batteryCondition: string;

  tyreCount: string;
  stepneyCount: string;
  tyreMake: string;
  tyreCondition: string;

  glassCondition: string;

  panelRows: ValuationConditionRow[];

  toName: string;
  toAddress: string;

  isInsurable: boolean;
  coverRecommendation: string;
  documentVerificationNote: string;

  enclosures: string;
  remarks: string;
}


