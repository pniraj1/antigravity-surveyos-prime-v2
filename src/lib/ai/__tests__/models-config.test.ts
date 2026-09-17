import { describe, it, expect } from 'vitest';
import { PROVIDER_IMAGE_CAPS, FALLBACK_AI_MODELS_CONFIG, mergeWithFallback } from '../models-config';

describe('constants', () => {
  it('caps NVIDIA at 1 image and Groq at 5, Gemini uncapped', () => {
    expect(PROVIDER_IMAGE_CAPS).toEqual({ gemini: null, groq: 5, nvidia: 1, ollama: null });
  });
  it('ships a non-empty fallback config for all three providers', () => {
    expect(FALLBACK_AI_MODELS_CONFIG.providers.gemini.models?.length).toBeGreaterThan(0);
    expect(FALLBACK_AI_MODELS_CONFIG.providers.groq.models?.length).toBeGreaterThan(0);
    expect(FALLBACK_AI_MODELS_CONFIG.providers.nvidia.models?.length).toBeGreaterThan(0);
  });
});

describe('ollama provider', () => {
  it('ships gemma4:31b as a vision model with no image cap', () => {
    const o = FALLBACK_AI_MODELS_CONFIG.providers.ollama;
    expect(o.enabled).toBe(true);
    expect(o.models?.map(m => m.id)).toEqual(['gemma4:31b']);
    expect(o.models?.[0].vision).toBe(true);
    expect(PROVIDER_IMAGE_CAPS.ollama).toBeNull();
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
    expect(merged.providers.gemini.models?.length).toBeGreaterThan(0); // backfilled
    expect(merged.providers.nvidia.models).toEqual([]);               // kept
  });
});
