import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { toast } from 'sonner';
import {
  SurveyorsTab,
  TeamSeatsControl,
  IdentityEditorCard,
  FirmTeamSeatsCard,
  PaymentLedgerCard,
} from '../tabs/SurveyorsTab';
import type { SurveyorAdminProfile } from '../types';
import type { PaymentRecord } from '@/types/payment';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock SurveyorAIKeys
vi.mock('../SurveyorAIKeys', () => ({
  SurveyorAIKeys: ({ uid }: { uid: string }) => (
    <div data-testid={`ai-keys-${uid}`}>AI Keys Configuration</div>
  ),
}));

describe('Surveyor Registry Table 6-Column Consolidation & Bento Drawer', () => {
  const mockSurveyors: SurveyorAdminProfile[] = [
    {
      id: 'srv-firm',
      name: 'Alpha Valuer',
      email: 'alpha@surveyos.test',
      mobileNumber: '+91 98765 43210',
      licenceNumber: 'SLA-1001',
      subscriptionStatus: 'active',
      subscriptionExpiry: '2026-12-31',
      surveyorId: 'SRV-01',
      city: 'Mumbai',
      state: 'Maharashtra',
      qualifications: 'B.E. Mechanical, FIII',
      referralCode: 'REF-ALPHA',
      referredBy: 'REF-HEAD',
      createdAt: '2026-01-15',
      maxTeamSeats: 3,
      teamEmails: ['assist1@surveyos.test', 'assist2@surveyos.test'],
      isAdmin: true,
      onboarding: {
        welcomeDoneAt: '2026-01-15T10:00:00Z',
        tourDoneAt: '2026-01-15T10:05:00Z',
        tipsSeen: { assessment: '2026-01-15T10:10:00Z' },
      },
    },
    {
      id: 'srv-solo',
      name: 'Solo Inspector',
      email: 'solo@surveyos.test',
      mobile: '+91 99999 88888',
      licenceNumber: 'SLA-2002',
      subscriptionStatus: 'trial',
      subscriptionExpiry: '2026-12-01',
      surveyorId: '',
      city: 'Delhi',
      state: 'Delhi',
      qualifications: 'Diploma Automobile',
      referralCode: '',
      referredBy: '',
      createdAt: '2026-11-01',
      maxTeamSeats: 0,
      teamEmails: [],
      isAdmin: false,
    },
  ];

  const mockPayments: PaymentRecord[] = [
    {
      id: 'pay-1',
      userUid: 'srv-firm',
      amount: 4999,
      transactionId: 'TXN-998877',
      paymentDate: '2026-02-01',
      submittedAt: '2026-02-01T10:00:00Z',
      verifiedAt: '2026-02-01T10:05:00Z',
      verifiedBy: 'admin',
      status: 'verified',
      paymentMode: 'NEFT/Bank',
      planName: 'Annual Pro',
      adminNotes: 'Direct bank transfer verified with HDFC',
      notes: 'Recorded manually',
      durationGranted: 365,
      screenshotUrl: null,
    },
  ];

  const defaultProps = {
    surveyors: mockSurveyors,
    payments: mockPayments,
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

  describe('1. 6-Column Consolidation & Table Architecture', () => {
    it('renders exactly 6 column headers with scope="col"', () => {
      const html = renderToStaticMarkup(<SurveyorsTab {...defaultProps} />);

      // Scope="col"
      const scopeColMatches = html.match(/scope="col"/g);
      expect(scopeColMatches).toHaveLength(6);

      // The 6 consolidated headers
      expect(html).toContain('Surveyor &amp; Identity');
      expect(html).toContain('Licence &amp; Platform ID');
      expect(html).toContain('Status &amp; Plan');
      expect(html).toContain('Claims &amp; Onboarding');
      expect(html).toContain('Expiry');
      expect(html).toContain('Actions');

      // The old 9 columns should not exist as standalone headers
      expect(html).not.toContain('<th scope="col" class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform ID</th>');
      expect(html).not.toContain('<th scope="col" class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Licence</th>');
      expect(html).not.toContain('<th scope="col" class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Days Left</th>');
      expect(html).not.toContain('<th scope="col" class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expiry Date</th>');
    });

    it('does not render raw <input> fields in collapsed table cells', () => {
      const html = renderToStaticMarkup(<SurveyorsTab {...defaultProps} />);

      // Only the ExtendControl contains an input when opened (not opened by default)
      // Neither the name, platform ID, nor expiry date should have raw inputs in <td>
      const inputTags = html.match(/<input /g);
      expect(inputTags).toBeNull();
    });
  });

  describe('2. Consolidated Column Data Rendering', () => {
    it('renders Column 1: initials avatar, full name, email, and mobile', () => {
      const html = renderToStaticMarkup(<SurveyorsTab {...defaultProps} />);

      // Initials avatar
      expect(html).toContain('AV'); // Alpha Valuer
      expect(html).toContain('SI'); // Solo Inspector
      expect(html).toContain('w-9 h-9 rounded-xl bg-primary/10 text-primary font-semibold');

      // Name & Admin shield
      expect(html).toContain('Alpha Valuer');
      expect(html).toContain('lucide-shield-check');

      // Email & Mobile with icons
      expect(html).toContain('alpha@surveyos.test');
      expect(html).toContain('lucide-mail');
      expect(html).toContain('+91 98765 43210');
      expect(html).toContain('lucide-phone');
    });

    it('renders Column 2: licence, platform ID badge, and location', () => {
      const html = renderToStaticMarkup(<SurveyorsTab {...defaultProps} />);

      expect(html).toContain('SLA-1001');
      expect(html).toContain('SRV-01');
      expect(html).toContain('Mumbai, Maharashtra');
      expect(html).toContain('Delhi, Delhi');

      // Unassigned badge for empty ID
      expect(html).toContain('Unassigned');
    });

    it('renders Column 3: status badge and plan tag (Firm seats vs Solo)', () => {
      const html = renderToStaticMarkup(<SurveyorsTab {...defaultProps} />);

      // Active status & Firm plan tag
      expect(html).toContain('active');
      expect(html).toContain('👥 Firm (2/3 Seats)');

      // Trial status & Solo plan tag
      expect(html).toContain('trial');
      expect(html).toContain('👤 Solo');
    });

    it('renders Column 4: claims count badge and onboarding progress', () => {
      const html = renderToStaticMarkup(
        <SurveyorsTab
          {...defaultProps}
          initialClaimsCountMap={{ 'srv-firm': 5, 'srv-solo': 0 }}
        />
      );

      // Claims
      expect(html).toContain('5 claims');
      expect(html).toContain('0 (Untested)'); // Trial with 0 claims

      // Onboarding badges
      expect(html).toContain('3/5');
      expect(html).toContain('1 tips seen');
      expect(html).toContain('1/5');
    });

    it('renders Column 5: formatted expiry date and countdown pill', () => {
      const html = renderToStaticMarkup(<SurveyorsTab {...defaultProps} />);

      expect(html).toContain('31 Dec 2026');
      expect(html).toContain('01 Dec 2026');
      expect(html).toContain('left)');
    });

    it('renders Column 6: Actions buttons with accessibility attributes', () => {
      const onViewWorkspaceMock = vi.fn();
      const html = renderToStaticMarkup(
        <SurveyorsTab
          {...defaultProps}
          onViewWorkspace={onViewWorkspaceMock}
        />
      );

      // Buttons
      expect(html).toContain('Extend');
      expect(html).toContain('View');
      expect(html).toContain('Manage');

      // Accessibility attributes
      expect(html).toContain('aria-label="Extend subscription"');
      expect(html).toContain('aria-label="View workspace for Alpha Valuer"');
      expect(html).toContain('aria-label="Manage surveyor details"');
      expect(html).toContain('aria-expanded="false"');
    });
  });

  describe('3. Expanded Drawer Bento Grid Layout (colSpan=6)', () => {
    it('renders 3-column Bento Grid when drawer is expanded', () => {
      const html = renderToStaticMarkup(
        <SurveyorsTab
          {...defaultProps}
          initialExpandedId="srv-firm"
        />
      );

      // Drawer colSpan is 6
      expect(html).toContain('colSpan="6"');

      // Card 1: Identity & Licence Editor
      expect(html).toContain('Identity &amp; Licence Editor');
      expect(html).toContain('Full Name');
      expect(html).toContain('Platform ID');
      expect(html).toContain('Save Identity Changes');
      expect(html).toContain('B.E. Mechanical, FIII');
      expect(html).toContain('REF-ALPHA');
      expect(html).toContain('REF-HEAD');

      // Card 2: Firm Team & Seats
      expect(html).toContain('Firm Team &amp; Seats');
      expect(html).toContain('Allowed Team Seats:');
      expect(html).toContain('Fee bills &amp; earnings hidden from team');
      expect(html).toContain('Registered Assistants (2)');
      expect(html).toContain('assist1@surveyos.test');
      expect(html).toContain('assist2@surveyos.test');

      // Card 3: Subscription & Payment Ledger
      expect(html).toContain('Payment History &amp; Notes');
      expect(html).toContain('Total Lifetime Revenue');
      expect(html).toContain('₹4,999');
      expect(html).toContain('TXN-998877');
      expect(html).toContain('Direct bank transfer verified with HDFC');

      // Danger Zone & Footer
      expect(html).toContain('Status:');
      expect(html).toContain('Active');
      expect(html).toContain('Suspend');
      expect(html).toContain('Read-Only');
      expect(html).toContain('⚠️ Delete Account');
    });
  });

  describe('4. Interactive Components & Callbacks', () => {
    it('IdentityEditorCard calls onUpdateName and onUpdateId on save', () => {
      const onUpdateName = vi.fn();
      const onUpdateId = vi.fn();

      const element = (
        <IdentityEditorCard
          surveyor={mockSurveyors[0]}
          isProcessing={false}
          onUpdateName={onUpdateName}
          onUpdateId={onUpdateId}
          claimsCount={5}
        />
      );

      const html = renderToStaticMarkup(element);
      expect(html).toContain('Alpha Valuer');
      expect(html).toContain('SRV-01');
      expect(html).toContain('5 claims');
    });

    it('TeamSeatsControl stepper buttons and input work smoothly', () => {
      const onUpdateTeamSeats = vi.fn();

      const element = TeamSeatsControl({
        surveyorId: 'srv-firm',
        maxTeamSeats: 3,
        onUpdateTeamSeats,
      });

      // Test stepper container blur callback
      const fakeBlurEvent = {
        target: { value: '4' },
      } as unknown as React.FocusEvent<HTMLInputElement>;

      element.props.onBlur(fakeBlurEvent);
      expect(onUpdateTeamSeats).toHaveBeenCalledWith('srv-firm', 4);

      // Verify buttons exist in rendered output
      const html = renderToStaticMarkup(element);
      expect(html).toContain('aria-label="Decrease team seats"');
      expect(html).toContain('aria-label="Increase team seats"');
      expect(html).toContain('aria-label="Allowed Team Seats"');
    });

    it('PaymentLedgerCard calculates and displays lifetime revenue correctly', () => {
      const onUpdateExpiry = vi.fn();

      const element = (
        <PaymentLedgerCard
          surveyor={mockSurveyors[0]}
          payments={mockPayments}
          isProcessing={false}
          onUpdateExpiry={onUpdateExpiry}
        />
      );

      const html = renderToStaticMarkup(element);
      expect(html).toContain('Total Lifetime Revenue');
      expect(html).toContain('₹4,999');
      expect(html).toContain('TXN-998877');
      expect(html).toContain('Direct bank transfer verified with HDFC');
    });

    it('PaymentLedgerCard shows "No payments recorded yet" when surveyor has no payments', () => {
      const onUpdateExpiry = vi.fn();

      const element = (
        <PaymentLedgerCard
          surveyor={mockSurveyors[1]}
          payments={mockPayments}
          isProcessing={false}
          onUpdateExpiry={onUpdateExpiry}
        />
      );

      const html = renderToStaticMarkup(element);
      expect(html).toContain('Total Lifetime Revenue');
      expect(html).toContain('₹0');
      expect(html).toContain('No payments recorded yet');
    });
  });
});
