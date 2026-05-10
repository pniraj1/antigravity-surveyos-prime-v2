import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DriveFile } from '@/lib/drive/list-cache';

vi.mock('@/lib/drive/index', () => ({
  getClaimFolderId: vi.fn(),
  listFilesInFolder: vi.fn(),
  driveRequest: vi.fn(),
}));

vi.mock('@/lib/drive/list-cache', () => ({
  getCachedFileList: vi.fn(() => null),
  setCachedFileList: vi.fn(),
  invalidateClaimFileList: vi.fn(),
}));

vi.mock('@/lib/storage/indexeddb', () => ({
  getDriveFileCache: vi.fn(),
  setDriveFileCache: vi.fn(),
  getDriveQueue: vi.fn(() => Promise.resolve([])),
}));

describe('listClaimDriveFiles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when no Drive folder exists', async () => {
    const { getClaimFolderId } = await import('@/lib/drive/index');
    vi.mocked(getClaimFolderId).mockResolvedValue(null);

    const { listClaimDriveFiles } = await import('@/lib/drive/files');
    const result = await listClaimDriveFiles('claim-1');
    expect(result).toEqual([]);
  });

  it('returns Drive files merged with pending queue items', async () => {
    const { getClaimFolderId, listFilesInFolder } = await import('@/lib/drive/index');
    const { getDriveQueue } = await import('@/lib/storage/indexeddb');

    vi.mocked(getClaimFolderId).mockResolvedValue('folder-abc');
    vi.mocked(listFilesInFolder).mockResolvedValue([
      { id: 'file-1', name: 'RC_Book.pdf', mimeType: 'application/pdf' },
    ]);
    vi.mocked(getDriveQueue).mockResolvedValue([
      {
        id: 'q-1', claimId: 'claim-1', claimLabel: 'KA01', fileName: 'Policy.pdf',
        fileData: new ArrayBuffer(8), mimeType: 'application/pdf',
        createdAt: new Date().toISOString(), retries: 0,
      },
    ] as any);

    const { listClaimDriveFiles } = await import('@/lib/drive/files');
    const result = await listClaimDriveFiles('claim-1');
    expect(result).toHaveLength(2);
    expect(result.find(f => f.name === 'RC_Book.pdf')?.pending).toBeFalsy();
    expect(result.find(f => f.name === 'Policy.pdf')?.pending).toBe(true);
  });
});

describe('findFileByName', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no match', async () => {
    const { getClaimFolderId, listFilesInFolder } = await import('@/lib/drive/index');
    vi.mocked(getClaimFolderId).mockResolvedValue('folder-abc');
    vi.mocked(listFilesInFolder).mockResolvedValue([
      { id: 'file-1', name: 'RC_Book.pdf', mimeType: 'application/pdf' },
    ]);

    const { findFileByName } = await import('@/lib/drive/files');
    const result = await findFileByName('claim-1', 'policy.pdf');
    expect(result).toBeNull();
  });

  it('matches case-insensitively', async () => {
    const { getClaimFolderId, listFilesInFolder } = await import('@/lib/drive/index');
    vi.mocked(getClaimFolderId).mockResolvedValue('folder-abc');
    vi.mocked(listFilesInFolder).mockResolvedValue([
      { id: 'file-1', name: 'RC_Book.pdf', mimeType: 'application/pdf' },
    ]);

    const { findFileByName } = await import('@/lib/drive/files');
    const result = await findFileByName('claim-1', 'rc_book.pdf');
    expect(result?.id).toBe('file-1');
  });
});

describe('ensureFileInCache', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns cached blob without Drive call on cache hit', async () => {
    const { getDriveFileCache } = await import('@/lib/storage/indexeddb');
    const { driveRequest } = await import('@/lib/drive/index');

    vi.mocked(getDriveFileCache).mockResolvedValue({
      fileId: 'file-1', mimeType: 'application/pdf',
      data: new ArrayBuffer(4), cachedAt: Date.now(),
    });

    const { ensureFileInCache } = await import('@/lib/drive/files');
    const blob = await ensureFileInCache('file-1', 'application/pdf');

    expect(blob).toBeInstanceOf(Blob);
    expect(driveRequest).not.toHaveBeenCalled();
  });

  it('downloads from Drive and caches on miss', async () => {
    const { getDriveFileCache, setDriveFileCache } = await import('@/lib/storage/indexeddb');
    const { driveRequest } = await import('@/lib/drive/index');

    vi.mocked(getDriveFileCache).mockResolvedValue(undefined);
    const fakeBlob = new Blob(['pdf-content'], { type: 'application/pdf' });
    vi.mocked(driveRequest).mockResolvedValue({
      blob: () => Promise.resolve(fakeBlob),
    } as unknown as Response);

    const { ensureFileInCache } = await import('@/lib/drive/files');
    const blob = await ensureFileInCache('file-2', 'application/pdf');

    expect(blob).toBeInstanceOf(Blob);
    expect(setDriveFileCache).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'file-2', mimeType: 'application/pdf' })
    );
  });
});
