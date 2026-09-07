import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

export interface Imt23SectionTotal {
  /** The insured's 50% share for this section, on the pre-depreciation assessed figure. */
  amount: number;
  /** Rows actually contributing to `amount` — printed as "N items". */
  count: number;
}

/**
 * The printed "Less endorsement 23" figure, per section.
 *
 * Computed on the pre-depreciation assessed amount, which is what the market
 * format prints and what makes the subtotal block reconcile whatever mix of
 * depreciation rates the bucket holds.
 *
 * A row contributes only when it carries money: disallowed rows were never a
 * liability, and a not-in-bill row arrives here already zeroed by the bill-check
 * projection. Callers render the line only when `amount > 0`, never merely
 * because a ticked row exists — otherwise a bill check with an unbilled IMT-23
 * part prints a zero-value deduction the sample reports do not have.
 */
export function imt23Totals(
  rows: AssessmentRow[],
): Record<AssessmentSection, Imt23SectionTotal> {
  const out: Record<AssessmentSection, Imt23SectionTotal> = {
    parts:  { amount: 0, count: 0 },
    labour: { amount: 0, count: 0 },
    paint:  { amount: 0, count: 0 },
  };
  for (const r of rows) {
    if (!r.imt23 || r.allowed === false || !r.assessed) continue;
    out[r.section].amount += r.assessed / 2;
    out[r.section].count += 1;
  }
  return out;
}
