import { describe, it, expect, vi } from 'vitest';

vi.mock('idb', () => {
  const store = new Map<string, unknown>();
  const db = {
    get: vi.fn((_store: string, key: string) => Promise.resolve(store.get(key))),
    put: vi.fn((_store: string, value: unknown) => {
      store.set((value as { fileId: string }).fileId, value);
      return Promise.resolve();
    }),
  };
  return {
    openDB: vi.fn(() => Promise.resolve(db)),
  };
});

describe('driveFileCache IDB helpers', () => {
  it('setDriveFileCache then getDriveFileCache returns the entry', async () => {
    const { initUserDB, setDriveFileCache, getDriveFileCache } = await import('@/lib/storage/indexeddb');
    await initUserDB('test-uid-1');

    const entry = {
      fileId: 'abc123',
      mimeType: 'application/pdf',
      data: new ArrayBuffer(8),
      cachedAt: Date.now(),
    };
    await setDriveFileCache(entry);
    const result = await getDriveFileCache('abc123');

    expect(result).toBeDefined();
    expect(result?.fileId).toBe('abc123');
    expect(result?.mimeType).toBe('application/pdf');
  });

  it('getDriveFileCache returns undefined for unknown fileId', async () => {
    const { getDriveFileCache } = await import('@/lib/storage/indexeddb');
    const result = await getDriveFileCache('does-not-exist');
    expect(result).toBeUndefined();
  });
});
