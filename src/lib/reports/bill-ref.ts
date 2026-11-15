import type { AssessmentRow } from '@/types/assessment';
import { normPart } from './bill-match-score';

/**
 * The Ref No. a report may print: a sure match ('clean'), the surveyor's own
 * ('manual'), or a legacy ref saved before statuses existed. A doubtful match
 * never reaches the insurer — the report shows "—" and the surveyor settles it.
 */
export function printableRef(row: Pick<AssessmentRow, 'refSrNo' | 'refStatus'>): string | number | undefined {
  return row.refStatus === 'ambiguous' ? undefined : row.refSrNo;
}

/**
 * Refs saved before the reference finder: a 'clean' ref the old word matcher
 * made between two different part numbers is demoted to doubtful (it stops
 * printing and goes back to the surveyor); a ref with no status at all is the
 * surveyor's, so it is marked manual. Returns only the rows to change.
 */
export function settleLegacyRefs(rows: AssessmentRow[]): Array<{ id: string; updates: Partial<AssessmentRow> }> {
  const out: Array<{ id: string; updates: Partial<AssessmentRow> }> = [];
  for (const r of rows) {
    const mine = normPart(r.partNumber);
    const theirs = normPart(r.refMatch?.bill.partNumber);
    if (r.refStatus === 'clean' && mine && theirs && mine !== theirs) out.push({ id: r.id, updates: { refStatus: 'ambiguous' } });
    else if (r.refSrNo != null && r.refStatus === undefined) out.push({ id: r.id, updates: { refStatus: 'manual' } });
  }
  return out;
}
