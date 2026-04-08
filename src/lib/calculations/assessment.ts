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
  let labourBase = 0;
  let partsGSTAccumulator = 0;
  let labourGSTAccumulator = 0;

  // ─── Assessment Logic ──────────────────────────────
  rows.forEach((r) => {
    if (!r.allowed) return;
    const depRate = getDepreciationRate(r.partType, ageMonths, depType);
    const valueAfterDep = r.assessed * (1 - depRate / 100);
    const rowGST = valueAfterDep * (r.gst / 100);

    if (r.section === 'parts') {
      if (r.partType === 'metal') metal += valueAfterDep;
      else if (r.partType === 'glass') glass += valueAfterDep;
      else plastic += valueAfterDep;
      
      partsGSTAccumulator += rowGST;
    } else {
      labourBase += valueAfterDep;
      labourGSTAccumulator += rowGST;
    }
  });

  const partsBase = metal + plastic + glass;
  const totalGST = partsGSTAccumulator + labourGSTAccumulator;
  const grandTotal = partsBase + partsGSTAccumulator + labourBase + labourGSTAccumulator;
  
  const totalExcess = compulsoryExcess + voluntaryExcess;
  const netAssessedLoss = Math.max(0, grandTotal - salvage - totalExcess);

  // ─── Estimated total (for comparison) ──────────────
  let totalEstimated = 0;
  rows.forEach((r) => {
    totalEstimated += r.estimated * (1 + (r.gst || 18) / 100);
  });

  return {
    metalTotal: metal,
    plasticTotal: plastic,
    glassTotal: glass,
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
    
    // Row math
    const depRate = getDepreciationRate(r.partType, ageMonths, depType);
    const amount = (r.billStatus === 'not-in-bill') ? 0 : (r.billedAmount || 0);
    const valueBilledAfterDep = amount * (1 - depRate / 100);
    const billedGST = valueBilledAfterDep * (r.gst / 100);

    assessedBaseSum += r.assessed;
    billedBaseSum += amount;

    if (r.billStatus === 'not-in-bill') {
      notInBillTotal += r.assessed;
    } else {
      billedGrandTotal += (valueBilledAfterDep + billedGST);
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
    ...overrides,
  };
}


