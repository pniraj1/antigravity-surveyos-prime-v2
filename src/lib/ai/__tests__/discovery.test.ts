import { describe, it, expect, vi, afterEach } from 'vitest';
import { isLikelyVisionModel, fetchNvidiaModels, fetchGroqModels } from '../discovery';

describe('isLikelyVisionModel', () => {
  it('matches known vision families', () => {
    ['meta/llama-3.2-90b-vision-instruct', 'meta/llama-4-maverick-17b-128e-instruct',
     'google/gemma-3-12b-it', 'microsoft/phi-3-vision-128k-instruct',
     'nvidia/nemotron-nano-12b-v2-vl'].forEach(id =>
      expect(isLikelyVisionModel(id)).toBe(true));
  });
  it('rejects text-only / embedding / safety models', () => {
    ['meta/llama-3.2-3b-instruct', 'nvidia/llama-3.2-nv-embedqa-1b-v1',
     'nvidia/nemotron-content-safety-reasoning-4b'].forEach(id =>
      expect(isLikelyVisionModel(id)).toBe(false));
  });
});

describe('fetchNvidiaModels', () => {
  afterEach(() => vi.restoreAllMocks());
  it('maps the OpenAI-style list response to ModelEntry rows', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'meta/llama-3.2-90b-vision-instruct' }, { id: 'meta/llama-3.2-3b-instruct' }] }),
    } as Response);
    const rows = await fetchNvidiaModels('nvapi-test');
    expect(rows).not.toBeNull();
    const vision = rows!.find(r => r.id === 'meta/llama-3.2-90b-vision-instruct');
    expect(vision!.vision).toBe(true);
    expect(vision!.imageCap).toBeNull();
    expect(rows!.find(r => r.id === 'meta/llama-3.2-3b-instruct')!.vision).toBe(false);
  });
  it('returns null on HTTP error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    expect(await fetchNvidiaModels('bad')).toBeNull();
  });
});

describe('fetchGroqModels', () => {
  afterEach(() => vi.restoreAllMocks());
  it('maps Groq list response and caps images at 5', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'meta-llama/llama-4-scout-17b-16e-instruct' }] }),
    } as Response);
    const rows = await fetchGroqModels('gsk-test');
    expect(rows![0].imageCap).toBe(5);
  });
});
