import { PROVIDER_IMAGE_CAPS, type ProviderId } from './models-config';
import { geminiAuthHeaders } from './service';
import {
  classifyPing, parseImageCap, PROBE_MAX_TOKENS,
  type PingVerdict, type RawResponse,
} from './probe-classify';
import {
  DURABLE_FAILURES, emptyProviderProbe,
  type ModelProbes, type ProbeResult, type ProbeSource, type ProviderProbe,
} from './probe-types';
import { scoreAccuracy, type AccuracyResult } from './probe-accuracy';
import type { BenchmarkDoc } from './benchmark-doc';

/**
 * Runs the two-pass model probe.
 *
 * Pass 1 pings every catalogue entry with the real extraction token budget, so
 * models whose context cannot hold it reject the ping and are caught here
 * rather than mid-claim. Pass 2 measures vision, image cap, and latency on the
 * survivors only.
 */

/** A model slower than this per page is flagged, not hidden — the request path allows 300s. */
export const LATENCY_CUTOFF_MS = 90_000;

/**
 * Output budget for the vision and image-cap probes.
 *
 * NOT a small number. Measured: gemini-2.5-flash spent 29 tokens *thinking*
 * and returned an empty string with finishReason MAX_TOKENS at a 32-token
 * budget — which would have recorded the primary working Gemini model as
 * non-vision. Reasoning models need room to answer at all.
 */
export const PROBE_CAPABILITY_MAX_TOKENS = 512;

/**
 * Per-provider concurrency. NVIDIA tolerates 4 (measured: 100 pings in 222s).
 * Gemini's free tier is 10 requests per minute — probing it 4-wide 429-storms
 * (measured: 10 pings 4-wide gave four 429s and two 503s in 3.9s), and every
 * 429 would be recorded against a model that is fine.
 */
export const PROVIDER_CONCURRENCY: Record<ProviderId, number> = {
  gemini: 1,
  groq: 2,
  nvidia: 4,
};

/** Minimum gap between requests, to stay under per-minute free-tier caps. */
export const PROVIDER_MIN_GAP_MS: Record<ProviderId, number> = {
  gemini: 6_500,   // ~9 rpm, just under the 10 rpm free-tier cap
  groq: 2_500,
  nvidia: 0,
};

/** Printed on public/ai-probe-page.jpg. A text-only model cannot produce it. */
export const PROBE_VISION_CODE = 'PROBE7X';

const PROBE_FIXTURE_URL = '/ai-probe-page.jpg';
const PROVIDER_IDS: ProviderId[] = ['gemini', 'groq', 'nvidia'];

const EXTRACTION_PROMPT =
  'Extract every line item from this repair estimate as JSON: ' +
  '{"items":[{"description":str,"qty":number,"rate":number,"amount":number}],"total":number}';

const VISION_PROMPT =
  'What reference code is printed on this document? Reply with the code only.';

/**
 * Model families that cannot serve a chat extraction under any circumstances.
 * This is an EXCLUSION list, not the capability guess that was deleted — it
 * never claims a model *can* do something, it only skips families that would
 * waste a probe call. On Gemini, where the budget is ~9 requests per minute,
 * skipping embedding/imagen/veo/tts entries meaningfully shortens the run.
 */
const NON_CHAT_PATTERN =
  /embed|embedqa|rerank|retriev|nemoretriever|guard|safety|reward|tts|stt|whisper|imagen|veo|image-generation|aqa|orpheus/i;

/** Runs `fn` over `items` at most `limit` at a time, preserving input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export interface BuildProbeResultInput {
  id: string;
  ping: PingVerdict;
  /** Cap the provider documents, used when the 2-image probe did not reject. */
  providerCap: number | null;
  /** Context window the provider reports, used when the probe learned nothing. */
  providerCtx: number | null;
  visionOk: boolean;
  /** Cap parsed from a 2-image rejection, or null if 2 images were accepted. */
  probedCap: number | null;
  /** Measured milliseconds, or null when the cutoff was hit. */
  latencyMs: number | null;
  now: number;
  /** Strike count carried from the previous probe; 0 when there was none. */
  previousFailures: number;
}

