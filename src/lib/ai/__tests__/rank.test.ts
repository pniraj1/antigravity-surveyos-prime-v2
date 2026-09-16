import { describe, it, expect } from 'vitest';
import { rankModels, modelStrength, PayloadTooLargeError, type PoolEntry } from '../rank';
import { createHealth, keyHash } from '../health';
import { tierOf } from '../quota';

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
    // ponytail: tier now sorts first (this task), so flash-tier models group before
    // lite/gemma regardless of verdict/strength/busy — updated from the pre-tier order.
    expect(ids(rankModels('heavy', ['i'], pool, { health: h }))).toEqual([
      'gemini-2.5-flash',          // flash tier, exact, not busy
      'gemini-3.5-flash',          // flash tier, exact, but busy 100%
      'gemini-close',              // flash tier, close
      'gemini-flash-lite-latest',  // lite tier
      'gemma4:31b',                // gemma tier
    ]);
  });
  it('heavy: untested ranks below exact/close, above nothing; wrong/failed excluded', () => {
    const pool = [entry('gemini', 'a', { verdict: 'failed' }), entry('gemini', 'b'), entry('gemini', 'c', { verdict: 'close' })];
    expect(ids(rankModels('heavy', ['i'], pool, { health: health() }))).toEqual(['c', 'b']);
  });
  it('light: tier order (lite → gemma → flash), then speed within tier', () => {
    const pool = [
      entry('ollama', 'gemma4:31b', { msPerPage: 5_000 }),
      entry('gemini', 'slow', { msPerPage: 40_000 }),
      entry('gemini', 'fast', { msPerPage: 9_000 }),
      entry('gemini', 'unknown-speed'),
    ];
    // ponytail: tier sorts first — gemma tier beats flash tier regardless of speed.
    expect(ids(rankModels('light', ['i'], pool, { health: health() }))).toEqual(['gemma4:31b', 'fast', 'unknown-speed', 'slow']);
  });
  it('light: within a tier, direct models rank before proxied even if proxied is faster', () => {
    // ponytail: tests the intra-tier proxied tiebreak; ensures direct always beats proxied at same tier
    const pool = [
      entry('gemini', 'gemini-2.5-flash', { msPerPage: 20_000 }),
      { ...entry('gemini', 'gemini-3.5-flash'), proxied: true, msPerPage: 5_000 },
    ];
    expect(ids(rankModels('light', ['i'], pool, { health: health() }))).toEqual(['gemini-2.5-flash', 'gemini-3.5-flash']);
  });
  it('text: speed then busy, no vision filter', () => {
    const pool = [entry('gemini', 'gemini-flash-lite-latest', { msPerPage: 4_000 }), entry('groq', 'llama-3.3-70b-versatile', { vision: false, msPerPage: 2_300 })];
    expect(ids(rankModels('text', [], pool, { health: health() }))).toEqual(['llama-3.3-70b-versatile', 'gemini-flash-lite-latest']);
  });
});

