// src/lib/ai/__tests__/fallback-loop.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const toast = vi.hoisted(() => ({ warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
const callAiProxy = vi.hoisted(() => vi.fn());
vi.mock('@/lib/firebase/functions', () => ({ callAiProxy }));
vi.mock('@/lib/firebase/config', () => ({ getFirebaseApp: () => ({}), db: {} }));

import { callAIGateway, newSession, AllProvidersBusyError, OfflineError, CURRENT_MODELS, _resetNoThinkingForTests } from '../service';
import { useProfileStore } from '@/stores/profile-store';
import { useAIConfigStore } from '@/stores/ai-config-store';
import { FALLBACK_AI_MODELS_CONFIG } from '../models-config';
import { resetHealthForTests, keyHash } from '../health';

function mem() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; }

const ok = (text = '{"x":1}', finishReason = 'STOP') => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }) } as Response);
const fail = (status: number, message = 'err', quotaIds: string[] = []) => ({ ok: false, status, json: async () => ({ error: { message, ...(quotaIds.length ? { details: [{ '@type': 'QuotaFailure', violations: quotaIds.map(quotaId => ({ quotaId })) }] } : {}) } }) } as Response);
const modelOf = (call: unknown[]) => String(call[0]).match(/models\/([^:]+):/)![1];

let health: ReturnType<typeof resetHealthForTests>;
beforeEach(() => {
  health = resetHealthForTests(mem(), () => Date.UTC(2026, 8, 15, 10, 0));
  vi.stubGlobal('localStorage', mem());   // node has no localStorage; the Ollama nudge remembers itself there
  useAIConfigStore.getState().setConfig(FALLBACK_AI_MODELS_CONFIG);   // gemini: 2.5-flash, lite, 3.5-flash; ollama: gemma4
  useProfileStore.getState().updateProfile({ geminiApiKeys: ['g1'], groqApiKeys: [], nvidiaApiKeys: [], ollamaApiKeys: [], geminiModel: '' } as never);
  Object.values(toast).forEach(f => f.mockReset());
  _resetNoThinkingForTests();
});
afterEach(() => vi.restoreAllMocks());