export function buildProbeResult(input: BuildProbeResultInput): ProbeResult {
  const { id, ping, providerCap, providerCtx, visionOk, probedCap, latencyMs, now, previousFailures } = input;
  const failed = ping.status !== 'ok';

  const imageCap = probedCap !== null ? probedCap : providerCap;
  const capSource: ProbeSource = probedCap !== null ? 'probe' : 'provider-metadata';

  const ctxWindow = ping.ctxWindow !== null ? ping.ctxWindow : providerCtx;
  const ctxSource: ProbeSource = ping.ctxWindow !== null ? 'probe' : 'provider-metadata';

  return {
    id,
    status: ping.status,
    reason: ping.reason,
    vision: failed ? false : visionOk,
    imageCap: failed ? null : imageCap,
    ctxWindow,
    msPerPage: failed ? null : latencyMs,
    slow: !failed && latencyMs === null,
    source: { vision: 'probe', imageCap: capSource, ctxWindow: ctxSource },
    probedAt: now,
    // Only DURABLE failures accumulate strikes. A timeout or 429 leaves the
    // count exactly where it was — it is not evidence either way.
    consecutiveFailures:
      ping.status === 'ok' ? 0
      : DURABLE_FAILURES.has(ping.status) ? previousFailures + 1
      : previousFailures,
  };
}

// ─── Transport ───────────────────────────────────────────────────────────────

interface ChatRequest {
  prompt: string;
  images: string[];      // base64 data URLs
  maxTokens: number;
  timeoutMs?: number;
}

/** One chat call, normalised to a RawResponse. Never throws on an HTTP error. */
async function chat(
  provider: ProviderId,
  model: string,
  key: string,
  req: ChatRequest,
): Promise<RawResponse> {
  const controller = new AbortController();
  const timer = req.timeoutMs
    ? setTimeout(() => controller.abort(), req.timeoutMs)
    : null;

  try {
    if (provider === 'gemini') {
      const parts: unknown[] = req.images.map(img => ({
        inlineData: { mimeType: 'image/jpeg', data: img.replace(/^data:image\/\w+;base64,/, '') },
      }));
      parts.push({ text: req.prompt });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...geminiAuthHeaders(key) },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { maxOutputTokens: req.maxTokens, temperature: 0.1 },
          }),
          signal: controller.signal,
        },
      );
      return { status: res.status, body: await res.text() };
    }

    const content: unknown[] = req.images.map(img => ({
      type: 'image_url',
      image_url: { url: img },
    }));
    content.push({ type: 'text', text: req.prompt });
    const body = {
      model,
      messages: [{ role: 'user', content: req.images.length ? content : req.prompt }],
      temperature: 0.1,
      max_tokens: req.maxTokens,
    };

    if (provider === 'nvidia') {
      // The callable ignores AbortSignal and carries its own 300s deadline, so
      // without this race an NVIDIA latency probe would run well past the
      // cutoff and blow the estimated probe duration.
      const { callNvidiaProxy } = await import('@/lib/firebase/functions');
      const call = callNvidiaProxy('chat/completions', key, body)
        .then(p => ({ status: p.status, body: p.body }));
      if (!req.timeoutMs) return await call;
      const cutoff = new Promise<RawResponse>(resolve =>
        setTimeout(() => resolve({ status: 0, body: 'probe cutoff reached' }), req.timeoutMs));
      return await Promise.race([call, cutoff]);
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { status: res.status, body: await res.text() };
  } catch (err: unknown) {
    // AbortError (cutoff) and transport failures both land here. Status 0 is
    // not a real HTTP status; classifyPing maps it to 'transient'.
    return { status: 0, body: err instanceof Error ? err.message : 'probe transport failed' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

interface CatalogueEntry {
  id: string;
  /** Context window the provider reports; null when it reports none. */
  ctxWindow: number | null;
  /** Vision support the provider reports; null when it reports none. */
  reportedVision: boolean | null;
}

/** Drops model families that cannot serve a chat extraction, to save probe budget. */
function dropNonChat(entries: CatalogueEntry[]): CatalogueEntry[] {
  return entries.filter(e => !NON_CHAT_PATTERN.test(e.id));
}

async function fetchCatalogue(provider: ProviderId, key: string): Promise<CatalogueEntry[]> {
  if (provider === 'nvidia') {
    const { callNvidiaProxy } = await import('@/lib/firebase/functions');
    const res = await callNvidiaProxy('models', key);
    if (!res.ok) throw new Error(`NVIDIA catalogue failed: HTTP ${res.status}`);
    const data = JSON.parse(res.body);
    // NVIDIA reports only {id, object, created, owned_by} — no context window,
    // no availability. Measured: 60 of its 100 listed models 404 on call.
    return dropNonChat((data.data ?? []).map((m: { id: string }) => ({
      id: m.id, ctxWindow: null, reportedVision: null,
    })));
  }

  if (provider === 'groq') {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`Groq catalogue failed: HTTP ${res.status}`);
    const data = await res.json();
    // Groq reports context_window, active, and input_modalities — trust all
    // three rather than spending probe calls rediscovering them.
    return dropNonChat((data.data ?? [])
      .filter((m: { active?: boolean }) => m.active !== false)
      .map((m: { id: string; context_window?: number; input_modalities?: string[] }) => ({
        id: m.id,
        ctxWindow: m.context_window ?? null,
        reportedVision: Array.isArray(m.input_modalities)
          ? m.input_modalities.includes('image')
          : null,
      })));
  }

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: geminiAuthHeaders(key) });
  if (!res.ok) throw new Error(`Gemini catalogue failed: HTTP ${res.status}`);
  const data = await res.json();
  // Gemini reports supportedGenerationMethods — skip models that cannot generate.
  return dropNonChat((data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: { name: string; inputTokenLimit?: number }) => ({
      id: m.name.replace(/^models\//, ''),
      ctxWindow: m.inputTokenLimit ?? null,
      reportedVision: null,
    })));
}

