import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClaimData } from '@/types/claim';
import {
  sanitizeRegNo,
  sanitizeReportNo,
  finalSurveyFileName,
  reinspectionFileName,
  uiicFinalFileName,
  spotFeeBillFileName,
  valuationFileName,
  billCheckFileName,
  saveReportToClaimFolder,
} from '../auto-file-report';
import { getClaimFolderHandle } from '@/lib/storage/claim-folder-store';
import { saveDocuments } from '@/lib/documents/sink';
import { useUIStore } from '@/stores/ui-store';
import { uploadFileToDrive } from '@/lib/drive';

vi.mock('@/lib/storage/claim-folder-store', () => ({
  getClaimFolderHandle: vi.fn(),
  verifyHandlePermission: vi.fn(async () => true),
}));

vi.mock('@/lib/documents/sink', () => ({
  saveDocuments: vi.fn(async () => []),
}));

vi.mock('@/stores/claim-store', () => ({
  useClaimStore: {
    getState: vi.fn(() => ({
      currentClaim: null,
    })),
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: {
    getState: vi.fn(() => ({
      isDriveConnected: false,
    })),
  },
}));

vi.mock('@/lib/drive', () => ({
  uploadFileToDrive: vi.fn(async () => {}),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe('auto-file-report naming helpers', () => {
  const claimSlash = { id: 'c1', reportNo: '2026/01' } as ClaimData;
  const claimBackslash = { id: 'c2', reportNo: '2026\\02' } as ClaimData;
  const claimSpecial = { id: 'c3', reportNo: 'REP:2026*03?X"Y<Z>W|9' } as ClaimData;
  const claimEmpty = { id: 'c4', reportNo: '' } as ClaimData;

  const claimWithVehicle = {
    id: 'c5',
    reportNo: '2026/01',
    vehicle: { registrationNumber: 'MH 12 AB 1234' },
  } as unknown as ClaimData;

  const claimWithHyphenReg = {
    id: 'c6',
    reportNo: '2026/02',
    vehicle: { registrationNumber: 'MH-12-AB-1234' },
  } as unknown as ClaimData;

  const claimWithEmptyReg = {
    id: 'c7',
    reportNo: '2026/03',
    vehicle: { registrationNumber: '   ' },
  } as unknown as ClaimData;

  const claimWithUndefinedReg = {
    id: 'c8',
    reportNo: '2026/04',
    vehicle: {},
  } as unknown as ClaimData;

  describe('sanitizeRegNo', () => {
    it('returns empty string for undefined, empty, or whitespace-only inputs', () => {
      expect(sanitizeRegNo(undefined)).toBe('');
      expect(sanitizeRegNo('')).toBe('');
      expect(sanitizeRegNo('   ')).toBe('');
      expect(sanitizeRegNo('\t\n')).toBe('');
    });

    it('trims, uppercases and strips spaces cleanly', () => {
      expect(sanitizeRegNo('  mh 12 ab 1234  ')).toBe('MH12AB1234');
      expect(sanitizeRegNo('dl 01 ab 1234')).toBe('DL01AB1234');
      expect(sanitizeRegNo('MH 12 AB 1234')).toBe('MH12AB1234');
    });

    it('preserves hyphens and clean alphanumerics', () => {
      expect(sanitizeRegNo('MH-12-AB-1234')).toBe('MH-12-AB-1234');
      expect(sanitizeRegNo('dl-04-ty-5678')).toBe('DL-04-TY-5678');
    });

    it('replaces filesystem illegal characters (/\:*?"<>|) with underscores', () => {
      expect(sanitizeRegNo('MH:12/AB*1234')).toBe('MH_12_AB_1234');
      expect(sanitizeRegNo('KA?01<CD>5678')).toBe('KA_01_CD_5678');
      expect(sanitizeRegNo('DL|01"EF\\1234')).toBe('DL_01_EF_1234');
    });
  });

  describe('sanitizeReportNo', () => {
    it('sanitizeReportNo replaces slashes, backslashes and special characters with underscore', () => {
      expect(sanitizeReportNo('2026/01')).toBe('2026_01');
      expect(sanitizeReportNo('2026\\02')).toBe('2026_02');
      expect(sanitizeReportNo('REP:2026*03?X"Y<Z>W|9')).toBe('REP_2026_03_X_Y_Z_W_9');
      expect(sanitizeReportNo('')).toBe('DRAFT');
      expect(sanitizeReportNo(undefined)).toBe('DRAFT');
    });
  });

  describe('without vehicle registration (backwards compatibility)', () => {
    it('finalSurveyFileName produces Final_Survey_Report_<ReportNo>.<ext>', () => {
      expect(finalSurveyFileName(claimSlash)).toBe('Final_Survey_Report_2026_01.html');
      expect(finalSurveyFileName(claimBackslash, 'pdf')).toBe('Final_Survey_Report_2026_02.pdf');
      expect(finalSurveyFileName(claimEmpty)).toBe('Final_Survey_Report_DRAFT.html');
      expect(finalSurveyFileName(claimWithEmptyReg)).toBe('Final_Survey_Report_2026_03.html');
      expect(finalSurveyFileName(claimWithUndefinedReg)).toBe('Final_Survey_Report_2026_04.html');
    });

    it('reinspectionFileName produces Reinspection_Report_<ReportNo>.<ext>', () => {
      expect(reinspectionFileName(claimSlash)).toBe('Reinspection_Report_2026_01.html');
      expect(reinspectionFileName(claimBackslash, 'pdf')).toBe('Reinspection_Report_2026_02.pdf');
    });

    it('uiicFinalFileName produces UIIC_Final_Survey_Report_<ReportNo>.<ext>', () => {
      expect(uiicFinalFileName(claimSlash)).toBe('UIIC_Final_Survey_Report_2026_01.html');
      expect(uiicFinalFileName(claimSpecial, 'html')).toBe('UIIC_Final_Survey_Report_REP_2026_03_X_Y_Z_W_9.html');
    });

    it('spotFeeBillFileName produces Spot_Fee_Bill_<ReportNo>.<ext>', () => {
      expect(spotFeeBillFileName(claimSlash)).toBe('Spot_Fee_Bill_2026_01.html');
      expect(spotFeeBillFileName(claimBackslash, 'pdf')).toBe('Spot_Fee_Bill_2026_02.pdf');
    });

    it('valuationFileName produces Valuation_Report_<ReportNo>.<ext>', () => {
      expect(valuationFileName(claimSlash)).toBe('Valuation_Report_2026_01.html');
      expect(valuationFileName(claimSlash, 'pdf')).toBe('Valuation_Report_2026_01.pdf');
    });

    it('billCheckFileName produces Bill_Check_Report_<ReportNo>.<ext>', () => {
      expect(billCheckFileName(claimSlash)).toBe('Bill_Check_Report_2026_01.html');
      expect(billCheckFileName(claimSlash, 'pdf')).toBe('Bill_Check_Report_2026_01.pdf');
    });
  });

  describe('with vehicle registration', () => {
    it('prepends sanitized vehicle registration number to finalSurveyFileName', () => {
      expect(finalSurveyFileName(claimWithVehicle)).toBe('MH12AB1234_Final_Survey_Report_2026_01.html');
      expect(finalSurveyFileName(claimWithHyphenReg, 'pdf')).toBe('MH-12-AB-1234_Final_Survey_Report_2026_02.pdf');
    });

    it('prepends sanitized vehicle registration number to reinspectionFileName', () => {
      expect(reinspectionFileName(claimWithVehicle)).toBe('MH12AB1234_Reinspection_Report_2026_01.html');
      expect(reinspectionFileName(claimWithHyphenReg, 'pdf')).toBe('MH-12-AB-1234_Reinspection_Report_2026_02.pdf');
    });

    it('prepends sanitized vehicle registration number to uiicFinalFileName', () => {
      expect(uiicFinalFileName(claimWithVehicle)).toBe('MH12AB1234_UIIC_Final_Survey_Report_2026_01.html');
      expect(uiicFinalFileName(claimWithHyphenReg, 'pdf')).toBe('MH-12-AB-1234_UIIC_Final_Survey_Report_2026_02.pdf');
    });

    it('prepends sanitized vehicle registration number to spotFeeBillFileName', () => {
      expect(spotFeeBillFileName(claimWithVehicle)).toBe('MH12AB1234_Spot_Fee_Bill_2026_01.html');
      expect(spotFeeBillFileName(claimWithHyphenReg, 'pdf')).toBe('MH-12-AB-1234_Spot_Fee_Bill_2026_02.pdf');
    });

    it('prepends sanitized vehicle registration number to valuationFileName', () => {
      expect(valuationFileName(claimWithVehicle)).toBe('MH12AB1234_Valuation_Report_2026_01.html');
      expect(valuationFileName(claimWithHyphenReg, 'pdf')).toBe('MH-12-AB-1234_Valuation_Report_2026_02.pdf');
    });

    it('prepends sanitized vehicle registration number to billCheckFileName', () => {
      expect(billCheckFileName(claimWithVehicle)).toBe('MH12AB1234_Bill_Check_Report_2026_01.html');
      expect(billCheckFileName(claimWithHyphenReg, 'pdf')).toBe('MH-12-AB-1234_Bill_Check_Report_2026_02.pdf');
    });
  });
});

describe('saveReportToClaimFolder', () => {
  const claim = {
    id: 'claim-123',
    reportNo: '2026/01',
    vehicle: { registrationNumber: 'MH 12 AB 1234' },
  } as ClaimData;
  const blob = new Blob(['<html>test</html>'], { type: 'text/html' });
  const name = 'MH12AB1234_Final_Survey_Report_1.html';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUIStore.getState).mockReturnValue({ isDriveConnected: false } as any);
  });

  it('writes the report only through the sink', async () => {
    const mockDirHandle = { name: 'MH12AB1234 - NIA', getFileHandle: vi.fn() };
    vi.mocked(getClaimFolderHandle).mockResolvedValue(mockDirHandle as any);

    const success = await saveReportToClaimFolder(claim, name, blob, 'surveyReport');

    expect(success).toBe(true);
    expect(mockDirHandle.getFileHandle).not.toHaveBeenCalled();
    expect(saveDocuments).toHaveBeenCalledTimes(1);
    expect(saveDocuments).toHaveBeenCalledWith(
      'surveyReport',
      [{ blob, name, keepName: true }],
      'generated',
      'claim-123'
    );
  });

  it('calls uploadFileToDrive with vehicle registration when isDriveConnected is true', async () => {
    vi.mocked(useUIStore.getState).mockReturnValue({ isDriveConnected: true } as any);
    expect(await saveReportToClaimFolder(claim, name, blob, 'surveyReport')).toBe(true);
    expect(uploadFileToDrive).toHaveBeenCalledWith('claim-123', name, blob, 'MH 12 AB 1234');
  });

  it('calls uploadFileToDrive falling back to claim.id when vehicle registration is missing', async () => {
    vi.mocked(useUIStore.getState).mockReturnValue({ isDriveConnected: true } as any);
    const claimNoVehicle = { id: 'claim-999', reportNo: '2026/02' } as ClaimData;
    expect(await saveReportToClaimFolder(claimNoVehicle, 'R_2.html', blob, 'surveyReport')).toBe(true);
    expect(uploadFileToDrive).toHaveBeenCalledWith('claim-999', 'R_2.html', blob, 'claim-999');
  });

  it('does not call uploadFileToDrive when isDriveConnected is false', async () => {
    expect(await saveReportToClaimFolder(claim, name, blob, 'surveyReport')).toBe(true);
    expect(uploadFileToDrive).not.toHaveBeenCalled();
  });

  it('returns false when the sink fails, and when the claim is missing', async () => {
    vi.mocked(saveDocuments).mockRejectedValueOnce(new Error('Disk full'));
    expect(await saveReportToClaimFolder(claim, name, blob, 'surveyReport')).toBe(false);
    expect(await saveReportToClaimFolder({} as any, 'file.html', blob)).toBe(false);
  });
});
