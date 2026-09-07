// ═══════════════════════════════════════════════════════════
// ASSESSMENT SUMMARY ENGINE
// Mirrors: recalcSummary() from Surveyor_V6_MASTER.html
// lines 1896-1910 — the core financial brain
// ═══════════════════════════════════════════════════════════

import type { AssessmentRow, AssessmentSummary, BillCheckSummary, DepreciationType, FeeBill } from '@/types';
import { computeRowLiability, effectiveAssessed } from './row-net';
import { rowDepRate, type PaintDepClaim } from './row-dep-rate';
import { numberToWords } from './utils';

/**
 * Compulsory excess for a claim.
 *
 * `feeBill` carries two fields for one number: `compulsoryExcess` and the older
 * `lessExcess`. The excess input in AssessmentSummary writes BOTH, so they agree
 * for anything edited in the app — but claims created before that, and the
 * bundled mock claim, can hold different values in each.
 *
 * This resolution order is the one the final-survey PDF builders already used,
 * which is the behaviour to match: prefer `compulsoryExcess`, fall back to the
 * legacy field, then zero. `??` (not `||`) so an explicit 0 stays 0.
 *
 * ponytail: `lessExcess` stays in the type — dropping it needs a migration of
 * stored claims. Centralising the read is what stops the two disagreeing.
 */
export function getCompulsoryExcess(feeBill?: Partial<FeeBill> | null): number {
  return feeBill?.compulsoryExcess ?? feeBill?.lessExcess ?? 0;
}

/**
 * Both excess fields set to the one resolved value, for writing back onto a
 * loaded claim.
 *
 * getCompulsoryExcess() only helps the callers that remember to use it. Eight
 * screens read `feeBill.compulsoryExcess` directly, so a claim holding the
 * excess only in the legacy `lessExcess` had it deducted by the Final Report
 * and ignored by Bill Check, Fees, the Assessment summary and the Insured
 * Summary — the same claim settling at two different nets. claimSlice.loadClaim
 * applies this once, on the single path every persisted claim takes into the
 * app, so a raw read can no longer disagree with the resolved one.
 */
export function resolveExcessFields(
  feeBill: Partial<FeeBill>,
): { compulsoryExcess: number; lessExcess: number } {
  const excess = getCompulsoryExcess(feeBill);
  return { compulsoryExcess: excess, lessExcess: excess };
}

/**
 * Calculate the full assessment summary from rows.
 * This is the EXACT logic from the legacy recalcSummary(),
 * extracted into a pure function.
 *
 * Legacy calculation flow:
 * 1. For each parts row: apply depreciation, bucket into metal/plastic/glass
 * 2. Sum labour + paint rows (no depreciation)
 * 3. Parts GST: 9% CGST + 9% SGST
 * 4. Labour GST: 18% flat
 * 5. Grand = partsTotal + labourTotal
 * 6. Net = max(0, grand - salvage - excess)
 */
