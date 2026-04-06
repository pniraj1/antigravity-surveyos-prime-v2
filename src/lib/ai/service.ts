// ═══════════════════════════════════════════════════════════
// AI GATEWAY SERVICE — Future-Proof Multi-Provider
// Reads config from: Profile Store (localStorage via Zustand)
// Priority: Profile store provider choice → Firestore master config
// Providers: Google Gemini | Groq (and any OpenAI-compatible)
//
// FUTURE PROOFING:
//   - To add a new provider: add a case in callAIGateway()
//   - To add new models: user updates the model field in Profile — no rebuild needed
//   - Model defaults are in profile-store.ts DEFAULT_PROFILE
// ═══════════════════════════════════════════════════════════

import { getFirebaseApp } from '../firebase/config';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

export interface AIProvider {
  name: 'groq' | 'gemini' | 'openai' | 'openrouter';
  endpoint: string;
  model: string;
  key?: string;
}

// ─── Read profile directly from Zustand persisted storage ────────────────────
// We read raw localStorage instead of importing the store to avoid circular deps
// and to keep this module usable outside React components.
function getProfileFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('surveyos-profile');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.profile ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the AI provider config from:
 *   1. User's profile store (localStorage) — personal key wins
 *   2. Firestore master config — admin-managed fallback
 */
export async function getAIProvider(): Promise<AIProvider> {
  const profile = getProfileFromStorage();

  if (profile) {
    const provider = profile.aiProvider ?? 'gemini';

    if (provider === 'gemini' && profile.geminiApiKey) {
      const model = profile.geminiModel || 'gemini-2.0-flash';
      return {
        name: 'gemini',
        endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        model,
        key: profile.geminiApiKey,
      };
    }

    if (provider === 'groq' && profile.groqApiKey) {
      const model = profile.groqModel || 'llama-3.2-11b-vision-preview';
      return {
        name: 'groq',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        model,
        key: profile.groqApiKey,
      };
    }

    // If preferred provider key is blank, try the other one as auto-fallback
    if (profile.groqApiKey) {
      const model = profile.groqModel || 'meta-llama/llama-4-scout-17b-16e-instruct';
      return {
        name: 'groq',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        model,
        key: profile.groqApiKey,
      };
    }
    if (profile.geminiApiKey) {
      const model = profile.geminiModel || 'gemini-2.0-flash';
      return {
        name: 'gemini',
        endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        model,
        key: profile.geminiApiKey,
      };
    }
  }

  // ── Legacy keys (backward compat): raw localStorage entries ────────────────
  const legacyGroq    = typeof window !== 'undefined' ? localStorage.getItem('surveyos_personal_groq_key') : null;
  const legacyGemini  = typeof window !== 'undefined' ? localStorage.getItem('surveyos_personal_gemini_key') : null;
  const legacyGroqMod = (typeof window !== 'undefined' && localStorage.getItem('surveyos_personal_groq_model')) || 'meta-llama/llama-4-scout-17b-16e-instruct';
  const legacyGemMod  = (typeof window !== 'undefined' && localStorage.getItem('surveyos_personal_gemini_model')) || 'gemini-2.0-flash';

  if (legacyGemini) {
    return { name: 'gemini', endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${legacyGemMod}:generateContent`, model: legacyGemMod, key: legacyGemini };
  }
  if (legacyGroq) {
    return { name: 'groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', model: legacyGroqMod, key: legacyGroq };
  }

  // ── Firestore master config (admin-managed) ───────────────────────────────
  try {
    const db = getFirestore(getFirebaseApp());
    const configDoc = await getDoc(doc(db, 'ai_config', 'routing'));
    if (configDoc.exists()) {
      const data = configDoc.data();
      const masterProvider = (data.providers || []).find((p: any) => p.enabled);
      if (masterProvider) return { ...masterProvider, key: masterProvider.keys?.[0] };
    }
  } catch (err) {
    console.warn('[AI Service] Master config unreachable:', err);
  }

  throw new Error(
    'No AI provider configured. Go to Profile → AI & API Configuration and enter your Gemini or Groq API key.'
  );
}

/**
 * Calls the configured AI provider with a prompt and optional image pages.
 * Automatically handles Gemini vs Groq/OpenAI API formats.
 * Future providers: add a new `else if (provider.name === 'newprovider')` block.
 */
export async function callAIGateway(prompt: string, images: string[] = []): Promise<string> {
  const provider = await getAIProvider();

  if (!provider.key) throw new Error(`No API key found for provider: ${provider.name}`);

  // ── Google Gemini ──────────────────────────────────────────────────────────
  if (provider.name === 'gemini') {
    const url = `${provider.endpoint}?key=${provider.key}`;
    const parts: any[] = images.map(img => ({
      inlineData: { mimeType: 'image/jpeg', data: img },
    }));
    parts.push({ text: prompt });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gemini API Error: ${err.error?.message || res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.replace(/```json|```/g, '').trim();
  }

  // ── Groq / OpenAI-compatible ───────────────────────────────────────────────
  const messages: any[] = [];
  if (images.length > 0) {
    // Hard-clip to 5 images for safety with Groq/OpenAI models
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.key}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${provider.name} API Error: ${err.error?.message || res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return text.trim();
}
