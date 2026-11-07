import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { shouldHideFees, Sidebar } from '../sidebar';
import { TabPlaceholder, DashboardContent } from '../Dashboard';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore, DEFAULT_PROFILE } from '@/stores/profile-store';
import { useClaimStore } from '@/stores/claim-store';

// Mock localStorage for node environment if not present
const storage = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
  get length() { return storage.size; },
  key: (i: number) => Array.from(storage.keys())[i] ?? null,
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
}

describe('team-privacy-gate', () => {
  beforeEach(() => {
    storage.clear();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      loading: false,
      sessionConflict: null,
      activeWorkspaceUid: null,
      isTeamMember: false,
      teamAffiliation: null,
    });
    useProfileStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        hideEarningsFromTeam: true,
      },
    });
    useClaimStore.setState({
      currentClaim: null,
      claimsList: [],
    });
  });

  describe('shouldHideFees helper function', () => {
    it('returns true when isTeamMember: true and hideEarnings: true', () => {
      expect(shouldHideFees(true, true)).toBe(true);
    });

    it('returns false when isTeamMember: false and hideEarnings: true', () => {
      expect(shouldHideFees(false, true)).toBe(false);
    });

    it('returns false when isTeamMember: true and hideEarnings: false', () => {
      expect(shouldHideFees(true, false)).toBe(false);
    });

    it('returns false when isTeamMember: false and hideEarnings: false', () => {
      expect(shouldHideFees(false, false)).toBe(false);
    });

    it('returns false when hideEarnings is undefined', () => {
      expect(shouldHideFees(true, undefined)).toBe(false);
      expect(shouldHideFees(false, undefined)).toBe(false);
    });
  });

  describe('Sidebar Navigation Item Filtering Logic', () => {
    it('shows Survey Fees Bill when isTeamMember is false', () => {
      useAuthStore.setState({
        isTeamMember: false,
        teamAffiliation: null,
      });
      useProfileStore.setState({
        profile: { ...DEFAULT_PROFILE, hideEarningsFromTeam: true },
      });

      const html = renderToStaticMarkup(<Sidebar />);
      expect(html).toContain('Survey Fees Bill');
    });

    it('hides Survey Fees Bill when isTeamMember is true and teamAffiliation.hideEarnings is true', () => {
      useAuthStore.setState({
        isTeamMember: true,
        teamAffiliation: {
          firmOwnerUid: 'owner-1',
          firmName: 'ABC Surveyors',
          firmLicence: 'SLA-1234',
          hideEarnings: true,
          ownerEmail: 'owner@example.com',
        },
      });

      const html = renderToStaticMarkup(<Sidebar />);
      expect(html).not.toContain('Survey Fees Bill');
    });

    it('shows Survey Fees Bill when isTeamMember is true but teamAffiliation.hideEarnings is false', () => {
      useAuthStore.setState({
        isTeamMember: true,
        teamAffiliation: {
          firmOwnerUid: 'owner-1',
          firmName: 'ABC Surveyors',
          firmLicence: 'SLA-1234',
          hideEarnings: false,
          ownerEmail: 'owner@example.com',
        },
      });

      const html = renderToStaticMarkup(<Sidebar />);
      expect(html).toContain('Survey Fees Bill');
    });

    it('falls back to profile.hideEarningsFromTeam when teamAffiliation is null', () => {
      useAuthStore.setState({
        isTeamMember: true,
        teamAffiliation: null,
      });
      useProfileStore.setState({
        profile: { ...DEFAULT_PROFILE, hideEarningsFromTeam: true },
      });

      let html = renderToStaticMarkup(<Sidebar />);
      expect(html).not.toContain('Survey Fees Bill');

      useProfileStore.setState({
        profile: { ...DEFAULT_PROFILE, hideEarningsFromTeam: false },
      });
      html = renderToStaticMarkup(<Sidebar />);
      expect(html).toContain('Survey Fees Bill');
    });
  });

  describe('TabPlaceholder Access Restricted Gate', () => {
    it('renders Access Restricted card when tab="fees" and shouldHideFees is true', () => {
      useAuthStore.setState({
        isTeamMember: true,
        teamAffiliation: {
          firmOwnerUid: 'owner-1',
          firmName: 'ABC Surveyors',
          firmLicence: 'SLA-1234',
          hideEarnings: true,
          ownerEmail: 'owner@example.com',
        },
      });

      const html = renderToStaticMarkup(<TabPlaceholder tab="fees" />);
      expect(html).toContain('Access Restricted');
      expect(html).toContain(
        'Professional survey fee bills and earnings are restricted to the primary surveyor.'
      );
    });

    it('does not render Access Restricted card when isTeamMember is false', () => {
      useAuthStore.setState({
        isTeamMember: false,
        teamAffiliation: null,
      });

      const html = renderToStaticMarkup(<TabPlaceholder tab="fees" />);
      expect(html).not.toContain('Access Restricted');
    });
  });

  describe('DashboardContent Fees Overview & Archived Claims Gate', () => {
    it('hides Fees overview section when shouldHideFees is true', () => {
      useAuthStore.setState({
        isTeamMember: true,
        teamAffiliation: {
          firmOwnerUid: 'owner-1',
          firmName: 'ABC Surveyors',
          firmLicence: 'SLA-1234',
          hideEarnings: true,
          ownerEmail: 'owner@example.com',
        },
      });

      const html = renderToStaticMarkup(<DashboardContent />);
      expect(html).not.toContain('Fees overview');
      expect(html).not.toContain('Total Billed');
      expect(html).not.toContain('Fees Received');
      expect(html).not.toContain('Outstanding');
    });

    it('shows Fees overview section when shouldHideFees is false', () => {
      useAuthStore.setState({
        isTeamMember: false,
        teamAffiliation: null,
      });

      const html = renderToStaticMarkup(<DashboardContent />);
      expect(html).toContain('Fees overview');
      expect(html).toContain('Total Billed');
      expect(html).toContain('Fees Received');
      expect(html).toContain('Outstanding');
    });

    it('hides permanently delete button on archived claims when isTeamMember is true', () => {
      const mockArchivedClaim = {
        id: 'archived-1',
        label: 'FIN/2026/001',
        surveyType: 'final' as const,
        reportNo: 'FIN/2026/001',
        vehicleNo: 'DL01AB1234',
        insurerName: 'Test Insurer',
        insuredName: 'Test Insured',
        stage: 'final' as const,
        surveyDate: '2026-11-07',
        updatedAt: new Date().toISOString(),
        isActive: false,
        isCompleted: true,
        feePaid: false,
        feeTotal: 0,
        gDriveFolderId: null,
        hasDocuments: false,
      };

      useClaimStore.setState({
        claimsList: [mockArchivedClaim],
      });

      // Primary surveyor: can delete permanently
      useAuthStore.setState({ isTeamMember: false });
      let html = renderToStaticMarkup(<DashboardContent initialShowArchived={true} />);
      expect(html).toContain('title="Delete Permanently"');

      // Team member: cannot delete permanently
      useAuthStore.setState({ isTeamMember: true });
      html = renderToStaticMarkup(<DashboardContent initialShowArchived={true} />);
      expect(html).not.toContain('title="Delete Permanently"');
    });
  });
});
