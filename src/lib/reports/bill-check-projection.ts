import type { AssessmentRow, FeeBill } from '@/types/assessment';
import { salvageBasis } from '@/lib/calculations/salvage';

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
/**
 * The assessed figure this document works from.
 *
 * What is billed is the cap per item: the insurer pays no more than the
 * workshop charged. A bill above the assessment does not raise it — the
 * assessment is already the lower figure and the cap does not bite.
 *
 * `billAllowed` overrides the cap in either direction; it is the surveyor
 * deliberately allowing something other than min(assessed, billed), and the
 * flag that offers it demands a remark.
 *
 * One definition, three callers: the report's projection, the grid's derived
 * cells, and the missing-remark check.
 */
export function billCheckAssessed(r: AssessmentRow): number {
  if (r.billStatus === 'not-in-bill') return 0;
  if (r.billAllowed !== undefined) return r.billAllowed;
  if (r.billedTaxable === undefined) return r.assessed;
  return Math.min(r.assessed, r.billedTaxable);
}

export function projectForBillCheck(rows: AssessmentRow[]): AssessmentRow[] {
  return rows.map(r =>
    r.billStatus === 'not-in-bill'
      ? { ...r, estimated: 0, assessed: 0 }
      : { ...r, estimated: r.billedTaxable ?? 0, assessed: billCheckAssessed(r) },
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
      const allowed = billCheckAssessed(r);
      return r.billedTaxable !== allowed;
    }
    return false;
  });
}

/**
 * The salvage figure the Bill Check reports and screen use.
 *
 * A figure typed on the Bill Check tab wins and is used exactly as typed —
 * salvage is the surveyor's decision, and nothing here second-guesses it.
 * Otherwise the final report's salvage is rescaled by how far the metal basis
 * has moved: the same percentage of a smaller, or larger, pile of allowed
 * metal. A part that was never billed was never replaced, so no old part came
 * off it and it stops earning salvage.
 *
 * Both directions, with no special case for a rising basis.
 *
 * Bill-check only. `feeBill.salvageValue` is never written here; the Final
 * Survey Report keeps the figure it was filed with.
 */
export function resolveBillSalvage(fb: FeeBill | undefined, rows: AssessmentRow[]): number {
  if (fb?.billSalvage !== undefined) return fb.billSalvage;
  const final = salvageBasis(rows);
  if (!final) return fb?.salvageValue ?? 0;
  return Math.round((fb?.salvageValue ?? 0) * salvageBasis(rows, billCheckAssessed) / final);
}
