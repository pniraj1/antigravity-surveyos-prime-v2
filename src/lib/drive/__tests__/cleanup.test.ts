import { describe, it, expect } from 'vitest';
import { groupForCleanup, cleanupTargets } from '../cleanup';
import type { ClaimData } from '@/types';

const c = (id: string, completedAt?: string, extra: Record<string, unknown> = {}) =>
  ({ id, completedAt, vehicle: { registrationNumber: id }, policy: { insurerName: 'NIA' }, ...extra }) as unknown as ClaimData;

describe('groupForCleanup', () => {
  it('completed only, year then month, newest first; skips already-trashed', () => {
    const g = groupForCleanup([
      c('a', '2025-03-10T10:00:00Z'), c('b', '2026-01-15T10:00:00Z'), c('open'),
      c('d', '2026-01-20T10:00:00Z'), c('e', '2026-06-15T10:00:00Z'),
      c('t', '2026-06-16T10:00:00Z', { driveTrashedAt: '2026-07-01T00:00:00Z' }),
    ]);
    expect(g.map(y => y.year)).toEqual([2026, 2025]);
    expect(g[0].months.map(m => m.month)).toEqual([5, 0]); // June, January (0-based)
    expect(g[0].months[1].claims.map(x => x.id)).toEqual(['d', 'b']);
    expect(g[1].months[0].claims.map(x => x.id)).toEqual(['a']);
  });
  it('empty when nothing completed', () => expect(groupForCleanup([c('x')])).toEqual([]));
});

describe('cleanupTargets', () => {
  const claim = c('k1', '2026-01-01T00:00:00Z', { scanClaimId: 's1' });
  it('finds both folders', () =>
    expect(cleanupTargets(claim, { k1: 'P' }, { s1: 'S' })).toEqual({ prime: 'P', scan: 'S' }));
  it('not on Drive -> null', () =>
    expect(cleanupTargets(claim, {}, {})).toEqual({ prime: null, scan: null }));
  it('no scanClaimId -> scan null', () =>
    expect(cleanupTargets(c('k1', 'x'), { k1: 'P' }, { s1: 'S' })).toEqual({ prime: 'P', scan: null }));
});

import { vi, beforeEach } from 'vitest';
vi.mock('../index', () => ({
  driveRequest: vi.fn(async () => ({ ok: true })),
  getRootFolder: vi.fn(), loadDriveIndexStrict: vi.fn(),
}));
vi.mock('../scan-status-sync', () => ({ findScanFolder: vi.fn(), phoneScansFolder: vi.fn() }));
import { driveRequest } from '../index';
import { trashFolder, runCleanup, type CleanupLookup } from '../cleanup';

describe('trashFolder', () => {
  beforeEach(() => vi.mocked(driveRequest).mockClear());
  it('PATCHes trashed:true, never DELETE', async () => {
    await trashFolder('F1');
    const [url, opt] = vi.mocked(driveRequest).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/files/F1');
    expect(opt.method).toBe('PATCH');
    expect(JSON.parse(opt.body as string)).toEqual({ trashed: true });
  });
});

describe('runCleanup', () => {
  const lookup = (o: Partial<CleanupLookup> = {}): CleanupLookup =>
    ({ index: { k1: 'P' }, scanFolders: { s1: 'S' }, failed: new Set(), protectedIds: new Set(['ROOT']), ...o });
  const done = () => c('k1', '2026-01-01T00:00:00Z', { scanClaimId: 's1' });
  const io = (claim: ClaimData | undefined) => ({ read: vi.fn(async () => claim), stamp: vi.fn(async () => {}) });
  beforeEach(() => vi.mocked(driveRequest).mockClear());

  it('trashes both folders and stamps', async () => {
    const i = io(done());
    expect(await runCleanup(['k1'], lookup(), i)).toEqual({ trashed: 1, skipped: 0, failed: 0 });
    expect(driveRequest).toHaveBeenCalledTimes(2);
    expect(i.stamp).toHaveBeenCalledOnce();
  });
  it('skips a claim reopened after load', async () => {
    const i = io(c('k1', undefined));
    expect((await runCleanup(['k1'], lookup(), i)).skipped).toBe(1);
    expect(driveRequest).not.toHaveBeenCalled();
    expect(i.stamp).not.toHaveBeenCalled();
  });
  it('does not stamp when nothing to trash', async () => {
    const i = io(done());
    expect((await runCleanup(['k1'], lookup({ index: {}, scanFolders: {} }), i)).skipped).toBe(1);
    expect(i.stamp).not.toHaveBeenCalled();
  });
  it('does not touch a claim whose lookup failed', async () => {
    const i = io(done());
    expect((await runCleanup(['k1'], lookup({ failed: new Set(['k1']) }), i)).skipped).toBe(1);
    expect(driveRequest).not.toHaveBeenCalled();
    expect(i.stamp).not.toHaveBeenCalled();
  });
  it('refuses the SurveyOS root', async () => {
    const i = io(done());
    expect((await runCleanup(['k1'], lookup({ index: { k1: 'ROOT' } }), i)).failed).toBe(1);
    expect(driveRequest).not.toHaveBeenCalled();
    expect(i.stamp).not.toHaveBeenCalled();
  });
});
