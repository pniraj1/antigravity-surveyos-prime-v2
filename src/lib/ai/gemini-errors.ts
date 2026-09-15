/**
 * Gemini error bodies, and what they mean for the fallback loop.
 *
 * A 429 from Gemini carries a QuotaFailure whose quotaId says which limit
 * was hit. Captured 2026-09-15:
 *   GenerateRequestsPerMinutePerProjectPerModel      → this model, this minute
 *   GenerateRequestsPerDayPerProjectPerModel-FreeTier → this model, today
 *   GenerateContentInputTokensPerModelPerMinute       → this model, this minute
 * Both "PerProject" and "PerModel" can appear in one id — PerModel decides.
 * A Pro model on a free key lists day AND minute violations on a single
 * call: that is a zero quota, not an exhausted one.
 */

export interface GeminiErrorInfo {
  status: number;
  message: string;
  details: unknown[];
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
}

/** Normalises whatever the response body was into status + message + details[]. */
export function parseGeminiError(status: number, body: unknown): GeminiErrorInfo {
  const err = asRecord(asRecord(body)?.error);
  const message = typeof err?.message === 'string' ? err.message : typeof body === 'string' ? body : String(status);
  let details = Array.isArray(err?.details) ? err.details : [];
  if (details.length === 0 && typeof err?.message === 'string' && err.message.trim().startsWith('{')) {
    // Google sometimes JSON-encodes the whole error inside message.
    try {
      const inner = asRecord(asRecord(JSON.parse(err.message))?.error);
      if (Array.isArray(inner?.details)) details = inner.details;
    } catch { /* not JSON — leave details empty */ }
  }
  return { status, message, details };
}

export type Quota429 = { scope: 'model' | 'project'; period: 'minute' | 'day' } | 'zero' | null;

function quotaIds(info: GeminiErrorInfo): string[] {
  const ids: string[] = [];
  for (const d of info.details) {
    const violations = asRecord(d)?.violations;
    if (!Array.isArray(violations)) continue;
    for (const v of violations) {
      const id = asRecord(v)?.quotaId;
      if (typeof id === 'string') ids.push(id);
    }
  }
  return ids;
}

export function classifyGemini429(info: GeminiErrorInfo): Quota429 {
  if (info.status !== 429) return null;
  const ids = quotaIds(info);
  if (ids.length === 0) return null;
  const hasDay = ids.some(id => id.includes('PerDay'));
  const hasMinute = ids.some(id => id.includes('PerMinute'));
  if (hasDay && hasMinute) return 'zero';
  return {
    scope: ids.some(id => id.includes('PerModel')) ? 'model' : 'project',
    period: hasDay ? 'day' : 'minute',
  };
}

/** A 400 because this model does not accept thinkingConfig (Gemini 3.x uses thinkingLevel; some cannot disable it). */
export function isThinkingRejected(info: GeminiErrorInfo): boolean {
  return info.status === 400 && /thinking/i.test(info.message);
}

/** A 400 because the model cannot take the images we sent — probe data was stale. */
export function isModalityRejected(message: string): boolean {
  return /image|vision|modality/i.test(message);
}
