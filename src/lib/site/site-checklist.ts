import type { ClaimData } from '@/types';
import type { SurveyType } from '@/types/report';
import type { AppTab } from '@/stores/ui-store';
import { partitionPhotos } from '@/lib/photos/document-annexure';
import { getAt } from './path';

export type ChecklistTarget = AppTab | 'camera';
export interface ChecklistItem { id: string; label: string; target: ChecklistTarget; value?: string }
export interface SiteChecklist { missing: ChecklistItem[]; confirm: ChecklistItem[] }

interface FieldRule { path: string; label: string; target: AppTab }
interface SurveyRules {
  docs: string[];
  fields: FieldRule[];
  photo: { kind: 'damage' | 'any'; label: string };
  confirm: FieldRule[];
}

const DOC_LABELS: Record<string, string> = {
  rc: 'RC copy', dl: 'DL copy', policy: 'Policy copy', estimate: 'Estimate',
};

const d = (path: string, label: string): FieldRule => ({ path, label, target: 'details' });
const v = (path: string, label: string): FieldRule => ({ path, label, target: 'valuation' });

// Edit these lists to change what the Site screen asks for — not the UI.
const RULES: Record<SurveyType, SurveyRules> = {
  spot: {
    docs: ['rc', 'dl', 'policy'],
    fields: [
      d('vehicle.registrationNumber', 'Registration number'),
      d('vehicle.odometer', 'Odometer reading'),
      d('accident.dateAndTime', 'Accident date and time'),
      d('accident.placeOfAccident', 'Place of accident'),
      d('accident.causeOfAccident', 'Cause of accident'),
      d('accident.placeOfSurvey', 'Place of survey'),
    ],
    photo: { kind: 'damage', label: 'At least one damage photo' },
    confirm: [
      d('spotDetails.drivable', 'Drivable'),
      d('spotDetails.airbags', 'Airbags'),
      d('spotDetails.policeReported', 'Police reported'),
      d('spotDetails.tpInvolved', 'Third party involved'),
      d('spotDetails.panchanama', 'Panchanama'),
      d('spotDetails.damageSeverity', 'Damage severity'),
    ],
  },
  valuation: {
    docs: ['rc', 'policy'],
    fields: [
      d('vehicle.registrationNumber', 'Registration number'),
      v('valuationDetails.odometer', 'Odometer reading'),
      v('valuationDetails.inspectionDate', 'Inspection date'),
      v('valuationDetails.inspectionPlace', 'Inspection place'),
      v('valuationDetails.tyreCondition', 'Tyre condition'),
      v('valuationDetails.batteryCondition', 'Battery condition'),
      v('valuationDetails.glassCondition', 'Glass condition'),
    ],
    photo: { kind: 'any', label: 'At least one photo' },
    confirm: [v('valuationDetails.isInsurable', 'Insurable')],
  },
  final: {
    docs: ['rc', 'dl', 'policy', 'estimate'],
    fields: [
      d('vehicle.registrationNumber', 'Registration number'),
      d('vehicle.odometer', 'Odometer reading'),
      d('accident.causeOfAccident', 'Cause of accident'),
      d('accident.workshopName', 'Workshop name'),
      d('accident.dateOfSurvey', 'Date of survey'),
      d('accident.placeOfSurvey', 'Place of survey'),
    ],
    photo: { kind: 'damage', label: 'At least one damage photo' },
    confirm: [],
  },
};

const isBlank = (value: unknown) => value === undefined || value === null || String(value).trim() === '';
const show = (value: unknown) => (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? ''));

export function siteChecklist(claim: ClaimData): SiteChecklist {
  const rules = RULES[claim.surveyType] ?? RULES.final;
  const missing: ChecklistItem[] = [];

  for (const doc of rules.docs) {
    if (!claim.extractedData?.[doc]) {
      // Valuation hides the Documents tab; its uploads live in Details.
      const target = claim.surveyType === 'valuation' ? 'details' : 'documents';
      missing.push({ id: `doc:${doc}`, label: DOC_LABELS[doc] ?? doc, target });
    }
  }
  for (const f of rules.fields) {
    if (isBlank(getAt(claim, f.path))) missing.push({ id: f.path, label: f.label, target: f.target });
  }
  const photoCount = rules.photo.kind === 'damage'
    ? partitionPhotos(claim.photos ?? []).damage.length
    : (claim.photos ?? []).length;
  if (photoCount === 0) missing.push({ id: `photo:${rules.photo.kind}`, label: rules.photo.label, target: 'camera' });

  const confirm = rules.confirm.map((f) => ({
    id: f.path, label: f.label, target: f.target, value: show(getAt(claim, f.path)),
  }));
  return { missing, confirm };
}
