import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promptForPrintedPdf } from '../print-followup';
import { toast } from 'sonner';
import { useClaimStore } from '@/stores/claim-store';
import { getStoredRootHandle } from '@/lib/local-sync/directory-handle';
import { getClaimFolderHandle } from '@/lib/storage/claim-folder-store';
import { saveDocuments } from '../sink';

vi.mock('sonner', () => {
  const toastFn = vi.fn();
  (toastFn as any).success = vi.fn();
  (toastFn as any).error = vi.fn();
  (toastFn as any).info = vi.fn();
  (toastFn as any).dismiss = vi.fn();
  return { toast: toastFn };
});

vi.mock('@/stores/claim-store', () => ({
  useClaimStore: {
    getState: vi.fn(),
  },
}));

vi.mock('@/lib/local-sync/directory-handle', () => ({
  getStoredRootHandle: vi.fn(),
}));

vi.mock('@/lib/storage/claim-folder-store', () => ({
  getClaimFolderHandle: vi.fn(),
}));

vi.mock('../sink', () => ({
  saveDocuments: vi.fn().mockResolvedValue([{ id: 'doc-1', name: 'report.pdf' }]),
}));

vi.mock('../folder', () => ({
  getClaimDirHandle: vi.fn().mockResolvedValue({}),
}));

describe('print-followup (promptForPrintedPdf)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).window = {
      showOpenFilePicker: vi.fn(),
    };
  });

  it('shows informative toast when no folder is connected (!hasRoot && !hasClaimFolder)', async () => {
    (useClaimStore.getState as any).mockReturnValue({
      currentClaim: {
        id: 'claim-123',
        vehicle: { registrationNumber: 'MH-12-AB-1234' },
      },
    });
    (getStoredRootHandle as any).mockResolvedValue(null);
    (getClaimFolderHandle as any).mockResolvedValue(null);

    await promptForPrintedPdf('surveyReport');

    expect(toast.info).toHaveBeenCalledWith(
      'Printed Final Survey Report',
      {
        description: 'Connect a claim folder under Documents to auto-file PDF copies directly to your PC.',
        duration: 5000,
      }
    );
    expect(toast).not.toHaveBeenCalled();
  });

  it('shows transparent post-print prompt toast with sanitized registration number when folder is connected', async () => {
    (useClaimStore.getState as any).mockReturnValue({
      currentClaim: {
        id: 'claim-123',
        vehicle: { registrationNumber: 'MH 12 / AB 1234' },
      },
    });
    (getStoredRootHandle as any).mockResolvedValue({} as any);
    (getClaimFolderHandle as any).mockResolvedValue(null);

    await promptForPrintedPdf('surveyReport');

    expect(toast).toHaveBeenCalledWith(
      'Save printed PDF to vehicle folder (MH12_AB1234)',
      expect.objectContaining({
        description: "Downloaded or saved the PDF from Chrome's print window? Select it here to file it directly into this vehicle's claim documents.",
        duration: 6000,
        id: 'print-pdf-surveyReport-claim-123',
        action: expect.objectContaining({
          label: 'Select & Store in Folder',
        }),
      })
    );
  });

  it('omits parentheses in title when vehicle registration number is missing', async () => {
    (useClaimStore.getState as any).mockReturnValue({
      currentClaim: {
        id: 'claim-456',
        vehicle: { registrationNumber: '' },
      },
    });
    (getStoredRootHandle as any).mockResolvedValue(null);
    (getClaimFolderHandle as any).mockResolvedValue({} as any);

    await promptForPrintedPdf('feeBill');

    expect(toast).toHaveBeenCalledWith(
      'Save printed PDF to vehicle folder',
      expect.objectContaining({
        id: 'print-pdf-feeBill-claim-456',
        action: expect.objectContaining({
          label: 'Select & Store in Folder',
        }),
      })
    );
  });

  it('handles picking a PDF file: saves document and shows success toast', async () => {
    const claim = {
      id: 'claim-123',
      vehicle: { registrationNumber: 'MH-12-AB-1234' },
    };
    (useClaimStore.getState as any).mockReturnValue({
      currentClaim: claim,
    });
    (getStoredRootHandle as any).mockResolvedValue({} as any);

    const mockFile = new File(['mock pdf content'], 'MH12AB1234_Final_Survey_Report.pdf', {
      type: 'application/pdf',
    });
    const mockFileHandle = {
      getFile: vi.fn().mockResolvedValue(mockFile),
    };
    (globalThis.window.showOpenFilePicker as any).mockResolvedValue([mockFileHandle]);

    await promptForPrintedPdf('surveyReport');

    // Get the toast call action onClick
    const toastCallArgs = (toast as any).mock.calls[0];
    const options = toastCallArgs[1];
    const onActionClick = options.action.onClick;

    // Trigger the file picker action
    await onActionClick();

    // Verify saveDocuments was called
    expect(saveDocuments).toHaveBeenCalledWith(
      'surveyReport',
      [{ blob: mockFile, name: mockFile.name }],
      'generated'
    );
    // Verify toast.success was shown
    expect(toast.success).toHaveBeenCalledWith(
      'Final Survey Report PDF successfully filed into claim documents!'
    );
    // Verify prompt toast was dismissed
    expect(toast.dismiss).toHaveBeenCalledWith('print-pdf-surveyReport-claim-123');
  });
});