export function calculateAssessmentSummary(
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType,
  salvage: number = 0,
  compulsoryExcess: number = 0,
  voluntaryExcess: number = 0,
  // Paint's GR-9 rate is a claim-level setting, so the engine needs the claim's
  // three paint fields. Optional: omitted means no paint material depreciation,
  // which is exactly how every stored claim behaved before this existed.
  paintDep: PaintDepClaim = { depreciationType: depType }
): AssessmentSummary {
  let metal = 0;
  let plastic = 0;
  let glass = 0;
  let fiberglass = 0;
  let labourBase = 0;
  let partsGSTAccumulator = 0;
  let labourGSTAccumulator = 0;
  // Split out so reports can show Labour and Painting as separate heads.
  let labourOnlyBase = 0, labourOnlyGST = 0;
  let paintOnlyBase = 0, paintOnlyGST = 0;
  // Per-material GST, accumulated at each row's own rate.
  let metalGST = 0, plasticGST = 0, glassGST = 0, fiberglassGST = 0;

  // ─── Assessment Logic ──────────────────────────────
  rows.forEach((r) => {
    if (!r.allowed) return;
    const depRate = rowDepRate(r, ageMonths, { ...paintDep, depreciationType: depType });
    // effectiveAssessed, not r.assessed: an IMT-23 row is halved before
    // depreciation, so the bucket and its GST both carry the reduced figure.
    // The estimate accumulators further down deliberately keep reading
    // r.estimated — an estimate is a fact about the garage's document and
    // nothing the surveyor ticks changes it.
    const valueAfterDep = effectiveAssessed(r) * (1 - depRate / 100);

    if (r.isDisposal) {
      // Disposal (used/salvaged part): no GST; surveyor allows disposalPercent% of depreciated value
      const disposalFactor = (r.disposalPercent ?? 50) / 100;
      const disposalValue = valueAfterDep * disposalFactor;
      if (r.section === 'parts') {
        if (r.partType === 'metal') metal += disposalValue;
        else if (r.partType === 'glass') glass += disposalValue;
        else if (r.partType === 'fiberglass') fiberglass += disposalValue;
        else plastic += disposalValue;
        // No GST accumulated for disposal parts
      } else {
        labourBase += disposalValue;
        if (r.section === 'paint') paintOnlyBase += disposalValue;
        else labourOnlyBase += disposalValue;
        // No GST accumulated for disposal labour
      }
    } else {
      // Normal new part: apply GST on depreciated value
      const rowGST = valueAfterDep * (r.gst / 100);
      if (r.section === 'parts') {
        if (r.partType === 'metal') { metal += valueAfterDep; metalGST += rowGST; }
        else if (r.partType === 'glass') { glass += valueAfterDep; glassGST += rowGST; }
        else if (r.partType === 'fiberglass') { fiberglass += valueAfterDep; fiberglassGST += rowGST; }
        else { plastic += valueAfterDep; plasticGST += rowGST; }
        partsGSTAccumulator += rowGST;
      } else {
        labourBase += valueAfterDep;
        labourGSTAccumulator += rowGST;
        if (r.section === 'paint') { paintOnlyBase += valueAfterDep; paintOnlyGST += rowGST; }
        else { labourOnlyBase += valueAfterDep; labourOnlyGST += rowGST; }
      }
    }
  });

  const partsBase = metal + plastic + glass + fiberglass;
  const grandTotal = partsBase + partsGSTAccumulator + labourBase + labourGSTAccumulator;
  
  const totalExcess = compulsoryExcess + voluntaryExcess;
  const netAssessedLoss = Math.max(0, grandTotal - salvage - totalExcess);

  // ─── Estimated totals (from Invoice — computed locally, zero API cost) ──────
  // NOTE: estimated/assessed store BASE (taxable) amounts; GST is added here.
  let estPartsBase = 0;
  let estPartsGST = 0;
  let estLabourBase = 0;
  let estLabourGST = 0;
  // Per-material estimate, every row — pairs with the assessed material totals,
  // which ARE allowed-only, because an estimate and an assessment answer
  // different questions.
  let estMetal = 0, estPlastic = 0, estGlass = 0, estFiberglass = 0;
  let estLabourOnly = 0, estPaintOnly = 0;
  rows.forEach((r) => {
    const gstRate = (r.gst ?? 18) / 100;
    if (r.section === 'parts') {
      estPartsBase += r.estimated;
      // Disposal parts carry no GST on the estimate either
      if (!r.isDisposal) estPartsGST += r.estimated * gstRate;
      // No `allowed` guard. An estimate is a fact about the garage's document;
      // nothing the surveyor decides changes what was estimated. The guard used
      // to sit here made this split disagree with estPartsBase directly above.
      if (r.partType === 'metal') estMetal += r.estimated;
      else if (r.partType === 'glass') estGlass += r.estimated;
      else if (r.partType === 'fiberglass') estFiberglass += r.estimated;
      else estPlastic += r.estimated;
    } else {
      // labour + paint
      estLabourBase += r.estimated;
      if (!r.isDisposal) estLabourGST += r.estimated * gstRate;
      if (r.section === 'paint') estPaintOnly += r.estimated;
      else estLabourOnly += r.estimated;
    }
  });
  const totalEstimated = estPartsBase + estPartsGST + estLabourBase + estLabourGST;

  return {
    metalTotal: metal,
    plasticTotal: plastic,
    glassTotal: glass,
    fiberglassTotal: fiberglass,
    partsBase,
    partsCGST: partsGSTAccumulator / 2,
    partsSGST: partsGSTAccumulator / 2,
    partsTotal: partsBase + partsGSTAccumulator,

    labourBase,
    labourGST: labourGSTAccumulator,
    labourTotal: labourBase + labourGSTAccumulator,

    // Disposal rows carry no GST, so their value passes through unchanged.
    metalTotalInclGst: metal + metalGST,
    plasticTotalInclGst: plastic + plasticGST,
    glassTotalInclGst: glass + glassGST,
    fiberglassTotalInclGst: fiberglass + fiberglassGST,

    labourOnlyBase,
    labourOnlyTotal: labourOnlyBase + labourOnlyGST,
    paintOnlyBase,
    paintOnlyTotal: paintOnlyBase + paintOnlyGST,
    estimateLabourOnlyBase: estLabourOnly,
    estimatePaintOnlyBase: estPaintOnly,

    grandTotal,
    salvage,
    compulsoryExcess,
    voluntaryExcess,
    excess: totalExcess,
    netAssessedLoss,
    netInWords: `RUPEES ${numberToWords(netAssessedLoss)} ONLY`,

    totalEstimated,
    estimatePartsBase: estPartsBase,
    estimateMetalBase: estMetal,
    estimatePlasticBase: estPlastic,
    estimateGlassBase: estGlass,
    estimateFiberglassBase: estFiberglass,
    estimatePartsGST: estPartsGST,
    estimatePartsTotal: estPartsBase + estPartsGST,
    estimateLabourBase: estLabourBase,
    estimateLabourGST: estLabourGST,
    estimateLabourTotal: estLabourBase + estLabourGST,
    estimateGrossTotal: totalEstimated,
  };
}

