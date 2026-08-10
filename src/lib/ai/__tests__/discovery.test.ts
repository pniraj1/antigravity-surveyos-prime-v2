import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchNvidiaModels, fetchGroqModels } from '../discovery';
import { callNvidiaProxy } from '@/lib/firebase/functions';

// NVIDIA's API has no CORS support, so fetchNvidiaModels goes through the
// callable Cloud Function rather than fetch(). Mocking global.fetch here would
// mock something the code never calls.
vi.mock('@/lib/firebase/functions', () => ({
  callNvidiaProxy: vi.fn(),
}));

describe('fetchNvidiaModels', () => {
  afterEach(() => vi.restoreAllMocks());
  it('maps the OpenAI-style list response to ModelEntry rows', async () => {
    vi.mocked(callNvidiaProxy).mockResolvedValue({
      status: 200,
      ok: true,
      body: JSON.stringify({ data: [{ id: 'meta/llama-3.2-90b-vision-instruct' }, { id: 'meta/llama-3.2-3b-instruct' }] }),
    });
    const rows = await fetchNvidiaModels('nvapi-test');
    expect(rows).not.toBeNull();
    expect(rows!.map(r => r.id)).toEqual([
      'meta/llama-3.2-3b-instruct',
      'meta/llama-3.2-90b-vision-instruct',
    ]);

    const row = rows!.find(r => r.id === 'meta/llama-3.2-90b-vision-instruct')!;
    // Vision is NOT inferred from the id containing "vision" — that guess is
    // what stamped unusable NVIDIA models as fit for scanned estimates. The
    // probe measures it; discovery reports unknown.
    expect(row.vision).toBe(false);
    expect(row.ctxWindow).toBeNull();
    // NVIDIA NIM 400s on a second image for this model ("At most 1 image(s)
    // may be provided in one request"). This asserted null — "uncapped" —
    // which is what made the processor send 2-page chunks it rejected.
    expect(row.imageCap).toBe(1);
  });
  it('returns null on HTTP error', async () => {
    vi.mocked(callNvidiaProxy).mockResolvedValue({ status: 401, ok: false, body: '' });
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
