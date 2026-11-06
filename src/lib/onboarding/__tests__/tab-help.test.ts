import { describe, it, expect, beforeEach } from 'vitest';
import {
  TAB_HELP,
  getNextClaimTab,
  getTabLabel,
  shouldShowTip,
  markTipSeen,
  CLAIM_TAB_ORDER,
} from '../tab-help';
import { useProfileStore } from '@/stores/profile-store';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions';
import type { AppTab } from '@/stores/ui-store';
import type { SurveyorProfile } from '@/types/vehicle';

const baseProfile = (): SurveyorProfile => ({
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
});

describe('tab-help metadata', () => {
  it('covers all standard tabs with descriptive title, what, and tip', () => {
    const tabs: AppTab[] = [
      'documents',
      'review',
      'details',
      'assessment',
      'bill-check',
      'reports',
      'photos',
      'fees',
      'reinspection',
      'valuation',
      'dashboard',
      'profile',
      'cloud-vault',
      'recovered-claims',
    ];
    for (const tab of tabs) {
      const info = TAB_HELP[tab];
      expect(info, `missing info for tab ${tab}`).toBeDefined();
      expect(info.title.length).toBeGreaterThan(0);
      expect(info.what.length).toBeGreaterThan(10);
      expect(info.tip.length).toBeGreaterThan(10);
    }
  });

  it('explicitly mentions digital PDFs from garage in documents and bill check', () => {
    expect(TAB_HELP.documents.tip.toLowerCase()).toContain('digital pdf');
    expect(TAB_HELP.documents.tip.toLowerCase()).toContain('garage');
    expect(TAB_HELP['bill-check'].tip.toLowerCase()).toContain('digital');
    expect(TAB_HELP['bill-check'].tip.toLowerCase()).toContain('garage');
  });

  it('returns clean label via getTabLabel', () => {
    expect(getTabLabel('documents')).toBe('Documents');
    expect(getTabLabel('review')).toBe('AI Review');
    expect(getTabLabel('reports')).toBe('Report Center');
  });
});

describe('getNextClaimTab workflow progression', () => {
  it('follows the complete Final survey flow', () => {
    expect(getNextClaimTab('documents', 'final')).toBe('review');
    expect(getNextClaimTab('review', 'final')).toBe('details');
    expect(getNextClaimTab('details', 'final')).toBe('assessment');
    expect(getNextClaimTab('assessment', 'final')).toBe('bill-check');
    expect(getNextClaimTab('bill-check', 'final')).toBe('reinspection');
    expect(getNextClaimTab('reinspection', 'final')).toBe('reports');
    expect(getNextClaimTab('reports', 'final')).toBe('photos');
    expect(getNextClaimTab('photos', 'final')).toBe('fees');
    expect(getNextClaimTab('fees', 'final')).toBeNull();
  });

  it('skips assessment, bill-check, and reinspection for Spot surveys', () => {
    expect(getNextClaimTab('documents', 'spot')).toBe('review');
    expect(getNextClaimTab('review', 'spot')).toBe('details');
    expect(getNextClaimTab('details', 'spot')).toBe('reports');
    expect(getNextClaimTab('reports', 'spot')).toBe('photos');
    expect(getNextClaimTab('photos', 'spot')).toBe('fees');
    expect(getNextClaimTab('fees', 'spot')).toBeNull();
  });

  it('starts from details and includes valuation for Valuation surveys', () => {
    expect(getNextClaimTab('details', 'valuation')).toBe('valuation');
    expect(getNextClaimTab('valuation', 'valuation')).toBe('reports');
    expect(getNextClaimTab('reports', 'valuation')).toBe('photos');
    expect(getNextClaimTab('photos', 'valuation')).toBe('fees');
    expect(getNextClaimTab('fees', 'valuation')).toBeNull();
  });

  it('returns null if no survey type or non-claim tab', () => {
    expect(getNextClaimTab('documents', undefined)).toBeNull();
    expect(getNextClaimTab('dashboard', 'final')).toBeNull();
    expect(getNextClaimTab('profile', 'spot')).toBeNull();
  });
});

describe('shouldShowTip and markTipSeen', () => {
  beforeEach(() => {
    useProfileStore.setState({ profile: baseProfile() });
  });

  it('hides tips when login sync is not complete', () => {
    const profile = baseProfile();
    expect(shouldShowTip('documents', profile, false)).toBe(false);
  });

  it('never shows tips for dashboard (which has checklist card) or admin', () => {
    const profile = baseProfile();
    expect(shouldShowTip('dashboard', profile, true)).toBe(false);
    expect(shouldShowTip('admin', profile, true)).toBe(false);
  });

  it('shows tips for fresh tabs and hides them once acknowledged', () => {
    const profile = baseProfile();
    expect(shouldShowTip('documents', profile, true)).toBe(true);

    markTipSeen('documents');
    const updated = useProfileStore.getState().profile;
    expect(updated.onboarding?.tipsSeen?.documents).toBeDefined();
    expect(shouldShowTip('documents', updated, true)).toBe(false);

    // Other tabs remain unacknowledged
    expect(shouldShowTip('review', updated, true)).toBe(true);
  });

  it('merges tips seen incrementally without erasing prior entries', () => {
    markTipSeen('documents');
    markTipSeen('assessment');
    const updated = useProfileStore.getState().profile;
    expect(updated.onboarding?.tipsSeen?.documents).toBeDefined();
    expect(updated.onboarding?.tipsSeen?.assessment).toBeDefined();
  });
});
