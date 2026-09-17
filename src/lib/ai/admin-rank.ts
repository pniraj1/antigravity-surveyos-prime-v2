// The admin sees exactly what a fully-keyed surveyor's loop would try, in order.
import { type AIModelsConfig, type ProviderId } from './models-config';
import type { ModelProbes } from './probe-types';
import type { AIJob } from './jobs';
import { rankModels, type PoolEntry } from './rank';
import { createHealth } from './health';
import { poolFromProbes, limitOfFor } from './pool';
import { tierOf, type Tier } from './quota';

export const ADMIN_JOBS: { job: AIJob; label: string; pagesNeeded: number }[] = [
  { job: 'heavy', label: 'Estimates & bills', pagesNeeded: 5 },
  { job: 'light', label: 'Licence · RC · policy', pagesNeeded: 1 },
  { job: 'text', label: 'Letters & text', pagesNeeded: 1 },
];
const ALL_KEYS: Record<ProviderId, string[]> = { gemini: ['admin'], groq: ['admin'], nvidia: ['admin'], ollama: ['admin'] };
const TIER_LABEL: Record<Tier, string> = { flash: 'Flash tier', lite: 'Flash-Lite tier', gemma: 'Gemma tier' };

export interface RankedRow { provider: ProviderId; id: string; tier: Tier; limit: number; msPerPage: number | null; proxied: boolean; reason: string; isNew: boolean }

function reasonFor(e: PoolEntry, tier: Tier, limit: number): string {
  const parts = [TIER_LABEL[tier], limit === Infinity ? 'no daily cap' : limit === 0 ? 'off' : `${limit}/day per key`];
  parts.push(e.msPerPage == null ? 'speed untested' : `${Math.round(e.msPerPage / 1000)} s/page`);
  if (e.proxied) parts.push('via proxy');
  return parts.join(' · ');
}

function rankFor(job: AIJob, pagesNeeded: number, config: AIModelsConfig, probes: ModelProbes | null): PoolEntry[] {
  const pool = poolFromProbes(config, probes, ALL_KEYS);
  try {
    return rankModels(job, job === 'text' ? [] : ['x'], pool, { health: createHealth(null), pagesNeeded, limitOf: limitOfFor(config) });
  } catch { return []; }   // PayloadTooLargeError cannot happen with one image, but never let the admin tab crash
}

export function rankedLists(config: AIModelsConfig, probes: ModelProbes | null, newIds: ReadonlySet<string>): Record<AIJob, RankedRow[]> {
  const limitOf = limitOfFor(config);
  const out = {} as Record<AIJob, RankedRow[]>;
  for (const { job, pagesNeeded } of ADMIN_JOBS) {
    out[job] = rankFor(job, pagesNeeded, config, probes).map(e => {
      const tier = tierOf(e.provider, e.model.id), limit = limitOf(e.provider, e.model.id);
      return { provider: e.provider, id: e.model.id, tier, limit, msPerPage: e.msPerPage ?? null, proxied: e.proxied, reason: reasonFor(e, tier, limit), isNew: newIds.has(e.model.id) };
    });
  }
  return out;
}

/** The job label that excluding `id` would leave with no model, else null. */
export function lastEligibleFor(config: AIModelsConfig, probes: ModelProbes | null, provider: ProviderId, id: string): string | null {
  const block = config.providers[provider];
  const after = { ...config, providers: { ...config.providers, [provider]: { ...block, excluded: [...block.excluded, id] } } };
  for (const { job, label, pagesNeeded } of ADMIN_JOBS) {
    const before = rankFor(job, pagesNeeded, config, probes);
    if (before.some(e => e.provider === provider && e.model.id === id) && rankFor(job, pagesNeeded, after, probes).length === 0) return label;
  }
  return null;
}
