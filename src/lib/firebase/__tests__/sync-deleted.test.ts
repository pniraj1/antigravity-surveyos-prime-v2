import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ClaimData } from '@/types';

const h = vi.hoisted(() => ({
  cloud: { exists: true, data: {} as Record<string, unknown> },
  setCalls: [] as Record<string, unknown>[],
  savedClaims: [] as ClaimData[],
  applied: [] as { id: string; deletedAt: string }[],
  appliedResult: 'dropped' as 'stashed' | 'dropped' | 'absent',
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
        data: () => h.cloud.data,
      }),
      set: (_ref: unknown, payload: Record<string, unknown>) => { h.setCalls.push(payload); },
    }),
}));

// Mock via ALIAS paths (@/...), matching sync-conflict.test.ts. sync.ts imports
// './config' and '../storage/indexeddb'; the alias resolves to the same files,
// and this is the form already proven to intercept correctly in this suite.
vi.mock('@/lib/firebase/config', () => ({ db: {} }));
vi.mock('@/lib/firebase/sync-cursor', () => ({ applySkewMargin: (t: string | null) => t }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/drive', () => ({ backupClaimToDrive: vi.fn().mockResolvedValue('ok') }));
vi.mock('@/stores/profile-store', () => ({ useProfileStore: { getState: () => ({ profile: {} }) } }));
vi.mock('@/stores/claim-store', () => ({
  useClaimStore: { getState: () => ({ syncVersion: vi.fn(), currentClaim: null, closeClaim: vi.fn() }) },
}));
vi.mock('@/lib/storage/indexeddb', () => ({
  getAllClaims: async () => [],
  saveClaim: async (c: ClaimData) => { h.savedClaims.push(c); },
  setPushedAt: vi.fn(),
  addRecoveredClaim: vi.fn(),
  getAllPushedAt: async () => new Map(),
  getTombstones: async () => [],
  getTombstoneIds: async () => new Set<string>(),
  removeTombstone: vi.fn(),
  deleteClaim: vi.fn(),
  applyRemoteDeletion: async (id: string, deletedAt: string) => {
    h.applied.push({ id, deletedAt });
    return h.appliedResult;
  },
}));

import { pushClaimToCloud } from '../sync';

const mk = (id: string, version: number): ClaimData =>
  ({ id, version, updatedAt: '2026-07-29T11:00:00.000Z', reportNo: 'R-1', photos: [] } as unknown as ClaimData);

describe('pushClaimToCloud against a tombstone', () => {
  beforeEach(() => {
    h.setCalls.length = 0;
    h.savedClaims.length = 0;
    h.applied.length = 0;
    h.appliedResult = 'dropped';
    h.cloud = {
      exists: true,
      data: {
        id: 'c1', ownerId: 'u1', deleted: true,
        deletedAt: '2026-07-29T10:00:00.000Z',
        updatedAt: '2026-07-29T10:00:00.000Z',
        version: 9,
      },
    };
  });

  it('refuses the write — nothing is pushed', async () => {
    const result = await pushClaimToCloud('u1', mk('c1', 3));
    expect(h.setCalls).toHaveLength(0);
    expect(result.conflicted).toBe(true);
  });

  it('does NOT adopt the tombstone as the local claim', async () => {
    await pushClaimToCloud('u1', mk('c1', 3));
    for (const saved of h.savedClaims) {
      expect((saved as unknown as Record<string, unknown>).deleted).toBeUndefined();
    }
  });

  it('applies the deletion locally with the tombstone timestamp', async () => {
    await pushClaimToCloud('u1', mk('c1', 3));
    expect(h.applied).toEqual([{ id: 'c1', deletedAt: '2026-07-29T10:00:00.000Z' }]);
  });
});
