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
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import { uploadFileToDrive } from '../index';
import { useUIStore } from '@/stores/ui-store';
import * as storage from '@/lib/storage/indexeddb';

const blob = new Blob(['pdf'], { type: 'application/pdf' });
const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

function mockFetch(found: { id: string }[]) {
  const fn = vi.fn(async (url: string, _init?: RequestInit) =>
    ok(String(url).includes('upload/drive') ? {} : { files: found })
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}
const uploads = (fn: ReturnType<typeof mockFetch>) =>
  fn.mock.calls.filter(([u]) => String(u).includes('upload/drive'));

describe('uploadFileToDrive replace', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    localStorage.setItem('surveyos_drive_token', 'tok');
    localStorage.setItem('surveyos_drive_token_expiry', String(Date.now() + 60_000));
    localStorage.setItem('surveyos_drive_folder_c1', 'FOLDER');
    useUIStore.getState().setDriveConnected(true, 'a@b.c');
  });

  it('second mirror of the same name PATCHes the existing file', async () => {
    const fetchFn = mockFetch([{ id: 'X' }, { id: 'Y' }]);
    await uploadFileToDrive('c1', 'MH12_Final_Survey_Report_1.pdf', blob, 'L', { replace: true });
    const calls = uploads(fetchFn);
    expect(calls).toHaveLength(1);
    expect(String(calls[0][0])).toBe('https://www.googleapis.com/upload/drive/v3/files/X?uploadType=multipart');
    expect((calls[0][1] as RequestInit).method).toBe('PATCH');
    expect(fetchFn.mock.calls.some(([, o]) => (o as RequestInit)?.method === 'DELETE')).toBe(false);
  });

  it('POSTs when no file of that name exists', async () => {
    const fetchFn = mockFetch([]);
    await uploadFileToDrive('c1', 'a.pdf', blob, 'L', { replace: true });
    const calls = uploads(fetchFn);
    expect(calls).toHaveLength(1);
    expect(String(calls[0][0])).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
    expect((calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('escapes apostrophes in the search query', async () => {
    const fetchFn = mockFetch([]);
    await uploadFileToDrive('c1', "MH12_Final_Survey_Report_O'N.pdf", blob, 'L', { replace: true });
    const search = decodeURIComponent(String(fetchFn.mock.calls[0][0]));
    expect(search).toContain("name='MH12_Final_Survey_Report_O\\'N.pdf'");
    expect(search).toContain("'FOLDER' in parents");
  });

  it('without opts it never searches', async () => {
    const fetchFn = mockFetch([{ id: 'X' }]);
    await uploadFileToDrive('c1', 'a.pdf', blob, 'L');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect((fetchFn.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('replace without token queues', async () => {
    localStorage.removeItem('surveyos_drive_token');
    const fetchFn = mockFetch([]);
    await uploadFileToDrive('c1', 'a.pdf', blob, 'L', { replace: true });
    expect(storage.addToDriveQueue).toHaveBeenCalledTimes(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
