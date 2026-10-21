import { describe, it, expect, vi } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types/claim';

const DEV = 'PC1';
const mocks = vi.hoisted(() => ({ root: null as unknown, pageCountOf: vi.fn() }));
vi.mock('@/lib/local-sync/directory-handle', () => ({
  getStoredRootHandle: async () => mocks.root,
  ensureReadWrite: async () => true,
  getDeviceLabel: async () => 'PC1',
}));
vi.mock('@/lib/storage/indexeddb', () => ({ getAllClaims: async () => [] }));
vi.mock('../kit/page-text', () => ({ pageCountOf: mocks.pageCountOf, pageTexts: vi.fn() }));

import { scanClaimFolder } from '../folder';

/** A claim folder holding these files, read-only (only what scanClaimFolder touches). */
function folderWith(files: Record<string, File>) {
  const claimDir = {
    name: 'MH18AB1234 - NIA',
    kind: 'directory',
    async *entries() {
      for (const [n, f] of Object.entries(files)) yield [n, { kind: 'file', getFile: async () => f }];
    },
  };
  mocks.root = { name: 'Claims', getDirectoryHandle: async () => claimDir };
}

const pdf = (body: string, lastModified: number) => new File([body], 'Documents.pdf', { type: 'application/pdf', lastModified });

describe('scanClaimFolder fingerprints (C2)', () => {
  const start = (): ClaimData => ({ ...createBlankClaim(), documentsFolder: 'MH18AB1234 - NIA' });

  it('adoption stores the fingerprint and page count at once', async () => {
    mocks.pageCountOf.mockResolvedValue(3);
    folderWith({ 'Documents.pdf': pdf('abc', 1000) });
    const { claim } = await scanClaimFolder(start());
    const d = Object.values(claim.documents!)[0];
    expect(d.pageCount).toBe(3);
    expect(d.fingerprints).toEqual({ [DEV]: { size: 3, lastModified: 1000, pageCount: 3 } });
  });

  it.each([
    ['lastModified', pdf('abc', 2000)],
    ['size', pdf('abcd', 1000)],
  ])('a file changed (%s) after adoption has its labels reset by the next scan', async (_what, changed) => {
    mocks.pageCountOf.mockResolvedValue(3);
    folderWith({ 'Documents.pdf': pdf('abc', 1000) });
    const first = (await scanClaimFolder(start())).claim;
    const id = Object.keys(first.documents!)[0];
    const labelled: ClaimData = {
      ...first,
      documents: { [id]: { ...first.documents![id], pages: { 1: { type: 'rc', by: 'surveyor', confirmed: true } } } },
    };
    folderWith({ 'Documents.pdf': changed });
    const again = await scanClaimFolder(labelled);
    expect(again.reset).toEqual(['Documents.pdf']);
    expect(again.claim.documents![id].pages).toBeUndefined();
  });
});
