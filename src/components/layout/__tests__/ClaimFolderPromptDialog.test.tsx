import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

vi.mock('@/lib/storage/claim-folder-store', () => ({
  pickClaimFolder: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  ClaimFolderPromptDialog,
  type ClaimFolderPromptDialogProps,
} from '../ClaimFolderPromptDialog';
import { pickClaimFolder } from '@/lib/storage/claim-folder-store';
import { useClaimStore } from '@/stores/claim-store';
import { toast } from 'sonner';

function createMockHandle(name: string): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    queryPermission: vi.fn(async () => 'granted'),
    requestPermission: vi.fn(async () => 'granted'),
  } as unknown as FileSystemDirectoryHandle;
}

describe('ClaimFolderPromptDialog Component', () => {
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).window = {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    useClaimStore.setState({
      currentClaim: { id: 'claim-xyz-789' } as any,
    });
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  describe('Visibility and Rendering', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <ClaimFolderPromptDialog isOpen={false} onClose={vi.fn()} />
      );
      expect(html).toBe('');
    });

    it('renders dialog elements when isOpen is true', () => {
      const html = renderToStaticMarkup(
        <ClaimFolderPromptDialog
          isOpen={true}
          onClose={vi.fn()}
          claimId="claim-xyz-789"
          registrationNumber="MH04EF5678"
        />
      );

      expect(html).toContain('Where should this claim&#x27;s files be kept?');
      expect(html).toContain('MH04EF5678');
      expect(html).toContain('Select Folder for this Claim');
      expect(html).toContain('Skip for now');
    });

    it('falls back to "this claim" when registrationNumber is not provided', () => {
      const html = renderToStaticMarkup(
        <ClaimFolderPromptDialog
          isOpen={true}
          onClose={vi.fn()}
          claimId="claim-xyz-789"
        />
      );

      expect(html).toContain('Where should this claim&#x27;s files be kept?');
      expect(html).toContain('this claim');
      expect(html).toContain('to auto-save phone scans, RC/DL uploads');
    });
  });

  describe('User Actions', () => {
    it('invokes pickClaimFolder and calls onAllocated & onClose on success', async () => {
      const mockHandle = createMockHandle('MH04EF5678');
      vi.mocked(pickClaimFolder).mockResolvedValueOnce({
        handle: mockHandle,
        folderPath: 'MH04EF5678',
      });

      const onClose = vi.fn();
      const onAllocated = vi.fn();
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      let capturedActions: {
        handlePickFolder: () => Promise<void>;
        handleSkip: () => void;
      } | null = null;

      renderToStaticMarkup(
        <ClaimFolderPromptDialog
          isOpen={true}
          onClose={onClose}
          claimId="claim-xyz-789"
          registrationNumber="MH04EF5678"
          onAllocated={onAllocated}
          getAction={(actions) => {
            capturedActions = actions;
          }}
        />
      );

      expect(capturedActions).not.toBeNull();
      await capturedActions!.handlePickFolder();

      expect(pickClaimFolder).toHaveBeenCalledWith('claim-xyz-789');
      expect(toast.success).toHaveBeenCalledWith('Claim folder connected: MH04EF5678');
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'surveyos:claim-folder-updated',
          detail: { claimId: 'claim-xyz-789' },
        })
      );
      expect(onAllocated).toHaveBeenCalledWith(mockHandle);
      expect(onClose).toHaveBeenCalled();
    });

    it('silently ignores user cancellation (AbortError)', async () => {
      const abortErr = new Error('The user aborted a request.');
      abortErr.name = 'AbortError';
      vi.mocked(pickClaimFolder).mockRejectedValueOnce(abortErr);

      const onClose = vi.fn();
      const onAllocated = vi.fn();

      let capturedActions: {
        handlePickFolder: () => Promise<void>;
        handleSkip: () => void;
      } | null = null;

      renderToStaticMarkup(
        <ClaimFolderPromptDialog
          isOpen={true}
          onClose={onClose}
          claimId="claim-xyz-789"
          onAllocated={onAllocated}
          getAction={(actions) => {
            capturedActions = actions;
          }}
        />
      );

      await capturedActions!.handlePickFolder();

      expect(toast.error).not.toHaveBeenCalled();
      expect(onAllocated).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('displays error toast when folder selection fails unexpectedly', async () => {
      const err = new Error('Disk read error');
      vi.mocked(pickClaimFolder).mockRejectedValueOnce(err);

      const onClose = vi.fn();

      let capturedActions: {
        handlePickFolder: () => Promise<void>;
        handleSkip: () => void;
      } | null = null;

      renderToStaticMarkup(
        <ClaimFolderPromptDialog
          isOpen={true}
          onClose={onClose}
          claimId="claim-xyz-789"
          getAction={(actions) => {
            capturedActions = actions;
          }}
        />
      );

      await capturedActions!.handlePickFolder();

      expect(toast.error).toHaveBeenCalledWith('Failed to select folder');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('handles Skip for now by invoking onClose', () => {
      const onClose = vi.fn();

      let capturedActions: {
        handlePickFolder: () => Promise<void>;
        handleSkip: () => void;
      } | null = null;

      renderToStaticMarkup(
        <ClaimFolderPromptDialog
          isOpen={true}
          onClose={onClose}
          claimId="claim-xyz-789"
          getAction={(actions) => {
            capturedActions = actions;
          }}
        />
      );

      expect(capturedActions).not.toBeNull();
      capturedActions!.handleSkip();

      expect(onClose).toHaveBeenCalled();
    });

    it('alerts if no claim ID is provided or in store', async () => {
      useClaimStore.setState({ currentClaim: null });

      let capturedActions: {
        handlePickFolder: () => Promise<void>;
        handleSkip: () => void;
      } | null = null;

      renderToStaticMarkup(
        <ClaimFolderPromptDialog
          isOpen={true}
          onClose={vi.fn()}
          claimId={undefined}
          getAction={(actions) => {
            capturedActions = actions;
          }}
        />
      );

      await capturedActions!.handlePickFolder();

      expect(pickClaimFolder).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('No claim selected');
    });
  });
});
