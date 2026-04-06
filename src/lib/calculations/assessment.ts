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
  excess: number = 500
): AssessmentSummary {
  let metal = 0;
  let plastic = 0;
  let glass = 0;
  let labourBase = 0;

  // ─── Parts: apply depreciation and bucket ───────────
  rows
    .filter((r) => r.section === 'parts')
    .forEach((r) => {
      if (!r.allowed) return;
      const depRate = getDepreciationRate(r.partType, ageMonths, depType);
      const afterDep = r.assessed * (1 - depRate / 100);

      if (r.partType === 'metal') metal += afterDep;
      else if (r.partType === 'glass') glass += afterDep;
      else plastic += afterDep; // plastic/rubber
    });

  // ─── Labour + Paint: no depreciation ────────────────
  rows
    .filter((r) => r.section === 'labour' || r.section === 'paint')
    .forEach((r) => {
      if (r.allowed) labourBase += r.assessed;
    });

  // ─── GST calculations ──────────────────────────────
  const partsBase = metal + plastic + glass;
  const partsGST = calculatePartsGST(partsBase);
  const labourGST = calculateLabourGST(labourBase);

  // ─── Totals ────────────────────────────────────────
  const grandTotal = partsGST.totalWithGST + labourGST.totalWithGST;
  const netAssessedLoss = Math.max(0, grandTotal - salvage - excess);

  // ─── Estimated total (for comparison) ──────────────
  let totalEstimated = 0;
  rows.forEach((r) => {
    totalEstimated += r.estimated * (1 + r.gst / 100);
  });

  return {
    metalTotal: metal,
    plasticTotal: plastic,
    glassTotal: glass,
    partsBase,
    partsCGST: partsGST.cgst,
    partsSGST: partsGST.sgst,
    partsTotal: partsGST.totalWithGST,

    labourBase,
    labourGST: labourGST.totalGST,
    labourTotal: labourGST.totalWithGST,

    grandTotal,
    salvage,
    excess,
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
  excess: number = 500
): BillCheckSummary {
  let assessedTotal = 0;
  let billedTotal = 0;
  let notInBillTotal = 0;

  const allowedRows = rows.filter(r => r.allowed);
  
  allowedRows.forEach(r => {
    assessedTotal += r.assessed;
    if (r.billStatus === 'in-bill' || r.billStatus === 'partial') {
      billedTotal += (r.billedAmount || 0);
    } else if (r.billStatus === 'not-in-bill') {
      notInBillTotal += r.assessed;
    }
  });

  // Since bill-check is about final liability, we use the same summary logic 
  // but we need to compare it.
  // The grand total in Bill Check is usually the sum of Depreciated Billed amounts + Labour.
  
  let billedMetal = 0;
  let billedPlastic = 0;
  let billedGlass = 0;
  let billedLabour = 0;

  allowedRows.forEach(r => {
    const amount = (r.billStatus === 'not-in-bill') ? 0 : (r.billedAmount || 0);
    const depRate = getDepreciationRate(r.partType, ageMonths, depType);
    const afterDep = amount * (1 - depRate / 100);

    if (r.section === 'parts') {
      if (r.partType === 'metal') billedMetal += afterDep;
      else if (r.partType === 'glass') billedGlass += afterDep;
      else billedPlastic += afterDep;
    } else {
      billedLabour += amount;
    }
  });

  const billedPartsBase = billedMetal + billedPlastic + billedGlass;
  const billedPartsGST = calculatePartsGST(billedPartsBase);
  const billedLabourGST = calculateLabourGST(billedLabour);
  
  const grandTotalBilled = billedPartsGST.totalWithGST + billedLabourGST.totalWithGST;
  const netLiability = Math.max(0, grandTotalBilled - salvage - excess);

  return {
    grandTotalAssessed: assessedTotal, // note: this is raw sum, summary.grandTotal is depreciated
    grandTotalBilled,
    notInBillTotal,
    variance: (assessedTotal - billedTotal),
    salvage,
    excess,
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


