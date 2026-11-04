import type { SurveyorAdminProfile } from '@/components/admin/types';

export interface OnboardingMilestone {
  key: string;
  label: string;
  done: boolean;
  timestamp?: string | null;
}

export interface SurveyorOnboardingSummary {
  completedCount: number;
  totalCount: number;
  percentage: number;
  badgeStatus: 'completed' | 'in_progress' | 'not_started';
  badgeText: string;
  milestones: OnboardingMilestone[];
  tipsSeenCount: number;
}

export function getSurveyorOnboardingProgress(
  surveyor: SurveyorAdminProfile
): SurveyorOnboardingSummary {
  const onboarding = surveyor.onboarding;

  const hasName = Boolean(surveyor.name?.trim() && surveyor.name !== 'Unknown');
  const hasLicence = Boolean(
    (surveyor.licenceNumber?.trim() && surveyor.licenceNumber !== 'N/A') ||
    (surveyor.irdaiLicence?.trim() && surveyor.irdaiLicence !== 'N/A')
  );
  const detailsDone = hasName && hasLicence;

  const welcomeDone = Boolean(onboarding?.welcomeDoneAt);
  const tourDone = Boolean(onboarding?.tourDoneAt);
  const syncDone = Boolean(surveyor.syncConnectedAt);
  const reportExplored = Boolean(onboarding?.reportSeenAt || onboarding?.reviewSeenAt);

  const tipsSeenCount = onboarding?.tipsSeen
    ? Object.keys(onboarding.tipsSeen).length
    : 0;

  const milestones: OnboardingMilestone[] = [
    {
      key: 'details',
      label: 'Surveyor Details',
      done: detailsDone,
    },
    {
      key: 'welcome',
      label: 'Welcome Wizard',
      done: welcomeDone,
      timestamp: onboarding?.welcomeDoneAt,
    },
    {
      key: 'tour',
      label: 'Dashboard Tour',
      done: tourDone,
      timestamp: onboarding?.tourDoneAt,
    },
    {
      key: 'sync',
      label: 'Drive Cloud Sync',
      done: syncDone,
      timestamp: surveyor.syncConnectedAt,
    },
    {
      key: 'report',
      label: 'Report Center Explored',
      done: reportExplored,
      timestamp: onboarding?.reportSeenAt || onboarding?.reviewSeenAt,
    },
  ];

  const completedCount = milestones.filter((m) => m.done).length;
  const totalCount = milestones.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  let badgeStatus: SurveyorOnboardingSummary['badgeStatus'] = 'not_started';
  let badgeText = '0/5';

  if (completedCount === totalCount) {
    badgeStatus = 'completed';
    badgeText = 'Ready (5/5)';
  } else if (completedCount > 0) {
    badgeStatus = 'in_progress';
    badgeText = `${completedCount}/${totalCount}`;
  } else {
    badgeStatus = 'not_started';
    badgeText = 'Not Started (0/5)';
  }

  return {
    completedCount,
    totalCount,
    percentage,
    badgeStatus,
    badgeText,
    milestones,
    tipsSeenCount,
  };
}
