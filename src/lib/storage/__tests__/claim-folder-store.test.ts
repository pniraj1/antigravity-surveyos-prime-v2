import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory IndexedDB mock
const mem = vi.hoisted(() => {
  const dbs = new Map<
    string,
    {
      version: number;
      stores: Map<string, { keyPath?: string; rows: Map<string, any> }>;
    }
  >();
  return { dbs };
});

vi.mock('idb', () => ({
  openDB: vi.fn(
    async (
      name: string,
      version: number,
      opts?: { upgrade?: (db: any, old: number, newV: number, tx: any) => void }
    ) => {
      let rec = mem.dbs.get(name);
      const oldVersion = rec?.version ?? 0;
      if (!rec) {
        rec = { version: 0, stores: new Map() };
        mem.dbs.set(name, rec);
      }
      const r = rec;
      const db = {
        objectStoreNames: {
          contains: (n: string) => r.stores.has(n),
        },
        createObjectStore: (n: string, o?: { keyPath?: string }) => {
          r.stores.set(n, { keyPath: o?.keyPath, rows: new Map() });
          return { createIndex: () => {} };
        },
        put: async (storeName: string, val: any, key?: string) => {
          const s = r.stores.get(storeName);
          if (!s) throw new Error(`Store ${storeName} not found`);
          const k = s.keyPath ? val[s.keyPath] : key;
          s.rows.set(k, val);
        },
        get: async (storeName: string, key: string) => {
          const s = r.stores.get(storeName);
          return s?.rows.get(key);
        },
        delete: async (storeName: string, key: string) => {
          const s = r.stores.get(storeName);
          s?.rows.delete(key);
        },
        close: () => {},
      };
      if (oldVersion < version && opts?.upgrade) {
        opts.upgrade(db, oldVersion, version, null);
        r.version = version;
      }
      return db;
    }
  ),
}));

import {
  isLocalFolderSupported,
  setClaimFolderHandle,
  getClaimFolderHandle,
  getClaimFolderPath,
  removeClaimFolderHandle,
  verifyHandlePermission,
  pickClaimFolder,
  _resetLocalSyncDBForTesting,
} from '../claim-folder-store';

function createMockHandle(name: string, permissionState: 'granted' | 'prompt' | 'denied' = 'granted'): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    queryPermission: vi.fn(async () => permissionState),
    requestPermission: vi.fn(async () => permissionState),
  } as unknown as FileSystemDirectoryHandle;
}

