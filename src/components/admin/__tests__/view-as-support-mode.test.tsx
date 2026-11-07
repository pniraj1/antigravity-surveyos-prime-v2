import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAuthStore, type ViewAsSurveyor } from '@/stores/auth-store';
import { ViewAsSupportBanner } from '../ViewAsSupportBanner';
import { SurveyorsTab } from '../tabs/SurveyorsTab';
import type { SurveyorAdminProfile } from '../types';

describe('View-As Read-Only Support Mode', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { uid: 'admin-master-uid', email: 'admin@surveyos.in' } as any,
      activeWorkspaceUid: 'admin-master-uid',
      viewAsSurveyor: null,
    });
  });

  describe('useAuthStore viewAsSurveyor state', () => {
    it('initializes with viewAsSurveyor as null', () => {
      expect(useAuthStore.getState().viewAsSurveyor).toBeNull();
      expect(useAuthStore.getState().activeWorkspaceUid).toBe('admin-master-uid');
    });

    it('sets viewAsSurveyor and switches activeWorkspaceUid to target surveyor UID', () => {
      const target: ViewAsSurveyor = {
        uid: 'surveyor-uid-456',
        name: 'Suresh Kumar',
        licence: 'SLA-45678',
        email: 'suresh@example.com',
      };

      useAuthStore.getState().setViewAsSurveyor(target);

      expect(useAuthStore.getState().viewAsSurveyor).toEqual(target);
      expect(useAuthStore.getState().activeWorkspaceUid).toBe('surveyor-uid-456');
    });

    it('clears viewAsSurveyor and restores admin workspace on setViewAsSurveyor(null)', () => {
      const target: ViewAsSurveyor = {
        uid: 'surveyor-uid-456',
        name: 'Suresh Kumar',
        licence: 'SLA-45678',
      };

      useAuthStore.getState().setViewAsSurveyor(target);
      expect(useAuthStore.getState().activeWorkspaceUid).toBe('surveyor-uid-456');

      useAuthStore.getState().setViewAsSurveyor(null);
      expect(useAuthStore.getState().viewAsSurveyor).toBeNull();
      expect(useAuthStore.getState().activeWorkspaceUid).toBe('admin-master-uid');
    });
  });

  describe('ViewAsSupportBanner Component', () => {
    it('returns empty string when viewAsSurveyor is not set', () => {
      useAuthStore.setState({ viewAsSurveyor: null });
      const html = renderToStaticMarkup(<ViewAsSupportBanner />);
      expect(html).toBe('');
    });

    it('renders prominent support banner when viewAsSurveyor is active', () => {
      useAuthStore.setState({
        viewAsSurveyor: {
          uid: 'surveyor-uid-999',
          name: 'Vikram Malhotra',
          licence: 'SLA-99999',
          email: 'vikram@example.com',
        },
      });

      const html = renderToStaticMarkup(<ViewAsSupportBanner />);
      expect(html).toContain('SUPPORT MODE');
      expect(html).toContain('Vikram Malhotra');
      expect(html).toContain('SLA-99999');
      expect(html).toContain('STRICT READ-ONLY ACCESS');
      expect(html).toContain('Exit to Admin Panel');
    });
  });

  describe('SurveyorsTab View Workspace Action', () => {
    const mockSurveyor: SurveyorAdminProfile = {
      id: 'surveyor-uid-777',
      surveyorId: 'RAMESH-01',
      name: 'Ramesh Patel',
      email: 'ramesh@patel.in',
      licenceNumber: 'SLA-77777',
      irdaiLicence: 'SLA-77777',
      subscriptionStatus: 'active',
      subscriptionExpiry: '2026-12-31T23:59:59Z',
      createdAt: '2026-01-01T00:00:00Z',
    };

    it('renders View Workspace action button in surveyor table row and drawer', () => {
      const html = renderToStaticMarkup(
        <SurveyorsTab
          surveyors={[mockSurveyor]}
          payments={[]}
          loading={false}
          processingId={null}
          searchQuery=""
          onUpdateStatus={vi.fn()}
          onUpdateExpiry={vi.fn()}
          onUpdateId={vi.fn()}
          onUpdateName={vi.fn()}
          onExtend={vi.fn()}
          onDeleteAccount={vi.fn()}
          onUpdateTeamSeats={vi.fn()}
        />
      );

      expect(html).toContain('View Workspace');
      expect(html).toContain('aria-label="View workspace for Ramesh Patel"');
    });
  });
});
