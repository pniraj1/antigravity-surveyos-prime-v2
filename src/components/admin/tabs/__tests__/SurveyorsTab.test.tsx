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
    {
      id: 'usr-3',
      name: 'Active Surveyor',
      email: 'active@example.com',
      subscriptionStatus: 'active',
      subscriptionExpiry: '2026-12-01',
      surveyorId: 'SRV-03',
    },
  ];

  const defaultProps = {
    surveyors: mockSurveyors,
    loading: false,
    processingId: null,
    searchQuery: '',
    onUpdateStatus: vi.fn(),
    onUpdateExpiry: vi.fn(),
    onUpdateId: vi.fn(),
    onUpdateName: vi.fn(),
    onExtend: vi.fn(),
    onDeleteAccount: vi.fn(),
  };

  it('renders table with Onboarding column header', () => {
    const html = renderToStaticMarkup(<SurveyorsTab {...defaultProps} />);

    expect(html).toContain('Onboarding');
    expect(html).toContain('Trial Surveyor');
    expect(html).toContain('Empty Surveyor');
    // Progress badges
    expect(html).toContain('3/5'); // usr-1 has details + welcome + tour = 3/5
    expect(html).toContain('1 tips seen');
    expect(html).toContain('Not Started (0/5)'); // usr-2 has 0
  });

  it('renders loading skeleton when claimsCount is loading', () => {
    const html = renderToStaticMarkup(
      <SurveyorsTab
        {...defaultProps}
        initialExpandedId="usr-1"
        initialClaimsCountMap={{ 'usr-1': 'loading' }}
      />
    );

    expect(html).toContain('Claims Created');
    expect(html).toContain('animate-pulse');
  });

  it('renders "0 (Untested)" in amber for trial surveyor with 0 claims', () => {
    const html = renderToStaticMarkup(
      <SurveyorsTab
        {...defaultProps}
        initialExpandedId="usr-1"
        initialClaimsCountMap={{ 'usr-1': 0 }}
      />
    );

    expect(html).toContain('Claims Created');
    expect(html).toContain('0 (Untested)');
    expect(html).toContain('text-amber-600');
  });

  it('renders "0 claims" for active surveyor with 0 claims', () => {
    const html = renderToStaticMarkup(
      <SurveyorsTab
        {...defaultProps}
        initialExpandedId="usr-3"
        initialClaimsCountMap={{ 'usr-3': 0 }}
      />
    );

    expect(html).toContain('Claims Created');
    expect(html).toContain('0 claims');
    expect(html).not.toContain('Untested');
  });

  it('renders active claim count e.g. "4 claims" in emerald for surveyor who created claims', () => {
    const html = renderToStaticMarkup(
      <SurveyorsTab
        {...defaultProps}
        initialExpandedId="usr-1"
        initialClaimsCountMap={{ 'usr-1': 4 }}
      />
    );

    expect(html).toContain('Claims Created');
    expect(html).toContain('4 claims');
    expect(html).toContain('text-emerald-600');
  });

  it('handles singular "1 claim" properly', () => {
    const html = renderToStaticMarkup(
      <SurveyorsTab
        {...defaultProps}
        initialExpandedId="usr-1"
        initialClaimsCountMap={{ 'usr-1': 1 }}
      />
    );

    expect(html).toContain('Claims Created');
    expect(html).toContain('1 claim');
    expect(html).not.toContain('1 claims');
  });

  it('renders dash fallback when claimsCount has error', () => {
    const html = renderToStaticMarkup(
      <SurveyorsTab
        {...defaultProps}
        initialExpandedId="usr-1"
        initialClaimsCountMap={{ 'usr-1': 'error' }}
      />
    );

    expect(html).toContain('Claims Created');
    expect(html).toContain('—');
  });
});
