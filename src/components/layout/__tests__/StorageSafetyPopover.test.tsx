import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { StorageSafetyPopover } from '../StorageSafetyPopover';

describe('StorageSafetyPopover Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility and Rendering', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <StorageSafetyPopover
          isOpen={false}
          onClose={vi.fn()}
        />
      );
      expect(html).toBe('');
    });

    it('renders the 3 storage tiers: Local Computer Folder, Google Drive, and Cloud Vault', () => {
      const html = renderToStaticMarkup(
        <StorageSafetyPopover
          isOpen={true}
          onClose={vi.fn()}
          claimId="claim-123"
          driveConnected={true}
          driveEmail="surveyor@gmail.com"
          gDriveFolderId="gdrive-folder-456"
          driveQueueCount={0}
          isOnline={true}
        />
      );

      // Tier 1: Local Computer Folder
      expect(html).toContain('Local Computer Folder');
      // Tier 2: Google Drive
      expect(html).toContain('Google Drive');
      // Tier 3: Cloud Vault
      expect(html).toContain('Cloud Vault');
    });
  });

  describe('Local Computer Folder Tier', () => {
    it('shows "Set Folder" when unallocated', () => {
      const html = renderToStaticMarkup(
        <StorageSafetyPopover
          isOpen={true}
          onClose={vi.fn()}
          claimId="claim-123"
          folderPath={null}
        />
      );

      expect(html).toContain('Local Computer Folder');
      expect(html).toContain('Set Folder');
      expect(html).not.toContain('Change Folder');
    });

    it('shows folder path when provided and "Change Folder" action', () => {
      const testPath = 'C:\\Surveys\\MH12AB1234';
      const html = renderToStaticMarkup(
        <StorageSafetyPopover
          isOpen={true}
          onClose={vi.fn()}
          claimId="claim-123"
          folderPath={testPath}
        />
      );

      expect(html).toContain('Local Computer Folder');
      expect(html).toContain('C:\\Surveys\\MH12AB1234');
      expect(html).toContain('Change Folder');
      expect(html).not.toContain('Set Folder');
    });
  });

  describe('Google Drive Tier', () => {
    it('shows connected Google account and link to Drive folder when gDriveFolderId is present', () => {
      const html = renderToStaticMarkup(
        <StorageSafetyPopover
          isOpen={true}
          onClose={vi.fn()}
          claimId="claim-123"
          driveConnected={true}
          driveEmail="expert.surveyor@example.com"
          gDriveFolderId="folder-xyz-789"
        />
      );

      expect(html).toContain('expert.surveyor@example.com');
      expect(html).toContain('https://drive.google.com/drive/folders/folder-xyz-789');
      expect(html).toContain('Open in Drive');
    });

    it('shows pending queue count when files are waiting to upload', () => {
      const html = renderToStaticMarkup(
        <StorageSafetyPopover
          isOpen={true}
          onClose={vi.fn()}
          claimId="claim-123"
          driveConnected={true}
          driveQueueCount={4}
        />
      );

      expect(html).toContain('4 waiting to upload');
    });
  });

  describe('Cloud Vault Tier', () => {
    it('shows backup status text for Cloud Vault', () => {
      const html = renderToStaticMarkup(
        <StorageSafetyPopover
          isOpen={true}
          onClose={vi.fn()}
          claimId="claim-123"
          isOnline={true}
          cloudSyncStatus="saved"
        />
      );

      expect(html).toContain('All text backed up');
    });

    it('shows offline status when disconnected', () => {
      const html = renderToStaticMarkup(
        <StorageSafetyPopover
          isOpen={true}
          onClose={vi.fn()}
          claimId="claim-123"
          isOnline={false}
        />
      );

      expect(html).toContain('Saved to laptop (offline)');
    });
  });

  describe('Sync Now Action', () => {
    it('shows "Sync Now" button and fires onSyncNow when clicked', async () => {
      const onSyncNow = vi.fn();
      let capturedActions: { syncNow: () => Promise<void> | void } | null = null;

      const html = renderToStaticMarkup(
        <StorageSafetyPopover
          isOpen={true}
          onClose={vi.fn()}
          claimId="claim-123"
          onSyncNow={onSyncNow}
          getAction={(actions) => {
            capturedActions = actions;
          }}
        />
      );

      expect(html).toContain('Sync Now');
      expect(capturedActions).not.toBeNull();
      await capturedActions!.syncNow();
      expect(onSyncNow).toHaveBeenCalledTimes(1);
    });

    it('shows loading state when isSaving is true', () => {
      const html = renderToStaticMarkup(
        <StorageSafetyPopover
          isOpen={true}
          onClose={vi.fn()}
          claimId="claim-123"
          isSaving={true}
        />
      );

      expect(html).toContain('Saving...');
    });
  });
});
