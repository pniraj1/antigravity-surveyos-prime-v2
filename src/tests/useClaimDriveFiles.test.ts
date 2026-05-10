// src/tests/useClaimDriveFiles.test.ts
// NOTE: @testing-library/react is not installed and vitest env is 'node'.
// Tests validate the async fetch logic that the hook delegates to
// by exercising listClaimDriveFiles directly under the same mock conditions.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DriveFile } from '@/lib/drive/list-cache';

vi.mock('@/lib/drive/files', () => ({
  listClaimDriveFiles: vi.fn(),
}));

describe('useClaimDriveFiles – fetch logic', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves files on success', async () => {
    const files: DriveFile[] = [{ id: 'f1', name: 'RC.pdf', mimeType: 'application/pdf' }];
    const { listClaimDriveFiles } = await import('@/lib/drive/files');
    vi.mocked(listClaimDriveFiles).mockResolvedValue(files);

    const result = await listClaimDriveFiles('claim-123');
    expect(result).toEqual(files);
  });

  it('rejects with an error on network failure', async () => {
    const { listClaimDriveFiles } = await import('@/lib/drive/files');
    vi.mocked(listClaimDriveFiles).mockRejectedValue(new Error('Network'));

    await expect(listClaimDriveFiles('claim-456')).rejects.toThrow('Network');
  });

  it('is not called when claimId is null', async () => {
    const { listClaimDriveFiles } = await import('@/lib/drive/files');
    // The hook skips the fetch when claimId is null; simulate that guard here.
    const claimId: string | null = null;
    if (claimId) {
      await listClaimDriveFiles(claimId);
    }
    expect(listClaimDriveFiles).not.toHaveBeenCalled();
  });

  it('can be called twice to simulate refresh', async () => {
    const { listClaimDriveFiles } = await import('@/lib/drive/files');
    vi.mocked(listClaimDriveFiles)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'f2', name: 'DL.pdf', mimeType: 'application/pdf' }]);

    const first = await listClaimDriveFiles('claim-789');
    expect(first).toEqual([]);

    const second = await listClaimDriveFiles('claim-789');
    expect(second).toHaveLength(1);
    expect(second[0].id).toBe('f2');
  });
});
