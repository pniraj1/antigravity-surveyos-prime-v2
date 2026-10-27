import type { AppTab } from '@/stores/ui-store';

/**
 * Tab to open from a `?tab=` URL value. The Site tab was retired 2026-10-27, so a
 * bookmarked or reloaded `?tab=site` lands on Claim Details instead of a blank pane.
 */
export function normalizeUrlTab(tab: string | null, hasClaim: boolean): AppTab {
  if (hasClaim) return !tab || tab === 'site' ? 'details' : (tab as AppTab);
  return (tab ?? 'dashboard') as AppTab;
}
