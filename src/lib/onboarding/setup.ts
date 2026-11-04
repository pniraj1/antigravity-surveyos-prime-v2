import type { SurveyorProfile } from '@/types/vehicle';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore, type SetupStep } from '@/stores/ui-store';
import { canShowOnboarding, markOnboarding, type ChecklistId, type ChecklistItem } from './rules';
import { isReportDetailsComplete } from './profile-gaps';

export type ChecklistAction =
  | { kind: 'setup'; step: SetupStep }
  | { kind: 'newClaim' }
  | { kind: 'claimsList' }
  | null;

/** Step 1 needs name and licence number (same rule as the welcome gate). */
export const canContinueDetails = (profile: SurveyorProfile): boolean => isReportDetailsComplete(profile);

/** Registration licence to copy into the report licence field, only while that field is blank. */
export function licencePrefill(profile: SurveyorProfile): string | null {
  const reg = profile.irdaiLicence?.trim();
  return !profile.licenceNumber?.trim() && reg ? reg : null;
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
      return hasClaims ? { kind: 'claimsList' } : { kind: 'newClaim' };
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
