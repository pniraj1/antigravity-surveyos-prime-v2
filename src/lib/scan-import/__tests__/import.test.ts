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
  driveIds: [] as Array<string | undefined>,
}));

vi.mock('@/stores/claim-store', () => ({ useClaimStore: { getState: () => ({ currentClaim: state.claim,
  updateClaim: (u: Partial<ClaimData>) => { state.claim = { ...state.claim!, ...u }; } }) } }));
vi.mock('@/lib/local-sync/directory-handle', () => ({ getStoredRootHandle: async () =>
  (state.folder ? (state.perm ? { queryPermission: async () => state.perm } : {}) : null) }));
vi.mock('@/lib/documents/folder', () => ({
  readDocument: async (_c: ClaimData, d: ClaimDocument) => state.bytes.get(d.id)!,
}));
vi.mock('@/lib/documents/sink', () => ({
  saveDocuments: async (type: DocType, files: Array<{ blob: Blob; name?: string; driveFileId?: string }>, source: ClaimDocument['source'], claimId?: string) => {
    if (claimId && state.claim?.id !== claimId) return []; // the real sink's guard
    if (type === state.failType) return []; // the real sink toasts and returns [] on a failed write
    state.mimes.push(...files.map((f) => f.blob.type));
    state.saves.push({ type, names: files.map((f) => f.name ?? ''), source });
    state.driveIds.push(...files.map((f) => f.driveFileId));
    const written = files.map((f, i): ClaimDocument => {
      const id = `d${state.bytes.size}-${i}`;
      state.bytes.set(id, f.blob);
      return { id, type, relPath: `${type}/${f.name}`, mime: '', size: f.blob.size, addedAt: `t${state.bytes.size}`, source, devices: ['pc'],
        ...(f.driveFileId && { driveFileId: f.driveFileId }) };
    });
    const docs = { ...(state.claim!.documents ?? {}) };
    for (const d of written) docs[d.id] = d;
    state.claim = { ...state.claim!, documents: docs };
    return written;
  },
}));

