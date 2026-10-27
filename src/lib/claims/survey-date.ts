import type { ClaimData } from '@/types';

/**
 * Survey date for a claim as YYYY-MM-DD, or '' when none is recorded.
 * Each survey type keeps it in a different field.
 */
export function claimSurveyDate(
  claim: Pick<ClaimData, 'surveyType' | 'accident' | 'spotDetails' | 'valuationDetails'>,
): string {
  switch (claim.surveyType) {
    case 'final':
      return claim.accident?.dateOfSurvey ?? '';
    case 'spot':
      return (claim.spotDetails?.surveyDatetime ?? '').slice(0, 10);
    case 'valuation':
      return claim.valuationDetails?.inspectionDate ?? '';
    default:
      return '';
  }
}

/** Survey date for the claim list. Local-midnight parse: a bare YYYY-MM-DD would read as UTC and show a day early west of UTC. */
export function surveyDateLabel(surveyDate: string | null | undefined): string {
  if (!surveyDate) return '—';
  const d = new Date(`${surveyDate}T00:00`);
  if (Number.isNaN(d.getTime())) return '—'; // not YYYY-MM-DD: never show "Invalid Date"
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
