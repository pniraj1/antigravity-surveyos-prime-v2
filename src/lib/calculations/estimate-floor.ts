import type { AssessmentRow } from '@/types/assessment';

/**
 * Owner rule (2026-11-10): a row's estimate may not be lower than its assessed amount
 * (Assessment) or its allowed / billed amount (Bill Check). OIC's portal rejects such rows,
 * and a lower estimate reads as an error. Prime warns and holds printing and the OIC Excel;
 * it never changes the estimate itself.
 */
export interface EstimateShort {
  rowId: string;
  particulars: string;
  estimated: number;
  /** The amount the estimate must reach. */
  floor: number;
}

/** Amounts are rupees; a paisa of rounding is not a shortfall. */
const EPS = 0.005;

export function estimateShortRows(rows: AssessmentRow[], mode: 'assessment' | 'bill'): EstimateShort[] {
  const out: EstimateShort[] = [];
  for (const r of rows) {
    if (!r.allowed) continue;
    if (mode === 'bill' && (r.billStatus === 'not-in-bill' || r.billStatus === 'not-allowed')) continue;
    const floor = mode === 'assessment'
      ? r.assessed
      : Math.max(r.billAllowed ?? r.assessed, r.billedTaxable ?? 0);
    const estimated = r.estimated || 0;
    if (floor - estimated > EPS) out.push({ rowId: r.id, particulars: r.particulars, estimated, floor });
  }
  return out;
}
