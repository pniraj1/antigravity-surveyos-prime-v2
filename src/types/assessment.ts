// ═══════════════════════════════════════════════════════════
// ASSESSMENT ENGINE TYPES
// Mirrors: assessRows[], spotDamageRows[], riParts[], recalcSummary()
// from Surveyor_V6_MASTER.html
// ═══════════════════════════════════════════════════════════

export type PartType = 'metal' | 'plastic' | 'glass' | 'fiberglass' | 'labour' | 'paint';
export type AssessmentSection = 'parts' | 'labour' | 'paint';

export type BillStatus = 'in-bill' | 'not-in-bill' | 'partial' | 'pending' | 'not-allowed';

export interface ExtraBillItem {
  id: string;
  description: string;
  amount: number;
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
  partType: PartType;
  gst: number; // percentage, default 18
  section: AssessmentSection;
  allowed: boolean;
  /** Surveyor action: REPLACE / REPAIR / DISALLOW */
  action?: 'replace' | 'repair' | 'disallow' | '';
  /** Surveyor remarks for this line item */
  remarks?: string;
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
  travelExpenses: number;
  travelNote: string;
  photosCount: number;
  photoRate: number;
  postalCharges: number;
  haltageCharges: number;
  includeGST: boolean;
  advanceReceipt: string;
  cashReceived: string;
  salvageValue: number;
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

  isInsurable: boolean;
  coverRecommendation: string;
  documentVerificationNote: string;

  enclosures: string;
  remarks: string;
}


