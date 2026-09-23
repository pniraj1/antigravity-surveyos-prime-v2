import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClaimData } from '@/types/claim';

vi.mock('@/lib/storage/indexeddb', () => ({ getAllClaims: vi.fn() }));
vi.mock('@/lib/local-sync/directory-handle', () => ({
  getStoredRootHandle: vi.fn(async () => null),   // no root handle → the disk probe is skipped
  ensureReadWrite: vi.fn(async () => true),
  getDeviceLabel: vi.fn(async () => 'This PC'),
}));

import { resolveFolderName } from '../folder';
import { getAllClaims } from '@/lib/storage/indexeddb';

const mockGetAllClaims = vi.mocked(getAllClaims);

const claim = (over: Partial<ClaimData> & { id: string }): ClaimData => ({
  vehicle: { registrationNumber: 'MH12AB1234' },
  policy: { insurerName: 'The New India Assurance Company Limited' },
  ...over,
} as ClaimData);

const BASE = 'MH12AB1234 - NIA';

describe('resolveFolderName', () => {
  beforeEach(() => { mockGetAllClaims.mockReset(); });

  it('returns the sticky name without touching the claim store', async () => {
    const c = claim({ id: 'a', documentsFolder: 'Whatever I Was Called' });
    expect(await resolveFolderName(c)).toBe('Whatever I Was Called');
    expect(mockGetAllClaims).not.toHaveBeenCalled();
  });

  it('returns the base name when nobody has it', async () => {
    mockGetAllClaims.mockResolvedValue([claim({ id: 'other', documentsFolder: 'MH01XY9999 - ICICI' })]);
    expect(await resolveFolderName(claim({ id: 'a' }))).toBe(BASE);
  });

  it('suffixes " - 2" when another claim already took the base name', async () => {
    mockGetAllClaims.mockResolvedValue([claim({ id: 'other', documentsFolder: BASE })]);
    expect(await resolveFolderName(claim({ id: 'a' }))).toBe(`${BASE} - 2`);
  });

  it('keeps counting past a taken " - 2"', async () => {
    mockGetAllClaims.mockResolvedValue([
      claim({ id: 'one', documentsFolder: BASE }),
      claim({ id: 'two', documentsFolder: `${BASE} - 2` }),
    ]);
    expect(await resolveFolderName(claim({ id: 'a' }))).toBe(`${BASE} - 3`);
  });

  it('never collides with itself', async () => {
    // The claim is in the store with the base name, but has no documentsFolder in hand
    // (an older record, or a field not yet read back) — it must not be pushed to " - 2".
    mockGetAllClaims.mockResolvedValue([claim({ id: 'a', documentsFolder: BASE })]);
    expect(await resolveFolderName(claim({ id: 'a' }))).toBe(BASE);
  });
});
