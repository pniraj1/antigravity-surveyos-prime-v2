import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OICExportDialog } from '../OICExportDialog';
import type { AssessmentRow } from '@/types/assessment';
import type { ClaimData } from '@/types/claim';

vi.mock('@/lib/reports/oic-assessment-excel', () => ({
  exportOicAssessmentExcel: vi.fn(),
  oicAssessmentRows: vi.fn().mockReturnValue([
    {
      invoiceNumber: 'INV-01',
      itemDescription: 'Plastic',
      itemSubType: 'Bumper',
      itemAmount: 5000,
      depreciationRate: 50,
      gstRate: 18,
      estimatedAmount: 5000,
      hsnCode: '8512',
    },
  ]),
  oicPaintingSummary: vi.fn().mockReturnValue({
    totalEstimated: 4000,
    totalAssessed: 4000,
    labourPart: 3000,
    materialPart: 1000,
    materialDepreciation: 500,
    netAssessed: 3500,
  }),
}));

vi.mock('@/lib/portal/extension-bridge', () => ({
  isExtensionPresent: vi.fn().mockReturnValue(false),
  sendPacketToExtension: vi.fn(),
  readyLine: vi.fn(),
  NOT_INSTALLED_LINE: 'Install SurveyOS extension to send directly to portal.',
}));

const mockClaim: Partial<ClaimData> = {
  id: 'claim-123',
  policy: {
    claimNumber: 'OIC/2026/001',
    policyNumber: 'P123',
    insuranceCompany: 'Oriental Insurance',
  } as any,
  repairer: {
    name: 'Auto Garage',
    estimateNumber: 'EST-99',
    estimateDate: '2026-10-15',
  } as any,
};

const mockRows: AssessmentRow[] = [
  {
    id: 'r1',
    particulars: 'Bumper',
    estimated: 5000,
    assessed: 5000,
    billedTaxable: 5000,
    partType: 'plastic',
    gst: 18,
    section: 'parts',
    allowed: true,
  },
];

describe('OICExportDialog Component', () => {
  it('renders dialog header, bill check gate, and policy type subtitle', () => {
    const html = renderToStaticMarkup(
      <OICExportDialog
        claim={mockClaim as ClaimData}
        claimNo="OIC/2026/001"
        rows={mockRows}
        ageMonths={24}
        depType="standard"
        onClose={() => {}}
      />,
    );

    expect(html).toContain('Oriental Insurance — Assessment Upload');
    expect(html).toContain('Standard policy');
    expect(html).toContain('Bill amounts verified and bill check complete');
  });

  it('reflects nil depreciation in subtitle for nil dep claims', () => {
    const html = renderToStaticMarkup(
      <OICExportDialog
        claim={mockClaim as ClaimData}
        claimNo="OIC/2026/001"
        rows={mockRows}
        ageMonths={24}
        depType="nil"
        onClose={() => {}}
      />,
    );

    expect(html).toContain('Nil Depreciation policy');
  });
});
