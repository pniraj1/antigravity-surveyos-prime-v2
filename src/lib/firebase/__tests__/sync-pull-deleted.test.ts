import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ClaimData } from '@/types';

const h = vi.hoisted(() => ({
  docs: [] as Record<string, unknown>[],
  savedClaims: [] as ClaimData[],
  applied: [] as { id: string; deletedAt: string }[],
}));

vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  getDocs: async () => ({
    forEach: (cb: (d: { data: () => unknown }) => void) => {
      h.docs.forEach(d => cb({ data: () => d }));
    },
  }),
  runTransaction: vi.fn(),
}));

// Alias paths, matching sync-conflict.test.ts — see sync-deleted.test.ts for why.
vi.mock('@/lib/firebase/config', () => ({ db: {} }));
vi.mock('@/lib/firebase/sync-cursor', () => ({ applySkewMargin: (t: string | null) => t }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/drive', () => ({ backupClaimToDrive: vi.fn() }));
vi.mock('@/stores/profile-store', () => ({ useProfileStore: { getState: () => ({ profile: {} }) } }));
vi.mock('@/stores/claim-store', () => ({
  useClaimStore: { getState: () => ({ syncVersion: vi.fn(), currentClaim: null, closeClaim: vi.fn() }) },
}));
vi.mock('@/lib/storage/indexeddb', () => ({
  getAllClaims: async () => [],
  saveClaim: async (c: ClaimData) => { h.savedClaims.push(c); },
  setPushedAt: vi.fn(),
  addRecoveredClaim: vi.fn(),
  getAllPushedAt: async () => new Map<string, string>(),
  getTombstones: async () => [],
  getTombstoneIds: async () => new Set<string>(),
  removeTombstone: vi.fn(),
  deleteClaim: vi.fn(),
  applyRemoteDeletion: async (id: string, deletedAt: string) => {
    h.applied.push({ id, deletedAt });
    return 'absent' as const;
  },
}));

// BroadcastChannel does not exist in the node test environment.
vi.stubGlobal('BroadcastChannel', class {
  postMessage() {}
  close() {}
});

import { pullClaimsFromCloud } from '../sync';

const TOMBSTONE = {
  id: 'gone', ownerId: 'u1', deleted: true,
  deletedAt: '2026-07-29T10:00:00.000Z',
  updatedAt: '2026-07-29T10:00:00.000Z', version: 2,
};

describe('pullClaimsFromCloud with tombstones present', () => {
  beforeEach(() => {
    h.docs.length = 0;
    h.savedClaims.length = 0;
    h.applied.length = 0;
  });

  it('never writes a tombstone into IndexedDB as a claim', async () => {
    h.docs = [{ ...TOMBSTONE }];
    await pullClaimsFromCloud('u1', null);
    expect(h.savedClaims).toHaveLength(0);
  });

  it('applies the deletion locally', async () => {
    h.docs = [{ ...TOMBSTONE }];
    await pullClaimsFromCloud('u1', null);
    expect(h.applied).toEqual([{ id: 'gone', deletedAt: '2026-07-29T10:00:00.000Z' }]);
  });

  it('returns live claims only', async () => {
    h.docs = [
      { id: 'live', updatedAt: '2026-07-29T12:00:00.000Z', reportNo: 'R-9', version: 1 },
      { ...TOMBSTONE },
    ];
    const result = await pullClaimsFromCloud('u1', null);
    expect(result.map(c => c.id)).toEqual(['live']);
  });
});
