import { describe, it, expect } from 'vitest';
import { poolFromProbes, limitOfFor } from '../pool';
import { FALLBACK_AI_MODELS_CONFIG, emptyProviderConfig, type AIModelsConfig } from '../models-config';
import { EMPTY_PROBES, type ProbeResult, type ModelProbes } from '../probe-types';

const r = (id: string, over: Partial<ProbeResult> = {}): ProbeResult => ({ id, status: 'ok', reason: '', vision: true, imageCap: null, ctxWindow: 1e6, msPerPage: 3000, slow: false,
  source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' }, probedAt: 1, consecutiveFailures: 0, ...over });
const probes = (): ModelProbes => ({ ...EMPTY_PROBES, providers: { ...EMPTY_PROBES.providers,
  gemini: { probedAt: 1, error: null, accuracy: {}, models: { 'gemini-3.5-flash': r('gemini-3.5-flash'), 'gemini-1.5-flash': r('gemini-1.5-flash'), 'gemini-3.5-flash-lite': r('gemini-3.5-flash-lite', { imageCap: 3, msPerPage: 1500 }), 'gemini-dead': r('gemini-dead', { status: 'unreachable' }) } },
  ollama: { probedAt: 1, error: null, accuracy: {}, models: { 'gemma4:31b': r('gemma4:31b') } },
} });
const cfg = (gemini: Partial<ReturnType<typeof emptyProviderConfig>> = {}): AIModelsConfig => ({ ...FALLBACK_AI_MODELS_CONFIG, providers: { ...FALLBACK_AI_MODELS_CONFIG.providers, gemini: { ...emptyProviderConfig(), ...gemini } } });
const ids = (pool: ReturnType<typeof poolFromProbes>) => pool.map(e => `${e.provider}/${e.model.id}`).sort();

describe('poolFromProbes', () => {
  it('ok − excluded − retired, only providers with a key', () => {
    expect(ids(poolFromProbes(cfg({ excluded: ['gemini-3.5-flash-lite'] }), probes(), { gemini: ['g1'] }))).toEqual(['gemini/gemini-3.5-flash']);
  });
  it('carries probe metadata into the entry', () => {
    const [e] = poolFromProbes(cfg(), probes(), { gemini: ['g1'] }).filter(e => e.model.id === 'gemini-3.5-flash-lite');
    expect(e.model.imageCap).toBe(3); expect(e.msPerPage).toBe(1500); expect(e.keys).toEqual(['g1']); expect(e.proxied).toBe(false);
  });
  it('proxied providers are flagged', () => {
    expect(poolFromProbes(cfg(), probes(), { ollama: ['o1'] })[0].proxied).toBe(true);
  });
  it('disabled provider is skipped', () => {
    expect(poolFromProbes(cfg({ enabled: false }), probes(), { gemini: ['g1'] })).toEqual([]);
  });
  it('no probes → fallback models', () => {
    expect(ids(poolFromProbes(cfg(), null, { gemini: ['g1'] }))).toEqual(['gemini/gemini-2.5-flash', 'gemini/gemini-3.5-flash', 'gemini/gemini-flash-lite-latest']);
  });
  it('a legacy (schema 1) config is migrated on the fly', () => {
    const legacy = { ...cfg(), schema: undefined, providers: { ...cfg().providers, gemini: { enabled: true, defaultModel: 'gemini-3.5-flash', models: [{ id: 'gemini-3.5-flash', label: '', note: '', ctxWindow: null, vision: true, imageCap: null }] } as any } };
    expect(ids(poolFromProbes(legacy, probes(), { gemini: ['g1'] }))).toEqual(['gemini/gemini-3.5-flash']);
  });
});

describe('limitOfFor', () => {
  it('config limit overrides the table; blank falls back', () => {
    const f = limitOfFor(cfg({ limits: { 'gemini-3.5-flash': 50, 'gemini-3.5-flash-lite': 0 } }));
    expect(f('gemini', 'gemini-3.5-flash')).toBe(50);
    expect(f('gemini', 'gemini-3.5-flash-lite')).toBe(0);
    expect(f('gemini', 'gemini-2.5-flash')).toBe(20);
    expect(f('ollama', 'gemma4:31b')).toBe(Infinity);
  });
  it('ignores non-numeric or negative overrides', () => {
    const f = limitOfFor(cfg({ limits: { 'gemini-3.5-flash': -1, 'gemini-2.5-flash': NaN } }));
    expect(f('gemini', 'gemini-3.5-flash')).toBe(20); expect(f('gemini', 'gemini-2.5-flash')).toBe(20);
  });
});