describe('quota-aware order', () => {
  it('heavy: a Flash-tier model is tried first when its budget covers the document', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    const s = newSession('t'); s.pagesTotal = 5;
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    expect(modelOf(spy.mock.calls[0])).toMatch(/flash$/);          // 2.5-flash or 3.5-flash, not -lite
  });
  it('light: Flash-Lite is tried first — Flash quota is reserved for estimates', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    await callAIGateway('p', ['img'], 'json', 'light');
    expect(modelOf(spy.mock.calls[0])).toMatch(/lite/);
  });
  it('every call spends one unit on that key:model, including the no-thinking retry', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(400, 'Request contains an invalid argument.')).mockResolvedValueOnce(ok());
    await callAIGateway('p', ['img'], 'json', 'light');
    const m = modelOf(spy.mock.calls[0]);
    expect(health.remaining(keyHash('g1'), m, 500)).toBe(498);
  });
  it('heavy: when every Flash key is below the page count, Flash-Lite leads and the surveyor is told once', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    for (const m of ['gemini-2.5-flash', 'gemini-3.5-flash']) for (let i = 0; i < 18; i++) health.recordSpend(keyHash('g1'), m);
    const s = newSession('t'); s.pagesTotal = 5;
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    expect(modelOf(spy.mock.calls[0])).toMatch(/lite/);
    expect(toast.info.mock.calls.some(c => /Flash quota is used up/.test(String(c[0])))).toBe(true);
    toast.info.mockClear();
    await callAIGateway('p', ['img'], 'json', 'heavy', newSession('t2'));
    expect(toast.info.mock.calls.some(c => /Flash quota is used up/.test(String(c[0])))).toBe(false);   // once a day
  });
  it('heavy: with an Ollama key the Flash-exhausted toast is silent', async () => {
    useProfileStore.getState().updateProfile({ ollamaApiKeys: ['o1'] } as never);
    callAiProxy.mockResolvedValue({ ok: true, status: 200, body: JSON.stringify({ message: { content: '{"x":1}' }, done_reason: 'stop' }) });
    vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    for (const m of ['gemini-2.5-flash', 'gemini-3.5-flash']) for (let i = 0; i < 20; i++) health.recordSpend(keyHash('g1'), m);
    const s = newSession('t'); s.pagesTotal = 5;
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    expect(toast.info.mock.calls.some(c => /Flash quota/.test(String(c[0])))).toBe(false);
  });
  it('second key is used when the first cannot cover the document', async () => {
    useProfileStore.getState().updateProfile({ geminiApiKeys: ['g1', 'g2'] } as never);
    for (const m of ['gemini-2.5-flash', 'gemini-3.5-flash']) for (let i = 0; i < 18; i++) health.recordSpend(keyHash('g1'), m);
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    const s = newSession('t'); s.pagesTotal = 5;
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    expect(modelOf(spy.mock.calls[0])).toMatch(/flash$/);
    expect((spy.mock.calls[0][1]!.headers as any)['x-goog-api-key']).toBe('g2');
  });
  it('Ollama 429 → rest that model one hour and hop', async () => {
    useProfileStore.getState().updateProfile({ geminiApiKeys: [], ollamaApiKeys: ['o1'] } as never);
    callAiProxy.mockResolvedValueOnce({ ok: false, status: 429, body: 'usage limit' });
    await expect(callAIGateway('p', ['img'], 'json', 'light')).rejects.toBeInstanceOf(AllProvidersBusyError);
    expect(health.remaining(keyHash('o1'), 'gemma4:31b', Infinity)).toBe(0);
  });
  it('every model spent by the ledger → "free limit is used up" toast and AllProvidersBusyError, zero fetches', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    for (const m of ['gemini-2.5-flash', 'gemini-3.5-flash']) for (let i = 0; i < 20; i++) health.recordSpend(keyHash('g1'), m);
    for (let i = 0; i < 500; i++) health.recordSpend(keyHash('g1'), 'gemini-flash-lite-latest');
    await expect(callAIGateway('p', ['img'], 'json', 'light')).rejects.toBeInstanceOf(AllProvidersBusyError);
    expect(toast.error.mock.calls.some(c => /free limit is used up/.test(String(c[0])))).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
  it('nudge is silent when the Flash model is merely avoided, not spent', async () => {
    const s = newSession('t'); s.pagesTotal = 5;
    s.avoid.add('gemini-2.5-flash'); s.avoid.add('gemini-3.5-flash');
    vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    expect(toast.info.mock.calls.some(c => /Flash quota/.test(String(c[0])))).toBe(false);
  });
});

describe('hop before key rotation', () => {
  it('503 → next Gemini model with the same key, no in-place retry', async () => {
    useProfileStore.getState().updateProfile({ geminiApiKeys: ['g1', 'g2'] } as never);
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(503, 'high demand')).mockResolvedValueOnce(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(modelOf(spy.mock.calls[0])).not.toBe(modelOf(spy.mock.calls[1]));
    expect((spy.mock.calls[0][1]!.headers as any)['x-goog-api-key']).toBe('g1');
    expect((spy.mock.calls[1][1]!.headers as any)['x-goog-api-key']).toBe('g1');
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('per-model minute 429 → next model; per-project minute 429 → next key', async () => {
    useProfileStore.getState().updateProfile({ geminiApiKeys: ['g1', 'g2'] } as never);
    const spy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(fail(429, 'q', ['GenerateRequestsPerMinutePerProjectPerModel']))   // model A key g1 → hop model
      .mockResolvedValueOnce(fail(429, 'q', ['GenerateRequestsPerMinutePerProject']))           // model B key g1 → next key
      .mockResolvedValueOnce(ok());                                                              // model B key g2
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(modelOf(spy.mock.calls[1])).toBe(modelOf(spy.mock.calls[2]));
    expect((spy.mock.calls[2][1]!.headers as any)['x-goog-api-key']).toBe('g2');
  });

  it('per-model day 429 marks the model dead for that key and hops', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(429, 'q', ['GenerateRequestsPerDayPerProjectPerModel-FreeTier'])).mockResolvedValueOnce(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(health.isDeadToday(keyHash('g1'), modelOf(spy.mock.calls[0]))).toBe(true);
    expect(toast.info.mock.calls[0][0]).toMatch(/resets .* IST/);
  });

  it('per-project day 429 marks the whole provider dead for that key', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(429, 'q', ['GenerateRequestsPerDayPerProject']));
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toBeInstanceOf(AllProvidersBusyError);
    expect(health.isDeadToday(keyHash('g1'), 'anything')).toBe(true);
  });

  it('zero-quota 429 (day + minute) is remembered as not-found, not dead-today', async () => {
    const spy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(fail(429, 'q', ['GenerateRequestsPerDayPerProjectPerModel-FreeTier', 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier']))
      .mockResolvedValueOnce(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(health.isNotFound(modelOf(spy.mock.calls[0]))).toBe(true);
  });

  it('502 hops to the next model like a 503', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(502, 'bad gateway')).mockResolvedValueOnce(ok());
    expect(await callAIGateway('p', ['img'], 'json', 'heavy')).toBe('{"x":1}');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(modelOf(spy.mock.calls[0])).not.toBe(modelOf(spy.mock.calls[1]));
  });

  it('404 → not-found for 7 days and hop', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(404, 'not found')).mockResolvedValueOnce(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(health.isNotFound(modelOf(spy.mock.calls[0]))).toBe(true);
  });
});

