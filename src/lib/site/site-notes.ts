import type { ClaimData } from '@/types';
import type { SurveyType } from '@/types/report';
import { createBlankClaim } from '@/types';
import { getAt, setAt } from './path';

export interface FieldSpec { path: string; label: string; enum?: readonly string[] }

const COMMON: FieldSpec[] = [
  { path: 'vehicle.registrationNumber', label: 'Registration number' },
  { path: 'vehicle.odometer', label: 'Odometer' },
  { path: 'vehicle.preAccidentCondition', label: 'Pre-accident condition' },
  { path: 'accident.dateAndTime', label: 'Accident date and time' },
  { path: 'accident.placeOfAccident', label: 'Place of accident' },
  { path: 'accident.causeOfAccident', label: 'Cause of accident' },
  { path: 'accident.placeOfSurvey', label: 'Place of survey' },
  { path: 'accident.workshopName', label: 'Workshop name' },
  { path: 'accident.remarks', label: 'Remarks' },
];

// Enum values mirror the <option> values in SpotTab.tsx and the RI types.
const SPOT: FieldSpec[] = [
  { path: 'spotDetails.drivable', label: 'Drivable', enum: ['yes', 'no'] },
  { path: 'spotDetails.airbags', label: 'Airbags', enum: ['no', 'yes', 'na'] },
  { path: 'spotDetails.policeReported', label: 'Police reported', enum: ['yes', 'no'] },
  { path: 'spotDetails.tpInvolved', label: 'Third party involved', enum: ['no', 'tppd', 'tppi', 'both'] },
  { path: 'spotDetails.panchanama', label: 'Panchanama', enum: ['yes', 'no'] },
  { path: 'spotDetails.damageSeverity', label: 'Damage severity', enum: ['minor', 'moderate', 'major'] },
  { path: 'spotDetails.comments', label: 'Spot comments' },
  { path: 'spotDetails.repairs', label: 'Repairs' },
];

const VALUATION: FieldSpec[] = [
  { path: 'valuationDetails.inspectionPlace', label: 'Inspection place' },
  { path: 'valuationDetails.odometer', label: 'Odometer (valuation)' },
  { path: 'valuationDetails.tyreCondition', label: 'Tyre condition' },
  { path: 'valuationDetails.batteryCondition', label: 'Battery condition' },
  { path: 'valuationDetails.glassCondition', label: 'Glass condition' },
  { path: 'valuationDetails.electricals', label: 'Electricals' },
  { path: 'valuationDetails.remarks', label: 'Valuation remarks' },
];

const REINSPECTION: FieldSpec[] = [
  { path: 'reinspection.observations', label: 'Reinspection observations' },
  { path: 'reinspection.repairQuality', label: 'Repair quality', enum: ['satisfactory', 'good', 'partial', 'unsatisfactory'] },
  { path: 'reinspection.vehicleCondition', label: 'Vehicle condition', enum: ['roadworthy', 'needs-attention', 'not-roadworthy'] },
  { path: 'reinspection.salvageStatus', label: 'Salvage status', enum: ['collected', 'not-collected', 'partial', 'na'] },
];

/**
 * The ONLY fields dictated notes may fill. Never assessment rows or amounts
 * (assessment is surveyor-made), never insured / policy / driver identity.
 */
export function siteNoteFields(surveyType: SurveyType): FieldSpec[] {
  if (surveyType === 'spot') return [...COMMON, ...SPOT];
  if (surveyType === 'valuation') return [...COMMON, ...VALUATION];
  return [...COMMON, ...REINSPECTION];
}

export const allowsDamageRows = (surveyType: SurveyType) => surveyType === 'spot';

export interface ExtractedField { path: string; value: string; evidence: string }
export interface ExtractedDamageRow { component: string; damage: string; evidence: string }
export interface SiteNotesExtraction { fields: ExtractedField[]; damageRows: ExtractedDamageRow[]; unmapped: string[] }

export interface SiteNotesFill extends ExtractedField { label: string }
export interface SiteNotesConflict { path: string; label: string; current: string; proposed: string; evidence: string }
export interface SiteNotesPlan {
  fills: SiteNotesFill[];
  conflicts: SiteNotesConflict[];
  damageRows: ExtractedDamageRow[];
  unmapped: string[];
}

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

/** Tolerant reader of the model's JSON. Throws only when it is not JSON at all. */
export function parseSiteNotesExtraction(raw: string): SiteNotesExtraction {
  const data: unknown = JSON.parse(raw);
  const obj = isObj(data) ? data : {};
  const list = (key: string) => (Array.isArray(obj[key]) ? (obj[key] as unknown[]) : []);
  return {
    fields: list('fields').filter(isObj)
      .map((f) => ({ path: str(f.path), value: str(f.value), evidence: str(f.evidence) }))
      .filter((f) => f.path && f.value),
    damageRows: list('damageRows').filter(isObj)
      .map((r) => ({ component: str(r.component), damage: str(r.damage), evidence: str(r.evidence) }))
      .filter((r) => r.component),
    unmapped: list('unmapped').map(str).filter(Boolean),
  };
}

export function planSiteNotes(claim: ClaimData, extraction: SiteNotesExtraction): SiteNotesPlan {
  const specs = new Map(siteNoteFields(claim.surveyType).map((s) => [s.path, s]));
  const blank = createBlankClaim(claim.surveyType, claim.vehicleType);
  const seen = new Set<string>();
  const fills: SiteNotesFill[] = [];
  const conflicts: SiteNotesConflict[] = [];
  const unmapped = [...extraction.unmapped];

  for (const f of extraction.fields) {
    const spec = specs.get(f.path);
    const value = str(f.value);
    if (!spec || !value || seen.has(f.path)) continue; // not allowed, empty, or duplicate → dropped
    seen.add(f.path);
    if (spec.enum && !spec.enum.includes(value)) {
      unmapped.push(f.evidence || value);
      continue;
    }
    const current = str(getAt(claim, f.path));
    const blankValue = str(getAt(blank, f.path));
    if (current === '' || current === blankValue) {
      fills.push({ path: f.path, value, evidence: f.evidence, label: spec.label });
    } else if (current !== value) {
      conflicts.push({ path: f.path, label: spec.label, current, proposed: value, evidence: f.evidence });
    }
  }

  return {
    fills,
    conflicts,
    damageRows: allowsDamageRows(claim.surveyType) ? extraction.damageRows : [],
    unmapped,
  };
}

export const isEmptyPlan = (p: SiteNotesPlan) =>
  p.fills.length + p.conflicts.length + p.damageRows.length + p.unmapped.length === 0;

/** The claim changes for the approved plan: whole updated sections + appended damage rows. */
export function siteNotesUpdates(
  claim: ClaimData,
  plan: SiteNotesPlan,
  makeId: (i: number) => string = (i) => `notes-${Date.now()}-${i}`,
): Partial<ClaimData> {
  const next = plan.fills.reduce<ClaimData>((acc, f) => setAt(acc, f.path, f.value), claim);
  const updates: Record<string, unknown> = {};
  for (const section of new Set(plan.fills.map((f) => f.path.split('.')[0]))) {
    updates[section] = (next as unknown as Record<string, unknown>)[section];
  }
  if (plan.damageRows.length) {
    updates.spotDamageRows = [
      ...claim.spotDamageRows,
      ...plan.damageRows.map((r, i) => ({ id: makeId(i), component: r.component, damage: r.damage })),
    ];
  }
  return updates as Partial<ClaimData>;
}
