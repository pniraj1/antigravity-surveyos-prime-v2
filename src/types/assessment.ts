// ═══════════════════════════════════════════════════════════
// ASSESSMENT ENGINE TYPES
// Mirrors: assessRows[], spotDamageRows[], riParts[], recalcSummary()
// from Surveyor_V6_MASTER.html
// ═══════════════════════════════════════════════════════════

export type PartType = 'metal' | 'plastic' | 'glass' | 'labour' | 'paint';
export type AssessmentSection = 'parts' | 'labour' | 'paint';

export type BillStatus = 'in-bill' | 'not-in-bill' | 'partial' | 'pending';


export interface AssessmentRow {
  id: string;
  particulars: string;
  estimated: number;
  assessed: number;
  billedAmount?: number;
  billStatus?: BillStatus;
  billRemarks?: string;
  partType: PartType;
  gst: number; // percentage, default 18
  section: AssessmentSection;
  allowed: boolean;
}

export interface AssessmentSummary {
  // Parts breakdown (after depreciation)
  metalTotal: number;
  plasticTotal: number;
  glassTotal: number;
  partsBase: number; // metal + plastic + glass
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

  // Estimated totals (for comparison)
  totalEstimated: number;
}

// ─── SPOT SURVEY DAMAGE ─────────────────────────────────
export interface SpotDamageRow {
  id: string;
  component: string;
  damage: string;
}

export type DamageSeverity = 'minor' | 'moderate' | 'major';

export interface SpotSurveyDetails {
  reportNo: string;
  reportDate: string;
  allotmentDate: string;
  surveyDatetime: string;
  surveyPlace: string;
  driverName: string;
  dlParentName: string;
  dlRelation: string;
  mdlNo: string;
  dlAuthority: string;
  dlType: string;
  dlIssueDate: string;
  dlValidNT: string;
  dlValidT: string;
  mdlVerified: string;
  dlInvalidRemarks: string;
  tpInvolved: string;
  tpDetails: string;
  policeReported: string;
  policeStation: string;
  diaryNo: string;
  panchanama: string;
  damageSeverity: DamageSeverity;
  airbags: string;
  drivable: string;
  comments: string;
  repairs: string;
  enclosures: string;
  // Commercial
  permitNo: string;
  permitType: string;
  permitFrom: string;
  permitTo: string;
  natureOfPermit: string;
  areaOfOperation: string;
  fitnessNo: string;
  fitnessValid: string;
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
  // Goods
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
}

// ─── PHOTO SHEET ────────────────────────────────────────
export interface PhotoItem {
  dataUrl: string;
  name: string;
}

export type PhotoLayout = 4 | 6 | 8 | 9;

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