describe('finish reasons', () => {
  it('MAX_TOKENS hops to the next model', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(ok('{"partial', 'MAX_TOKENS')).mockResolvedValueOnce(ok());
    expect(await callAIGateway('p', ['img'], 'json', 'heavy')).toBe('{"x":1}');
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it('SAFETY skips the rest of the provider', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(ok('', 'SAFETY'));
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toBeInstanceOf(AllProvidersBusyError);
    expect(global.fetch).toHaveBeenCalledTimes(1);   // no other provider configured; gemini abandoned after SAFETY
  });
});

describe('thinking guard', () => {
  it('a 400 mentioning thinking retries the same model once without thinkingConfig', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(400, 'thinking budget not supported')).mockResolvedValueOnce(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(modelOf(spy.mock.calls[0])).toBe(modelOf(spy.mock.calls[1]));
    expect(JSON.parse(spy.mock.calls[0][1]!.body as string).generationConfig.thinkingConfig).toBeDefined();
    expect(JSON.parse(spy.mock.calls[1][1]!.body as string).generationConfig.thinkingConfig).toBeUndefined();
  });
  it('a bare "invalid argument" 400 (gemini-3.5-flash-lite, live 2026-09-16) also retries once without thinking, then judges', async () => {
    const spy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(fail(400, 'Request contains an invalid argument.'))
      .mockResolvedValueOnce(fail(400, 'Request contains an invalid argument.'))
      .mockResolvedValueOnce(ok());
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toMatchObject({ status: 400 });
    expect(spy).toHaveBeenCalledTimes(2);   // same model twice (with, then without thinking), then the 400 is judged: other 4xx → throw
    expect(modelOf(spy.mock.calls[0])).toBe(modelOf(spy.mock.calls[1]));
    expect(JSON.parse(spy.mock.calls[1][1]!.body as string).generationConfig.thinkingConfig).toBeUndefined();
  });
});

describe('no-thinking memory', () => {
  it('a model that rejected thinking is called without it on the next chunk — no second 400', async () => {
    const s = newSession('doc-nt');
    const spy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(fail(400, 'Request contains an invalid argument.'))
      .mockResolvedValue(ok());
    await callAIGateway('p1', ['img'], 'json', 'heavy', s);   // 400 → retry without thinking → ok
    await callAIGateway('p2', ['img'], 'json', 'heavy', s);   // must go straight to no-thinking
    expect(spy).toHaveBeenCalledTimes(3);
    expect(modelOf(spy.mock.calls[2])).toBe(modelOf(spy.mock.calls[1]));
    expect(JSON.parse(spy.mock.calls[2][1]!.body as string).generationConfig.thinkingConfig).toBeUndefined();
  });
});

describe('retired models', () => {
  it('a retired id in the admin pool is never called', async () => {
    const cfg = FALLBACK_AI_MODELS_CONFIG;
    useAIConfigStore.getState().setConfig({ ...cfg, providers: { ...cfg.providers, gemini: { ...cfg.providers.gemini,
      models: [{ id: 'gemini-1.5-flash', label: '1.5', note: '', ctxWindow: null, vision: true, imageCap: null }, ...cfg.providers.gemini.models] } } });
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(modelOf(spy.mock.calls[0])).not.toBe('gemini-1.5-flash');
  });
});

