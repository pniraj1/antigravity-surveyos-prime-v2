import type { AssessmentRow } from '@/types/assessment';

/** A row still waiting for a bill line. From-bill rows are self-billed, so billedTaxable says nothing there. */
export function isTallyCandidate(row: AssessmentRow, fromBill: boolean): boolean {
  return row.allowed
    && !row.refMatch
    && !row.refSrNo
    && row.billStatus !== 'not-in-bill'
    && (fromBill || row.billedTaxable === undefined);
}
