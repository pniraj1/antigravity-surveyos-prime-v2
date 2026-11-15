import type { AssessmentRow } from '@/types/assessment';

/**
 * The Ref No. a report may print: a sure match ('clean'), the surveyor's own
 * ('manual'), or a legacy ref saved before statuses existed. A doubtful match
 * never reaches the insurer — the report shows "—" and the surveyor settles it.
 */
export function printableRef(row: Pick<AssessmentRow, 'refSrNo' | 'refStatus'>): string | number | undefined {
  return row.refStatus === 'ambiguous' ? undefined : row.refSrNo;
}
