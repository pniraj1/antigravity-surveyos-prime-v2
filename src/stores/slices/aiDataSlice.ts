import type { StateCreator } from 'zustand';
import type { ClaimData, AssessmentRow, ExtraBillItem } from '@/types';
import { createAssessmentRow } from '@/lib/calculations';
import { buildDecision } from '@/lib/ai/reconciliation';

export interface AIDataSlice {
  reconciliationConflictCount: number;
  setExtractedData: (key: string, data: any) => void;
  applyExtractedData: (key: string, data: any) => void;
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
  description: string;
  partNumber: string;
  taxableAmount: number;
  totalAmount: number;
  gstPercent: number;
  section: 'parts' | 'labour' | 'paint';
  category?: string;
  raw: any;
  _ambiguous?: boolean;
}

// ─── Final-bill helpers ───────────────────────────────────────────────────────

function buildBillItems(data: any): BillItem[] {
  const items: BillItem[] = [];

  const push = (arr: any[], section: BillItem['section']) => {
    (arr || []).forEach((i: any) => {
      const gstPct = i.gst_percent || 18;
      let taxable = i.taxable_amount;
      const total = i.total_amount || i.amount || 0;
      if (!taxable || taxable <= 0) taxable = total / (1 + gstPct / 100);
      items.push({
        idx: items.length,
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

function matchBillItemsToRows(
  rows: AssessmentRow[],
  billItems: BillItem[]
): Map<string, { bill: BillItem; reason: 'part' | 'amount' | 'desc' }> {
  const AMT_TOL = 1;
  const normPart = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, '');
  const normDesc = (s: string) => s.toLowerCase().trim();

  const matchedBillIds = new Set<number>();
  const rowMatches = new Map<string, { bill: BillItem; reason: 'part' | 'amount' | 'desc' }>();

  // Step 1: exact part-number match
  rows.forEach((row) => {
    if (rowMatches.has(row.id)) return;
    const rowPart = normPart(row.partNumber || '');
    if (!rowPart) return;
    const hit = billItems.find((bi) => {
      if (matchedBillIds.has(bi.idx)) return false;
      const biPart = normPart(bi.partNumber);
      return biPart && biPart === rowPart;
    });
    if (hit) {
      matchedBillIds.add(hit.idx);
      rowMatches.set(row.id, { bill: hit, reason: 'part' });
    }
  });

  // Step 2: taxable-amount + section match (±₹1)
  rows.forEach((row) => {
    if (rowMatches.has(row.id)) return;
    const rowAmt = row.estimated || 0;
    if (rowAmt <= 0) return;
    const candidates = billItems.filter(
      (bi) =>
        !matchedBillIds.has(bi.idx) &&
        bi.section === row.section &&
        Math.abs(bi.taxableAmount - rowAmt) <= AMT_TOL
    );
    if (candidates.length === 0) return;
    let pick = candidates[0];
    let ambiguous = false;
    if (candidates.length > 1) {
      const rowDesc = normDesc(row.particulars);
      const scored = candidates.map((c) => {
        const cDesc = normDesc(c.description);
        const overlap =
          rowDesc && cDesc && (cDesc.includes(rowDesc) || rowDesc.includes(cDesc))
            ? 2
            : rowDesc && cDesc && cDesc.split(' ').some((w) => w.length > 3 && rowDesc.includes(w))
            ? 1
            : 0;
        return { c, overlap };
      });
      scored.sort((a, b) => b.overlap - a.overlap);
      pick = scored[0].c;
      if (scored[0].overlap === 0 || (scored[1] && scored[0].overlap === scored[1].overlap)) {
        ambiguous = true;
      }
    }
    matchedBillIds.add(pick.idx);
    rowMatches.set(row.id, { bill: pick, reason: ambiguous ? 'desc' : 'amount' });
    if (ambiguous) pick._ambiguous = true;
  });

  // Step 3: fuzzy description fallback
  rows.forEach((row) => {
    if (rowMatches.has(row.id)) return;
    const rowDesc = normDesc(row.particulars);
    if (!rowDesc) return;
    const hit = billItems.find((bi) => {
      if (matchedBillIds.has(bi.idx)) return false;
      if (bi.section !== row.section) return false;
      const biDesc = normDesc(bi.description);
      return biDesc && (biDesc.includes(rowDesc) || rowDesc.includes(biDesc));
    });
    if (hit) {
      matchedBillIds.add(hit.idx);
      rowMatches.set(row.id, { bill: hit, reason: 'desc' });
    }
  });

  return rowMatches;
}

// ─── Key-specific mapping functions ──────────────────────────────────────────

function applyRC(claim: ClaimData, data: any): ClaimData {
  const hypothecation = data.hypothecation || data.hpa || claim.vehicle.hypothecation;
  const rlw =
    typeof data.gross_weight === 'string'
      ? data.gross_weight
      : String(data.gross_weight || data.rlw || claim.vehicle.registeredLoadWeight);
  const yomStr = (data.year_of_manufacture || data.yom)?.toString() || '';
  const yomMatch = yomStr.match(/\b(19|20)\d{2}\b/);
  const yom = yomMatch ? parseInt(yomMatch[0]) : claim.vehicle.yearOfManufacture;

  const gvwStr = String(data.gross_weight || '0').replace(/[^0-9.]/g, '');
  const ulwStr = String(data.unladen_weight || '0').replace(/[^0-9.]/g, '');
  const gvw = gvwStr ? Math.round(parseFloat(gvwStr)) : 0;
  const ulw = ulwStr ? Math.round(parseFloat(ulwStr)) : 0;

  return {
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
      registeredLoadWeight: rlw || claim.vehicle.registeredLoadWeight,
      classOfVehicle: data.class_of_vehicle || data.vehicle_class || claim.vehicle.classOfVehicle,
      registrationType: data.class_of_vehicle || data.vehicle_class || claim.vehicle.registrationType,
      registeringAuthority: data.registering_authority || data.rto || claim.vehicle.registeringAuthority,
      route: data.route || claim.vehicle.route,
      yearOfManufacture: yom,
      registrationValidUpTo: parseDate(data.registration_valid_upto || data.reg_valid_upto || data.regn_valid_upto) || claim.vehicle.registrationValidUpTo,
      hypothecation,
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
      loadCapacity: gvw && ulw && gvw > ulw ? gvw - ulw : claim.spotDetails.loadCapacity,
    },
  };
}

function applyPolicy(claim: ClaimData, data: any): ClaimData {
  const updated = {
    ...claim,
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
      hpaWith: data.hpa_with || claim.policy.hpaWith,
      periodFrom: parseDate(data.period_from) || claim.policy.periodFrom,
      periodTo: parseDate(data.period_to) || claim.policy.periodTo,
      policyIssuingOffice: data.policy_issuing_office || claim.policy.policyIssuingOffice,
      // appointingOffice is intentionally NOT read from AI — surveyor fills this manually
      appointingOffice: claim.policy.appointingOffice,
      policyType: data.policy_type || claim.policy.policyType,
    },
    vehicle: { ...claim.vehicle },
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
      validityNonTransport: parseDate(data.validity_non_transport || data.valid_nt) || claim.driver.validityNonTransport,
      validityTransport: parseDate(data.validity_transport || data.valid_t) || claim.driver.validityTransport,
    },
    // NOTE: driver fields are now exclusively in driver.* — no spotDetails dual-write needed.
  };
}

function applyClaim(claim: ClaimData, data: any): ClaimData {
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
      dateAndTime: data.date_of_accident
        ? `${parseDate(data.date_of_accident)}T${(data.time_of_accident || '00:00').substring(0, 5)}`
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

function applyFitness(claim: ClaimData, data: any): ClaimData {
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
  const gvwStr = String(data.gross_vehicle_weight_kg || '0').replace(/[^0-9.]/g, '');
  const ulwStr = String(data.unladen_weight_kg || '0').replace(/[^0-9.]/g, '');
  if (gvwStr) updated.spotDetails.gvw = Math.round(parseFloat(gvwStr));
  if (ulwStr) updated.spotDetails.ulw = Math.round(parseFloat(ulwStr));
  return updated;
}

function applyLokChallan(claim: ClaimData, data: any): ClaimData {
  return {
    ...claim,
    spotDetails: {
      ...claim.spotDetails,
      challanNo: data.challan_no || claim.spotDetails.challanNo,
      challanDate: parseDate(data.challan_date) || claim.spotDetails.challanDate,
      loadOrigin: data.origin || claim.spotDetails.loadOrigin,
      loadDest: data.destination || claim.spotDetails.loadDest,
      loadDesc: data.goods_description || claim.spotDetails.loadDesc,
      actualLoad: parseFloat(data.weight_kg) || claim.spotDetails.actualLoad,
    },
    vehicle: {
      ...claim.vehicle,
      actualPayload: data.weight_kg || claim.vehicle.actualPayload,
    },
  };
}

function applyFinalBill(claim: ClaimData, data: any): ClaimData {
  const billItems = buildBillItems(data);
  const rowMatches = matchBillItemsToRows(claim.assessmentRows, billItems);
  const matchedBillIds = new Set(Array.from(rowMatches.values()).map((m) => m.bill.idx));

  const AMT_TOL = 1;
  const updatedRows = claim.assessmentRows.map((row) => {
    const m = rowMatches.get(row.id);
    if (!m) return row;
    const billedAmt = m.bill.totalAmount || 0;
    const billedTax = m.bill.taxableAmount || 0;
    const partial =
      m.reason === 'part' &&
      row.estimated > 0 &&
      Math.abs(m.bill.taxableAmount - row.estimated) > AMT_TOL;
    if (!row.allowed) {
      return {
        ...row,
        billedTaxable: billedTax,
        billedAmount: billedAmt,
        billStatus: 'not-allowed' as const,
        billRemarks: row.billRemarks || 'Workshop billed for a disallowed item',
      };
    }
    const status: 'in-bill' | 'partial' = partial ? 'partial' : 'in-bill';
    const remark = m.bill._ambiguous ? 'Ambiguous amount match — please verify' : row.billRemarks;
    return { ...row, billedTaxable: billedTax, billedAmount: billedAmt, billStatus: status, billRemarks: remark };
  });

  const unmatched: ExtraBillItem[] = billItems
    .filter((bi) => !matchedBillIds.has(bi.idx))
    .map((bi, i) => ({
      id: `extra-${Date.now()}-${i}`,
      description: bi.description || 'Unnamed item',
      amount: bi.totalAmount,
      category:
        bi.section === 'parts' ? 'spare_parts' : bi.section === 'labour' ? 'labour' : 'painting',
      source: 'final-bill' as const,
    }));

  return {
    ...claim,
    billCheck: {
      billNo: data.bill_number || '',
      billDate: data.bill_date || '',
      billTotal: data.total_amount || 0,
    },
    assessmentRows: updatedRows,
    extraBillItems: unmatched,
  };
}

export function applyEstimate(claim: ClaimData, data: any): ClaimData {
  const newRows: AssessmentRow[] = [];
  let runningSerial = 1;

  const extractBase = (item: any): number => {
    const gstPct = item.gst_percent || 18;
    if (item.taxable_amount && item.taxable_amount > 0) return item.taxable_amount;
    const gross = item.total_amount || item.amount || 0;
    return gross / (1 + gstPct / 100);
  };

  (data.spare_parts || []).forEach((item: any) => {
    const rounded = Math.round(extractBase(item) * 100) / 100;
    newRows.push(
      createAssessmentRow('parts', {
        source: 'estimate',
        srNo: item.sr_no || runningSerial++,
        particulars: item.description || 'Unnamed Part',
        partNumber: item.part_number || '',
        hsnSac: item.hsn_sac || '',
        quantity: item.quantity || 1,
        unitPrice: item.unit_price || 0,
        estimated: rounded,
        assessed: rounded,
        partType: (item.category as any) || 'metal',
        gst: item.gst_percent || 18,
      })
    );
  });

  (data.labour_items || []).forEach((item: any) => {
    const rounded = Math.round(extractBase(item) * 100) / 100;
    newRows.push(
      createAssessmentRow('labour', {
        source: 'estimate',
        srNo: item.sr_no || runningSerial++,
        particulars: item.description || 'Labour Item',
        hsnSac: item.hsn_sac || '',
        quantity: item.quantity || 1,
        unitPrice: item.unit_price || 0,
        estimated: rounded,
        assessed: rounded,
        partType: 'labour',
        gst: item.gst_percent || 18,
      })
    );
  });

  (data.painting_items || []).forEach((item: any) => {
    const rounded = Math.round(extractBase(item) * 100) / 100;
    newRows.push(
      createAssessmentRow('paint', {
        source: 'estimate',
        srNo: item.sr_no || runningSerial++,
        particulars: item.description || 'Painting Item',
        hsnSac: item.hsn_sac || '',
        quantity: item.quantity || 1,
        unitPrice: item.unit_price || 0,
        estimated: rounded,
        assessed: rounded,
        partType: 'paint',
        gst: item.gst_percent || 18,
      })
    );
  });

  // Rows stay grouped parts → labour → paint, each section in document order.
  // Do NOT sort by srNo: estimates that restart numbering per section
  // (parts 1..N, labour 1..M) would interleave into 1-part/1-labour/2-part/2-labour,
  // and multiple estimate PDFs would shuffle across documents.
  //
  // Re-applying an estimate (re-scan/re-upload returns the FULL document again)
  // replaces previous AI-created rows; manually added rows are preserved.
  return {
    ...claim,
    assessmentRows: [...claim.assessmentRows.filter((r) => r.source !== 'estimate'), ...newRows],
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

  applyExtractedData: (key, data) => {
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
      else if (key === 'lok-challan') newClaim = applyLokChallan(newClaim, data);
      else if (key === 'final-bill') newClaim = applyFinalBill(newClaim, data);
      else if (key === 'estimate') newClaim = applyEstimate(newClaim, data);

      return {
        currentClaim: { ...newClaim, updatedAt: new Date().toISOString() },
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
