import { describe, it, expect, vi, beforeEach } from 'vitest';

const memStorage = vi.hoisted(() => {
  const m = new Map<string, string>();
  const storage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => { m.clear(); },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
  };
  (globalThis as any).localStorage = storage;
  (globalThis as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: storage,
  };
  return storage;
});

vi.stubGlobal('localStorage', memStorage);
vi.stubGlobal('window', (globalThis as any).window);

vi.mock('@/lib/storage/indexeddb', () => ({
  addToDriveQueue: vi.fn(),
  getDriveQueueCount: vi.fn().mockResolvedValue(1),
  getDriveQueue: vi.fn().mockResolvedValue([]),
  removeDriveQueueItem: vi.fn(),
  incrementDriveQueueRetry: vi.fn(),
  getClaim: vi.fn(),
  saveClaim: vi.fn(),
  getAllClaims: vi.fn().mockResolvedValue([]),
  setDriveBackedAt: vi.fn(),
  getAllDriveBackedAt: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

import { uploadFileToDrive } from '../index';
import { useUIStore } from '@/stores/ui-store';
import * as storage from '@/lib/storage/indexeddb';

describe('uploadFileToDrive unlinked queue guard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('does not silently hoard files in driveQueue when user has never linked Drive (isDriveConnected: false)', async () => {
    useUIStore.getState().setDriveConnected(false);
    const blob = new Blob(['sample-photo-data'], { type: 'image/jpeg' });

    await uploadFileToDrive('claim-123', 'photo.jpg', blob);

    expect(storage.addToDriveQueue).not.toHaveBeenCalled();
  });

  it('queues file to driveQueue with warning when Drive is linked (isDriveConnected: true) but token is expired', async () => {
    useUIStore.getState().setDriveConnected(true, 'test@example.com');
    const blob = new Blob(['sample-photo-data'], { type: 'image/jpeg' });

    await uploadFileToDrive('claim-123', 'photo.jpg', blob);

    expect(storage.addToDriveQueue).toHaveBeenCalledTimes(1);
    expect(storage.addToDriveQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: 'claim-123',
        fileName: 'photo.jpg',
      })
    );
  });
});
