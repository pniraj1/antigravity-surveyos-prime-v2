import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClaimData } from '@/types/claim';

const mockFolderStore = vi.hoisted(() => ({
  handles: new Map<string, any>(),
  paths: new Map<string, string>(),
}));

const mockLocalSync = vi.hoisted(() => ({
  rootHandle: null as any,
}));

vi.mock('@/lib/storage/claim-folder-store', () => ({
  getClaimFolderHandle: vi.fn(async (id: string) => mockFolderStore.handles.get(id) ?? null),
  getClaimFolderPath: vi.fn(async (id: string) => mockFolderStore.paths.get(id) ?? null),
  verifyHandlePermission: vi.fn(async (handle: any) => {
    return handle?.__permissionGranted !== false;
  }),
}));

vi.mock('@/lib/local-sync/directory-handle', () => ({
  getStoredRootHandle: vi.fn(async () => mockLocalSync.rootHandle),
  ensureReadWrite: vi.fn(async () => true),
  getDeviceLabel: vi.fn(async () => 'This PC'),
}));

vi.mock('@/lib/storage/indexeddb', () => ({
  getAllClaims: vi.fn(async () => []),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import {
  getClaimDirHandle,
  claimFolderPath,
  writeDocuments,
  readDocument,
  PermissionDeniedError,
  NoFolderError,
} from '../folder';
import { saveDocuments } from '../sink';
import { useClaimStore } from '@/stores/claim-store';

function createMockDir(name: string, permissionGranted = true): any {
  const files = new Map<string, { blob: Blob; file: File }>();
  const dirs = new Map<string, any>();

  const dir = {
    kind: 'directory',
    name,
    __permissionGranted: permissionGranted,
    getDirectoryHandle: vi.fn(async (subName: string, opts?: { create?: boolean }) => {
      let d = dirs.get(subName);
      if (!d && opts?.create) {
        d = createMockDir(subName);
        dirs.set(subName, d);
      }
      if (!d) throw new Error(`Dir ${subName} not found`);
      return d;
    }),
    getFileHandle: vi.fn(async (fileName: string, opts?: { create?: boolean }) => {
      let f = files.get(fileName);
      if (!f && opts?.create) {
        const dummyFile = new File([''], fileName);
        f = { blob: dummyFile, file: dummyFile };
        files.set(fileName, f);
      }
      if (!f) throw new Error(`File ${fileName} not found`);
      return {
        kind: 'file',
        name: fileName,
        getFile: vi.fn(async () => f!.file),
        createWritable: vi.fn(async () => ({
          write: vi.fn(async (blob: Blob) => {
            const file = new File([blob], fileName, { type: blob.type });
            files.set(fileName, { blob, file });
          }),
          close: vi.fn(async () => {}),
        })),
      };
    }),
    removeEntry: vi.fn(async (entryName: string) => {
      files.delete(entryName);
      dirs.delete(entryName);
    }),
    entries: vi.fn(async function* () {
      for (const [n, f] of files) yield [n, { kind: 'file', getFile: async () => f.file }];
      for (const [n, d] of dirs) yield [n, d];
    }),
  };
  return dir;
}

const mockClaim = (id = 'claim-1'): ClaimData => ({
  id,
  claimNumber: 'CLM-12345',
  vehicle: { registrationNumber: 'MH12AB1234' },
  policy: { insurerName: 'The New India Assurance Company Limited' },
} as unknown as ClaimData);

describe('per-claim folder integration', () => {
  beforeEach(() => {
    mockFolderStore.handles.clear();
    mockFolderStore.paths.clear();
    mockLocalSync.rootHandle = null;
    vi.clearAllMocks();
  });

  describe('getClaimDirHandle', () => {
    it('returns allocated handle directly when present', async () => {
      const allocated = createMockDir('PerClaimFolder');
      mockFolderStore.handles.set('claim-1', allocated);

      const result = await getClaimDirHandle(mockClaim('claim-1'));
      expect(result).toBe(allocated);
      expect(result?.name).toBe('PerClaimFolder');
    });

    it('throws PermissionDeniedError when allocated handle lacks permission', async () => {
      const allocated = createMockDir('NoPermFolder', false);
      mockFolderStore.handles.set('claim-1', allocated);

      await expect(getClaimDirHandle(mockClaim('claim-1'))).rejects.toThrow(PermissionDeniedError);
    });

    it('falls back to root handle and resolves claim folder when no per-claim handle is set', async () => {
      const rootHandle = createMockDir('GlobalRoot');
      mockLocalSync.rootHandle = rootHandle;

      const result = await getClaimDirHandle(mockClaim('claim-1'), true);
      expect(result).not.toBeNull();
      expect(rootHandle.getDirectoryHandle).toHaveBeenCalled();
    });

    it('throws NoFolderError when neither per-claim handle nor root handle is set', async () => {
      await expect(getClaimDirHandle(mockClaim('claim-1'))).rejects.toThrow(NoFolderError);
    });
  });

  describe('claimFolderPath', () => {
    it('returns allocated folder path when getClaimFolderPath provides one', async () => {
      mockFolderStore.paths.set('claim-1', 'D:\\Surveys\\MH12AB1234');

      const path = await claimFolderPath(mockClaim('claim-1'));
      expect(path).toBe('D:\\Surveys\\MH12AB1234');
    });

    it('falls back to rootHandle.name + folderName when no allocated path exists', async () => {
      const rootHandle = createMockDir('SurveysDrive');
      mockLocalSync.rootHandle = rootHandle;

      const path = await claimFolderPath(mockClaim('claim-1'));
      expect(path).toBe('SurveysDrive\\MH12AB1234 - NIA');
    });

    it('returns null when neither allocated path nor root handle exists', async () => {
      const path = await claimFolderPath(mockClaim('claim-1'));
      expect(path).toBeNull();
    });
  });

  describe('writeDocuments & readDocument with allocated handle', () => {
    it('writes documents directly into allocated folder and updates documentsFolder', async () => {
      const allocated = createMockDir('DedicatedFolder');
      mockFolderStore.handles.set('claim-1', allocated);

      const claim = mockClaim('claim-1');
      const blob = new Blob(['sample pdf content'], { type: 'application/pdf' });

      const { claim: updatedClaim, written } = await writeDocuments(
        claim,
        'rc',
        [{ blob, name: 'rc.pdf' }],
        'upload',
      );

      expect(written).toHaveLength(1);
      expect(written[0].relPath).toBe('RC Book.pdf');
      expect(updatedClaim.documentsFolder).toBe('DedicatedFolder');

      // Now read document back using readDocument
      const readFile = await readDocument(updatedClaim, written[0]);
      expect(readFile).toBeDefined();
      expect(readFile.name).toBe('RC Book.pdf');
    });
  });

  describe('sink.ts (doSave) per-claim folder support', () => {
    it('saves successfully when per-claim folder is allocated even without a root handle', async () => {
      const allocated = createMockDir('PerClaimIsolated');
      mockFolderStore.handles.set('claim-1', allocated);
      mockLocalSync.rootHandle = null; // No global root!

      const claim = mockClaim('claim-1');
      useClaimStore.setState({ currentClaim: claim });

      const blob = new Blob(['dl content'], { type: 'image/jpeg' });
      const written = await saveDocuments('dl', [{ blob, name: 'dl.jpg' }], 'upload', 'claim-1');

      expect(written).toHaveLength(1);
      expect(written[0].relPath).toBe('Driving Licence.jpg');

      const storeClaim = useClaimStore.getState().currentClaim;
      expect(storeClaim?.documentsFolder).toBe('PerClaimIsolated');
    });

    it('returns empty array when neither per-claim folder nor root handle exists', async () => {
      mockFolderStore.handles.clear();
      mockLocalSync.rootHandle = null;

      const claim = mockClaim('claim-1');
      useClaimStore.setState({ currentClaim: claim });

      const blob = new Blob(['content'], { type: 'application/pdf' });
      const written = await saveDocuments('rc', [{ blob, name: 'rc.pdf' }], 'upload', 'claim-1');

      expect(written).toEqual([]);
    });
  });
});
