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
} as unknown as ClaimData);

describe('Claim Folder Deduplication & Silent Auto-Replace', () => {
  let claimDir: MockDir;

  beforeEach(() => {
    mockFolderStore.handles.clear();
    mockFolderStore.paths.clear();
    mockLocalSync.rootHandle = null;
    vi.clearAllMocks();

    claimDir = createMockDir('MH12AB1234 - NIA');
    mockFolderStore.handles.set('claim-1', claimDir);
  });

  describe('Single-file slot silent replacement', () => {
    it('replaces existing RC Book.pdf silently without creating RC Book (old).pdf', async () => {
      const initialClaim = mockClaim('claim-1');
      const blobV1 = new Blob(['RC content version 1 (1000 bytes)'.padEnd(1000, '.')], { type: 'application/pdf' });

      // First upload
      const { claim: claimV1, written: writtenV1 } = await writeDocuments(
        initialClaim,
        'rc',
        [{ blob: blobV1, name: 'rc_upload.pdf' }],
        'upload',
      );

      expect(writtenV1).toHaveLength(1);
      expect(writtenV1[0].relPath).toBe('RC Book.pdf');
      expect(claimDocuments(claimV1)).toHaveLength(1);
      expect(claimDir._allFilePaths()).toContain('RC Book.pdf');
      expect(claimDir._getFile('RC Book.pdf')?.size).toBe(1000);

      // Second upload with new/updated content
      const blobV2 = new Blob(['RC content version 2 updated (2000 bytes)'.padEnd(2000, '!')], { type: 'application/pdf' });
      const { claim: claimV2, written: writtenV2 } = await writeDocuments(
        claimV1,
        'rc',
        [{ blob: blobV2, name: 'new_rc_scan.pdf' }],
        'upload',
      );

      expect(writtenV2).toHaveLength(1);
      expect(writtenV2[0].relPath).toBe('RC Book.pdf');
      expect(writtenV2[0].size).toBe(2000);

      // Verify claim index only has 1 RC document (clean replacement, old id replaced)
      const rcDocs = claimDocuments(claimV2).filter((d) => d.type === 'rc');
      expect(rcDocs).toHaveLength(1);
      expect(rcDocs[0].id).toBe(writtenV2[0].id);

      // Verify folder on disk has NO (old) files!
      const filesOnDisk = claimDir._allFilePaths();
      expect(filesOnDisk).toEqual(['RC Book.pdf']);
      expect(filesOnDisk.some((f) => f.includes('(old)'))).toBe(false);

      // Verify the file content on disk was updated to version 2
      expect(claimDir._getFile('RC Book.pdf')?.size).toBe(2000);
    });

    it('silently replaces unindexed stranger file on disk without creating (old)', async () => {
      // Place a stranger file directly on disk (not in claim index)
      const dirHandle = await claimDir.getFileHandle('Driving Licence.pdf', { create: true });
      const writer = await dirHandle.createWritable();
      await writer.write(new Blob(['stranger dl 500 bytes'.padEnd(500, '0')], { type: 'application/pdf' }));
      await writer.close();

      expect(claimDir._allFilePaths()).toContain('Driving Licence.pdf');

      const initialClaim = mockClaim('claim-1');
      const blobNew = new Blob(['surveyor real dl 800 bytes'.padEnd(800, '1')], { type: 'application/pdf' });

      const { claim: updatedClaim, written } = await writeDocuments(
        initialClaim,
        'dl',
        [{ blob: blobNew, name: 'dl.pdf' }],
        'upload',
      );

      expect(written).toHaveLength(1);
      expect(written[0].relPath).toBe('Driving Licence.pdf');
      expect(written[0].size).toBe(800);

      const filesOnDisk = claimDir._allFilePaths();
      expect(filesOnDisk).toEqual(['Driving Licence.pdf']);
      expect(filesOnDisk.some((f) => f.includes('(old)'))).toBe(false);
      expect(claimDir._getFile('Driving Licence.pdf')?.size).toBe(800);

      const dlDocs = claimDocuments(updatedClaim).filter((d) => d.type === 'dl');
      expect(dlDocs).toHaveLength(1);
    });

    it('removes old file with different extension when replaced (e.g. report.html replaced by report.pdf)', async () => {
      const initialClaim = mockClaim('claim-1');
      const htmlBlob = new Blob(['<html>report</html>'], { type: 'text/html' });

      // First: generated HTML report
      const { claim: claimWithHtml } = await writeDocuments(
        initialClaim,
        'surveyReport',
        [{ blob: htmlBlob, name: 'Final Survey Report.html' }],
        'generated',
      );

      expect(claimDir._allFilePaths()).toContain('Final Survey Report.html');
      expect(claimDocuments(claimWithHtml)).toHaveLength(1);
      expect(claimDocuments(claimWithHtml)[0].relPath).toBe('Final Survey Report.html');

      // Second: real PDF report uploaded/generated
      const pdfBlob = new Blob(['%PDF-1.4 real report content'.padEnd(3000, '-')], { type: 'application/pdf' });
      const { claim: claimWithPdf, written } = await writeDocuments(
        claimWithHtml,
        'surveyReport',
        [{ blob: pdfBlob, name: 'Final Survey Report.pdf' }],
        'generated',
      );

      expect(written).toHaveLength(1);
      expect(written[0].relPath).toBe('Final Survey Report.pdf');

      // Old HTML file must be cleanly deleted from disk
      const filesOnDisk = claimDir._allFilePaths();
      expect(filesOnDisk).toContain('Final Survey Report.pdf');
      expect(filesOnDisk).not.toContain('Final Survey Report.html');
      expect(filesOnDisk.some((f) => f.includes('(old)'))).toBe(false);

      // Claim document index must only contain the PDF document
      const reportDocs = claimDocuments(claimWithPdf).filter((d) => d.type === 'surveyReport');
      expect(reportDocs).toHaveLength(1);
      expect(reportDocs[0].relPath).toBe('Final Survey Report.pdf');
    });

    it('replaces image RC with PDF RC and removes the old image file cleanly', async () => {
      const initialClaim = mockClaim('claim-1');
      const jpgBlob = new Blob(['sample jpg bytes'], { type: 'image/jpeg' });

      // First write: RC Book.jpg
      const { claim: claimWithJpg } = await writeDocuments(
        initialClaim,
        'rc',
        [{ blob: jpgBlob, name: 'rc_photo.jpg' }],
        'upload',
      );
      expect(claimDir._allFilePaths()).toContain('RC Book.jpg');

      // Second write: RC Book.pdf
      const pdfBlob = new Blob(['sample pdf bytes'], { type: 'application/pdf' });
      const { claim: claimWithPdf, written } = await writeDocuments(
        claimWithJpg,
        'rc',
        [{ blob: pdfBlob, name: 'rc.pdf' }],
        'upload',
      );

      expect(written[0].relPath).toBe('RC Book.pdf');
      const files = claimDir._allFilePaths();
      expect(files).toContain('RC Book.pdf');
      expect(files).not.toContain('RC Book.jpg');
      expect(files.some((f) => f.includes('(old)'))).toBe(false);

      const docs = claimDocuments(claimWithPdf).filter((d) => d.type === 'rc');
      expect(docs).toHaveLength(1);
      expect(docs[0].relPath).toBe('RC Book.pdf');
    });

    it('silently auto-replaces other single-file slots (permit, fitness, reinspectionReport)', async () => {
      let claim = mockClaim('claim-1');

      for (const slot of ['permit', 'fitness', 'reinspectionReport'] as const) {
        const v1 = new Blob([`initial ${slot}`], { type: 'application/pdf' });
        const res1 = await writeDocuments(claim, slot, [{ blob: v1, name: `${slot}.pdf` }], 'upload');
        claim = res1.claim;

        const v2 = new Blob([`updated ${slot} with more content`], { type: 'application/pdf' });
        const res2 = await writeDocuments(claim, slot, [{ blob: v2, name: `${slot}_v2.pdf` }], 'upload');
        claim = res2.claim;

        const slotDocs = claimDocuments(claim).filter((d) => d.type === slot);
        expect(slotDocs).toHaveLength(1);
        expect(slotDocs[0].id).toBe(res2.written[0].id);
      }

      const allFiles = claimDir._allFilePaths();
      expect(allFiles.some((f) => f.includes('(old)'))).toBe(false);
    });
  });

  describe('Deduplication: re-writing an identical file', () => {
    it('skips redundant write and returns existing document when identical name and size exists', async () => {
      const initialClaim = mockClaim('claim-1');
      const blob = new Blob(['policy content exactly 1200 bytes'.padEnd(1200, '=')], { type: 'application/pdf' });

      // First upload
      const { claim: claimV1, written: writtenV1 } = await writeDocuments(
        initialClaim,
        'policy',
        [{ blob, name: 'policy.pdf' }],
        'upload',
      );

      expect(writtenV1).toHaveLength(1);
      const originalDocId = writtenV1[0].id;
      expect(claimDir._getFile('Policy Schedule.pdf')?.size).toBe(1200);

      // Spy on getFileHandle to verify createWritable is NOT called on redundant write
      const originalGetFileHandle = claimDir.getFileHandle;
      let writableCreated = false;
      claimDir.getFileHandle = vi.fn(async (name: string, opts?: { create?: boolean }) => {
        const handle = await originalGetFileHandle(name, opts);
        const originalCW = handle.createWritable;
        handle.createWritable = vi.fn(async () => {
          writableCreated = true;
          return originalCW();
        });
        return handle;
      });

      // Second upload with the exact same file
      const identicalBlob = new Blob(['policy content exactly 1200 bytes'.padEnd(1200, '=')], { type: 'application/pdf' });
      const { claim: claimV2, written: writtenV2 } = await writeDocuments(
        claimV1,
        'policy',
        [{ blob: identicalBlob, name: 'policy.pdf' }],
        'upload',
      );

      // Verify redundant write was skipped
      expect(writableCreated).toBe(false);

      // Returns the existing document record
      expect(writtenV2).toHaveLength(1);
      expect(writtenV2[0].id).toBe(originalDocId);
      expect(writtenV2[0].relPath).toBe('Policy Schedule.pdf');

      // Claim documents should not have duplicated entries
      const policyDocs = claimDocuments(claimV2).filter((d) => d.type === 'policy');
      expect(policyDocs).toHaveLength(1);
      expect(policyDocs[0].id).toBe(originalDocId);

      // No (old) files
      expect(claimDir._allFilePaths()).toEqual(['Policy Schedule.pdf']);
    });

    it('indexes unindexed file on disk without writing if file already exists with same name and size', async () => {
      // Place file on disk directly
      const fh = await claimDir.getFileHandle('RC Book.pdf', { create: true });
      const wr = await fh.createWritable();
      await wr.write(new Blob(['existing unindexed rc 900 bytes'.padEnd(900, '#')], { type: 'application/pdf' }));
      await wr.close();

      let writableCreated = false;
      const originalGetFileHandle = claimDir.getFileHandle;
      claimDir.getFileHandle = vi.fn(async (name: string, opts?: { create?: boolean }) => {
        const handle = await originalGetFileHandle(name, opts);
        const originalCW = handle.createWritable;
        handle.createWritable = vi.fn(async () => {
          writableCreated = true;
          return originalCW();
        });
        return handle;
      });

      const initialClaim = mockClaim('claim-1');
      const blob = new Blob(['existing unindexed rc 900 bytes'.padEnd(900, '#')], { type: 'application/pdf' });

      const { claim: updatedClaim, written } = await writeDocuments(
        initialClaim,
        'rc',
        [{ blob, name: 'rc.pdf' }],
        'upload',
      );

      // Did not rewrite file
      expect(writableCreated).toBe(false);
      expect(written).toHaveLength(1);
      expect(written[0].relPath).toBe('RC Book.pdf');
      expect(written[0].size).toBe(900);

      const rcDocs = claimDocuments(updatedClaim).filter((d) => d.type === 'rc');
      expect(rcDocs).toHaveLength(1);
      expect(rcDocs[0].id).toBe(written[0].id);
    });
  });

  describe('Multi-file slots preservation', () => {
    it('preserves multiple files and increments numbers for photo slots', async () => {
      const initialClaim = mockClaim('claim-1');
      const photo1 = new Blob(['photo 1 data'], { type: 'image/jpeg' });
      const photo2 = new Blob(['photo 2 data'], { type: 'image/jpeg' });
      const photo3 = new Blob(['photo 3 data'], { type: 'image/jpeg' });

      // Write first damage photo
      const { claim: claim1, written: written1 } = await writeDocuments(
        initialClaim,
        'damagePhotos',
        [{ blob: photo1, name: 'dmg1.jpg' }],
        'photo',
      );
      expect(written1[0].relPath).toBe('Damage Photos/Damage Photos 1.jpg');

      // Write second damage photo
      const { claim: claim2, written: written2 } = await writeDocuments(
        claim1,
        'damagePhotos',
        [{ blob: photo2, name: 'dmg2.jpg' }],
        'photo',
      );
      expect(written2[0].relPath).toBe('Damage Photos/Damage Photos 2.jpg');

      // Write third damage photo
      const { claim: claim3, written: written3 } = await writeDocuments(
        claim2,
        'damagePhotos',
        [{ blob: photo3, name: 'dmg3.jpg' }],
        'photo',
      );
      expect(written3[0].relPath).toBe('Damage Photos/Damage Photos 3.jpg');

      // All 3 photos must exist in claim index
      const damageDocs = claimDocuments(claim3).filter((d) => d.type === 'damagePhotos');
      expect(damageDocs).toHaveLength(3);

      // All 3 files must exist on disk
      const filesOnDisk = claimDir._allFilePaths();
      expect(filesOnDisk).toContain('Damage Photos/Damage Photos 1.jpg');
      expect(filesOnDisk).toContain('Damage Photos/Damage Photos 2.jpg');
      expect(filesOnDisk).toContain('Damage Photos/Damage Photos 3.jpg');
      expect(filesOnDisk.some((f) => f.includes('(old)'))).toBe(false);
    });
  });
});
