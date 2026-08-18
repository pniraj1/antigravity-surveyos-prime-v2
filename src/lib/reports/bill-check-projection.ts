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

/**
 * Rows whose bill-check outcome has no explanation on record.
 *
 * A missing remark never changes a number — the report prints correctly
 * either way — so this is a documentation gap, not something to gate
 * printing on. Two cases: a row dropped as not-in-bill, or a row whose
 * billed figure was not simply accepted (it differs from the effective
 * allowance), with nothing said about why.
 *
 * A row still `pending` is deliberately excluded: that is the print gate's
 * job (projectForBillCheck's caller), not this one's.
 */
export function rowsNeedingRemark(rows: AssessmentRow[]): AssessmentRow[] {
  return rows.filter(r => {
    if (r.billRemarks && r.billRemarks.trim()) return false;
    if (r.billStatus === 'not-in-bill') return true;
    if (r.billedTaxable !== undefined) {
      const allowed = r.billAllowed ?? r.assessed;
      return r.billedTaxable !== allowed;
    }
    return false;
  });
}
