// src/lib/ai/__tests__/fallback-loop.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const toast = vi.hoisted(() => ({ warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/lib/firebase/functions', () => ({ callAiProxy: vi.fn() }));
vi.mock('@/lib/firebase/config', () => ({ getFirebaseApp: () => ({}), db: {} }));

import { callAIGateway, newSession, AllProvidersBusyError, OfflineError } from '../service';
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
});
afterEach(() => vi.restoreAllMocks());

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
