import { describe, it, expect } from 'vitest';
import { rankedLists, lastEligibleFor, discoveryCounts, ADMIN_JOBS } from '../admin-rank';
import { FALLBACK_AI_MODELS_CONFIG, emptyProviderConfig } from '../models-config';
import { EMPTY_PROBES, type ProbeResult, type ModelProbes } from '../probe-types';

const r = (id: string, over: Partial<ProbeResult> = {}): ProbeResult => ({ id, status: 'ok', reason: '', vision: true, imageCap: null, ctxWindow: 1e6, msPerPage: 3000, slow: false,
  source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' }, probedAt: 1, consecutiveFailures: 0, ...over });
const probes = (): ModelProbes => ({ ...EMPTY_PROBES, providers: { ...EMPTY_PROBES.providers,
  gemini: { probedAt: 1, error: null, accuracy: {}, models: { 'gemini-3.5-flash': r('gemini-3.5-flash'), 'gemini-3.5-flash-lite': r('gemini-3.5-flash-lite', { msPerPage: 1500 }), 'gemini-text': r('gemini-text', { vision: false }) } },
  ollama: { probedAt: 1, error: null, accuracy: {}, models: { 'gemma4:31b': r('gemma4:31b', { msPerPage: 12000 }) } },
} });
const cfg = FALLBACK_AI_MODELS_CONFIG;

describe('rankedLists', () => {
  it('three jobs in the loop order: heavy leads with Flash, light with Flash-Lite', () => {
    const lists = rankedLists(cfg, probes(), new Set(['gemma4:31b']));
    expect(ADMIN_JOBS.map(j => j.job)).toEqual(['heavy', 'light', 'text']);
    expect(lists.heavy[0].id).toBe('gemini-3.5-flash');
    expect(lists.light[0].id).toBe('gemini-3.5-flash-lite');
    expect(lists.heavy.map(x => x.id)).not.toContain('gemini-text');       // vision needed
    expect(lists.text.map(x => x.id)).toContain('gemini-text');
  });
  it('rows carry tier, limit, speed, proxied, NEW and a plain reason', () => {
    const row = rankedLists(cfg, probes(), new Set(['gemma4:31b'])).heavy.find(x => x.id === 'gemma4:31b')!;
    expect(row).toMatchObject({ tier: 'gemma', limit: Infinity, msPerPage: 12000, proxied: true, isNew: true });
    expect(row.reason).toBe('Gemma tier · no daily cap · 12 s/page · via proxy');
    expect(rankedLists(cfg, probes(), new Set()).heavy[0].reason).toBe('Flash tier · 20/day per key · 3 s/page');
  });
  it('excluded models are absent; a config limit shows in the row', () => {
    const c = { ...cfg, providers: { ...cfg.providers, gemini: { ...emptyProviderConfig(), excluded: ['gemini-3.5-flash'], limits: { 'gemini-3.5-flash-lite': 300 } } } };
    const lists = rankedLists(c, probes(), new Set());
    expect(lists.heavy.map(x => x.id)).not.toContain('gemini-3.5-flash');
    expect(lists.light[0]).toMatchObject({ id: 'gemini-3.5-flash-lite', limit: 300 });
  });
});

describe('lastEligibleFor', () => {
  it('names the job that would be left empty', () => {
    // groq/nvidia fall back to their default model even with no probe data (poolFromProbes),
    // so they must be excluded too or 'text' (vision-optional) never actually empties.
    const c = { ...cfg, providers: { ...cfg.providers, gemini: { ...emptyProviderConfig(), excluded: ['gemini-3.5-flash', 'gemini-3.5-flash-lite'] }, ollama: { ...emptyProviderConfig(), excluded: ['gemma4:31b'] },
      groq: { ...emptyProviderConfig(), excluded: ['qwen/qwen3.6-27b'] }, nvidia: { ...emptyProviderConfig(), excluded: ['meta/llama-3.2-90b-vision-instruct'] } } };
    expect(lastEligibleFor(c, probes(), 'gemini', 'gemini-text')).toBe('Letters & text');
  });
  it('null when other models remain', () => { expect(lastEligibleFor(cfg, probes(), 'gemini', 'gemini-3.5-flash')).toBeNull(); });
});

describe('discoveryCounts', () => {
  it('splits found into in-chain, auto-excluded, excluded-by-you and hidden', () => {
    const probe = { probedAt: 1, error: null, accuracy: {}, models: {
      a: r('a'), b: r('b'), c: r('c'), d: r('d', { status: 'paid' }), e: r('e', { status: 'unreachable' }) } };
    const block = { ...emptyProviderConfig(), excluded: ['b', 'c', 'zz'], excludedReason: { b: 'too slow' } };
    expect(discoveryCounts(block, probe)).toEqual({ found: 5, inChain: 1, autoExcluded: 1, byAdmin: 1, hidden: 2 });
  });
});
