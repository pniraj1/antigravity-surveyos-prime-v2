import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SubscriptionSection } from '@/components/profile/SubscriptionSection';
import { ProfileTab } from '@/components/tabs/ProfileTab';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore, DEFAULT_PROFILE } from '@/stores/profile-store';
import type { PaymentRecord } from '@/types/payment';
import type { SurveyorProfile } from '@/types';

// Mock localStorage for node environment
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

// Mock payments fetcher so it doesn't try calling Firestore in tests
vi.mock('@/lib/firebase/payments', () => ({
  getUserPayments: vi.fn().mockResolvedValue([]),
  submitPayment: vi.fn().mockResolvedValue('pay-123'),
  getAllPendingPayments: vi.fn().mockResolvedValue([]),
}));

describe('SubscriptionBillingView & Privacy Gates', () => {
  const baseProfile: SurveyorProfile = {
    ...DEFAULT_PROFILE,
    name: 'Senior Surveyor',
    licenceNumber: 'SLA-12345',
    subscriptionStatus: 'active',
    subscriptionExpiry: '2026-12-31T00:00:00.000Z',
    maxTeamSeats: 5,
    teamEmails: ['assistant1@firm.com', 'assistant2@firm.com'],
    hideEarningsFromTeam: true,
    bankName: 'HDFC Bank',
    bankAccount: '987654321098',
    bankIFSC: 'HDFC0001234',
    panNumber: 'ABCDE1234F',
    gstNumber: '27ABCDE1234F1Z5',
  };

  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { uid: 'user-senior', email: 'senior@firm.com' } as any,
      isAuthenticated: true,
      loading: false,
      sessionConflict: null,
      activeWorkspaceUid: null,
      isTeamMember: false,
      teamAffiliation: null,
    });
    useProfileStore.setState({
      profile: { ...baseProfile },
    });
  });

  describe('1. SubscriptionSection Privacy Gates', () => {
    it('hides completely (returns null) when user is a team member and hideEarnings is true (from teamAffiliation)', () => {
      useAuthStore.setState({
        isTeamMember: true,
        teamAffiliation: {
          firmOwnerUid: 'senior-123',
          firmName: 'Patil Associates',
          firmLicence: 'SLA-11111',
          hideEarnings: true,
          ownerEmail: 'senior@firm.com',
        },
      });

      const html = renderToStaticMarkup(
        <SubscriptionSection uid="user-assistant" profile={baseProfile} initialPayments={[]} />
      );

      // Should be completely empty
      expect(html).toBe('');
    });

    it('hides completely when user is a team member and teamAffiliation is null, falling back to profile.hideEarningsFromTeam = true', () => {
      useAuthStore.setState({
        isTeamMember: true,
        teamAffiliation: null,
      });

      const profileWithHide: SurveyorProfile = {
        ...baseProfile,
        hideEarningsFromTeam: true,
      };

      const html = renderToStaticMarkup(
        <SubscriptionSection uid="user-assistant" profile={profileWithHide} initialPayments={[]} />
      );

      expect(html).toBe('');
    });

    it('renders normally when user is firm owner (isTeamMember = false) even if hideEarningsFromTeam is true', () => {
      useAuthStore.setState({
        isTeamMember: false,
        teamAffiliation: null,
      });

      const html = renderToStaticMarkup(
        <SubscriptionSection uid="user-senior" profile={baseProfile} initialPayments={[]} />
      );

      expect(html).toContain('Subscription &amp; Billing');
      expect(html).toContain('Account Workspace &amp; Seats');
    });

    it('renders when user is a team member but hideEarnings is false', () => {
      useAuthStore.setState({
        isTeamMember: true,
        teamAffiliation: {
          firmOwnerUid: 'senior-123',
          firmName: 'Patil Associates',
          firmLicence: 'SLA-11111',
          hideEarnings: false,
          ownerEmail: 'senior@firm.com',
        },
      });

      const html = renderToStaticMarkup(
        <SubscriptionSection uid="user-assistant" profile={baseProfile} initialPayments={[]} />
      );

      expect(html).toContain('Subscription &amp; Billing');
    });
  });

  describe('2. Team Seats & Plan Card Rendering', () => {
    it('renders firm workspace seats info when profile.maxTeamSeats > 0', () => {
      const firmProfile: SurveyorProfile = {
        ...baseProfile,
        maxTeamSeats: 5,
        teamEmails: ['a1@test.com', 'a2@test.com'],
      };

      const html = renderToStaticMarkup(
        <SubscriptionSection uid="user-senior" profile={firmProfile} initialPayments={[]} />
      );

      expect(html).toContain('Firm Workspace (5 Team Seats)');
      expect(html).toContain('Seats used: 2 / 5');
      expect(html).toContain('Firm Workspace');
    });

    it('renders solo account info when profile.maxTeamSeats is 0 or undefined', () => {
      const soloProfile: SurveyorProfile = {
        ...baseProfile,
        maxTeamSeats: 0,
        teamEmails: [],
      };

      const html = renderToStaticMarkup(
        <SubscriptionSection uid="user-solo" profile={soloProfile} initialPayments={[]} />
      );

      expect(html).toContain('Solo Surveyor Account (1 User)');
      expect(html).toContain('Solo Account');
      expect(html).not.toContain('Seats used:');
    });
  });

  describe('3. Payment History Cards & Admin Notes Display', () => {
    it('renders adminNotes in a note box with Admin Note label when present', () => {
      const mockPayments: PaymentRecord[] = [
        {
          id: 'pay-1',
          amount: 2999,
          transactionId: 'TXN-UPI-998877',
          paymentDate: '2026-11-01',
          submittedAt: '2026-11-01T10:00:00.000Z',
          verifiedAt: '2026-11-01T11:00:00.000Z',
          verifiedBy: 'admin@motorsurveyos.com',
          status: 'verified',
          durationGranted: 90,
          notes: 'Quarterly Renewal',
          screenshotUrl: null,
          adminNotes: 'Verified via ICICI UPI handle. 10 bonus festive days added.',
          planName: 'Quarterly Pro',
          paymentMode: 'UPI',
        },
      ];

      const html = renderToStaticMarkup(
        <SubscriptionSection uid="user-senior" profile={baseProfile} initialPayments={mockPayments} />
      );

      expect(html).toContain('Admin Note');
      expect(html).toContain('Verified via ICICI UPI handle. 10 bonus festive days added.');
      expect(html).toContain('Quarterly Pro');
      expect(html).toContain('UPI');
    });

    it('renders paymentMode badge (e.g. NEFT/Bank, Cash, UPI) correctly', () => {
      const mockPayments: PaymentRecord[] = [
        {
          id: 'pay-2',
          amount: 9999,
          transactionId: 'NEFT-55443322',
          paymentDate: '2026-11-02',
          submittedAt: '2026-11-02T10:00:00.000Z',
          verifiedAt: '2026-11-02T11:00:00.000Z',
          verifiedBy: 'admin@motorsurveyos.com',
          status: 'verified',
          durationGranted: 365,
          notes: 'Annual Subscription',
          screenshotUrl: null,
          paymentMode: 'NEFT/Bank',
          planName: 'Annual Firm Plan',
        },
        {
          id: 'pay-3',
          amount: 1500,
          transactionId: 'CASH-REC-001',
          paymentDate: '2026-11-03',
          submittedAt: '2026-11-03T10:00:00.000Z',
          verifiedAt: '2026-11-03T11:00:00.000Z',
          verifiedBy: 'admin@motorsurveyos.com',
          status: 'verified',
          durationGranted: 30,
          notes: 'Cash payment handed to field rep',
          screenshotUrl: null,
          paymentMode: 'Cash',
          planName: 'Monthly Starter',
        },
      ];

      const html = renderToStaticMarkup(
        <SubscriptionSection uid="user-senior" profile={baseProfile} initialPayments={mockPayments} />
      );

      expect(html).toContain('NEFT/Bank');
      expect(html).toContain('Cash');
      expect(html).toContain('Annual Firm Plan');
      expect(html).toContain('Monthly Starter');
    });

    it('does not render Admin Note container when adminNotes is not present', () => {
      const mockPayments: PaymentRecord[] = [
        {
          id: 'pay-clean',
          amount: 999,
          transactionId: 'TXN-001',
          paymentDate: '2026-11-01',
          submittedAt: '2026-11-01T10:00:00.000Z',
          verifiedAt: null,
          verifiedBy: null,
          status: 'pending',
          durationGranted: null,
          notes: '',
          screenshotUrl: null,
        },
      ];

      const html = renderToStaticMarkup(
        <SubscriptionSection uid="user-senior" profile={baseProfile} initialPayments={mockPayments} />
      );

      expect(html).not.toContain('Admin Note');
    });
  });

  describe('4. ProfileTab Quick Navigation & Financial Privacy', () => {
    it('renders quick jump pills for #identity, #team, and #billing for senior surveyor', () => {
      useAuthStore.setState({
        isTeamMember: false,
        teamAffiliation: null,
      });

      const html = renderToStaticMarkup(<ProfileTab />);

      expect(html).toContain('href="#identity"');
      expect(html).toContain('href="#team"');
      expect(html).toContain('href="#billing"');
      expect(html).toContain('id="identity"');
      expect(html).toContain('id="team"');
      expect(html).toContain('id="billing"');

      // Unmasked financial values are visible
      expect(html).toContain(baseProfile.bankName);
      expect(html).toContain(baseProfile.bankAccount);
      expect(html).toContain(baseProfile.panNumber);
      expect(html).toContain(baseProfile.gstNumber);
    });

    it('when viewed by an assistant with hideEarnings = true, hides #billing jump link and masks financial details', () => {
      useAuthStore.setState({
        isTeamMember: true,
        teamAffiliation: {
          firmOwnerUid: 'senior-123',
          firmName: 'Patil Associates',
          firmLicence: 'SLA-11111',
          hideEarnings: true,
          ownerEmail: 'senior@firm.com',
        },
      });

      const html = renderToStaticMarkup(<ProfileTab />);

      // #identity and #team jump links are visible
      expect(html).toContain('href="#identity"');
      expect(html).toContain('href="#team"');

      // #billing jump link is NOT rendered
      expect(html).not.toContain('href="#billing"');

      // Banking fields show masked value and do NOT leak true banking details
      expect(html).toContain('value="••••••••"');
      expect(html).not.toContain(baseProfile.bankAccount);
      expect(html).not.toContain(baseProfile.bankIFSC);
      expect(html).not.toContain(baseProfile.panNumber);
      expect(html).not.toContain(baseProfile.gstNumber);
    });
  });
});