describe('terminal cases', () => {
  it('401 rotates key then abandons provider', async () => {
    useProfileStore.getState().updateProfile({ geminiApiKeys: ['g1', 'g2'] } as never);
    vi.spyOn(global, 'fetch').mockResolvedValue(fail(401, 'bad key'));
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toBeInstanceOf(AllProvidersBusyError);
    expect(global.fetch).toHaveBeenCalledTimes(2);   // g1 then g2 on the first model, then out
    expect(toast.error).toHaveBeenCalled();
  });
  it('413 throws PAYLOAD_TOO_LARGE immediately', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(fail(413, 'too large'));
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toMatchObject({ status: 413 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it('all network errors → OfflineError', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toBeInstanceOf(OfflineError);
  });
  it('busy-only chain gets exactly one 5s second pass', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(fail(503, 'high demand'));
    const p = callAIGateway('p', ['img'], 'json', 'heavy');
    const assertion = expect(p).rejects.toBeInstanceOf(AllProvidersBusyError);
    await vi.advanceTimersByTimeAsync(5_100);
    await assertion;
    expect(spy).toHaveBeenCalledTimes(6);   // 3 gemini models × 2 passes
    vi.useRealTimers();
  });
  it('a skipped provider stays skipped after another provider is also skipped', async () => {
    useProfileStore.getState().updateProfile({ ollamaApiKeys: ['o1'] } as never);
    // Three busy calls push gemini-3.5-flash behind gemma4 in the ranking, so a Gemini model follows the Ollama one.
    for (let i = 0; i < 3; i++) health.recordCall('gemini-3.5-flash', 'busy');
    callAiProxy.mockRejectedValue(Object.assign(new Error('denied'), { code: 'functions/permission-denied' }));
    vi.spyOn(global, 'fetch').mockResolvedValue(fail(401, 'bad key'));
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toBeInstanceOf(AllProvidersBusyError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(toast.error.mock.calls.filter(c => /key is invalid/.test(String(c[0])))).toHaveLength(1);
  });
  it('every model dead today → day-limit message, no calls', async () => {
    health.markDeadToday(keyHash('g1'), '*');
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toBeInstanceOf(AllProvidersBusyError);
    expect(spy).not.toHaveBeenCalled();
    const msg = toast.error.mock.calls.map(c => String(c[0])).find(m => /free limit is used up/.test(m));
    expect(msg).toMatch(/IST/);
  });
  it('abort signal stops hopping', async () => {
    const ctrl = new AbortController();
    vi.spyOn(global, 'fetch').mockImplementation(async () => { ctrl.abort(); return fail(503, 'busy'); });
    await expect(callAIGateway('p', ['img'], 'json', 'heavy', undefined, ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('session stickiness', () => {
  it('chunk 2 starts on the model that served chunk 1', async () => {
    const s = newSession('doc-1');
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(503, 'busy')).mockResolvedValue(ok());
    await callAIGateway('p1', ['img'], 'json', 'heavy', s);
    await callAIGateway('p2', ['img'], 'json', 'heavy', s);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(modelOf(spy.mock.calls[2])).toBe(modelOf(spy.mock.calls[1]));
  });
  it('session.avoid skips a model', async () => {
    const s = newSession('doc-2');
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    const first = modelOf(spy.mock.calls[0]);
    s.avoid.add(first); s.lastGood = undefined;
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    expect(modelOf(spy.mock.calls[1])).not.toBe(first);
  });
});

describe('nudge', () => {
  it('AllProvidersBusy with only a Gemini key mentions Ollama once per day', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(fail(503, 'busy'));
    vi.useFakeTimers();
    for (let i = 0; i < 2; i++) { const p = callAIGateway('p', ['img'], 'json', 'heavy').catch(() => {}); await vi.advanceTimersByTimeAsync(5_100); await p; }
    vi.useRealTimers();
    const msgs = toast.error.mock.calls.map(c => String(c[0]));
    expect(msgs.filter(m => /Ollama/.test(m))).toHaveLength(1);
  });
});
