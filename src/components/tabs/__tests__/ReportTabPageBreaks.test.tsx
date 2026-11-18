import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportTab } from '../ReportTab';
import {
  ReportPageSheet,
  splitReportHtml,
  estimatePageCount,
  A4_HEIGHT_PX,
} from '../report/ReportPageSheet';

// Mocks for report builders
const mockBuilders = vi.hoisted(() => ({
  standardReportHtml: '<div id="std-report">STANDARD FINAL SURVEY HTML</div>',
  uiicReportHtml: '<div>UIIC Section 1</div><div style="page-break-before:always;"></div><div>UIIC Section 2</div><div style="page-break-before:always;"></div><div>UIIC Section 3</div>',
  longContinuousReportHtml: '<div style="height: 2400px;"><table>' + '<tr><td>Item</td></tr>'.repeat(25) + '</table></div>',
}));

vi.mock('@/lib/reports/standard-report-builder', () => ({
  buildStandardFinalSurveyHTML: vi.fn(() => mockBuilders.standardReportHtml),
  triggerStandardPrint: vi.fn(),
}));

vi.mock('@/lib/reports/uiic-final-builder', () => ({
  buildUIICFinalHTML: vi.fn(() => mockBuilders.uiicReportHtml),
  buildUIICBillCheckHTML: vi.fn(() => '<div id="uiic-bc">UIIC BC</div>'),
  triggerUIICFinalPrint: vi.fn(),
  triggerUIICBillCheckPrint: vi.fn(),
}));

vi.mock('@/lib/reports/valuation-report-builder', () => ({
  buildValuationReportHTML: vi.fn(() => '<div id="val-report">VALUATION HTML</div>'),
  triggerValuationPrint: vi.fn(),
}));

vi.mock('react-to-print', () => ({
  useReactToPrint: () => vi.fn(),
}));

vi.mock('@/lib/onboarding/rules', () => ({
  markOnboarding: vi.fn(),
}));

const mockClaimState = vi.hoisted(() => ({
  claim: {
    id: 'c1',
    surveyType: 'final' as const,
    vehicleType: 'private' as const,
    policy: { insurerName: 'United India Insurance' },
    vehicle: { registrationNumber: 'DL01AB1234' },
    accident: { dateAndTime: '2026-11-01' },
    assessmentRows: [],
    feeBill: {},
    isCompleted: false,
  },
  profile: {
    name: 'Er. Test Surveyor',
    licenceNumber: 'SLA-12345',
    mobile: '9876543210',
  },
}));

