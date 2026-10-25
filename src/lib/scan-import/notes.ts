/**
 * Merge of SurveyOS Scan's phone notes (manifest `notes`) into a Prime claim.
 * Contract: `SurveyOS Scan/docs/handover/prime-notes-import.md` (field tables + import rules).
 * Pure: plan first, write only what the surveyor approves.
 */
import type { ClaimData } from '@/types';
import { createBlankClaim } from '@/types';
import { getAt, setAt } from '@/lib/site/path';

// ponytail: local until Task 4 adds `ClaimData.scanImport`.
export interface ScanImport { at: string; decided: Record<string, string> }
type ClaimWithScan = ClaimData & { scanImport?: ScanImport };

type Kind = 'text' | 'number' | 'enum' | 'doc' | 'insurable';
interface FieldSpec { label: string; section: 'spot' | 'valuation'; kind?: Kind; values?: readonly string[] }

const YES_NO = ['yes', 'no'] as const;
const spot = (label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ label, section: 'spot', ...extra });
const val = (label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ label, section: 'valuation', ...extra });
const doc = (label: string) => spot(label, { kind: 'doc' });

/** The handover field tables, keyed by Prime claim path, in report order. Nothing else is ever written. */
export const NOTES_ALLOW_LIST: Readonly<Record<string, FieldSpec>> = {
  'spotDetails.reportDate': spot('Date of Report'),
  'spotDetails.allotmentDate': spot('Date of Allotment'),
  'spotDetails.surveyDatetime': spot('Date & Time of Survey'),
  'vehicle.odometer': spot('Odometer (KM)', { kind: 'number' }),
  'vehicle.preAccidentCondition': spot('Pre-Accident Condition'),
  'driver.verificationStatus': spot('MDL Status', { kind: 'enum', values: ['verified', 'photocopy', 'not-available'] }),
  'accident.dateAndTime': spot('Date & Time'),
  'accident.placeOfAccident': spot('Place of Accident'),
  'accident.placeOfSurvey': spot('Place of Survey'),
  'spotDetails.policeReported': spot('Police Reported', { kind: 'enum', values: YES_NO }),
  'accident.policeStation': spot('Police Station'),
  'spotDetails.panchanama': spot('Panchanama', { kind: 'enum', values: YES_NO }),
  'accident.thirdPartyDetails': spot('Third Party'),
  'documentVerification.rc': doc('RC'),
  'documentVerification.dl': doc('Driving Licence'),
  'documentVerification.permit': doc('Permit'),
  'documentVerification.fitness': doc('Fitness Cert'),
  'documentVerification.loadChallan': doc('Load Challan'),
  'documentVerification.fir': doc('FIR / Diary'),
  'documentVerification.fireReport': doc('Fire Report'),
  'spotDetails.actualLoad': spot('Actual Load Carried', { kind: 'number' }),
  'spotDetails.loadDesc': spot('Goods / Passengers Carried'),
  'spotDetails.loadOrigin': spot('Origin'),
  'spotDetails.loadDest': spot('Destination'),
  'accident.causeOfAccident': spot('Cause and Nature of Accident'),
  'spotDetails.comments': spot('Spot Observations / Comments / Remarks'),
  'spotDetails.damageSeverity': spot('Severity', { kind: 'enum', values: ['minor', 'moderate', 'major'] }),
  'spotDetails.airbags': spot('Airbags Deployed', { kind: 'enum', values: ['no', 'yes', 'na'] }),
  'spotDetails.drivable': spot('Drivable', { kind: 'enum', values: YES_NO }),
  'spotDetails.repairWorkshop': spot('Further Repairs'),
  'spotDetails.enclosures': spot('ENCL'),

  'valuationDetails.inspectionDate': val('Date of Inspection'),
  'valuationDetails.inspectionPlace': val('Place of Inspection'),
  'valuationDetails.odometer': val('Kilometerage'), // a string in Prime: copied as-is, no parsing
  'valuationDetails.chassis': val('Chassis'),
  'valuationDetails.engineTransmission': val('Engine & Transmission'),
  'valuationDetails.suspension': val('Brakes & Suspension'),
  'valuationDetails.batteryMake': val('Battery Make'),
  'valuationDetails.batteryCondition': val('Battery Condition'),
  'valuationDetails.tyreCount': val('No. of Tyres'),
  'valuationDetails.stepneyCount': val('No. of Stepney'),
  'valuationDetails.tyreMake': val('Tyre Make'),
  'valuationDetails.tyreCondition': val('Tyre Condition'),
  'valuationDetails.glassCondition': val('Glass Condition'),
  'valuationDetails.seats': val('Seats & Upholstery'),
  'valuationDetails.electricals': val('Electricals'),
  'valuationDetails.isInsurable': val('Vehicle Insurable?', { kind: 'insurable', values: YES_NO }),
  'valuationDetails.remarks': val('Remarks'),
  'valuationDetails.enclosures': val('Enclosures'),
};

