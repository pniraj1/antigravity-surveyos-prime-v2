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