vi.mock('@/stores/claim-store', () => {
  let state = {
    currentClaim: mockClaimState.claim,
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
    profile: mockClaimState.profile,
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

describe('ReportPageSheet & Utility Functions', () => {
  describe('splitReportHtml', () => {
    it('splits HTML by explicit page break divs with various styles', () => {
      const html1 = '<div>Page 1</div><div style="page-break-before:always;"></div><div>Page 2</div>';
      const parts1 = splitReportHtml(html1);
      expect(parts1).toHaveLength(2);
      expect(parts1[0]).toBe('<div>Page 1</div>');
      expect(parts1[1]).toBe('<div>Page 2</div>');

      // With spaces in style
      const html2 = '<div>P1</div><div style="page-break-before: always; "></div><div>P2</div>';
      const parts2 = splitReportHtml(html2);
      expect(parts2).toHaveLength(2);

      // Without trailing semicolon
      const html3 = '<div>P1</div><div style="page-break-before:always"></div><div>P2</div>';
      const parts3 = splitReportHtml(html3);
      expect(parts3).toHaveLength(2);
    });

    it('returns single array item when no explicit page break is present', () => {
      const html = '<div>Single Continuous Page</div>';
      const parts = splitReportHtml(html);
      expect(parts).toHaveLength(1);
      expect(parts[0]).toBe(html);
    });

    it('handles empty string gracefully', () => {
      expect(splitReportHtml('')).toEqual(['']);
      expect(splitReportHtml('   ')).toEqual(['']);
    });
  });

  describe('estimatePageCount', () => {
    it('returns 1 for short normal content', () => {
      expect(estimatePageCount('<p>Short report</p>')).toBe(1);
    });

    it('estimates page count from explicit pixel height in style', () => {
      // 2400px / 1122.5 ≈ 2.13 -> 3 pages
      const html = '<div style="height: 2400px;">Content</div>';
      expect(estimatePageCount(html)).toBe(3);
    });

    it('estimates page count from explicit data-page-count attribute', () => {
      const html = '<div data-page-count="4">Content</div>';
      expect(estimatePageCount(html)).toBe(4);
    });

    it('estimates page count from table row count (18+ rows)', () => {
      // 36 rows -> 2 pages
      const html = '<table>' + '<tr><td>Row</td></tr>'.repeat(36) + '</table>';
      expect(estimatePageCount(html)).toBe(2);
    });
  });

  describe('ReportPageSheet rendering', () => {
    it('renders standard A4 dimensions, page badge, and content', () => {
      const html = renderToStaticMarkup(
        <ReportPageSheet
          sheetIndex={0}
          startPage={1}
          totalPages={3}
          isDraft={false}
          htmlContent="<p>Test Section</p>"
        />
      );

      expect(html).toContain('Page 1 of 3');
      expect(html).toContain('A4 Physical Sheet 1');
      expect(html).toContain('width:210mm');
      expect(html).toContain('min-height:297mm');
      expect(html).toContain('padding:10mm 12mm');
      expect(html).toContain('Test Section');
      // No draft watermark when isDraft is false
      expect(html).not.toContain('DRAFT');
    });

    it('renders DRAFT watermark when isDraft is true', () => {
      const html = renderToStaticMarkup(
        <ReportPageSheet
          sheetIndex={0}
          startPage={1}
          totalPages={1}
          isDraft={true}
          htmlContent="<p>Draft Document</p>"
        />
      );

      expect(html).toContain('DRAFT');
      expect(html).toContain('rotate(-45deg)');
    });

    it('renders visible page cut lines when sheet content spans multiple pages', () => {
      const html = renderToStaticMarkup(
        <ReportPageSheet
          sheetIndex={0}
          startPage={1}
          totalPages={2}
          isDraft={false}
          initialPageCount={2}
          htmlContent="<div style='height: 2000px;'>Long Content</div>"
        />
      );

      // Verify the dashed cut line and labels
      expect(html).toContain('page-cut-line');
      expect(html).toContain('✂️ Page Break (End of Page 1)');
      expect(html).toContain('[ Page 2 Starts Below ↓ ]');
      expect(html).toContain('calc(297mm * 1)');
      expect(html).toContain('min-height:calc(297mm * 2)');
    });
  });
});

describe('ReportTab Multi-Page A4 Break Integration', () => {
  beforeEach(() => {
    mockClaimState.claim.isCompleted = false;
    mockBuilders.standardReportHtml = '<div id="std-report">STANDARD FINAL SURVEY HTML</div>';
  });

  it('renders multi-page splitting when explicit page breaks are present (UIIC format)', () => {
    // Set format to UIIC via mocked buildStandardFinalSurveyHTML with explicit breaks
    mockBuilders.standardReportHtml =
      '<div>Section 1</div>' +
      '<div style="page-break-before:always;"></div>' +
      '<div>Section 2</div>' +
      '<div style="page-break-before:always;"></div>' +
      '<div>Section 3</div>';

    const html = renderToStaticMarkup(<ReportTab />);

    // Verify all 3 pages are rendered as physical sheets with distinct page badges
    expect(html).toContain('Page 1 of 3');
    expect(html).toContain('Page 2 of 3');
    expect(html).toContain('Page 3 of 3');

    // Verify total pages badge in header & toolbar
    expect(html).toContain('📄 3 A4 Pages');

    // Verify dark neutral PDF viewer canvas background
    expect(html).toContain('background:#525659');
  });

  it('renders single continuous report with page cut line indicators when overflowing A4 height', () => {
    // Mock a continuous standard report with style height triggering 2 pages
    mockBuilders.standardReportHtml =
      '<div style="height: 2000px;">' +
      '<h2>Standard Final Survey Report</h2>' +
      '<table>' + '<tr><td>Part item</td></tr>'.repeat(25) + '</table>' +
      '</div>';

    const html = renderToStaticMarkup(<ReportTab />);

    // Verify total pages badge reflects 2 pages
    expect(html).toContain('📄 2 A4 Pages');
    expect(html).toContain('Page 1 of 2');

    // Verify visible cut line indicator is present
    expect(html).toContain('✂️ Page Break (End of Page 1)');
    expect(html).toContain('[ Page 2 Starts Below ↓ ]');
  });

  it('renders DRAFT watermark when claim is incomplete and omits it when complete', () => {
    mockClaimState.claim.isCompleted = false;
    let html = renderToStaticMarkup(<ReportTab />);
    expect(html).toContain('DRAFT');

    // Now complete the claim
    mockClaimState.claim.isCompleted = true;
    html = renderToStaticMarkup(<ReportTab />);
    expect(html).not.toContain('DRAFT');
  });
});
