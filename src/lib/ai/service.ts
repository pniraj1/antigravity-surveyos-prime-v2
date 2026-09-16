// ═══════════════════════════════════════════════════════════
// AI GATEWAY SERVICE — job-aware fallback across every reachable model
//
// DEVELOPER NOTES:
//   - Every call declares a job (jobs.ts); rank.ts orders the admin pool
//     for it; callWithFallback walks that order: hop models before keys,
//     never retry a 503 in place, one 5 s second pass over busy-only models.
//   - Update CURRENT_MODELS when providers release better models.
//     Surveyors never need to touch model names.
// ═══════════════════════════════════════════════════════════

import { getFirebaseApp } from '../firebase/config';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { classifyGatewayError, gatewayErrorMessage } from './gateway-errors';
import { assertWithinImageCap } from './image-cap';
import { parseGeminiError, classifyGemini429, isThinkingRejected, isModalityRejected } from './gemini-errors';
import { rankModels, type PoolEntry } from './rank';
import { getHealth, keyHash } from './health';
import { type AIJob, JOB_TIMEOUT_MS } from './jobs';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { toast } from 'sonner';
import { ModelEntry, PROVIDER_IMAGE_CAPS, type ProviderConfig, type ProviderId } from './models-config';
import { useAIConfigStore } from '@/stores/ai-config-store';


/** Returns the saved model if still enabled, else the provider's configured default. */
export function resolveEnabledModel(saved: string | undefined, providerCfg: ProviderConfig): string {
  const trimmed = saved?.trim();
  if (trimmed && providerCfg.models.some(m => m.id === trimmed)) return trimmed;
  return providerCfg.defaultModel;
}

// ─── Admin test override ──────────────────────────────────────────────────────
// When set, callAIGateway routes a single extraction to one specific
// provider+model+key (no profile, no fallback chain). Used by the Admin
// "Test with estimate PDF" tool. Always cleared in runModelTest's finally.
export interface AITestOverride { provider: 'gemini' | 'groq' | 'nvidia' | 'ollama'; model: string; key: string; }
let _testOverride: AITestOverride | null = null;
export function setAITestOverride(o: AITestOverride | null): void { _testOverride = o; }
export function getAITestOverride(): AITestOverride | null { return _testOverride; }

// ─── Developer-controlled model defaults ─────────────────────────────────────
// Last verified: May 2026 — Free Tier limits:
//   gemini-2.5-flash     : 10 RPM · 500 RPD · 250K TPM  ← best stable free model
//   gemini-2.5-flash-lite : 15 RPM · 1000 RPD
//   llama-4-scout        : Groq free tier, vision-capable
export const CURRENT_MODELS = {
  gemini: 'gemini-2.5-flash',
  // Llama 3.3 70B — the fastest correct extraction measured on Groq (2.3s/page).
  // Text-only: Groq's only vision model is qwen/qwen3.6-27b, whose 8000 TPM
  // free-tier ceiling is below a single rendered estimate page (~10600 tokens).
  groq:   'llama-3.3-70b-versatile',
  // NVIDIA NIM free tier: model prefix is "meta/" not "nvidia/"
  nvidia: 'meta/llama-3.2-90b-vision-instruct',
};

export interface ModelOption {
  id: string;
  label: string;
  note: string;
}

/**
 * Static fallback model list — used when live fetch hasn't completed yet.
 * Only lists models confirmed functional on the free tier (April 2026).
 * The app auto-fetches the live list from the Gemini API when a key is available.
 */
