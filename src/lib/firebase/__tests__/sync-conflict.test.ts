import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ClaimData } from '@/types';

// Shared, hoisted mutable state so the mocked Firestore transaction can be
// configured per-test (what version the "cloud" currently holds).
const h = vi.hoisted(() => ({
  cloud: { exists: false, version: 0, data: {} as Record<string, unknown> },
  setCalls: [] as Record<string, unknown>[],
  throwOther: false,
}));

vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  getDocs: vi.fn(),
  runTransaction: async (_db: unknown, cb: (tx: unknown) => unknown) =>
    cb({
      get: async () => ({
        exists: () => h.cloud.exists,
        data: () => ({ version: h.cloud.version, ...h.cloud.data }),
      }),
      set: (_ref: unknown, payload: Record<string, unknown>) => {
        if (h.throwOther) throw new Error('boom-non-conflict');
        h.setCalls.push(payload);
      },
    }),
}));

vi.mock('@/lib/firebase/config', () => ({ db: {} }));
vi.mock('@/lib/firebase/sync-cursor', () => ({ applySkewMargin: (t: string | null) => t }));
vi.mock('@/stores/profile-store', () => ({ useProfileStore: { getState: () => ({ profile: {} }) } }));
vi.mock('@/lib/drive', () => ({ backupClaimToDrive: vi.fn().mockResolvedValue('ok') }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/storage/indexeddb', () => ({
  getAllClaims: vi.fn(),
  saveClaim: vi.fn().mockResolvedValue(undefined),
  setPushedAt: vi.fn().mockResolvedValue(undefined),
  addRecoveredClaim: vi.fn().mockResolvedValue(undefined),
  getAllPushedAt: vi.fn(),
  getTombstones: vi.fn(),
  getTombstoneIds: vi.fn(),
  removeTombstone: vi.fn(),
}));

import { pushClaimToCloud, flushAllPendingToCloud } from '@/lib/firebase/sync';
import { saveClaim, setPushedAt, addRecoveredClaim, getAllClaims, getAllPushedAt } from '@/lib/storage/indexeddb';
import { toast } from 'sonner';

const mkClaim = (over: Partial<ClaimData> = {}): ClaimData =>
  ({ id: 'c1', reportNo: 'RPT-1', updatedAt: '2026-01-02T00:00:00Z', photos: [], version: 0, ...over } as ClaimData);

beforeEach(() => {
  vi.clearAllMocks();
  h.cloud = { exists: false, version: 0, data: {} };
  h.setCalls = [];
  h.throwOther = false;
});

describe('pushClaimToCloud — accept path (cloud not ahead)', () => {
  it('writes version cloud+1 and does NOT recover', async () => {
    h.cloud = { exists: false, version: 0, data: {} };
    const result = await pushClaimToCloud('uid', mkClaim({ version: 0 }));
    expect(h.setCalls[0]?.version).toBe(1);        // wrote v1
    expect(result.version).toBe(1);                // returns pushed with new version
    expect(saveClaim).toHaveBeenCalled();          // reflected locally
    expect(setPushedAt).toHaveBeenCalled();        // marked clean
    expect(addRecoveredClaim).not.toHaveBeenCalled(); // no conflict → no stash
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

describe('pushClaimToCloud — conflict path (cloud is newer)', () => {
  it('stashes the LOCAL copy BEFORE adopting remote, returns the newer remote', async () => {
    h.cloud = { exists: true, version: 5, data: { id: 'c1', reportNo: 'RPT-1-REMOTE', updatedAt: '2026-01-03T00:00:00Z' } };
    const local = mkClaim({ version: 2, reportNo: 'RPT-1-LOCAL', photos: ['p1'] as unknown as ClaimData['photos'] });

    const result = await pushClaimToCloud('uid', local);

    // 1. Local copy is stashed (Option B — never silently deleted)
    expect(addRecoveredClaim).toHaveBeenCalledWith(local, 'superseded-by-newer-device');
    // 2. Ordering: stash happens BEFORE the local record is overwritten
    const stashOrder = (addRecoveredClaim as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0];
    const saveOrder = (saveClaim as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0];
    expect(stashOrder).toBeLessThan(saveOrder);
    // 3. The adopted (newer, remote) version becomes live and is returned
    expect(result.version).toBe(5);
    expect(result.reportNo).toBe('RPT-1-REMOTE');
    // 4. No blind overwrite of the cloud happened (transaction never called set)
    expect(h.setCalls).toHaveLength(0);
    // 5. Surveyor is notified
    expect(toast.warning).toHaveBeenCalled();
  });

  it('preserves local photos when adopting the remote copy', async () => {
    h.cloud = { exists: true, version: 9, data: { id: 'c1', updatedAt: '2026-01-03T00:00:00Z' } };
    const local = mkClaim({ version: 1, photos: ['photoA'] as unknown as ClaimData['photos'] });
    await pushClaimToCloud('uid', local);
    const adopted = (saveClaim as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as ClaimData;
    expect(adopted.photos).toEqual(['photoA']);
  });
});

describe('pushClaimToCloud — non-conflict errors rethrow', () => {
  it('propagates a non-ClaimConflictError instead of recovering', async () => {
    h.cloud = { exists: false, version: 0, data: {} }; // guard passes → set() runs
    h.throwOther = true;                                // set() throws a generic error
    await expect(pushClaimToCloud('uid', mkClaim({ version: 0 }))).rejects.toThrow('boom-non-conflict');
    expect(addRecoveredClaim).not.toHaveBeenCalled();   // not treated as a conflict
  });
});

describe('flushAllPendingToCloud', () => {
  it('is a no-op when offline (skipped=true)', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
    const res = await flushAllPendingToCloud('uid');
    expect(res).toEqual({ pushed: 0, failed: 0, skipped: true });
    expect(getAllClaims).not.toHaveBeenCalled();
  });

  it('pushes every dirty claim when online', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
    (getAllClaims as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue([
      mkClaim({ id: 'a', updatedAt: '2026-01-02T00:00:00Z', version: 0 }),
      mkClaim({ id: 'b', updatedAt: '2026-01-02T00:00:00Z', version: 0 }),
    ]);
    (getAllPushedAt as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(new Map()); // none pushed → both dirty
    const res = await flushAllPendingToCloud('uid');
    expect(res.pushed).toBe(2);
    expect(res.failed).toBe(0);
    expect(res.skipped).toBe(false);
  });
});
