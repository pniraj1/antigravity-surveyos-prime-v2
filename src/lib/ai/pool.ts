// src/lib/ai/pool.ts
//
// "Every model the surveyor can reach": probe-ok minus the admin's veto, for
// providers the surveyor has a key for. One function for the request path
// and the admin tab, so the admin sees the surveyor's chain by construction.
import { type AIModelsConfig, type ProviderId, FALLBACK_MODELS, migrateConfig, DEPRECATED_GEMINI_MODELS, DEPRECATED_GROQ_MODELS } from './models-config';
import type { ModelProbes } from './probe-types';
import type { PoolEntry } from './rank';
import { dailyLimit } from './quota';

const PROVIDERS: ProviderId[] = ['gemini', 'groq', 'nvidia', 'ollama'];
const PROXIED: ReadonlySet<ProviderId> = new Set(['nvidia', 'ollama']);

function retired(p: ProviderId): Record<string, string> {
  return p === 'gemini' ? DEPRECATED_GEMINI_MODELS : p === 'groq' ? DEPRECATED_GROQ_MODELS : {};
}

export function poolFromProbes(rawConfig: AIModelsConfig, probes: ModelProbes | null, keysByProvider: Partial<Record<ProviderId, string[]>>): PoolEntry[] {
  const config = migrateConfig(rawConfig, probes);
  const pool: PoolEntry[] = [];
  for (const provider of PROVIDERS) {
    const block = config.providers[provider];
    const keys = keysByProvider[provider] ?? [];
    if (!block?.enabled || keys.length === 0) continue;
    const dead = retired(provider);
    const probed = probes?.providers[provider];
    if (!probed || probed.probedAt === 0) {
      for (const m of FALLBACK_MODELS[provider]) {
        if (m.id in dead || block.excluded.includes(m.id)) continue;
        pool.push({ provider, proxied: PROXIED.has(provider), keys, model: { id: m.id, label: m.label, note: '', ctxWindow: m.ctxWindow, vision: m.vision, imageCap: m.imageCap } });
      }
      continue;
    }
    for (const r of Object.values(probed.models)) {
      if (r.status !== 'ok' || r.id in dead || block.excluded.includes(r.id)) continue;
      pool.push({ provider, proxied: PROXIED.has(provider), keys, msPerPage: r.msPerPage,
        model: { id: r.id, label: r.id, note: block.notes[r.id] ?? '', ctxWindow: r.ctxWindow, vision: r.vision, imageCap: r.imageCap } });
    }
  }
  return pool;
}

/** Admin's per-model daily limit, else the quota table. 0 = never eligible. */
export function limitOfFor(config: AIModelsConfig): (provider: ProviderId, id: string) => number {
  return (provider, id) => {
    const v = config.providers[provider]?.limits?.[id];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : dailyLimit(provider, id);
  };
}
