import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { SurveyorsTab, TeamSeatsControl } from '../tabs/SurveyorsTab';
import type { SurveyorAdminProfile } from '../types';

describe('Admin Team Seats Quota & Team Display', () => {
  const mockSurveyors: SurveyorAdminProfile[] = [
    {
      id: 'usr-firm',
      name: 'Alpha Valuers',
      email: 'lead@alphavaluers.com',
      licenceNumber: 'SLA-11111',
      subscriptionStatus: 'active',
      subscriptionExpiry: '2026-12-31',
      surveyorId: 'SRV-ALPHA',
      maxTeamSeats: 3,
      teamEmails: ['assistant1@alphavaluers.com', 'assistant2@alphavaluers.com'],
    },
    {
      id: 'usr-solo',
      name: 'Solo Surveyor',
      email: 'solo@inspect.com',
      licenceNumber: 'SLA-22222',
      subscriptionStatus: 'active',
      subscriptionExpiry: '2026-12-31',
      surveyorId: 'SRV-SOLO',
      maxTeamSeats: 0,
      teamEmails: [],
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
    onUpdateTeamSeats: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Search matching by assistant email', () => {
    it('matches and displays surveyor when searching for an assistant email in teamEmails', () => {
      const html = renderToStaticMarkup(
        <SurveyorsTab
          {...defaultProps}
          searchQuery="assistant1@alphavaluers.com"
        />
      );

      expect(html).toContain('Alpha Valuers');
      expect(html).not.toContain('Solo Surveyor');
    });

    it('matches on partial assistant email case-insensitively', () => {
      const html = renderToStaticMarkup(
        <SurveyorsTab
          {...defaultProps}
          searchQuery="ASSISTANT2"
        />
      );

      expect(html).toContain('Alpha Valuers');
      expect(html).not.toContain('Solo Surveyor');
    });

    it('shows "No surveyors found" when search matches neither surveyor nor assistant emails', () => {
      const html = renderToStaticMarkup(
        <SurveyorsTab
          {...defaultProps}
          searchQuery="unknown@nonexistent.com"
        />
      );

      expect(html).toContain('No surveyors found');
      expect(html).not.toContain('Alpha Valuers');
      expect(html).not.toContain('Solo Surveyor');
    });
  });

  describe('2. Table seats badge and expanded team card', () => {
    it('displays seats badge correctly in table row (e.g. 2/3 Seats and Solo)', () => {
      const html = renderToStaticMarkup(<SurveyorsTab {...defaultProps} />);

      // Consolidated Status & Plan column header
      expect(html).toContain('Status &amp; Plan');
      // Surveyor with 2 assistants out of 3 seats
      expect(html).toContain('👥 Firm (2/3 Seats)');
      // Surveyor with 0 assistants out of 0 seats (Solo)
      expect(html).toContain('👤 Solo');
    });

    it('displays single seat usage accurately e.g. Firm (1/3 Seats)', () => {
      const singleAssistantSurveyor: SurveyorAdminProfile[] = [
        {
          id: 'usr-single',
          name: 'Single Assistant Firm',
          email: 'firm@single.com',
          subscriptionStatus: 'active',
          subscriptionExpiry: '2026-12-31',
          surveyorId: 'SRV-SINGLE',
          maxTeamSeats: 3,
          teamEmails: ['assistant@single.com'],
        },
      ];

      const html = renderToStaticMarkup(
        <SurveyorsTab
          {...defaultProps}
          surveyors={singleAssistantSurveyor}
        />
      );

      expect(html).toContain('👥 Firm (1/3 Seats)');
    });

    it('renders Firm Team & Seats card when row is expanded with assistants list', () => {
      const html = renderToStaticMarkup(
        <SurveyorsTab
          {...defaultProps}
          initialExpandedId="usr-firm"
        />
      );

      expect(html).toContain('Firm Team &amp; Seats');
      expect(html).toContain('(2 of 3 seats used)');
      expect(html).toContain('Allowed Team Seats:');
      expect(html).toContain('Registered Assistants (2)');
      expect(html).toContain('assistant1@alphavaluers.com');
      expect(html).toContain('assistant2@alphavaluers.com');
    });

    it('renders "No assistants registered yet" when expanded surveyor has no teamEmails', () => {
      const html = renderToStaticMarkup(
        <SurveyorsTab
          {...defaultProps}
          initialExpandedId="usr-solo"
        />
      );

      expect(html).toContain('Firm Team &amp; Seats');
      expect(html).toContain('(0 of 0 seats used)');
      expect(html).toContain('No assistants registered yet');
    });
  });

  describe('3. Updating team seats via TeamSeatsControl', () => {
    it('triggers onUpdateTeamSeats with parsed seats number on blur', () => {
      const onUpdateMock = vi.fn();
      const element = TeamSeatsControl({
        surveyorId: 'usr-firm',
        maxTeamSeats: 3,
        onUpdateTeamSeats: onUpdateMock,
      });

      const fakeEvent = {
        target: { value: '5' },
      };

      element.props.onBlur(fakeEvent);

      expect(onUpdateMock).toHaveBeenCalledTimes(1);
      expect(onUpdateMock).toHaveBeenCalledWith('usr-firm', 5);
      expect(fakeEvent.target.value).toBe('5');
    });

    it('does not trigger onUpdateTeamSeats if the seats value is unchanged', () => {
      const onUpdateMock = vi.fn();
      const element = TeamSeatsControl({
        surveyorId: 'usr-firm',
        maxTeamSeats: 3,
        onUpdateTeamSeats: onUpdateMock,
      });

      element.props.onBlur({ target: { value: '3' } });

      expect(onUpdateMock).not.toHaveBeenCalled();
    });

    it('clamps negative input values to 0', () => {
      const onUpdateMock = vi.fn();
      const element = TeamSeatsControl({
        surveyorId: 'usr-firm',
        maxTeamSeats: 3,
        onUpdateTeamSeats: onUpdateMock,
      });

      const fakeEvent = {
        target: { value: '-4' },
      };

      element.props.onBlur(fakeEvent);

      expect(onUpdateMock).toHaveBeenCalledTimes(1);
      expect(onUpdateMock).toHaveBeenCalledWith('usr-firm', 0);
      expect(fakeEvent.target.value).toBe('0');
    });

    it('clamps values greater than 50 to 50', () => {
      const onUpdateMock = vi.fn();
      const element = TeamSeatsControl({
        surveyorId: 'usr-firm',
        maxTeamSeats: 3,
        onUpdateTeamSeats: onUpdateMock,
      });

      const fakeEvent = {
        target: { value: '99' },
      };

      element.props.onBlur(fakeEvent);

      expect(onUpdateMock).toHaveBeenCalledTimes(1);
      expect(onUpdateMock).toHaveBeenCalledWith('usr-firm', 50);
      expect(fakeEvent.target.value).toBe('50');
    });
  });
});