export const PROVIDER_MODELS: Record<'gemini' | 'groq' | 'nvidia' | 'ollama', ModelOption[]> = {
  gemini: [
    { id: 'gemini-2.5-flash',        label: '2.5 Flash ✓',  note: 'Best value · ~10s/page · vision + text' },
    { id: 'gemini-flash-lite-latest', label: 'Flash-Lite',   note: 'Fastest · ~3s/page' },
    { id: 'gemini-3.5-flash',        label: '3.5 Flash',     note: 'Newer · ~15s/page · vision + text' },
    // gemini-2.5-pro is deliberately absent: it 429s on the free tier.
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B ✓', note: 'Fastest correct · ~2.3s/page · text only' },
    { id: 'qwen/qwen3.6-27b',        label: 'Qwen 3.6 27B',    note: 'Only vision model · 8K TPM limits scans' },
    { id: 'openai/gpt-oss-120b',     label: 'GPT-OSS 120B',    note: 'Text only · 131K ctx' },
    { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',    note: 'Fastest · text only · 6K TPM' },
  ],
  nvidia: [
    { id: 'meta/llama-3.2-90b-vision-instruct', label: 'Llama 3.2 90B', note: 'Default · best vision' },
    { id: 'meta/llama-3.2-11b-vision-instruct', label: 'Llama 3.2 11B', note: 'Smaller · faster' },
  ],
  ollama: [
    { id: 'gemma4:31b', label: 'Gemma 4 31B', note: 'Free · vision · via proxy' },
  ],
};

// Old model names stored in user profiles → auto-migrated to current default
export const DEPRECATED_GEMINI_MODELS: Record<string, string> = {
  'gemini-pro':               'gemini-2.5-flash',
  'gemini-pro-vision':        'gemini-2.5-flash',
  'gemini-1.0-pro':           'gemini-2.5-flash',
  'gemini-1.5-flash':         'gemini-2.5-flash',
  'gemini-1.5-flash-latest':  'gemini-2.5-flash',
  'gemini-1.5-pro':           'gemini-2.5-flash',
  'gemini-2.0-flash':         'gemini-2.5-flash',          // 429 on the free tier
  'gemini-2.0-flash-lite':    'gemini-flash-lite-latest',  // was → 2.5-flash-lite, now 404
  'gemini-2.0-flash-exp':     'gemini-2.5-flash',
  'gemini-2.5-flash-lite':    'gemini-flash-lite-latest',  // 404 "no longer available to new users"
  'gemini-3-pro-preview':     'gemini-3.1-pro-preview',    // shut down March 9, 2026
};

export const DEPRECATED_GROQ_MODELS: Record<string, string> = {
  // Every llama-4 model was retired by Groq — all 404 "does not exist".
  'meta-llama/llama-4-scout-17b-16e-instruct':    'llama-3.3-70b-versatile',
  'meta-llama/llama-4-maverick-17b-128e-instruct': 'llama-3.3-70b-versatile',
  // Old vision-preview models removed by Groq
  'llama-3.2-90b-vision-preview': 'qwen/qwen3.6-27b',
  'llama-3.2-11b-vision-preview': 'qwen/qwen3.6-27b',
  // NOTE: openai/gpt-oss-120b and -20b were listed here as "fake model IDs that
  // never existed on Groq". They are live (verified 2026-08-10), so migrating
  // them away was rewriting a working model into one that 404s. Do not re-add.
};

export interface AIProvider {
  name: 'groq' | 'gemini' | 'openai' | 'nvidia' | 'ollama';
  endpoint: string;
  model: string;
  keys: string[];
  /** Max images per request. Groq is limited to 5; undefined = unlimited. */
  maxImages?: number;
  /** Max output tokens. Groq Llama 4 Scout is capped at 8192; undefined = 16384. */
  maxOutputTokens?: number;
}

/** Builds a one-off provider from a test override (no profile, no fallback chain). */
function buildOverrideProvider(o: AITestOverride): AIProvider {
  if (o.provider === 'gemini') {
    return { name: 'gemini', endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${o.model}:generateContent`, model: o.model, keys: [o.key] };
  }
  if (o.provider === 'nvidia') {
    return { name: 'nvidia', endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions', model: o.model, keys: [o.key], maxImages: PROVIDER_IMAGE_CAPS.nvidia ?? undefined };
  }
  return { name: 'groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', model: o.model, keys: [o.key], maxImages: 5, maxOutputTokens: 8192 };
}

// ─── Read profile from Zustand ────────────────────────────────────────────────
function getProfileFromStorage() {
  try {
    return useProfileStore.getState().profile ?? null;
  } catch {
    return null;
  }
}

/** Collect all non-empty keys for a provider (new array + legacy single key). */
function resolveGeminiKeys(profile: ReturnType<typeof getProfileFromStorage>): string[] {
  const keys: string[] = [];
  if (Array.isArray(profile?.geminiApiKeys)) {
    keys.push(...profile.geminiApiKeys.filter(k => k?.trim()));
  }
  // Legacy field as fallback if arrays empty
  if (keys.length === 0 && profile?.geminiApiKey?.trim()) {
    keys.push(profile.geminiApiKey.trim());
  }
  return keys;
}

function resolveGroqKeys(profile: ReturnType<typeof getProfileFromStorage>): string[] {
  const keys: string[] = [];
  if (Array.isArray(profile?.groqApiKeys)) {
    keys.push(...profile.groqApiKeys.filter(k => k?.trim()));
  }
  if (keys.length === 0 && profile?.groqApiKey?.trim()) {
    keys.push(profile.groqApiKey.trim());
  }
  return keys;
}

function resolveNvidiaKeys(profile: ReturnType<typeof getProfileFromStorage>): string[] {
  if (!Array.isArray(profile?.nvidiaApiKeys)) return [];
  return profile.nvidiaApiKeys.filter(k => k?.trim());
}

/** Image cap of the model the ranker would try first for this job — the processor sizes chunks from it. */
export function getActiveImageCap(job: AIJob = 'heavy'): number | null {
  const override = getAITestOverride();
  if (override) return buildOverrideProvider(override).maxImages ?? null;
  const pool = buildPool(getProfileFromStorage());
  try {
    // ponytail: until Phase 2 puts probe verdicts in the pool, the measured-exact model leads; the surveyor's pick still overrides.
    const [first] = rankModels(job, ['x'], pool, { health: getHealth(), preferredModel: getProfileFromStorage()?.geminiModel?.trim() || CURRENT_MODELS.gemini });
    return first?.model.imageCap ?? null;
  } catch { return null; }
}

/**
 * Firestore master config (admin-managed keys) — the "nothing configured"
 * path. callAIGateway consults it last, only when the surveyor has no keys.
 */
export async function getAIProvider(): Promise<AIProvider> {
  try {
    const db = getFirestore(getFirebaseApp());
    const configDoc = await getDoc(doc(db, 'ai_config', 'routing'));
    if (configDoc.exists()) {
      const data = configDoc.data();
      const masterProvider = (data.providers || []).find((p: any) => p.enabled);
      if (masterProvider) {
        return {
          ...masterProvider,
          keys: masterProvider.keys ?? (masterProvider.key ? [masterProvider.key] : []),
        };
      }
    }
  } catch (err) {
    console.warn('[AI Service] Master config unreachable:', err);
  }

  throw new Error(
    'No AI provider configured. Go to Profile → AI & Documents Intelligence and enter your Gemini or Groq API key.'
  );
}

/** Strip data URL prefix if present — APIs need raw base64 only */
function toRawBase64(img: string): string {
  const idx = img.indexOf(',');
  return idx !== -1 ? img.slice(idx + 1) : img;
}

/** Detect MIME type from data URL prefix; falls back to image/jpeg */
function getMimeType(img: string): string {
  const match = img.match(/^data:([^;]+);base64,/);
  return match ? match[1] : 'image/jpeg';
}

/** Returns true when the error indicates the model is unavailable/not-found on this account tier. */
/**
 * Gemini auth. AI Studio keys used to start with "AIza"; since mid-2026 new
 * ones start with "AQ." and legacy AIza keys are being rejected. Both are
 * plain API keys and belong in the x-goog-api-key header (Google's documented
 * method) — never in ?key= or a Bearer header. Only ya29. OAuth access tokens
 * use Authorization: Bearer.
 */
export function geminiAuthHeaders(key: string): Record<string, string> {
  return key.startsWith('ya29.')
    ? { Authorization: `Bearer ${key}` }
    : { 'x-goog-api-key': key };
}

export type Finish = 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'OTHER';
export interface CallResult { text: string; finish: Finish }
export interface CallOptions { timeoutMs: number; thinkingOff: boolean }

/** One provider's HTTP failure, with enough attached for the loop to classify it. */
export class ProviderError extends Error {
  status: number;
  details: unknown[];
  provider: string;
  constructor(provider: string, status: number, message: string, details: unknown[] = []) {
    super(`${provider} API Error: ${message}`);
    this.provider = provider; this.status = status; this.details = details;
  }
}

function timeoutError(provider: string, ms: number): ProviderError {
  const e = new ProviderError(provider, 0, `no response within ${Math.round(ms / 1000)}s`);
  e.name = 'TimeoutError';
  return e;
}

/** fetch with an AbortController deadline; a timeout rejects with ProviderError name 'TimeoutError'. */
async function fetchWithTimeout(provider: string, url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw timeoutError(provider, ms);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function geminiFinish(reason: unknown): Finish {
  return reason === 'STOP' ? 'STOP' : reason === 'MAX_TOKENS' ? 'MAX_TOKENS' : reason === 'SAFETY' ? 'SAFETY' : 'OTHER';
}

/** Calls one provider with one specific key. Throws ProviderError on error. */
export async function callWithKey(
  provider: AIProvider, key: string, prompt: string, images: string[],
  responseFormat: 'json' | 'text', opts: CallOptions,
): Promise<CallResult> {
  if (provider.name === 'gemini') {
    const parts: any[] = images.map(img => ({ inlineData: { mimeType: getMimeType(img), data: toRawBase64(img) } }));
    parts.push({ text: prompt });

    // Dev-only ?ai-fault= injection (see fault.ts); null in production and after the first call.
    const fault = (await import('./fault')).takeFault();
    if (fault) throw fault;

    const res = await fetchWithTimeout('gemini', provider.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...geminiAuthHeaders(key) },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1, topP: 0.95, topK: 40,
          maxOutputTokens: 65536,  // gemini-2.5-flash supports up to 65K — needed for multi-page invoices
          // Only force JSON mime when the caller actually expects JSON back.
          // Pass 3 (covering narrative) expects plain text — forcing JSON mode
          // causes the model to wrap the letter in a JSON object or refuse.
          ...(responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
          // Measured 2026-09-15: 2.5 Flash spent its output budget thinking and
          // returned MAX_TOKENS after 2,612 tokens. Extraction is OCR, not
          // reasoning — thinking off. The loop retries once without this when a
          // model rejects it (Gemini 3.x uses thinkingLevel).
          ...(opts.thinkingOff && responseFormat === 'json' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    }, opts.timeoutMs);

    if (!res.ok) {
      const info = parseGeminiError(res.status, await res.json().catch(() => ({})));
      throw new ProviderError('gemini', res.status, info.message, info.details);
    }
    const data = await res.json();
    const cand = data.candidates?.[0];
    useUIStore.getState().setAIProviderHealth('gemini', 'ok');
    return {
      text: (cand?.content?.parts?.[0]?.text || '').replace(/```json|```/g, '').trim(),
      finish: geminiFinish(cand?.finishReason),
    };
  }

  if (provider.name === 'ollama') {
    // Ollama Cloud has no CORS — always via aiProxy. Native /api/chat takes
    // raw base64 images on the message and `format: 'json'` for JSON mode.
    // The proxy's callable has its own 300s server-side timeout — opts.timeoutMs
    // cannot be applied mid-flight (a callable cannot be aborted once sent).
    const { callAiProxy } = await import('@/lib/firebase/functions');
    const body = {
      model: provider.model, stream: false,
      ...(responseFormat === 'json' ? { format: 'json' } : {}),
      options: { temperature: 0.1, num_predict: provider.maxOutputTokens ?? 16384 },
      messages: [{ role: 'user', content: prompt, ...(images.length ? { images: images.map(toRawBase64) } : {}) }],
    };
    const proxied = await callAiProxy('ollama', 'api/chat', key, body);
    if (!proxied.ok) {
      const err = safeJsonParse(proxied.body);
      throw new ProviderError('ollama', proxied.status, typeof err?.error === 'string' ? err.error : err?.error?.message || String(proxied.status));
    }
    const data = safeJsonParse(proxied.body) ?? {};
    return {
      text: (data.message?.content || '').trim(),
      finish: data.done_reason === 'length' ? 'MAX_TOKENS' : 'STOP',
    };
  }

  // Groq / NVIDIA NIM / OpenAI-compatible
  const messages: any[] = [];

  // Only inject this system message for JSON responses — for plain-text requests (e.g. the
  // covering narrative letter in Pass 3), this instruction causes Groq to wrap the prose in
  // a JSON object or refuse to generate it at all.
  if (provider.name === 'groq' && responseFormat === 'json') {
    messages.push({ role: 'system', content: 'You are a document extraction assistant. Always respond in valid JSON format.' });
  } else if (provider.name === 'groq' && responseFormat === 'text') {
    messages.push({ role: 'system', content: 'You are a professional insurance letter writer. Respond with plain prose only — no JSON, no markdown, no code blocks.' });
  }

  if (images.length > 0) {
    // The chunk must already fit the provider's cap — the processor sizes it
    // from getActiveImageCap(). Truncating here would drop pages from an
    // estimate without telling anyone, so this throws instead.
    assertWithinImageCap(images.length, provider.maxImages ?? null, provider.name);
    const content: any[] = images.map(img => ({
      type: 'image_url',
      image_url: { url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` },
    }));
    content.push({ type: 'text', text: prompt });
    messages.push({ role: 'user', content });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const requestBody = {
    model: provider.model,
    messages,
    temperature: 0.1,
    // Only request json_object mode for JSON responses.
    // Pass 3 (covering narrative) returns plain text — json_object mode would
    // force the model to wrap the letter in JSON or produce a parse error.
    ...(responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
    max_tokens: provider.maxOutputTokens ?? 16384,
  };

  let data: any;
  if (provider.name === 'nvidia') {
    // NVIDIA's API sends no CORS headers → the browser cannot call it directly.
    // Route through the Cloud Function proxy (server-to-server, no CORS). Its
    // callable has its own 300s server-side timeout — opts.timeoutMs cannot be
    // applied mid-flight (a callable cannot be aborted once sent).
    const { callAiProxy } = await import('@/lib/firebase/functions');
    const proxied = await callAiProxy('nvidia', 'chat/completions', key, requestBody);
    if (!proxied.ok) {
      const err = safeJsonParse(proxied.body);
      throw new ProviderError('nvidia', proxied.status, err?.error?.message || String(proxied.status));
    }
    data = safeJsonParse(proxied.body) ?? {};
  } else {
    const res = await fetchWithTimeout(provider.name, provider.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(requestBody),
    }, opts.timeoutMs);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ProviderError(provider.name, res.status, err.error?.message || String(res.status));
    }

    data = await res.json();
    useUIStore.getState().setAIProviderHealth(provider.name as 'groq' | 'gemini', 'ok');
  }
  return {
    text: (data.choices?.[0]?.message?.content || '').trim(),
    finish: data.choices?.[0]?.finish_reason === 'length' ? 'MAX_TOKENS' : 'STOP',
  };
}

