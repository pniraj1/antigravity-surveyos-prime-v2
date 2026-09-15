/**
 * Every AI call declares a job. The job — not a model name — decides which
 * models are eligible and in what order (see rank.ts).
 *
 *   heavy — estimates, bills, bank statements: accuracy on tables, long output
 *   light — one-page identity/policy scans: the surveyor is standing at the car
 *   text  — letters and narrative: no images
 */
export type AIJob = 'heavy' | 'light' | 'text';

const HEAVY_DOC_TYPES = new Set(['estimate', 'final-bill', 'bank-statement']);

export function jobForDocType(docType: string): AIJob {
  return HEAVY_DOC_TYPES.has(docType) ? 'heavy' : 'light';
}

/** Measured 2026-09-15: a Gemini 503 can take 194 s to return. Without this, four busy models is 13 minutes. */
export const JOB_TIMEOUT_MS: Record<AIJob, number> = { heavy: 120_000, light: 30_000, text: 30_000 };

export const JOB_NEEDS_VISION: Record<AIJob, boolean> = { heavy: true, light: true, text: false };

/** A 5-page estimate produced 14 K output tokens; a model that cannot write that back truncates silently. */
export const HEAVY_MIN_OUTPUT_TOKENS = 16_384;

/** Slower than this per page is a bad experience at the vehicle — preferred last, never dropped. */
export const LIGHT_FAST_MS_PER_PAGE = 20_000;