const { importScanZip, importScanFiles } = await import('../import');
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
  state.driveIds = [];
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
    expect(r).toEqual({ status: 'done', added: 1, skipped: 0, failed: 0, notes: { spot: { place: 'Pune' } }, contactsFilled: 0 });
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

  it('importAppliesChase', async () => {
    state.claim = { id: 'c1', vehicle: { registrationNumber: 'MH12AB1234' }, policy: { insuredName: 'Kept' } } as unknown as ClaimData;
    const zip = buildZip([{ name: 'C/_surveyos-scan.json', data: JSON.stringify({ app: 'surveyos-scan', v: 1, vehicle: 'MH12AB1234',
      insurer: '', claimNo: null, exportedAt: 't', files: [], claimId: 'S1',
      chase: { contacts: { insured: { name: 'Other', phone: '9999' }, garage: { name: 'Gar' } }, slotStates: { rc: 'missing' } } }) }]);
    const r = await importScanZip(zip, { confirmVehicle: yes });
    expect(r).toMatchObject({ status: 'done', contactsFilled: 2 });
    const c = state.claim as unknown as Record<string, Record<string, string>> & ClaimData;
    expect(c.policy.insuredName).toBe('Kept');
    expect(c.policy.insuredMobile).toBe('9999');
    expect(c.accident.workshopName).toBe('Gar');
    expect(c.scanClaimId).toBe('S1');
    expect(c.scanChase?.slotStates).toEqual({ rc: 'missing' });
    expect(c.scanChase?.importedAt).toBeTruthy();
  });

  const conflictZip = (chase?: object) => buildZip([
    ...manifestEntry('C', 'MH12AB1234', [{ path: 'rc.pdf', type: 'rc', data: 'rc' }]).slice(0, 1),
    { name: 'C/_surveyos-scan.json', data: JSON.stringify({ app: 'surveyos-scan', v: 1, vehicle: 'MH12AB1234', insurer: '', claimNo: null,
      exportedAt: 't', claimId: 'S2', ...(chase ? { chase } : {}), files: [{ path: 'rc.pdf', type: 'rc', pages: [], sha256: sha('rc') }] }) },
  ]);
  const linked = () => ({ id: 'c1', scanClaimId: 'S1', vehicle: { registrationNumber: 'MH12AB1234' } }) as unknown as ClaimData;

  it('differentClaimIdIsRefused', async () => {
    state.claim = linked();
    await expect(importScanZip(conflictZip(), { confirmVehicle: yes })).rejects.toThrow('different claim on the phone');
    await expect(importScanZip(conflictZip(), { confirmVehicle: yes, confirmRelink: async () => false })).rejects.toThrow('different claim on the phone');
    expect(state.saves).toEqual([]);
  });

  it('differentClaimIdRelinksWhenConfirmed', async () => {
    state.claim = linked();
    const confirmRelink = vi.fn(async () => true);
    const r = await importScanZip(conflictZip({ contacts: { insured: { name: 'N' } }, slotStates: { dl: 'missing' } }), { confirmVehicle: yes, confirmRelink });
    expect(confirmRelink).toHaveBeenCalledWith('S2', 'S1');
    expect(r).toMatchObject({ status: 'done', added: 1 });
    const c = state.claim as unknown as ClaimData;
    expect(c.scanClaimId).toBe('S2');
    expect(c.scanChase?.slotStates).toEqual({ dl: 'missing' });
  });

  it('differentClaimIdRelinksWithoutChase', async () => {
    state.claim = linked();
    const r = await importScanZip(conflictZip(), { confirmVehicle: yes, confirmRelink: async () => true });
    expect(r).toMatchObject({ status: 'done', added: 1 });
    expect((state.claim as unknown as ClaimData).scanClaimId).toBe('S2');
  });
});

/** A Drive source: the manifest at the root, only the files still in the Scan folder, and their Drive ids. */
const driveSource = (listed: Array<{ path: string; type: string; data: string }>, present: string[]) => {
  const files = new Map<string, Blob>([['_surveyos-scan.json', new Blob([JSON.stringify({
    app: 'surveyos-scan', v: 1, vehicle: 'MH12AB1234', insurer: '', claimNo: null, exportedAt: 't',
    files: listed.map((f) => ({ path: f.path, type: f.type, pages: [], sha256: sha(f.data) })),
  })])]]);
  const driveFileIds = new Map<string, string>();
  for (const f of listed.filter((l) => present.includes(l.path))) {
    files.set(f.path, new Blob([f.data]));
    driveFileIds.set(f.path, `id:${f.path}`);
  }
  return { files, driveFileIds };
};