describe('claim-folder-store', () => {
  beforeEach(() => {
    mem.dbs.clear();
    _resetLocalSyncDBForTesting();
    vi.restoreAllMocks();
  });

  describe('isLocalFolderSupported', () => {
    it('returns true when showDirectoryPicker is defined on window', () => {
      vi.stubGlobal('window', { showDirectoryPicker: vi.fn() });
      expect(isLocalFolderSupported()).toBe(true);
    });

    it('returns false when window.showDirectoryPicker is undefined', () => {
      vi.stubGlobal('window', {});
      expect(isLocalFolderSupported()).toBe(false);
    });
  });

  describe('setClaimFolderHandle & getClaimFolderHandle & strict isolation', () => {
    it('stores and retrieves a handle for a claim', async () => {
      const handle1 = createMockHandle('MH12AB1234');
      await setClaimFolderHandle('claim-1', handle1, 'D:/Surveys/MH12AB1234');

      const retrieved = await getClaimFolderHandle('claim-1');
      expect(retrieved).toBe(handle1);

      const path = await getClaimFolderPath('claim-1');
      expect(path).toBe('D:/Surveys/MH12AB1234');
    });

    it('enforces STRICT ISOLATION: claim 2 returns null when claim 1 is stored', async () => {
      const handle1 = createMockHandle('MH12AB1234');
      await setClaimFolderHandle('claim-1', handle1, 'D:/Surveys/MH12AB1234');

      // Claim 2 has not been assigned a folder handle
      const retrievedClaim2 = await getClaimFolderHandle('claim-2');
      expect(retrievedClaim2).toBeNull();

      const pathClaim2 = await getClaimFolderPath('claim-2');
      expect(pathClaim2).toBeNull();
    });

    it('allows independent handles for different claims without cross-contamination', async () => {
      const handleA = createMockHandle('ClaimFolderA');
      const handleB = createMockHandle('ClaimFolderB');

      await setClaimFolderHandle('claim-A', handleA, 'C:/Surveys/A');
      await setClaimFolderHandle('claim-B', handleB, 'D:/Surveys/B');

      expect(await getClaimFolderHandle('claim-A')).toBe(handleA);
      expect(await getClaimFolderPath('claim-A')).toBe('C:/Surveys/A');

      expect(await getClaimFolderHandle('claim-B')).toBe(handleB);
      expect(await getClaimFolderPath('claim-B')).toBe('D:/Surveys/B');
    });

    it('falls back to handle.name when folderPath is omitted', async () => {
      const handle = createMockHandle('MyAutoFolder');
      await setClaimFolderHandle('claim-3', handle);

      expect(await getClaimFolderPath('claim-3')).toBe('MyAutoFolder');
    });

    it('returns null for empty or whitespace claimId', async () => {
      expect(await getClaimFolderHandle('')).toBeNull();
      expect(await getClaimFolderHandle('   ')).toBeNull();
      expect(await getClaimFolderPath('')).toBeNull();
    });
  });

  describe('removeClaimFolderHandle', () => {
    it('removes the handle for a given claim and leaves other claims intact', async () => {
      const handle1 = createMockHandle('Folder1');
      const handle2 = createMockHandle('Folder2');

      await setClaimFolderHandle('claim-1', handle1, 'Folder1');
      await setClaimFolderHandle('claim-2', handle2, 'Folder2');

      await removeClaimFolderHandle('claim-1');

      expect(await getClaimFolderHandle('claim-1')).toBeNull();
      expect(await getClaimFolderPath('claim-1')).toBeNull();

      // Claim 2 is intact
      expect(await getClaimFolderHandle('claim-2')).toBe(handle2);
      expect(await getClaimFolderPath('claim-2')).toBe('Folder2');
    });

    it('does not throw when removing an unassigned claim', async () => {
      await expect(removeClaimFolderHandle('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('verifyHandlePermission', () => {
    it('returns true when queryPermission resolves to granted', async () => {
      const handle = createMockHandle('Folder', 'granted');
      const granted = await verifyHandlePermission(handle, 'readwrite');
      expect(granted).toBe(true);
      expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(handle.requestPermission).not.toHaveBeenCalled();
    });

    it('requests permission and returns true when query is prompt and request is granted', async () => {
      const handle = {
        kind: 'directory',
        name: 'Folder',
        queryPermission: vi.fn(async () => 'prompt'),
        requestPermission: vi.fn(async () => 'granted'),
      } as unknown as FileSystemDirectoryHandle;

      const granted = await verifyHandlePermission(handle, 'readwrite');
      expect(granted).toBe(true);
      expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    });

    it('returns false when requestPermission is denied', async () => {
      const handle = {
        kind: 'directory',
        name: 'Folder',
        queryPermission: vi.fn(async () => 'prompt'),
        requestPermission: vi.fn(async () => 'denied'),
      } as unknown as FileSystemDirectoryHandle;

      const granted = await verifyHandlePermission(handle, 'readwrite');
      expect(granted).toBe(false);
    });

    it('returns false when requestPermission throws (e.g. SecurityError without user gesture)', async () => {
      const handle = {
        kind: 'directory',
        name: 'Folder',
        queryPermission: vi.fn(async () => 'prompt'),
        requestPermission: vi.fn(async () => {
          throw new Error('SecurityError: user gesture required');
        }),
      } as unknown as FileSystemDirectoryHandle;

      const granted = await verifyHandlePermission(handle, 'readwrite');
      expect(granted).toBe(false);
    });

    it('returns true when queryPermission is not implemented (older browser fallback)', async () => {
      const handle = {
        kind: 'directory',
        name: 'LegacyFolder',
      } as unknown as FileSystemDirectoryHandle;

      const granted = await verifyHandlePermission(handle);
      expect(granted).toBe(true);
    });

    it('returns false when handle is null or undefined', async () => {
      expect(await verifyHandlePermission(null as any)).toBe(false);
      expect(await verifyHandlePermission(undefined as any)).toBe(false);
    });
  });

  describe('pickClaimFolder', () => {
    it('throws when isLocalFolderSupported is false', async () => {
      vi.stubGlobal('window', {});
      await expect(pickClaimFolder('claim-1')).rejects.toThrow(/cannot open a local folder/i);
    });

    it('throws when claimId is empty', async () => {
      vi.stubGlobal('window', { showDirectoryPicker: vi.fn() });
      await expect(pickClaimFolder('')).rejects.toThrow(/claimId is required/i);
    });

    it('prompts user with mode readwrite, persists handle, and returns it', async () => {
      const mockHandle = createMockHandle('MySurveyFolder');
      const showDirectoryPicker = vi.fn(async () => mockHandle);
      vi.stubGlobal('window', { showDirectoryPicker });

      const result = await pickClaimFolder('claim-123');

      expect(showDirectoryPicker).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(result.handle).toBe(mockHandle);
      expect(result.folderPath).toBe('MySurveyFolder');

      // Verify it was stored in DB
      const stored = await getClaimFolderHandle('claim-123');
      expect(stored).toBe(mockHandle);
      const storedPath = await getClaimFolderPath('claim-123');
      expect(storedPath).toBe('MySurveyFolder');
    });

    it('propagates cancellation AbortError from showDirectoryPicker', async () => {
      const abortErr = new Error('The user aborted a request.');
      abortErr.name = 'AbortError';
      const showDirectoryPicker = vi.fn(async () => {
        throw abortErr;
      });
      vi.stubGlobal('window', { showDirectoryPicker });

      await expect(pickClaimFolder('claim-123')).rejects.toThrow('The user aborted a request.');
      expect(await getClaimFolderHandle('claim-123')).toBeNull();
    });
  });
});
