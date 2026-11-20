import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import * as claimFolderStore from '@/lib/storage/claim-folder-store';
import { importFromDrive } from '@/lib/scan-import/drive-source';
import * as directoryHandle from '@/lib/local-sync/directory-handle';
import { FromPhoneButton, scanResultMessage } from '../FromPhoneButton';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Radix dialogs portal out of static markup; render them inline so the content can be asserted.
vi.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }: any) => <div>{children}</div>;
  return {
    Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
    DialogFooter: Pass,
  };
});

vi.mock('@/lib/drive', () => ({
  loadDriveIndex: vi.fn().mockResolvedValue({}),
  saveDriveIndex: vi.fn().mockResolvedValue(undefined),
  linkGoogleDrive: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/storage/claim-folder-store', () => ({
  isLocalFolderSupported: vi.fn().mockReturnValue(true),
  getClaimFolderHandle: vi.fn().mockResolvedValue(null),
  pickClaimFolder: vi.fn(),
}));

vi.mock('@/lib/local-sync/directory-handle', () => ({
  getStoredRootHandle: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/scan-import/drive-source', () => ({
  importFromDrive: vi.fn().mockResolvedValue({
    result: { status: 'done', added: 2, skipped: 0, failed: 0, contactsFilled: 0 },
    moveFailed: 0,
    mismatched: [],
  }),
}));

vi.mock('@/lib/scan-import/drive-notes', () => ({
  fetchNotesFromScanFolder: vi.fn().mockResolvedValue(null),
  listScanDriveFolders: vi.fn().mockResolvedValue([]),
  formatSyncTime: vi.fn().mockReturnValue('Just now'),
}));