// ─── Passes ──────────────────────────────────────────────────────────────────

async function loadFixture(): Promise<string> {
  const res = await fetch(PROBE_FIXTURE_URL);
  if (!res.ok) throw new Error(`Probe fixture missing at ${PROBE_FIXTURE_URL}`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the probe fixture'));
    reader.readAsDataURL(blob);
  });
}

/** Thrown to abort a whole provider — a rejected key tells us nothing about its models. */
class ProbeAbort extends Error {}

/** Paces a worker so a provider's per-minute free-tier cap is not exceeded. */
async function pace(gapMs: number, lastAt: { t: number }): Promise<void> {
  if (gapMs <= 0) return;
  const wait = gapMs - (Date.now() - lastAt.t);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastAt.t = Date.now();
}

/**
 * Sorts a catalogue so previously-working models are probed first and
 * previously-failed ones last.
 *
 * Everything is still probed — a provider can restore a model, and the
 * two-strike removal rule in probe-reconcile depends on re-testing. This only
 * changes the order, so the admin sees useful results while the graveyard is
 * still being checked. On NVIDIA that moves 60 known-404s behind the 28 that
 * work.
 */
export function orderCatalogue<T extends { id: string }>(
  entries: T[],
  previous: ProviderProbe,
): T[] {
  const rank = (id: string): number => {
    const prior = previous.models[id];
    if (!prior) return 1;                    // never probed
    return prior.status === 'ok' ? 0 : 2;    // working : failed
  };
  // Array.prototype.sort is stable in every engine this app targets, so
  // entries of equal rank keep their provider-supplied order.
  return [...entries].sort((a, b) => rank(a.id) - rank(b.id));
}

