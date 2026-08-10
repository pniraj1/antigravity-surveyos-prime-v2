import type { ProbeStatus } from './probe-types';

/**
 * Turns a provider response into a probe verdict.
 *
 * Every rule here came from a response measured against NVIDIA NIM on
 * 2026-08-10 — see the spec's Problem section. Matching is done on the raw
 * body text rather than parsed JSON because providers disagree about the
 * error envelope ({"error":...} vs {"object":"error","message":...}) and some
 * upstream failures return HTML.
 */

/**
 * The extraction request's output budget (src/lib/ai/service.ts). The ping
 * deliberately asks for this much so that models whose context cannot hold it
 * reject the ping — that rejection is the only way to learn the real ceiling.
 * A healthy model answers "OK" in two tokens regardless, because max_tokens is
 * a ceiling, not a target.
 */
export const PROBE_MAX_TOKENS = 16384;

export interface RawResponse {
  status: number;
  body: string;
}

export interface PingVerdict {
  status: ProbeStatus;
  reason: string;
  ctxWindow: number | null;
}

/**
 * Extracts a model's real context ceiling from a rejection. NVIDIA emits two
 * different shapes for the same condition, both measured against live models:
 *   "This model's maximum context length is 16384 tokens"        (vLLM)
 *   "max_tokens=16384 cannot be greater than max_model_len=8192" (TRT-LLM)
 */
export function parseContextWindow(body: string): number | null {
  const vllm = /maximum context length is (\d+) tokens/i.exec(body);
  if (vllm) return Number(vllm[1]);
  const trt = /max_model_len=(?:max_total_tokens=)?(\d+)/i.exec(body);
  if (trt) return Number(trt[1]);
  return null;
}

/** "At most 1 image(s) may be provided in one request" → 1 */
export function parseImageCap(body: string): number | null {
  const m = /at most (\d+) image\(s\) may be provided/i.exec(body);
  return m ? Number(m[1]) : null;
}

/** Pulls the most useful human-readable sentence out of a provider error body. */
function extractReason(body: string, fallback: string): string {
  try {
    const parsed = JSON.parse(body);
    const candidate = parsed?.detail ?? parsed?.message ?? parsed?.error?.message ?? parsed?.error;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  } catch {
    // Not JSON — providers sometimes return HTML on upstream failures.
  }
  return fallback;
}

export function classifyPing(res: RawResponse): PingVerdict {
  const { status, body } = res;

  if (status === 200) {
    return { status: 'ok', reason: '', ctxWindow: null };
  }

  // ── Transient first — these say nothing about the model ─────────────────
  // status 0 is our own transport failure or probe cutoff. In one measured run
  // of the NVIDIA catalogue, 5 alive models (including meta/llama-3.2-1b-instruct)
  // read-timed out on a cold start, and one returned 500. Treating those as
  // death would strip working models from the surveyor config.
  if (status === 0 || status === 429 || status >= 500) {
    return {
      status: 'transient',
      reason: status === 429
        ? 'Rate limited during the probe — not a model fault.'
        : `Temporary failure (${status || 'timeout'}) — not a model fault.`,
      ctxWindow: null,
    };
  }

  if (status === 404) {
    return {
      status: 'unreachable',
      reason: extractReason(body, 'Listed by the provider but not served to this account.'),
      ctxWindow: null,
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: 'auth-error',
      reason: extractReason(body, `HTTP ${status} — the API key was rejected.`),
      ctxWindow: null,
    };
  }

  if (status === 400) {
    if (/does not support text input/i.test(body)) {
      return {
        status: 'no-text-input',
        reason: extractReason(body, 'Rejects text prompts — cannot be used for extraction.'),
        ctxWindow: null,
      };
    }
    const ctxWindow = parseContextWindow(body);
    if (ctxWindow !== null) {
      return {
        status: 'ctx-too-small',
        reason: `Context window is ${ctxWindow} tokens — too small for the ${PROBE_MAX_TOKENS}-token extraction budget.`,
        ctxWindow,
      };
    }
  }

  return {
    status: 'error',
    reason: extractReason(body, `HTTP ${status}.`) || `HTTP ${status}.`,
    ctxWindow: null,
  };
}
