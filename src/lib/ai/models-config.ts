import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { ModelProbes, ProviderProbe } from './probe-types';
import { applyGuardRails } from './guard-rails';

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
  const migrated: AIModelsConfig = { ...raw, schema: 2, providers };
  // A freshly migrated doc with no ticks has nothing excluded — apply the guard rails
  // immediately so slow/preview ids don't enter chains until the admin's first probe.
  return probes ? applyGuardRails(migrated, probes) : migrated;
}

/**
 * The old per-provider shape (`models`/`defaultModel`) that surveyors on cached
 * pre-2-C JS still read. Populated from the current chain so a stale tab keeps
 * working until it reloads.
 * ponytail: legacy mirror so surveyors on cached pre-2-C code keep a chain; delete in 2-D.
 */
export function legacyModelsFor(block: ProviderConfig, probe: ProviderProbe | null, provider: ProviderId): ModelEntry[] {
  const dead = provider === 'gemini' ? DEPRECATED_GEMINI_MODELS : provider === 'groq' ? DEPRECATED_GROQ_MODELS : {};
  if (!probe || probe.probedAt === 0) {
    return FALLBACK_MODELS[provider]
      .filter(m => !(m.id in dead) && !block.excluded.includes(m.id))
      .map(m => ({ id: m.id, label: m.id, note: block.notes[m.id] ?? '', ctxWindow: m.ctxWindow, vision: m.vision, imageCap: m.imageCap }));
  }
  return Object.values(probe.models)
    .filter(r => r.status === 'ok' && !(r.id in dead) && !block.excluded.includes(r.id))
    .map(r => ({ id: r.id, label: r.id, note: block.notes[r.id] ?? '', ctxWindow: r.ctxWindow, vision: r.vision, imageCap: r.imageCap }));
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
