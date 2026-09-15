import { describe, it, expect } from 'vitest';
import { rankModels, modelStrength, PayloadTooLargeError, type PoolEntry } from '../rank';
import { createHealth, keyHash } from '../health';

function mem() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; }
const health = () => createHealth(mem(), () => 1_000);

function entry(p: PoolEntry['provider'], id: string, over: Partial<PoolEntry> & { vision?: boolean; imageCap?: number | null } = {}): PoolEntry {
  const { vision = true, imageCap = null, ...rest } = over;
  return { provider: p, proxied: p === 'nvidia' || p === 'ollama', keys: ['k'],
    model: { id, label: id, note: '', ctxWindow: 1_000_000, vision, imageCap }, ...rest };
}
const ids = (r: PoolEntry[]) => r.map(e => e.model.id);

describe('modelStrength', () => {
  it('orders by generation then tier', () => {
    expect(modelStrength('gemini-3.5-flash')).toBeGreaterThan(modelStrength('gemini-2.5-flash'));
    expect(modelStrength('gemini-2.5-flash')).toBeGreaterThan(modelStrength('gemini-flash-lite-latest'));
    expect(modelStrength('gemini-2.5-pro')).toBeGreaterThan(modelStrength('gemini-2.5-flash'));
    expect(modelStrength('gemma4:31b')).toBe(modelStrength('gemini-2.5-flash'));
  });
});

describe('eligibility', () => {
  it('heavy and light drop text-only models; text keeps them', () => {
    const pool = [entry('groq', 'llama-3.3-70b-versatile', { vision: false }), entry('gemini', 'gemini-2.5-flash')];
    expect(ids(rankModels('heavy', ['img'], pool, { health: health() }))).toEqual(['gemini-2.5-flash']);
    expect(ids(rankModels('light', ['img'], pool, { health: health() }))).toEqual(['gemini-2.5-flash']);
    expect(ids(rankModels('text', [], pool, { health: health() }))).toContain('llama-3.3-70b-versatile');
  });
  it('drops models whose image cap is below the images in this call', () => {
    const pool = [entry('nvidia', 'nemotron', { imageCap: 1 }), entry('gemini', 'gemini-2.5-flash')];
    expect(ids(rankModels('heavy', ['a', 'b'], pool, { health: health() }))).toEqual(['gemini-2.5-flash']);
  });
  it('heavy drops models with a known output limit below 16K', () => {
    const pool = [entry('groq', 'small', { outputTokens: 8_192 }), entry('gemini', 'gemini-2.5-flash', { outputTokens: 65_536 }), entry('gemini', 'unknown-out')];
    expect(ids(rankModels('heavy', ['img'], pool, { health: health() }))).toEqual(expect.arrayContaining(['gemini-2.5-flash', 'unknown-out']));
    expect(ids(rankModels('heavy', ['img'], pool, { health: health() }))).not.toContain('small');
  });
  it('skips dead-today, not-found and avoided models', () => {
    const h = health();
    h.markNotFound('gemini-3.5-flash');
    const pool = [entry('gemini', 'gemini-2.5-flash', { keys: ['kh-key'] }), entry('gemini', 'gemini-3.5-flash'), entry('gemini', 'gemini-flash-lite-latest'), entry('ollama', 'gemma4:31b')];
    // keyHash('kh-key') is what the ranker checks; mark with the real hash:
    h.markDeadToday(keyHash('kh-key'), 'gemini-2.5-flash');
    const r = rankModels('heavy', ['img'], pool, { health: h, avoid: new Set(['gemma4:31b']) });
    expect(ids(r)).toEqual(['gemini-flash-lite-latest']);
  });
  it('a model is dead only for the key that hit the limit', () => {
    const h = health();
    h.markDeadToday(keyHash('k1'), 'gemini-2.5-flash');
    const r = rankModels('heavy', ['img'], [entry('gemini', 'gemini-2.5-flash', { keys: ['k1', 'k2'] })], { health: h });
    expect(r).toHaveLength(1);
    expect(r[0].keys).toEqual(['k2']);
  });
  it('throws PayloadTooLargeError when vision is needed, nothing fits, and the call has >1 image', () => {
    const pool = [entry('nvidia', 'nemotron', { imageCap: 1 })];
    expect(() => rankModels('heavy', ['a', 'b'], pool, { health: health() })).toThrow(PayloadTooLargeError);
    expect(rankModels('heavy', ['a'], pool, { health: health() })).toHaveLength(1);
  });
  it('returns [] (not throw) when the pool is simply empty', () => {
    expect(rankModels('heavy', ['a'], [], { health: health() })).toEqual([]);
  });
  it('returns [] (no throw) when no model in the pool has vision at all', () => {
    const pool = [entry('groq', 'llama-3.3-70b-versatile', { vision: false })];
    expect(rankModels('heavy', ['a', 'b'], pool, { health: health() })).toEqual([]);
  });
});

