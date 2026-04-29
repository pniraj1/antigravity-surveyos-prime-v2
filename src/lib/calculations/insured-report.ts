// ═══════════════════════════════════════════════════════════
// INSURED CLAIM SUMMARY — FINANCIAL COMPUTATION
// Pure function: no AI, no side effects.
// Produces InsuredReportFinancialSummary from ClaimData.
// ═══════════════════════════════════════════════════════════

import type { ClaimData } from '@/types/claim';
import type { InsuredReportFinancialSummary } from '@/types/insured-report';
import { calculateAssessmentSummary } from '@/lib/calculations';

/**
 * Computes the financial breakdown for the Insured Claim Summary.
 * Pure function — no AI, no side effects.
 *
 * @param claim      The full ClaimData (must have feeBill populated)
 * @param ageMonths  Vehicle age in months at time of accident
 */
export function computeInsuredFinancialSummary(
  claim: ClaimData,
  ageMonths: number,
): InsuredReportFinancialSummary {
  const fb = claim.feeBill;
  const rows = claim.assessmentRows;

  // ─── Garage Estimate ────────────────────────────────────
  // Use actual bill total when bill-check is done; otherwise
  // fall back to sum of row estimates (base + GST).
  const hasBillCheck = claim.billCheck.billTotal > 0;
  const garageEstimate = hasBillCheck
    ? claim.billCheck.billTotal
    : rows.reduce((sum, r) => sum + r.estimated * (1 + r.gst / 100), 0);

  // ─── Negotiated Savings ─────────────────────────────────
  // Labour/paint rows where workshop billed more than surveyor assessed.
  const negotiatedSavings = rows
    .filter(
      (r) =>
        (r.section === 'labour' || r.section === 'paint') &&
        (r.billedAmount ?? 0) > r.assessed,
    )
    .reduce((sum, r) => sum + ((r.billedAmount ?? 0) - r.assessed), 0);

  // ─── Depreciation ───────────────────────────────────────
  // Parts rows that are allowed and not disallowed — gap between
  // estimated (invoice) and assessed (post-depreciation) value.
  const depreciationTotal = rows
    .filter(
      (r) => r.section === 'parts' && r.allowed && r.action !== 'disallow',
    )
    .reduce((sum, r) => sum + Math.max(0, r.estimated - r.assessed), 0);

  // ─── Not Covered ────────────────────────────────────────
  // Rows that are disallowed by the surveyor.
  const notCoveredTotal = rows
    .filter((r) => !r.allowed || r.action === 'disallow')
    .reduce((sum, r) => sum + r.estimated, 0);

  // ─── Excess ─────────────────────────────────────────────
  const excessTotal = (fb.compulsoryExcess || 0) + (fb.voluntaryExcess || 0);

  // ─── Salvage ────────────────────────────────────────────
  const salvageTotal = fb.salvageValue || 0;

  // ─── Insurer Pays ───────────────────────────────────────
  // Delegate to the authoritative assessment engine.
  // compulsoryExcess is stored as feeBill.compulsoryExcess;
  // voluntaryExcess is stored as feeBill.voluntaryExcess.
  const summary = calculateAssessmentSummary(
    rows,
    ageMonths,
    claim.depreciationType,
    fb.salvageValue || 0,
    fb.compulsoryExcess || 0,
    fb.voluntaryExcess || 0,
  );
  const insurerPays = summary.netAssessedLoss;

  // insuredPays is the gap between what the garage charges and what the
  // insurer settles — floored at zero (insurer never owes the insured more
  // than the garage bill).
  const insuredPays = Math.max(0, garageEstimate - insurerPays);

  return {
    garageEstimate,
    negotiatedSavings,
    depreciationTotal,
    excessTotal,
    consumablesTotal: 0, // refined by AI in Pass 2 — split from notCoveredTotal
    notCoveredTotal,
    salvageTotal,
    insurerPays,
    insuredPays,
  };
}
