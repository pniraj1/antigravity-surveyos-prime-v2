import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { buildZip, type FixtureEntry } from './zip-helper';

// Module-boundary fakes: a claim in the store, a folder that may or may not be connected,
// and a sink that "writes" by keeping the bytes so readDocument can hand them back.
const state = vi.hoisted(() => ({
  claim: null as ClaimData | null,
  folder: true,
  bytes: new Map<string, Blob>(),
  saves: [] as Array<{ type: string; names: string[]; source: string }>,
  mimes: [] as string[],
  failType: '' as string,
  perm: '' as string, // '' = handle without queryPermission (older implementations)
}));

vi.mock('@/stores/claim-store', () => ({ useClaimStore: { getState: () => ({ currentClaim: state.claim }) } }));
vi.mock('@/lib/local-sync/directory-handle', () => ({ getStoredRootHandle: async () =>
  (state.folder ? (state.perm ? { queryPermission: async () => state.perm } : {}) : null) }));
vi.mock('@/lib/documents/folder', () => ({
  readDocument: async (_c: ClaimData, d: ClaimDocument) => state.bytes.get(d.id)!,
}));
vi.mock('@/lib/documents/sink', () => ({
  saveDocuments: async (type: DocType, files: Array<{ blob: Blob; name?: string }>, source: ClaimDocument['source'], claimId?: string) => {
    if (claimId && state.claim?.id !== claimId) return []; // the real sink's guard
    if (type === state.failType) return []; // the real sink toasts and returns [] on a failed write
    state.mimes.push(...files.map((f) => f.blob.type));
    state.saves.push({ type, names: files.map((f) => f.name ?? ''), source });
    const written = files.map((f, i): ClaimDocument => {
      const id = `d${state.bytes.size}-${i}`;
      state.bytes.set(id, f.blob);
      return { id, type, relPath: `${type}/${f.name}`, mime: '', size: f.blob.size, addedAt: `t${state.bytes.size}`, source, devices: ['pc'] };
    });
    const docs = { ...(state.claim!.documents ?? {}) };
    for (const d of written) docs[d.id] = d;
    state.claim = { ...state.claim!, documents: docs };
    return written;
  },
}));

const { importScanZip } = await import('../import');
const { cardIdFor, phoneFileFor } = await import('../cards');

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const scanZip = (files: Array<{ path: string; type: string; data: string }>, vehicle = 'MH12AB1234'): Blob => {
  const entries: FixtureEntry[] = files.map((f) => ({ name: `Claim/${f.path}`, data: f.data }));
  entries.push({
    name: 'Claim/_surveyos-scan.json',
    data: JSON.stringify({
      app: 'surveyos-scan', v: 1, vehicle, insurer: 'NIA', claimNo: null, exportedAt: 't',
      files: files.map((f) => ({ path: f.path, type: f.type, pages: [], sha256: sha(f.data) })),
      notes: { spot: { place: 'Pune' } },
    }),
  });
  return buildZip(entries);
};
const yes = async () => true;

beforeEach(() => {
  state.claim = { id: 'c1', vehicle: { registrationNumber: 'MH 12 AB 1234' } } as unknown as ClaimData;
  state.folder = true;
  state.bytes.clear();
  state.saves = [];
  state.mimes = [];
  state.failType = '';
  state.perm = '';
});
const manifestEntry = (folder: string, vehicle: string, files: Array<{ path: string; type: string; data: string }>): FixtureEntry[] => [
  ...files.map((f) => ({ name: `${folder}/${f.path}`, data: f.data })),
  { name: `${folder}/_surveyos-scan.json`, data: JSON.stringify({ app: 'surveyos-scan', v: 1, vehicle, insurer: '', claimNo: null,
    exportedAt: 't', files: files.map((f) => ({ path: f.path, type: f.type, pages: [], sha256: sha(f.data) })) }) },
];