/** One field change. `key` is the claim path written; `phone` is the raw phone string (what `decided` stores). */
export interface Change {
  key: string;
  label: string;
  prime: string;
  phone: string;
  value: unknown;
  /** false when the phone value is not usable (e.g. odometer "about 45k"): shown to look at, never written. */
  writable: boolean;
}
export interface RowPlan {
  damage: { component: string; damage: string }[];
  parts: { component: string; condition: string }[];
  /** Existing panel rows with an empty condition that take the phone's condition. */
  partConditions: { id: string; condition: string }[];
}
export interface NotesPlan { fill: Change[]; differ: Change[]; rows: RowPlan; at: string }

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const lc = (s: string) => s.trim().toLowerCase();

/** Lenient number: "45,210 km" → 45210. NaN unless a plain non-negative number (no hex, exponent, sign). */
const parseNumber = (s: string) => {
  const t = s.replace(/[,\s]/g, '').replace(/(kms?|kgs?)$/i, '');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
};

/** Phone string → Prime value; undefined when unusable. */
function convert(path: string, spec: FieldSpec, raw: string): unknown {
  const v = spec.values ? raw.toLowerCase() : raw;
  if (spec.values && !spec.values.includes(v)) return undefined;
  if (spec.kind === 'insurable') return v === 'yes';
  if (spec.kind === 'number') {
    const n = parseNumber(raw);
    if (!Number.isFinite(n)) return undefined;
    return path === 'spotDetails.actualLoad' ? n : String(n);
  }
  return v;
}

function planRows(claim: ClaimData, notes: Record<string, unknown>): RowPlan {
  const list = (k: string) => (Array.isArray(notes[k]) ? (notes[k] as unknown[]).filter(isObj) : []);

  const dKey = (r: { component: string; damage: string }) => `${lc(r.component)}|${lc(r.damage)}`;
  const dSeen = new Set((claim.spotDamageRows ?? []).map(dKey));
  const damage = list('spotDamageRows')
    .map((r) => ({ component: str(r.component), damage: str(r.damage) }))
    .filter((r) => (r.component || r.damage) && !dSeen.has(dKey(r)) && !!dSeen.add(dKey(r)));

  const existing = new Map((claim.valuationDetails?.panelRows ?? []).map((r) => [lc(r.component), r]));
  const parts: RowPlan['parts'] = [];
  const partConditions: RowPlan['partConditions'] = [];
  const pSeen = new Set<string>();
  for (const r of list('valuationPartRows')) {
    const row = { component: str(r.component), condition: str(r.condition) };
    const k = lc(row.component);
    if (!row.component || pSeen.has(k)) continue; // a part needs a name to de-dupe on
    pSeen.add(k);
    const have = existing.get(k);
    if (!have) parts.push(row);
    else if (!str(have.condition) && row.condition) partConditions.push({ id: have.id, condition: row.condition });
  }
  return { damage, parts, partConditions };
}

/**
 * Plans the merge. `notes` is the manifest's loosely typed `notes`; `decided` is `scanImport.decided`.
 * Absent or blank phone values mean "no change" — Prime never clears on import.
 */