export async function runProviderProbe(
  provider: ProviderId,
  key: string,
  previous: ProviderProbe,
  onProgress: (done: number, total: number) => void,
): Promise<ProviderProbe> {
  const now = Date.now();
  try {
    const catalogue = orderCatalogue(await fetchCatalogue(provider, key), previous);
    const fixture = await loadFixture();
    const providerCap = PROVIDER_IMAGE_CAPS[provider];
    const gap = PROVIDER_MIN_GAP_MS[provider];
    const lastAt = { t: 0 };
    let done = 0;
    const total = catalogue.length;

    const results = await mapWithConcurrency(catalogue, PROVIDER_CONCURRENCY[provider], async (entry) => {
      const previousFailures = previous.models[entry.id]?.consecutiveFailures ?? 0;

      // Groq reports each model's real context_window in its catalogue — unlike
      // NVIDIA, which reports nothing, so pass 1 has to throw a 16K-token ping
      // at it just to learn the ceiling from a rejection. Doing that to Groq
      // too re-derives a number it already gave us, and its free-tier
      // tokens-per-minute cap (well under 16384 on most models) turns that
      // ping into a guaranteed 413 on every single model. Trust the reported
      // number instead: skip the call when it already proves too small, and
      // otherwise ping with a token budget the TPM cap can actually serve.
      const knownCtx = provider === 'groq' ? entry.ctxWindow : null;
      if (knownCtx !== null && knownCtx < PROBE_MAX_TOKENS) {
        done++; onProgress(done, total);
        return buildProbeResult({
          id: entry.id,
          ping: {
            status: 'ctx-too-small',
            reason: `Context window is ${knownCtx} tokens — too small for the ${PROBE_MAX_TOKENS}-token extraction budget.`,
            ctxWindow: knownCtx,
          },
          providerCap, providerCtx: entry.ctxWindow,
          visionOk: false, probedCap: null, latencyMs: null, now, previousFailures,
        });
      }

      const ping = async (): Promise<PingVerdict> => {
        await pace(gap, lastAt);
        return classifyPing(await chat(provider, entry.id, key, {
          prompt: 'Reply with OK.',
          images: [],
          maxTokens: knownCtx !== null ? PROBE_CAPABILITY_MAX_TOKENS : PROBE_MAX_TOKENS,
          timeoutMs: LATENCY_CUTOFF_MS,
        }));
      };

      // ── Pass 1: reachability, with the real extraction token budget ──
      // Retried once on a transient failure. A measured NVIDIA run produced 5
      // read timeouts and one 500 on models that are alive; without the retry
      // those would be recorded as failures against working models.
      let verdict = await ping();
      if (verdict.status === 'transient') {
        await new Promise(r => setTimeout(r, 2_000));
        verdict = await ping();
      }

      if (verdict.status === 'auth-error') throw new ProbeAbort(verdict.reason);

      if (verdict.status !== 'ok') {
        done++; onProgress(done, total);
        return buildProbeResult({
          id: entry.id, ping: verdict, providerCap, providerCtx: entry.ctxWindow,
          visionOk: false, probedCap: null, latencyMs: null, now, previousFailures,
        });
      }

      // ── Pass 2a: vision — the model must read a code only visible in pixels ──
      // Trusts the provider when it reports input_modalities (Groq does).
      let visionOk: boolean;
      if (entry.reportedVision === false) {
        visionOk = false;
      } else {
        await pace(gap, lastAt);
        const visionRes = await chat(provider, entry.id, key, {
          prompt: VISION_PROMPT,
          images: [fixture],
          maxTokens: PROBE_CAPABILITY_MAX_TOKENS,
          timeoutMs: LATENCY_CUTOFF_MS,
        });
        visionOk = visionRes.status === 200 && visionRes.body.includes(PROBE_VISION_CODE);
      }

      // ── Pass 2b: image cap ──
      let probedCap: number | null = null;
      if (visionOk) {
        await pace(gap, lastAt);
        const capRes = await chat(provider, entry.id, key, {
          prompt: 'Reply with OK.',
          images: [fixture, fixture],
          maxTokens: PROBE_CAPABILITY_MAX_TOKENS,
          timeoutMs: LATENCY_CUTOFF_MS,
        });
        if (capRes.status !== 200) probedCap = parseImageCap(capRes.body);
      }

      // ── Pass 2c: latency on a realistic payload ──
      await pace(gap, lastAt);
      const started = Date.now();
      const latencyRes = await chat(provider, entry.id, key, {
        prompt: EXTRACTION_PROMPT,
        images: visionOk ? [fixture] : [],
        maxTokens: 512,
        timeoutMs: LATENCY_CUTOFF_MS,
      });
      const latencyMs = latencyRes.status === 200 ? Date.now() - started : null;

      done++; onProgress(done, total);
      return buildProbeResult({
        id: entry.id, ping: verdict, providerCap, providerCtx: entry.ctxWindow,
        visionOk, probedCap, latencyMs, now, previousFailures,
      });
    });

    const models: Record<string, ProbeResult> = Object.fromEntries(results.map(r => [r.id, r]));

    // A model that was working and is no longer in the catalogue has been
    // retired by the provider. Synthesise a durable result so it appears in
    // the Gone group and accrues a strike, rather than vanishing silently.
    for (const [id, prev] of Object.entries(previous.models)) {
      if (models[id] || prev.status !== 'ok') continue;
      models[id] = {
        ...prev,
        status: 'unreachable',
        reason: 'No longer listed by the provider.',
        msPerPage: null,
        slow: false,
        probedAt: now,
        consecutiveFailures: prev.consecutiveFailures + 1,
      };
    }

    // Accuracy carries over: this is a tier 1 capability probe, and it must
    // never destroy tier 2 results. That separation is the whole point of
    // keeping them in different maps.
    return { probedAt: now, error: null, models, accuracy: previous.accuracy ?? {} };
  } catch (err: unknown) {
    const message = err instanceof ProbeAbort
      ? `Key rejected — probe aborted. ${err.message}`
      : err instanceof Error ? err.message : 'Probe failed';
    // No models: the reconciler treats this as "we learned nothing" and
    // leaves the working config untouched.
    return { probedAt: now, error: message, models: {}, accuracy: previous.accuracy ?? {} };
  }
}

