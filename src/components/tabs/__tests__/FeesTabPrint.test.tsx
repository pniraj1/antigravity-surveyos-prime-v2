import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FeesTab } from '../FeesTab';
import { triggerSpotFeeBillPrint } from '@/lib/reports/spot-fee-bill-builder';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/reports/spot-fee-bill-builder', () => ({
  triggerSpotFeeBillPrint: vi.fn(),
  buildSpotFeeBillHTML: vi.fn().mockReturnValue('<html>Fee Bill</html>'),
}));

vi.mock('@/components/documents/FromPhoneButton', () => ({
  FromPhoneButton: () => <div data-testid="from-phone-button" />,
}));

vi.mock('@/components/shared/ReportPreviewPanel', () => ({
  ReportPreviewPanel: ({ onPrint, printLabel }: any) => {
    (globalThis as any).__testOnPrint = onPrint;
    return (
      <div data-testid="preview-print-panel">
        <span>{printLabel}</span>
      </div>
    );
  },
}));

const mockClaim: any = {
  id: 'claim-1',
  vehicle: {
    registrationNumber: 'MH-12-AB-1234',
    dateOfRegistration: '2020-01-01',
    yearOfManufacture: '2020',
  },
  accident: {
    dateAndTime: '2024-01-01',
  },
  assessmentRows: [],
  depreciationType: 'regular',
  policy: {
    idv: '500000',
  },
  feeBill: {
    professionalFee: 2500,
    riFee: 0,
    distanceKm: 0,
    ratePerKm: 0,
    tollCharges: 0,
    photosCount: 0,
    photoRate: 0,
    postalCharges: 0,
    haltageCharges: 0,
    includeGST: false,
  },
};

vi.mock('@/stores/claim-store', () => ({
  useClaimStore: () => ({
    currentClaim: mockClaim,
    updateFeeBill: vi.fn(),
  }),
}));

vi.mock('@/stores/profile-store', () => ({
  useProfileStore: () => ({
    profile: {
      name: 'Test Surveyor',
      feeSchedule: null,
    },
  }),
}));

describe('FeesTab Print Button Toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders PRINT PDF — FEE BILL button in header and preview panel', () => {
    const html = renderToStaticMarkup(<FeesTab />);
    expect(html).toContain('PRINT PDF — FEE BILL');
    expect(html).toContain('Fee Bill');
  });

  it('shows success toast when live preview onPrint is triggered', () => {
    renderToStaticMarkup(<FeesTab />);
    const onPrint = (globalThis as any).__testOnPrint;
    expect(typeof onPrint).toBe('function');

    onPrint();
    expect(toast.success).toHaveBeenCalledWith('Fee Bill prepared — filing HTML to claim documents.');
    expect(triggerSpotFeeBillPrint).toHaveBeenCalledWith(mockClaim, expect.objectContaining({ name: 'Test Surveyor' }));
  });
});
