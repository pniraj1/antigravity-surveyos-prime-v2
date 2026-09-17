// The admin sees exactly what a fully-keyed surveyor's loop would try, in order.
import { type AIModelsConfig, type ProviderId, type ProviderConfig } from './models-config';
import type { ModelProbes, ProviderProbe } from './probe-types';
import type { AIJob } from './jobs';
import { rankModels, PayloadTooLargeError, type PoolEntry, type RankOptions } from './rank';
import { createHealth } from './health';
import { poolFromProbes, limitOfFor } from './pool';
import { tierOf, dailyLimit, type Tier } from './quota';

export const ADMIN_JOBS: { job: AIJob; label: string; pagesNeeded: number }[] = [
  { job: 'heavy', label: 'Estimates & bills', pagesNeeded: 5 },
  { job: 'light', label: 'Licence · RC · policy', pagesNeeded: 1 },
  { job: 'text', label: 'Letters & text', pagesNeeded: 1 },
];
const ALL_KEYS: Record<ProviderId, string[]> = { gemini: ['admin'], groq: ['admin'], nvidia: ['admin'], ollama: ['admin'] };
const TIER_LABEL: Record<Tier, string> = { flash: 'Flash tier', lite: 'Flash-Lite tier', gemma: 'Gemma tier', other: 'Other provider' };

export interface RankedRow { provider: ProviderId; id: string; tier: Tier; limit: number; msPerPage: number | null; proxied: boolean; reason: string; isNew: boolean }

function reasonFor(e: PoolEntry, tier: Tier, limit: number): string {
  const parts = [TIER_LABEL[tier], limit === Infinity ? 'no daily cap' : limit === 0 ? 'off' : `${limit}/day per key`];
  parts.push(e.msPerPage == null ? 'speed untested' : `${Math.round(e.msPerPage / 1000)} s/page`);
  if (e.proxied) parts.push('via proxy');
  return parts.join(' · ');
}

/** Same words, but always ends in "off" — used for the limit-0 rows appended at the end of each list. */
function offReasonFor(e: PoolEntry, tier: Tier): string {
  const parts = [TIER_LABEL[tier], e.msPerPage == null ? 'speed untested' : `${Math.round(e.msPerPage / 1000)} s/page`];
  if (e.proxied) parts.push('via proxy');
  parts.push('off');
  return parts.join(' · ');
}

function rankFor(job: AIJob, pagesNeeded: number, config: AIModelsConfig, probes: ModelProbes | null, limitOf?: RankOptions['limitOf']): PoolEntry[] {
  const pool = poolFromProbes(config, probes, ALL_KEYS);
  try {
    return rankModels(job, job === 'text' ? [] : ['x'], pool, { health: createHealth(null), pagesNeeded, limitOf: limitOf ?? limitOfFor(config) });
  } catch (e) {
    if (e instanceof PayloadTooLargeError) return [];   // cannot happen with one image, but never let the admin tab crash
    throw e;
  }
}

export function rankedLists(config: AIModelsConfig, probes: ModelProbes | null, newIds: ReadonlySet<string>): Record<AIJob, RankedRow[]> {
  const limitOf = limitOfFor(config);
  // A model limited to 0 is dropped by rankModels entirely (0 = "never eligible"), so on its own
  // it would vanish from every list and from the Excluded group (it lives in `limits`, not `excluded`).
  // Rank again with 0 relaxed to the table default, then keep only the ids whose real limit is 0 and
  // append them at the end so the row — and its limit input — stays visible.
  const relaxedLimitOf: RankOptions['limitOf'] = (p, id) => { const v = limitOf(p, id); return v === 0 ? dailyLimit(p, id) : v; };
  const out = {} as Record<AIJob, RankedRow[]>;
  for (const { job, pagesNeeded } of ADMIN_JOBS) {
    const main = rankFor(job, pagesNeeded, config, probes).map(e => {
      const tier = tierOf(e.provider, e.model.id), limit = limitOf(e.provider, e.model.id);
      return { provider: e.provider, id: e.model.id, tier, limit, msPerPage: e.msPerPage ?? null, proxied: e.proxied, reason: reasonFor(e, tier, limit), isNew: newIds.has(e.model.id) };
    });
    const seen = new Set(main.map(r => `${r.provider}/${r.id}`));
    const off = rankFor(job, pagesNeeded, config, probes, relaxedLimitOf)
      .filter(e => limitOf(e.provider, e.model.id) === 0 && !seen.has(`${e.provider}/${e.model.id}`))
      .map(e => {
        const tier = tierOf(e.provider, e.model.id);
        return { provider: e.provider, id: e.model.id, tier, limit: 0, msPerPage: e.msPerPage ?? null, proxied: e.proxied, reason: offReasonFor(e, tier), isNew: newIds.has(e.model.id) };
      });
    out[job] = [...main, ...off];
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

export interface DiscoveryCounts { found: number; inChain: number; autoExcluded: number; byAdmin: number; hidden: number }

/** The provider card's discovery line: what the probe found and where each id went. */
export function discoveryCounts(block: ProviderConfig, probe: ProviderProbe): DiscoveryCounts {
  const all = Object.values(probe.models);
  const ok = all.filter(m => m.status === 'ok').map(m => m.id);
  const excluded = ok.filter(id => block.excluded.includes(id));
  const autoExcluded = excluded.filter(id => block.excludedReason[id]).length;
  // Retired: previously excluded ids the provider no longer lists at all — kept visible in the hidden group, so counted here too.
  const retired = block.excluded.filter(id => !probe.models[id]).length;
  return { found: all.length, inChain: ok.length - excluded.length, autoExcluded, byAdmin: excluded.length - autoExcluded, hidden: (all.length - ok.length) + retired };
}
