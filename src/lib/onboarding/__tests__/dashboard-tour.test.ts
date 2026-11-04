import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shouldStartDashboardTour, markTourDone } from '../dashboard-tour';
import { useProfileStore } from '@/stores/profile-store';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions';
import type { SurveyorProfile } from '@/types/vehicle';

const baseProfile = (over: Partial<SurveyorProfile> = {}): SurveyorProfile => ({
  ...useProfileStore.getState().profile,
  subscriptionStatus: 'trial',
  isAdmin: false,
  consent: {
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    attestationVersion: '1.0',
    acceptedAt: '2026-11-04T00:00:00.000Z',
  },
  onboarding: {},
  ...over,
});

describe('dashboard-tour logic', () => {
  beforeEach(() => {
    useProfileStore.setState({ profile: baseProfile() });
  });

  it('triggers on desktop dashboard when profile is eligible and tour is not done', () => {
    const profile = baseProfile();
    expect(shouldStartDashboardTour(profile, true, null, 'dashboard', () => true)).toBe(true);
  });

  it('blocks tour on ineligible viewports (e.g. mobile or reduced motion)', () => {
    const profile = baseProfile();
    expect(shouldStartDashboardTour(profile, true, null, 'dashboard', () => false)).toBe(false);
  });

  it('blocks tour when user is on another tab', () => {
    const profile = baseProfile();
    expect(shouldStartDashboardTour(profile, true, null, 'documents', () => true)).toBe(false);
    expect(shouldStartDashboardTour(profile, true, null, 'reports', () => true)).toBe(false);
  });

  it('blocks tour while setup dialog is open (setupStep !== null)', () => {
    const profile = baseProfile();
    expect(shouldStartDashboardTour(profile, true, 0, 'dashboard', () => true)).toBe(false);
    expect(shouldStartDashboardTour(profile, true, 1, 'dashboard', () => true)).toBe(false);
  });

  it('blocks tour once tourDoneAt is set', () => {
    const profile = baseProfile({
      onboarding: { tourDoneAt: '2026-11-04T12:00:00.000Z' },
    });
    expect(shouldStartDashboardTour(profile, true, null, 'dashboard', () => true)).toBe(false);
  });

  it('markTourDone records ISO timestamp without clearing existing onboarding fields', () => {
    useProfileStore.setState({
      profile: baseProfile({
        onboarding: { welcomeDoneAt: '2026-11-04T10:00:00.000Z' },
      }),
    });

    markTourDone();

    const updated = useProfileStore.getState().profile;
    expect(updated.onboarding?.tourDoneAt).toBeDefined();
    expect(updated.onboarding?.welcomeDoneAt).toBe('2026-11-04T10:00:00.000Z');
  });
});
