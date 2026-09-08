// ═══════════════════════════════════════════════════════════
// INSURED CLAIM SUMMARY — FINANCIAL COMPUTATION
// Pure function: no AI, no side effects.
// Produces InsuredReportFinancialSummary from ClaimData.
// ═══════════════════════════════════════════════════════════

import type { ClaimData } from '@/types/claim';
import type { InsuredReportFinancialSummary } from '@/types/insured-report';
import { calculateAssessmentSummary, computeRowNet } from '@/lib/calculations';
import { effectiveAssessed } from '@/lib/calculations/row-net';
import { rowDepRate } from '@/lib/calculations/row-dep-rate';
import { imt23Totals } from '@/lib/calculations/imt23-totals';

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
    // Sum of row taxable amounts + GST when no bill check done
    : rows.reduce((sum, r) => sum + r.estimated * (1 + r.gst / 100), 0);

  // Use billedTaxable (pre-GST) — billedAmount includes GST and would always
  // appear higher than assessed (pre-GST), distorting the negotiated savings.
  // Raw r.assessed, never effectiveAssessed. These compare the garage's figure
  // against the surveyor's; halving the surveyor's side would invent negotiated
  // savings equal to half the part's value and report them to the insured.
  const negotiatedSavings = rows
    .filter(
      (r) =>
        (r.section === 'labour' || r.section === 'paint') &&
        (r.billedTaxable ?? r.estimated) > r.assessed,
    )
    .reduce((sum, r) => sum + ((r.billedTaxable ?? r.estimated) - r.assessed), 0);

  // ─── Depreciation ───────────────────────────────────────
  // Depreciation is `assessed − afterDep`, exactly as the Final Report's
  // Depreciation Amount column computes it. It is NOT `estimated − assessed`:
  // that gap is the surveyor's assessment reduction — negotiation, overpricing,
  // partial repair — which this same function already reports separately as
  // negotiatedTotal / overpricingTotal / partialRepairTotal. Printing it under
  // "Depreciation on Parts" told the insured the policy had deducted rupees the
  // policy never touched, and counted those rupees twice on one page.
  const depRateFor = (r: (typeof rows)[number]) => rowDepRate(r, ageMonths, claim);

  const depreciationBreakdown = rows
    .filter((r) => r.section === 'parts' && r.allowed && r.action !== 'disallow')
    .map((r) => {
      const depRate = depRateFor(r);
      const { afterDep } = computeRowNet(r, depRate);
      return {
        particulars: r.particulars,
        billed: r.billedTaxable ?? r.estimated,
        // The insured sees the part at its true assessed value. The IMT-23 share is a
        // separate named line, not a silently halved figure that reads as
        // undervaluing their part.
        assessed: r.assessed,
        depRate,
        // afterDep is computed on effectiveAssessed (halved for IMT-23), so the
        // deduction must subtract from the same basis — otherwise the endorsement
        // share is billed to the insured as "depreciation" and described again as
        // a prose clause. The share is its own named line (imt23Total).
        deductionAmount: Math.max(0, effectiveAssessed(r) - afterDep),
      };
    })
    .filter((r) => r.deductionAmount > 0);

  const depreciationTotal = depreciationBreakdown.reduce(
    (sum, r) => sum + r.deductionAmount,
    0,
  );

  // ─── IMT-23 endorsement share ───────────────────────────
  // Endorsement 23 RESTORED cover the commercial-vehicle policy would otherwise
  // exclude entirely; the insured bears half the assessed loss. Its own named
  // money line, on the pre-depreciation assessed figure, reusing the same
  // reducer the reports print from.
  const it = imt23Totals(rows);
  const imt23Total = it.parts.amount + it.labour.amount + it.paint.amount;

  // ─── Not Covered ────────────────────────────────────────
  // Rows that are disallowed by the surveyor.
  const notCoveredTotal = rows
    .filter((r) => !r.allowed || r.action === 'disallow')
    .reduce((sum, r) => sum + r.estimated, 0);

  // ─── Per-Category Totals (from SmartRemarksCell tags) ───
  const negotiatedTotal = rows
    .filter((r) => r.allowed && r.deductionCategory === 'negotiated')
    .reduce((sum, r) => sum + Math.max(0, r.estimated - r.assessed), 0);

  // Raw r.assessed, never effectiveAssessed. These compare the garage's figure
  // against the surveyor's; halving the surveyor's side would invent negotiated
  // savings equal to half the part's value and report them to the insured.
  const overpricingTotal = rows
    .filter((r) => r.allowed && r.deductionCategory === 'overpricing')
    .reduce((sum, r) => sum + Math.max(0, r.estimated - r.assessed), 0);

  // Raw r.assessed, never effectiveAssessed. These compare the garage's figure
  // against the surveyor's; halving the surveyor's side would invent negotiated
  // savings equal to half the part's value and report them to the insured.
  const partialRepairTotal = rows
    .filter((r) => r.allowed && r.deductionCategory === 'partial-repair')
    .reduce((sum, r) => sum + Math.max(0, r.estimated - r.assessed), 0);

  const wearAndTearTotal = rows
    .filter((r) => r.deductionCategory === 'wear-and-tear')
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
    claim,
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
    depreciationBreakdown,
    imt23Total,
    excessTotal,
    consumablesTotal: 0, // refined by AI in Pass 2 — split from notCoveredTotal
    notCoveredTotal,
    salvageTotal,
    negotiatedTotal,
    overpricingTotal,
    partialRepairTotal,
    wearAndTearTotal,
    insurerPays,
    insuredPays,
  };
}
