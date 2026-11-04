import type { SurveyorProfile } from '@/types/vehicle';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore, type AppTab, type SetupStep } from '@/stores/ui-store';
import type { SurveyType } from '@/types/report';
import { isNavItemVisible } from '@/lib/navigation/visible-nav';
import { canShowOnboarding, markOnboarding, type ChecklistId, type ChecklistItem } from './rules';
import { isReportDetailsComplete } from './profile-gaps';

export type ChecklistAction =
  | { kind: 'setup'; step: SetupStep }
  | { kind: 'newClaim' }
  | { kind: 'openClaim' }
  | null;

/** Step 1 needs name and licence number (same rule as the welcome gate). */
export const canContinueDetails = (profile: SurveyorProfile): boolean => isReportDetailsComplete(profile);

/** Blank profile fields we can fill from what the account already knows. Never overwrites, never returns undefined. */
export function profilePrefill(
  profile: SurveyorProfile,
  displayName: string | null | undefined,
): Partial<SurveyorProfile> {
  const out: Partial<SurveyorProfile> = {};
  const reg = profile.irdaiLicence?.trim();
  if (!profile.licenceNumber?.trim() && reg) out.licenceNumber = reg;
  const name = displayName?.trim();
  if (!profile.name?.trim() && name) out.name = name;
  return out;
}

export interface ChecklistClaimRef {
  id: string;
  updatedAt: string;
  surveyType: SurveyType;
  isActive: boolean;
}

const ROW_TAB: Partial<Record<ChecklistId, AppTab>> = {
  document: 'documents',
  review: 'review',
  report: 'reports',
};

/** The claim and tab a document/review/report row opens: newest active claim whose nav shows that tab. */
export function checklistClaimTarget(
  id: ChecklistId,
  claims: ChecklistClaimRef[],
): { claimId: string; tab: AppTab } | null {
  const tab = ROW_TAB[id];
  if (!tab) return null;
  const newest = claims
    .filter((c) => c.isActive && isNavItemVisible(tab, c.surveyType))
    .reduce<ChecklistClaimRef | null>(
      (best, c) => (!best || new Date(c.updatedAt).getTime() > new Date(best.updatedAt).getTime() ? c : best),
      null,
    );
  return newest ? { claimId: newest.id, tab } : null;
}

/** Which dialog or step a checklist row opens. */
export function checklistAction(id: ChecklistId, hasClaims: boolean): ChecklistAction {
  switch (id) {
    case 'details': return { kind: 'setup', step: 1 };
    case 'marks': return { kind: 'setup', step: 2 };
    case 'aiKey': return { kind: 'setup', step: 3 };
    case 'claim': return { kind: 'newClaim' };
    case 'document':
    case 'review':
    case 'report':
      return hasClaims ? { kind: 'openClaim' } : { kind: 'newClaim' };
    default: return null;
  }
}

/** Any way of leaving the setup dialog: remember the welcome was handled and close. */
export function closeSetup(): void {
  markOnboarding({ welcomeDoneAt: new Date().toISOString() });
  useUIStore.getState().setSetupStep(null);
}

/** Empty string, not a deleted key: Firestore merge writes are deep and would bring a deleted key back. */
export function reopenSetupGuide(): void {
  const { profile, updateProfile } = useProfileStore.getState();
  updateProfile({ onboarding: { ...profile.onboarding, checklistHiddenAt: '' } });
  useUIStore.getState().setSetupStep(0);
}

export function isChecklistVisible(
  profile: SurveyorProfile,
  loginSyncDone: boolean,
  items: ChecklistItem[],
): boolean {
  return (
    canShowOnboarding(profile, loginSyncDone) &&
    !profile.onboarding?.checklistHiddenAt &&
    items.some((i) => !i.done)
  );
}
