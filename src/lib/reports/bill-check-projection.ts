import type { AssessmentRow } from '@/types/assessment';

/**
 * Projects assessment rows into the shape the Bill Check report renders.
 *
 * ponytail: bill check IS the final report over projected rows. The estimate
 * slot carries the bill figure, billAllowed overrides the assessed figure for
 * this document only, and a part that was never replaced carries no money.
 * Every existing calculation then works untouched — no new arithmetic anywhere.
 *
 * Reads billedTaxable, never billedAmount: billedAmount already includes GST,
 * and the builder taxes this column again.
 */
export function projectForBillCheck(rows: AssessmentRow[]): AssessmentRow[] {
  return rows.map(r =>
    r.billStatus === 'not-in-bill'
      ? { ...r, estimated: 0, assessed: 0 }
      : { ...r, estimated: r.billedTaxable ?? 0, assessed: r.billAllowed ?? r.assessed },
  );
}
