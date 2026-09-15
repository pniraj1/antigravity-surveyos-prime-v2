import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export type ProviderId = 'gemini' | 'groq' | 'nvidia' | 'ollama';

export interface ModelEntry {
  id: string;
  label: string;
  note: string;          // admin free-text guidance
  ctxWindow: number | null;
  vision: boolean;
  imageCap: number | null;
}

export interface ProviderConfig {
  enabled: boolean;
  defaultModel: string;
  models: ModelEntry[];
}

export interface AIModelsConfig {
  updatedAt: number | null;
  updatedBy: string;
  defaultProvider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
}

/**
 * Per-provider image cap — the maximum images accepted in ONE request.
 * Groq accepts 5. NVIDIA NIM accepts exactly 1 and 400s on more
 * ("At most 1 image(s) may be provided in one request"). Gemini is uncapped.
 * These are defaults; a probe result overrides them per model.
 */
export const PROVIDER_IMAGE_CAPS: Record<ProviderId, number | null> = {
  gemini: null,
  groq: 5,
  nvidia: 1,
  ollama: null,   // measured 2026-09-15: gemma4:31b accepted 5 pages in one call
};

/** Formats a context window token count into a short badge string (1M, 131K). */
export function formatCtx(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/**
 * The image cap that applies to a specific enabled model: the probed value
 * recorded on its ModelEntry, falling back to the provider default when the
 * model has not been probed.
 *
 * The cap is genuinely per-model, not per-provider: nvidia/nemotron-nano-12b-v2-vl
 * accepts 2 images while meta/llama-3.2-90b-vision-instruct rejects them.
 */
export function resolveModelImageCap(
  providerId: ProviderId,
  modelId: string,
  block: ProviderConfig,
): number | null {
  const probed = block.models.find(m => m.id === modelId)?.imageCap;
  return probed ?? PROVIDER_IMAGE_CAPS[providerId];
}

function entry(p: ProviderId, id: string, label: string, note: string, ctxWindow: number | null, vision: boolean): ModelEntry {
  return { id, label, note, ctxWindow, vision, imageCap: PROVIDER_IMAGE_CAPS[p] };
}

/** Offline fallback used when Firestore is unreachable or the doc is absent. */
export const FALLBACK_AI_MODELS_CONFIG: AIModelsConfig = {
  updatedAt: null,
  updatedBy: 'fallback',
  defaultProvider: 'gemini',
  providers: {
    // Every id below was verified by live API call on 2026-08-10 and is guarded
    // by src/lib/ai/__tests__/shipped-defaults.test.ts.
    gemini: {
      enabled: true,
      defaultModel: 'gemini-2.5-flash',
      models: [
        entry('gemini', 'gemini-2.5-flash', '2.5 Flash', 'Best value · ~10s/page', 1_048_576, true),
        entry('gemini', 'gemini-flash-lite-latest', 'Flash-Lite', 'Fastest · ~3s/page', 1_048_576, true),
        entry('gemini', 'gemini-3.5-flash', '3.5 Flash', 'Newer · ~15s/page', 1_048_576, true),
      ],
    },
    groq: {
      enabled: true,
      defaultModel: 'llama-3.3-70b-versatile',
      models: [
        entry('groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B', 'Fastest correct · ~2.3s/page · text only', 131_072, false),
        entry('groq', 'qwen/qwen3.6-27b', 'Qwen 3.6 27B', 'Only vision model · 8K TPM limits scans', 131_072, true),
      ],
    },
    nvidia: {
      enabled: true,
      defaultModel: 'meta/llama-3.2-90b-vision-instruct',
      models: [
        entry('nvidia', 'meta/llama-3.2-90b-vision-instruct', 'Llama 3.2 90B', 'Best vision', 128_000, true),
        entry('nvidia', 'meta/llama-3.2-11b-vision-instruct', 'Llama 3.2 11B', 'Smaller · faster', 128_000, true),
      ],
    },
    ollama: {
      enabled: true,
      defaultModel: 'gemma4:31b',
      models: [
        // The only vision model on Ollama Cloud's free tier (every other
        // multimodal model returned 402 on 2026-09-15). Reached via aiProxy.
        entry('ollama', 'gemma4:31b', 'Gemma 4 31B', 'Free on Ollama Cloud · vision · ~55s/5 pages · via proxy', 131_072, true),
      ],
    },
  },
};

const PROVIDER_IDS: ProviderId[] = ['gemini', 'groq', 'nvidia', 'ollama'];

/** Backfills any missing provider blocks from the fallback so the UI never crashes. */
export function mergeWithFallback(raw: Partial<AIModelsConfig> | null): AIModelsConfig {
  if (!raw || !raw.providers) return FALLBACK_AI_MODELS_CONFIG;
  const providers = { ...FALLBACK_AI_MODELS_CONFIG.providers };
  for (const p of PROVIDER_IDS) {
    if (raw.providers[p]) providers[p] = raw.providers[p]!;
  }
  return {
    updatedAt: raw.updatedAt ?? null,
    updatedBy: raw.updatedBy ?? 'unknown',
    defaultProvider: raw.defaultProvider ?? FALLBACK_AI_MODELS_CONFIG.defaultProvider,
    providers,
  };
}

/** Loads the admin model config from Firestore; falls back gracefully on any error. */
export async function loadAIModelsConfig(): Promise<AIModelsConfig> {
  try {
    const snap = await getDoc(doc(db, 'ai_config', 'models'));
    if (!snap.exists()) return FALLBACK_AI_MODELS_CONFIG;
    return mergeWithFallback(snap.data() as Partial<AIModelsConfig>);
  } catch {
    return FALLBACK_AI_MODELS_CONFIG;
  }
}

/** Admin-only write. Caller must be admin (enforced by Firestore rules). */
export async function saveAIModelsConfig(config: AIModelsConfig, updatedBy: string): Promise<void> {
  await setDoc(doc(db, 'ai_config', 'models'), {
    ...config,
    updatedAt: Date.now(),
    updatedBy,
  });
}
