import { describe, it, expect } from 'vitest';
import { nextCell, plannedCalls, planEstimate, type ModelPick } from '../plan';
import { cellId, type CellKey, type CellResult } from '../store';
import type { BenchError, PdfProfile } from '../types';

const prof = (id: string, pageCount = 4): PdfProfile => ({ id, fileName: `${id}.pdf`, kind: 'digital', pageCount, estimates: [], unreadablePages: [], confirmed: true });
const pick: ModelPick = { provider: 'groq', model: 'm', key: 'k', methods: ['vision'] };
const miss: BenchError = { type: 'missed', estimate: 'E1', page: 1, srNo: 1, detail: '' };
const cell = (profileId: string, pagesPerCall: number, imageScale: CellKey['imageScale'], runNo: number, ok: boolean, status: CellResult['status'] = 'done'): CellResult => {
  const k: CellKey = { profileId, provider: 'groq', model: 'm', method: 'vision', pagesPerCall, imageScale, runNo };
  return { ...k, id: cellId(k), status, rows: [], errors: ok ? [] : [miss], calls: [], tokensIn: 0, tokensOut: 0, ms: 0, modelVersion: 'm', at: 0 };
};
const P = prof('h');
const pick3 = (k: CellKey | null) => k && [k.pagesPerCall, k.imageScale, k.runNo];

describe('nextCell hard set', () => {
  it('starts at 1 page, scale 1.5', () => expect(pick3(nextCell([], P, pick, 'hard'))).toEqual([1, 1.5, 1]));
  it('pass@1, pass@2, fail@3 → repeat@3', () => {
    const d = [cell('h', 1, 1.5, 1, true), cell('h', 2, 1.5, 1, true), cell('h', 3, 1.5, 1, false)];
    expect(pick3(nextCell(d, P, pick, 'hard'))).toEqual([3, 1.5, 2]);
  });
  it('repeat@3 fails → stop, scales next at 2', () => {
    const d = [cell('h', 1, 1.5, 1, true), cell('h', 2, 1.5, 1, true), cell('h', 3, 1.5, 1, false), cell('h', 3, 1.5, 2, false)];
    expect(pick3(nextCell(d, P, pick, 'hard'))).toEqual([2, 1.25, 1]);
    expect(pick3(nextCell([...d, cell('h', 2, 1.25, 1, true)], P, pick, 'hard'))).toEqual([2, 1, 1]);
    expect(nextCell([...d, cell('h', 2, 1.25, 1, false)], P, pick, 'hard')).toBeNull();
  });
  it('borderline: fail@3 then pass@3 → a 3rd run@3', () => {
    const d = [cell('h', 1, 1.5, 1, true), cell('h', 2, 1.5, 1, true), cell('h', 3, 1.5, 1, false), cell('h', 3, 1.5, 2, true)];
    expect(pick3(nextCell(d, P, pick, 'hard'))).toEqual([3, 1.5, 3]);
  });
  it('rate_limited cell is re-queued with the same key', () => {
    const d = [cell('h', 1, 1.5, 1, true), cell('h', 2, 1.5, 1, true, 'rate_limited')];
    expect(pick3(nextCell(d, P, pick, 'hard'))).toEqual([2, 1.5, 1]);
  });
});

describe('nextCell wide set', () => {
  it('gives exactly one cell at proposed pages and best hard scale', () => {
    const hard = [cell('h', 2, 1.25, 1, true)];
    const k = nextCell(hard, prof('w'), pick, 'wide', 2);
    expect(pick3(k)).toEqual([2, 1.25, 1]);
    expect(nextCell([...hard, cell('w', 2, 1.25, 1, true)], prof('w'), pick, 'wide', 2)).toBeNull();
  });
});

describe('plannedCalls / planEstimate', () => {
  it('13 pages at 1/2/3/4 = 13/7/5/4', () => {
    expect([1, 2, 3, 4].map(n => plannedCalls(prof('x', 13), n))).toEqual([13, 7, 5, 4]);
  });
  it('upper bound per provider', () => {
    // hard 4 pages: 3*(4+2+2+1)+2*4 = 35; wide 4 pages: 4
    expect(planEstimate([prof('h'), prof('w')], [pick], ['h']).groq).toBe(39);
  });
});
