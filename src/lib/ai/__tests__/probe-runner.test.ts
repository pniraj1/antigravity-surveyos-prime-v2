import { describe, it, expect } from 'vitest';
import {
  mapWithConcurrency, buildProbeResult, PROBE_VISION_CODE,
  LATENCY_CUTOFF_MS, PROBE_CAPABILITY_MAX_TOKENS,
  PROVIDER_CONCURRENCY, PROVIDER_MIN_GAP_MS,
  orderCatalogue,
} from '../probe-runner';
import type { ProbeResult, ProviderProbe } from '../probe-types';

describe('mapWithConcurrency', () => {
  it('returns results in input order regardless of completion order', async () => {
    const delays = [30, 5, 20, 1];
    const out = await mapWithConcurrency(delays, 2, async (d) => {
      await new Promise(r => setTimeout(r, d));
      return d;
    });
    expect(out).toEqual(delays);
  });

  it('never runs more than `limit` at once', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 4, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--;
      return null;
    });
    expect(peak).toBeLessThanOrEqual(4);
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});

describe('buildProbeResult', () => {
  const base = {
    id: 'meta/llama-3.2-90b-vision-instruct',
    ping: { status: 'ok' as const, reason: '', ctxWindow: null },
    providerCap: 1 as number | null,
    providerCtx: null as number | null,
    now: 1000,
    previousFailures: 0,
  };

  it('records a working vision model with its measured latency', () => {
    const r = buildProbeResult({ ...base, visionOk: true, probedCap: 1, latencyMs: 27000 });
    expect(r.status).toBe('ok');
    expect(r.vision).toBe(true);
    expect(r.imageCap).toBe(1);
    expect(r.msPerPage).toBe(27000);
    expect(r.slow).toBe(false);
    expect(r.source.imageCap).toBe('probe');
  });

  it('marks a model that exceeded the cutoff as slow with no measurement', () => {
    const r = buildProbeResult({ ...base, visionOk: true, probedCap: 1, latencyMs: null });
    expect(r.status).toBe('ok');
    expect(r.slow).toBe(true);
    expect(r.msPerPage).toBeNull();
  });

  it('falls back to the provider cap when the 2-image probe succeeded', () => {
    // nvidia/nemotron-nano-12b-v2-vl accepts 2 images while llama-3.2-90b
    // rejects them, so the cap is per-model. A 2-image success proves only
    // ">= 2" — fall back to the documented provider default rather than guess.
    const r = buildProbeResult({ ...base, providerCap: 5, visionOk: true, probedCap: null, latencyMs: 40000 });
    expect(r.imageCap).toBe(5);
    expect(r.source.imageCap).toBe('provider-metadata');
  });

  it('records a text-only model as vision:false but still ok', () => {
    const r = buildProbeResult({ ...base, visionOk: false, probedCap: null, latencyMs: 61000 });
    expect(r.status).toBe('ok');
    expect(r.vision).toBe(false);
  });

  it('preserves a failing ping verdict and skips capability fields', () => {
    const r = buildProbeResult({
      ...base,
      ping: { status: 'unreachable', reason: 'Not found for account', ctxWindow: null },
      visionOk: false, probedCap: null, latencyMs: null,
    });
    expect(r.status).toBe('unreachable');
    expect(r.reason).toBe('Not found for account');
    expect(r.slow).toBe(false);
  });

  it('prefers a probed context window over provider metadata', () => {
    const r = buildProbeResult({
      ...base,
      ping: { status: 'ctx-too-small', reason: 'too small', ctxWindow: 16384 },
      providerCtx: 128000, visionOk: false, probedCap: null, latencyMs: null,
    });
    expect(r.ctxWindow).toBe(16384);
    expect(r.source.ctxWindow).toBe('probe');
  });

  it('uses provider metadata for context when the probe learned nothing', () => {
    const r = buildProbeResult({ ...base, providerCtx: 131072, visionOk: true, probedCap: null, latencyMs: 10 });
    expect(r.ctxWindow).toBe(131072);
    expect(r.source.ctxWindow).toBe('provider-metadata');
  });
});

