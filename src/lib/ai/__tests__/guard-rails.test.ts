import { describe, it, expect } from 'vitest';
import { guardRailReason, applyGuardRails } from '../guard-rails';
import { FALLBACK_AI_MODELS_CONFIG, emptyProviderConfig } from '../models-config';
import { EMPTY_PROBES, type ProbeResult, type ModelProbes } from '../probe-types';

const r = (id: string, over: Partial<ProbeResult> = {}): ProbeResult => ({ id, status: 'ok', reason: '', vision: true, imageCap: null, ctxWindow: 1e6, msPerPage: 3000, slow: false,
  source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' }, probedAt: 1, consecutiveFailures: 0, ...over });

describe('guardRailReason', () => {
  it('slow → too slow', () => { expect(guardRailReason('gemini', r('gemini-flash-latest', { slow: true, msPerPage: null }))).toBe('too slow (>90 s/page)'); });
  it.each(['gemini-3-flash-preview', 'gemini-2.0-flash-exp', 'gemini-3.5-transcribe', 'gemini-robotics-er-2-preview', 'gemini-2.5-flash-tts', 'gemini-3.1-flash-image', 'gemini-embedding-2', 'gemini-2.5-flash-audio', 'gemini-live-2.5', 'gemini-omni-flash'])
    ('%s → not a document model', id => { expect(guardRailReason('gemini', r(id))).toBe('not a document model'); });
  it.each(['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemma-4-31b-it', 'gemma4:31b', 'nemotron-3-nano:30b', 'gpt-oss:120b', 'llama-3.2-90b-vision-preview'.replace('-preview', '')])
    ('%s survives', id => { expect(guardRailReason('gemini', r(id))).toBeNull(); });
  it('text-only is not a guard-rail reason', () => { expect(guardRailReason('ollama', r('gpt-oss:20b', { vision: false }))).toBeNull(); });
});

describe('applyGuardRails', () => {
  const probes = (): ModelProbes => ({ ...EMPTY_PROBES, providers: { ...EMPTY_PROBES.providers, gemini: { probedAt: 1, error: null, accuracy: {}, models: {
    'gemini-3.5-flash': r('gemini-3.5-flash'), 'gemini-3-flash-preview': r('gemini-3-flash-preview'), 'gemini-flash-latest': r('gemini-flash-latest', { slow: true }),
  } } } });
  it('adds reasons for every ok model that trips a rail; leaves others alone', () => {
    const out = applyGuardRails(FALLBACK_AI_MODELS_CONFIG, probes());
    expect(out.providers.gemini.excluded.sort()).toEqual(['gemini-3-flash-preview', 'gemini-flash-latest']);
    expect(out.providers.gemini.excludedReason['gemini-flash-latest']).toBe('too slow (>90 s/page)');
    expect(out).not.toBe(FALLBACK_AI_MODELS_CONFIG);
  });
  it('never re-adds a model the admin chose to keep', () => {
    const cfg = { ...FALLBACK_AI_MODELS_CONFIG, providers: { ...FALLBACK_AI_MODELS_CONFIG.providers, gemini: { ...emptyProviderConfig(), keep: ['gemini-3-flash-preview'] } } };
    expect(applyGuardRails(cfg, probes()).providers.gemini.excluded).toEqual(['gemini-flash-latest']);
  });
  it('does not duplicate an existing exclusion and keeps an admin reason-less exclusion', () => {
    const cfg = { ...FALLBACK_AI_MODELS_CONFIG, providers: { ...FALLBACK_AI_MODELS_CONFIG.providers, gemini: { ...emptyProviderConfig(), excluded: ['gemini-3-flash-preview', 'gemini-3.5-flash'] } } };
    const out = applyGuardRails(cfg, probes()).providers.gemini;
    expect(out.excluded.sort()).toEqual(['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-flash-latest']);
    expect(out.excludedReason['gemini-3.5-flash']).toBeUndefined();
  });
});