describe('importScanFiles (Drive source)', () => {
  const rc = { path: 'RC Book.pdf', type: 'rc', data: 'rc' };
  const ph = (n: number) => ({ path: `Final Photos/Final Photos ${n}.jpg`, type: 'damagePhotos', data: `p${n}` });

  it('recordsDriveIdsAndReportsWhatPrimeHolds', async () => {
    const { files, driveFileIds } = driveSource([rc, ph(1)], [rc.path, ph(1).path]);
    const r = await importScanFiles(files, { confirmVehicle: yes, driveFileIds });
    expect(r).toMatchObject({ status: 'done', added: 2, skipped: 0, failed: 0, inPrime: ['id:RC Book.pdf', 'id:Final Photos/Final Photos 1.jpg'] });
    expect(state.driveIds).toEqual(['id:RC Book.pdf', 'id:Final Photos/Final Photos 1.jpg']);
  });

  it('absentFilesAreAlreadyImported', async () => {
    const { files, driveFileIds } = driveSource([rc, ph(1), ph(2)], [ph(2).path]);
    const r = await importScanFiles(files, { confirmVehicle: yes, driveFileIds });
    expect(r).toMatchObject({ status: 'done', added: 1, skipped: 0, failed: 0, inPrime: ['id:Final Photos/Final Photos 2.jpg'] });
    expect(state.saves).toEqual([{ type: 'damagePhotos', names: ['Final Photos 2.jpg'], source: 'scan' }]);
  });

  it('nothingLeftIsNothingNew', async () => {
    const { files, driveFileIds } = driveSource([rc, ph(1)], []);
    expect(await importScanFiles(files, { confirmVehicle: yes, driveFileIds })).toMatchObject({ status: 'done', added: 0, skipped: 0, inPrime: [] });
    expect(state.saves).toEqual([]);
  });

  it('duplicateContentIsInPrimeWithoutAWrite', async () => {
    await importScanZip(scanZip([rc]), { confirmVehicle: yes });
    state.saves = [];
    const { files, driveFileIds } = driveSource([rc], [rc.path]);
    expect(await importScanFiles(files, { confirmVehicle: yes, driveFileIds })).toMatchObject({ added: 0, skipped: 1, inPrime: ['id:RC Book.pdf'] });
    expect(state.saves).toEqual([]);
  });

  it('failedSaveIsNotInPrime', async () => {
    state.failType = 'rc';
    const { files, driveFileIds } = driveSource([rc], [rc.path]);
    expect(await importScanFiles(files, { confirmVehicle: yes, driveFileIds })).toMatchObject({ failed: 1, inPrime: [] });
  });

  it('singleFileTypeKeepsEarlierPagesFromTheClaim', async () => {
    const c = (n: number) => ({ path: `Chassis/Chassis ${n}.jpg`, type: 'chassisPhoto', data: `chassis ${n}` });
    const first = driveSource([c(1), c(2)], [c(1).path, c(2).path]);
    await importScanFiles(first.files, { confirmVehicle: yes, driveFileIds: first.driveFileIds });
    state.saves = [];
    state.driveIds = [];
    // Pages 1 and 2 were moved; Scan added page 3. The type is rewritten whole, in manifest order.
    const next = driveSource([c(1), c(2), c(3)], [c(3).path]);
    const r = await importScanFiles(next.files, { confirmVehicle: yes, driveFileIds: next.driveFileIds });
    expect(state.saves).toEqual([{ type: 'chassisPhoto', names: ['Chassis 1.jpg', 'Chassis 2.jpg', 'Chassis 3.jpg'], source: 'scan' }]);
    expect(state.driveIds).toEqual(['id:Chassis/Chassis 1.jpg', 'id:Chassis/Chassis 2.jpg', 'id:Chassis/Chassis 3.jpg']);
    expect(r).toMatchObject({ added: 3, inPrime: ['id:Chassis/Chassis 3.jpg'] });
  });

  it('singleFileTypeWithAPageNowhereIsKeptAsIs', async () => {
    const c = (n: number) => ({ path: `Chassis/Chassis ${n}.jpg`, type: 'chassisPhoto', data: `chassis ${n}` });
    const first = driveSource([c(1), c(2)], [c(1).path, c(2).path]);
    await importScanFiles(first.files, { confirmVehicle: yes, driveFileIds: first.driveFileIds });
    // Page 2's local copy is gone (or its Drive file did not match the manifest): no local hit, not in the map.
    const page2 = Object.values(state.claim!.documents!).find((d) => d.relPath.endsWith('Chassis 2.jpg'))!;
    state.bytes.set(page2.id, new Blob(['changed on disk']));
    state.saves = [];
    const next = driveSource([c(1), c(2), c(3)], [c(3).path]);
    const r = await importScanFiles(next.files, { confirmVehicle: yes, driveFileIds: next.driveFileIds });
    expect(state.saves).toEqual([]);
    expect(r).toMatchObject({ status: 'done', added: 0, inPrime: [], kept: ['Chassis Number Photo: 1 page not available, kept as is'] });
  });
});
