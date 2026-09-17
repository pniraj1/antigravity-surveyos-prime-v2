import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { ModelProbes } from './probe-types';

export type ProviderId = 'gemini' | 'groq' | 'nvidia' | 'ollama';

export interface ModelEntry {
  id: string;
  label: string;
  note: string;          // admin free-text guidance
  ctxWindow: number | null;
  vision: boolean;
  imageCap: number | null;
}

export interface FallbackModel { id: string; label: string; vision: boolean; imageCap: number | null; ctxWindow: number | null }

export interface ProviderConfig {
  enabled: boolean;
  excluded: string[];
  excludedReason: Record<string, string>;
  keep: string[];
  limits: Record<string, number>;
  notes: Record<string, string>;
  /** @deprecated legacy tick-list; read by migrateConfig, written empty; removed in 2-D */
  models?: ModelEntry[];
  /** @deprecated */
  defaultModel?: string;
}

export interface AIModelsConfig {
  schema?: 1 | 2;
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

/** Used only when the probes doc has never been written. Ids verified live 2026-09-16. */
export const FALLBACK_MODELS: Record<ProviderId, FallbackModel[]> = {
  gemini: [
    { id: 'gemini-2.5-flash', label: '2.5 Flash', vision: true, imageCap: null, ctxWindow: 1_048_576 },
    { id: 'gemini-flash-lite-latest', label: 'Flash-Lite', vision: true, imageCap: null, ctxWindow: 1_048_576 },
    { id: 'gemini-3.5-flash', label: '3.5 Flash', vision: true, imageCap: null, ctxWindow: 1_048_576 },
  ],
  groq: [{ id: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B', vision: true, imageCap: 5, ctxWindow: 131_072 }],
  nvidia: [{ id: 'meta/llama-3.2-90b-vision-instruct', label: 'Llama 3.2 90B', vision: true, imageCap: 1, ctxWindow: 128_000 }],
  ollama: [{ id: 'gemma4:31b', label: 'Gemma 4 31B', vision: true, imageCap: null, ctxWindow: 131_072 }],
};

export function emptyProviderConfig(enabled = true): ProviderConfig {
  return { enabled, excluded: [], excludedReason: {}, keep: [], limits: {}, notes: {}, models: [], defaultModel: '' };
}

/** Offline fallback used when Firestore is unreachable or the doc is absent. */
export const FALLBACK_AI_MODELS_CONFIG: AIModelsConfig = {
  schema: 2,
  updatedAt: null,
  updatedBy: 'fallback',
  defaultProvider: 'gemini',
  providers: {
    gemini: { ...emptyProviderConfig(), models: FALLBACK_MODELS.gemini.map(m => ({ ...m, note: '' })), defaultModel: FALLBACK_MODELS.gemini[0].id },
    groq: { ...emptyProviderConfig(), models: FALLBACK_MODELS.groq.map(m => ({ ...m, note: '' })), defaultModel: FALLBACK_MODELS.groq[0].id },
    nvidia: { ...emptyProviderConfig(), models: FALLBACK_MODELS.nvidia.map(m => ({ ...m, note: '' })), defaultModel: FALLBACK_MODELS.nvidia[0].id },
    ollama: { ...emptyProviderConfig(), models: FALLBACK_MODELS.ollama.map(m => ({ ...m, note: '' })), defaultModel: FALLBACK_MODELS.ollama[0].id },
  },
};

const PROVIDER_IDS: ProviderId[] = ['gemini', 'groq', 'nvidia', 'ollama'];

/** Backfills any missing provider blocks from the fallback so the UI never crashes. */
export function mergeWithFallback(raw: Partial<AIModelsConfig> | null): AIModelsConfig {
  if (!raw || !raw.providers) return FALLBACK_AI_MODELS_CONFIG;
  const providers = { ...FALLBACK_AI_MODELS_CONFIG.providers };
  for (const p of PROVIDER_IDS) {
    if (raw.providers[p]) providers[p] = { ...emptyProviderConfig(), ...raw.providers[p]! };
  }
  return {
    schema: raw.schema,
    updatedAt: raw.updatedAt ?? null,
    updatedBy: raw.updatedBy ?? 'unknown',
    defaultProvider: raw.defaultProvider ?? FALLBACK_AI_MODELS_CONFIG.defaultProvider,
    providers,
  };
}

/**
 * Old docs are a tick-list (`models`). The veto model needs the complement:
 * everything the probe found working that the admin had NOT ticked. Without
 * probes the complement is unknowable, so nothing is excluded — the admin
 * sees the full chain after the next probe and vetoes from there.
 */
export function migrateConfig(raw: AIModelsConfig, probes: ModelProbes | null): AIModelsConfig {
  if (raw.schema === 2) return raw;
  const providers = { ...raw.providers };
  for (const p of PROVIDER_IDS) {
    const block: ProviderConfig = { ...emptyProviderConfig(), ...(raw.providers[p] ?? {}) };
    const ticked = block.models ?? [];
    const okIds = Object.values(probes?.providers[p]?.models ?? {}).filter(m => m.status === 'ok').map(m => m.id);
    const excluded = ticked.length && okIds.length ? okIds.filter(id => !ticked.some(m => m.id === id)) : [];
    const notes = Object.fromEntries(ticked.filter(m => m.note).map(m => [m.id, m.note]));
    providers[p] = { ...block, excluded, excludedReason: {}, keep: [], limits: {}, notes, models: [], defaultModel: '' };
  }
  return { ...raw, schema: 2, providers };
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
    schema: 2,
    updatedAt: Date.now(),
    updatedBy,
  });
}