export function planNotes(claim: ClaimData, notes: unknown, decided: Record<string, string> = {}): NotesPlan {
  const n = isObj(notes) ? notes : {};
  const sections = { spot: isObj(n.spot) ? n.spot : {}, valuation: isObj(n.valuation) ? n.valuation : {} };
  const blank = createBlankClaim(claim.surveyType, claim.vehicleType);
  const fill: Change[] = [];
  const differ: Change[] = [];

  const consider = (key: string, label: string, phone: string, value: unknown, empty: boolean, canFill = true) => {
    const current = getAt(claim, key);
    const prime = str(current);
    if (value !== undefined && str(value) === prime) return; // same value
    if (decided[key] === phone) return; // already seen: kept, unticked or used
    const change = { key, label, prime, phone, value, writable: value !== undefined };
    if (empty && canFill && change.writable) fill.push(change);
    else differ.push(change);
  };

  for (const [path, spec] of Object.entries(NOTES_ALLOW_LIST)) {
    const raw = sections[spec.section][path];
    if (spec.kind === 'doc') {
      if (!isObj(raw)) continue;
      const cur = getAt(claim, path) as { status?: string; detail?: string } | undefined;
      const status = str(raw.status).toUpperCase();
      const detail = str(raw.detail);
      const statusEmpty = !str(cur?.status) || (str(cur?.status) === 'NO' && !str(cur?.detail));
      if (status) {
        consider(`${path}.status`, `${spec.label} status`, status, ['YES', 'NO', 'N.A.'].includes(status) ? status : undefined, statusEmpty);
      }
      if (detail) consider(`${path}.detail`, `${spec.label} remarks`, detail, detail, !str(cur?.detail));
      continue;
    }
    const phone = str(raw);
    if (!phone) continue;
    const current = getAt(claim, path);
    const empty = !str(current) || str(current) === str(getAt(blank, path)) || (spec.kind === 'number' && current === 0);
    const value = convert(path, spec, phone);
    if (spec.kind === 'number' && value !== undefined && parseNumber(str(current)) === Number(value)) continue; // "45,210" vs 45210
    consider(path, spec.label, phone, value, empty, spec.kind !== 'insurable');
  }

  return { fill, differ, rows: planRows(claim, n), at: str(n.updatedAt) };
}

export const isEmptyNotesPlan = (p: NotesPlan) =>
  p.fill.length + p.differ.length + p.rows.damage.length + p.rows.parts.length + p.rows.partConditions.length === 0;

/**
 * Claim updates for the approved plan. `picks[key]`: for a differ, true = use phone (default keep Prime);
 * for a fill, false = unticked (default fill). Every differ and every unticked fill is recorded in `decided`.
 */
export function applyNotes(
  claim: ClaimData,
  plan: NotesPlan,
  picks: Record<string, boolean> = {},
  makeId: (i: number) => string = (i) => `scan-${Date.now()}-${i}`,
): Partial<ClaimData> & { scanImport: ScanImport } {
  const writes = [
    ...plan.fill.filter((c) => picks[c.key] !== false),
    ...plan.differ.filter((c) => c.writable && picks[c.key] === true),
  ];
  // Old claims may lack these sections; never write a partial object into them.
  const blank = createBlankClaim(claim.surveyType, claim.vehicleType);
  const base: ClaimData = {
    ...claim,
    documentVerification: claim.documentVerification ?? blank.documentVerification,
    valuationDetails: claim.valuationDetails ?? blank.valuationDetails,
  };
  let next = writes.reduce<ClaimData>((acc, c) => setAt(acc, c.key, c.value), base);

  const { damage, parts, partConditions } = plan.rows;
  if (damage.length) {
    next = { ...next, spotDamageRows: [...(next.spotDamageRows ?? []), ...damage.map((r, i) => ({ id: makeId(i), ...r }))] };
  }
  if (parts.length || partConditions.length) {
    const cond = new Map(partConditions.map((p) => [p.id, p.condition]));
    const vd = next.valuationDetails;
    const panelRows = [
      ...(vd.panelRows ?? []).map((r) => (cond.has(r.id) ? { ...r, condition: cond.get(r.id)! } : r)),
      ...parts.map((r, i) => ({ id: makeId(damage.length + i), ...r })),
    ];
    next = { ...next, valuationDetails: { ...vd, panelRows } };
  }

  const updates: Record<string, unknown> = {};
  const touched = new Set(writes.map((c) => c.key.split('.')[0]));
  if (damage.length) touched.add('spotDamageRows');
  if (parts.length || partConditions.length) touched.add('valuationDetails');
  for (const section of touched) updates[section] = (next as unknown as Record<string, unknown>)[section];

  const prev = (claim as ClaimWithScan).scanImport;
  const seen = [...plan.differ, ...plan.fill.filter((c) => picks[c.key] === false)];
  const decided = { ...prev?.decided, ...Object.fromEntries(seen.map((c) => [c.key, c.phone])) };
  return { ...(updates as Partial<ClaimData>), scanImport: { at: plan.at || prev?.at || '', decided } };
}