describe('importScanZip', () => {
  it('requiresFolder', async () => {
    state.folder = false;
    const r = await importScanZip(scanZip([{ path: 'RC Book.pdf', type: 'rc', data: 'rc' }]), { confirmVehicle: yes });
    expect(r).toEqual({ status: 'needs-folder' });
    expect(state.saves).toEqual([]);
  });

  it('permissionNotGrantedWritesNothing', async () => {
    state.perm = 'prompt';
    const r = await importScanZip(scanZip([{ path: 'RC Book.pdf', type: 'rc', data: 'rc' }]), { confirmVehicle: yes });
    expect(r).toEqual({ status: 'needs-permission' });
    expect(state.saves).toEqual([]);
    state.perm = 'granted';
    expect(await importScanZip(scanZip([{ path: 'RC Book.pdf', type: 'rc', data: 'rc' }]), { confirmVehicle: yes })).toMatchObject({ added: 1 });
  });

  it('multiClaimZipPicksMatchingVehicle', async () => {
    const zip = buildZip([
      ...manifestEntry('A', 'KA01ZZ9999', [{ path: 'RC Book.pdf', type: 'rc', data: 'wrong rc' }]),
      ...manifestEntry('B', 'MH12AB1234', [{ path: 'RC Book.pdf', type: 'rc', data: 'right rc' }]),
    ]);
    const confirmVehicle = vi.fn(yes);
    expect(await importScanZip(zip, { confirmVehicle })).toMatchObject({ status: 'done', added: 1 });
    expect(confirmVehicle).not.toHaveBeenCalled();
    expect(await Object.values(state.claim!.documents!).map((d) => state.bytes.get(d.id)!)[0].text()).toBe('right rc');
  });

  it('multiClaimZipWithNoMatchIsRefused', async () => {
    const zip = buildZip([
      ...manifestEntry('A', 'KA01ZZ9999', [{ path: 'RC Book.pdf', type: 'rc', data: 'a' }]),
      ...manifestEntry('B', 'MH14CD5678', [{ path: 'RC Book.pdf', type: 'rc', data: 'b' }]),
    ]);
    const confirmVehicle = vi.fn(yes);
    await expect(importScanZip(zip, { confirmVehicle }))
      .rejects.toThrow("This zip holds 2 claims (KA01ZZ9999, MH14CD5678); none match this claim's vehicle.");
    expect(confirmVehicle).not.toHaveBeenCalled();
    expect(state.saves).toEqual([]);
  });

  it('reexportWithAddedPageKeepsEarlierPages', async () => {
    const p = (n: number) => ({ path: `Chassis/Chassis ${n}.jpg`, type: 'chassisPhoto', data: `chassis ${n}` });
    await importScanZip(scanZip([p(1), p(2)]), { confirmVehicle: yes });
    state.saves = [];
    // Single-file type: the write rules replace the whole set, so all three must be written together.
    expect(await importScanZip(scanZip([p(1), p(2), p(3)]), { confirmVehicle: yes })).toMatchObject({ added: 3, skipped: 0 });
    expect(state.saves).toEqual([{ type: 'chassisPhoto', names: ['Chassis 1.jpg', 'Chassis 2.jpg', 'Chassis 3.jpg'], source: 'scan' }]);
  });

  it('mismatchAbortsWhenDeclined', async () => {
    const confirmVehicle = vi.fn(async () => false);
    const r = await importScanZip(scanZip([{ path: 'RC Book.pdf', type: 'rc', data: 'rc' }], 'KA01ZZ9999'), { confirmVehicle });
    expect(confirmVehicle).toHaveBeenCalledWith('KA01ZZ9999', 'MH 12 AB 1234');
    expect(r).toEqual({ status: 'cancelled' });
    expect(state.saves).toEqual([]);
  });

  it('matchingVehicleNeverAsks', async () => {
    const confirmVehicle = vi.fn(yes);
    const r = await importScanZip(scanZip([{ path: 'RC Book.pdf', type: 'rc', data: 'rc' }]), { confirmVehicle });
    expect(confirmVehicle).not.toHaveBeenCalled();
    expect(r).toEqual({ status: 'done', added: 1, skipped: 0, failed: 0, notes: { spot: { place: 'Pune' } } });
    expect(state.saves).toEqual([{ type: 'rc', names: ['RC Book.pdf'], source: 'scan' }]);
    expect(state.mimes).toEqual(['application/pdf']);
  });

  it('claimSwitchDuringConfirmWritesNothing', async () => {
    const confirmVehicle = async () => {
      state.claim = { id: 'c2', vehicle: { registrationNumber: 'KA01ZZ9999' } } as unknown as ClaimData;
      return true;
    };
    const r = await importScanZip(scanZip([{ path: 'RC Book.pdf', type: 'rc', data: 'rc' }], 'KA01ZZ9999'), { confirmVehicle });
    expect(r).toEqual({ status: 'claim-changed', added: 0 });
    expect(state.saves).toEqual([]);
  });

  it('staleManifestHashDoesNotSkipNewFile', async () => {
    await importScanZip(scanZip([{ path: 'a.jpg', type: 'damagePhotos', data: 'old' }]), { confirmVehicle: yes });
    // A manifest claiming the existing file's hash for different bytes of the same size.
    const zip = buildZip([
      { name: 'C/b.jpg', data: 'new' },
      { name: 'C/_surveyos-scan.json', data: JSON.stringify({ app: 'surveyos-scan', v: 1, vehicle: 'MH12AB1234', insurer: '', claimNo: null,
        exportedAt: 't', files: [{ path: 'b.jpg', type: 'damagePhotos', pages: [], sha256: sha('old') }] }) },
    ]);
    expect(await importScanZip(zip, { confirmVehicle: yes })).toMatchObject({ added: 1, skipped: 0 });
  });

  it('failedSaveIsCounted', async () => {
    state.failType = 'rc';
    const r = await importScanZip(scanZip([
      { path: 'RC Book.pdf', type: 'rc', data: 'rc' },
      { path: 'Spot Photos/1.jpg', type: 'spotPhotos', data: 'p' },
    ]), { confirmVehicle: yes });
    expect(r).toMatchObject({ status: 'done', added: 1, skipped: 0, failed: 1 });
  });

  it('reimportAddsNothing', async () => {
    const zip = scanZip([
      { path: 'RC Book.pdf', type: 'rc', data: 'rc bytes' },
      { path: 'Spot Photos/Spot Photos 1.jpg', type: 'spotPhotos', data: 'p1' },
      { path: 'Spot Photos/Spot Photos 2.jpg', type: 'spotPhotos', data: 'p2' },
    ]);
    expect(await importScanZip(zip, { confirmVehicle: yes })).toMatchObject({ added: 3, skipped: 0 });
    state.saves = [];
    expect(await importScanZip(zip, { confirmVehicle: yes })).toMatchObject({ status: 'done', added: 0, skipped: 3 });
    expect(state.saves).toEqual([]);
  });

  it('sameBytesTwiceInOneZipLandOnce', async () => {
    const r = await importScanZip(scanZip([
      { path: 'a.jpg', type: 'damagePhotos', data: 'same' },
      { path: 'b.jpg', type: 'damagePhotos', data: 'same' },
    ]), { confirmVehicle: yes });
    expect(r).toMatchObject({ added: 1, skipped: 1 });
  });

  it('unknownDocTypeBecomesOther', async () => {
    await importScanZip(scanZip([
      { path: 'x.pdf', type: 'hologramSticker', data: 'x' },
      { path: 'y.pdf', type: 'constructor', data: 'y' },
    ]), { confirmVehicle: yes });
    expect(state.saves).toEqual([{ type: 'other', names: ['x.pdf', 'y.pdf'], source: 'scan' }]);
  });

  it('missingFileWritesNothing', async () => {
    const zip = buildZip([{
      name: 'Claim/_surveyos-scan.json',
      data: JSON.stringify({ app: 'surveyos-scan', v: 1, vehicle: 'MH12AB1234', insurer: '', claimNo: null, exportedAt: 't',
        files: [{ path: 'RC Book.pdf', type: 'rc', pages: [], sha256: 'x' }] }),
    }]);
    await expect(importScanZip(zip, { confirmVehicle: yes })).rejects.toThrow('incomplete');
    expect(state.saves).toEqual([]);
  });
});

