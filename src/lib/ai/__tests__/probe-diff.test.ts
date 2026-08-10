import { describe, it, expect } from 'vitest';
import { diffProbes } from '../probe-diff';
import type { ProbeResult, ProviderProbe } from '../probe-types';

function result(id: string, over: Partial<ProbeResult> = {}): ProbeResult {
  return {
    id,
    status: 'ok',
    reason: '',
    vision: true,
    imageCap: 1,
    ctxWindow: 128000,
    msPerPage: 30000,
    slow: false,
    source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' },
    probedAt: 1,
    consecutiveFailures: 0,
    ...over,
  };
}

function probe(...results: ProbeResult[]): ProviderProbe {
  return {
    probedAt: 1,
    error: null,
    models: Object.fromEntries(results.map(r => [r.id, r])),
  };
}

describe('diffProbes', () => {
  it('flags the first ever probe and suppresses the New group', () => {
    const d = diffProbes(null, probe(result('a'), result('b')));
    expect(d.isFirstProbe).toBe(true);
    expect(d.added).toEqual([]);
    expect(d.working.map(r => r.id).sort()).toEqual(['a', 'b']);
  });

  it('treats a previous probe with no models as the first probe', () => {
    const d = diffProbes(probe(), probe(result('a')));
    expect(d.isFirstProbe).toBe(true);
    expect(d.added).toEqual([]);
  });

  it('reports models absent from the previous probe as added', () => {
    const d = diffProbes(probe(result('a')), probe(result('a'), result('b')));
    expect(d.isFirstProbe).toBe(false);
    expect(d.added).toEqual(['b']);
  });

  it('reports a model that was ok and now fails as gone, with its reason', () => {
    const d = diffProbes(
      probe(result('a'), result('b')),
      probe(result('a'), result('b', { status: 'unreachable', reason: 'Not found for account' })),
    );
    expect(d.gone).toEqual([{ id: 'b', reason: 'Not found for account' }]);
    expect(d.working.map(r => r.id)).toEqual(['a']);
  });

  it('reports a model that vanished from the catalogue entirely as gone', () => {
    const d = diffProbes(probe(result('a'), result('b')), probe(result('a')));
    expect(d.gone).toEqual([{ id: 'b', reason: 'No longer listed by the provider.' }]);
  });

  it('does not report a model as gone if it was already failing', () => {
    const d = diffProbes(
      probe(result('a'), result('b', { status: 'error', reason: 'x' })),
      probe(result('a')),
    );
    expect(d.gone).toEqual([]);
  });

  it('reports a model that returns after being gone as added', () => {
    const d = diffProbes(
      probe(result('a'), result('b', { status: 'unreachable', reason: 'x' })),
      probe(result('a'), result('b')),
    );
    expect(d.added).toEqual(['b']);
  });

  it('ranks working models fastest first', () => {
    const d = diffProbes(null, probe(
      result('slow-ish', { msPerPage: 90000 }),
      result('quick', { msPerPage: 27000 }),
      result('middle', { msPerPage: 61000 }),
    ));
    expect(d.working.map(r => r.id)).toEqual(['quick', 'middle', 'slow-ish']);
  });

  it('ranks models that hit the cutoff last, regardless of order', () => {
    const d = diffProbes(null, probe(
      result('over-cutoff', { msPerPage: null, slow: true }),
      result('quick', { msPerPage: 27000 }),
    ));
    expect(d.working.map(r => r.id)).toEqual(['quick', 'over-cutoff']);
  });
});
