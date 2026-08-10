/**
 * Scores a model's extraction of the admin's benchmark document against an
 * admin-supplied expected grand total.
 *
 * The capability probe answers "can this model work at all". It cannot tell a
 * fast-wrong model from a slow-right one — both report status 'ok'. This does.
 */

export type AccuracyVerdict = 'exact' | 'close' | 'wrong' | 'failed';

/** Within this much of the expected total counts as exact. */
const EXACT_PCT = 0.5;
/** Within this much counts as close. Beyond it, wrong. */
const CLOSE_PCT = 2;

export interface AccuracyResult {
  modelId: string;
  verdict: AccuracyVerdict;
  extractedTotal: number | null;
  expectedTotal: number;
  totalDeltaPct: number | null;
  extractedItemCount: number | null;
  expectedItemCount: number | null;
  /** Whole-document wall time — what a surveyor actually waits. */
  ms: number;
  pages: number;
  /** Identifies which benchmark produced this, so stale results are visible. */
  benchmarkFileName: string;
  ranAt: number;
  error: string | null;
}

export interface ScoreInput {
  modelId: string;
  /** The `data` field of ModelTestResult — the extraction output. */
  data: unknown;
  expectedTotal: number;
  expectedItemCount: number | null;
  ms: number;
  pages: number;
  benchmarkFileName: string;
  now: number;
  /** Non-null when the extraction threw. */
  error: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function countSection(data: Record<string, unknown>, key: string): number {
  const section = data[key];
  return Array.isArray(section) ? section.length : 0;
}

/**
 * Pulls the document-level total and line-item count out of an extraction.
 *
 * The total is the ROOT `gross_amount` (src/lib/ai/prompts.ts). Do not reach
 * for `total_amount`: that field exists only inside each line item and holds
 * that row's GST-inclusive amount, so reading it scores one row as if it were
 * the whole document.
 */
export function extractTotals(data: unknown): { total: number | null; itemCount: number | null } {
  if (!isRecord(data)) return { total: null, itemCount: null };

  const gross = data.gross_amount;
  const total = typeof gross === 'number' && Number.isFinite(gross) ? gross : null;

  const itemCount =
    countSection(data, 'spare_parts') +
    countSection(data, 'labour_items') +
    countSection(data, 'painting_items');

  return { total, itemCount };
}

export function scoreAccuracy(input: ScoreInput): AccuracyResult {
  const {
    modelId, data, expectedTotal, expectedItemCount,
    ms, pages, benchmarkFileName, now, error,
  } = input;

  const base = {
    modelId,
    expectedTotal,
    expectedItemCount,
    ms,
    pages,
    benchmarkFileName,
    ranAt: now,
  };

  if (error !== null) {
    return {
      ...base,
      verdict: 'failed',
      extractedTotal: null,
      totalDeltaPct: null,
      extractedItemCount: null,
      error,
    };
  }

  const { total, itemCount } = extractTotals(data);

  if (total === null) {
    return {
      ...base,
      verdict: 'wrong',
      extractedTotal: null,
      totalDeltaPct: null,
      extractedItemCount: itemCount,
      error: null,
    };
  }

  const totalDeltaPct = Math.abs(total - expectedTotal) / expectedTotal * 100;
  const verdict: AccuracyVerdict =
    totalDeltaPct <= EXACT_PCT ? 'exact'
    : totalDeltaPct <= CLOSE_PCT ? 'close'
    : 'wrong';

  return {
    ...base,
    verdict,
    extractedTotal: total,
    totalDeltaPct,
    extractedItemCount: itemCount,
    error: null,
  };
}
