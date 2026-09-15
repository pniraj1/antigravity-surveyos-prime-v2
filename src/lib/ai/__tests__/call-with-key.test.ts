import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const callAiProxy = vi.fn();
vi.mock('@/lib/firebase/functions', () => ({ callAiProxy: (...a: unknown[]) => callAiProxy(...a) }));

import { callWithKey, ProviderError, type AIProvider } from '../service';

const gemini: AIProvider = { name: 'gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', model: 'gemini-2.5-flash', keys: ['k'] };
const ollama: AIProvider = { name: 'ollama', endpoint: 'https://ollama.com/api/chat', model: 'gemma4:31b', keys: ['k'] };
const opts = { timeoutMs: 5_000, thinkingOff: true };

function geminiOk(text: string, finishReason = 'STOP') {
  return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }) } as Response;
}

describe('callWithKey — gemini', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the key in x-goog-api-key and thinkingBudget 0 for JSON calls', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(geminiOk('{"a":1}'));
    const r = await callWithKey(gemini, 'AQ.key', 'p', [], 'json', opts);
    expect(r).toEqual({ text: '{"a":1}', finish: 'STOP' });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe(gemini.endpoint);
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('AQ.key');
    const body = JSON.parse(init!.body as string);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('omits thinkingConfig when thinkingOff is false', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(geminiOk('x'));
    await callWithKey(gemini, 'k', 'p', [], 'json', { ...opts, thinkingOff: false });
    expect(JSON.parse(spy.mock.calls[0][1]!.body as string).generationConfig.thinkingConfig).toBeUndefined();
  });

  it('reports MAX_TOKENS and SAFETY as finish, not as errors', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(geminiOk('{"partial', 'MAX_TOKENS')).mockResolvedValueOnce(geminiOk('', 'SAFETY'));
    expect((await callWithKey(gemini, 'k', 'p', [], 'json', opts)).finish).toBe('MAX_TOKENS');
    expect((await callWithKey(gemini, 'k', 'p', [], 'json', opts)).finish).toBe('SAFETY');
  });

  it('throws ProviderError with status and parsed details on a 429', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { message: 'quota', details: [{ '@type': 'QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } }) } as Response);
    await expect(callWithKey(gemini, 'k', 'p', [], 'json', opts)).rejects.toMatchObject({ status: 429, provider: 'gemini' });
    try { await callWithKey(gemini, 'k', 'p', [], 'json', opts); } catch (e) { expect((e as ProviderError).details).toHaveLength(1); }
  });

  it('aborts after timeoutMs with a TimeoutError', async () => {
    vi.useFakeTimers();
    vi.spyOn(global, 'fetch').mockImplementation((_u, init) => new Promise((_, rej) => {
      init!.signal!.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const p = callWithKey(gemini, 'k', 'p', [], 'json', { ...opts, timeoutMs: 1_000 });
    const assertion = expect(p).rejects.toMatchObject({ name: 'TimeoutError', status: 0 });
    await vi.advanceTimersByTimeAsync(1_001);
    await assertion;
    vi.useRealTimers();
  });
});

describe('callWithKey — ollama via proxy', () => {
  beforeEach(() => callAiProxy.mockReset());

  it('posts /api/chat with base64 images, format json, and maps the reply', async () => {
    callAiProxy.mockResolvedValue({ ok: true, status: 200, body: JSON.stringify({ message: { content: '{"b":2}' }, done_reason: 'stop' }) });
    const r = await callWithKey(ollama, 'ok', 'prompt', ['data:image/jpeg;base64,AAAA'], 'json', opts);
    expect(r).toEqual({ text: '{"b":2}', finish: 'STOP' });
    expect(callAiProxy).toHaveBeenCalledWith('ollama', 'api/chat', 'ok', expect.objectContaining({
      model: 'gemma4:31b', stream: false, format: 'json',
      messages: [{ role: 'user', content: 'prompt', images: ['AAAA'] }],
    }));
  });

  it('maps done_reason length to MAX_TOKENS and a 402 to ProviderError', async () => {
    callAiProxy.mockResolvedValueOnce({ ok: true, status: 200, body: JSON.stringify({ message: { content: 'x' }, done_reason: 'length' }) });
    expect((await callWithKey(ollama, 'k', 'p', [], 'json', opts)).finish).toBe('MAX_TOKENS');
    callAiProxy.mockResolvedValueOnce({ ok: false, status: 402, body: JSON.stringify({ error: 'this model requires a subscription' }) });
    await expect(callWithKey(ollama, 'k', 'p', [], 'json', opts)).rejects.toMatchObject({ status: 402, provider: 'ollama' });
  });
});
