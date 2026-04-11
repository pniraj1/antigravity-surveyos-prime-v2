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
// Update these constants when providers release better models.
// Surveyors never touch model names.
export const CURRENT_MODELS = {
  gemini: 'gemini-2.0-flash',
  groq:   'meta-llama/llama-4-scout-17b-16e-instruct',
};

// Retired Gemini model names → auto-migrated to current default
const DEPRECATED_GEMINI_MODELS: Record<string, string> = {
  'gemini-1.5-flash':      'gemini-2.0-flash',
  'gemini-1.5-pro':        'gemini-2.0-flash',
  'gemini-1.0-pro':        'gemini-2.0-flash',
  'gemini-pro':            'gemini-2.0-flash',
  'gemini-pro-vision':     'gemini-2.0-flash',
};

export interface AIProvider {
  name: 'groq' | 'gemini' | 'openai' | 'openrouter';
  endpoint: string;
  model: string;
  keys: string[];  // ordered list — key[0] tried first
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

/** Resolves effective Groq model — uses developer default if blank. */
function resolveGroqModel(profile: ReturnType<typeof getProfileFromStorage>): string {
  const stored = profile?.groqModel?.trim();
  return stored || CURRENT_MODELS.groq;
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

/**
 * Resolves provider config for a given provider name.
 * Returns null if no keys are configured.
 */
function buildProvider(
  name: 'gemini' | 'groq',
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
  // groq
  const keys = resolveGroqKeys(profile);
  if (keys.length === 0) return null;
  const model = resolveGroqModel(profile);
  return {
    name: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model,
    keys,
  };
}

/**
 * Resolves the primary + fallback provider configs from profile.
 * Returns [primary, fallback] — fallback may be null.
 */
export async function getAIProvider(): Promise<AIProvider> {
  const profile = getProfileFromStorage();

  if (profile) {
    const preferred = profile.aiProvider ?? 'gemini';
    const fallback  = preferred === 'gemini' ? 'groq' : 'gemini';

    const primary = buildProvider(preferred, profile);
    if (primary) return primary;

    // Preferred has no keys — try fallback with a visible warning
    const fallbackProvider = buildProvider(fallback, profile);
    if (fallbackProvider) {
      toast.warning(
        `No ${preferred === 'gemini' ? 'Gemini' : 'Groq'} API key — falling back to ${fallback === 'gemini' ? 'Google Gemini' : 'Groq'} for this extraction.`,
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
async function callWithKey(provider: AIProvider, key: string, prompt: string, images: string[]): Promise<string> {
  if (provider.name === 'gemini') {
    const url = `${provider.endpoint}?key=${key}`;
    const parts: any[] = images.map(img => ({
      inlineData: { mimeType: 'image/jpeg', data: img },
    }));
    parts.push({ text: prompt });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, topP: 0.95, topK: 40, maxOutputTokens: 8192 },
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
    useUIStore.getState().setAIProviderHealth('gemini', 'ok');
    return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```json|```/g, '').trim();
  }

  // Groq / OpenAI-compatible
  const messages: any[] = [];
  if (images.length > 0) {
    const safeImages = images.slice(0, 5);
    const content: any[] = safeImages.map(img => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${img}` },
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
      response_format: { type: 'json_object' },
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
  useUIStore.getState().setAIProviderHealth('groq', 'ok');
  return (data.choices?.[0]?.message?.content || '').trim();
}

/**
 * Calls a provider, rotating through all its keys on 429/401 errors.
 * Returns the response text or throws if all keys fail.
 */
/** Returns true if the error is a billing/free-tier quota exhaustion (not a temporary rate limit). */
function isQuotaExhausted(err: any): boolean {
  const msg: string = err?.message ?? '';
  return err?.status === 429 && (
    msg.toLowerCase().includes('quota exceeded') ||
    msg.toLowerCase().includes('free_tier') ||
    msg.toLowerCase().includes('limit: 0')
  );
}

async function callWithRotation(provider: AIProvider, prompt: string, images: string[]): Promise<string> {
  let lastError: Error = new Error('No keys available');
  const providerLabel = provider.name === 'gemini' ? 'Gemini' : 'Groq';

  for (let i = 0; i < provider.keys.length; i++) {
    const key = provider.keys[i];
    try {
      return await callWithKey(provider, key, prompt, images);
    } catch (err: any) {
      lastError = err;
      const isAuthError = err.status === 401 || err.status === 403;

      if (isQuotaExhausted(err)) {
        // Free-tier quota exhausted — all keys share the same billing account, no point rotating
        useUIStore.getState().setAIProviderHealth(provider.name as 'gemini' | 'groq', 'error');
        toast.error(
          `${providerLabel} free-tier quota exhausted. Switch to ${provider.name === 'gemini' ? 'Groq' : 'Gemini'} in Profile → AI & Documents Intelligence, or wait for quota reset.`,
          { duration: 10000 }
        );
        break;
      } else if (err.status === 429) {
        // Temporary rate limit — try next key
        useUIStore.getState().setAIProviderHealth(provider.name as 'gemini' | 'groq', 'rate-limited');
        if (i + 1 < provider.keys.length) {
          toast.warning(
            `${providerLabel} key ${i + 1} rate limited — switching to backup key ${i + 2}.`,
            { duration: 4000 }
          );
          await new Promise(r => setTimeout(r, 300));
          continue;
        }
      } else if (isAuthError) {
        useUIStore.getState().setAIProviderHealth(provider.name as 'gemini' | 'groq', 'error');
        toast.error(
          `${providerLabel} key ${i + 1} is invalid — check your API key in Profile → AI & Documents Intelligence.`,
          { duration: 6000 }
        );
        break;
      } else {
        // Network or server error — try next key
        if (i + 1 < provider.keys.length) continue;
      }
    }
  }

  useUIStore.getState().setAIProviderHealth(provider.name as 'gemini' | 'groq', 'error');
  throw lastError;
}

/**
 * Main entry point. Calls the configured AI provider with key rotation.
 * If all keys for the primary provider fail, automatically falls back to the other provider.
 */
export async function callAIGateway(prompt: string, images: string[] = []): Promise<string> {
  const profile = getProfileFromStorage();
  const preferred = profile?.aiProvider ?? 'gemini';
  const fallbackName = preferred === 'gemini' ? 'groq' : 'gemini';

  const primaryProvider = profile ? buildProvider(preferred, profile) : null;
  const fallbackProvider = profile ? buildProvider(fallbackName, profile) : null;

  // Try primary provider
  if (primaryProvider) {
    try {
      return await callWithRotation(primaryProvider, prompt, images);
    } catch (primaryErr: any) {
      // All keys for primary exhausted — try fallback if available
      if (fallbackProvider) {
        toast.warning(
          `${preferred === 'gemini' ? 'Gemini' : 'Groq'} unavailable — automatically switching to ${fallbackName === 'gemini' ? 'Google Gemini' : 'Groq'}.`,
          { duration: 5000 }
        );
        try {
          return await callWithRotation(fallbackProvider, prompt, images);
        } catch (fallbackErr: any) {
          toast.error(
            `Both Gemini and Groq failed. Check your API keys in Profile → AI & Documents Intelligence.`,
            { duration: 10000 }
          );
          throw fallbackErr;
        }
      }
      // No fallback configured — give actionable guidance
      const fallbackLabel = preferred === 'gemini' ? 'Groq' : 'Gemini';
      toast.error(
        `${preferred === 'gemini' ? 'Gemini' : 'Groq'} failed and no ${fallbackLabel} key is configured as backup. Add a ${fallbackLabel} key in Profile → AI & Documents Intelligence.`,
        { duration: 10000 }
      );
      throw primaryErr;
    }
  }

  // No primary keys — go straight to fallback (already warned in getAIProvider)
  if (fallbackProvider) {
    return callWithRotation(fallbackProvider, prompt, images);
  }

  // Nothing configured — try Firestore master config
  const masterProvider = await getAIProvider();
  return callWithRotation(masterProvider, prompt, images);
}
