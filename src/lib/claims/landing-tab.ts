import type { AppTab } from '@/stores/ui-store';
import type { SurveyType } from '@/types/report';

/**
 * The tab a surveyor lands on when a claim is opened or created.
 *
 * Documents is the start of the workflow — it is where the RC / DL / policy get
 * uploaded and extracted, so every other tab depends on it having been visited.
 *
 * EXCEPT for valuation surveys: `documents` is in the restricted list for
 * `surveyType === 'valuation'` in sidebar.tsx, so it is not even rendered in
 * their nav. Sending a valuation claim there drops the surveyor on a tab their
 * sidebar cannot highlight or navigate back to. They start on Claim Details,
 * which is the one tab no survey type restricts.
 *
 * Keep this in step with the survey-type filter in `sidebar.tsx` — if
 * `documents` is ever unrestricted for valuation, this special case goes away.
 */
export function claimLandingTab(surveyType: SurveyType | undefined): AppTab {
  return surveyType === 'valuation' ? 'details' : 'documents';
}
