import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { proposeLimits, limitsSource } from '../export-limits';
import { cellId, type CellKey, type CellResult } from '../store';
import type { BenchError, BenchRow } from '../types';

const miss: BenchError = { type: 'missed', estimate: 'E1', page: 1, srNo: 1, detail: '' };
const row = (page: number): BenchRow => ({ section: 'spare_parts', srNo: null, description: '', qty: null, rate: null, amount: 1, taxable: null, page });
const cell = (profileId: string, pagesPerCall: number, runNo: number, ok: boolean, rows: BenchRow[] = [], imageScale: CellKey['imageScale'] = 1.5): CellResult => {
  const k: CellKey = { profileId, provider: 'groq', model: 'm', method: 'vision', pagesPerCall, imageScale, runNo };
  return { ...k, id: cellId(k), status: 'done', rows, errors: ok ? [] : [miss], calls: [], tokensIn: 0, tokensOut: 0, ms: 0, modelVersion: 'v1', at: Date.UTC(2026, 9, 31) };
};

describe('proposeLimits', () => {
  it('picks 2 when 3 failed', () => {
    const rows = [row(1), row(1), row(2), row(3)];
    const cells = [cell('h', 1, 1, true, rows), cell('h', 1, 2, true, rows), cell('h', 2, 1, true, rows), cell('h', 2, 2, true, rows), cell('h', 3, 1, false), cell('h', 3, 2, false)];
    const [l] = proposeLimits(cells, ['h']);
    expect(l).toMatchObject({ model: 'm', method: 'vision', maxPagesPerCall: 2, maxRowsPerCall: 3, imageScale: 1.5, modelVersion: 'v1' });
  });
  it('cheapest passing scale', () => {
    const cells = [cell('h', 1, 1, true, [row(1)]), cell('h', 1, 2, true, [row(1)]), cell('h', 1, 1, true, [row(1)], 1)];
    expect(proposeLimits(cells, ['h'])[0].imageScale).toBe(1);
  });
  it('a single passing run is not enough', () => {
    expect(proposeLimits([cell('h', 1, 1, true, [row(1)])], ['h'])).toEqual([]);
  });
  it('the chosen scale must pass on every hard PDF', () => {
    const ok = (id: string) => [cell(id, 1, 1, true, [row(1)]), cell(id, 1, 2, true, [row(1)])];
    const cells = [...ok('a'), ...ok('b'), cell('a', 1, 1, true, [row(1)], 1)];
    expect(proposeLimits(cells, ['a', 'b'])[0].imageScale).toBe(1.5);
  });
  it('a failing wide cell at that setting rules it out', () => {
    expect(proposeLimits([cell('h', 1, 1, true, [row(1)]), cell('h', 1, 2, true, [row(1)]), cell('w', 1, 1, false)], ['h'])).toEqual([]);
  });
});

describe('limitsSource', () => {
  it('empty table equals the committed page-limits.ts', () => {
    const file = readFileSync(new URL('../../ai/page-limits.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(limitsSource([])).toBe(file);
  });
  it('embeds the limits as data', () => {
    const l = proposeLimits([cell('h', 1, 1, true, [row(1)]), cell('h', 1, 2, true, [row(1)])], ['h']);
    expect(limitsSource(l)).toContain('"maxRowsPerCall": 1');
  });
});
