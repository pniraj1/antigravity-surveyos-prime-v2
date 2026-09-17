import { describe, it, expect } from 'vitest';
import { migrateConfig, emptyProviderConfig, FALLBACK_AI_MODELS_CONFIG, type AIModelsConfig } from '../models-config';
import { EMPTY_PROBES, type ModelProbes } from '../probe-types';

const ok = (id: string) => ({ id, status: 'ok' as const, reason: '', vision: true, imageCap: null, ctxWindow: 1_000_000, msPerPage: 3000, slow: false,
  source: { vision: 'probe' as const, imageCap: 'probe' as const, ctxWindow: 'probe' as const }, probedAt: 1, consecutiveFailures: 0 });
const probes = (): ModelProbes => ({ ...EMPTY_PROBES, providers: { ...EMPTY_PROBES.providers,
  gemini: { probedAt: 1, error: null, accuracy: {}, models: { 'gemini-2.5-flash': ok('gemini-2.5-flash'), 'gemini-3.5-flash': ok('gemini-3.5-flash'), 'gemini-3.5-flash-lite': ok('gemini-3.5-flash-lite') } } } });
const legacy = (models: { id: string; note?: string }[]): AIModelsConfig => ({
  ...FALLBACK_AI_MODELS_CONFIG, schema: undefined,
  providers: { ...FALLBACK_AI_MODELS_CONFIG.providers,
    gemini: { enabled: true, defaultModel: models[0]?.id ?? '', models: models.map(m => ({ id: m.id, label: m.id, note: m.note ?? '', ctxWindow: null, vision: true, imageCap: null })) } as any },
});

describe('migrateConfig', () => {
  it('non-empty tick list → excluded is the complement of probe-ok', () => {
    const out = migrateConfig(legacy([{ id: 'gemini-2.5-flash' }]), probes());
    expect(out.schema).toBe(2);
    expect(out.providers.gemini.excluded.sort()).toEqual(['gemini-3.5-flash', 'gemini-3.5-flash-lite']);
    expect(out.providers.gemini.excludedReason).toEqual({});
    expect(out.providers.gemini.keep).toEqual([]);
    expect(out.providers.gemini.limits).toEqual({});
  });
  it('empty tick list → nothing excluded', () => {
    expect(migrateConfig(legacy([]), probes()).providers.gemini.excluded).toEqual([]);
  });
  it('no probes yet → nothing excluded (the tick list cannot be inverted)', () => {
    expect(migrateConfig(legacy([{ id: 'gemini-2.5-flash' }]), null).providers.gemini.excluded).toEqual([]);
  });
  it('notes carried from ModelEntry.note', () => {
    expect(migrateConfig(legacy([{ id: 'gemini-2.5-flash', note: 'best' }]), probes()).providers.gemini.notes).toEqual({ 'gemini-2.5-flash': 'best' });
  });
  it('legacy fields are written empty, not dropped (2-D removes them)', () => {
    const out = migrateConfig(legacy([{ id: 'gemini-2.5-flash' }]), probes());
    expect(out.providers.gemini.models).toEqual([]);
    expect(out.providers.gemini.defaultModel).toBe('');
  });
  it('schema 2 in → same object out', () => {
    const v2: AIModelsConfig = { ...FALLBACK_AI_MODELS_CONFIG, schema: 2, providers: { ...FALLBACK_AI_MODELS_CONFIG.providers, gemini: { ...emptyProviderConfig(), excluded: ['x'] } } };
    expect(migrateConfig(v2, probes())).toBe(v2);
  });
  it('every provider block gets all v2 fields even when missing from the stored doc', () => {
    const out = migrateConfig({ ...legacy([]), providers: { gemini: legacy([]).providers.gemini } as any }, probes());
    for (const p of ['gemini', 'groq', 'nvidia', 'ollama'] as const) {
      expect(out.providers[p]).toMatchObject({ excluded: expect.any(Array), excludedReason: {}, keep: [], limits: {}, notes: expect.any(Object) });
    }
  });
});
