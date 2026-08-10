import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchGeminiModelEntries } from '../service';

describe('fetchGeminiModelEntries', () => {
  afterEach(() => vi.restoreAllMocks());
  it('maps ListModels into ModelEntry, leaving vision for the probe to measure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ models: [
        { name: 'models/gemini-3.5-flash', displayName: '3.5 Flash', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-004', displayName: 'Embed', supportedGenerationMethods: ['embedContent'] },
      ] }),
    } as Response);
    const rows = await fetchGeminiModelEntries('AIza-test');
    expect(rows).not.toBeNull();
    expect(rows!.length).toBe(1);
    // ctxWindow and imageCap come from provider metadata, which is reliable.
    // vision does not — discovery no longer asserts that every gemini-* model
    // is multimodal, because that was a guess. The probe measures it by making
    // the model read a code that is only present in the fixture's pixels.
    expect(rows![0]).toMatchObject({ id: 'gemini-3.5-flash', vision: false, imageCap: null, ctxWindow: 1048576 });
  });
});
