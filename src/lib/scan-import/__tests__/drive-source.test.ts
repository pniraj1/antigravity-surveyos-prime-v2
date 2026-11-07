import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import type { ClaimData } from '@/types/claim';
import type { ScanManifest } from '../manifest';

const FOLDER = 'application/vnd.google-apps.folder';
interface Node { id: string; name: string; mimeType?: string; createdTime?: string; parents: string[]; data?: string }

// A fake Drive: nodes by id, answered through driveRequest. Moves and the import core are mocked.
const state = vi.hoisted(() => ({
  claim: null as ClaimData | null,
  nodes: [] as Node[],
  scanFolder: 'F' as string | null,
  moves: [] as Array<[string, string, string]>,
  failMove: '' as string,
  imported: null as null | { files: Map<string, Blob>; driveFileIds: ReadonlyMap<string, string> },
}));

vi.mock('@/stores/claim-store', () => ({ useClaimStore: { getState: () => ({ currentClaim: state.claim }) } }));
vi.mock('@/lib/drive/scan-status-sync', () => ({
  findScanFolder: async () => state.scanFolder,
  phoneScansFolder: async () => 'PS',
}));
vi.mock('@/lib/drive', () => ({
  getOrCreateClaimFolder: async () => 'P',
  moveFile: async (id: string, to: string, from: string) => {
    if (id === state.failMove) throw new Error('Drive API error 500');
    state.moves.push([id, to, from]);
  },
  driveRequest: async (url: string) => {
    const media = /files\/([^/?]+)\?alt=media/.exec(url);
    if (media) return new Response(state.nodes.find((n) => n.id === media[1])!.data);
    const q = new URL(url).searchParams.get('q') ?? '';
    const parent = /'([^']+)' in parents/.exec(q)?.[1];
    const name = /name='([^']+)'/.exec(q)?.[1];
    const files = state.nodes.filter((n) => (!parent || n.parents.includes(parent)) && (!name || n.name === name));
    return new Response(JSON.stringify({ files }));
  },
}));
vi.mock('../import', () => ({
  sha256: async (b: Blob) => createHash('sha256').update(Buffer.from(await b.arrayBuffer())).digest('hex'),
  importScanFiles: async (files: Map<string, Blob>, o: { driveFileIds: ReadonlyMap<string, string> }) => {
    state.imported = { files, driveFileIds: o.driveFileIds };
    return { status: 'done', added: o.driveFileIds.size, skipped: 0, failed: 0, notes: null, contactsFilled: 0, inPrime: [...o.driveFileIds.values()] };
  },
}));

const { planDriveImport, importFromDrive } = await import('../drive-source');

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const manifest = (vehicle: string, files: Array<{ path: string; data: string }>): string => JSON.stringify({
  app: 'surveyos-scan', v: 1, vehicle, insurer: '', claimNo: null, exportedAt: 't',
  files: files.map((f) => ({ path: f.path, type: 'rc', pages: [], sha256: sha(f.data) })),
});
const file = (id: string, name: string, parent: string, data: string, createdTime = '2026-11-01T00:00:00Z'): Node =>
  ({ id, name, parents: [parent], data, createdTime, mimeType: 'application/pdf' });
const yes = async () => true;

beforeEach(() => {
  state.claim = { id: 'c1', scanClaimId: 'S1', vehicle: { registrationNumber: 'MH12AB1234' } } as unknown as ClaimData;
  state.scanFolder = 'F';
  state.moves = [];
  state.failMove = '';
  state.imported = null;
  state.nodes = [];
});

describe('planDriveImport', () => {
  const m = { files: [{ path: 'RC.pdf' }, { path: 'Final Photos/Final Photos 1.jpg' }, { path: 'DL.pdf' }] } as unknown as ScanManifest;

  it('splitsPresentAndAbsent', () => {
    const p = planDriveImport(m, [{ name: 'RC.pdf', id: 'r' }, { name: 'Final Photos/Final Photos 1.jpg', id: 'f' }, { name: 'stray.pdf', id: 's' }]);
    expect(p.present.map((x) => [x.path, x.id])).toEqual([['RC.pdf', 'r'], ['Final Photos/Final Photos 1.jpg', 'f']]);
    expect(p.absent).toEqual(['DL.pdf']);
  });

  it('newestOfTwoSameNameFilesWins', () => {
    const p = planDriveImport(m, [
      { name: 'RC.pdf', id: 'new', createdTime: '2026-11-01T10:00:00Z' },
      { name: 'RC.pdf', id: 'old', createdTime: '2026-11-01T09:00:00Z' },
    ]);
    expect(p.present.map((x) => x.id)).toEqual(['new']);
  });

  it('everythingAbsentIsAlreadyImported', () => {
    expect(planDriveImport(m, [])).toEqual({ present: [], absent: ['RC.pdf', 'Final Photos/Final Photos 1.jpg', 'DL.pdf'] });
  });
});

