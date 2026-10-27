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
