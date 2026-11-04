import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

const fetchGeminiModelEntries = vi.fn();
vi.mock('@/lib/ai/service', () => ({
  fetchGeminiModelEntries: (k: string) => fetchGeminiModelEntries(k),
}));

import { SetupStepContent } from '../SetupDialog';
import { KeyTestMessage, testKeyResult } from '../SetupSteps';
import { canContinueDetails, profilePrefill, closeSetup } from '@/lib/onboarding/setup';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import type { SurveyorProfile } from '@/types/vehicle';

const base = (): SurveyorProfile => ({
  ...useProfileStore.getState().profile,
  name: '',
  licenceNumber: '',
  irdaiLicence: '',
});
const noop = () => {};
const handlers = { onProfile: noop, onNext: noop, onBack: noop, onSkip: noop, onFinish: noop, onLater: noop };
const render = (step: 0 | 1 | 2 | 3, profile = base()) =>
  renderToStaticMarkup(<SetupStepContent step={step} profile={profile} {...handlers} />);

describe('SetupStepContent', () => {
  it('step 0 shows welcome copy, path and both buttons', () => {
    const html = render(0);
    expect(html).toContain('Welcome to Motor SurveyOS Prime');
    expect(html).toContain('Turn your claim documents into a finished survey report, with far less paperwork.');
    for (const s of ['Documents', 'Check', 'Assess', 'Report']) expect(html).toContain(s);
    expect(html).toContain('Set up my profile (3 min)');
    expect(html).toContain('Later');
  });

  it('step 1 disables Continue with the hint while the licence is empty', () => {
    const html = render(1, { ...base(), name: 'A Surveyor' });
    expect(html).toContain('Step 1 of 3');
    expect(html).toContain('Your report details');
    expect(html).toContain('Name and licence number are needed to continue.');
    expect(html).toMatch(/<button[^>]* disabled=""[^>]*>Continue/);
    expect(html).toContain('Skip for now');
    expect(html).not.toContain('>Back<');
  });

  it('step 1 enables Continue and previews the print when complete', () => {
    const html = render(1, { ...base(), name: 'A Surveyor', licenceNumber: 'SLA-9', mobile: '99999' });
    expect(html).not.toContain('Name and licence number are needed');
    expect(html).not.toMatch(/<button[^>]* disabled=""[^>]*>Continue/);
    expect(html).toContain('How it prints');
    expect(html).toContain('Lic. No. SLA-9');
  });

  it('step 2 and 3 copy, Back shown, Finish on the last', () => {
    const two = render(2);
    expect(two).toContain('Signature and stamp');
    expect(two).toContain('Back');
    expect(two).toContain('Continue');
    const three = render(3);
    expect(three).toContain('Your AI key');
    expect(three).toContain('Get a free key');
    expect(three).toContain('Test key');
    expect(three).toContain('Finish');
    expect(three).toContain('Skip for now');
  });
});

describe('details helpers', () => {
  it('whitespace-only licence stays blocked', () => {
    expect(canContinueDetails({ ...base(), name: 'A', licenceNumber: '   ' })).toBe(false);
    expect(canContinueDetails({ ...base(), name: 'A', licenceNumber: 'L1' })).toBe(true);
  });
  it('prefills licence from irdaiLicence only when licence number is blank', () => {
    expect(profilePrefill({ ...base(), irdaiLicence: 'SLA-1', name: 'A' }, null)).toEqual({ licenceNumber: 'SLA-1' });
    expect(profilePrefill({ ...base(), irdaiLicence: 'SLA-1', licenceNumber: '  ', name: 'A' }, null)).toEqual({ licenceNumber: 'SLA-1' });
    expect(profilePrefill({ ...base(), irdaiLicence: 'SLA-1', licenceNumber: 'X', name: 'A' }, null)).toEqual({});
    expect(profilePrefill({ ...base(), name: 'A' }, null)).toEqual({});
  });
  it('prefills name from the display name only when blank, never undefined', () => {
    expect(profilePrefill({ ...base(), name: '' }, '  Asha K ')).toEqual({ name: 'Asha K' });
    expect(profilePrefill({ ...base(), name: 'Locked' }, 'Asha K')).toEqual({});
    expect(profilePrefill({ ...base(), name: '' }, '   ')).toEqual({});
    expect(profilePrefill({ ...base(), name: '' }, undefined)).toEqual({});
    expect('name' in profilePrefill({ ...base(), name: 'X' }, null)).toBe(false);
  });
  it('step 3 copy does not overstate privacy', () => {
    expect(render(3)).toContain('Prime uses this free key to read your documents, on your own account.');
  });
});

describe('key test', () => {
  beforeEach(() => { fetchGeminiModelEntries.mockReset(); });
  it('reports ok when models are returned', async () => {
    fetchGeminiModelEntries.mockResolvedValue([{ id: 'm' }]);
    expect(await testKeyResult(' k ')).toBe('ok');
    expect(fetchGeminiModelEntries).toHaveBeenCalledWith('k');
  });
  it('reports fail on null', async () => {
    fetchGeminiModelEntries.mockResolvedValue(null);
    expect(await testKeyResult('k')).toBe('fail');
    expect(await testKeyResult('  ')).toBe('fail');
  });
  it('reports fail when the call throws', async () => {
    fetchGeminiModelEntries.mockImplementation(async () => { throw new Error('net'); });
    expect(await testKeyResult('k')).toBe('fail');
  });
  it('renders each result message', () => {
    expect(renderToStaticMarkup(<KeyTestMessage state="ok" />)).toContain('This key works.');
    expect(renderToStaticMarkup(<KeyTestMessage state="fail" />)).toContain(
      'Could not confirm this key. Check it and your internet connection.',
    );
    expect(renderToStaticMarkup(<KeyTestMessage state="idle" />)).toBe('');
  });
});

describe('closeSetup', () => {
  it('sets welcomeDoneAt and clears the step', () => {
    useProfileStore.getState().updateProfile({ onboarding: {} });
    useUIStore.getState().setSetupStep(2);
    closeSetup();
    expect(useProfileStore.getState().profile.onboarding?.welcomeDoneAt).toBeTruthy();
    expect(useUIStore.getState().setupStep).toBeNull();
  });
});