describe('strike counting', () => {
  const base = {
    id: 'x', providerCap: null as number | null, providerCtx: null as number | null,
    visionOk: false, probedCap: null, latencyMs: null, now: 1,
  };

  it('increments the strike count on a durable failure', () => {
    const r = buildProbeResult({
      ...base,
      ping: { status: 'unreachable', reason: 'gone', ctxWindow: null },
      previousFailures: 1,
    });
    expect(r.consecutiveFailures).toBe(2);
  });

  it('leaves the strike count untouched on a transient failure', () => {
    const r = buildProbeResult({
      ...base,
      ping: { status: 'transient', reason: 'timeout', ctxWindow: null },
      previousFailures: 1,
    });
    expect(r.consecutiveFailures).toBe(1);
  });

  it('resets the strike count when the model works again', () => {
    const r = buildProbeResult({
      ...base,
      ping: { status: 'ok', reason: '', ctxWindow: null },
      latencyMs: 1000,
      previousFailures: 5,
    });
    expect(r.consecutiveFailures).toBe(0);
  });
});

describe('constants', () => {
  it('cuts latency probes off at 90s', () => {
    expect(LATENCY_CUTOFF_MS).toBe(90_000);
  });

  it('uses a reference code the fixture image carries', () => {
    expect(PROBE_VISION_CODE).toBe('PROBE7X');
  });

  it('gives capability probes room for a thinking model to answer', () => {
    // Measured: gemini-2.5-flash spent 29 thinking tokens and returned an EMPTY
    // string with finishReason MAX_TOKENS at a 32-token budget — which would
    // have classified the primary working Gemini model as non-vision.
    expect(PROBE_CAPABILITY_MAX_TOKENS).toBeGreaterThanOrEqual(256);
  });

  it('paces Gemini under its 10 rpm free-tier cap', () => {
    // Measured: 10 pings 4-wide produced four 429s and two 503s in 3.9s.
    expect(PROVIDER_CONCURRENCY.gemini).toBe(1);
    expect(PROVIDER_MIN_GAP_MS.gemini).toBeGreaterThanOrEqual(6_000);
  });

  it('lets NVIDIA run 4-wide with no gap', () => {
    // Measured: 100 pings in 222s at concurrency 4, no rate limiting.
    expect(PROVIDER_CONCURRENCY.nvidia).toBe(4);
    expect(PROVIDER_MIN_GAP_MS.nvidia).toBe(0);
  });
});

function prev(statuses: Record<string, ProbeResult['status']>): ProviderProbe {
  return {
    probedAt: 1, error: null, accuracy: {},
    models: Object.fromEntries(Object.entries(statuses).map(([id, status]) => [id, {
      id, status, reason: '', vision: true, imageCap: 1, ctxWindow: 1,
      msPerPage: 1, slow: false,
      source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' },
      probedAt: 1, consecutiveFailures: 0,
    } as ProbeResult])),
  };
}

describe('orderCatalogue', () => {
  const entries = [{ id: 'dead1' }, { id: 'ok1' }, { id: 'new1' }, { id: 'dead2' }, { id: 'ok2' }];

  it('working models first, never-probed next, dead last', () => {
    const ordered = orderCatalogue(entries, prev({
      dead1: 'unreachable', ok1: 'ok', dead2: 'unreachable', ok2: 'ok',
    }));
    expect(ordered.map(e => e.id)).toEqual(['ok1', 'ok2', 'new1', 'dead1', 'dead2']);
  });

  it('order is stable within each group', () => {
    const ordered = orderCatalogue(entries, prev({ ok1: 'ok', ok2: 'ok' }));
    // new1, dead1, dead2 were all never probed — original relative order kept.
    expect(ordered.map(e => e.id)).toEqual(['ok1', 'ok2', 'dead1', 'new1', 'dead2']);
  });

  it('an empty previous probe leaves the order untouched', () => {
    const ordered = orderCatalogue(entries, prev({}));
    expect(ordered.map(e => e.id)).toEqual(['dead1', 'ok1', 'new1', 'dead2', 'ok2']);
  });

  it('does not mutate the input array', () => {
    const input = [...entries];
    orderCatalogue(input, prev({ ok2: 'ok' }));
    expect(input.map(e => e.id)).toEqual(['dead1', 'ok1', 'new1', 'dead2', 'ok2']);
  });

  it('every entry survives — nothing is dropped', () => {
    const ordered = orderCatalogue(entries, prev({ dead1: 'unreachable', ok1: 'ok' }));
    expect(ordered).toHaveLength(entries.length);
  });
});
