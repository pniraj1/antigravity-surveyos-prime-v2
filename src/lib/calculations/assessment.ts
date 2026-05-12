// ═══════════════════════════════════════════════════════════
// ASSESSMENT SUMMARY ENGINE
// Mirrors: recalcSummary() from Surveyor_V6_MASTER.html
// lines 1896-1910 — the core financial brain
// ═══════════════════════════════════════════════════════════

import type { AssessmentRow, AssessmentSummary, BillCheckSummary, DepreciationType } from '@/types';
import { getDepreciationRate } from './depreciation';
import { calculatePartsGST, calculateLabourGST } from './gst';
import { numberToWords } from './utils';

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
  compulsoryExcess: number = 500,
  voluntaryExcess: number = 0
): AssessmentSummary {
  let metal = 0;
  let plastic = 0;
  let glass = 0;
  let fiberglass = 0;
  let labourBase = 0;
  let partsGSTAccumulator = 0;
  let labourGSTAccumulator = 0;

  // ─── Assessment Logic ──────────────────────────────
  rows.forEach((r) => {
    if (!r.allowed) return;
    const depRate = r.depOverride !== undefined ? r.depOverride : getDepreciationRate(r.partType, ageMonths, depType);
    const valueAfterDep = r.assessed * (1 - depRate / 100);

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
        // No GST accumulated for disposal labour
      }
    } else {
      // Normal new part: apply GST on depreciated value
      const rowGST = valueAfterDep * (r.gst / 100);
      if (r.section === 'parts') {
        if (r.partType === 'metal') metal += valueAfterDep;
        else if (r.partType === 'glass') glass += valueAfterDep;
        else if (r.partType === 'fiberglass') fiberglass += valueAfterDep;
        else plastic += valueAfterDep;
        partsGSTAccumulator += rowGST;
      } else {
        labourBase += valueAfterDep;
        labourGSTAccumulator += rowGST;
      }
    }
  });

  const partsBase = metal + plastic + glass + fiberglass;
  const totalGST = partsGSTAccumulator + labourGSTAccumulator;
  const grandTotal = partsBase + partsGSTAccumulator + labourBase + labourGSTAccumulator;
  
  const totalExcess = compulsoryExcess + voluntaryExcess;
  const netAssessedLoss = Math.max(0, grandTotal - salvage - totalExcess);

  // ─── Estimated totals (from Invoice — computed locally, zero API cost) ──────
  // NOTE: estimated/assessed store BASE (taxable) amounts; GST is added here.
  let estPartsBase = 0;
  let estPartsGST = 0;
  let estLabourBase = 0;
  let estLabourGST = 0;
  rows.forEach((r) => {
    const gstRate = (r.gst || 18) / 100;
    if (r.section === 'parts') {
      estPartsBase += r.estimated;
      // Disposal parts carry no GST on the estimate either
      if (!r.isDisposal) estPartsGST += r.estimated * gstRate;
    } else {
      // labour + paint
      estLabourBase += r.estimated;
      if (!r.isDisposal) estLabourGST += r.estimated * gstRate;
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

    grandTotal,
    salvage,
    compulsoryExcess,
    voluntaryExcess,
    excess: totalExcess,
    netAssessedLoss,
    netInWords: `RUPEES ${numberToWords(netAssessedLoss)} ONLY`,

    totalEstimated,
    estimatePartsBase: estPartsBase,
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
  compulsoryExcess: number = 500,
  voluntaryExcess: number = 0
): BillCheckSummary {
  let assessedBaseSum = 0;
  let billedBaseSum = 0;
  let notInBillTotal = 0;
  
  let billedGrandTotal = 0;

  rows.forEach(r => {
    if (!r.allowed) return;

    const depRate = r.depOverride !== undefined ? r.depOverride : getDepreciationRate(r.partType, ageMonths, depType);
    const amount = (r.billStatus === 'not-in-bill') ? 0 : (r.billedAmount || 0);
    const valueBilledAfterDep = amount * (1 - depRate / 100);

    assessedBaseSum += r.assessed;
    billedBaseSum += amount;

    if (r.billStatus === 'not-in-bill') {
      notInBillTotal += r.assessed;
    } else if (r.isDisposal) {
      // Disposal: no GST on billed amount; apply disposal percent
      const disposalFactor = (r.disposalPercent ?? 50) / 100;
      billedGrandTotal += valueBilledAfterDep * disposalFactor;
    } else {
      const billedGST = valueBilledAfterDep * (r.gst / 100);
      billedGrandTotal += valueBilledAfterDep + billedGST;
    }
  });

  const totalExcess = compulsoryExcess + voluntaryExcess;
  const netLiability = Math.max(0, billedGrandTotal - salvage - totalExcess);

  return {
    grandTotalAssessed: assessedBaseSum, 
    grandTotalBilled: billedGrandTotal,
    notInBillTotal,
    variance: (assessedBaseSum - billedBaseSum),
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
    ...overrides,
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
