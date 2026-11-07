import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PaymentRecord } from '@/types/payment';
import type { SurveyorAdminProfile } from '../types';
import { VerifyPaymentModal } from '../modals/VerifyPaymentModal';
import { RecordOfflinePaymentModal } from '../modals/RecordOfflinePaymentModal';
import { PaymentsTab } from '../tabs/PaymentsTab';
import { SurveyorsTab } from '../tabs/SurveyorsTab';

// Mock firestore
const mockDoc = vi.fn((...args: unknown[]) => {
  const segments = args.slice(1) as string[];
  return {
    path: segments.join('/'),
    id: segments[segments.length - 1],
  };
});
const mockCollection = vi.fn((...args: unknown[]) => {
  const segments = args.slice(1) as string[];
  return {
    path: segments.join('/'),
  };
});
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockCollectionGroup = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  collectionGroup: (...args: unknown[]) => mockCollectionGroup(...args),
  Timestamp: {
    now: () => ({ toISOString: () => '2026-11-07T00:00:00.000Z' }),
  },
}));

vi.mock('@/lib/firebase/config', () => ({
  db: { _mockDb: true },
}));

import { verifyPayment, recordManualPayment } from '@/lib/firebase/payments';

describe('Admin Payment Notes & Manual Offline Payment Recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. PaymentRecord Type & Contract', () => {
    it('supports adminNotes, planName, and paymentMode fields', () => {
      const record: PaymentRecord = {
        amount: 2999,
        transactionId: 'UPI-99887766',
        paymentDate: '2026-11-07',
        submittedAt: '2026-11-07T10:00:00Z',
        verifiedAt: '2026-11-07T10:05:00Z',
        verifiedBy: 'admin-001',
        status: 'verified',
        durationGranted: 365,
        notes: 'Annual subscription',
        screenshotUrl: null,
        adminNotes: 'Cheque cleared at SBI, ref #99887766',
        planName: 'Prime Annual',
        paymentMode: 'Cheque',
      };

      expect(record.adminNotes).toBe('Cheque cleared at SBI, ref #99887766');
      expect(record.planName).toBe('Prime Annual');
      expect(record.paymentMode).toBe('Cheque');
    });
  });

  describe('2. verifyPayment with adminNotes', () => {
    it('saves adminNotes to payment document and extends subscription', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          subscriptionExpiry: '2026-11-01', // expired
          referredBy: null,
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await verifyPayment('user-123', 'pay-456', 'admin-789', 30, 'Verified via HDFC IMPS statement');

      // Check payment doc update
      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user-123', 'payments', 'pay-456');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-123/payments/pay-456' }),
        expect.objectContaining({
          status: 'verified',
          verifiedBy: 'admin-789',
          durationGranted: 30,
          adminNotes: 'Verified via HDFC IMPS statement',
        })
      );

      // Check user profile update
      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user-123', 'profile', 'current');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-123/profile/current' }),
        expect.objectContaining({
          subscriptionStatus: 'active',
          subscriptionExpiry: expect.any(String),
          lastPaymentDate: expect.any(String),
        })
      );
    });

    it('does not include adminNotes in updateDoc if undefined', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ subscriptionExpiry: null }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await verifyPayment('user-123', 'pay-456', 'admin-789', 30);

      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall).toHaveProperty('status', 'verified');
      expect(updateCall).not.toHaveProperty('adminNotes');
    });
  });

  describe('3. recordManualPayment', () => {
    it('creates verified payment record with admin notes, mode, plan, and updates profile', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'doc-offline-123' });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          subscriptionExpiry: '2026-12-01', // future expiry
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      const id = await recordManualPayment('admin-007', 'user-abc', {
        amount: 4999,
        transactionId: 'CASH-REC-001',
        durationDays: 180,
        paymentMode: 'Cash',
        adminNotes: 'Cash collected by representative at conference',
        planName: 'Prime Semi-Annual',
      });

      expect(id).toBe('doc-offline-123');

      // Check payment record created
      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'users', 'user-abc', 'payments');
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-abc/payments' }),
        expect.objectContaining({
          amount: 4999,
          transactionId: 'CASH-REC-001',
          status: 'verified',
          durationGranted: 180,
          verifiedBy: 'admin-007',
          paymentMode: 'Cash',
          adminNotes: 'Cash collected by representative at conference',
          planName: 'Prime Semi-Annual',
          screenshotUrl: null,
        })
      );

      // Check profile updated with active subscription
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-abc/profile/current' }),
        expect.objectContaining({
          subscriptionStatus: 'active',
          subscriptionExpiry: expect.any(String),
          lastPaymentDate: expect.any(String),
        })
      );
    });

    it('auto-generates transaction ID if not provided', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'doc-auto-id' });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ subscriptionExpiry: null }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await recordManualPayment('admin-007', 'user-abc', {
        amount: 1999,
        durationDays: 30,
      });

      const addedPayment = mockAddDoc.mock.calls[0][1];
      expect(addedPayment.transactionId).toMatch(/^OFFLINE-\d+$/);
      expect(addedPayment.paymentMode).toBe('Manual');
      expect(addedPayment.status).toBe('verified');
    });
  });

  describe('4. UI Modal & Tab Integration', () => {
    it('VerifyPaymentModal renders Duration and Admin Notes inputs', () => {
      const payment: PaymentRecord = {
        id: 'p-1',
        amount: 1500,
        transactionId: 'TXN-777',
        paymentDate: '2026-11-07',
        submittedAt: '2026-11-07T12:00:00Z',
        verifiedAt: null,
        verifiedBy: null,
        status: 'pending',
        durationGranted: null,
        notes: 'Renewal note',
        screenshotUrl: null,
      };

      const html = renderToStaticMarkup(
        React.createElement(VerifyPaymentModal, {
          payment,
          onConfirm: vi.fn(),
          onCancel: vi.fn(),
        })
      );

      expect(html).toContain('Verify Payment');
      expect(html).toContain('₹1500');
      expect(html).toContain('TXN-777');
      expect(html).toContain('Duration to Grant (days)');
      expect(html).toContain('Admin Notes (Optional)');
    });

    it('RecordOfflinePaymentModal renders presets, modes, and surveyor list', () => {
      const mockSurveyors: SurveyorAdminProfile[] = [
        {
          id: 'srv-1',
          name: 'Jane Valuer',
          email: 'jane@valuers.com',
          licenceNumber: 'SLA-1010',
          subscriptionStatus: 'active',
          subscriptionExpiry: '2026-12-31',
          surveyorId: 'SRV-JANE',
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(RecordOfflinePaymentModal, {
          surveyors: mockSurveyors,
          onClose: vi.fn(),
          onRecord: vi.fn(),
        })
      );

      expect(html).toContain('Record Offline / Manual Payment');
      expect(html).toContain('Jane Valuer');
      expect(html).toContain('30 Days');
      expect(html).toContain('90 Days');
      expect(html).toContain('180 Days');
      expect(html).toContain('365 Days');
      expect(html).toContain('UPI');
      expect(html).toContain('NEFT/Bank');
      expect(html).toContain('Cash');
      expect(html).toContain('Admin Notes');
    });

    it('PaymentsTab renders Record Manual Payment button and shows adminNotes under transaction ID', () => {
      const mockPayments: PaymentRecord[] = [
        {
          id: 'p-rec-1',
          userUid: 'usr-1',
          amount: 2500,
          transactionId: 'OFFLINE-998877',
          paymentDate: '2026-11-07',
          submittedAt: '2026-11-07T10:00:00Z',
          verifiedAt: '2026-11-07T10:05:00Z',
          verifiedBy: 'admin',
          status: 'verified',
          durationGranted: 60,
          notes: 'Special extension',
          adminNotes: 'Cheque received and verified with ICICI',
          paymentMode: 'NEFT/Bank',
          screenshotUrl: null,
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(PaymentsTab, {
          payments: mockPayments,
          surveyors: [],
          loading: false,
          paymentFilter: 'all',
          setPaymentFilter: vi.fn(),
          onVerify: vi.fn(),
          onReject: vi.fn(),
          onOpenRecordModal: vi.fn(),
        })
      );

      expect(html).toContain('Record Manual Payment');
      expect(html).toContain('OFFLINE-998877');
      expect(html).toContain('NEFT/Bank');
      expect(html).toContain('Cheque received and verified with ICICI');
    });

    it('SurveyorsTab displays Payment History & Notes in expanded surveyor drawer', () => {
      const mockSurveyors: SurveyorAdminProfile[] = [
        {
          id: 'usr-1',
          name: 'Robert Valuer',
          email: 'robert@insurer.com',
          licenceNumber: 'SLA-888',
          subscriptionStatus: 'active',
          subscriptionExpiry: '2026-12-31',
          surveyorId: 'SRV-ROB',
        },
      ];

      const mockPayments: PaymentRecord[] = [
        {
          id: 'p-rob-1',
          userUid: 'usr-1',
          amount: 1999,
          transactionId: 'OFFLINE-445566',
          paymentDate: '2026-11-07',
          submittedAt: '2026-11-07T10:00:00Z',
          verifiedAt: '2026-11-07T10:01:00Z',
          verifiedBy: 'admin',
          status: 'verified',
          durationGranted: 30,
          notes: 'Recorded manually',
          adminNotes: 'Cash handed in person at surveyor AGM',
          paymentMode: 'Cash',
          screenshotUrl: null,
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(SurveyorsTab, {
          surveyors: mockSurveyors,
          payments: mockPayments,
          initialExpandedId: 'usr-1',
          loading: false,
          processingId: null,
          searchQuery: '',
          onUpdateStatus: vi.fn(),
          onUpdateExpiry: vi.fn(),
          onUpdateId: vi.fn(),
          onUpdateName: vi.fn(),
          onExtend: vi.fn(),
          onDeleteAccount: vi.fn(),
        })
      );

      expect(html).toContain('Payment History &amp; Notes');
      expect(html).toContain('1 recorded');
      expect(html).toContain('OFFLINE-445566');
      expect(html).toContain('Cash handed in person at surveyor AGM');
      expect(html).toContain('Cash');
    });

    it('SurveyorsTab displays "No payments recorded yet" when surveyor has no payments', () => {
      const mockSurveyors: SurveyorAdminProfile[] = [
        {
          id: 'usr-2',
          name: 'New Surveyor',
          email: 'new@insurer.com',
          licenceNumber: 'SLA-999',
          subscriptionStatus: 'trial',
          subscriptionExpiry: '2026-12-31',
          surveyorId: 'SRV-NEW',
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(SurveyorsTab, {
          surveyors: mockSurveyors,
          payments: [],
          initialExpandedId: 'usr-2',
          loading: false,
          processingId: null,
          searchQuery: '',
          onUpdateStatus: vi.fn(),
          onUpdateExpiry: vi.fn(),
          onUpdateId: vi.fn(),
          onUpdateName: vi.fn(),
          onExtend: vi.fn(),
          onDeleteAccount: vi.fn(),
        })
      );

      expect(html).toContain('Payment History &amp; Notes');
      expect(html).toContain('No payments recorded yet');
    });
  });
});
