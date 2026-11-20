import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClaimData } from '@/types/claim';
import { claimDocuments } from '../index-ops';

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
  verifyHandlePermission: vi.fn(async (handle: any) => handle?.__permissionGranted !== false),
}));

vi.mock('@/lib/local-sync/directory-handle', () => ({
  getStoredRootHandle: vi.fn(async () => mockLocalSync.rootHandle),
  ensureReadWrite: vi.fn(async () => true),
  getDeviceLabel: vi.fn(async () => 'This PC'),
}));

vi.mock('@/lib/storage/indexeddb', () => ({
  getAllClaims: vi.fn(async () => []),
}));

import { writeDocuments } from '../folder';

interface MockDir {
  kind: 'directory';
  name: string;
  __permissionGranted: boolean;
  getDirectoryHandle: any;
  getFileHandle: any;
  removeEntry: any;
  entries: any;
  _allFilePaths: (prefix?: string) => string[];
  _getFile: (relPath: string) => File | undefined;
}

function createMockDir(name: string, permissionGranted = true): MockDir {
  const files = new Map<string, { blob: Blob; file: File }>();
  const dirs = new Map<string, any>();

  const dir: MockDir = {
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
    _allFilePaths: (prefix = ''): string[] => {
      const result: string[] = [];
      for (const [n] of files) result.push(prefix ? `${prefix}/${n}` : n);
      for (const [n, d] of dirs) result.push(...d._allFilePaths(prefix ? `${prefix}/${n}` : n));
      return result;
    },
    _getFile: (relPath: string): File | undefined => {
      const parts = relPath.split('/');
      if (parts.length === 1) return files.get(parts[0])?.file;
      const sub = dirs.get(parts[0]);
      return sub?._getFile(parts.slice(1).join('/'));
    },
  };
  return dir;
}

const mockClaim = (id = 'claim-1'): ClaimData => ({
  id,
  claimNumber: 'CLM-99999',
  vehicle: { registrationNumber: 'MH12AB1234' },
  policy: { insurerName: 'The New India Assurance Company Limited' },
  documentsFolder: 'MH12AB1234 - NIA',
  documents: {},
} as unknown as ClaimData);

describe('Multi-File Photo SHA-256 Deduplication', () => {
  let claimDir: MockDir;

  beforeEach(() => {
    mockFolderStore.handles.clear();
    mockFolderStore.paths.clear();
    mockLocalSync.rootHandle = null;
    vi.clearAllMocks();

    claimDir = createMockDir('MH12AB1234 - NIA');
    mockFolderStore.handles.set('claim-1', claimDir);
  });

  it('skips saving a photo if exact same SHA-256 hash already exists in claim documents', async () => {
    const claim = mockClaim('claim-1');
    const photoBlob1 = new Blob(['same-photo-bytes'], { type: 'image/jpeg' });

    // First call: saves Damage Photos 1.jpg
    const { claim: claimAfterFirst, written: written1 } = await writeDocuments(
      claim,
      'damagePhotos',
      [{ blob: photoBlob1, name: 'photo1.jpg' }],
      'upload',
    );

    expect(written1).toHaveLength(1);
    expect(written1[0].relPath).toBe('Damage Photos/Damage Photos 1.jpg');

    // Second call: saving identical photo bytes again
    const photoBlobDuplicate = new Blob(['same-photo-bytes'], { type: 'image/jpeg' });
    const { claim: claimAfterSecond, written: written2 } = await writeDocuments(
      claimAfterFirst,
      'damagePhotos',
      [{ blob: photoBlobDuplicate, name: 'photo1_duplicate.jpg' }],
      'upload',
    );

    // Should NOT write Damage Photos 2.jpg
    expect(written2).toHaveLength(0);

    // Claim documents should only contain the 1 photo
    const docs = claimDocuments(claimAfterSecond).filter((d) => d.type === 'damagePhotos');
    expect(docs).toHaveLength(1);
    expect(docs[0].relPath).toBe('Damage Photos/Damage Photos 1.jpg');

    // Files on disk should only contain Damage Photos 1.jpg
    const filesOnDisk = claimDir._allFilePaths();
    expect(filesOnDisk).toEqual(['Damage Photos/Damage Photos 1.jpg']);
  });

  it('deduplicates multiple identical photos within the same incoming batch', async () => {
    const claim = mockClaim('claim-1');
    const photoBlobA = new Blob(['photo-bytes-A'], { type: 'image/jpeg' });
    const photoBlobB = new Blob(['photo-bytes-B'], { type: 'image/jpeg' });
    const photoBlobADup = new Blob(['photo-bytes-A'], { type: 'image/jpeg' });

    const { claim: updatedClaim, written } = await writeDocuments(
      claim,
      'damagePhotos',
      [
        { blob: photoBlobA, name: 'img1.jpg' },
        { blob: photoBlobADup, name: 'img1_copy.jpg' },
        { blob: photoBlobB, name: 'img2.jpg' },
      ],
      'upload',
    );

    // Only 2 distinct photos should be written
    expect(written).toHaveLength(2);
    expect(written[0].relPath).toBe('Damage Photos/Damage Photos 1.jpg');
    expect(written[1].relPath).toBe('Damage Photos/Damage Photos 2.jpg');

    const docs = claimDocuments(updatedClaim).filter((d) => d.type === 'damagePhotos');
    expect(docs).toHaveLength(2);
    expect(claimDir._allFilePaths()).toEqual([
      'Damage Photos/Damage Photos 1.jpg',
      'Damage Photos/Damage Photos 2.jpg',
    ]);
  });

  it('allows adding new distinct photos alongside existing photos', async () => {
    const claim = mockClaim('claim-1');
    const photo1 = new Blob(['photo-1-bytes'], { type: 'image/jpeg' });
    const photo2 = new Blob(['photo-2-bytes'], { type: 'image/jpeg' });

    const { claim: claimV1 } = await writeDocuments(
      claim,
      'spotPhotos',
      [{ blob: photo1, name: 'spot1.jpg' }],
      'upload',
    );

    // Second call: passing photo1 (dup) AND photo2 (new)
    const photo1Dup = new Blob(['photo-1-bytes'], { type: 'image/jpeg' });
    const { claim: claimV2, written } = await writeDocuments(
      claimV1,
      'spotPhotos',
      [
        { blob: photo1Dup, name: 'spot1_again.jpg' },
        { blob: photo2, name: 'spot2.jpg' },
      ],
      'upload',
    );

    // Only the new photo should be written
    expect(written).toHaveLength(1);
    expect(written[0].relPath).toBe('Spot Photos/Spot Photos 2.jpg');

    const docs = claimDocuments(claimV2).filter((d) => d.type === 'spotPhotos');
    expect(docs).toHaveLength(2);
    expect(claimDir._allFilePaths()).toEqual([
      'Spot Photos/Spot Photos 1.jpg',
      'Spot Photos/Spot Photos 2.jpg',
    ]);
  });
});
