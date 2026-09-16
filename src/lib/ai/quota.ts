//
// Free-tier budgets, per key, per Pacific day. Read from the owner's Google
// quota page on 2026-09-16: every Flash model gets 20 requests/day, Flash-Lite
// 500, Gemma-via-Google 14 400, Pro 0. Other providers publish nothing usable —
// unknown until a 429 says otherwise (see health.rest).
// ponytail: shipped constant; admin-editable limits arrive with Phase 2-C.
import type { ProviderId } from './models-config';

export type Tier = 'flash' | 'lite' | 'gemma';

/** One Ollama Cloud usage window — a 429 there rests the model this long. */
export const OLLAMA_REST_MS = 3_600_000;

export function tierOf(provider: ProviderId, id: string): Tier {
  if (provider === 'gemini') return /gemma/.test(id) ? 'gemma' : /lite/.test(id) ? 'lite' : 'flash';
  if (provider === 'ollama' && /^gemma/.test(id)) return 'gemma';
  return 'lite';
}

/** Calls per day this key may make to this model; Infinity when unknown. */
export function dailyLimit(provider: ProviderId, id: string): number {
  if (provider !== 'gemini') return Infinity;
  if (/pro/.test(id)) return 0;
  if (/lite/.test(id)) return 500;
  if (/gemma/.test(id)) return 14_400;
  return 20;
}
