import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ClaimData } from '@/types';

// A "cloud" that persists its version across pushes, like the real Firestore doc.
const h = vi.hoisted(() => ({
  cloud: { exists: false, version: 0, data: {} as Record<string, unknown> },
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
        h.cloud = { exists: true, version: payload.version as number, data: payload };
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

import { pushClaimToCloud } from '@/lib/firebase/sync';
import { addRecoveredClaim } from '@/lib/storage/indexeddb';

beforeEach(() => {
  vi.clearAllMocks();
  h.cloud = { exists: false, version: 0, data: {} };
});

describe('REPRO: single device, stale in-memory version', () => {
  it('second milestone push of the same store object is falsely refused', async () => {
    // The Zustand store holds ONE claim object for the whole editing session.
    // No store action ever writes `version` (see stores/slices/claimSlice.ts),
    // so it stays at its opened value while the cloud's version climbs.
    const storeClaim: ClaimData = {
      id: 'c1', reportNo: 'SPOT-001', updatedAt: '2026-01-02T00:00:00Z',
      photos: [], version: 0,
    } as unknown as ClaimData;

    // Tab switch #1 → milestone push. Cloud goes 0 → 1.
    await pushClaimToCloud('uid', storeClaim);
    expect(h.cloud.version).toBe(1);
    expect(addRecoveredClaim).not.toHaveBeenCalled();

    // Surveyor keeps working. Store object is spread on each edit, but `version`
    // is carried over untouched — still 0.
    const afterEdits: ClaimData = { ...storeClaim, reportNo: 'SPOT-002-CORRECTED' };
    expect(afterEdits.version).toBe(0);

    // Tab switch #2 → milestone push. Local says 0, cloud says 1.
    const result = await pushClaimToCloud('uid', afterEdits);

    // The surveyor's work is stashed and the OLD cloud copy is adopted.
    expect(addRecoveredClaim).toHaveBeenCalledWith(afterEdits, 'superseded-by-newer-device');
    expect(result.reportNo).toBe('SPOT-001');       // corrected report no is GONE
    expect(h.cloud.version).toBe(1);                // nothing new reached the cloud
  });

  it('the fix: feeding the returned version back into the store keeps pushes clean', async () => {
    let storeClaim: ClaimData = {
      id: 'c1', reportNo: 'SPOT-001', updatedAt: '2026-01-02T00:00:00Z',
      photos: [], version: 0,
    } as unknown as ClaimData;

    const pushed = await pushClaimToCloud('uid', storeClaim);
    storeClaim = { ...storeClaim, version: pushed.version }; // <-- the missing line

    const afterEdits: ClaimData = { ...storeClaim, reportNo: 'SPOT-002-CORRECTED' };
    const result = await pushClaimToCloud('uid', afterEdits);

    expect(addRecoveredClaim).not.toHaveBeenCalled();
    expect(result.reportNo).toBe('SPOT-002-CORRECTED');
    expect(h.cloud.version).toBe(2);
  });
});
