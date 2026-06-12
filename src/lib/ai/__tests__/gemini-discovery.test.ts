import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchGeminiModelEntries } from '../service';

describe('fetchGeminiModelEntries', () => {
  afterEach(() => vi.restoreAllMocks());
  it('maps ListModels into ModelEntry with ctxWindow + vision + uncapped images', async () => {
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
    expect(rows![0]).toMatchObject({ id: 'gemini-3.5-flash', vision: true, imageCap: null, ctxWindow: 1048576 });
  });
});
