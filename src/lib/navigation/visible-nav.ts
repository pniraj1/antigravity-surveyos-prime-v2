import type { AppTab } from '@/stores/ui-store';
import type { SurveyType } from '@/types/report';

/**
 * Tabs each survey type never shows. The ONE place this rule lives — the
 * sidebar and the phone bottom bar both read it, so they cannot drift apart.
 * landing-tab.ts depends on 'documents' being hidden for valuation.
 */
const HIDDEN_BY_SURVEY: Record<SurveyType, readonly AppTab[]> = {
  spot: ['assessment', 'bill-check', 'reinspection', 'valuation'],
  final: ['valuation'],
  valuation: ['assessment', 'bill-check', 'reinspection', 'review', 'documents'],
};

/** `surveyType` undefined = no claim open. */
export function isNavItemVisible(id: AppTab, surveyType: SurveyType | undefined): boolean {
  if (!surveyType) return id !== 'valuation';
  return !HIDDEN_BY_SURVEY[surveyType].includes(id);
}
