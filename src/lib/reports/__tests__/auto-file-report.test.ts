import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClaimData } from '@/types/claim';
import {
  sanitizeReportNo,
  finalSurveyFileName,
  reinspectionFileName,
  uiicFinalFileName,
  spotFeeBillFileName,
  valuationFileName,
  billCheckFileName,
  saveReportToClaimFolder,
  saveGeneratedReportToClaimFolder,
} from '../auto-file-report';
import { getClaimFolderHandle, verifyHandlePermission } from '@/lib/storage/claim-folder-store';
import { saveDocuments } from '@/lib/documents/sink';
import { useClaimStore } from '@/stores/claim-store';

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

describe('auto-file-report naming helpers', () => {
  const claimSlash = { id: 'c1', reportNo: '2026/01' } as ClaimData;
  const claimBackslash = { id: 'c2', reportNo: '2026\\02' } as ClaimData;
  const claimSpecial = { id: 'c3', reportNo: 'REP:2026*03?X"Y<Z>W|9' } as ClaimData;
  const claimEmpty = { id: 'c4', reportNo: '' } as ClaimData;

  it('sanitizeReportNo replaces slashes, backslashes and special characters with underscore', () => {
    expect(sanitizeReportNo('2026/01')).toBe('2026_01');
    expect(sanitizeReportNo('2026\\02')).toBe('2026_02');
    expect(sanitizeReportNo('REP:2026*03?X"Y<Z>W|9')).toBe('REP_2026_03_X_Y_Z_W_9');
    expect(sanitizeReportNo('')).toBe('DRAFT');
    expect(sanitizeReportNo(undefined)).toBe('DRAFT');
  });

  it('finalSurveyFileName produces Final_Survey_Report_<ReportNo>.<ext>', () => {
    expect(finalSurveyFileName(claimSlash)).toBe('Final_Survey_Report_2026_01.html');
    expect(finalSurveyFileName(claimBackslash, 'pdf')).toBe('Final_Survey_Report_2026_02.pdf');
    expect(finalSurveyFileName(claimEmpty)).toBe('Final_Survey_Report_DRAFT.html');
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

  it('billCheckFileName produces Bill_Check_<ReportNo>.<ext>', () => {
    expect(billCheckFileName(claimSlash)).toBe('Bill_Check_2026_01.html');
    expect(billCheckFileName(claimSlash, 'pdf')).toBe('Bill_Check_2026_01.pdf');
  });
});

describe('saveReportToClaimFolder', () => {
  const claim = { id: 'claim-123', reportNo: '2026/01' } as ClaimData;
  const blob = new Blob(['<html>test</html>'], { type: 'text/html' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes file directly to claim directory handle and calls saveDocuments', async () => {
    const mockWritable = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    };
    const mockFileHandle = {
      createWritable: vi.fn(async () => mockWritable),
    };
    const mockDirHandle = {
      getFileHandle: vi.fn(async () => mockFileHandle),
    };

    vi.mocked(getClaimFolderHandle).mockResolvedValue(mockDirHandle as any);
    vi.mocked(verifyHandlePermission).mockResolvedValue(true);

    const success = await saveReportToClaimFolder(claim, 'Final_Survey_Report_2026_01.html', blob, 'surveyReport');

    expect(success).toBe(true);
    expect(getClaimFolderHandle).toHaveBeenCalledWith('claim-123');
    expect(verifyHandlePermission).toHaveBeenCalledWith(mockDirHandle, 'readwrite');
    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('Final_Survey_Report_2026_01.html', { create: true });
    expect(mockFileHandle.createWritable).toHaveBeenCalled();
    expect(mockWritable.write).toHaveBeenCalledWith(blob);
    expect(mockWritable.close).toHaveBeenCalled();
    expect(saveDocuments).toHaveBeenCalledWith(
      'surveyReport',
      [{ blob, name: 'Final_Survey_Report_2026_01.html' }],
      'generated',
      'claim-123'
    );
  });

  it('handles write failure gracefully without throwing and returns false', async () => {
    const mockDirHandle = {
      getFileHandle: vi.fn(async () => {
        throw new Error('Disk full');
      }),
    };

    vi.mocked(getClaimFolderHandle).mockResolvedValue(mockDirHandle as any);
    vi.mocked(verifyHandlePermission).mockResolvedValue(true);

    const success = await saveReportToClaimFolder(claim, 'Final_Survey_Report_2026_01.html', blob, 'surveyReport');
    expect(success).toBe(false);
  });

  it('still calls saveDocuments when no claim folder handle is attached', async () => {
    vi.mocked(getClaimFolderHandle).mockResolvedValue(null);

    const success = await saveReportToClaimFolder(claim, 'Final_Survey_Report_2026_01.html', blob, 'surveyReport');
    expect(success).toBe(true);
    expect(saveDocuments).toHaveBeenCalledWith(
      'surveyReport',
      [{ blob, name: 'Final_Survey_Report_2026_01.html' }],
      'generated',
      'claim-123'
    );
  });
});

describe('saveGeneratedReportToClaimFolder', () => {
  const blob = new Blob(['<html>test</html>'], { type: 'text/html' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to saveReportToClaimFolder when currentClaim matches claimId', async () => {
    const currentClaim = { id: 'claim-matching', reportNo: '2026/01' } as ClaimData;
    vi.mocked(useClaimStore.getState).mockReturnValue({
      currentClaim,
    } as any);

    const mockWritable = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    };
    const mockFileHandle = {
      createWritable: vi.fn(async () => mockWritable),
    };
    const mockDirHandle = {
      getFileHandle: vi.fn(async () => mockFileHandle),
    };
    vi.mocked(getClaimFolderHandle).mockResolvedValue(mockDirHandle as any);
    vi.mocked(verifyHandlePermission).mockResolvedValue(true);

    const res = await saveGeneratedReportToClaimFolder(
      'claim-matching',
      'Final_Survey_Report_2026_01.html',
      blob,
      'surveyReport'
    );

    expect(res).toBe(true);
    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('Final_Survey_Report_2026_01.html', { create: true });
    expect(saveDocuments).toHaveBeenCalledWith(
      'surveyReport',
      [{ blob, name: 'Final_Survey_Report_2026_01.html' }],
      'generated',
      'claim-matching'
    );
  });

  it('writes directly using getClaimFolderHandle when currentClaim does not match claimId', async () => {
    vi.mocked(useClaimStore.getState).mockReturnValue({
      currentClaim: { id: 'different-claim' },
    } as any);

    const mockWritable = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    };
    const mockFileHandle = {
      createWritable: vi.fn(async () => mockWritable),
    };
    const mockDirHandle = {
      getFileHandle: vi.fn(async () => mockFileHandle),
    };
    vi.mocked(getClaimFolderHandle).mockResolvedValue(mockDirHandle as any);
    vi.mocked(verifyHandlePermission).mockResolvedValue(true);

    const res = await saveGeneratedReportToClaimFolder(
      'claim-other',
      'Final_Survey_Report_2026_01.html',
      blob,
      'surveyReport'
    );

    expect(res).toBe(true);
    expect(getClaimFolderHandle).toHaveBeenCalledWith('claim-other');
    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('Final_Survey_Report_2026_01.html', { create: true });
    expect(mockWritable.write).toHaveBeenCalledWith(blob);
    expect(mockWritable.close).toHaveBeenCalled();
  });
});