describe('ordering', () => {
  it('preferred model goes first when eligible', () => {
    const pool = [entry('gemini', 'gemini-2.5-flash'), entry('gemini', 'gemini-flash-lite-latest')];
    expect(ids(rankModels('heavy', ['i'], pool, { health: health(), preferredModel: 'gemini-flash-lite-latest' }))[0]).toBe('gemini-flash-lite-latest');
  });
  it('heavy: verdict, then strength, then busy rate, then time; proxied after direct', () => {
    const h = health();
    for (let i = 0; i < 3; i++) h.recordCall('gemini-3.5-flash', 'busy');
    const pool = [
      entry('ollama', 'gemma4:31b', { verdict: 'exact', msPerPage: 11_000 }),
      entry('gemini', 'gemini-flash-lite-latest', { verdict: 'exact', msPerPage: 6_000 }),
      entry('gemini', 'gemini-2.5-flash', { verdict: 'exact', msPerPage: 30_000 }),
      entry('gemini', 'gemini-3.5-flash', { verdict: 'exact' }),
      entry('gemini', 'gemini-close', { verdict: 'close' }),
      entry('gemini', 'gemini-wrong', { verdict: 'wrong' }),
    ];
    expect(ids(rankModels('heavy', ['i'], pool, { health: h }))).toEqual([
      'gemini-2.5-flash',          // exact, strength 2.5-flash, not busy
      'gemini-flash-lite-latest',  // exact, lite
      'gemma4:31b',                // exact, same strength as 2.5-flash but proxied → after all direct exact
      'gemini-3.5-flash',          // exact, strongest, but busy 100%
      'gemini-close',
    ]);
  });
  it('heavy: untested ranks below exact/close, above nothing; wrong/failed excluded', () => {
    const pool = [entry('gemini', 'a', { verdict: 'failed' }), entry('gemini', 'b'), entry('gemini', 'c', { verdict: 'close' })];
    expect(ids(rankModels('heavy', ['i'], pool, { health: health() }))).toEqual(['c', 'b']);
  });
  it('light: fast models first, slow ones kept after, proxied always last', () => {
    const pool = [
      entry('ollama', 'gemma4:31b', { msPerPage: 5_000 }),
      entry('gemini', 'slow', { msPerPage: 40_000 }),
      entry('gemini', 'fast', { msPerPage: 9_000 }),
      entry('gemini', 'unknown-speed'),
    ];
    expect(ids(rankModels('light', ['i'], pool, { health: health() }))).toEqual(['fast', 'unknown-speed', 'slow', 'gemma4:31b']);
  });
  it('text: speed then busy, no vision filter', () => {
    const pool = [entry('gemini', 'gemini-flash-lite-latest', { msPerPage: 4_000 }), entry('groq', 'llama-3.3-70b-versatile', { vision: false, msPerPage: 2_300 })];
    expect(ids(rankModels('text', [], pool, { health: health() }))).toEqual(['llama-3.3-70b-versatile', 'gemini-flash-lite-latest']);
  });
});
