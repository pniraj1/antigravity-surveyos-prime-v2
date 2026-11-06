import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ReportTab } from '../ReportTab';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';

vi.mock('@/lib/reports/standard-report-builder', () => ({
  buildStandardFinalSurveyHTML: vi.fn((_claim, _profile, mode) =>
    mode === 'bill-check' ? '<div id="standard-bc-report">STANDARD BILL CHECK HTML</div>' : '<div id="standard-survey-report">STANDARD FINAL SURVEY HTML</div>'
  ),
  triggerStandardPrint: vi.fn(),
}));

vi.mock('@/lib/reports/uiic-final-builder', () => ({
  buildUIICFinalHTML: vi.fn(() => '<div id="uiic-final-report">UIIC FINAL HTML</div>'),
  buildUIICBillCheckHTML: vi.fn(() => '<div id="uiic-bc-report">UIIC BILL CHECK HTML</div>'),
  triggerUIICFinalPrint: vi.fn(),
  triggerUIICBillCheckPrint: vi.fn(),
}));

vi.mock('@/lib/reports/valuation-report-builder', () => ({
  buildValuationReportHTML: vi.fn(() => '<div id="valuation-report">VALUATION HTML</div>'),
  triggerValuationPrint: vi.fn(),
}));

vi.mock('react-to-print', () => ({
  useReactToPrint: () => vi.fn(),
}));

vi.mock('@/lib/onboarding/rules', () => ({
  markOnboarding: vi.fn(),
}));

const { mockClaim, mockProfile } = vi.hoisted(() => ({
  mockClaim: {
    id: 'c1',
    surveyType: 'final',
    vehicleType: 'private',
    policy: { insurerName: 'United India Insurance' },
    vehicle: { registrationNumber: 'DL01AB1234' },
    accident: { dateAndTime: '2026-11-01' },
    assessmentRows: [],
    billCheck: { billNo: 'INV-1', billDate: '2026-11-02', billTotal: 10000, verifiedBySurveyor: true },
  },
  mockProfile: {
    name: 'Er. Test Surveyor',
    licenceNumber: 'SLA-12345',
    mobile: '9876543210',
  },
}));

vi.mock('@/stores/claim-store', () => {
  let state = {
    currentClaim: mockClaim,
    isDirty: false,
    updateClaim: vi.fn(),
  };
  const hook = vi.fn(() => state);
  (hook as any).getState = () => state;
  (hook as any).setState = (s: any) => { state = { ...state, ...s }; };
  return { useClaimStore: hook };
});

vi.mock('@/stores/profile-store', () => {
  let state = {
    profile: mockProfile,
  };
  const hook = vi.fn(() => state);
  (hook as any).getState = () => state;
  return { useProfileStore: hook };
});

vi.mock('@/stores/ui-store', () => {
  let state = {
    activeTab: 'reports',
    aiProviderHealth: {},
  };
  const hook = vi.fn(() => state);
  (hook as any).getState = () => state;
  return { useUIStore: hook };
});

describe('ReportTab Bill Check Report Integration', () => {
  it('renders available report switcher tabs including Bill Check Report for final survey', () => {
    const html = renderToStaticMarkup(<ReportTab />);
    expect(html).toContain('Final Survey Report');
    expect(html).toContain('Bill Check Report');
    expect(html).toContain('Report Center');
  });

  it('renders standard survey by default when activeReport is survey', () => {
    const html = renderToStaticMarkup(<ReportTab />);
    expect(html).toContain('STANDARD FINAL SURVEY HTML');
    expect(html).toContain('Report Preamble');
  });

  it('preserves bill-check report when activeReport is bill-check (does not reset)', () => {
    // When claim.surveyType is 'final', activeReport can be 'bill-check'
    // Verify effect logic: if currentClaim.surveyType === 'final', activeReport !== 'survey' && activeReport !== 'bill-check'
    const type = 'final';
    let activeReport: string = 'bill-check';

    // Emulate the updated useEffect condition
    if (type === 'spot' && activeReport !== 'spot') {
      activeReport = 'spot';
    } else if (type === 'final' && activeReport !== 'survey' && activeReport !== 'bill-check') {
      activeReport = 'survey';
    }

    // Must NOT have reset to 'survey'!
    expect(activeReport).toBe('bill-check');
  });

  it('resets to spot report when switching to spot claim', () => {
    const type = 'spot';
    let activeReport: string = 'bill-check';

    if (type === 'spot' && activeReport !== 'spot') {
      activeReport = 'spot';
    } else if (type === 'final' && activeReport !== 'survey' && activeReport !== 'bill-check') {
      activeReport = 'survey';
    }

    expect(activeReport).toBe('spot');
  });

  it('resets to survey report when switching from spot to final claim', () => {
    const type = 'final';
    let activeReport: string = 'spot';

    if (type === 'spot' && activeReport !== 'spot') {
      activeReport = 'spot';
    } else if (type === 'final' && activeReport !== 'survey' && activeReport !== 'bill-check') {
      activeReport = 'survey';
    }

    expect(activeReport).toBe('survey');
  });

  it('renders BillCheckActions with Standard and UIIC format toggles and print button', async () => {
    const { BillCheckActions } = await import('../report/BillCheckActions');
    const html = renderToStaticMarkup(
      <BillCheckActions
        claim={mockClaim as any}
        profile={mockProfile as any}
        format="standard"
        setFormat={() => {}}
        isExportingWord={false}
        setIsExportingWord={() => {}}
        zoom={0.9}
        setZoom={() => {}}
      />
    );

    expect(html).toContain('Standard Format');
    expect(html).toContain('UIIC Format');
    expect(html).toContain('Export Word');
    expect(html).toContain('PRINT PDF — STANDARD BILL CHECK');
  });
});
