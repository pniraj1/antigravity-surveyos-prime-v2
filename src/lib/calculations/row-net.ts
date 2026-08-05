import type { AssessmentRow } from '@/types/assessment';

export interface RowNetResult {
  /** assessed × (1 − depRate/100) */
  afterDep: number;
  isDisposal: boolean;
  /** afterDep × disposalFactor for disposal rows; afterDep for normal rows. GST is NOT included. */
  netBeforeGst: number;
}

/**
 * Computes the per-row net amount before GST.
 * For disposal rows: net = assessed × (1 − dep%) × (disposalPercent / 100), no GST applies.
 * For normal rows: net = assessed × (1 − dep%), caller adds GST.
 */
export function computeRowNet(row: AssessmentRow, depRate: number): RowNetResult {
  const afterDep = row.assessed * (1 - depRate / 100);
  const isDisposal = !!row.isDisposal;
  const disposalFactor = (row.disposalPercent ?? 50) / 100;
  const netBeforeGst = isDisposal ? afterDep * disposalFactor : afterDep;
  return { afterDep, isDisposal, netBeforeGst };
}

export interface RowLiabilityResult {
  /** Surveyor's assessed figure after depreciation and GST. The ceiling. */
  assessedNet: number;
  /** Workshop's billed taxable figure through the same treatment. */
  billedNet: number;
  /** min(assessedNet, billedNet); 0 when the item was not billed. */
  liability: number;
}

/** Applies GST at the row's own rate. Disposal rows carry none. */
function withGst(netBeforeGst: number, isDisposal: boolean, gstPercent: number): number {
  return isDisposal ? netBeforeGst : netBeforeGst * (1 + gstPercent / 100);
}

/**
 * Per-row insurer liability for Bill Check.
 *
 * Bill Check does not assess — it verifies the Final Report sheet. So the
 * assessed side is computed exactly as the Final Report computes it, and the
 * billed side gets the identical treatment so the two are comparable.
 *
 * The billed basis is `billedTaxable` (pre-GST), never `billedAmount`, which
 * already includes GST.
 */
export function computeRowLiability(row: AssessmentRow, depRate: number): RowLiabilityResult {
  const { isDisposal, netBeforeGst } = computeRowNet(row, depRate);
  const assessedNet = withGst(netBeforeGst, isDisposal, row.gst);

  let billedNet: number;
  if (row.billedTaxable === undefined || row.billedTaxable === null) {
    // "Billed as assessed." Falling back to 0 here would drop the item from
    // the insurer's liability the moment min() saw it.
    billedNet = assessedNet;
  } else {
    const billedAfterDep = row.billedTaxable * (1 - depRate / 100);
    const disposalFactor = (row.disposalPercent ?? 50) / 100;
    const billedBeforeGst = isDisposal ? billedAfterDep * disposalFactor : billedAfterDep;
    billedNet = withGst(billedBeforeGst, isDisposal, row.gst);
  }

  const liability = row.billStatus === 'not-in-bill' ? 0 : Math.min(assessedNet, billedNet);
  return { assessedNet, billedNet, liability };
}
