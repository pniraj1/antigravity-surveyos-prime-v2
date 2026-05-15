// ═══════════════════════════════════════════════════════════
// AI GATEWAY SERVICE — Multi-Provider with Key Rotation
//
// DEVELOPER NOTES:
//   - Update CURRENT_MODELS when providers release better models.
//     Surveyors never need to touch model names.
//   - Key rotation: tries each key in order on 429/401 errors.
//   - Auto-fallback: if all Gemini keys fail, tries Groq and vice versa.
// ═══════════════════════════════════════════════════════════

import { getFirebaseApp } from '../firebase/config';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { toast } from 'sonner';

// ─── Developer-controlled model defaults ─────────────────────────────────────
// Last verified: May 2026 — Free Tier limits:
//   gemini-2.5-flash     : 10 RPM · 500 RPD · 250K TPM  ← best stable free model
//   gemini-2.5-flash-lite : 15 RPM · 1000 RPD
//   llama-4-scout        : Groq free tier, vision-capable
export const CURRENT_MODELS = {
  gemini: 'gemini-2.5-flash',
  // Llama 4 Scout — vision-capable, free tier on Groq
  groq:   'meta-llama/llama-4-scout-17b-16e-instruct',
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
export const PROVIDER_MODELS: Record<'gemini' | 'groq' | 'nvidia', ModelOption[]> = {
  gemini: [
    { id: 'gemini-2.5-pro',        label: '2.5 Pro',        note: 'Most capable · deep reasoning · complex docs' },
    { id: 'gemini-2.5-flash',      label: '2.5 Flash ✓',    note: 'Best value · 10 RPM · 500/day' },
    { id: 'gemini-2.5-flash-lite', label: '2.5 Flash-Lite', note: 'Fastest · cheapest · 15 RPM · 1000/day' },
  ],
  groq: [
    // Vision-capable (verified May 2026)
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout ✓', note: 'Best · vision + text · free tier · ~400 tps' },
    // Text-only production models
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', note: 'Production · text only · reliable' },
    { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',  note: 'Production · fastest · text only' },
  ],
  nvidia: [
    { id: 'meta/llama-3.2-90b-vision-instruct', label: 'Llama 3.2 90B', note: 'Default · best vision' },
    { id: 'meta/llama-3.2-11b-vision-instruct', label: 'Llama 3.2 11B', note: 'Smaller · faster' },
  ],
};

// ─── Fallback chain when a model is unavailable on this account tier ──────────
// Tried in order. All are currently free-tier functional (April 2026).
const GEMINI_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

// Groq fallback chain (May 2026).
// llama-4-scout (vision+text) → llama-3.3-70b (text) → llama-3.1-8b (fastest text)
const GROQ_FALLBACK_CHAIN = [
  'meta-llama/llama-4-scout-17b-16e-instruct',  // vision + text · best
  'llama-3.3-70b-versatile',                    // text-only · reliable
  'llama-3.1-8b-instant',                       // text-only · fastest
];

// Models in the Groq fallback chain that support image/vision inputs.
// Text-only models are skipped when the extraction includes images (e.g. RC scans).
const GROQ_VISION_MODELS = new Set([
  'meta-llama/llama-4-scout-17b-16e-instruct',
]);

// Old model names stored in user profiles → auto-migrated to current default
const DEPRECATED_GEMINI_MODELS: Record<string, string> = {
  'gemini-pro':               'gemini-2.5-flash',
  'gemini-pro-vision':        'gemini-2.5-flash',
  'gemini-1.0-pro':           'gemini-2.5-flash',
  'gemini-1.5-flash':         'gemini-2.5-flash',
  'gemini-1.5-flash-latest':  'gemini-2.5-flash',
  'gemini-1.5-pro':           'gemini-2.5-flash',
  'gemini-2.0-flash':         'gemini-2.5-flash',       // deprecated, being shut down
  'gemini-2.0-flash-lite':    'gemini-2.5-flash-lite',  // deprecated, being shut down
  'gemini-2.0-flash-exp':     'gemini-2.5-flash',
  'gemini-3-pro-preview':     'gemini-3.1-pro-preview', // shut down March 9, 2026
};

const DEPRECATED_GROQ_MODELS: Record<string, string> = {
  // Fake model IDs that never existed on Groq → migrate to real default
  'openai/gpt-oss-120b': 'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-20b':  'meta-llama/llama-4-scout-17b-16e-instruct',
  // Maverick deprecated March 9, 2026
  'meta-llama/llama-4-maverick-17b-128e-instruct': 'meta-llama/llama-4-scout-17b-16e-instruct',
  // Old vision-preview models removed by Groq
  'llama-3.2-90b-vision-preview': 'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.2-11b-vision-preview': 'meta-llama/llama-4-scout-17b-16e-instruct',
};

export interface AIProvider {
  name: 'groq' | 'gemini' | 'openai' | 'nvidia';
  endpoint: string;
  model: string;
  keys: string[];
  /** Max images per request. Groq is limited to 5; undefined = unlimited. */
  maxImages?: number;
  /** Max output tokens. Groq Llama 4 Scout is capped at 8192; undefined = 16384. */
  maxOutputTokens?: number;
}

// ─── Read profile from Zustand ────────────────────────────────────────────────
function getProfileFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return useProfileStore.getState().profile ?? null;
  } catch {
    return null;
  }
}