describe('FromPhoneButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(claimFolderStore.isLocalFolderSupported).mockReturnValue(true);
    useClaimStore.setState({
      currentClaim: {
        id: 'claim-123',
        vehicle: { registrationNumber: 'MH02CB1234' },
      } as any,
    });
    useUIStore.setState({
      isDriveConnected: true,
      driveEmail: 'surveyor@example.com',
    });
  });

  it('renders "From Phone" with no Notes/Scans menu', () => {
    const html = renderToStaticMarkup(<FromPhoneButton />);
    expect(html).toContain('From Phone');
    expect(html).not.toContain('aria-haspopup');
    expect(html).not.toContain('Phone Notes');
    expect(html).not.toContain('Phone Scans &amp; Photos');
  });

  it('initialOpen directly opens PhoneFolderPickerDialog without intermediate 3-option modal', () => {
    const html = renderToStaticMarkup(<FromPhoneButton initialOpen />);
    expect(html).toContain('Select Phone Scan Folder');
    expect(html).not.toContain('Choose the zip SurveyOS Scan shared');
    expect(html).not.toContain('From this Computer (.zip)');
    expect(html).toContain('Pick from computer (.zip)');
  });

  it('allows computer file pick via fallback in folder picker dialog and file input', () => {
    vi.mocked(claimFolderStore.isLocalFolderSupported).mockReturnValue(false);
    const html = renderToStaticMarkup(<FromPhoneButton initialOpen />);
    expect(html).toContain('Select Phone Scan Folder');
    expect(html).toContain('Pick from computer (.zip)');
    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".zip"');
  });

  it('respects disabled state when no claim is loaded', () => {
    useClaimStore.setState({ currentClaim: null });
    const html = renderToStaticMarkup(<FromPhoneButton />);
    expect(html).toContain('disabled');
  });

  it('respects explicit disabled prop', () => {
    const html = renderToStaticMarkup(<FromPhoneButton disabled={true} />);
    expect(html).toContain('disabled');
  });

  it('getAction exposes open/close', () => {
    let actions: any = null;
    renderToStaticMarkup(<FromPhoneButton getAction={(a) => { actions = a; }} />);
    expect(typeof actions.open).toBe('function');
    expect(typeof actions.close).toBe('function');
    expect(() => actions.open()).not.toThrow();
  });

  it('when getClaimFolderHandle returns null and onNeedsFolder is provided, calls onNeedsFolder and records pending Drive folder', async () => {
    vi.mocked(claimFolderStore.getClaimFolderHandle).mockResolvedValueOnce(null);
    const onNeedsFolder = vi.fn();
    let actions: any = null;

    renderToStaticMarkup(
      <FromPhoneButton
        onNeedsFolder={onNeedsFolder}
        getAction={(a) => { actions = a; }}
      />
    );

    const mockFolder = {
      id: 'drive-folder-1',
      name: 'MH02CB1234 - NIA',
      vehicle: 'MH02CB1234',
    };

    await actions.handleSelectFolder(mockFolder);

    expect(claimFolderStore.getClaimFolderHandle).toHaveBeenCalledWith('claim-123');
    expect(onNeedsFolder).toHaveBeenCalledTimes(1);
    expect(actions.getPendingDriveFolderId()).toBe('drive-folder-1');
    expect(importFromDrive).not.toHaveBeenCalled();
  });

  it('when getClaimFolderHandle returns null and onNeedsFolder is omitted, triggers prompt dialog (needsFolderOpen)', async () => {
    vi.mocked(claimFolderStore.getClaimFolderHandle).mockResolvedValueOnce(null);
    let actions: any = null;

    renderToStaticMarkup(
      <FromPhoneButton
        getAction={(a) => { actions = a; }}
      />
    );

    const mockFolder = {
      id: 'drive-folder-2',
      name: 'MH02CB1234 - NIA',
      vehicle: 'MH02CB1234',
    };

    await actions.handleSelectFolder(mockFolder);

    expect(claimFolderStore.getClaimFolderHandle).toHaveBeenCalledWith('claim-123');
    expect(actions.isNeedsFolderOpen()).toBe(true);
    expect(actions.getPendingDriveFolderId()).toBe('drive-folder-2');
    expect(importFromDrive).not.toHaveBeenCalled();
  });

  it('resumes pending drive import when folder is allocated', async () => {
    vi.mocked(claimFolderStore.getClaimFolderHandle).mockResolvedValueOnce(null);
    let actions: any = null;

    renderToStaticMarkup(
      <FromPhoneButton
        getAction={(a) => { actions = a; }}
      />
    );

    const mockFolder = {
      id: 'drive-folder-3',
      name: 'MH02CB1234 - NIA',
      vehicle: 'MH02CB1234',
    };

    await actions.handleSelectFolder(mockFolder);
    expect(actions.getPendingDriveFolderId()).toBe('drive-folder-3');

    // Surveyor connects folder, auto-resuming import
    actions.resumePendingImport('claim-123');

    expect(actions.getPendingDriveFolderId()).toBeNull();
    expect(importFromDrive).toHaveBeenCalledWith(expect.anything(), 'drive-folder-3');
  });

  it('when getClaimFolderHandle returns an existing handle, immediately imports from Drive', async () => {
    vi.mocked(claimFolderStore.getClaimFolderHandle).mockResolvedValueOnce({} as any);
    let actions: any = null;

    renderToStaticMarkup(
      <FromPhoneButton
        getAction={(a) => { actions = a; }}
      />
    );

    const mockFolder = {
      id: 'drive-folder-existing',
      name: 'MH02CB1234 - NIA',
      vehicle: 'MH02CB1234',
    };

    await actions.handleSelectFolder(mockFolder);

    expect(importFromDrive).toHaveBeenCalledWith(expect.anything(), 'drive-folder-existing');
    expect(actions.getPendingDriveFolderId()).toBeNull();
  });

  it('older root folder needs no claim folder prompt', async () => {
    vi.mocked(claimFolderStore.getClaimFolderHandle).mockResolvedValueOnce(null);
    vi.mocked(directoryHandle.getStoredRootHandle).mockResolvedValueOnce({} as any);
    const onNeedsFolder = vi.fn();
    let actions: any = null;
    renderToStaticMarkup(<FromPhoneButton onNeedsFolder={onNeedsFolder} getAction={(a) => { actions = a; }} />);
    await actions.handleSelectFolder({ id: 'drive-folder-root', name: 'MH02CB1234 - NIA', vehicle: 'MH02CB1234' });
    expect(importFromDrive).toHaveBeenCalledWith(expect.anything(), 'drive-folder-root');
    expect(onNeedsFolder).not.toHaveBeenCalled();
  });
});

describe('scanResultMessage', () => {
  it('needs-folder with notes says notes came in', () => {
    expect(scanResultMessage({ status: 'needs-folder', notes: { spot: {} } })).toEqual({
      kind: 'info',
      text: 'Documents and photos were not saved: link the claim folder on the Documents tab (desktop Chrome).',
    });
  });
  it('needs-permission with notes says to click Allow access', () => {
    expect(scanResultMessage({ status: 'needs-permission', notes: { spot: {} } })).toEqual({
      kind: 'info',
      text: 'Documents and photos were not saved: click Allow access on the folder line on the Documents tab.',
    });
  });
  it('needs-folder without notes keeps the old error', () => {
    expect(scanResultMessage({ status: 'needs-folder', notes: null })?.kind).toBe('error');
  });
  it('cancelled needs no toast', () => {
    expect(scanResultMessage({ status: 'cancelled' })).toBeNull();
  });
});
