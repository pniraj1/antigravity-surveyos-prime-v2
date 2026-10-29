import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const memStorage = vi.hoisted(() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => { m.clear(); },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
  };
});

vi.stubGlobal('localStorage', memStorage);

const mockDb = vi.hoisted(() => ({
  count: vi.fn(),
  getAll: vi.fn(),
  clear: vi.fn(),
  close: vi.fn(),
}));

vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue(mockDb),
}));

import {
  initUserDB,
  closeUserDB,
  getStorageUsageSummary,
  clearDriveQueue,
  clearRecoveredClaims,
} from '../indexeddb';

describe('Storage usage summary and pruning', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    memStorage.clear();
    // Mark migration as done so legacy migration is skipped
    memStorage.setItem('surveyos_migrated_test-uid', 'done');
    await initUserDB('test-uid');
  });

  afterEach(async () => {
    await closeUserDB();
  });

  describe('getStorageUsageSummary', () => {
    it('returns correct counts and byte sizes for claims, drive queue, and recovered claims', async () => {
      mockDb.count.mockImplementation((store: string) => {
        if (store === 'claims') return Promise.resolve(12);
        if (store === 'recoveredClaims') return Promise.resolve(3);
        return Promise.resolve(0);
      });

      const buffer1 = new ArrayBuffer(1024);
      const buffer2 = new ArrayBuffer(2048);
      mockDb.getAll.mockImplementation((store: string) => {
        if (store === 'driveQueue') {
          return Promise.resolve([
            { id: '1', fileName: 'photo1.jpg', fileData: buffer1 },
            { id: '2', fileName: 'photo2.jpg', fileData: buffer2 },
            { id: '3', fileName: 'photo3.jpg', fileData: undefined }, // handles undefined/null fileData gracefully
          ]);
        }
        return Promise.resolve([]);
      });

      const summary = await getStorageUsageSummary();

      expect(summary).toEqual({
        claimsCount: 12,
        driveQueueCount: 3,
        driveQueueBytes: 3072,
        recoveredClaimsCount: 3,
      });
      expect(mockDb.count).toHaveBeenCalledWith('claims');
      expect(mockDb.getAll).toHaveBeenCalledWith('driveQueue');
      expect(mockDb.count).toHaveBeenCalledWith('recoveredClaims');
    });

    it('returns zero values when all stores are empty', async () => {
      mockDb.count.mockResolvedValue(0);
      mockDb.getAll.mockResolvedValue([]);

      const summary = await getStorageUsageSummary();

      expect(summary).toEqual({
        claimsCount: 0,
        driveQueueCount: 0,
        driveQueueBytes: 0,
        recoveredClaimsCount: 0,
      });
    });
  });

  describe('clearDriveQueue', () => {
    it('clears the driveQueue object store', async () => {
      mockDb.clear.mockResolvedValue(undefined);

      await clearDriveQueue();

      expect(mockDb.clear).toHaveBeenCalledTimes(1);
      expect(mockDb.clear).toHaveBeenCalledWith('driveQueue');
    });
  });

  describe('clearRecoveredClaims', () => {
    it('clears the recoveredClaims object store', async () => {
      mockDb.clear.mockResolvedValue(undefined);

      await clearRecoveredClaims();

      expect(mockDb.clear).toHaveBeenCalledTimes(1);
      expect(mockDb.clear).toHaveBeenCalledWith('recoveredClaims');
    });
  });
});
