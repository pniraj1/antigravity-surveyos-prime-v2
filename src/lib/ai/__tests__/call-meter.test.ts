import { describe, it, expect } from 'vitest';
import { parseRateLimit, usageOf, recordCall, subscribeCalls, type CallRecord } from '../call-meter';

describe('usageOf', () => {
  it('reads each provider shape', () => {
    expect(usageOf('gemini', { usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2 } })).toEqual({ tokensIn: 1, tokensOut: 2 });
    expect(usageOf('groq', { usage: { prompt_tokens: 3, completion_tokens: 4 } })).toEqual({ tokensIn: 3, tokensOut: 4 });
    expect(usageOf('nvidia', { usage: { prompt_tokens: 5, completion_tokens: 6 } })).toEqual({ tokensIn: 5, tokensOut: 6 });
    expect(usageOf('ollama', { prompt_eval_count: 7, eval_count: 8 })).toEqual({ tokensIn: 7, tokensOut: 8 });
  });
  it('gives null when absent', () => {
    for (const p of ['gemini', 'groq', 'nvidia', 'ollama'] as const) {
      expect(usageOf(p, {})).toEqual({ tokensIn: null, tokensOut: null });
      expect(usageOf(p, undefined)).toEqual({ tokensIn: null, tokensOut: null });
    }
  });
});

describe('parseRateLimit', () => {
  it('parses case-insensitively with retry-after seconds', () => {
    expect(parseRateLimit({ 'X-RateLimit-Remaining-Requests': '7', 'retry-after': '2' }))
      .toEqual({ remainingRequests: 7, retryAfterMs: 2000 });
  });
  it('parses an HTTP date retry-after', () => {
    const r = parseRateLimit({ 'retry-after': new Date(Date.now() + 10_000).toUTCString() });
    expect(r?.retryAfterMs).toBeGreaterThan(5000);
  });
  it('returns undefined when empty', () => {
    expect(parseRateLimit({})).toBeUndefined();
  });
});

describe('subscribeCalls', () => {
  it('delivers until unsubscribed', () => {
    const got: CallRecord[] = [];
    const off = subscribeCalls(r => got.push(r));
    const rec: CallRecord = { provider: 'groq', model: 'm', tokensIn: null, tokensOut: null, ms: 1, finish: 'STOP', at: 1 };
    recordCall(rec);
    off();
    recordCall(rec);
    expect(got).toEqual([rec]);
  });
});