/**
 * Folds one provider's finished probe into the running state.
 *
 * Needed because providers now finish concurrently and therefore in
 * unpredictable order. Merging into a snapshot captured before the run would
 * let two providers finishing close together overwrite one another.
 */
export function mergeProviderResult(
  current: ModelProbes,
  provider: ProviderId,
  result: ProviderProbe,
): ModelProbes {
  return {
    ...current,
    providers: { ...current.providers, [provider]: result },
  };
}

export async function runFullProbe(
  keys: Partial<Record<ProviderId, string>>,
  previous: ModelProbes,
  onProgress: (provider: ProviderId, done: number, total: number) => void,
  /**
   * Called as each provider finishes so the caller can persist partial
   * results. A full run takes 20+ minutes; without this, closing the tab
   * two providers in would throw away everything.
   */
  onProviderComplete: (provider: ProviderId, result: ProviderProbe) => Promise<void>,
): Promise<ModelProbes> {
  // Concurrent across providers. Gemini, Groq and NVIDIA are independent
  // rate-limit domains with their own keys, and pacing is already enforced
  // per provider (PROVIDER_CONCURRENCY / PROVIDER_MIN_GAP_MS), so running them
  // together adds no pressure to any one of them. Sequentially, Gemini's
  // ~9 req/min pacing left the other two idle for most of the run.
  let running: ModelProbes = { ...previous };

  await Promise.all(PROVIDER_IDS.map(async (p) => {
    const key = keys[p]?.trim();
    if (!key) {
      // No key means we learned nothing — keep the previous results rather
      // than replacing them with an empty block the reconciler might act on.
      const skipped: ProviderProbe = {
        ...(previous.providers[p] ?? emptyProviderProbe()),
        error: 'No admin key for this provider.',
      };
      running = mergeProviderResult(running, p, skipped);
      await onProviderComplete(p, skipped);
      return;
    }

    // One provider failing must not reject the outer Promise.all and abort
    // the others. runProviderProbe already catches its own errors, but a
    // throw from onProviderComplete would escape.
    try {
      const result = await runProviderProbe(
        p, key, previous.providers[p] ?? emptyProviderProbe(),
        (done, total) => onProgress(p, done, total),
      );
      running = mergeProviderResult(running, p, result);
      await onProviderComplete(p, result);
    } catch (err: unknown) {
      const failed: ProviderProbe = {
        ...(previous.providers[p] ?? emptyProviderProbe()),
        error: err instanceof Error ? err.message : 'Probe failed',
      };
      running = mergeProviderResult(running, p, failed);
    }
  }));

  return { probedAt: Date.now(), probedBy: '', providers: running.providers };
}

/**
 * Tier 2 — runs the admin's benchmark document through the real extraction
 * path for each shortlisted model and scores the result.
 *
 * Uses runModelTest, the same override mechanism the "Test with estimate PDF"
 * button uses, so this exercises the real chunking, the real prompts and the
 * real per-provider image caps rather than a parallel implementation.
 *
 * Sequential within a provider: each run is a full multi-page extraction, and
 * running several at once against one provider's rate limit would produce
 * timeouts that look like model faults.
 */
export async function runAccuracyProbe(
  provider: ProviderId,
  key: string,
  modelIds: string[],
  benchmark: BenchmarkDoc,
  onProgress: (modelId: string, done: number, total: number) => void,
): Promise<Record<string, AccuracyResult>> {
  const { runModelTest } = await import('./service');
  const results: Record<string, AccuracyResult> = {};
  const file = new File([benchmark.blob], benchmark.fileName, { type: benchmark.mimeType });

  let done = 0;
  for (const modelId of modelIds) {
    onProgress(modelId, done, modelIds.length);
    const started = Date.now();

    const outcome = await runModelTest(
      { provider, model: modelId, key },
      'estimate',
      file,
      () => { /* per-page progress is too noisy for this view */ },
    );

    results[modelId] = scoreAccuracy({
      modelId,
      data: outcome.data,
      expectedTotal: benchmark.expectedTotal,
      expectedItemCount: benchmark.expectedItemCount,
      ms: Date.now() - started,
      pages: benchmark.pageCount,
      benchmarkFileName: benchmark.fileName,
      now: Date.now(),
      error: outcome.ok ? null : (outcome.error ?? 'Extraction failed'),
    });

    done++;
    onProgress(modelId, done, modelIds.length);
  }

  return results;
}
