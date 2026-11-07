import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore, DEFAULT_PROFILE } from '@/stores/profile-store';
import { AdminDashboard } from '../AdminDashboard';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock tab contents to verify active tab transitions cleanly
vi.mock('../tabs/SurveyorsTab', () => ({
  SurveyorsTab: () => <div data-testid="tab-surveyors-content">Surveyors Tab Content</div>,
}));
vi.mock('../tabs/ApprovalQueueTab', () => ({
  ApprovalQueueTab: () => <div data-testid="tab-signups-content">Signups Queue Content</div>,
}));
vi.mock('../tabs/PaymentsTab', () => ({
  PaymentsTab: () => <div data-testid="tab-payments-content">Payments Tab Content</div>,
}));
vi.mock('../tabs/AIModelsTab', () => ({
  AIModelsTab: () => <div data-testid="tab-ai-models-content">AI Models Tab Content</div>,
}));
vi.mock('../tabs/FeeScheduleTab', () => ({
  FeeScheduleTab: () => <div data-testid="tab-fee-schedule-content">Fee Schedule Tab Content</div>,
}));
vi.mock('../tabs/AnnouncementsTab', () => ({
  AnnouncementsTab: () => <div data-testid="tab-announcements-content">Announcements Tab Content</div>,
}));
vi.mock('../tabs/DevNotesTab', () => ({
  DevNotesTab: () => <div data-testid="tab-dev-notes-content">Dev Notes Tab Content</div>,
}));

// Mock data hooks
const mockSurveyors = [
  {
    id: 'srv-1',
    name: 'Alpha Valuer',
    email: 'alpha@surveyos.test',
    licenceNumber: 'SLA-1001',
    subscriptionStatus: 'active' as const,
    subscriptionExpiry: '2026-12-31',
  },
  {
    id: 'srv-2',
    name: 'Beta Valuer',
    email: 'beta@surveyos.test',
    licenceNumber: 'SLA-1002',
    subscriptionStatus: 'active' as const,
    subscriptionExpiry: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // expiring in 4 days
  },
  {
    id: 'srv-3',
    name: 'No Email Valuer',
    email: '',
    licenceNumber: 'SLA-1003',
    subscriptionStatus: 'active' as const,
    subscriptionExpiry: '2026-12-31',
  },
];

const mockSignups = [
  {
    uid: 'signup-1',
    email: 'applicant1@surveyos.test',
    name: 'Applicant One',
    createdAt: '2026-11-01',
  },
  {
    uid: 'signup-2',
    email: 'applicant2@surveyos.test',
    name: 'Applicant Two',
    createdAt: '2026-11-02',
  },
];

const mockPayments = [
  {
    id: 'pay-1',
    userUid: 'srv-1',
    status: 'pending' as const,
    amount: 5000,
  },
  {
    id: 'pay-2',
    userUid: 'srv-2',
    status: 'verified' as const,
    amount: 5000,
  },
];

vi.mock('../hooks/useAdminData', () => ({
  useAdminData: () => ({
    surveyors: mockSurveyors,
    signups: mockSignups,
    payments: mockPayments,
    loading: false,
    signupsLoading: false,
    paymentsLoading: false,
    fetchAllProfiles: vi.fn(),
    fetchSignups: vi.fn(),
    fetchPayments: vi.fn(),
    refreshAll: vi.fn(),
    setSurveyors: vi.fn(),
    setSignups: vi.fn(),
  }),
}));

vi.mock('../hooks/useAdminActions', () => ({
  useAdminActions: () => ({
    processingId: null,
    handleApprove: vi.fn(),
    handleDismissConfirm: vi.fn(),
    handleSendCustomEmail: vi.fn(),
    handleUpdateStatus: vi.fn(),
    handleUpdateExpiry: vi.fn(),
    handleUpdateId: vi.fn(),
    handleUpdateName: vi.fn(),
    handleExtendSubscription: vi.fn(),
    handleDeleteAccount: vi.fn(),
    handleUpdateTeamSeats: vi.fn(),
    handleVerify: vi.fn(),
    handleRecordManualPayment: vi.fn(),
  }),
}));

