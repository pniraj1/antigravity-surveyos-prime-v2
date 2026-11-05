import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

vi.mock('@/lib/storage/claim-folder-store', () => ({
  isLocalFolderSupported: vi.fn(),
  getClaimFolderHandle: vi.fn(),
  getClaimFolderPath: vi.fn(),
  pickClaimFolder: vi.fn(),
  verifyHandlePermission: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  ClaimFolderButton,
  ClaimFolderButtonView,
  getDisplayFolderName,
} from '../ClaimFolderButton';
import {
  isLocalFolderSupported,
  getClaimFolderHandle,
  getClaimFolderPath,
  pickClaimFolder,
  verifyHandlePermission,
} from '@/lib/storage/claim-folder-store';
import { useClaimStore } from '@/stores/claim-store';
import { toast } from 'sonner';

function createMockHandle(
  name: string,
  permission: 'granted' | 'prompt' | 'denied' = 'granted'
): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => permission),
  } as unknown as FileSystemDirectoryHandle;
}

describe('ClaimFolderButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClaimStore.setState({
      currentClaim: { id: 'claim-abc-123' } as any,
    });
  });

  describe('Helper getDisplayFolderName', () => {
    it('extracts base name from Windows and POSIX paths', () => {
      expect(getDisplayFolderName('C:\\Surveys\\MH12AB1234')).toBe('MH12AB1234');
      expect(getDisplayFolderName('D:/Surveys/DL01XY9999/')).toBe('DL01XY9999');
      expect(getDisplayFolderName('MyFolder')).toBe('MyFolder');
      expect(getDisplayFolderName('')).toBe('');
    });
  });

  describe('1. Unsupported browser state', () => {
    it('Test rendering when unsupported (returns null)', () => {
      vi.mocked(isLocalFolderSupported).mockReturnValue(false);

      const html = renderToStaticMarkup(<ClaimFolderButton />);
      expect(html).toBe('');
    });
  });

  describe('2. Unallocated folder state', () => {
    it('Test rendering "Set Folder" when unallocated', () => {
      vi.mocked(isLocalFolderSupported).mockReturnValue(true);

      const html = renderToStaticMarkup(<ClaimFolderButton />);
      expect(html).toContain('Set Folder');
      expect(html).not.toContain('Grant Folder Access');
    });
  });

  describe('3. Allocated folder with granted permission', () => {
    it('Test rendering folder name when allocated', () => {
      vi.mocked(isLocalFolderSupported).mockReturnValue(true);

      const html = renderToStaticMarkup(
        <ClaimFolderButton
          initialFolderPath="C:/Surveys/MH12AB1234"
          initialPermissionGranted={true}
        />
      );

      expect(html).toContain('MH12AB1234');
      expect(html).not.toContain('Set Folder');
      expect(html).not.toContain('Grant Folder Access');
    });
  });

  describe('4. Clicking to pick folder', () => {
    it('Test clicking to pick folder calls pickClaimFolder', async () => {
      vi.mocked(isLocalFolderSupported).mockReturnValue(true);
      const mockHandle = createMockHandle('MH12AB1234');
      vi.mocked(pickClaimFolder).mockResolvedValueOnce({
        handle: mockHandle,
        folderPath: 'MH12AB1234',
      });

      let clickAction: (() => Promise<void>) | null = null;
      renderToStaticMarkup(
        <ClaimFolderButton getAction={(fn) => { clickAction = fn; }} />
      );

      expect(clickAction).toBeDefined();
      await clickAction!();

      expect(pickClaimFolder).toHaveBeenCalledWith('claim-abc-123');
      expect(toast.success).toHaveBeenCalledWith('Claim folder connected: MH12AB1234');
    });

    it('clicking when folder is already allocated also calls pickClaimFolder to change folder', async () => {
      vi.mocked(isLocalFolderSupported).mockReturnValue(true);
      const oldHandle = createMockHandle('OldFolder');
      const newHandle = createMockHandle('NewFolder');
      vi.mocked(pickClaimFolder).mockResolvedValueOnce({
        handle: newHandle,
        folderPath: 'NewFolder',
      });

      let clickAction: (() => Promise<void>) | null = null;
      renderToStaticMarkup(
        <ClaimFolderButton
          initialHandle={oldHandle}
          initialFolderPath="OldFolder"
          initialPermissionGranted={true}
          getAction={(fn) => { clickAction = fn; }}
        />
      );

      expect(clickAction).toBeDefined();
      await clickAction!();

      expect(pickClaimFolder).toHaveBeenCalledWith('claim-abc-123');
      expect(toast.success).toHaveBeenCalledWith('Claim folder connected: NewFolder');
    });

    it('silently ignores AbortError when surveyor cancels directory picker', async () => {
      vi.mocked(isLocalFolderSupported).mockReturnValue(true);
      const abortErr = new Error('The user aborted a request.');
      abortErr.name = 'AbortError';
      vi.mocked(pickClaimFolder).mockRejectedValueOnce(abortErr);

      let clickAction: (() => Promise<void>) | null = null;
      renderToStaticMarkup(
        <ClaimFolderButton getAction={(fn) => { clickAction = fn; }} />
      );

      await clickAction!();

      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe('5. Lapsed / prompt permission state', () => {
    it('renders "Grant Folder Access" when permission is prompt', () => {
      vi.mocked(isLocalFolderSupported).mockReturnValue(true);

      const html = renderToStaticMarkup(
        <ClaimFolderButton
          initialFolderPath="MH12AB1234"
          initialPermissionGranted={false}
        />
      );

      expect(html).toContain('Grant Folder Access');
      expect(html).not.toContain('Set Folder');
    });

    it('Test clicking "Grant Folder Access" when permission is prompt', async () => {
      vi.mocked(isLocalFolderSupported).mockReturnValue(true);
      const mockHandle = createMockHandle('MH12AB1234', 'prompt');
      vi.mocked(verifyHandlePermission).mockResolvedValueOnce(true);

      let clickAction: (() => Promise<void>) | null = null;
      renderToStaticMarkup(
        <ClaimFolderButton
          initialHandle={mockHandle}
          initialFolderPath="MH12AB1234"
          initialPermissionGranted={false}
          getAction={(fn) => { clickAction = fn; }}
        />
      );

      expect(clickAction).toBeDefined();
      await clickAction!();

      expect(verifyHandlePermission).toHaveBeenCalledWith(mockHandle, 'readwrite');
      expect(toast.success).toHaveBeenCalledWith('Folder access granted');
    });

    it('shows error toast when permission verification is rejected', async () => {
      vi.mocked(isLocalFolderSupported).mockReturnValue(true);
      const mockHandle = createMockHandle('MH12AB1234', 'denied');
      vi.mocked(verifyHandlePermission).mockResolvedValueOnce(false);

      let clickAction: (() => Promise<void>) | null = null;
      renderToStaticMarkup(
        <ClaimFolderButton
          initialHandle={mockHandle}
          initialFolderPath="MH12AB1234"
          initialPermissionGranted={false}
          getAction={(fn) => { clickAction = fn; }}
        />
      );

      await clickAction!();

      expect(verifyHandlePermission).toHaveBeenCalledWith(mockHandle, 'readwrite');
      expect(toast.error).toHaveBeenCalledWith('Folder access was not granted');
    });
  });

  describe('ClaimFolderButtonView pure component', () => {
    it('renders null when supported is false', () => {
      const html = renderToStaticMarkup(
        <ClaimFolderButtonView
          supported={false}
          folderPath={null}
          permissionGranted={false}
          onClick={() => {}}
        />
      );
      expect(html).toBe('');
    });

    it('renders Set Folder when folderPath is null', () => {
      const html = renderToStaticMarkup(
        <ClaimFolderButtonView
          supported={true}
          folderPath={null}
          permissionGranted={false}
          onClick={() => {}}
        />
      );
      expect(html).toContain('Set Folder');
    });

    it('renders Grant Folder Access when folderPath exists but permissionGranted is false', () => {
      const html = renderToStaticMarkup(
        <ClaimFolderButtonView
          supported={true}
          folderPath="C:/Claims/123"
          permissionGranted={false}
          onClick={() => {}}
        />
      );
      expect(html).toContain('Grant Folder Access');
    });

    it('renders folder display name when allocated and permissionGranted is true', () => {
      const html = renderToStaticMarkup(
        <ClaimFolderButtonView
          supported={true}
          folderPath="C:/Claims/MH02CD5678"
          permissionGranted={true}
          onClick={() => {}}
        />
      );
      expect(html).toContain('MH02CD5678');
    });
  });
});
