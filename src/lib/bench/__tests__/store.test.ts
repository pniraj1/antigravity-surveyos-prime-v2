import { describe, it, expect, vi, beforeEach } from 'vitest';

const mem = vi.hoisted(() => {
  const dbs = new Map<string, { version: number; stores: Map<string, { keyPath: string; rows: Map<string, unknown> }> }>();
  return { dbs };
});
vi.mock('idb', () => ({
  openDB: vi.fn(async (name: string, version: number, opts: { upgrade: (db: unknown, old: number) => void }) => {
    let rec = mem.dbs.get(name);
    const old = rec?.version ?? 0;
    if (!rec) { rec = { version: 0, stores: new Map() }; mem.dbs.set(name, rec); }
    const r = rec;
    const st = (n: string) => r.stores.get(n)!;
    const db = {
      objectStoreNames: { contains: (n: string) => r.stores.has(n) },
      createObjectStore: (n: string, o: { keyPath: string }) => { r.stores.set(n, { keyPath: o.keyPath, rows: new Map() }); return { createIndex: () => {} }; },
      put: async (n: string, v: Record<string, string>) => { st(n).rows.set(v[st(n).keyPath], v); },
      get: async (n: string, k: string) => st(n).rows.get(k),
      getAll: async (n: string) => [...st(n).rows.values()],
      clear: async (n: string) => { st(n).rows.clear(); },
      close: () => {},
    };
    if (old < version) { opts.upgrade(db, old); r.version = version; }
    return db;
  }),
}));
vi.stubGlobal('localStorage', { getItem: () => '1', setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 });

import { initUserDB, closeUserDB } from '../../storage/indexeddb';
import { bench, cellId, type CellResult } from '../store';
import type { PdfProfile } from '../types';

const profile: PdfProfile = { id: 'p1', fileName: 'a.pdf', kind: 'digital', pageCount: 3, estimates: [], unreadablePages: [], confirmed: true };
const key = { profileId: 'p1', provider: 'groq' as const, model: 'm', method: 'text' as const, pagesPerCall: 2, imageScale: 1 as const, runNo: 1 };
const cell = (over: Partial<CellResult> = {}): CellResult => ({
  ...key, ...over, id: cellId({ ...key, ...over }), status: 'done', rows: [], errors: [], calls: [], tokensIn: 1, tokensOut: 2, ms: 3, modelVersion: 'v', at: 4,
});

describe('bench store', () => {
  beforeEach(async () => { mem.dbs.clear(); await closeUserDB(); await initUserDB('u1'); });

  it('round-trips a profile', async () => {
    await bench.putProfile(profile);
    expect(await bench.profiles()).toEqual([profile]);
  });

  it('cellId is stable and distinct per field', () => {
    expect(cellId(key)).toBe(cellId({ ...key }));
    const variants = [
      { profileId: 'p2' }, { provider: 'nvidia' as const }, { model: 'x' }, { method: 'vision' as const },
      { pagesPerCall: 3 }, { imageScale: 1.5 as const }, { runNo: 2 },
    ].map(v => cellId({ ...key, ...v }));
    expect(new Set([cellId(key), ...variants]).size).toBe(8);
  });

  it('gold returns null when absent, rows when set', async () => {
    expect(await bench.gold('p1')).toBeNull();
    await bench.putGold('p1', []);
    expect(await bench.gold('p1')).toEqual([]);
  });

  it('pdf round-trips as a File', async () => {
    expect(await bench.pdf('p1')).toBeNull();
    await bench.putPdf('p1', new Blob(['x']), 'a.pdf');
    const f = await bench.pdf('p1');
    expect(f?.name).toBe('a.pdf');
  });

  it('export -> clear -> import restores data', async () => {
    await bench.putProfile(profile);
    await bench.putGold('p1', []);
    await bench.putCell(cell());
    const json = await bench.exportJson();
    await closeUserDB(); mem.dbs.clear(); await initUserDB('u1');
    expect(await bench.cells()).toEqual([]);
    await bench.importJson(json);
    expect(await bench.cells()).toEqual([cell()]);
    expect(await bench.profiles()).toEqual([profile]);
    expect(await bench.gold('p1')).toEqual([]);
  });

  it('v8 upgrade keeps existing claims', async () => {
    mem.dbs.set('surveyos-v2-u2', { version: 7, stores: new Map([['claims', { keyPath: 'id', rows: new Map([['c1', { id: 'c1' }]]) }]]) });
    await closeUserDB(); await initUserDB('u2');
    const rec = mem.dbs.get('surveyos-v2-u2')!;
    expect(rec.version).toBe(8);
    expect(rec.stores.get('claims')!.rows.get('c1')).toEqual({ id: 'c1' });
    expect(rec.stores.has('benchCells')).toBe(true);
  });
});
