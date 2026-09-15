import { describe, it, expect, vi } from 'vitest';

const setDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  setDoc: (...a: unknown[]) => setDoc(...a),
  getDoc: vi.fn(),
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
}));
vi.mock('@/lib/firebase/config', () => ({ db: {} }));
vi.mock('@/lib/firebase/sync-cursor', () => ({ applySkewMargin: (t: string | null) => t }));
vi.mock('@/stores/profile-store', () => ({ useProfileStore: { getState: () => ({ profile: {} }) } }));
vi.mock('@/lib/drive', () => ({ backupClaimToDrive: vi.fn() }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/storage/indexeddb', () => ({
  getAllClaims: vi.fn(),
  saveClaim: vi.fn(),
  setPushedAt: vi.fn(),
  addRecoveredClaim: vi.fn(),
  getAllPushedAt: vi.fn(),
  getTombstones: vi.fn(),
  getTombstoneIds: vi.fn(),
  removeTombstone: vi.fn(),
  deleteClaim: vi.fn(),
  applyRemoteDeletion: vi.fn(),
}));

import { pushProfileToCloud } from '../sync';

describe('pushProfileToCloud', () => {
  it('never writes any provider key to Firestore', async () => {
    await pushProfileToCloud('uid', {
      name: 'S', geminiApiKeys: ['g'], groqApiKeys: ['q'], nvidiaApiKeys: ['n'], ollamaApiKeys: ['o'],
      geminiApiKey: 'g0', groqApiKey: 'q0',
    } as never);
    const written = setDoc.mock.calls[0][1] as Record<string, unknown>;
    for (const k of ['geminiApiKeys', 'groqApiKeys', 'nvidiaApiKeys', 'ollamaApiKeys', 'geminiApiKey', 'groqApiKey']) {
      expect(written).not.toHaveProperty(k);
    }
    expect(written.name).toBe('S');
  });
});