describe('importFromDrive', () => {
  it('importsNewestVerifiedFilesAndMovesThem', async () => {
    state.claim = { ...state.claim!, documents: { d1: { id: 'd1', driveFileId: 'saved-not-moved' } } } as unknown as ClaimData;
    state.nodes = [
      file('m', '_surveyos-scan.json', 'F', manifest('MH12AB1234', [
        { path: 'RC.pdf', data: 'rc v2' }, { path: 'Final Photos/Final Photos 1.jpg', data: 'p1' }, { path: 'Gone.pdf', data: 'g' },
      ])),
      file('r1', 'RC.pdf', 'F', 'rc v1', '2026-11-01T09:00:00Z'),
      file('r2', 'RC.pdf', 'F', 'rc v2', '2026-11-01T10:00:00Z'),
      { id: 'SF', name: 'Final Photos', mimeType: FOLDER, parents: ['F'] },
      file('saved-not-moved', 'Final Photos 1.jpg', 'SF', 'p1'),
    ];
    const r = await importFromDrive({ confirmVehicle: yes });
    expect([...state.imported!.files.keys()]).toEqual(['_surveyos-scan.json', 'RC.pdf']);
    expect(await state.imported!.files.get('RC.pdf')!.text()).toBe('rc v2');
    expect([...state.imported!.driveFileIds]).toEqual([['RC.pdf', 'r2']]);
    // The file saved on an earlier import whose move failed is moved now, from its own subfolder.
    expect(state.moves).toEqual([['saved-not-moved', 'P', 'SF'], ['r2', 'P', 'F']]);
    expect(r).toMatchObject({ result: { status: 'done', added: 1 }, moveFailed: 0, mismatched: [] });
  });

  it('contentNotMatchingTheManifestIsSkipped', async () => {
    state.nodes = [
      file('m', '_surveyos-scan.json', 'F', manifest('MH12AB1234', [{ path: 'RC.pdf', data: 'what the manifest says' }])),
      file('r', 'RC.pdf', 'F', 'half uploaded'),
    ];
    const r = await importFromDrive({ confirmVehicle: yes });
    expect([...state.imported!.files.keys()]).toEqual(['_surveyos-scan.json']);
    expect(r.mismatched).toEqual(['RC.pdf']);
    expect(state.moves).toEqual([]);
  });

  it('failedMoveIsCountedAndTheDocumentKept', async () => {
    state.failMove = 'r';
    state.nodes = [file('m', '_surveyos-scan.json', 'F', manifest('MH12AB1234', [{ path: 'RC.pdf', data: 'rc' }])), file('r', 'RC.pdf', 'F', 'rc')];
    const r = await importFromDrive({ confirmVehicle: yes });
    expect(r).toMatchObject({ result: { status: 'done', added: 1 }, moveFailed: 1 });
  });

  it('noScanFolderSaysSo', async () => {
    state.scanFolder = null;
    await expect(importFromDrive({ confirmVehicle: yes })).rejects.toThrow('No Drive folder');
  });

  it('unlinkedClaimFindsTheFolderByVehicle', async () => {
    state.claim = { id: 'c1', vehicle: { registrationNumber: 'MH 12 AB 1234' } } as unknown as ClaimData;
    state.nodes = [
      { id: 'A', name: 'Other car', mimeType: FOLDER, parents: ['PS'] },
      { id: 'B', name: 'This car', mimeType: FOLDER, parents: ['PS'] },
      file('ma', '_surveyos-scan.json', 'A', manifest('KA01ZZ9999', [])),
      file('mb', '_surveyos-scan.json', 'B', manifest('MH12AB1234', [{ path: 'RC.pdf', data: 'rc' }])),
      file('r', 'RC.pdf', 'B', 'rc'),
    ];
    const choose = vi.fn();
    await importFromDrive({ confirmVehicle: yes, choose });
    expect(choose).not.toHaveBeenCalled();
    expect(state.moves).toEqual([['r', 'P', 'B']]);
  });

  it('severalMatchesAskTheSurveyor', async () => {
    state.claim = { id: 'c1', vehicle: { registrationNumber: 'MH12AB1234' } } as unknown as ClaimData;
    state.nodes = [
      { id: 'A', name: 'First', mimeType: FOLDER, parents: ['PS'] },
      { id: 'B', name: 'Second', mimeType: FOLDER, parents: ['PS'] },
      file('ma', '_surveyos-scan.json', 'A', manifest('MH12AB1234', [])),
      file('mb', '_surveyos-scan.json', 'B', manifest('MH12AB1234', [])),
    ];
    const choose = vi.fn(async () => null);
    expect(await importFromDrive({ confirmVehicle: yes, choose })).toMatchObject({ result: { status: 'cancelled' } });
    expect(choose).toHaveBeenCalledWith([{ id: 'A', name: 'First' }, { id: 'B', name: 'Second' }]);
  });

  it('importsNotesFromBackupJsonWhenManifestIsMissing', async () => {
    state.claim = { id: 'c1', scanClaimId: 'S1', vehicle: { registrationNumber: 'MH12AB1234' } } as unknown as ClaimData;
    const backupData = JSON.stringify({
      app: 'surveyos-scan-backup',
      v: 1,
      claimId: 'S1',
      vehicleNo: 'MH12AB1234',
      notes: { spot: { 'vehicle.odometer': '45210' } },
      rows: [],
    });
    state.nodes = [
      file('b', '_surveyos-backup.json', 'F', backupData),
    ];
    const r = await importFromDrive({ confirmVehicle: yes });
    expect(r).toMatchObject({
      result: {
        status: 'done',
        added: 0,
        notes: expect.objectContaining({
          spot: { 'vehicle.odometer': '45210' },
          vehicle: 'MH12AB1234',
        }),
      },
    });
  });
});
