import { describe, it, expect, vi } from 'vitest';
import { runBench, type RunnerDeps } from '../runner';
import { createPacer, type Pacer } from '../pacer';
import type { ModelPick } from '../plan';
import type { CellResult } from '../store';
import type { CallRecord } from '../../ai/call-meter';
import type { ProviderId } from '../../ai/models-config';
import type { PdfProfile } from '../types';

const P: PdfProfile = { id: 'h', fileName: 'h.pdf', kind: 'digital', pageCount: 1, estimates: [], unreadablePages: [], confirmed: true };
const groq: ModelPick = { provider: 'groq', model: 'g', key: 'k', methods: ['vision'] };
const nv: ModelPick = { provider: 'nvidia', model: 'n', key: 'k', methods: ['vision'] };
const ok = { ok: true, ms: 1, data: {} };

function fake(behave: (provider: string, n: number) => 'ok' | 429, initial: CellResult[] = [], caps: Partial<Record<ProviderId, number>> = {}) {
  const cells = new Map(initial.map(c => [c.id, c]));
  const subs = new Set<(r: CallRecord) => void>();
  const counts: Record<string, number> = {};
  const pacers: Partial<Record<ProviderId, Pacer>> = {};
  const deps: RunnerDeps = {
    runModelTest: vi.fn(async (o) => {
      counts[o.provider] = (counts[o.provider] ?? 0) + 1;
      const b = behave(o.provider, counts[o.provider]);
      const rec: CallRecord = { provider: o.provider, model: `${o.model}-v1`, tokensIn: 10, tokensOut: 5, ms: 1, finish: b === 429 ? 'ERROR' : 'STOP', status: b === 429 ? 429 : 200, at: 0 };
      subs.forEach(f => f(rec));
      return b === 429 ? { ok: false, ms: 1, data: null, error: 'groq API Error: 429' } : ok;
    }) as unknown as RunnerDeps['runModelTest'],
    store: {
      cells: async () => [...cells.values()],
      putCell: async (c: CellResult) => { cells.set(c.id, c); },
      pdf: async () => new File(['x'], 'h.pdf'),
      gold: async () => null,
    } as unknown as RunnerDeps['store'],
    pacerFor: (p) => (pacers[p] ??= createPacer({ minGapMs: 0, dailyCap: caps[p] ?? 100, sleep: async () => {} })),
    subscribeCalls: (fn) => { subs.add(fn); return () => subs.delete(fn); },
  };
  return { deps, cells, counts };
}
const run = (deps: RunnerDeps, picks: ModelPick[]) => runBench(deps, [P], picks, ['h'], () => {}, new AbortController().signal);

describe('runBench', () => {
  it('resume skips done cells', async () => {
    const first = fake(() => 'ok');
    await run(first.deps, [groq]);
    const n = first.counts.groq;
    expect(n).toBeGreaterThan(0);
    const second = fake(() => 'ok', [...first.cells.values()]);
    await run(second.deps, [groq]);
    expect(second.counts.groq ?? 0).toBe(0);
  });

  it('a 429 → retry → ok is stored done', async () => {
    const f = fake((_p, n) => (n === 1 ? 429 : 'ok'));
    await run(f.deps, [groq]);
    const all = [...f.cells.values()];
    expect(all.every(c => c.status === 'done')).toBe(true);
    expect(all[0].modelVersion).toBe('g-v1');
    expect(all[0].tokensIn).toBe(10);
  });

  it('two 429s pause only that provider while the others continue', async () => {
    const f = fake((p) => (p === 'groq' ? 429 : 'ok'));
    await run(f.deps, [groq, nv]);
    expect(f.counts.groq).toBe(2);
    const all = [...f.cells.values()];
    expect(all.filter(c => c.provider === 'groq').map(c => c.status)).toEqual(['rate_limited']);
    expect(all.filter(c => c.provider === 'nvidia' && c.status === 'done').length).toBeGreaterThan(1);
  });

  it('capped stops the provider and keeps the remaining cells for the next run', async () => {
    const f = fake(() => 'ok', [], { groq: 2 });
    await run(f.deps, [groq]);
    expect(f.counts.groq).toBe(2);
    const g = fake(() => 'ok', [...f.cells.values()]);
    await run(g.deps, [groq]);
    expect(g.counts.groq).toBeGreaterThan(0);
  });
});