export function calculateBillCheckSummary(
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType,
  salvage: number = 0,
  compulsoryExcess: number = 0,
  voluntaryExcess: number = 0,
  paintDep: PaintDepClaim = { depreciationType: depType }
): BillCheckSummary {
  let assessedBaseSum = 0;
  let billedBaseSum = 0;
  let notInBillTotal = 0;
  let billedGrandTotal = 0;

  rows.forEach(r => {
    // Disallowed items are not insurer liability, so they are not verified here.
    if (!r.allowed) return;

    const depRate = rowDepRate(r, ageMonths, { ...paintDep, depreciationType: depType });

    const { liability } = computeRowLiability(r, depRate);

    assessedBaseSum += r.assessed;
    billedBaseSum += r.billStatus === 'not-in-bill' ? 0 : (r.billedTaxable ?? r.assessed);

    if (r.billStatus === 'not-in-bill') {
      notInBillTotal += r.assessed;
    } else {
      billedGrandTotal += liability;
    }
  });

  const totalExcess = compulsoryExcess + voluntaryExcess;
  const netLiability = Math.max(0, billedGrandTotal - salvage - totalExcess);

  return {
    grandTotalAssessed: assessedBaseSum,
    grandTotalBilled: billedGrandTotal,
    notInBillTotal,
    variance: assessedBaseSum - billedBaseSum,
    salvage,
    compulsoryExcess,
    voluntaryExcess,
    excess: totalExcess,
    netLiability,
    netInWords: `RUPEES ${numberToWords(netLiability)} ONLY`,
  };
}

/**
 * Create a new blank assessment row.
 */
export function createAssessmentRow(
  section: AssessmentRow['section'],
  overrides?: Partial<AssessmentRow>
): AssessmentRow {
  // A key that is *present but undefined* still wins the spread and wipes the
  // default below — `{ assessed: 0, ...{ assessed: undefined } }` is undefined,
  // not 0. That is how rows reach Firestore with no `assessed`, which then
  // crashes every `toLocaleString` that reads it. Drop undefined overrides.
  const defined = Object.fromEntries(
    Object.entries(overrides ?? {}).filter(([, v]) => v !== undefined)
  ) as Partial<AssessmentRow>;
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    particulars: '',
    estimated: 0,
    assessed: 0,
    partType: section === 'labour' ? 'labour' : section === 'paint' ? 'paint' : 'metal',
    gst: 18,
    section,
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...defined,
  };
}

/**
 * Repair a persisted row whose money fields are missing or non-finite.
 *
 * The UI and both report builders read `estimated` / `assessed` / `gst` as
 * guaranteed numbers, so an `undefined` (from an older claim, or from the
 * spread trap fixed above) throws on `toLocaleString` and takes the whole tab
 * down behind the error boundary. `NaN` is caught too — it renders as "₹NaN"
 * and poisons every subtotal it feeds.
 *
 * The `assessed` fallback mirrors what the app already does when a row is
 * allowed (assessmentSlice sets `assessed = estimated`) and when an extra bill
 * item is promoted (not allowed lands at zero). It invents no new policy.
 */
export function repairAssessmentRow(row: AssessmentRow): AssessmentRow {
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  const estimated = num(row.estimated, 0);
  return {
    ...row,
    estimated,
    assessed: num(row.assessed, row.allowed === false ? 0 : estimated),
    gst: num(row.gst, 18),
  };
}


// ─── Constructive Total Loss Detection ─────────────────────────────────────
// IRDA / industry standard threshold: repair cost ≥ 75% of IDV.
// This function ONLY detects — the surveyor makes the final call via UI toggle.

export const CTL_THRESHOLD = 0.75;

export interface CTLStatus {
  /** True when netAssessedLoss / idv >= CTL_THRESHOLD */
  isCTL: boolean;
  /** Ratio as a decimal, e.g. 0.975 for 97.5% */
  ratio: number;
  netAssessedLoss: number;
  idv: number;
}

/**
 * Detect if a claim's repair cost exceeds the CTL threshold.
 * Safe to call with any IDV string (handles commas, blanks, zeros).
 */
export function detectCTL(
  netAssessedLoss: number,
  idvRaw: string | number | undefined
): CTLStatus {
  const idv = parseFloat(String(idvRaw ?? '0').replace(/,/g, '')) || 0;
  if (idv <= 0) {
    return { isCTL: false, ratio: 0, netAssessedLoss, idv: 0 };
  }
  const ratio = netAssessedLoss / idv;
  return { isCTL: ratio >= CTL_THRESHOLD, ratio, netAssessedLoss, idv };
}
