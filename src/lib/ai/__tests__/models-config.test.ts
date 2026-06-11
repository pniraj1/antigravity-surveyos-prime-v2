import { describe, it, expect } from 'vitest';
import { computeEstimateCapacity, PROVIDER_IMAGE_CAPS, FALLBACK_AI_MODELS_CONFIG, mergeWithFallback } from '../models-config';

describe('computeEstimateCapacity', () => {
  it('flags text-only models as unfit for scanned estimates', () => {
    expect(computeEstimateCapacity({ vision: false, ctxWindow: 128000, imageCap: null }))
      .toBe('text only · not for scanned estimates');
  });

  it('warns when image cap is 5 or fewer (Groq)', () => {
    expect(computeEstimateCapacity({ vision: true, ctxWindow: 131072, imageCap: 5 }))
      .toBe('vision · max 5 images · not ideal for 6-page scans');
  });

  it('approves uncapped vision models with a context badge', () => {
    expect(computeEstimateCapacity({ vision: true, ctxWindow: 1_000_000, imageCap: null }))
      .toBe('vision · ~1M ctx · handles 6+ page scanned estimates');
  });

  it('omits the context badge when ctxWindow is unknown', () => {
    expect(computeEstimateCapacity({ vision: true, ctxWindow: null, imageCap: null }))
      .toBe('vision · handles 6+ page scanned estimates');
  });
});

describe('constants', () => {
  it('caps Groq at 5 images, others uncapped', () => {
    expect(PROVIDER_IMAGE_CAPS).toEqual({ gemini: null, groq: 5, nvidia: null });
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
