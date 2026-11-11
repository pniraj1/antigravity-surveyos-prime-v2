import type { StateCreator } from 'zustand';
import type { ClaimData, AssessmentRow, ExtraBillItem } from '@/types';
import { createAssessmentRow } from '@/lib/calculations';
import { buildDecision } from '@/lib/ai/reconciliation';
import { parsePolicyAddOns, mergePolicyAiRead } from '@/lib/policy/policy-check';
import { applyEstimateFix, type EstimateFixPlan, type EstimateFixPicks } from '@/lib/ai/estimate-fix';
import { scorePair, SURE_SCORE, MIN_SCORE, type PairScore } from '@/lib/reports/bill-match-score';

export type EstimateApplyMode = 'replace' | 'append' | 'continue' | 'another';

export interface AIDataSlice {
  reconciliationConflictCount: number;
  setExtractedData: (key: string, data: any) => void;
  applyExtractedData: (key: string, data: any, mode?: EstimateApplyMode) => void;
  applyEstimateFixToClaim: (plan: EstimateFixPlan, picks: EstimateFixPicks) => void;
  reconcileField: (path: string, value: string, source?: string) => void;
  batchReconcile: (updates: { path: string; value: string; source?: string }[]) => void;
  setReconciliationConflictCount: (count: number) => void;
}

type WithClaim = { currentClaim: ClaimData | null };

// ─── Date parsing helper ──────────────────────────────────────────────────────

