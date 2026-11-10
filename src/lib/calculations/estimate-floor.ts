import type { AssessmentRow } from '@/types/assessment';

/**
 * Owner rules (2026-11-10):
 * - Assessment: a row's estimate may not be lower than its assessed amount.
 * - Bill Check: a row may not be allowed above what the workshop billed. A bill
 *   above the estimate is normal; the OIC Excel sends the billed amount as its
 *   estimate, so the estimate is not checked there.
 * Prime warns and holds printing and the OIC Excel; it never changes a figure itself.
 */
export interface RowIssue {
  rowId: string;
  particulars: string;
  /** e.g. "allowed ₹3,000, billed ₹2,500" */
  detail: string;
}

/** Amounts are rupees; a paisa of rounding is not a shortfall. */
const EPS = 0.005;

export const rs = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function estimateShortRows(rows: AssessmentRow[]): RowIssue[] {
  return rows
    .filter((r) => r.allowed && r.assessed - (r.estimated || 0) > EPS)
    .map((r) => ({ rowId: r.id, particulars: r.particulars, detail: `estimate ${rs(r.estimated || 0)}, assessed ${rs(r.assessed)}` }));
}

/** Rows allowed above the billed amount. Pending (no billed amount) rows are not judged here. */
export function overBilledRows(rows: AssessmentRow[]): RowIssue[] {
  const out: RowIssue[] = [];
  for (const r of rows) {
    if (!r.allowed || r.billStatus === 'not-in-bill' || r.billStatus === 'not-allowed') continue;
    if (r.billedTaxable === undefined || r.billedTaxable === null) continue;
    const allowed = r.billAllowed ?? r.assessed;
    if (allowed - r.billedTaxable > EPS) {
      out.push({ rowId: r.id, particulars: r.particulars, detail: `allowed ${rs(allowed)}, billed ${rs(r.billedTaxable)}` });
    }
  }
  return out;
}
