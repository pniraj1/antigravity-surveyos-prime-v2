import { describe, it, expect } from 'vitest';
import { PROVIDER_IMAGE_CAPS, FALLBACK_AI_MODELS_CONFIG, mergeWithFallback, resolveModelImageCap } from '../models-config';

describe('resolveModelImageCap', () => {
  const block = {
    enabled: true,
    defaultModel: 'probed',
    models: [
      { id: 'probed', label: 'p', note: '', ctxWindow: 128000, vision: true, imageCap: 1 },
      { id: 'unprobed', label: 'u', note: '', ctxWindow: 128000, vision: true, imageCap: null },
    ],
  };

  it('uses the probed cap recorded on the enabled model', () => {
    expect(resolveModelImageCap('nvidia', 'probed', block)).toBe(1);
  });

  it('falls back to the provider default when the model records no cap', () => {
    expect(resolveModelImageCap('groq', 'unprobed', block)).toBe(5);
  });

  it('falls back to the provider default for a model not in the block', () => {
    expect(resolveModelImageCap('nvidia', 'missing', block)).toBe(1);
  });

  it('returns null for an uncapped provider', () => {
    expect(resolveModelImageCap('gemini', 'missing', block)).toBeNull();
  });
});

describe('constants', () => {
  it('caps NVIDIA at 1 image and Groq at 5, Gemini uncapped', () => {
    expect(PROVIDER_IMAGE_CAPS).toEqual({ gemini: null, groq: 5, nvidia: 1 });
  });
  it('ships a non-empty fallback config for all three providers', () => {
    expect(FALLBACK_AI_MODELS_CONFIG.providers.gemini.models.length).toBeGreaterThan(0);
    expect(FALLBACK_AI_MODELS_CONFIG.providers.groq.models.length).toBeGreaterThan(0);
    expect(FALLBACK_AI_MODELS_CONFIG.providers.nvidia.models.length).toBeGreaterThan(0);
  });
});

describe('mergeWithFallback', () => {
  it('returns fallback when raw is null', () => {
    expect(mergeWithFallback(null)).toEqual(FALLBACK_AI_MODELS_CONFIG);
  });

  it('fills missing providers from fallback but keeps provided ones', () => {
    const raw = {
      updatedAt: 123, updatedBy: 'admin@x.com', defaultProvider: 'nvidia',
      providers: { nvidia: { enabled: true, defaultModel: 'meta/llama-3.2-90b-vision-instruct', models: [] } },
    };
    const merged = mergeWithFallback(raw as never);
    expect(merged.defaultProvider).toBe('nvidia');
    expect(merged.providers.gemini.models.length).toBeGreaterThan(0); // backfilled
    expect(merged.providers.nvidia.models).toEqual([]);               // kept
  });
});
