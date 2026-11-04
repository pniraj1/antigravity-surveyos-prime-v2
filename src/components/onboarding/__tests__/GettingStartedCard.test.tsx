import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ChecklistView } from '../GettingStartedCard';
import { checklistAction, checklistClaimTarget, isChecklistVisible, reopenSetupGuide } from '@/lib/onboarding/setup';
import { getChecklist, markOnboarding, type ChecklistItem } from '@/lib/onboarding/rules';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions';
import type { SurveyorProfile } from '@/types/vehicle';

const consent = {
  attestationVersion: '1.0',
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_VERSION,
  acceptedAt: '2026-11-04T00:00:00.000Z',
};
const prof = (over: Partial<SurveyorProfile> = {}): SurveyorProfile => ({
  ...useProfileStore.getState().profile,
  subscriptionStatus: 'active',
  isAdmin: false,
  consent,
  onboarding: undefined,
  ...over,
});
const items = (done: boolean[]): ChecklistItem[] =>
  done.map((d, i) => ({ id: (['drive', 'details', 'marks', 'aiKey'] as const)[i], label: `Item ${i}`, done: d }));

describe('isChecklistVisible', () => {
  it('shows for an active, synced profile with open items', () => {
    expect(isChecklistVisible(prof(), true, items([true, false]))).toBe(true);
  });
  it('hidden when onboarding cannot show', () => {
    expect(isChecklistVisible(prof(), false, items([false]))).toBe(false);
  });
  it('hidden when checklistHiddenAt is set, visible when it is the empty string', () => {
    expect(isChecklistVisible(prof({ onboarding: { checklistHiddenAt: '2026-11-04' } }), true, items([false]))).toBe(false);
    expect(isChecklistVisible(prof({ onboarding: { checklistHiddenAt: '' } }), true, items([false]))).toBe(true);
  });
  it('hidden when all done', () => {
    expect(isChecklistVisible(prof(), true, items([true, true]))).toBe(false);
  });
});

describe('ChecklistView', () => {
  it('shows the count, title, Hide and a text label for each row', () => {
    const html = renderToStaticMarkup(
      <ChecklistView items={items([true, false, false])} onHide={() => {}} onOpen={() => {}} hasClaims={false} />,
    );
    expect(html).toContain('Getting started');
    expect(html).toContain('1 of 3 done');
    expect(html).toContain('Hide');
    expect(html).toContain('Item 0');
    expect(html).toContain('Item 1');
    expect(html).toContain('min-h-11');
  });
});

describe('ChecklistView rows without an action', () => {
  it('Drive row is not a button, an actionable row is', () => {
    const html = renderToStaticMarkup(
      <ChecklistView
        items={[
          { id: 'drive', label: 'Connect Google Drive', done: false },
          { id: 'aiKey', label: 'Add your AI key', done: false },
        ]}
        onHide={() => {}}
        onOpen={() => {}}
        hasClaims={false}
      />,
    );
    const buttons = html.match(/<button[\s\S]*?<\/button>/g) ?? [];
    expect(buttons.some((b) => b.includes('Connect Google Drive'))).toBe(false);
    expect(buttons.some((b) => b.includes('Add your AI key'))).toBe(true);
    expect(html).toContain('Connect Google Drive');
  });
});

describe('checklistAction', () => {
  it('maps setup rows to steps', () => {
    expect(checklistAction('aiKey', false)).toEqual({ kind: 'setup', step: 3 });
    expect(checklistAction('details', false)).toEqual({ kind: 'setup', step: 1 });
    expect(checklistAction('marks', true)).toEqual({ kind: 'setup', step: 2 });
  });
  it('claim rows depend on whether claims exist', () => {
    expect(checklistAction('claim', true)).toEqual({ kind: 'newClaim' });
    for (const id of ['document', 'review', 'report'] as const) {
      expect(checklistAction(id, true)).toEqual({ kind: 'openClaim' });
      expect(checklistAction(id, false)).toEqual({ kind: 'newClaim' });
    }
    expect(checklistAction('drive', true)).toBeNull();
  });
  it('rows from getChecklist map to the expected steps', () => {
    const list = getChecklist(prof(), [], false);
    const find = (label: string) => list.find((i) => i.label === label)!.id;
    expect(checklistAction(find('Add your AI key'), false)).toEqual({ kind: 'setup', step: 3 });
    expect(checklistAction(find('Add your report details'), false)).toEqual({ kind: 'setup', step: 1 });
    expect(checklistAction(find('Add your signature and stamp'), false)).toEqual({ kind: 'setup', step: 2 });
  });
});

describe('checklistClaimTarget', () => {
  const c = (id: string, updatedAt: string, surveyType: 'final' | 'spot' | 'valuation' = 'final', isActive = true) =>
    ({ id, updatedAt, surveyType, isActive });
  it('picks the newest active claim and maps rows to tabs', () => {
    const claims = [c('a', '2026-11-01'), c('b', '2026-11-03'), c('c', '2026-11-02')];
    expect(checklistClaimTarget('document', claims)).toEqual({ claimId: 'b', tab: 'documents' });
    expect(checklistClaimTarget('review', claims)).toEqual({ claimId: 'b', tab: 'review' });
    expect(checklistClaimTarget('report', claims)).toEqual({ claimId: 'b', tab: 'reports' });
  });
  it('skips inactive claims', () => {
    const claims = [c('a', '2026-11-01'), c('b', '2026-11-03', 'final', false)];
    expect(checklistClaimTarget('report', claims)?.claimId).toBe('a');
  });
  it('skips valuation for document and review, not for report', () => {
    const claims = [c('v', '2026-11-05', 'valuation'), c('f', '2026-11-01')];
    expect(checklistClaimTarget('document', claims)?.claimId).toBe('f');
    expect(checklistClaimTarget('review', claims)?.claimId).toBe('f');
    expect(checklistClaimTarget('report', claims)?.claimId).toBe('v');
  });
  it('is null when nothing qualifies or the row is not a claim row', () => {
    expect(checklistClaimTarget('document', [])).toBeNull();
    expect(checklistClaimTarget('document', [c('v', '2026-11-05', 'valuation')])).toBeNull();
    expect(checklistClaimTarget('report', [c('a', '2026-11-01', 'final', false)])).toBeNull();
    expect(checklistClaimTarget('aiKey', [c('a', '2026-11-01')])).toBeNull();
  });
});

describe('Hide and Show setup guide', () => {
  beforeEach(() => {
    useProfileStore.getState().updateProfile({ onboarding: {} });
  });
  it('Hide (markOnboarding) sets checklistHiddenAt', () => {
    markOnboarding({ checklistHiddenAt: '2026-11-04T00:00:00.000Z' });
    expect(useProfileStore.getState().profile.onboarding?.checklistHiddenAt).toBeTruthy();
  });
  it('Show setup guide keeps other keys, blanks the hidden flag and opens step 0', () => {
    useProfileStore.getState().updateProfile({
      onboarding: { checklistHiddenAt: 'x', welcomeDoneAt: 'w' },
    });
    reopenSetupGuide();
    const o = useProfileStore.getState().profile.onboarding!;
    expect(o).toEqual({ checklistHiddenAt: '', welcomeDoneAt: 'w' });
    expect('checklistHiddenAt' in o).toBe(true);
    expect(useUIStore.getState().setupStep).toBe(0);
    markOnboarding({ checklistHiddenAt: 'again' });
    expect(useProfileStore.getState().profile.onboarding?.checklistHiddenAt).toBe('again');
  });
});
