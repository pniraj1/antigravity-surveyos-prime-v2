import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurveyorsTab } from '../SurveyorsTab';
import type { SurveyorAdminProfile } from '../../types';

describe('SurveyorsTab', () => {
  const mockSurveyors: SurveyorAdminProfile[] = [
    {
      id: 'usr-1',
      name: 'Trial Surveyor',
      email: 'trial@example.com',
      licenceNumber: 'SLA-101',
      subscriptionStatus: 'trial',
      subscriptionExpiry: '2026-12-01',
      surveyorId: 'SRV-01',
      onboarding: {
        welcomeDoneAt: '2026-11-01T00:00:00Z',
        tourDoneAt: '2026-11-01T00:05:00Z',
        tipsSeen: { assessment: '2026-11-01T00:10:00Z' },
      },
    },
    {
      id: 'usr-2',
      name: 'Empty Surveyor',
      email: 'empty@example.com',
      subscriptionStatus: 'trial',
      subscriptionExpiry: '2026-12-01',
      surveyorId: '',
    },
  ];

  it('renders table with Onboarding column header', () => {
    const html = renderToStaticMarkup(
      <SurveyorsTab
        surveyors={mockSurveyors}
        loading={false}
        processingId={null}
        searchQuery=""
        onUpdateStatus={vi.fn()}
        onUpdateExpiry={vi.fn()}
        onUpdateId={vi.fn()}
        onUpdateName={vi.fn()}
        onExtend={vi.fn()}
        onDeleteAccount={vi.fn()}
      />
    );

    expect(html).toContain('Onboarding');
    expect(html).toContain('Trial Surveyor');
    expect(html).toContain('Empty Surveyor');
    // Progress badges
    expect(html).toContain('3/5'); // usr-1 has details + welcome + tour = 3/5
    expect(html).toContain('1 tips seen');
    expect(html).toContain('Not Started (0/5)'); // usr-2 has 0
  });
});
