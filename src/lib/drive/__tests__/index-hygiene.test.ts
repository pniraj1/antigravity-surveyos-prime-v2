import { describe, it, expect, vi, beforeEach } from 'vitest';

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
vi.stubGlobal('window', {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  localStorage: memStorage,
});
vi.stubGlobal('BroadcastChannel', class {
  postMessage() {}
  close() {}
});

vi.mock('@/lib/storage/indexeddb', () => ({
  addToDriveQueue: vi.fn(),
  getDriveQueueCount: vi.fn().mockResolvedValue(0),
  getDriveQueue: vi.fn().mockResolvedValue([]),
  removeDriveQueueItem: vi.fn(),
  incrementDriveQueueRetry: vi.fn(),
  getClaim: vi.fn().mockResolvedValue(null),
  saveClaim: vi.fn(),
  getAllClaims: vi.fn().mockResolvedValue([]),
  setDriveBackedAt: vi.fn(),
  getAllDriveBackedAt: vi.fn().mockResolvedValue(new Map()),
}));

import { saveDriveIndex, getOrCreateClaimFolder } from '../index';

describe('saveDriveIndex and getOrCreateClaimFolder hygiene', () => {
  beforeEach(() => {
    memStorage.clear();
    memStorage.setItem('surveyos_drive_token', 'valid-test-token');
    memStorage.setItem('surveyos_drive_token_expiry', String(Date.now() + 3600 * 1000));
    memStorage.setItem('surveyos_drive_root', 'root-1');
    vi.clearAllMocks();
  });

  describe('saveDriveIndex empty map safety guard', () => {
    it('aborts and warns if saving empty map when existing index has entries', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const urlStr = String(url);
        if (urlStr.includes('mimeType+%3D+%27application%2Fvnd.google-apps.folder%27') || urlStr.includes('mimeType = \'application/vnd.google-apps.folder\'')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ files: [{ id: 'root-1' }] }),
          };
        }
        if (urlStr.includes('surveyos_index.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ files: [{ id: 'index-file-1' }] }),
          };
        }
        if (urlStr.includes('/files/index-file-1?alt=media')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ 'claim-abc': 'folder-abc' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        };
      });

      vi.stubGlobal('fetch', mockFetch);

      await saveDriveIndex({});

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Drive] Aborting saveDriveIndex with empty map to prevent wiping existing index')
      );

      // Verify no upload/patch occurred
      const calls = mockFetch.mock.calls;
      const patchOrPost = calls.filter((call: any[]) => {
        const [url, opts] = call;
        return opts && (opts.method === 'PATCH' || opts.method === 'POST');
      });
      expect(patchOrPost.length).toBe(0);

      warnSpy.mockRestore();
    });

    it('proceeds if saving non-empty index map', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts?: any) => {
        const urlStr = String(url);
        if (urlStr.includes('mimeType') || urlStr.includes('SurveyOS')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ files: [{ id: 'root-1' }] }),
          };
        }
        if (urlStr.includes('surveyos_index.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ files: [{ id: 'index-file-1' }] }),
          };
        }
        if (opts?.method === 'PATCH') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'index-file-1' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        };
      });

      vi.stubGlobal('fetch', mockFetch);

      await saveDriveIndex({ 'claim-123': 'folder-123' });

      const calls = mockFetch.mock.calls;
      const patchCall = calls.find((call: any[]) => call[1]?.method === 'PATCH');
      expect(patchCall).toBeDefined();
    });
  });

  describe('getOrCreateClaimFolder error resilience', () => {
    it('does not overwrite index if loadDriveIndexStrict fails with network error', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockFetch = vi.fn().mockImplementation(async (url: string, opts?: any) => {
        const urlStr = String(url);
        if (urlStr.includes('mimeType') || urlStr.includes('SurveyOS')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ files: [{ id: 'root-1' }] }),
          };
        }
        if (urlStr.includes('surveyos_index.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ files: [{ id: 'index-file-1' }] }),
          };
        }
        if (urlStr.includes('/files/index-file-1?alt=media')) {
          // Network error when reading index
          return {
            ok: false,
            status: 503,
            text: async () => 'Service Unavailable',
          };
        }
        if (opts?.method === 'POST') {
          // createFolder
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'new-folder-789' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        };
      });

      vi.stubGlobal('fetch', mockFetch);

      const folderId = await getOrCreateClaimFolder('claim-789', 'KA01');

      expect(folderId).toBe('new-folder-789');
      // Folder id is cached locally
      expect(memStorage.getItem('surveyos_drive_folder_claim-789')).toBe('new-folder-789');

      // Verify saveDriveIndex was NOT called (no PATCH call with index-file-1)
      const patchCalls = mockFetch.mock.calls.filter((call: any[]) =>
        call[1]?.method === 'PATCH' && String(call[0]).includes('index-file-1')
      );
      expect(patchCalls.length).toBe(0);

      warnSpy.mockRestore();
    });

    it('returns existing claim.gDriveFolderId and updates index without creating a new folder', async () => {
      const { getClaim } = await import('@/lib/storage/indexeddb');
      vi.mocked(getClaim).mockResolvedValueOnce({
        id: 'claim-bound',
        gDriveFolderId: 'pre-existing-drive-folder',
      } as any);

      const mockFetch = vi.fn().mockImplementation(async (url: string, opts?: any) => {
        const urlStr = String(url);
        if (urlStr.includes('mimeType') || urlStr.includes('SurveyOS')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ files: [{ id: 'root-1' }] }),
          };
        }
        if (urlStr.includes('surveyos_index.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ files: [{ id: 'index-file-1' }] }),
          };
        }
        if (urlStr.includes('/files/index-file-1?alt=media')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ 'other-claim': 'other-folder' }),
          };
        }
        if (opts?.method === 'PATCH') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'index-file-1' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        };
      });

      vi.stubGlobal('fetch', mockFetch);

      const folderId = await getOrCreateClaimFolder('claim-bound', 'MH12');
      expect(folderId).toBe('pre-existing-drive-folder');
      expect(memStorage.getItem('surveyos_drive_folder_claim-bound')).toBe('pre-existing-drive-folder');

      // Verify no createFolder (POST) was executed
      const postCalls = mockFetch.mock.calls.filter((call: any[]) =>
        call[1]?.method === 'POST' && !String(call[0]).includes('multipart')
      );
      expect(postCalls.length).toBe(0);
    });
  });
});
