import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NAV_ITEMS, shouldHideFees, Sidebar } from '../sidebar';
import { TabPlaceholder } from '../Dashboard';
import { PaymentReconciliationTab } from '../../tabs/PaymentReconciliationTab';
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

describe('Sidebar & Dashboard Payment Reconciliation Integration', () => {
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

  describe('NAV_ITEMS definition', () => {
    it('contains payment-reconciliation item in main group without requiring claim', () => {
      const item = NAV_ITEMS.find((nav) => nav.id === 'payment-reconciliation');
      expect(item).toBeDefined();
      expect(item?.label).toBe('Payment Reconciliation');
      expect(item?.group).toBe('main');
      expect(item?.requiresClaim).toBe(false);
    });
  });

  describe('shouldHideFees logic', () => {
    it('returns true when isTeamMember: true and hideEarnings: true (assistant)', () => {
      expect(shouldHideFees(true, true)).toBe(true);
    });

    it('returns false when isTeamMember: false and hideEarnings: true (primary surveyor)', () => {
      expect(shouldHideFees(false, true)).toBe(false);
    });
  });

  describe('Sidebar fee guard for payment-reconciliation', () => {
    it('renders Payment Reconciliation in sidebar for primary surveyor', () => {
      useAuthStore.setState({ isTeamMember: false });
      const html = renderToStaticMarkup(<Sidebar />);
      expect(html).toContain('Payment Reconciliation');
    });

    it('hides Payment Reconciliation in sidebar when assistant has earnings hidden', () => {
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
      expect(html).not.toContain('Payment Reconciliation');
    });
  });

  describe('TabPlaceholder for payment-reconciliation', () => {
    it('renders Access Restricted when assistant has earnings hidden', () => {
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
      const html = renderToStaticMarkup(<TabPlaceholder tab="payment-reconciliation" />);
      expect(html).toContain('Access Restricted');
      expect(html).toContain('Payment reconciliation and fee tracking are restricted to the primary surveyor.');
    });

    it('allows access (not restricted and not coming-soon fallback) when accessed by primary surveyor', () => {
      useAuthStore.setState({ isTeamMember: false });
      const html = renderToStaticMarkup(<TabPlaceholder tab="payment-reconciliation" />);
      expect(html).not.toContain('Access Restricted');
      expect(html).not.toContain('Coming soon');
    });

    it('renders PaymentReconciliationTab with container data-testid', () => {
      const html = renderToStaticMarkup(<PaymentReconciliationTab />);
      expect(html).toContain('data-testid="payment-reconciliation-tab"');
      expect(html).toContain('Payment Reconciliation');
    });
  });
});
