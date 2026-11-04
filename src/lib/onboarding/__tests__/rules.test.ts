import { describe, it, expect, beforeEach } from 'vitest';
import {
  canShowOnboarding,
  shouldShowWelcome,
  getChecklist,
  markOnboarding,
  type ChecklistClaim,
} from '../rules';
import { useProfileStore } from '@/stores/profile-store';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions';
import type { SurveyorProfile } from '@/types/vehicle';

const consent = {
  attestationVersion: '1.0',
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_VERSION,
  acceptedAt: '2026-11-04T00:00:00.000Z',
};

function profile(over: Partial<SurveyorProfile> = {}): SurveyorProfile {
  return {
    ...useProfileStore.getState().profile,
    name: '',
    licenceNumber: '',
    signatureDataUrl: null,
    stampDataUrl: null,
    geminiApiKeys: [],
    groqApiKeys: [],
    nvidiaApiKeys: [],
    ollamaApiKeys: [],
    geminiApiKey: '',
    groqApiKey: '',
    subscriptionStatus: 'active',
    isAdmin: false,
    consent,
    onboarding: undefined,
    ...over,
  };
}

const full = (over: Partial<SurveyorProfile> = {}) =>
  profile({
    name: 'A',
    licenceNumber: 'L1',
    signatureDataUrl: 'data:x',
    stampDataUrl: 'data:y',
    geminiApiKeys: ['k'],
    onboarding: { reviewSeenAt: 't', reportSeenAt: 't' },
    ...over,
  });

describe('canShowOnboarding', () => {
  it('true for active and trial after sync', () => {
    expect(canShowOnboarding(profile({ subscriptionStatus: 'active' }), true)).toBe(true);
    expect(canShowOnboarding(profile({ subscriptionStatus: 'trial' }), true)).toBe(true);
  });
  it('false for other statuses', () => {
    for (const s of ['pending', 'readonly', 'expired', 'suspended'] as const) {
      expect(canShowOnboarding(profile({ subscriptionStatus: s }), true)).toBe(false);
    }
  });
  it('false before sync', () => {
    expect(canShowOnboarding(profile(), false)).toBe(false);
  });
  it('stale consent blocks non-admin, not admin', () => {
    const stale = { ...consent, termsVersion: 'old' };
    expect(canShowOnboarding(profile({ consent: stale }), true)).toBe(false);
    expect(canShowOnboarding(profile({ consent: stale, isAdmin: true }), true)).toBe(true);
  });
});

describe('shouldShowWelcome', () => {
  it('true with incomplete details and no welcomeDoneAt', () => {
    expect(shouldShowWelcome(profile(), true)).toBe(true);
  });
  it('false once welcomeDoneAt is set', () => {
    expect(shouldShowWelcome(profile({ onboarding: { welcomeDoneAt: 't' } }), true)).toBe(false);
  });
  it('false when details complete', () => {
    expect(shouldShowWelcome(profile({ name: 'A', licenceNumber: 'L1' }), true)).toBe(false);
  });
  it('false before sync', () => {
    expect(shouldShowWelcome(profile(), false)).toBe(false);
  });
});

describe('getChecklist', () => {
  const claims: ChecklistClaim[] = [{ surveyType: 'final', hasDocuments: false }];

  it('labels in order', () => {
    expect(getChecklist(profile(), claims, false).map((i) => i.label)).toEqual([
      'Connect Google Drive',
      'Add your report details',
      'Add your signature and stamp',
      'Add your AI key',
      'Create your first claim',
      'Upload your first document',
      'Check what was read in AI Review',
      'See your first report in Report Center',
    ]);
  });

  const done = (p: SurveyorProfile, c = claims, d = false) =>
    Object.fromEntries(getChecklist(p, c, d).map((i) => [i.id, i.done]));

  it('marks needs both images', () => {
    expect(done(profile({ signatureDataUrl: 'a' })).marks).toBe(false);
    expect(done(profile({ stampDataUrl: 'a' })).marks).toBe(false);
    expect(done(profile({ signatureDataUrl: 'a', stampDataUrl: 'b' })).marks).toBe(true);
  });

  it('aiKey ignores blanks, accepts any provider', () => {
    expect(done(profile({ geminiApiKeys: [''] })).aiKey).toBe(false);
    expect(done(profile({ geminiApiKeys: ['  '] })).aiKey).toBe(false);
    expect(done(profile({ geminiApiKey: 'x' })).aiKey).toBe(true);
    expect(done(profile({ groqApiKeys: ['', 'g'] })).aiKey).toBe(true);
    expect(done(profile({ nvidiaApiKeys: ['n'] })).aiKey).toBe(true);
    expect(done(profile({ ollamaApiKeys: ['o'] })).aiKey).toBe(true);
  });

  it('document, review, report, drive, claim, details', () => {
    expect(done(profile()).document).toBe(false);
    expect(done(profile(), [{ surveyType: 'final', hasDocuments: true }]).document).toBe(true);
    expect(done(profile({ onboarding: { reviewSeenAt: 't' } })).review).toBe(true);
    expect(done(profile({ onboarding: { reportSeenAt: 't' } })).report).toBe(true);
    expect(done(profile(), claims, true).drive).toBe(true);
    expect(done(profile()).claim).toBe(true);
    expect(done(profile(), []).claim).toBe(false);
    expect(done(profile({ name: 'A', licenceNumber: 'L' })).details).toBe(true);
  });

  it('valuation-only claims drop document and review', () => {
    const val: ChecklistClaim[] = [{ surveyType: 'valuation', hasDocuments: false }];
    const items = getChecklist(full(), val, true);
    expect(items.map((i) => i.id)).not.toContain('document');
    expect(items.map((i) => i.id)).not.toContain('review');
    expect(items.every((i) => i.done)).toBe(true);
  });

  it('no claims keeps document and review', () => {
    const ids = getChecklist(profile(), [], false).map((i) => i.id);
    expect(ids).toContain('document');
    expect(ids).toContain('review');
  });
});

describe('markOnboarding', () => {
  beforeEach(() => {
    useProfileStore.setState({ profile: profile() });
  });

  it('keeps existing keys when adding a new one', () => {
    markOnboarding({ welcomeDoneAt: 'a' });
    markOnboarding({ reviewSeenAt: 'b' });
    expect(useProfileStore.getState().profile.onboarding).toEqual({
      welcomeDoneAt: 'a',
      reviewSeenAt: 'b',
    });
  });

  it('writes nothing when every key is already set', () => {
    markOnboarding({ welcomeDoneAt: 'a' });
    const before = useProfileStore.getState().profile;
    markOnboarding({ welcomeDoneAt: 'z' });
    expect(useProfileStore.getState().profile).toBe(before);
  });
});