export function parseDate(d: string): string {
  if (!d) return '';
  const clean = String(d).trim();

  // Already ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  // Dates are matched ANYWHERE in the string, not just when the whole value is
  // a date. Real documents wrap them in prose — a policy schedule reads
  // "from 00.00 Hrs of 22/02/2026 to Midnight of 21/02/2027" and Form 38 reads
  // "From 17-03-2025 to 16-03-2027" — and an anchored parse rejects all of them.
  //
  // CRITICAL: numeric day/month/year must be resolved with the Indian
  // DD-MM-YYYY convention BEFORE ever touching `new Date()`. JavaScript's
  // Date parser reads slash dates as US MM/DD/YYYY, which silently swaps day
  // and month whenever both are ≤ 12 (e.g. 03/04/2026 → 04 Mar instead of
  // 03 Apr). We must never hand a numeric date to `new Date()`.

  // Year-first: YYYY-MM-DD (or YYYY/MM/DD)
  const ymd = clean.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;

  // Year-last: Indian DD-MM-YYYY
  const dmy = clean.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  // Non-numeric month (e.g. "20-Nov-2019", "16 March 2027") — safe to let Date
  // resolve the month name, since there is no day/month ambiguity to swap.
  const named = clean.match(/(\d{1,2})[-\s/.]+([A-Za-z]{3,})[-\s/.]+(\d{4})/);
  if (named) {
    const parsed = new Date(`${named[2]} ${named[1]}, ${named[3]}`);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const dayStr = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayStr}`;
    }
  }

  // No usable date. Return '' rather than the raw string: every date field is
  // bound to <input type="date">, which renders BLANK for anything that is not
  // exactly YYYY-MM-DD. Storing the raw text makes the field look unread while
  // the junk silently propagates into reports.
  return '';
}

// ─── Time parsing helper ──────────────────────────────────────────────────────

/**
 * Normalizes an accident time to 24-hour HH:mm, or '' when none is readable.
 * Claim forms write "4.30 pm", "16.30 hrs", "1630 hrs", "02:30 PM" — and any
 * of those left raw makes the datetime-local input render the WHOLE value
 * blank, date included. Dotted dates ("12.03.2026") are not times: the
 * lookarounds refuse a match that touches another date component.
 */
export function parseTime(t: string): string {
  if (!t) return '';
  const s = String(t).toLowerCase();
  const m =
    s.match(/(?<![\d./-])(\d{1,2})[:.](\d{2})(?![.\/:-]?\d)\s*(?:([ap])\.?\s*m\b)?/) ??
    s.match(/(?<![\d./:-])(\d{1,2})()\s*([ap])\.?\s*m\b/) ??
    s.match(/(?<![\d./:-])(\d{2})(\d{2})()\s*h/);
  if (!m) return '';
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (m[3] === 'p' && h < 12) h += 12;
  if (m[3] === 'a' && h === 12) h = 0;
  if (h > 23 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ─── Amount parsing helper ────────────────────────────────────────────────────

/**
 * Normalizes a rupee amount ("Rs.20,00,000", "₹ 20,00,000/-") to a plain numeric
 * string. IDV is bound to <input type="number">, which renders BLANK unless the
 * stored value parses as a bare number.
 */
export function parseAmount(v: string): string {
  if (!v) return '';
  const match = String(v).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? match[0] : '';
}

// ─── Reconciliation coercion ──────────────────────────────────────────────────

/**
 * Paths written by reconcileField / batchReconcile whose form control accepts
 * only a strict format.
 *
 * The Reconciliation Hub offers RAW extracted values as one-click buttons —
 * "Rs.20,00,000", "Midnight of 21/02/2027" — so accepting a suggestion has to
 * run the same normalization the extraction path does. Without it, resolving a
 * conflict writes the raw string straight through and blanks the very field the
 * surveyor was trying to fill.
 *
 * Keep in sync with FIELD_MAPPINGS in lib/ai/reconciliation.ts; the paths there
 * are covered by reconciliation-paths.test.ts.
 */
const RECONCILE_DATE_PATHS = new Set([
  'vehicle.dateOfRegistration',
  'vehicle.fitnessValidUpto',
  'driver.dateOfBirth',
  'driver.validityNonTransport',
  'driver.validityTransport',
  'accident.firDate',
]);

/** policy.idv is a numeric string; the vehicle.* entries are `number | null`. */
const RECONCILE_NUMERIC_PATHS = new Set([
  'policy.idv',
  'vehicle.unladenWeight',
  'vehicle.grossWeight',
  'vehicle.yearOfManufacture',
]);

export function coerceForPath(path: string, value: string): unknown {
  if (RECONCILE_DATE_PATHS.has(path)) return parseDate(value);
  if (path === 'accident.dateAndTime') {
    // ponytail: a date-only source resets the time to 00:00; surveyor re-enters it.
    const d = parseDate(value);
    return d ? `${d}T${parseTime(value) || '00:00'}` : '';
  }
  if (RECONCILE_NUMERIC_PATHS.has(path)) {
    const digits = parseAmount(value);
    if (path === 'policy.idv') return digits;
    return digits ? Number(digits) : null;
  }
  return value;
}

/** Immutable deep-set for "top.sub" paths, normalizing the value on the way in. */
function setClaimPath(claim: ClaimData, path: string, value: string): ClaimData {
  const coerced = coerceForPath(path, value);
  const parts = path.split('.');
  if (parts.length === 2) {
    const [top, sub] = parts;
    return {
      ...claim,
      [top]: { ...(claim as unknown as Record<string, unknown>)[top] as object, [sub]: coerced },
    };
  }
  return { ...claim, [path]: coerced };
}

// ─── Fuel type normalizer ─────────────────────────────────────────────────────

function formatFuel(f: string): string {
  if (!f) return '';
  const up = f.toUpperCase();
  if (up === 'PETROL') return 'Petrol';
  if (up === 'DIESEL') return 'Diesel';
  if (up.includes('PETROL') && up.includes('CNG')) return 'Petrol+CNG';
  if (up.includes('PETROL') && up.includes('LPG')) return 'Petrol+LPG';
  if (up === 'CNG') return 'CNG';
  if (up === 'ELECTRIC' || up === 'EV') return 'Electric';
  if (up === 'HYBRID') return 'Hybrid';
  return f;
}

// ─── Bill item type ───────────────────────────────────────────────────────────

interface BillItem {
  idx: number;
  srNo?: number | string;
  description: string;
  partNumber: string;
  taxableAmount: number;
  totalAmount: number;
  gstPercent: number;
  section: 'parts' | 'labour' | 'paint';
  category?: string;
  raw: any;
}

export interface BillMatch {
  bill: BillItem;
  reason: 'part' | 'amount' | 'desc';
  /** Returned rather than mutated onto the bill item. */
  ambiguous: boolean;
  /** 0–100, from scorePair. */
  score: number;
  /** Why, in the surveyor's words: "Left vs right", "Amount matches"… */
  reasons: string[];
}

function extraFromBillItem(bi: BillItem): ExtraBillItem {
  return {
    // Stable id from content, so a re-upload of the same bill produces the
    // same id and merging can tell a repeat from a new item.
    id: `extra-${bi.section}-${bi.partNumber || bi.description}-${bi.totalAmount}`.replace(/\s+/g, '_'),
    description: bi.description || 'Unnamed item',
    amount: bi.totalAmount,
    taxableAmount: bi.taxableAmount,
    gstPercent: bi.gstPercent,
    partNumber: bi.partNumber || undefined,
    hsnSac: bi.raw?.hsn_sac || bi.raw?.hsn || undefined,
    section: bi.section,
    category:
      bi.section === 'parts' ? 'spare_parts' : bi.section === 'labour' ? 'labour' : 'painting',
    source: 'final-bill' as const,
    srNo: bi.srNo,
  };
}

/** A runner-up this close to the winner makes the pick a coin toss. */
const RIVAL_GAP = 10;

// ─── Final-bill helpers ───────────────────────────────────────────────────────

export function buildBillItems(data: any): BillItem[] {
  const items: BillItem[] = [];

  const push = (arr: any[], section: BillItem['section']) => {
    (arr || []).forEach((i: any) => {
      const gstPct = i.gst_percent ?? 18;
      let taxable = i.taxable_amount;
      const total = i.total_amount || i.amount || 0;
      if (!taxable || taxable <= 0) taxable = total / (1 + gstPct / 100);
      const rawSr = i.sr_no ?? i.item_no ?? i.serial_no ?? i.srNo;
      const srNo = rawSr !== undefined && rawSr !== null && String(rawSr).trim() !== ''
        ? (typeof rawSr === 'number' ? rawSr : String(rawSr).trim())
        : (items.length + 1);
      items.push({
        idx: items.length,
        srNo,
        description: (i.description || '').toString(),
        partNumber: (i.part_number || '').toString(),
        taxableAmount: Math.round(taxable * 100) / 100,
        totalAmount: Math.round(total * 100) / 100,
        gstPercent: gstPct,
        section,
        category: i.category,
        raw: i,
      });
    });
  };

  push(data.spare_parts || [], 'parts');
  push(data.labour_items || [], 'labour');
  push(data.painting_items || [], 'paint');
  return items;
}

export function matchBillItemsToRows(
  rows: AssessmentRow[],
  billItems: BillItem[]
): Map<string, BillMatch> {
  // Every row against every line, best pairs first. Matching row by row let
  // an early vague row ("BUMPER") take the line a later row fitted exactly.
  // ponytail: greedy over sorted pairs; optimal assignment if greedy misfires.
  const pairs: { row: AssessmentRow; bi: BillItem; s: PairScore }[] = [];
  for (const row of rows) {
    for (const bi of billItems) {
      const s = scorePair(row, bi);
      if (s.score >= MIN_SCORE) pairs.push({ row, bi, s });
    }
  }
  pairs.sort((a, b) => b.s.score - a.s.score);

  const takenAt = new Map<number, number>(); // bill idx → score it went at
  const rowMatches = new Map<string, BillMatch>();
  for (const { row, bi, s } of pairs) {
    if (rowMatches.has(row.id) || takenAt.has(bi.idx)) continue;
    takenAt.set(bi.idx, s.score);
    const first = s.reasons[0];
    rowMatches.set(row.id, {
      bill: bi,
      reason: first === 'Part no. matches' ? 'part' : s.reasons.includes('Amount matches') ? 'amount' : 'desc',
      ambiguous: s.score < SURE_SCORE,
      score: s.score,
      reasons: s.reasons,
    });
  }

  // A close runner-up makes even a high score a guess — unless another row
  // took that line because it fitted there better.
  for (const { row, bi, s } of pairs) {
    const m = rowMatches.get(row.id);
    if (!m || m.bill.idx === bi.idx || s.score < m.score - RIVAL_GAP) continue;
    if ((takenAt.get(bi.idx) ?? -1) > s.score) continue;
    if (!m.ambiguous || !m.reasons.some(r => r.startsWith('Bill item'))) {
      rowMatches.set(row.id, {
        ...m,
        ambiguous: true,
        reasons: [...m.reasons, `Bill item ${bi.srNo ?? bi.idx + 1} fits nearly as well`],
      });
    }
  }

  return rowMatches;
}

// ─── Key-specific mapping functions ──────────────────────────────────────────

export function applyRC(claim: ClaimData, data: any): ClaimData {
  const hypothecation = data.hypothecation || data.hpa || claim.vehicle.hypothecation;
  const rlw =
    typeof data.gross_weight === 'string'
      ? data.gross_weight
      : String(data.gross_weight || data.rlw || claim.vehicle.registeredLoadWeight);
  const yomStr = (data.year_of_manufacture || data.yom)?.toString() || '';
  const yomMatch = yomStr.match(/\b(19|20)\d{2}\b/);
  const yom = yomMatch ? parseInt(yomMatch[0]) : claim.vehicle.yearOfManufacture;

  const gvwStr = String(data.gross_weight || data.rlw || '0').replace(/[^0-9.]/g, '');
  const ulwStr = String(data.unladen_weight || data.ulw || '0').replace(/[^0-9.]/g, '');
  const gvw = gvwStr ? Math.round(parseFloat(gvwStr)) : 0;
  const ulw = ulwStr ? Math.round(parseFloat(ulwStr)) : 0;

  const updated: ClaimData = {
    ...claim,
    vehicle: {
      ...claim.vehicle,
      registrationNumber: data.registration_number || data.reg_no || claim.vehicle.registrationNumber,
      dateOfRegistration: parseDate(data.date_of_registration || data.registration_date || data.reg_date) || claim.vehicle.dateOfRegistration,
      chassisNumber: data.chassis_number || data.chassis_no || claim.vehicle.chassisNumber,
      engineNumber: data.engine_number || data.engine_no || claim.vehicle.engineNumber,
      make: data.make || claim.vehicle.make,
      model: data.model || claim.vehicle.model,
      bodyType: data.body_type || claim.vehicle.bodyType,
      cubicCapacity: data.cubic_capacity || data.cc || claim.vehicle.cubicCapacity,
      colour: data.colour || data.color || claim.vehicle.colour,
      fuel: formatFuel(data.fuel) || claim.vehicle.fuel,
      seatingCapacity: data.seating_capacity || data.seats || claim.vehicle.seatingCapacity,
      // parseAmount, not parseFloat: parseFloat('2,500 kg') stops at the comma
      // and yields 2, which then renders in the ULW number input as a plausible
      // but wrong weight.
      unladenWeight: Number(parseAmount(data.unladen_weight || data.ulw)) || claim.vehicle.unladenWeight,
      grossWeight: gvw || claim.vehicle.grossWeight || null,
      registeredLoadWeight: rlw || claim.vehicle.registeredLoadWeight,
      classOfVehicle: data.class_of_vehicle || data.vehicle_class || claim.vehicle.classOfVehicle,
      registrationType: data.class_of_vehicle || data.vehicle_class || claim.vehicle.registrationType,
      registeringAuthority: data.registering_authority || data.rto || claim.vehicle.registeringAuthority,
      route: data.route || claim.vehicle.route,
      yearOfManufacture: yom,
      registrationValidUpTo: parseDate(data.registration_valid_upto || data.reg_valid_upto || data.regn_valid_upto) || claim.vehicle.registrationValidUpTo,
      hypothecation,
      rcEndorsement: hypothecation || data.rc_endorsement || claim.vehicle.rcEndorsement,
    },
    policy: {
      ...claim.policy,
      insuredName: data.owner_name || data.name || claim.policy.insuredName,
      insuredAddress: data.address || claim.policy.insuredAddress,
      // Sync HPA from RC into policy so standard report HPA row is always populated
      hpaWith: hypothecation || claim.policy.hpaWith,
    },
    spotDetails: {
      ...claim.spotDetails,
      gvw: gvw || claim.spotDetails.gvw,
      ulw: ulw || claim.spotDetails.ulw,
      loadCapacity: (gvw > ulw && ulw > 0) ? gvw - ulw : (gvw || claim.spotDetails.loadCapacity),
    },
  };

  if (data.odometer) {
    updated.vehicle.odometer = String(data.odometer);
    updated.valuationDetails = { ...claim.valuationDetails, odometer: String(data.odometer) };
  }

  return updated;
}

export function applyPolicy(claim: ClaimData, data: any): ClaimData {
  const ai = parsePolicyAddOns(data);
  // Merge BEFORE filling excess, so the comparison is against what the surveyor had.
  const policyCheck = mergePolicyAiRead(claim.policyCheck, ai, {
    compulsory: claim.feeBill?.compulsoryExcess || 0,
    voluntary: claim.feeBill?.voluntaryExcess || 0,
  });
  const fillCompulsory = !claim.feeBill?.compulsoryExcess && ai.compulsoryExcess;
  const fillVoluntary = !claim.feeBill?.voluntaryExcess && ai.voluntaryExcess;
  const fills = {
    ...(fillCompulsory ? { compulsoryExcess: fillCompulsory, lessExcess: fillCompulsory } : {}),
    ...(fillVoluntary ? { voluntaryExcess: fillVoluntary } : {}),
  };
  const hpa = data.hpa_with || claim.policy.hpaWith;
  const updated = {
    ...claim,
    policyCheck,
    // An old claim may have no feeBill: only create one when there is an excess to fill.
    ...(claim.feeBill || Object.keys(fills).length ? { feeBill: { ...claim.feeBill, ...fills } } : {}),
    policy: {
      ...claim.policy,
      policyNumber: data.policy_number || claim.policy.policyNumber,
      insuredName: data.insured_name || claim.policy.insuredName,
      insuredAddress: data.insured_address || claim.policy.insuredAddress,
      insuredMobile: data.insured_mobile || claim.policy.insuredMobile,
      insurerName:
        data.insurer_name && data.insurer_address
          ? `${data.insurer_name} ${data.insurer_address}`
          : data.insurer_name || claim.policy.insurerName,
      idv: parseAmount(data.idv) || claim.policy.idv,
      // Write to both hpaWith (primary) and hpa (alias) so all report paths are covered
      hpaWith: hpa,
      periodFrom: parseDate(data.period_from) || claim.policy.periodFrom,
      periodTo: parseDate(data.period_to) || claim.policy.periodTo,
      policyIssuingOffice: data.policy_issuing_office || claim.policy.policyIssuingOffice,
      // appointingOffice is intentionally NOT read from AI — surveyor fills this manually
      appointingOffice: claim.policy.appointingOffice,
      policyType: data.policy_type || claim.policy.policyType,
    },
    vehicle: {
      ...claim.vehicle,
      hypothecation: hpa || claim.vehicle.hypothecation,
      rcEndorsement: hpa || claim.vehicle.rcEndorsement,
    },
  };
  if (data.registration_number) updated.vehicle.registrationNumber = data.registration_number;
  if (data.chassis_number) updated.vehicle.chassisNumber = data.chassis_number;
  if (data.engine_number) updated.vehicle.engineNumber = data.engine_number;
  if (data.make_model && !claim.vehicle.make) {
    const parts = data.make_model.split(/[/,\s]+/);
    if (parts.length >= 2) {
      updated.vehicle.make = parts[0].trim();
      updated.vehicle.model = parts.slice(1).join(' ').trim();
    }
  }
  return updated;
}

function applyDL(claim: ClaimData, data: any): ClaimData {
  return {
    ...claim,
    driver: {
      ...claim.driver,
      licenceNumber: data.licence_number || data.dl_no || claim.driver.licenceNumber,
      parentName: data.father_or_husband_name || data.father_name || data.parent_name || claim.driver.parentName,
      relationType: data.relation_type || claim.driver.relationType,
      dateOfBirth: parseDate(data.date_of_birth || data.dob) || claim.driver.dateOfBirth,
      address: data.address || claim.driver.address,
      dateOfIssue: parseDate(data.date_of_issue || data.issue_date) || claim.driver.dateOfIssue,
      issuingAuthority: data.issuing_authority || data.rto || claim.driver.issuingAuthority,
      vehicleClasses: data.vehicle_classes || data.classes || data.authorized_classes || claim.driver.vehicleClasses,
      badgeNumber: data.badge_no || claim.driver.badgeNumber,
      validityNonTransport: parseDate(data.validity_non_transport || data.valid_nt) || claim.driver.validityNonTransport,
      validityTransport: parseDate(data.validity_transport || data.valid_t) || claim.driver.validityTransport,
    },
    // NOTE: driver fields are now exclusively in driver.* — no spotDetails dual-write needed.
  };
}

export function applyClaim(claim: ClaimData, data: any): ClaimData {
  // Unreadable date → keep what's there. Writing "T00:00" alone made the
  // datetime-local input render blank and wiped a good earlier value.
  const accidentDate = parseDate(data.date_of_accident || '');
  let tpInvolved = claim.spotDetails.tpInvolved;
  if (data.third_party_details && data.third_party_details.toLowerCase() !== 'nil') {
    const s = data.third_party_details.toLowerCase();
    tpInvolved =
      (s.includes('injur') || s.includes('death')) && (s.includes('damage') || s.includes('property'))
        ? 'both'
        : s.includes('injur') || s.includes('death')
        ? 'tppi'
        : 'tppd';
  }
  return {
    ...claim,
    policy: {
      ...claim.policy,
      claimNumber: data.claim_number || claim.policy.claimNumber,
      policyNumber: data.policy_number || claim.policy.policyNumber,
      insuredName: data.insured_name || claim.policy.insuredName,
    },
    vehicle: {
      ...claim.vehicle,
      registrationNumber: data.vehicle_number || claim.vehicle.registrationNumber,
    },
    driver: {
      ...claim.driver,
      name: data.driver_name || claim.driver.name,
      licenceNumber: data.driver_licence_no || claim.driver.licenceNumber,
    },
    accident: {
      ...claim.accident,
      placeOfAccident: data.place_of_accident || claim.accident.placeOfAccident,
      causeOfAccident: data.cause_of_accident || claim.accident.causeOfAccident,
      placeOfSurvey: data.workshop_name || data.place_of_repair || claim.accident.placeOfSurvey,
      thirdPartyDetails: data.third_party_details || claim.accident.thirdPartyDetails,
      dateAndTime: accidentDate
        ? `${accidentDate}T${parseTime(data.time_of_accident) || parseTime(data.date_of_accident) || '00:00'}`
        : claim.accident.dateAndTime,
    },
    // NOTE: surveyPlace -> accident.placeOfSurvey, thirdPartyDetails -> accident.thirdPartyDetails
    // driver.name and driver.licenceNumber already set above — no spotDetails dual-write needed.
    spotDetails: { ...claim.spotDetails, tpInvolved },
  };
}

function applyPermit(claim: ClaimData, data: any): ClaimData {
  const updated = {
    ...claim,
    spotDetails: {
      ...claim.spotDetails,
      permitNo: data.permit_no || claim.spotDetails.permitNo,
      permitType: data.permit_type || claim.spotDetails.permitType,
      permitFrom: parseDate(data.validity_from) || claim.spotDetails.permitFrom,
      permitTo: parseDate(data.validity_to) || claim.spotDetails.permitTo,
    },
    vehicle: { ...claim.vehicle },
  };
  if (data.route) updated.vehicle.route = data.route;
  const gvwStr = String(data.gross_vehicle_weight_kg || '0').replace(/[^0-9.]/g, '');
  const ulwStr = String(data.unladen_weight_kg || '0').replace(/[^0-9.]/g, '');
  if (gvwStr) updated.spotDetails.gvw = Math.round(parseFloat(gvwStr));
  if (ulwStr) updated.spotDetails.ulw = Math.round(parseFloat(ulwStr));
  return updated;
}

function applyAuth(claim: ClaimData, data: any): ClaimData {
  return {
    ...claim,
    spotDetails: {
      ...claim.spotDetails,
      authNo: data.auth_no || claim.spotDetails.authNo,
      authValid: parseDate(data.validity_to) || claim.spotDetails.authValid,
    },
  };
}

export function applyFitness(claim: ClaimData, data: any): ClaimData {
  const updated = {
    ...claim,
    vehicle: {
      ...claim.vehicle,
      fitnessNo: data.fitness_cert_no || claim.vehicle.fitnessNo,
      fitnessValidUpto: parseDate(data.validity_to) || claim.vehicle.fitnessValidUpto,
      ...(data.seating_capacity ? { seatingCapacity: data.seating_capacity } : {}),
      ...(data.chassis_number ? { chassisNumber: data.chassis_number || claim.vehicle.chassisNumber } : {}),
      ...(data.engine_number ? { engineNumber: data.engine_number || claim.vehicle.engineNumber } : {}),
      ...(data.fitness_type ? { fitnessType: data.fitness_type } : {}),
    },
    spotDetails: { ...claim.spotDetails },
  };
  // NOTE: fitnessNo/fitnessValid removed from spotDetails — vehicle.* is the single source of truth.
  const gvwStr = String(data.gross_vehicle_weight_kg || '').replace(/[^0-9.]/g, '');
  const ulwStr = String(data.unladen_weight_kg || '').replace(/[^0-9.]/g, '');
  if (gvwStr) {
    const val = Math.round(parseFloat(gvwStr));
    updated.spotDetails.gvw = val;
    updated.vehicle.grossWeight = val;
    updated.vehicle.registeredLoadWeight = String(val);
  }
  if (ulwStr) {
    const val = Math.round(parseFloat(ulwStr));
    updated.spotDetails.ulw = val;
    updated.vehicle.unladenWeight = val;
  }
  const effGvw = updated.spotDetails.gvw || 0;
  const effUlw = updated.spotDetails.ulw || 0;
  if (effGvw > 0) {
    updated.spotDetails.loadCapacity = (effGvw > effUlw && effUlw > 0) ? effGvw - effUlw : effGvw;
  }
  return updated;
}

/** Printed load weight → kg. The prompt keeps the unit apart because the digits-only format rule would strip it. */
export function weightToKg(weight: unknown, unit: unknown): number {
  const n = parseFloat(String(weight ?? '').replace(/,/g, ''));
  if (!(n > 0)) return 0;
  const u = String(unit ?? '').toLowerCase();
  if (/qu?i?ntal|qtl/.test(u)) return Math.round(n * 100);
  if (/^\s*(mt|t|tons?|tonnes?|metric)/.test(u)) return Math.round(n * 1000);
  return Math.round(n); // kg, or no unit printed
}

/** Load challan / LR / E-way bill / invoice. A blank field keeps what the claim already has. */
export function applyLoadChallan(claim: ClaimData, data: any): ClaimData {
  const sd = claim.spotDetails;
  const goods = String(data.goods_description || '').trim();
  const details = [
    goods,
    data.goods_value && `value Rs. ${data.goods_value}`,
    data.hazardous && !/^(no|nil|none|n\.?a\.?|non[- ]?hazardous)$/i.test(String(data.hazardous).trim()) && `hazardous: ${data.hazardous}`,
  ].filter(Boolean).join('; ');
  const kg = weightToKg(data.weight, data.weight_unit);
  const date = parseDate(data.document_date);
  const no = String(data.document_no || '').trim();
  const dv = claim.documentVerification?.loadChallan;
  const dvDetail = no
    ? `${data.document_kind || 'Load Challan'} No. ${no}${date ? ` dt ${date}` : ''}${data.valid_until ? `, valid until ${parseDate(data.valid_until) || data.valid_until}` : ''}`
    : '';
  return {
    ...claim,
    spotDetails: {
      ...sd,
      challanNo: no || sd.challanNo,
      challanDate: date || sd.challanDate,
      loadOrigin: data.origin || sd.loadOrigin,
      loadDest: data.destination || sd.loadDest,
      loadDesc: details || sd.loadDesc,
      actualLoad: kg || sd.actualLoad,
    },
    vehicle: {
      ...claim.vehicle,
      goodsWeightAtAccident: kg ? String(kg) : claim.vehicle.goodsWeightAtAccident,
      actualPayload: kg ? String(kg) : claim.vehicle.actualPayload,
      natureOfGoods: goods || claim.vehicle.natureOfGoods,
      detailsOfGoodsCarried: details || claim.vehicle.detailsOfGoodsCarried,
    },
    documentVerification: {
      ...claim.documentVerification,
      // The document was produced, so it is obtained; the surveyor's own note wins.
      loadChallan: {
        status: 'YES',
        detail: dv?.detail || dvDetail,
      },
    },
  };
}

/**
 * 'continue' = this file is more pages of the bill already read: rows already
 * billed are not re-matched, and the earlier bill no. / date / total survive a
 * page that does not print them. 'replace' reads the bill fresh.
 */
export function applyFinalBill(
  claim: ClaimData,
  data: any,
  mode: 'replace' | 'continue' = 'replace',
): ClaimData {
  const continuing = mode === 'continue';
  const prev = claim.billCheck;
  const billItems = buildBillItems(data);
  const rowMatches = matchBillItemsToRows(
    continuing ? claim.assessmentRows.filter((r) => !(r.billedAmount && r.billedAmount > 0)) : claim.assessmentRows,
    billItems,
  );
  const matchedBillIds = new Set(Array.from(rowMatches.values()).map((m) => m.bill.idx));

  const updatedRows = claim.assessmentRows.map((row) => {
    const m = rowMatches.get(row.id);
    if (!m) return row;
    const billedAmt = m.bill.totalAmount || 0;
    const billedTax = m.bill.taxableAmount || 0;
    const refSr = m.bill.srNo ?? (m.bill.idx + 1);
    const refStatus = m.ambiguous ? ('ambiguous' as const) : ('clean' as const);
    const refMatch = { bill: extraFromBillItem(m.bill), score: m.score, reasons: m.reasons };
    if (!row.allowed) {
      return {
        ...row,
        billedTaxable: billedTax,
        billedAmount: billedAmt,
        billStatus: 'not-allowed' as const,
        billRemarks: row.billRemarks || 'Workshop billed for a disallowed item',
        refSrNo: refSr,
        refStatus,
        refMatch,
      };
    }
    // The bill differing from the estimate is exactly the surveyor's "wrong
    // pricings during estimates which are later corrected". It is surfaced as
    // a divergence flag against the ASSESSMENT, which is what drives the cap,
    // rather than as a status against the estimate that changed no arithmetic.
    // A doubtful match is carried by refStatus, not a remark that would print.
    return {
      ...row,
      billedTaxable: billedTax,
      billedAmount: billedAmt,
      billStatus: 'in-bill' as const,
      refSrNo: refSr,
      refStatus,
      refMatch,
    };
  });

  const extras: ExtraBillItem[] = billItems
    .filter((bi) => !matchedBillIds.has(bi.idx))
    .map(extraFromBillItem);

  // Merge, don't overwrite: the surveyor may have deleted or promoted items
  // from a previous upload of this bill.
  const seen = new Set((claim.extraBillItems || []).map((e) => e.id));
  const merged = [...(claim.extraBillItems || []), ...extras.filter((e) => !seen.has(e.id))];

  return {
    ...claim,
    billCheck: continuing
      ? {
          ...prev,
          billNo: prev?.billNo || data.bill_number || '',
          billDate: prev?.billDate || data.bill_date || '',
          billTotal: data.total_amount || prev?.billTotal || 0,
          ...(prev?.baseDocument || data.baseDocument ? { baseDocument: prev?.baseDocument || data.baseDocument } : {}),
        }
      : {
          ...prev,
          billNo: data.bill_number || '',
          billDate: data.bill_date || '',
          billTotal: data.total_amount || 0,
          ...(prev?.baseDocument || data.baseDocument ? { baseDocument: prev?.baseDocument || data.baseDocument } : {}),
        },
    assessmentRows: updatedRows,
    extraBillItems: merged,
  };
}

/**
 * Summarises the assessment sheet for the "re-scan or supplementary?" question,
 * or returns null when there is nothing to lose and the question is pointless.
 *
 * The gate is ANY row on the sheet, not just rows a previous AI apply tagged.
 * Gating on `source` meant a sheet the surveyor had typed in by hand looked
 * empty to this check, so the question was skipped and the upload replaced
 * their work without asking — the whole defect this feature exists to prevent.
 *
 * Called BEFORE the document is read, so it can only describe the claim side.
 * That is the deliberate trade for not billing an extraction the surveyor may
 * cancel.
 */
export function buildEstimateModePrompt(
  claim: ClaimData | null,
): { rowCount: number; total: number } | null {
  const rows = claim?.assessmentRows;
  if (!rows || rows.length === 0) return null;

  return {
    rowCount: rows.length,
    total: rows.reduce((sum, r) => sum + (r.estimated || 0), 0),
  };
}

/**
 * Summarises what a bill upload would collide with, for the "more pages or the
 * same bill again?" question. Null when no bill has been read yet. Like the
 * estimate prompt, it runs BEFORE extraction and describes the claim side only.
 */
export function buildBillModePrompt(
  claim: ClaimData | null,
): { billNo: string; billedRows: number } | null {
  const billNo = claim?.billCheck?.billNo || '';
  const billedRows = (claim?.assessmentRows || []).filter((r) => (r.billedAmount || 0) > 0).length;
  return billNo || billedRows > 0 ? { billNo, billedRows } : null;
}

/**
 * Turns an extracted estimate into assessment rows. Unnumbered items take
 * startSerial, startSerial+1, … with ONE counter across parts → labour → paint
 * (dealer estimates restart their printed numbers per section).
 */
export function buildEstimateRows(
  data: any,
  rowSource: 'estimate' | 'supplementary',
  startSerial: number,
): AssessmentRow[] {
  const newRows: AssessmentRow[] = [];
  let runningSerial = startSerial;

  const estimateId =
    data.estimateId ||
    (data.workshop_name || data.estimate_number
      ? [data.workshop_name, data.estimate_number, data.estimate_date].filter(Boolean).join('-')
      : undefined);

  const extractBase = (item: any): number => {
    const gstPct = item.gst_percent ?? 18;
    if (item.taxable_amount && item.taxable_amount > 0) return item.taxable_amount;
    const gross = item.total_amount || item.amount || 0;
    return gross / (1 + gstPct / 100);
  };

  (data.spare_parts || []).forEach((item: any) => {
    const rounded = Math.round(extractBase(item) * 100) / 100;
    newRows.push(
      createAssessmentRow('parts', {
        source: rowSource,
        estimateId,
        srNo: item.sr_no || runningSerial++,
        particulars: item.description || 'Unnamed Part',
        partNumber: item.part_number || '',
        hsnSac: item.hsn_sac || '',
        quantity: item.quantity ?? 1,
        unitPrice: item.unit_price || 0,
        estimated: rounded,
        assessed: rounded,
        partType: (item.category as any) || 'metal',
        gst: item.gst_percent ?? 18,
      })
    );
  });

  (data.labour_items || []).forEach((item: any) => {
    const rounded = Math.round(extractBase(item) * 100) / 100;
    newRows.push(
      createAssessmentRow('labour', {
        source: rowSource,
        estimateId,
        srNo: item.sr_no || runningSerial++,
        particulars: item.description || 'Labour Item',
        hsnSac: item.hsn_sac || '',
        quantity: item.quantity ?? 1,
        unitPrice: item.unit_price || 0,
        estimated: rounded,
        assessed: rounded,
        partType: 'labour',
        gst: item.gst_percent ?? 18,
      })
    );
  });

  (data.painting_items || []).forEach((item: any) => {
    const rounded = Math.round(extractBase(item) * 100) / 100;
    newRows.push(
      createAssessmentRow('paint', {
        source: rowSource,
        estimateId,
        srNo: item.sr_no || runningSerial++,
        particulars: item.description || 'Painting Item',
        hsnSac: item.hsn_sac || '',
        quantity: item.quantity ?? 1,
        unitPrice: item.unit_price || 0,
        estimated: rounded,
        assessed: rounded,
        partType: 'paint',
        gst: item.gst_percent ?? 18,
      })
    );
  });

  return newRows;
}

/**
 * How an incoming estimate meets the rows already on the sheet.
 *   'replace'  — a re-scan of the primary estimate. Drops rows tagged
 *                'estimate' (continuation pages included); keeps supplementary
 *                and manual rows.
 *   'append'   — a supplementary estimate. Drops nothing.
 *   'continue' — more pages of the same estimate. Drops nothing; new rows are
 *                tagged 'estimate' and numbered on from the highest estimate
 *                serial (1 if the sheet has no estimate rows).
 *   'another'  — another independent estimate (e.g. Quote #2, Quote #3).
 *                Drops nothing. Retains original serial numbers (1..N) as printed,
 *                and tags rows with a distinct estimateId.
 */
export function applyEstimate(
  claim: ClaimData,
  data: any,
  mode: EstimateApplyMode = 'replace',
): ClaimData {
  const sheetMax =
    mode === 'continue'
      ? Math.max(0, ...claim.assessmentRows.filter((r) => r.source === 'estimate').map((r) => r.srNo || 0))
      : 0;
  const startSerial = sheetMax + 1;
  let newRows = buildEstimateRows(data, mode === 'append' ? 'supplementary' : 'estimate', startSerial);
  // The AI numbers an unnumbered page 1, 2, 3…, which would clash with the sheet. Any serial at or
  // below the sheet's highest means the page restarted, so number the whole page on from the sheet.
  // Pages with printed serials past the sheet's highest are kept as printed.
  if (mode === 'continue' && newRows.some((r) => (r.srNo ?? 0) <= sheetMax)) {
    newRows = newRows.map((r, i) => ({ ...r, srNo: startSerial + i }));
  }

  // A re-scan of the primary estimate returns the FULL document, so its old
  // rows go. A supplementary is a DIFFERENT document holding only the extra
  // items — dropping anything there would delete the original assessment,
  // which is exactly the bug this replaces. A continuation adds pages to the
  // same estimate, so it drops nothing either.
  let kept =
    mode === 'append' || mode === 'continue' || mode === 'another'
      ? claim.assessmentRows
      : claim.assessmentRows.filter((r) => r.source !== 'estimate');

  if (mode === 'another') {
    const existingIds = Array.from(
      new Set(claim.assessmentRows.map((r) => r.estimateId).filter(Boolean))
    ) as string[];
    const nextNum = existingIds.length + 1;

    // If existing rows were untagged, tag them so they can be viewed distinctly
    if (existingIds.length === 0 && claim.assessmentRows.length > 0) {
      const firstId = claim.accident?.placeOfSurvey
        ? `${claim.accident.placeOfSurvey}-Quote 1`
        : 'Estimate-1';
      kept = kept.map((r) =>
        r.source === 'estimate' && !r.estimateId ? { ...r, estimateId: firstId } : r
      );
      existingIds.push(firstId);
    }

    // Determine target estimateId for new rows
    let targetId =
      data.estimateId ||
      (data.workshop_name || data.estimate_number
        ? [data.workshop_name, data.estimate_number, data.estimate_date].filter(Boolean).join('-')
        : undefined);

    if (!targetId || existingIds.includes(targetId)) {
      const baseName = data.workshop_name || claim.accident?.placeOfSurvey || 'Estimate';
      targetId = `${baseName}-Quote ${nextNum}`;
    }

    newRows = newRows.map((r) => ({
      ...r,
      estimateId: targetId,
    }));
  }

  return {
    ...claim,
    assessmentRows: [...kept, ...newRows],
    ...(data.workshop_name ? { accident: { ...claim.accident, placeOfSurvey: data.workshop_name } } : {}),
  };
}

// ─── Slice ────────────────────────────────────────────────────────────────────

export const createAIDataSlice: StateCreator<any, any, any, AIDataSlice> = (set) => ({
  reconciliationConflictCount: 0,

  setReconciliationConflictCount: (count) => {
    set({ reconciliationConflictCount: count });
  },

  batchReconcile: (updates) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      let newClaim = state.currentClaim;
      const decisions = { ...(newClaim.reconciliationDecisions ?? {}) };

      for (const { path, value, source } of updates) {
        // Fingerprint against the claim as it was BEFORE this batch, so every
        // decision in one "Accept Recommended" click sees the same sources.
        if (source) decisions[path] = buildDecision(state.currentClaim, path, value, source);
        newClaim = setClaimPath(newClaim, path, value);
      }

      return {
        currentClaim: {
          ...newClaim,
          reconciliationDecisions: decisions,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  setExtractedData: (key, data) => {
    set((state: WithClaim) => ({
      currentClaim: state.currentClaim
        ? {
            ...state.currentClaim,
            extractedData: { ...state.currentClaim.extractedData, [key]: data },
            updatedAt: new Date().toISOString(),
          }
        : null,
      isDirty: true,
    }));
  },

  applyExtractedData: (key: string, data: any, mode?: EstimateApplyMode) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};

      let newClaim = state.currentClaim;
      if (key === 'rc') newClaim = applyRC(newClaim, data);
      else if (key === 'policy') newClaim = applyPolicy(newClaim, data);
      else if (key === 'dl') newClaim = applyDL(newClaim, data);
      else if (key === 'claim') newClaim = applyClaim(newClaim, data);
      else if (key === 'permit') newClaim = applyPermit(newClaim, data);
      else if (key === 'auth') newClaim = applyAuth(newClaim, data);
      else if (key === 'fitness') newClaim = applyFitness(newClaim, data);
      else if (key === 'load-challan') newClaim = applyLoadChallan(newClaim, data);
      else if (key === 'final-bill') newClaim = applyFinalBill(newClaim, data, mode === 'continue' ? 'continue' : 'replace');
      else if (key === 'estimate') newClaim = applyEstimate(newClaim, data, mode ?? 'replace');

      return {
        currentClaim: { ...newClaim, updatedAt: new Date().toISOString() },
        isDirty: true,
      };
    });
  },

  applyEstimateFixToClaim: (plan, picks) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: applyEstimateFix(state.currentClaim.assessmentRows, plan, picks),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  reconcileField: (path, value, source) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const newClaim = setClaimPath(state.currentClaim, path, value);

      // `source` is omitted by auto-fill (getUnanimousFields), which is not a
      // surveyor decision and must not be recorded as one.
      const reconciliationDecisions = source
        ? {
            ...(state.currentClaim.reconciliationDecisions ?? {}),
            [path]: buildDecision(state.currentClaim, path, value, source),
          }
        : state.currentClaim.reconciliationDecisions;

      return {
        currentClaim: {
          ...newClaim,
          reconciliationDecisions,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },
});