/** Parses JSON, returning null instead of throwing (upstream errors may return HTML). */
function safeJsonParse(text: string): any | null {
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * Returns true when the request was rejected because the prompt is too large
 * (HTTP 413 or Groq's "tokens per minute" / "Request too large" messages).
 * Rotating keys will NOT help — the payload itself must shrink.
 */
function isPayloadTooLarge(err: any): boolean {
  if (err?.status === 413) return true;
  const msg: string = (err?.message ?? '').toLowerCase();
  return (
    msg.includes('request too large') ||
    msg.includes('tokens per minute') ||
    msg.includes('reduce your message size') ||
    msg.includes('context_length_exceeded')
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  groq: 'Groq',
  nvidia: 'NVIDIA NIM',
  ollama: 'Ollama Cloud',
};

// ─── Fallback loop ────────────────────────────────────────────────────────────

export interface GatewaySession {
  id: string;
  lastGood?: { provider: ProviderId; model: string };
  /** Models this document must not use again (math second opinion). */
  avoid: Set<string>;
  /** Hops already announced for this document — one toast per distinct hop. */
  announced: Set<string>;
}
export function newSession(id: string): GatewaySession { return { id, avoid: new Set(), announced: new Set() }; }

export class AllProvidersBusyError extends Error {
  tried: string[];
  constructor(job: AIJob, tried: string[]) { super(`All AI models are busy (${job}: tried ${tried.join(', ') || 'none'})`); this.tried = tried; }
}
export class OfflineError extends Error { constructor() { super("You're offline — AI extraction needs a connection."); } }

const PROXIED: ReadonlySet<ProviderId> = new Set(['nvidia', 'ollama']);
const ENDPOINTS: Record<ProviderId, (model: string) => string> = {
  gemini: m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
  groq: () => 'https://api.groq.com/openai/v1/chat/completions',
  nvidia: () => 'https://integrate.api.nvidia.com/v1/chat/completions',
  ollama: () => 'https://ollama.com/api/chat',
};
const KEY_FIELDS: Record<ProviderId, (p: NonNullable<ReturnType<typeof getProfileFromStorage>>) => string[]> = {
  gemini: resolveGeminiKeys, groq: resolveGroqKeys, nvidia: resolveNvidiaKeys,
  ollama: p => (Array.isArray(p.ollamaApiKeys) ? p.ollamaApiKeys.filter(k => k?.trim()) : []),
};

/** Every admin-enabled model on every provider the surveyor has a key for. */
export function buildPool(profile: ReturnType<typeof getProfileFromStorage>): PoolEntry[] {
  if (!profile) return [];
  const cfg = useAIConfigStore.getState().config;
  const pool: PoolEntry[] = [];
  for (const provider of ['gemini', 'groq', 'nvidia', 'ollama'] as ProviderId[]) {
    const block = cfg.providers[provider];
    if (!block?.enabled) continue;
    const keys = KEY_FIELDS[provider](profile);
    if (keys.length === 0) continue;
    for (const model of block.models) pool.push({ provider, model, proxied: PROXIED.has(provider), keys });
  }
  return pool;
}

function toProvider(e: PoolEntry): AIProvider {
  return {
    name: e.provider, model: e.model.id, keys: e.keys, endpoint: ENDPOINTS[e.provider](e.model.id),
    maxImages: e.model.imageCap ?? undefined,
    maxOutputTokens: e.provider === 'groq' ? 8192 : undefined,
  };
}

/** A browser fetch that never reached the server (not any TypeError from our own code). */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && /fetch|network|load failed/i.test(err.message);
}

type Step = 'next-model' | 'next-key' | 'next-provider' | 'retry-no-thinking';

/** Decides what the loop does after one failed call. Pure; the loop applies side effects. */
function stepFor(err: any, provider: ProviderId): { step: Step; busy?: boolean; deadModel?: boolean; deadProvider?: boolean; notFound?: boolean; reprobe?: boolean } | { throw: Error } {
  const kind = classifyGatewayError(err);
  if (kind === 'subscription' || kind === 'unauthenticated') return { step: 'next-provider' };
  if (kind === 'timeout' || err?.name === 'TimeoutError') return { step: 'next-model', busy: true };
  if (isNetworkError(err)) return { step: 'next-provider' };
  if (isPayloadTooLarge(err)) return { throw: Object.assign(new Error(`PAYLOAD_TOO_LARGE: ${err.message}`), { status: 413 }) };
  const status: number = err?.status ?? 0;
  if (status === 503 || status === 500 || status === 502 || status === 504) return { step: 'next-model', busy: true };
  if (status === 429) {
    const q = provider === 'gemini' ? classifyGemini429({ status, message: err.message, details: err.details ?? [] }) : null;
    if (q === 'zero') return { step: 'next-model', notFound: true };
    if (q?.scope === 'model') return q.period === 'day' ? { step: 'next-model', deadModel: true } : { step: 'next-model', busy: true };
    if (q?.scope === 'project' && q.period === 'day') return { step: 'next-key', deadProvider: true };
    return { step: 'next-key' };
  }
  if (status === 404) return { step: 'next-model', notFound: true };
  if (status === 402) return { step: 'next-model', reprobe: true };
  if (status === 400 && provider === 'gemini' && isThinkingRejected({ status, message: err.message, details: [] })) return { step: 'retry-no-thinking' };
  if (status === 400 && isModalityRejected(err.message ?? '')) return { step: 'next-model', reprobe: true };
  if (status === 401 || status === 403) return { step: 'next-key' };
  if (status === 0 && kind === 'other') return { step: 'next-provider' };   // proxy transport
  return { throw: err };
}

function announce(session: GatewaySession | undefined, key: string, text: string, kind: 'info' | 'error' = 'info'): void {
  if (session) { if (session.announced.has(key)) return; session.announced.add(key); }
  toast[kind](text, { duration: kind === 'info' ? 4000 : 10000 });
}

async function callWithFallback(
  job: AIJob, prompt: string, images: string[], responseFormat: 'json' | 'text',
  session: GatewaySession | undefined, signal: AbortSignal | undefined, pool: PoolEntry[], preferredModel?: string,
): Promise<string> {
  const health = getHealth();
  const timeoutMs = JOB_TIMEOUT_MS[job];
  const tried: string[] = [];
  let networkErrors = 0, calls = 0;

  const walk = async (chain: PoolEntry[], allowSecondPass: boolean): Promise<string> => {
    const busyOnly: PoolEntry[] = [];
    const skipped = new Set<ProviderId>();

    for (const entry of chain) {
      if (signal?.aborted) throw Object.assign(new Error('Extraction cancelled'), { name: 'AbortError' });
      if (skipped.has(entry.provider)) continue;
      const provider = toProvider(entry);
      const label = `${PROVIDER_LABELS[entry.provider] ?? entry.provider} ${entry.model.label || entry.model.id}`;
      if (!tried.includes(entry.model.id)) tried.push(entry.model.id);
      let thinkingOff = true, lastBusy = false;

      keys: for (let i = 0; i < entry.keys.length; i++) {
        const key = entry.keys[i];
        try {
          calls++;
          const res = await callWithKey(provider, key, prompt, images, responseFormat, { timeoutMs, thinkingOff });
          if (res.finish === 'STOP' || res.finish === 'OTHER') {
            health.recordCall(entry.model.id, 'ok');
            if (session) session.lastGood = { provider: entry.provider, model: entry.model.id };
            return res.text;
          }
          health.recordCall(entry.model.id, 'other');
          if (res.finish === 'SAFETY') { skipped.add(entry.provider); break keys; }
          break keys;                                   // MAX_TOKENS → next model
        } catch (err: any) {
          if (err?.name === 'AbortError' && signal?.aborted) throw err;
          const d = stepFor(err, entry.provider);
          if ('throw' in d) throw d.throw;
          health.recordCall(entry.model.id, d.busy ? 'busy' : 'other');
          if (isNetworkError(err)) networkErrors++;
          if (d.deadModel) { health.markDeadToday(keyHash(key), entry.model.id); announce(session, `dead:${entry.model.id}`, `${label} has hit today's free limit (resets ${health.deadUntilLabel()}) — trying the next model.`); }
          if (d.deadProvider) health.markDeadToday(keyHash(key), '*');
          if (d.notFound) health.markNotFound(entry.model.id);
          if (d.reprobe) console.warn(`[ai-fallback] ${entry.model.id} rejected the request (${err.status}) — admin should re-probe.`);
          lastBusy = !!d.busy;
          if (d.busy) busyOnly.push(entry);
          console.info(`[ai-fallback] ${entry.provider}/${entry.model.id} key#${i + 1} → ${err.status ?? err.name}: ${d.step}`);

          // Same key once more with thinking left on; a second 400 is not a thinking problem → next model.
          if (d.step === 'retry-no-thinking' && thinkingOff) { thinkingOff = false; i--; continue; }
          if (d.step === 'next-key') {
            if (i + 1 < entry.keys.length) continue;
            const kind = classifyGatewayError(err);
            if (kind === 'auth') announce(session, `auth:${entry.provider}`, `${PROVIDER_LABELS[entry.provider]} key is invalid — check Profile → AI & Documents Intelligence.`, 'error');
            skipped.add(entry.provider); break keys;
          }
          if (d.step === 'next-provider') {
            const msg = gatewayErrorMessage(classifyGatewayError(err), PROVIDER_LABELS[entry.provider] ?? entry.provider);
            if (msg) announce(session, `provider:${entry.provider}`, msg, 'error');
            skipped.add(entry.provider); break keys;
          }
          break keys;                                   // next-model
        }
      }
      const next = chain[chain.indexOf(entry) + 1];
      if (lastBusy && next && !skipped.has(next.provider)) announce(session, `hop:${entry.model.id}`, `${label} busy — trying ${next.model.label || next.model.id}.`);
    }

    if (allowSecondPass && busyOnly.length > 0) {
      await new Promise(r => setTimeout(r, 5_000));
      return walk(busyOnly, false);
    }
    throw new AllProvidersBusyError(job, tried);
  };

  let chain = rankModels(job, images, pool, { health, preferredModel, avoid: session?.avoid });
  if (session?.lastGood) {
    const i = chain.findIndex(e => e.model.id === session.lastGood!.model);
    if (i > 0) chain = [...chain.slice(i), ...chain.slice(0, i)];
  }
  if (chain.length === 0 && pool.some(e => e.keys.some(k => health.isDeadToday(keyHash(k), e.model.id)))) {
    // Nothing left to walk today — say so instead of "busy, try again in a minute".
    toast.error(`Today's free limit is used up on every model (resets ${health.deadUntilLabel()}). Add a backup key in Profile → AI & Documents Intelligence.`, { duration: 10000 });
    throw new AllProvidersBusyError(job, []);
  }

  try {
    return await walk(chain, true);
  } catch (err) {
    if (err instanceof AllProvidersBusyError) {
      if (calls > 0 && networkErrors === calls) throw new OfflineError();
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OfflineError();
      const onlyGemini = pool.every(e => e.provider === 'gemini');
      const nudgeKey = 'surveyos.ai.nudge.ollama';
      let nudge = '';
      try {
        const last = Number(localStorage.getItem(nudgeKey) ?? 0);
        if (onlyGemini && Date.now() - last > 86_400_000) { nudge = ' — or add a free Ollama backup key in Profile → AI & Documents Intelligence'; localStorage.setItem(nudgeKey, String(Date.now())); }
      } catch { /* no nudge memory */ }
      toast.error(`All AI models are busy. Try again in a minute${nudge}.`, { duration: 10000 });
    }
    throw err;
  }
}

/**
 * Main entry point. Ranks every reachable model for the job and walks the
 * chain: hop models before keys, never retry a 503 in place.
 */
export async function callAIGateway(
  prompt: string, images: string[] = [], responseFormat: 'json' | 'text' = 'json',
  job: AIJob = 'light', session?: GatewaySession, signal?: AbortSignal,
): Promise<string> {
  // Admin test override: one explicit provider/model/key, no ranking, no fallback.
  if (_testOverride) {
    const p = buildOverrideProvider(_testOverride);
    const res = await callWithKey(p, p.keys[0], prompt, images, responseFormat, { timeoutMs: JOB_TIMEOUT_MS[job], thinkingOff: true });
    return res.text;
  }
  const profile = getProfileFromStorage();
  let pool = buildPool(profile);
  if (pool.length === 0) {
    // Nothing configured — Firestore master config (admin-provided keys), as before.
    const master = await getAIProvider();
    pool = [{ provider: master.name as ProviderId, proxied: PROXIED.has(master.name as ProviderId), keys: master.keys,
      model: { id: master.model, label: master.model, note: '', ctxWindow: null, vision: true, imageCap: master.maxImages ?? null } }];
  }
  // ponytail: until Phase 2 puts probe verdicts in the pool, the measured-exact model leads; the surveyor's pick still overrides.
  const preferred = profile?.geminiModel?.trim() || CURRENT_MODELS.gemini;
  return callWithFallback(job, prompt, images, responseFormat, session, signal, pool, preferred);
}


/**
 * Fetches available Gemini models live from the API using the first configured key.
 * Filters to only models that support generateContent (i.e. can do extraction).
 * Returns null if the fetch fails — caller should fall back to PROVIDER_MODELS.gemini.
 */
export async function fetchAvailableGeminiModels(apiKey: string): Promise<ModelOption[] | null> {
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',
      { headers: geminiAuthHeaders(apiKey) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const raw: Array<{ name: string; displayName: string; supportedGenerationMethods?: string[] }> =
      data.models ?? [];

    const vision = raw.filter(m => {
      const n = m.name;
      return (
        m.supportedGenerationMethods?.includes('generateContent') &&
        // Only text/vision multimodal Gemini models — skip everything else
        n.startsWith('models/gemini-') &&
        !n.includes('embedding') &&
        !n.includes('aqa') &&
        !n.includes('-tts') &&       // text-to-speech
        !n.includes('-image') &&     // image generation (Nano Banana variants)
        !n.includes('-live') &&      // live/streaming audio
        !n.includes('robotics') &&   // embodied reasoning
        !n.includes('computer-use') &&
        !n.includes('deep-research') &&
        !n.includes('-exp')          // experimental / unstable
      );
    });

    if (vision.length === 0) return null;

    return vision.map(m => {
      const id = m.name.replace('models/', '');
      // Match against static list to get the human note; fallback to display name
      const staticMatch = PROVIDER_MODELS.gemini.find(s => s.id === id);
      return {
        id,
        label: m.displayName ?? id,
        note: staticMatch?.note ?? 'Available on your account',
      };
    });
  } catch {
    return null;
  }
}

/** Like fetchAvailableGeminiModels but returns full ModelEntry rows (ctx, vision, capacity). */
export async function fetchGeminiModelEntries(apiKey: string): Promise<ModelEntry[] | null> {
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', { headers: geminiAuthHeaders(apiKey) });
    if (!res.ok) return null;
    const data = await res.json();
    const raw: Array<{ name: string; displayName?: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }> = data.models ?? [];
    const imageCap = PROVIDER_IMAGE_CAPS.gemini;
    const rows = raw
      .filter(m => {
        const n = m.name;
        return m.supportedGenerationMethods?.includes('generateContent') &&
          n.startsWith('models/gemini-') &&
          !/embedding|aqa|-tts|-image|-live|robotics|computer-use|deep-research|-exp/.test(n);
      })
      .map(m => {
        const id = m.name.replace('models/', '');
        const ctxWindow = m.inputTokenLimit ?? null;
        // Vision is left false here — the probe measures it. Assuming every
        // gemini-* model is multimodal is the same class of guess that
        // computeEstimateCapacity used to make.
        return { id, label: m.displayName ?? id, note: '', ctxWindow, vision: false, imageCap };
      });
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}

export interface ModelTestResult { ok: boolean; ms: number; data: unknown | null; error?: string; }

/** Runs a sample document through the extraction pipeline forced to one provider+model+key. */
export async function runModelTest(
  override: AITestOverride,
  docKey: string,
  file: File,
  onProgress: (msg: string) => void,
): Promise<ModelTestResult> {
  const started = Date.now();
  setAITestOverride(override);
  try {
    // Lazy import avoids a circular dependency (processor imports callAIGateway from here).
    const { extractDocument } = await import('./processor');
    const { data } = await extractDocument(docKey, file, onProgress);
    return { ok: true, ms: Date.now() - started, data };
  } catch (e: unknown) {
    return { ok: false, ms: Date.now() - started, data: null, error: e instanceof Error ? e.message : 'unknown error' };
  } finally {
    setAITestOverride(null);
  }
}