describe('Admin Navigation & Universal Command Header Redesign', () => {
  const originalAlert = (globalThis as any).alert;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).alert = vi.fn();

    // Authenticate as Admin
    useAuthStore.setState({
      user: { uid: 'admin-uid-1', email: 'admin@surveyos.test' } as any,
      isAuthenticated: true,
      loading: false,
    });
    useProfileStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        isAdmin: true,
      } as any,
    });
  });

  afterEach(() => {
    (globalThis as any).alert = originalAlert;
    Object.assign(navigator, { clipboard: originalClipboard });
  });

  describe('1. Navigation Tab Groups Rendering', () => {
    it('renders Primary Operations Tabs (All Surveyors, New Signups, Payments) with badge counts', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} />);

      // Primary Operations tablist
      expect(html).toContain('aria-label="Primary Operations"');
      expect(html).toContain('All Surveyors');
      expect(html).toContain('New Signups');
      expect(html).toContain('Payments');

      // Total surveyors count badge (3)
      expect(html).toContain('>3</span>');
      // Expiring soon count badge (1)
      expect(html).toContain('>1</span>');
      // Signups count badge (2)
      expect(html).toContain('>2</span>');
      // Pending payments count badge (1)
      expect(html).toContain('>1</span>');
    });

    it('renders System Tools Segment (AI Models, Fee Schedule, Announcements, Dev Notes)', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} />);

      // System Tools tablist
      expect(html).toContain('aria-label="System Tools"');
      expect(html).toContain('AI Models');
      expect(html).toContain('Fee Schedule');
      expect(html).toContain('Announcements');
      expect(html).toContain('Dev Notes');
    });

    it('eliminates all text-[9px] and uses text-[11px] or text-xs on badges and labels', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} />);

      // No 9px text anywhere in the dashboard
      expect(html).not.toContain('text-[9px]');

      // Badges upgraded to text-[11px] font-medium
      expect(html).toContain('text-[11px] font-medium');
    });

    it('ensures all tab and action buttons have visible focus rings', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} />);

      // Accessible keyboard focus rings
      expect(html).toContain('focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none');
    });
  });

  describe('2. Universal Command Header & Search Bar', () => {
    it('renders universal search bar with required accessible attributes and placeholder', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} />);

      expect(html).toContain('aria-label="Search surveyors, licence, or ID"');
      expect(html).toContain('placeholder="Search by name, licence, or UID..."');
    });

    it('renders Copy All Emails button when on surveyors tab', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} initialTab="surveyors" />);

      expect(html).toContain('Copy All Emails');
      expect(html).toContain('title="Copy All Emails"');
    });
  });

  describe('3. Copy All Emails Clipboard & Toast (No Thread-Blocking Alert)', () => {
    it('copies valid emails to clipboard and fires toast.success without calling window.alert', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      let capturedActions: {
        handleCopyEmails: () => void;
        setActiveTab: (tab: any) => void;
        setSearchQuery: (q: string) => void;
      } | null = null;

      renderToStaticMarkup(
        <AdminDashboard
          isAuthorized={true}
          getAction={(actions) => {
            capturedActions = actions;
          }}
        />
      );

      expect(capturedActions).not.toBeNull();
      capturedActions!.handleCopyEmails();

      // Only 2 of the 3 surveyors have non-empty emails
      expect(writeTextMock).toHaveBeenCalledWith('alpha@surveyos.test, beta@surveyos.test');
      expect(toast.success).toHaveBeenCalledWith('Copied 2 email addresses to clipboard!');
      expect((globalThis as any).alert).not.toHaveBeenCalled();
    });
  });

  describe('4. Active View Tab Switching', () => {
    it('renders Surveyors tab view by default', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} initialTab="surveyors" />);
      expect(html).toContain('data-testid="tab-surveyors-content"');
      expect(html).not.toContain('data-testid="tab-signups-content"');
    });

    it('renders Signups queue view when switching to signups', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} initialTab="signups" />);
      expect(html).toContain('data-testid="tab-signups-content"');
      expect(html).not.toContain('data-testid="tab-surveyors-content"');
    });

    it('renders Payments tab view when switching to payments', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} initialTab="payments" />);
      expect(html).toContain('data-testid="tab-payments-content"');
      expect(html).not.toContain('data-testid="tab-surveyors-content"');
    });

    it('renders AI Models tab view when switching to ai-models', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} initialTab="ai-models" />);
      expect(html).toContain('data-testid="tab-ai-models-content"');
      expect(html).not.toContain('data-testid="tab-surveyors-content"');
    });

    it('renders Fee Schedule tab view when switching to fee-schedule', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} initialTab="fee-schedule" />);
      expect(html).toContain('data-testid="tab-fee-schedule-content"');
      expect(html).not.toContain('data-testid="tab-surveyors-content"');
    });

    it('renders Announcements tab view when switching to announcements', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} initialTab="announcements" />);
      expect(html).toContain('data-testid="tab-announcements-content"');
      expect(html).not.toContain('data-testid="tab-surveyors-content"');
    });

    it('renders Dev Notes tab view when switching to dev-notes', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={true} initialTab="dev-notes" />);
      expect(html).toContain('data-testid="tab-dev-notes-content"');
      expect(html).not.toContain('data-testid="tab-surveyors-content"');
    });
  });

  describe('5. Authorization Protection', () => {
    it('renders Not Authorized screen if user is not admin', () => {
      const html = renderToStaticMarkup(<AdminDashboard isAuthorized={false} />);
      expect(html).toContain('Not Authorized');
      expect(html).not.toContain('Regulator Dashboard');
    });
  });
});
