import { describe, it, expect } from 'vitest';
import { getSurveyorOnboardingProgress } from '../admin-progress';
import type { SurveyorAdminProfile } from '@/components/admin/types';

describe('getSurveyorOnboardingProgress', () => {
  const baseProfile: SurveyorAdminProfile = {
    id: 'user-1',
    name: 'Unknown',
    subscriptionStatus: 'trial',
    subscriptionExpiry: '2026-12-31',
    surveyorId: 'SURV-01',
  };

  it('reports not_started for a brand new empty user profile', () => {
    const progress = getSurveyorOnboardingProgress(baseProfile);
    expect(progress.badgeStatus).toBe('not_started');
    expect(progress.completedCount).toBe(0);
    expect(progress.percentage).toBe(0);
    expect(progress.badgeText).toContain('0/5');
  });

  it('marks details as done when name and licence number are present', () => {
    const profile: SurveyorAdminProfile = {
      ...baseProfile,
      name: 'Niraj Surveyor',
      licenceNumber: 'SLA-12345',
    };
    const progress = getSurveyorOnboardingProgress(profile);
    expect(progress.badgeStatus).toBe('in_progress');
    expect(progress.completedCount).toBe(1);
    expect(progress.milestones.find((m) => m.key === 'details')?.done).toBe(true);
  });

  it('marks all milestones as done when full onboarding data is recorded', () => {
    const profile: SurveyorAdminProfile = {
      ...baseProfile,
      name: 'Niraj Surveyor',
      licenceNumber: 'SLA-12345',
      syncConnectedAt: '2026-11-01T10:00:00Z',
      onboarding: {
        welcomeDoneAt: '2026-11-01T10:05:00Z',
        tourDoneAt: '2026-11-01T10:10:00Z',
        reportSeenAt: '2026-11-01T10:15:00Z',
        tipsSeen: { assessment: '2026-11-01T10:20:00Z', reports: '2026-11-01T10:22:00Z' },
      },
    };
    const progress = getSurveyorOnboardingProgress(profile);
    expect(progress.badgeStatus).toBe('completed');
    expect(progress.completedCount).toBe(5);
    expect(progress.percentage).toBe(100);
    expect(progress.badgeText).toBe('Ready (5/5)');
    expect(progress.tipsSeenCount).toBe(2);
  });
});
