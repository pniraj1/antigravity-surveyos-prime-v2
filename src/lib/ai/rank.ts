import type { ModelEntry, ProviderId } from './models-config';
import { type AIJob, JOB_NEEDS_VISION, HEAVY_MIN_OUTPUT_TOKENS, LIGHT_FAST_MS_PER_PAGE } from './jobs';
import { type Health, keyHash } from './health';
import { tierOf, dailyLimit, type Tier } from './quota';

/**
 * Turns "every model the surveyor can reach" into "the order to try them for
 * this job". Derived on every call, never stored — the inputs (admin pool,
 * probe data, today's health) are the source of truth. Ranks by free-tier
 * budget first: cheapest tier for the job, then most remaining daily quota
 * per key; a key that cannot cover the whole document is dropped.
 */

export interface PoolEntry {
  provider: ProviderId;
  model: ModelEntry;
  proxied: boolean;
  keys: string[];
  outputTokens?: number | null;
  msPerPage?: number | null;
  verdict?: 'exact' | 'close' | 'untested' | 'wrong' | 'failed';
}

export interface RankOptions {
  health: Health;
  /** Models to skip for this call (math second opinion). */
  avoid?: ReadonlySet<string>;
  /** Calls this document still needs — a key that cannot cover them is not used. Default 1. */
  pagesNeeded?: number;
}

export class PayloadTooLargeError extends Error {
  status = 413;
  constructor() { super('PAYLOAD_TOO_LARGE: no eligible model accepts this many images'); }
}

const TIER: Record<string, number> = { pro: 3, flash: 2, lite: 1 };

/**
 * A coarse "how capable is this model" number used only to break ties
 * between equal verdicts. Gemini: generation × 10 + tier. Non-Gemini vision
 * models sit with 2.5 Flash — Gemma 4 measured within 0.1 % of it.
 */
export function modelStrength(id: string): number {
  const m = id.match(/gemini-(\d+(?:\.\d+)?)/);
  const gen = m ? parseFloat(m[1]) : 2.5;
  const tier = /lite/.test(id) ? TIER.lite : /pro/.test(id) ? TIER.pro : TIER.flash;
  return gen * 10 + tier;
}

const HEAVY_TIER: Record<Tier, number> = { flash: 0, lite: 1, gemma: 2 };
const CHEAP_TIER: Record<Tier, number> = { lite: 0, gemma: 1, flash: 2 };   // light/text: Flash is the last resort

const VERDICT_RANK: Record<NonNullable<PoolEntry['verdict']>, number> = { exact: 0, close: 1, untested: 2, wrong: 9, failed: 9 };

function verdictRank(e: PoolEntry): number { return VERDICT_RANK[e.verdict ?? 'untested']; }
/** Untested speed gets the benefit of the doubt: treated as borderline-fast, not worst-case. */
// Unknown speed sits at the fast/slow boundary — benefit of the doubt, but never ahead of a measured fast model.
function speed(e: PoolEntry): number { return e.msPerPage ?? LIGHT_FAST_MS_PER_PAGE; }

export function rankModels(job: AIJob, images: readonly string[], pool: readonly PoolEntry[], opts: RankOptions): PoolEntry[] {
  const { health, avoid, pagesNeeded = 1 } = opts;
  const needsVision = JOB_NEEDS_VISION[job] && images.length > 0;
  const best = new Map<string, number>();

  const eligible: PoolEntry[] = [];
  for (const e of pool) {
    const id = e.model.id;
    if (avoid?.has(id) || health.isNotFound(id)) continue;
    if (needsVision && !e.model.vision) continue;
    if (needsVision && e.model.imageCap !== null && e.model.imageCap < images.length) continue;
    if (job === 'heavy' && typeof e.outputTokens === 'number' && e.outputTokens < HEAVY_MIN_OUTPUT_TOKENS) continue;
    if (job === 'heavy' && verdictRank(e) >= 9) continue;
    const limit = dailyLimit(e.provider, id);
    if (limit === 0) continue;                                              // Pro: not on the free tier
    // Per key: what it can still spend today. Dead/rested keys read 0. A key that
    // cannot cover the whole document is dropped — never start a 5-page read
    // on a key with 3 calls left.
    const keyed = e.keys
      .map(k => ({ k, left: health.remaining(keyHash(k), id, limit) }))
      .filter(x => x.left >= pagesNeeded)
      .sort((a, b) => b.left - a.left);
    if (keyed.length === 0) continue;
    best.set(id, keyed[0].left);
    eligible.push({ ...e, keys: keyed.map(x => x.k) });
  }

  // Throw only when some model could have taken images but none fits this many.
  // With no vision model at all, re-chunking (the caller's response to 413)
  // cannot help — return [] so the loop reports "no provider" instead.
  if (eligible.length === 0 && needsVision && images.length > 1 && pool.some(e => e.model.vision)) {
    throw new PayloadTooLargeError();
  }

  const busy = (e: PoolEntry) => health.busyRate(e.model.id);
  const proxied = (e: PoolEntry) => (e.proxied ? 1 : 0);
  const cmp = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);
  // An unlimited budget (Infinity) ties with the fullest known finite budget
  // instead of always winning — an untested unlimited model should not
  // outrank an exact-verdict model on budget alone. Capping every budget at
  // that ceiling before comparing keeps the relation transitive (raw
  // Infinity-ties-everything was not: Infinity ties 500 and ties 100, but
  // 500 > 100, so sort order depended on input order).
  const cap = Math.max(0, ...[...best.values()].filter(Number.isFinite));
  const budget = (e: PoolEntry) => Math.min(best.get(e.model.id)!, cap);
  const tier = (e: PoolEntry, t: Record<Tier, number>) => t[tierOf(e.provider, e.model.id)];

  const byJob: (a: PoolEntry, b: PoolEntry) => number = job === 'heavy'
    ? (a, b) => cmp(tier(a, HEAVY_TIER), tier(b, HEAVY_TIER)) || cmp(budget(b), budget(a))
        || cmp(verdictRank(a), verdictRank(b)) || cmp(busy(a), busy(b)) || cmp(proxied(a), proxied(b))
        || cmp(modelStrength(b.model.id), modelStrength(a.model.id)) || cmp(speed(a), speed(b))
    : job === 'light'
    ? (a, b) => cmp(tier(a, CHEAP_TIER), tier(b, CHEAP_TIER)) || cmp(proxied(a), proxied(b))
        || cmp(+(speed(a) > LIGHT_FAST_MS_PER_PAGE), +(speed(b) > LIGHT_FAST_MS_PER_PAGE)) || cmp(speed(a), speed(b)) || cmp(busy(a), busy(b))
    : (a, b) => cmp(tier(a, CHEAP_TIER), tier(b, CHEAP_TIER)) || cmp(speed(a), speed(b)) || cmp(busy(a), busy(b)) || cmp(proxied(a), proxied(b));

  return [...eligible].sort(byJob);
}
