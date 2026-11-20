import { describe, expect, it, vi } from 'vitest';
import type { ClaimData } from '@/types';

const filed = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../auto-file-report', async (orig) => ({
  ...(await orig<typeof import('../auto-file-report')>()),
  saveReportToClaimFolder: filed,
}));
vi.mock('@/lib/documents/print-followup', () => ({ promptForPrintedPdf: vi.fn() }));
vi.mock('../print-shell', async (orig) => ({ ...(await orig<typeof import('../print-shell')>()), openPrintWindow: vi.fn() }));

import { triggerUIICBillCheckPrint } from '../uiic-final-builder';

describe('UIIC bill-check print filing', () => {
  it('files the HTML under the vehicle-first name through saveReportToClaimFolder', () => {
    const claim = {
      id: 'c1',
      reportNo: '7',
      assessmentRows: [],
      depreciationType: 'nil',
      vehicle: { registrationNumber: 'MH12AB1234' },
      policy: {},
      accident: {},
    } as unknown as ClaimData;
    triggerUIICBillCheckPrint(claim, null);
    expect(filed).toHaveBeenCalledWith(claim, 'MH12AB1234_Bill_Check_Report_7.html', expect.any(Blob), 'billCheckReport');
  });
});
