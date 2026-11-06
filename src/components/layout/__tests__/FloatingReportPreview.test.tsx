import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { FloatingReportPreview } from '../FloatingReportPreview';
import { BillCheckHeader } from '@/components/tabs/bill-check/BillCheckHeader';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import type { ClaimData, SurveyorProfile } from '@/types';

vi.mock('@/lib/reports/standard-report-builder', () => ({
  buildStandardFinalSurveyHTML: vi.fn(() => '<div>Standard Report</div>'),
}));

vi.mock('@/lib/reports/uiic-final-builder', () => ({
  buildUIICFinalHTML: vi.fn(() => '<div>UIIC Final Report</div>'),
  buildUIICBillCheckHTML: vi.fn(() => '<div>UIIC Bill Check Report</div>'),
}));

vi.mock('@/lib/reports/spot-fee-bill-builder', () => ({
  buildSpotFeeBillHTML: vi.fn(() => '<div>Fee Bill</div>'),
}));

vi.mock('@/stores/claim-store', () => ({
  useClaimStore: Object.assign(
    vi.fn((selector) =>
      selector({
        currentClaim: {
          id: 'c1',
          surveyType: 'final',
          policy: { insurerName: 'National Insurance' },
          vehicle: { registrationNumber: 'MH12AB1234' },
        },
      })
    ),
    {
      getState: () => ({
        currentClaim: {
          id: 'c1',
          surveyType: 'final',
          policy: { insurerName: 'National Insurance' },
        },
      }),
    }
  ),
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: Object.assign(
    vi.fn(() => ({
      activeTab: 'assessment',
    })),
    {
      getState: () => ({
        activeTab: 'assessment',
      }),
    }
  ),
}));

describe('BillCheckHeader', () => {
  it('renders generic "Bill Check Report" title', () => {
    const html = renderToStaticMarkup(
      <BillCheckHeader
        showEvidence={false}
        onToggleEvidence={() => {}}
        bcSummary={{ grandTotalBilled: 10000, netLiability: 9000, notInBillTotal: 1000 }}
        claimId="c1"
        fmt={(n: number) => `₹ ${n}`}
      />
    );

    expect(html).toContain('Bill Check Report');
    expect(html).not.toContain('UIIC Bill Check Report');
  });
});

describe('FloatingReportPreview', () => {
  it('renders Live Preview FAB when closed', () => {
    const html = renderToStaticMarkup(<FloatingReportPreview />);
    expect(html).toContain('Live Preview');
  });

  it('renders Std Bill, UIIC Bill, and no minimise button when open', () => {
    const html = renderToStaticMarkup(<FloatingReportPreview defaultOpen={true} />);
    expect(html).toContain('>Std<');
    expect(html).toContain('>UIIC<');
    expect(html).toContain('>Std Bill<');
    expect(html).toContain('>UIIC Bill<');
    expect(html).toContain('>Fees<');
    expect(html).toContain('Print');
    expect(html).not.toContain('lucide-minus');
    expect(html).not.toContain('Minimise');
  });
});
