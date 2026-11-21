import { describe, it, expect, vi, beforeEach } from 'vitest';

// A file saved before the claim has a folder must not vanish silently: the sink asks for the folder once,
// keeps the save in memory, and writes it when the folder is chosen (or warns loudly on Skip).
const state = vi.hoisted(() => ({
  claim: { id: 'c1', vehicle: { registrationNumber: 'MH12AB1234' } } as any,
  handle: null as unknown,
  writes: [] as string[][],
}));

vi.stubGlobal('window', Object.assign(new EventTarget(), { showDirectoryPicker: () => {} }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/stores/claim-store', () => ({ useClaimStore: { getState: () => ({ currentClaim: state.claim, updateClaim: () => {} }) } }));
vi.mock('@/lib/local-sync/directory-handle', () => ({ getStoredRootHandle: async () => null }));
vi.mock('@/lib/drive/scan-status-sync', () => ({ markReceivedInScan: async () => {} }));
vi.mock('@/lib/storage/claim-folder-store', () => ({
  getClaimFolderHandle: async () => state.handle,
  isLocalFolderSupported: () => true,
  askForClaimFolder: vi.fn(),
  FOLDER_UPDATED_EVENT: 'surveyos:claim-folder-updated',
  FOLDER_SKIPPED_EVENT: 'surveyos:claim-folder-skipped',
}));
vi.mock('../folder', () => ({
  PermissionDeniedError: class extends Error {},
  writeDocuments: async (claim: unknown, _t: string, files: Array<{ name: string }>) => {
    state.writes.push(files.map((f) => f.name));
    return { claim, written: files.map((f) => ({ id: f.name })) };
  },
}));

const { saveDocuments } = await import('../sink');
const { askForClaimFolder } = await import('@/lib/storage/claim-folder-store');
const { toast } = await import('sonner');

const blob = (name: string) => ({ blob: new Blob(['x']), name });
const fire = (name: string, claimId: string) => window.dispatchEvent(new CustomEvent(name, { detail: { claimId } }));
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  state.handle = null;
  state.writes = [];
  vi.mocked(askForClaimFolder).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe('sink without a claim folder', () => {
  it('asks once, keeps the saves, and writes them all when the folder is chosen', async () => {
    expect(await saveDocuments('rc', [blob('RC.pdf')], 'upload')).toEqual([]);
    expect(await saveDocuments('dl', [blob('DL.pdf')], 'upload')).toEqual([]);
    expect(askForClaimFolder).toHaveBeenCalledTimes(1);
    expect(askForClaimFolder).toHaveBeenCalledWith('c1');
    expect(state.writes).toEqual([]);

    state.handle = {};
    fire('surveyos:claim-folder-updated', 'c1');
    await settle(); await settle();
    expect(state.writes).toEqual([['RC.pdf'], ['DL.pdf']]);
  });

  it('Skip says loudly it was not saved, and does not ask again for that claim', async () => {
    state.claim = { ...state.claim, id: 'c2' };
    await saveDocuments('rc', [blob('RC.pdf')], 'upload');
    fire('surveyos:claim-folder-skipped', 'c2');
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/NOT saved/), expect.anything());

    vi.mocked(askForClaimFolder).mockClear();
    await saveDocuments('dl', [blob('DL.pdf')], 'upload');
    expect(askForClaimFolder).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(state.writes).toEqual([]);
  });
});