describe('quota-aware ordering', () => {
  const T0 = 1_000;
  const spent = (h: ReturnType<typeof createHealth>, key: string, id: string, n: number) => { for (let i = 0; i < n; i++) h.recordSpend(keyHash(key), id); };
  const pool = () => [
    entry('gemini', 'gemini-3.5-flash'),
    entry('gemini', 'gemini-2.5-flash'),
    entry('gemini', 'gemini-3.5-flash-lite'),
    entry('ollama', 'gemma4:31b'),
  ];

  it('heavy: flash tier first, then lite, then gemma', () => {
    const r = ids(rankModels('heavy', ['i'], pool(), { health: health(), pagesNeeded: 5 }));
    expect(r.map(id => tierOf(id.startsWith('gemma4') ? 'ollama' : 'gemini', id))).toEqual(['flash', 'flash', 'lite', 'gemma']);
  });
  it('heavy: inside the flash tier the model with more remaining budget goes first', () => {
    const h = createHealth(mem(), () => T0);
    spent(h, 'k', 'gemini-3.5-flash', 15);                       // 5 left
    const r = ids(rankModels('heavy', ['i'], pool(), { health: h, pagesNeeded: 5 }));
    expect(r[0]).toBe('gemini-2.5-flash');                        // 20 left beats 5 left
  });
  it('heavy: a flash model whose budget cannot cover the document is skipped — never a half-read', () => {
    const h = createHealth(mem(), () => T0);
    spent(h, 'k', 'gemini-3.5-flash', 17); spent(h, 'k', 'gemini-2.5-flash', 18);   // 3 and 2 left
    const r = ids(rankModels('heavy', ['i'], pool(), { health: h, pagesNeeded: 5 }));
    expect(r[0]).toBe('gemini-3.5-flash-lite');
    expect(r).not.toContain('gemini-3.5-flash');
  });
  it('heavy: two keys — the fuller key comes first and an empty key is dropped', () => {
    const h = createHealth(mem(), () => T0);
    spent(h, 'k1', 'gemini-3.5-flash', 18); spent(h, 'k2', 'gemini-3.5-flash', 5);
    const e = { ...entry('gemini', 'gemini-3.5-flash'), keys: ['k1', 'k2'] };
    const [first] = rankModels('heavy', ['i'], [e], { health: h, pagesNeeded: 5 });
    expect(first.keys).toEqual(['k2']);
  });
  it('heavy: dead-today key counts as zero budget', () => {
    const h = createHealth(mem(), () => T0);
    h.markDeadToday(keyHash('k'), 'gemini-3.5-flash');
    expect(ids(rankModels('heavy', ['i'], pool(), { health: h, pagesNeeded: 1 }))).not.toContain('gemini-3.5-flash');
  });
  it('light: lite first, gemma next, flash only as last resort', () => {
    expect(ids(rankModels('light', ['i'], pool(), { health: health() }))).toEqual(['gemini-3.5-flash-lite', 'gemma4:31b', 'gemini-3.5-flash', 'gemini-2.5-flash']);
  });
  it('light: falls to flash when nothing cheaper is eligible', () => {
    const h = createHealth(mem(), () => T0);
    h.markDeadToday(keyHash('k'), 'gemini-3.5-flash-lite');
    const r = ids(rankModels('light', ['i'], [entry('gemini', 'gemini-3.5-flash-lite'), entry('gemini', 'gemini-2.5-flash')], { health: h }));
    expect(r).toEqual(['gemini-2.5-flash']);
  });
  it('pro is never eligible on the free tier', () => {
    expect(ids(rankModels('heavy', ['i'], [entry('gemini', 'gemini-3.1-pro'), entry('gemini', 'gemini-2.5-flash')], { health: health() }))).toEqual(['gemini-2.5-flash']);
  });
  it('text job: lite before flash too', () => {
    expect(ids(rankModels('text', [], pool(), { health: health() }))[0]).toBe('gemini-3.5-flash-lite');
  });
  it('F2: an unlimited budget ties with the fullest inside a tier — verdict decides', () => {
    const p = [
      { ...entry('groq', 'llama-3.2-90b-vision-preview'), verdict: 'untested' as const },
      { ...entry('gemini', 'gemini-3.5-flash-lite'), verdict: 'exact' as const },
    ];
    expect(ids(rankModels('heavy', ['i'], p, { health: health() }))).toEqual([
      'gemini-3.5-flash-lite', 'llama-3.2-90b-vision-preview',
    ]);
  });
  it('budget ordering is transitive: unlimited ties the fullest finite, not every finite one', () => {
    const h = createHealth(mem(), () => T0);
    spent(h, 'k', 'gemini-3.1-flash-lite', 400); // 500 - 400 = 100 left
    const p = () => [
      { ...entry('groq', 'llama-3.2-90b-vision-preview'), verdict: 'untested' as const },       // Infinity
      { ...entry('gemini', 'gemini-3.5-flash-lite'), verdict: 'untested' as const },             // 500 left
      { ...entry('gemini', 'gemini-3.1-flash-lite'), verdict: 'untested' as const },             // 100 left
    ];
    const forward = ids(rankModels('heavy', ['i'], p(), { health: h }));
    const reversed = ids(rankModels('heavy', ['i'], [...p()].reverse(), { health: h }));
    expect(forward.indexOf('gemini-3.5-flash-lite')).toBeLessThan(forward.indexOf('gemini-3.1-flash-lite'));
    expect(reversed).toEqual(forward);
  });
});
