import type { ModelEntry, ProviderId } from './models-config';
import { type AIJob, JOB_NEEDS_VISION, HEAVY_MIN_OUTPUT_TOKENS, LIGHT_FAST_MS_PER_PAGE } from './jobs';
import { type Health, keyHash } from './health';

/**
 * Turns "every model the surveyor can reach" into "the order to try them for
 * this job". Derived on every call, never stored — the inputs (admin pool,
 * probe data, today's health) are the source of truth.
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
  /** Surveyor's saved pick — first if eligible. Removed in Phase 2. */
  preferredModel?: string;
  /** Models to skip for this call (math second opinion). */
  avoid?: ReadonlySet<string>;
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

const VERDICT_RANK: Record<NonNullable<PoolEntry['verdict']>, number> = { exact: 0, close: 1, untested: 2, wrong: 9, failed: 9 };

function verdictRank(e: PoolEntry): number { return VERDICT_RANK[e.verdict ?? 'untested']; }
/** Untested speed gets the benefit of the doubt: treated as borderline-fast, not worst-case. */
function speed(e: PoolEntry): number { return e.msPerPage ?? LIGHT_FAST_MS_PER_PAGE; }

export function rankModels(job: AIJob, images: readonly string[], pool: readonly PoolEntry[], opts: RankOptions): PoolEntry[] {
  const { health, preferredModel, avoid } = opts;
  const needsVision = JOB_NEEDS_VISION[job] && images.length > 0;

  const eligible: PoolEntry[] = [];
  for (const e of pool) {
    const id = e.model.id;
    if (avoid?.has(id) || health.isNotFound(id)) continue;
    if (needsVision && !e.model.vision) continue;
    if (needsVision && e.model.imageCap !== null && e.model.imageCap < images.length) continue;
    if (job === 'heavy' && typeof e.outputTokens === 'number' && e.outputTokens < HEAVY_MIN_OUTPUT_TOKENS) continue;
    if (job === 'heavy' && verdictRank(e) >= 9) continue;
    const keys = e.keys.filter(k => !health.isDeadToday(keyHash(k), id));
    if (keys.length === 0) continue;
    eligible.push({ ...e, keys });
  }

  if (eligible.length === 0 && needsVision && images.length > 1 && pool.some(e => e.model.vision)) {
    throw new PayloadTooLargeError();
  }

  const busy = (e: PoolEntry) => health.busyRate(e.model.id);
  const proxied = (e: PoolEntry) => (e.proxied ? 1 : 0);
  const cmp = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);

  const byJob: (a: PoolEntry, b: PoolEntry) => number = job === 'heavy'
    ? (a, b) => cmp(verdictRank(a), verdictRank(b)) || cmp(busy(a), busy(b)) || cmp(proxied(a), proxied(b))
        || cmp(modelStrength(b.model.id), modelStrength(a.model.id)) || cmp(speed(a), speed(b))
    : job === 'light'
    ? (a, b) => cmp(proxied(a), proxied(b)) || cmp(+(speed(a) > LIGHT_FAST_MS_PER_PAGE), +(speed(b) > LIGHT_FAST_MS_PER_PAGE))
        || cmp(speed(a), speed(b)) || cmp(busy(a), busy(b))
    : (a, b) => cmp(speed(a), speed(b)) || cmp(busy(a), busy(b)) || cmp(proxied(a), proxied(b));

  const sorted = [...eligible].sort(byJob);
  if (preferredModel) {
    const i = sorted.findIndex(e => e.model.id === preferredModel);
    if (i > 0) { const [p] = sorted.splice(i, 1); sorted.unshift(p); }
  }
  return sorted;
}
