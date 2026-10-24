import { describe, it, expect, vi, beforeEach } from 'vitest';

const setDoc = vi.fn(async () => {});
const cloud: Record<string, Record<string, unknown> | undefined> = {};
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, _path: string, id: string) => id,
  getDoc: async (id: string) => ({ exists: () => !!cloud[id], data: () => cloud[id] }),
  setDoc: (...a: unknown[]) => setDoc(...(a as [])),
}));
vi.mock('@/lib/firebase/config', () => ({ db: {} }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }));

import { useProfileStore } from '@/stores/profile-store';
import { mergeSecrets, pullSecretsFromCloud, pushSecretsToCloud } from '../sync-secrets';

const p = () => useProfileStore.getState().profile;

describe('mergeSecrets', () => {
  it('first sync on a device unions keys and keeps a local image', () => {
    const out = mergeSecrets({ geminiApiKeys: ['a'], signatureDataUrl: 'cloud' }, { geminiApiKeys: ['b', 'a'], signatureDataUrl: 'local' }, true);
    expect(out).toEqual({ geminiApiKeys: ['a', 'b'], signatureDataUrl: 'local' });
  });
  it('after that, cloud wins so removals propagate', () => {
    expect(mergeSecrets({ geminiApiKeys: [] }, { geminiApiKeys: ['old'] }, false)).toEqual({ geminiApiKeys: [] });
  });
  it('no cloud doc yet → local is uploaded as-is', () => {
    expect(mergeSecrets(null, { stampDataUrl: 's' }, false)).toEqual({ stampDataUrl: 's' });
  });
});

describe('pull + push', () => {
  beforeEach(() => {
    setDoc.mockClear();
    for (const k of Object.keys(cloud)) delete cloud[k];
    // node env has no localStorage — the module treats that as a first sync (union)
  });

  it('a new laptop gets the keys and signature from the cloud', async () => {
    cloud.aiKeys = { geminiApiKeys: ['g1'], groqApiKeys: [], nvidiaApiKeys: [], ollamaApiKeys: ['o1'] };
    cloud.signature = { signatureDataUrl: 'data:sig' };
    cloud.stamp = { stampDataUrl: null };
    useProfileStore.getState().updateProfile({ geminiApiKeys: [], ollamaApiKeys: [], signatureDataUrl: null });
    await pullSecretsFromCloud('u1');
    expect(p().geminiApiKeys).toEqual(['g1']);
    expect(p().ollamaApiKeys).toEqual(['o1']);
    expect(p().signatureDataUrl).toBe('data:sig');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('push writes only the group that changed, and never before a pull', async () => {
    await pushSecretsToCloud('never-pulled', { ...p(), geminiApiKeys: ['x'] });
    expect(setDoc).not.toHaveBeenCalled();

    cloud.aiKeys = { geminiApiKeys: ['g1'], groqApiKeys: [], nvidiaApiKeys: [], ollamaApiKeys: [] };
    cloud.signature = { signatureDataUrl: null };
    cloud.stamp = { stampDataUrl: null };
    useProfileStore.getState().updateProfile({ geminiApiKeys: [], groqApiKeys: [], nvidiaApiKeys: [], ollamaApiKeys: [], signatureDataUrl: null, stampDataUrl: null });
    await pullSecretsFromCloud('u2');
    setDoc.mockClear();

    await pushSecretsToCloud('u2', { ...p(), name: 'renamed' }); // stale-safe: nothing secret changed
    expect(setDoc).not.toHaveBeenCalled();

    await pushSecretsToCloud('u2', { ...p(), stampDataUrl: 'data:stamp' });
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0]).toEqual(['stamp', { stampDataUrl: 'data:stamp', ownerId: 'u2' }]);
  });
});
