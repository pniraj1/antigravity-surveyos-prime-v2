import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ClaimHeader } from '../ClaimHeader';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/storage/indexeddb', () => ({
  getDriveQueueCount: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/storage/claim-folder-store', () => ({
  isLocalFolderSupported: vi.fn().mockReturnValue(true),
  getClaimFolderHandle: vi.fn().mockResolvedValue(null),
  getClaimFolderPath: vi.fn().mockResolvedValue(null),
  pickClaimFolder: vi.fn(),
  verifyHandlePermission: vi.fn(),
}));

describe('ClaimHeader Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClaimStore.setState({
      currentClaim: {
        id: 'claim-123',
        reportNo: 'SURV/2026/001',
        vehicle: { registrationNumber: 'MH12AB1234' },
        policy: { insuredName: 'Rahul Sharma' },
        gDriveFolderId: 'gdrive-folder-123',
      } as any,
    });
    useAuthStore.setState({
      user: { uid: 'user-123', email: 'surveyor@example.com' } as any,
    });
    useUIStore.setState({
      isOnline: true,
      saveStatus: 'saved',
      isDriveConnected: true,
      driveEmail: 'surveyor@example.com',
    });
  });

  it('renders unified Status Pill with "All Changes Saved" when online and synced', () => {
    const html = renderToStaticMarkup(<ClaimHeader />);

    expect(html).toContain('All Changes Saved');
    expect(html).toContain('SURV/2026/001');
    expect(html).toContain('MH12AB1234');
    expect(html).toContain('Rahul Sharma');
  });

  it('renders "Saved to Laptop" when offline', () => {
    useUIStore.setState({ isOnline: false });

    const html = renderToStaticMarkup(<ClaimHeader />);

    expect(html).toContain('Saved to Laptop');
    expect(html).not.toContain('All Changes Saved');
  });

  it('renders "Saving..." when saveStatus is saving', () => {
    useUIStore.setState({ saveStatus: 'saving' });

    const html = renderToStaticMarkup(<ClaimHeader />);

    expect(html).toContain('Saving...');
  });

  it('maintains ClaimFolderButton for direct folder access', () => {
    const html = renderToStaticMarkup(<ClaimHeader />);

    expect(html).toContain('Set Folder');
  });
});