describe('cards', () => {
  it('photosNeverCarded', () => {
    for (const t of ['spotPhotos', 'damagePhotos', 'chassisPhoto', 'odometerPhoto', 'photoFront', 'cancelledCheque', 'estimate', 'other'] as DocType[]) {
      expect(cardIdFor(t)).toBeNull();
    }
    expect(cardIdFor('rc')).toBe('rc');
    expect(cardIdFor('claimForm')).toBe('claim');
    expect(cardIdFor('invoice')).toBe('final-bill');
  });

  it('phoneFileForPicksNewestScanOfCardType', () => {
    const doc = (id: string, type: DocType, source: ClaimDocument['source'], addedAt: string): ClaimDocument =>
      ({ id, type, source, addedAt, relPath: id, mime: '', size: 1, devices: [] });
    const documents = Object.fromEntries([
      doc('old', 'invoice', 'scan', '2026-10-01'),
      doc('new', 'invoice', 'scan', '2026-10-02'),
      doc('upl', 'invoice', 'upload', '2026-10-03'),
    ].map((d) => [d.id, d]));
    expect(phoneFileFor({ documents }, 'final-bill')?.id).toBe('new');
    expect(phoneFileFor({ documents }, 'rc')).toBeNull();
    expect(phoneFileFor({ documents }, 'auth')).toBeNull();
  });
});
