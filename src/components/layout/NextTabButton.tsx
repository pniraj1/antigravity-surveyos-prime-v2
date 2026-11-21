'use client';

import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { getNextClaimTab, getTabLabel } from '@/lib/onboarding/tab-help';
import { shouldHideFees } from '@/components/layout/sidebar';

/** Foot-of-tab shortcut to the next visible claim tab. */
export function NextTabButton() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const surveyType = useClaimStore((s) => s.currentClaim?.surveyType);
  const isTeamMember = useAuthStore((s) => s.isTeamMember);
  const teamAffiliation = useAuthStore((s) => s.teamAffiliation);
  const profileHide = useProfileStore((s) => s.profile.hideEarningsFromTeam);

  const next = getNextClaimTab(activeTab, surveyType);
  if (!next) return null;
  const hideEarnings = teamAffiliation ? teamAffiliation.hideEarnings : profileHide;
  if (next === 'fees' && shouldHideFees(isTeamMember, hideEarnings)) return null;

  return (
    <div className="flex justify-end px-4 py-6 print:hidden">
      <button
        type="button"
        onClick={() => {
          setActiveTab(next);
          document.querySelector('main')?.scrollTo({ top: 0 });
        }}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {`Next: ${getTabLabel(next)} →`}
      </button>
    </div>
  );
}