/** Resolves effective Gemini model — migrates deprecated names, uses developer default if blank. */
function resolveGeminiModel(profile: ReturnType<typeof getProfileFromStorage>): string {
  const stored = profile?.geminiModel?.trim();
  if (!stored) return CURRENT_MODELS.gemini;
  if (DEPRECATED_GEMINI_MODELS[stored]) {
    const migrated = DEPRECATED_GEMINI_MODELS[stored];
    useProfileStore.getState().updateProfile({ geminiModel: migrated });
    toast.info(`Gemini model updated: ${stored} → ${migrated} (old model retired by Google).`, { duration: 6000 });
    return migrated;
  }
  return stored;
}

/** Resolves effective Groq model — migrates deprecated names, uses developer default if blank. */
function resolveGroqModel(profile: ReturnType<typeof getProfileFromStorage>): string {
  const stored = profile?.groqModel?.trim();
  if (!stored) return CURRENT_MODELS.groq;
  if (DEPRECATED_GROQ_MODELS[stored]) {
    const migrated = DEPRECATED_GROQ_MODELS[stored];
    useProfileStore.getState().updateProfile({ groqModel: migrated });
    toast.info(`Groq model updated: ${stored} → ${migrated} (old model unavailable).`, { duration: 6000 });
    return migrated;
  }
  return stored;
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

function resolveNvidiaModel(profile: ReturnType<typeof getProfileFromStorage>): string {
  return profile?.nvidiaModel?.trim() || CURRENT_MODELS.nvidia;
}

/**
 * Resolves provider config for a given provider name.
 * Returns null if no keys are configured.
 */
function buildProvider(
  name: 'gemini' | 'groq' | 'nvidia',
  profile: ReturnType<typeof getProfileFromStorage>
): AIProvider | null {
  if (name === 'gemini') {
    const keys = resolveGeminiKeys(profile);
    if (keys.length === 0) return null;
    const model = resolveGeminiModel(profile);
    return {
      name: 'gemini',
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      model,
      keys,
    };
  }
  if (name === 'nvidia') {
    const keys = resolveNvidiaKeys(profile);
    if (keys.length === 0) return null;
    const model = resolveNvidiaModel(profile);
    return {
      name: 'nvidia',
      endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
      model,
      keys,
      // No maxImages cap — NVIDIA NIM handles full documents
    };
  }
  // groq
  const keys = resolveGroqKeys(profile);
  if (keys.length === 0) return null;
  const model = resolveGroqModel(profile);
  return {
    name: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model,
    keys,
    maxImages: 5,
    maxOutputTokens: 8192,
  };
}

/**
 * Resolves the primary + fallback provider configs from profile.
 * Returns [primary, fallback] — fallback may be null.
 */
export async function getAIProvider(): Promise<AIProvider> {
  const profile = getProfileFromStorage();

  if (profile) {
    const preferred = (profile.aiProvider ?? 'gemini') as 'gemini' | 'groq' | 'nvidia';
    const fallback: 'gemini' | 'groq' = preferred === 'groq' ? 'gemini' : 'groq';

    const primary = buildProvider(preferred, profile);
    if (primary) return primary;

    // Preferred has no keys — try fallback with a visible warning
    const fallbackProvider = buildProvider(fallback, profile);
    if (fallbackProvider) {
      const names: Record<string, string> = { gemini: 'Google Gemini', groq: 'Groq', nvidia: 'NVIDIA NIM' };
      toast.warning(
        `No ${names[preferred]} API key — falling back to ${names[fallback]} for this extraction.`,
        { duration: 5000 }
      );
      return fallbackProvider;
    }
  }

  // ── Firestore master config (admin-managed) ───────────────────────────────
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

/** Calls one provider with one specific key. Throws on error. */
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
function isModelUnavailable(err: any): boolean {
  const msg: string = (err?.message ?? '').toLowerCase();
  return err?.status === 404 || msg.includes('not found') || msg.includes('model') && msg.includes('does not exist');
}

async function callWithKey(provider: AIProvider, key: string, prompt: string, images: string[], responseFormat: 'json' | 'text' = 'json'): Promise<string> {
  if (provider.name === 'gemini') {
    // ── Auth: AIza... = API key (?key= param); anything else = OAuth Bearer token ──
    // Keys from AI Studio start with "AIza".
    // OAuth access tokens (ya29., AQ., etc.) must go in the Authorization header.
    const isApiKey = key.startsWith('AIza');
    const url = isApiKey
      ? `${provider.endpoint}?key=${key}`
      : provider.endpoint;  // OAuth: no key in URL
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!isApiKey) headers['Authorization'] = `Bearer ${key}`;

    const parts: any[] = images.map(img => ({
      inlineData: { mimeType: getMimeType(img), data: toRawBase64(img) },
    }));
    parts.push({ text: prompt });

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { 
          temperature: 0.1, 
          topP: 0.95, 
          topK: 40, 
          maxOutputTokens: 65536,  // gemini-2.5-flash supports up to 65K — needed for multi-page invoices
          // Only force JSON mime when the caller actually expects JSON back.
          // Pass 3 (covering narrative) expects plain text — forcing JSON mode
          // causes the model to wrap the letter in a JSON object or refuse.
          ...(responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const status = res.status;
      throw Object.assign(
        new Error(`Gemini API Error: ${err.error?.message || status}`),
        { status }
      );
    }

    const data = await res.json();
    
    if (data.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new Error("Gemini blocked the extraction due to safety filters (it likely detected personal info in the document).");
    }

    useUIStore.getState().setAIProviderHealth('gemini', 'ok');
    return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```json|```/g, '').trim();
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
    // Apply per-provider image cap (Groq = 5, NVIDIA/others = unlimited)
    const cap = provider.maxImages ?? images.length;
    const safeImages = images.slice(0, cap);
    const content: any[] = safeImages.map(img => ({
      type: 'image_url',
      image_url: { url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` },
    }));
    content.push({ type: 'text', text: prompt });
    messages.push({ role: 'user', content });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const res = await fetch(provider.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: 0.1,
      // Only request json_object mode for JSON responses.
      // Pass 3 (covering narrative) returns plain text — json_object mode would
      // force the model to wrap the letter in JSON or produce a parse error.
      ...(responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
      max_tokens: provider.maxOutputTokens ?? 16384,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(
      new Error(`${provider.name} API Error: ${err.error?.message || res.status}`),
      { status: res.status }
    );
  }

  const data = await res.json();
  useUIStore.getState().setAIProviderHealth(provider.name as 'groq' | 'gemini', 'ok');
  return (data.choices?.[0]?.message?.content || '').trim();
}

/** Returns true if the error is a billing/free-tier quota exhaustion (not a temporary rate limit). */
function isQuotaExhausted(err: any): boolean {
  const msg: string = (err?.message ?? '').toLowerCase();
  return err?.status === 429 && (
    msg.includes('quota exceeded') ||
    msg.includes('free_tier') ||
    msg.includes('limit: 0')
  );
}

/** Returns true when Gemini is temporarily overloaded (not a quota or auth issue). */
function isHighDemandError(err: any): boolean {
  const msg: string = (err?.message ?? '').toLowerCase();
  return (err?.status === 503 || err?.status === 500) && (
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('service unavailable') ||
    msg.includes('try again')
  );
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
};

/**
 * Calls a provider with key rotation.
 * On Gemini 503 high-demand: retries same key up to 2× with 1.5s wait before moving on.
 * On 429 rate-limit: rotates to next key.
 */
async function callWithRotation(provider: AIProvider, prompt: string, images: string[], responseFormat: 'json' | 'text' = 'json'): Promise<string> {
  let lastError: Error = new Error('No keys available');
  const providerLabel = PROVIDER_LABELS[provider.name] ?? provider.name;

  let downgradedProvider = provider;
  const triedModels = new Set<string>([provider.model]);

  for (let i = 0; i < downgradedProvider.keys.length; i++) {
    const key = downgradedProvider.keys[i];

    // ── High-demand retry: up to 2 retries with 1.5s gap before rotating key ──
    let demandRetries = 0;
    while (demandRetries <= 2) {
      try {
        return await callWithKey(downgradedProvider, key, prompt, images, responseFormat);
      } catch (err: any) {
        lastError = err;

        if (isHighDemandError(err) && demandRetries < 2) {
          demandRetries++;
          if (demandRetries === 1) {
            toast.info(`${providerLabel} is under high demand — retrying in 1.5s…`, { duration: 3000 });
          }
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        // Not a high-demand error, or retries exhausted — break to key rotation logic
        break;
      }
    }

    const err = lastError as any;
    const isAuthError = err.status === 401 || err.status === 403;

    // ── Payload too large: no point rotating keys — the prompt must shrink ──
    if (isPayloadTooLarge(err)) {
      const healthKey = provider.name === 'gemini' || provider.name === 'groq' ? provider.name : 'groq';
      useUIStore.getState().setAIProviderHealth(healthKey, 'error');
      // Re-throw immediately with a clear signal so the processor can adapt
      throw Object.assign(
        new Error(`PAYLOAD_TOO_LARGE: ${err.message}`),
        { status: 413 }
      );
    }

    // ── Model not found on this account → walk Gemini fallback chain ──
    if (provider.name === 'gemini' && isModelUnavailable(err)) {
      const nextModel = GEMINI_FALLBACK_CHAIN.find(m => !triedModels.has(m));
      if (nextModel) {
        triedModels.add(nextModel);
        toast.info(`${downgradedProvider.model} unavailable — trying ${nextModel} automatically.`, { duration: 4000 });
        downgradedProvider = {
          ...provider,
          model: nextModel,
          endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${nextModel}:generateContent`,
        };
        i = -1;
        continue;
      }
      break;
    }

    // ── Model not found on this account → walk Groq fallback chain ──
    if (provider.name === 'groq' && isModelUnavailable(err)) {
      const needsVision = images.length > 0;
      const nextModel = GROQ_FALLBACK_CHAIN.find(m => {
        if (triedModels.has(m)) return false;
        // When processing images, skip text-only models — they will silently
        // ignore the images and return a useless response for visual docs like RCs.
        if (needsVision && !GROQ_VISION_MODELS.has(m)) return false;
        return true;
      });
      if (nextModel) {
        triedModels.add(nextModel);
        const isVision = GROQ_VISION_MODELS.has(nextModel);
        toast.info(
          `Groq: ${downgradedProvider.model} unavailable — trying ${nextModel}${ isVision ? '' : ' (text-only)' } automatically.`,
          { duration: 4000 }
        );
        downgradedProvider = { ...provider, model: nextModel };
        i = -1;
        continue;
      }
      // No suitable fallback for this input type — surface a helpful error
      if (needsVision) {
        toast.error(
          'No Groq vision model is available on your plan. Switch to Gemini in Profile → AI & Documents Intelligence.',
          { duration: 8000 }
        );
      }
      break;
    }

    if (isQuotaExhausted(err)) {
      const healthKey = provider.name === 'gemini' || provider.name === 'groq' ? provider.name : 'groq';
      useUIStore.getState().setAIProviderHealth(healthKey, 'error');
      toast.error(
        `${providerLabel} free-tier quota exhausted. Switch provider in Profile → AI & Documents Intelligence, or wait for quota reset.`,
        { duration: 10000 }
      );
      break;
    } else if (err.status === 429) {
      const healthKey = provider.name === 'gemini' || provider.name === 'groq' ? provider.name : 'groq';
      useUIStore.getState().setAIProviderHealth(healthKey, 'rate-limited');
      if (i + 1 < downgradedProvider.keys.length) {
        toast.warning(`${providerLabel} key ${i + 1} rate limited — switching to backup key ${i + 2}.`, { duration: 4000 });
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
    } else if (isAuthError) {
      const healthKey = provider.name === 'gemini' || provider.name === 'groq' ? provider.name : 'groq';
      useUIStore.getState().setAIProviderHealth(healthKey, 'error');
      toast.error(`${providerLabel} key ${i + 1} is invalid — check your API key in Profile → AI & Documents Intelligence.`, { duration: 6000 });
      break;
    } else {
      if (i + 1 < downgradedProvider.keys.length) continue;
    }
  }

  const healthKey = provider.name === 'gemini' || provider.name === 'groq' ? provider.name : 'groq';
  useUIStore.getState().setAIProviderHealth(healthKey, 'error');
  throw lastError;
}

/**
 * Main entry point. Calls the configured AI provider with key rotation.
 * Fallback chain: primary → secondary → NVIDIA NIM (if keys configured).
 */
export async function callAIGateway(prompt: string, images: string[] = [], responseFormat: 'json' | 'text' = 'json'): Promise<string> {
  const profile = getProfileFromStorage();
  const preferred = (profile?.aiProvider ?? 'gemini') as 'gemini' | 'groq' | 'nvidia';
  const secondaryName: 'gemini' | 'groq' = preferred === 'groq' ? 'gemini' : 'groq';

  const primaryProvider  = profile ? buildProvider(preferred, profile) : null;
  const secondaryProvider = profile ? buildProvider(secondaryName, profile) : null;
  const nvidiaProvider   = profile ? buildProvider('nvidia', profile) : null;

  // Try primary provider
  if (primaryProvider) {
    try {
      return await callWithRotation(primaryProvider, prompt, images, responseFormat);
    } catch (primaryErr: any) {
      // ── PAYLOAD_TOO_LARGE: re-throw immediately ──────────────────────────
      // Rotating keys or switching providers won't fix an oversized prompt.
      // processor.ts catches this specific signal and retries in vision-mode.
      if (isPayloadTooLarge(primaryErr)) {
        throw Object.assign(
          new Error(`PAYLOAD_TOO_LARGE: ${primaryErr.message}`),
          { status: 413 }
        );
      }
      // Log the real error so it's traceable in production devtools
      console.warn(
        `[AI Gateway] Primary provider (${PROVIDER_LABELS[preferred]}) failed — falling back to secondary.`,
        primaryErr?.message ?? primaryErr
      );
    }
    if (secondaryProvider) {
      toast.warning(
        `${PROVIDER_LABELS[preferred]} unavailable — switching to ${PROVIDER_LABELS[secondaryName]}.`,
        { duration: 5000 }
      );
      try {
        return await callWithRotation(secondaryProvider, prompt, images, responseFormat);
      } catch {
        // fall through to NVIDIA
      }
    }
    if (nvidiaProvider) {
      toast.warning('Gemini and Groq both failed — trying NVIDIA NIM as last resort.', { duration: 5000 });
      try {
        return await callWithRotation(nvidiaProvider, prompt, images, responseFormat);
      } catch (nvidiaErr: any) {
        toast.error('All AI providers failed. Check your API keys in Profile → AI & Documents Intelligence.', { duration: 10000 });
        throw nvidiaErr;
      }
    }
    // No secondary or nvidia configured
    toast.error(
      `${PROVIDER_LABELS[preferred]} failed. Add a backup key in Profile → AI & Documents Intelligence.`,
      { duration: 10000 }
    );
    throw new Error(`${PROVIDER_LABELS[preferred]} failed and no fallback provider is configured.`);
  }

  // No primary keys — go straight to secondary or NVIDIA
  if (secondaryProvider) return callWithRotation(secondaryProvider, prompt, images, responseFormat);
  if (nvidiaProvider) return callWithRotation(nvidiaProvider, prompt, images, responseFormat);

  // Nothing configured — try Firestore master config
  const masterProvider = await getAIProvider();
  return callWithRotation(masterProvider, prompt, images, responseFormat);
}

/**
 * Fetches available Gemini models live from the API using the first configured key.
 * Filters to only models that support generateContent (i.e. can do extraction).
 * Returns null if the fetch fails — caller should fall back to PROVIDER_MODELS.gemini.
 */
export async function fetchAvailableGeminiModels(apiKey: string): Promise<ModelOption[] | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${apiKey}`
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
