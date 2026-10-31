import type { ProviderId } from './models-config';
import type { Finish } from './service';

export interface RateLimitInfo { limitRequests?: number; remainingRequests?: number; limitTokens?: number; remainingTokens?: number; retryAfterMs?: number }
export interface CallRecord {
  provider: ProviderId; model: string; tokensIn: number | null; tokensOut: number | null;
  ms: number; finish: Finish | 'ERROR'; status?: number; rateLimit?: RateLimitInfo; at: number;
}

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const orNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parseRateLimit(h: Record<string, string | null | undefined>): RateLimitInfo | undefined {
  const lc: Record<string, string | null | undefined> = {};
  for (const k of Object.keys(h)) lc[k.toLowerCase()] = h[k];
  const out: RateLimitInfo = {};
  const set = <K extends keyof RateLimitInfo>(k: K, v: number | undefined) => { if (v !== undefined) out[k] = v; };
  set('limitRequests', num(lc['x-ratelimit-limit-requests']));
  set('remainingRequests', num(lc['x-ratelimit-remaining-requests']));
  set('limitTokens', num(lc['x-ratelimit-limit-tokens']));
  set('remainingTokens', num(lc['x-ratelimit-remaining-tokens']));
  const ra = lc['retry-after'];
  if (ra) {
    const secs = num(ra);
    if (secs !== undefined) out.retryAfterMs = secs * 1000;
    else {
      const t = Date.parse(ra);
      if (!Number.isNaN(t)) out.retryAfterMs = Math.max(0, t - Date.now());
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function usageOf(provider: ProviderId, body: any): { tokensIn: number | null; tokensOut: number | null } {
  const b = body ?? {};
  if (provider === 'gemini') return { tokensIn: orNull(b.usageMetadata?.promptTokenCount), tokensOut: orNull(b.usageMetadata?.candidatesTokenCount) };
  if (provider === 'ollama') return { tokensIn: orNull(b.prompt_eval_count), tokensOut: orNull(b.eval_count) };
  return { tokensIn: orNull(b.usage?.prompt_tokens), tokensOut: orNull(b.usage?.completion_tokens) };
}

const listeners = new Set<(r: CallRecord) => void>();

export function recordCall(r: CallRecord): void {
  for (const fn of [...listeners]) { try { fn(r); } catch { /* a bad subscriber must not break calls */ } }
}

export function subscribeCalls(fn: (r: CallRecord) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Bench-only hook awaited at the top of every callWithKey (pacing per API call). Unset in live use.
let beforeCallHook: ((provider: ProviderId) => Promise<void>) | null = null;
export function setBeforeCall(fn: ((provider: ProviderId) => Promise<void>) | null): void { beforeCallHook = fn; }
export async function beforeCall(provider: ProviderId): Promise<void> { if (beforeCallHook) await beforeCallHook(provider); }
