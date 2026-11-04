import type { SurveyorProfile } from '@/types/vehicle';
import type { SurveyType } from '@/types/report';
import { needsReaccept } from '@/lib/legal/versions';
import { useProfileStore } from '@/stores/profile-store';
import { isReportDetailsComplete } from './profile-gaps';

export type ChecklistId =
  | 'drive' | 'details' | 'marks' | 'aiKey' | 'claim' | 'document' | 'review' | 'report';

export interface ChecklistItem {
  id: ChecklistId;
  label: string;
  done: boolean;
}

export type ChecklistClaim = { surveyType: SurveyType; hasDocuments: boolean };

type Onboarding = NonNullable<SurveyorProfile['onboarding']>;

/** Onboarding is for active or trial surveyors who have synced and accepted current terms. */
export function canShowOnboarding(profile: SurveyorProfile, loginSyncDone: boolean): boolean {
  if (!loginSyncDone) return false;
  if (profile.subscriptionStatus !== 'active' && profile.subscriptionStatus !== 'trial') return false;
  if (!profile.isAdmin && needsReaccept(profile.consent)) return false;
  return true;
}

export function shouldShowWelcome(profile: SurveyorProfile, loginSyncDone: boolean): boolean {
  return (
    canShowOnboarding(profile, loginSyncDone) &&
    !profile.onboarding?.welcomeDoneAt &&
    !isReportDetailsComplete(profile)
  );
}

const hasKey = (keys: string[] | undefined): boolean => !!keys?.some((k) => k?.trim());

export function getChecklist(
  profile: SurveyorProfile,
  claims: ChecklistClaim[],
  isDriveConnected: boolean,
): ChecklistItem[] {
  const valuationOnly = claims.length > 0 && claims.every((c) => c.surveyType === 'valuation');
  const items: ChecklistItem[] = [
    { id: 'drive', label: 'Connect Google Drive', done: isDriveConnected },
    { id: 'details', label: 'Add your report details', done: isReportDetailsComplete(profile) },
    {
      id: 'marks',
      label: 'Add your signature and stamp',
      done: !!profile.signatureDataUrl && !!profile.stampDataUrl,
    },
    {
      id: 'aiKey',
      label: 'Add your AI key',
      done:
        !!profile.geminiApiKey?.trim() ||
        hasKey(profile.geminiApiKeys) ||
        hasKey(profile.groqApiKeys) ||
        hasKey(profile.nvidiaApiKeys) ||
        hasKey(profile.ollamaApiKeys),
    },
    { id: 'claim', label: 'Create your first claim', done: claims.length > 0 },
    {
      id: 'document',
      label: 'Upload your first document',
      done: claims.some((c) => c.hasDocuments),
    },
    {
      id: 'review',
      label: 'Check what was read in AI Review',
      done: !!profile.onboarding?.reviewSeenAt,
    },
    {
      id: 'report',
      label: 'See your first report in Report Center',
      done: !!profile.onboarding?.reportSeenAt,
    },
  ];
  return valuationOnly ? items.filter((i) => i.id !== 'document' && i.id !== 'review') : items;
}

/** Merge into profile.onboarding; no write if every key is already set. No undefined values. */
export function markOnboarding(updates: Partial<Onboarding>): void {
  const { profile, updateProfile } = useProfileStore.getState();
  const current = profile.onboarding ?? {};
  const defined = Object.entries(updates).filter(([, v]) => v !== undefined) as [
    keyof Onboarding,
    string,
  ][];
  const fresh = defined.filter(([k]) => !current[k]);
  if (fresh.length === 0) return;
  updateProfile({ onboarding: { ...current, ...Object.fromEntries(fresh) } });
}
