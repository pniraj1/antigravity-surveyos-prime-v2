# AI Fallback Loop — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a Gemini model is busy or rate-limited, hop to the next eligible model for the document's job before leaving Gemini; add Ollama Cloud (Gemma 4) as a proxied fallback; stop Gemini truncating by turning thinking off; re-run a document on the next model when its arithmetic doesn't add up.

**Architecture:** Three new pure modules (`gemini-errors`, `health`, `rank`) feed one rewritten loop in `service.ts`. Every caller of `callAIGateway` declares a job (`heavy` / `light` / `text`); the loop asks the ranker for an ordered chain of `(provider, model)` for that job, walks it with per-call timeouts, and classifies each failure into NEXT MODEL / NEXT KEY / NEXT PROVIDER / STOP. Ollama Cloud is reached through the existing NVIDIA proxy Cloud Function, generalised to a host allowlist. Health (busy counts, dead-today, not-found) lives in localStorage per surveyor.

**Tech Stack:** Next.js 16 static export, TypeScript, zustand stores, vitest (node env, `fetch` mocked with `vi.spyOn`), Firebase callable functions v2 (Node, `functions/index.js`, plain-assert tests run by `npm run test:functions`).

Spec: `docs/superpowers/specs/2026-09-15-ai-fallback-and-job-routing-design.md` (rev 3). This plan covers **Phase 1** only.

## Global Constraints

- Heavy per-call timeout **120 s**; light and text **30 s**.
- No in-place retry on 503. One bounded 5 s second pass over 503-only models, once.
- Model hop **before** key rotation.
- `thinkingConfig: { thinkingBudget: 0 }` on every JSON-format Gemini call; on a 400 mentioning "thinking", retry the same model once without it.
- Ollama Cloud base `https://ollama.com`; chat at `/api/chat` with `images: [base64]`, `format: 'json'`, `stream: false`; catalogue at `/api/tags`. Browser cannot call it — always via the proxy.
- Proxied providers rank after direct ones; for `light` they are always last.
- Health resets at **local** midnight; dead-today expires at **next midnight Pacific** (toast wording "resets 1:30 pm IST").
- Keys never reach Firestore: `pushProfileToCloud` strips `geminiApiKeys`, `groqApiKeys`, `nvidiaApiKeys`, `ollamaApiKeys`.
- Pool for Phase 1 = the admin's enabled `providers[p].models` (`ModelEntry`) for every provider the surveyor has a key for. Probe data (verdict, msPerPage) is **not** in the request path until Phase 2; the ranker accepts it as an optional input so Phase 2 only passes it.
- Surveyor's saved model pick (`profile.geminiModel` etc.) is honoured as "first in chain if eligible" — the picker UI stays until Phase 2.
- Commit after every task. Attribution line on every commit: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Work on `main` (no branches — project rule).
- Run `npx vitest run src/lib/ai` after each task; `npx tsc --noEmit -p .` must stay clean.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/ai/gemini-errors.ts` (new) | Parse Gemini error bodies; classify 429 by `quotaId`; detect thinking/modality 400s. Pure. |
| `src/lib/ai/health.ts` (new) | Per-surveyor localStorage record: busy counts, dead-today, not-found. Pure functions over an injected `now`/storage. |
| `src/lib/ai/jobs.ts` (new) | `AIJob` type, doc-type → job map, timeouts. Pure. |
| `src/lib/ai/rank.ts` (new) | `rankModels(job, images, pool, opts)` → ordered chain. Pure. |
| `src/lib/ai/service.ts` | `callWithKey` (thinking, timeout, finish/details, ollama branch), new `callWithFallback` loop, `callAIGateway` with job/session/signal; deletes the hardcoded chains. |
| `src/lib/ai/processor.ts` | Passes job + session + signal; math second opinion. |
| `src/lib/ai/models-config.ts` | `ollama` in `ProviderId`, image cap, fallback config entry. |
| `src/lib/ai/probe-runner.ts`, `probe-types.ts`, `probe-reconcile.ts` | Add `ollama` to the provider lists; catalogue via proxy. |
| `src/lib/firebase/functions.ts` | `callAiProxy(provider, path, key, body)`. |
| `functions/index.js` | `aiProxy` with host allowlist; `nvidiaProxy` kept as an alias for one release. |
| `src/types/vehicle.ts`, `src/stores/profile-store.ts`, `src/lib/firebase/sync.ts`, `src/components/tabs/ProfileTab.tsx` | `ollamaApiKeys` field, stripped from cloud sync, one key row in Profile. |
| `src/lib/ai/fault.ts` (new, dev only) | `?ai-fault=` injection for live tests. |

---

### Task 1: Gemini error classification

**Files:**
- Create: `src/lib/ai/gemini-errors.ts`
- Test: `src/lib/ai/__tests__/gemini-errors.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface GeminiErrorInfo { status: number; message: string; details: unknown[] }
  export function parseGeminiError(status: number, body: unknown): GeminiErrorInfo
  export type Quota429 = { scope: 'model' | 'project'; period: 'minute' | 'day' } | 'zero' | null
  export function classifyGemini429(info: GeminiErrorInfo): Quota429
  export function isThinkingRejected(info: GeminiErrorInfo): boolean
  export function isModalityRejected(message: string): boolean
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/ai/__tests__/gemini-errors.test.ts
import { describe, it, expect } from 'vitest';
import { parseGeminiError, classifyGemini429, isThinkingRejected, isModalityRejected } from '../gemini-errors';

const violation = (quotaId: string) => ({ quotaMetric: 'x', quotaId, quotaDimensions: { location: 'global', model: 'gemini-2.5-flash' } });
const body429 = (ids: string[]) => ({ error: { code: 429, message: 'You exceeded your current quota', status: 'RESOURCE_EXHAUSTED',
  details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: ids.map(violation) },
            { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '34s' }] } });

describe('parseGeminiError', () => {
  it('reads details from the body', () => {
    const info = parseGeminiError(429, body429(['GenerateRequestsPerMinutePerProjectPerModel']));
    expect(info.status).toBe(429);
    expect(info.details).toHaveLength(2);
  });
  it('falls back to details double-encoded inside message', () => {
    const inner = JSON.stringify(body429(['GenerateRequestsPerDayPerProjectPerModel-FreeTier']));
    const info = parseGeminiError(429, { error: { message: inner, code: 429 } });
    expect(info.details).toHaveLength(2);
  });
  it('tolerates a non-JSON body', () => {
    const info = parseGeminiError(503, 'Service Unavailable');
    expect(info.message).toBe('Service Unavailable');
    expect(info.details).toEqual([]);
  });
});

describe('classifyGemini429', () => {
  it('PerMinutePerProjectPerModel → model/minute (PerModel wins over PerProject)', () => {
    expect(classifyGemini429(parseGeminiError(429, body429(['GenerateRequestsPerMinutePerProjectPerModel']))))
      .toEqual({ scope: 'model', period: 'minute' });
  });
  it('PerDayPerProjectPerModel-FreeTier → model/day', () => {
    expect(classifyGemini429(parseGeminiError(429, body429(['GenerateRequestsPerDayPerProjectPerModel-FreeTier']))))
      .toEqual({ scope: 'model', period: 'day' });
  });
  it('PerDayPerProject (no PerModel) → project/day', () => {
    expect(classifyGemini429(parseGeminiError(429, body429(['GenerateRequestsPerDayPerProject']))))
      .toEqual({ scope: 'project', period: 'day' });
  });
  it('token limits count too: InputTokensPerModelPerMinute → model/minute', () => {
    expect(classifyGemini429(parseGeminiError(429, body429(['GenerateContentInputTokensPerModelPerMinute-FreeTier']))))
      .toEqual({ scope: 'model', period: 'minute' });
  });
  it('day AND minute violations at once (captured Pro body) → zero quota', () => {
    const pro = body429([
      'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
      'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
      'GenerateContentInputTokensPerModelPerMinute-FreeTier',
      'GenerateContentInputTokensPerModelPerDay-FreeTier',
    ]);
    expect(classifyGemini429(parseGeminiError(429, pro))).toBe('zero');
  });
  it('no details → null', () => {
    expect(classifyGemini429(parseGeminiError(429, { error: { message: 'Too many requests' } }))).toBeNull();
  });
  it('non-429 → null', () => {
    expect(classifyGemini429(parseGeminiError(503, body429(['GenerateRequestsPerDayPerProject'])))).toBeNull();
  });
});

describe('isThinkingRejected', () => {
  it('true for a 400 that mentions thinking', () => {
    expect(isThinkingRejected(parseGeminiError(400, { error: { message: 'Thinking budget is not supported for this model' } }))).toBe(true);
  });
  it('false for other 400s and for non-400', () => {
    expect(isThinkingRejected(parseGeminiError(400, { error: { message: 'Invalid JSON payload' } }))).toBe(false);
    expect(isThinkingRejected(parseGeminiError(429, { error: { message: 'thinking' } }))).toBe(false);
  });
});

describe('isModalityRejected', () => {
  it('matches image / vision / modality wording', () => {
    expect(isModalityRejected('this model does not support image input')).toBe(true);
    expect(isModalityRejected('Unsupported modality: IMAGE')).toBe(true);
    expect(isModalityRejected('vision is not enabled for this model')).toBe(true);
    expect(isModalityRejected('Invalid argument')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/gemini-errors.test.ts`
Expected: FAIL — "Cannot find module '../gemini-errors'"

- [ ] **Step 3: Implement**

```ts
// src/lib/ai/gemini-errors.ts
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
  const first = ids[0];
  return {
    scope: first.includes('PerModel') ? 'model' : 'project',
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/gemini-errors.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/gemini-errors.ts src/lib/ai/__tests__/gemini-errors.test.ts
git commit -m "feat(ai): classify Gemini 429s by quotaId and detect thinking/modality 400s

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Jobs

**Files:**
- Create: `src/lib/ai/jobs.ts`
- Test: `src/lib/ai/__tests__/jobs.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AIJob = 'heavy' | 'light' | 'text'
  export function jobForDocType(docType: string): AIJob
  export const JOB_TIMEOUT_MS: Record<AIJob, number>   // heavy 120_000, light 30_000, text 30_000
  export const JOB_NEEDS_VISION: Record<AIJob, boolean> // heavy true, light true, text false
  export const HEAVY_MIN_OUTPUT_TOKENS = 16_384
  export const LIGHT_FAST_MS_PER_PAGE = 20_000
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ai/__tests__/jobs.test.ts
import { describe, it, expect } from 'vitest';
import { jobForDocType, JOB_TIMEOUT_MS, JOB_NEEDS_VISION } from '../jobs';

describe('jobForDocType', () => {
  it('estimates, bills and bank statements are heavy', () => {
    for (const k of ['estimate', 'final-bill', 'bank-statement']) expect(jobForDocType(k)).toBe('heavy');
  });
  it('identity and policy documents are light', () => {
    for (const k of ['rc', 'dl', 'policy', 'claim', 'permit', 'auth', 'fitness', 'lok-challan', 'fir', 'photos']) expect(jobForDocType(k)).toBe('light');
  });
  it('unknown doc types default to light (vision, fast)', () => {
    expect(jobForDocType('something-new')).toBe('light');
  });
});

describe('job constants', () => {
  it('heavy waits 120s, others 30s', () => {
    expect(JOB_TIMEOUT_MS).toEqual({ heavy: 120_000, light: 30_000, text: 30_000 });
  });
  it('only text does not need vision', () => {
    expect(JOB_NEEDS_VISION).toEqual({ heavy: true, light: true, text: false });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/jobs.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

```ts
// src/lib/ai/jobs.ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/jobs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/jobs.ts src/lib/ai/__tests__/jobs.test.ts
git commit -m "feat(ai): job types and doc-type mapping

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Health record (busy counts, dead-today, not-found)

**Files:**
- Create: `src/lib/ai/health.ts`
- Test: `src/lib/ai/__tests__/health.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type CallOutcome = 'ok' | 'busy' | 'other'
  export interface HealthStore { getItem(k: string): string | null; setItem(k: string, v: string): void }
  export function createHealth(store: HealthStore | null, now: () => number = Date.now): Health
  export interface Health {
    recordCall(model: string, outcome: CallOutcome): void
    busyRate(model: string): number                       // 0 until ≥3 calls today
    markDeadToday(keyHash: string, model: string | '*'): void
    isDeadToday(keyHash: string, model: string): boolean  // true if model or '*' is dead for this key
    markNotFound(model: string): void
    isNotFound(model: string): boolean
    deadUntilLabel(): string                              // "1:30 pm IST" style, for toasts
  }
  export function keyHash(key: string): string           // short non-reversible id
  export function nextPacificMidnight(now: number): number
  export function localDayKey(now: number): string       // "2026-09-15"
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/ai/__tests__/health.test.ts
import { describe, it, expect } from 'vitest';
import { createHealth, keyHash, nextPacificMidnight, localDayKey } from '../health';

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
}

describe('busyRate', () => {
  it('is 0 until three calls have been made today', () => {
    const h = createHealth(memStore(), () => 1_000);
    h.recordCall('m', 'busy'); h.recordCall('m', 'busy');
    expect(h.busyRate('m')).toBe(0);
    h.recordCall('m', 'ok');
    expect(h.busyRate('m')).toBeCloseTo(2 / 3);
  });
  it('resets at local midnight', () => {
    let t = new Date(2026, 8, 15, 23, 0).getTime();
    const s = memStore();
    const h = createHealth(s, () => t);
    for (let i = 0; i < 3; i++) h.recordCall('m', 'busy');
    expect(h.busyRate('m')).toBe(1);
    t = new Date(2026, 8, 16, 0, 5).getTime();
    expect(createHealth(s, () => t).busyRate('m')).toBe(0);
  });
});

describe('deadToday', () => {
  it('marks one model for one key until next Pacific midnight', () => {
    let t = Date.UTC(2026, 8, 15, 10, 0); // 03:00 Pacific (PDT)
    const s = memStore();
    const h = createHealth(s, () => t);
    h.markDeadToday('k1', 'gemini-2.5-flash');
    expect(h.isDeadToday('k1', 'gemini-2.5-flash')).toBe(true);
    expect(h.isDeadToday('k1', 'gemini-flash-lite-latest')).toBe(false);
    expect(h.isDeadToday('k2', 'gemini-2.5-flash')).toBe(false);
    t = Date.UTC(2026, 8, 16, 7, 30); // 00:30 Pacific next day
    expect(createHealth(s, () => t).isDeadToday('k1', 'gemini-2.5-flash')).toBe(false);
  });
  it("'*' marks the whole provider for that key", () => {
    const h = createHealth(memStore(), () => Date.UTC(2026, 8, 15, 10, 0));
    h.markDeadToday('k1', '*');
    expect(h.isDeadToday('k1', 'anything')).toBe(true);
  });
});

describe('notFound', () => {
  it('remembers a 404 for seven days', () => {
    let t = 0;
    const s = memStore();
    createHealth(s, () => t).markNotFound('gemini-3.5-flash');
    t = 6 * 86_400_000;
    expect(createHealth(s, () => t).isNotFound('gemini-3.5-flash')).toBe(true);
    t = 8 * 86_400_000;
    expect(createHealth(s, () => t).isNotFound('gemini-3.5-flash')).toBe(false);
  });
});

describe('storage failure', () => {
  it('a null store degrades to no history without throwing', () => {
    const h = createHealth(null, () => 0);
    h.recordCall('m', 'busy'); h.markDeadToday('k', 'm'); h.markNotFound('m');
    expect(h.busyRate('m')).toBe(0);
    expect(h.isDeadToday('k', 'm')).toBe(false);
    expect(h.isNotFound('m')).toBe(false);
  });
  it('a throwing store is treated as null', () => {
    const bad = { getItem: () => { throw new Error('private mode'); }, setItem: () => { throw new Error('private mode'); } };
    const h = createHealth(bad, () => 0);
    h.recordCall('m', 'busy');
    expect(h.busyRate('m')).toBe(0);
  });
});

describe('helpers', () => {
  it('keyHash is short, stable and not the key', () => {
    const a = keyHash('AQ.Ab12345secret');
    expect(a).toBe(keyHash('AQ.Ab12345secret'));
    expect(a).not.toContain('secret');
    expect(a.length).toBeLessThanOrEqual(12);
  });
  it('nextPacificMidnight is 07:00 UTC in September (PDT)', () => {
    const t = Date.UTC(2026, 8, 15, 10, 0);
    expect(nextPacificMidnight(t)).toBe(Date.UTC(2026, 8, 16, 7, 0));
  });
  it('localDayKey formats the local date', () => {
    expect(localDayKey(new Date(2026, 8, 15, 12).getTime())).toBe('2026-09-15');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/health.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

```ts
// src/lib/ai/health.ts
/**
 * What this surveyor has seen from each model today. Lives in localStorage;
 * every read and write is wrapped so private mode or a blocked store just
 * means "no history".
 *
 * Two clocks on purpose: busy counts reset at LOCAL midnight (a habit
 * signal), dead-today expires at PACIFIC midnight (Google's quota fact).
 */

export type CallOutcome = 'ok' | 'busy' | 'other';

export interface HealthStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

interface HealthDoc {
  day: string;
  today: Record<string, { calls: number; busy: number }>;
  deadToday: Record<string, number>;   // `${keyHash}:${model|*}` → untilTs
  notFound: Record<string, number>;    // model → untilTs
}

const STORAGE_KEY = 'surveyos.ai.health.v1';
const MIN_CALLS_FOR_RATE = 3;
const NOT_FOUND_TTL_MS = 7 * 86_400_000;

export interface Health {
  recordCall(model: string, outcome: CallOutcome): void;
  busyRate(model: string): number;
  markDeadToday(keyHash: string, model: string | '*'): void;
  isDeadToday(keyHash: string, model: string): boolean;
  markNotFound(model: string): void;
  isNotFound(model: string): boolean;
  deadUntilLabel(): string;
}

export function localDayKey(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Next 00:00 America/Los_Angeles after `now`, as a UTC timestamp. */
export function nextPacificMidnight(now: number): number {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(now)).map(p => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const msSinceMidnightPacific = (hour * 60 + minute) * 60_000 + (now % 60_000);
  return now - msSinceMidnightPacific + 86_400_000;
}

/** djb2 over the key, base36, first 10 chars. Not reversible, not secret — an identifier. */
export function keyHash(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 10);
}

function safeStore(store: HealthStore | null): HealthStore | null {
  if (!store) return null;
  try { store.getItem(STORAGE_KEY); return store; } catch { return null; }
}

export function createHealth(rawStore: HealthStore | null, now: () => number = Date.now): Health {
  const store = safeStore(rawStore);

  function load(): HealthDoc {
    const empty: HealthDoc = { day: localDayKey(now()), today: {}, deadToday: {}, notFound: {} };
    if (!store) return empty;
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return empty;
      const doc = JSON.parse(raw) as HealthDoc;
      return doc.day === empty.day ? doc : { ...doc, day: empty.day, today: {} };
    } catch { return empty; }
  }
  function save(doc: HealthDoc): void {
    if (!store) return;
    try { store.setItem(STORAGE_KEY, JSON.stringify(doc)); } catch { /* no history */ }
  }

  return {
    recordCall(model, outcome) {
      const doc = load();
      const cur = doc.today[model] ?? { calls: 0, busy: 0 };
      save({ ...doc, today: { ...doc.today, [model]: { calls: cur.calls + 1, busy: cur.busy + (outcome === 'busy' ? 1 : 0) } } });
    },
    busyRate(model) {
      const cur = load().today[model];
      if (!cur || cur.calls < MIN_CALLS_FOR_RATE) return 0;
      return cur.busy / cur.calls;
    },
    markDeadToday(hash, model) {
      const doc = load();
      save({ ...doc, deadToday: { ...doc.deadToday, [`${hash}:${model}`]: nextPacificMidnight(now()) } });
    },
    isDeadToday(hash, model) {
      const d = load().deadToday;
      const t = now();
      return (d[`${hash}:${model}`] ?? 0) > t || (d[`${hash}:*`] ?? 0) > t;
    },
    markNotFound(model) {
      const doc = load();
      save({ ...doc, notFound: { ...doc.notFound, [model]: now() + NOT_FOUND_TTL_MS } });
    },
    isNotFound(model) {
      return (load().notFound[model] ?? 0) > now();
    },
    deadUntilLabel() {
      return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })
        .format(new Date(nextPacificMidnight(now()))).replace(/\s?(am|pm)/i, ' $1') + ' IST';
    },
  };
}

/** The app's health record, bound to window.localStorage when present. */
let _health: Health | null = null;
export function getHealth(): Health {
  if (!_health) _health = createHealth(typeof window !== 'undefined' ? window.localStorage : null);
  return _health;
}
/** Tests only. */
export function resetHealthForTests(store: HealthStore | null, now?: () => number): Health {
  _health = createHealth(store, now);
  return _health;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/health.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/health.ts src/lib/ai/__tests__/health.test.ts
git commit -m "feat(ai): per-surveyor model health — busy rate, dead-today, not-found

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Ollama as a provider id (types, config, image cap, probe lists)

**Files:**
- Modify: `src/lib/ai/models-config.ts:4` (`ProviderId`), `:30-36` (`PROVIDER_IMAGE_CAPS`), `:72-105` (`FALLBACK_AI_MODELS_CONFIG`), `:107` (`PROVIDER_IDS`)
- Modify: `src/lib/ai/probe-types.ts:87`, `src/lib/ai/probe-reconcile.ts:19`, `src/lib/ai/probe-runner.ts:44-57` (`PROVIDER_CONCURRENCY`, `PROVIDER_MIN_GAP_MS`), `:59`
- Modify: `src/lib/ai/service.ts:140-149` (`AIProvider.name`), `:63` (`PROVIDER_MODELS` record type — add `ollama: []`)
- Modify: `src/components/admin/tabs/AIModelsTab.tsx` — `PROVIDER_META` and `PROVIDERS` list (grep `PROVIDER_META`)
- Test: `src/lib/ai/__tests__/models-config.test.ts` (extend)

**Interfaces:**
- Produces: `ProviderId = 'gemini' | 'groq' | 'nvidia' | 'ollama'`; `PROVIDER_IMAGE_CAPS.ollama = null`; `FALLBACK_AI_MODELS_CONFIG.providers.ollama = { enabled: true, defaultModel: 'gemma4:31b', models: [entry('ollama','gemma4:31b','Gemma 4 31B','Free on Ollama Cloud · vision · via proxy', 131_072, true)] }`.

- [ ] **Step 1: Write the failing test** (append to `models-config.test.ts`)

```ts
import { FALLBACK_AI_MODELS_CONFIG, PROVIDER_IMAGE_CAPS } from '../models-config';

describe('ollama provider', () => {
  it('ships gemma4:31b as a vision model with no image cap', () => {
    const o = FALLBACK_AI_MODELS_CONFIG.providers.ollama;
    expect(o.enabled).toBe(true);
    expect(o.models.map(m => m.id)).toEqual(['gemma4:31b']);
    expect(o.models[0].vision).toBe(true);
    expect(PROVIDER_IMAGE_CAPS.ollama).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/models-config.test.ts`
Expected: FAIL — `providers.ollama` undefined / type error

- [ ] **Step 3: Implement**

In `models-config.ts`:

```ts
export type ProviderId = 'gemini' | 'groq' | 'nvidia' | 'ollama';

export const PROVIDER_IMAGE_CAPS: Record<ProviderId, number | null> = {
  gemini: null,
  groq: 5,
  nvidia: 1,
  ollama: null,   // measured 2026-09-15: gemma4:31b accepted 5 pages in one call
};
```

Add to `FALLBACK_AI_MODELS_CONFIG.providers` after `nvidia`:

```ts
    ollama: {
      enabled: true,
      defaultModel: 'gemma4:31b',
      models: [
        // The only vision model on Ollama Cloud's free tier (every other
        // multimodal model returned 402 on 2026-09-15). Reached via aiProxy.
        entry('ollama', 'gemma4:31b', 'Gemma 4 31B', 'Free on Ollama Cloud · vision · ~55s/5 pages · via proxy', 131_072, true),
      ],
    },
```

`PROVIDER_IDS` in all four files → `['gemini', 'groq', 'nvidia', 'ollama']`.

`probe-runner.ts`:
```ts
export const PROVIDER_CONCURRENCY: Record<ProviderId, number> = { gemini: 1, groq: 2, nvidia: 4, ollama: 1 };
export const PROVIDER_MIN_GAP_MS: Record<ProviderId, number> = { gemini: 6_500, groq: 2_500, nvidia: 0, ollama: 3_000 };
```

`service.ts`:
```ts
export interface AIProvider {
  name: 'groq' | 'gemini' | 'openai' | 'nvidia' | 'ollama';
  ...
}
export const PROVIDER_MODELS: Record<'gemini' | 'groq' | 'nvidia' | 'ollama', ModelOption[]> = {
  ...
  ollama: [{ id: 'gemma4:31b', label: 'Gemma 4 31B', note: 'Free · vision · via proxy' }],
};
```
Also extend `PROVIDER_LABELS` (grep it in service.ts) with `ollama: 'Ollama Cloud'`.

`AIModelsTab.tsx` — add to `PROVIDER_META`: `ollama: { label: 'Ollama Cloud', color: '#000000' }` and append `'ollama'` to the `PROVIDERS` array. The probe for ollama will report an error until Task 8 adds its catalogue; the tab already renders a provider whose probe errored.

- [ ] **Step 4: Typecheck and test**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/ai`
Expected: tsc clean (fix any `Record<ProviderId,…>` literal that now lacks `ollama` — the compiler lists them); tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/ai src/components/admin/tabs/AIModelsTab.tsx
git commit -m "feat(ai): register Ollama Cloud as a provider (gemma4:31b, proxied)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Ranker

**Files:**
- Create: `src/lib/ai/rank.ts`
- Test: `src/lib/ai/__tests__/rank.test.ts`

**Interfaces:**
- Consumes: `AIJob`, `JOB_NEEDS_VISION`, `HEAVY_MIN_OUTPUT_TOKENS`, `LIGHT_FAST_MS_PER_PAGE` (Task 2); `Health` (Task 3); `ModelEntry`, `ProviderId` (models-config).
- Produces:
  ```ts
  export interface PoolEntry {
    provider: ProviderId;
    model: ModelEntry;              // id, vision, imageCap, ctxWindow
    proxied: boolean;               // nvidia, ollama
    keys: string[];                 // surveyor's keys for this provider, in order
    // Optional probe data — Phase 2 fills these; Phase 1 leaves undefined.
    outputTokens?: number | null;
    msPerPage?: number | null;
    verdict?: 'exact' | 'close' | 'untested' | 'wrong' | 'failed';
  }
  export interface RankOptions { health: Health; preferredModel?: string; avoid?: ReadonlySet<string> }
  export class PayloadTooLargeError extends Error { status = 413 }
  export function rankModels(job: AIJob, images: readonly string[], pool: readonly PoolEntry[], opts: RankOptions): PoolEntry[]
  export function modelStrength(id: string): number   // higher = stronger; exported for tests
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/ai/__tests__/rank.test.ts
import { describe, it, expect } from 'vitest';
import { rankModels, modelStrength, PayloadTooLargeError, type PoolEntry } from '../rank';
import { createHealth } from '../health';

function mem() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; }
const health = () => createHealth(mem(), () => 1_000);

function entry(p: PoolEntry['provider'], id: string, over: Partial<PoolEntry> & { vision?: boolean; imageCap?: number | null } = {}): PoolEntry {
  const { vision = true, imageCap = null, ...rest } = over;
  return { provider: p, proxied: p === 'nvidia' || p === 'ollama', keys: ['k'],
    model: { id, label: id, note: '', ctxWindow: 1_000_000, vision, imageCap }, ...rest };
}
const ids = (r: PoolEntry[]) => r.map(e => e.model.id);

describe('modelStrength', () => {
  it('orders by generation then tier', () => {
    expect(modelStrength('gemini-3.5-flash')).toBeGreaterThan(modelStrength('gemini-2.5-flash'));
    expect(modelStrength('gemini-2.5-flash')).toBeGreaterThan(modelStrength('gemini-flash-lite-latest'));
    expect(modelStrength('gemini-2.5-pro')).toBeGreaterThan(modelStrength('gemini-2.5-flash'));
    expect(modelStrength('gemma4:31b')).toBe(modelStrength('gemini-2.5-flash'));
  });
});

describe('eligibility', () => {
  it('heavy and light drop text-only models; text keeps them', () => {
    const pool = [entry('groq', 'llama-3.3-70b-versatile', { vision: false }), entry('gemini', 'gemini-2.5-flash')];
    expect(ids(rankModels('heavy', ['img'], pool, { health: health() }))).toEqual(['gemini-2.5-flash']);
    expect(ids(rankModels('light', ['img'], pool, { health: health() }))).toEqual(['gemini-2.5-flash']);
    expect(ids(rankModels('text', [], pool, { health: health() }))).toContain('llama-3.3-70b-versatile');
  });
  it('drops models whose image cap is below the images in this call', () => {
    const pool = [entry('nvidia', 'nemotron', { imageCap: 1 }), entry('gemini', 'gemini-2.5-flash')];
    expect(ids(rankModels('heavy', ['a', 'b'], pool, { health: health() }))).toEqual(['gemini-2.5-flash']);
  });
  it('heavy drops models with a known output limit below 16K', () => {
    const pool = [entry('groq', 'small', { outputTokens: 8_192 }), entry('gemini', 'gemini-2.5-flash', { outputTokens: 65_536 }), entry('gemini', 'unknown-out')];
    expect(ids(rankModels('heavy', ['img'], pool, { health: health() }))).toEqual(expect.arrayContaining(['gemini-2.5-flash', 'unknown-out']));
    expect(ids(rankModels('heavy', ['img'], pool, { health: health() }))).not.toContain('small');
  });
  it('skips dead-today, not-found and avoided models', () => {
    const h = health();
    h.markDeadToday('kh', 'gemini-2.5-flash');
    h.markNotFound('gemini-3.5-flash');
    const pool = [entry('gemini', 'gemini-2.5-flash', { keys: ['kh-key'] }), entry('gemini', 'gemini-3.5-flash'), entry('gemini', 'gemini-flash-lite-latest'), entry('ollama', 'gemma4:31b')];
    // keyHash('kh-key') is what the ranker checks; mark with the real hash:
    const { keyHash } = require('../health');
    h.markDeadToday(keyHash('kh-key'), 'gemini-2.5-flash');
    const r = rankModels('heavy', ['img'], pool, { health: h, avoid: new Set(['gemma4:31b']) });
    expect(ids(r)).toEqual(['gemini-flash-lite-latest']);
  });
  it('a model is dead only for the key that hit the limit', () => {
    const { keyHash } = require('../health');
    const h = health();
    h.markDeadToday(keyHash('k1'), 'gemini-2.5-flash');
    const r = rankModels('heavy', ['img'], [entry('gemini', 'gemini-2.5-flash', { keys: ['k1', 'k2'] })], { health: h });
    expect(r).toHaveLength(1);
    expect(r[0].keys).toEqual(['k2']);
  });
  it('throws PayloadTooLargeError when vision is needed, nothing fits, and the call has >1 image', () => {
    const pool = [entry('nvidia', 'nemotron', { imageCap: 1 })];
    expect(() => rankModels('heavy', ['a', 'b'], pool, { health: health() })).toThrow(PayloadTooLargeError);
    expect(rankModels('heavy', ['a'], pool, { health: health() })).toHaveLength(1);
  });
  it('returns [] (not throw) when the pool is simply empty', () => {
    expect(rankModels('heavy', ['a'], [], { health: health() })).toEqual([]);
  });
});

describe('ordering', () => {
  it('preferred model goes first when eligible', () => {
    const pool = [entry('gemini', 'gemini-2.5-flash'), entry('gemini', 'gemini-flash-lite-latest')];
    expect(ids(rankModels('heavy', ['i'], pool, { health: health(), preferredModel: 'gemini-flash-lite-latest' }))[0]).toBe('gemini-flash-lite-latest');
  });
  it('heavy: verdict, then strength, then busy rate, then time; proxied after direct', () => {
    const h = health();
    for (let i = 0; i < 3; i++) h.recordCall('gemini-3.5-flash', 'busy');
    const pool = [
      entry('ollama', 'gemma4:31b', { verdict: 'exact', msPerPage: 11_000 }),
      entry('gemini', 'gemini-flash-lite-latest', { verdict: 'exact', msPerPage: 6_000 }),
      entry('gemini', 'gemini-2.5-flash', { verdict: 'exact', msPerPage: 30_000 }),
      entry('gemini', 'gemini-3.5-flash', { verdict: 'exact' }),
      entry('gemini', 'gemini-close', { verdict: 'close' }),
      entry('gemini', 'gemini-wrong', { verdict: 'wrong' }),
    ];
    expect(ids(rankModels('heavy', ['i'], pool, { health: h }))).toEqual([
      'gemini-2.5-flash',          // exact, strength 2.5-flash, not busy
      'gemini-flash-lite-latest',  // exact, lite
      'gemma4:31b',                // exact, same strength as 2.5-flash but proxied → after all direct exact
      'gemini-3.5-flash',          // exact, strongest, but busy 100%
      'gemini-close',
    ]);
  });
  it('heavy: untested ranks below exact/close, above nothing; wrong/failed excluded', () => {
    const pool = [entry('gemini', 'a', { verdict: 'failed' }), entry('gemini', 'b'), entry('gemini', 'c', { verdict: 'close' })];
    expect(ids(rankModels('heavy', ['i'], pool, { health: health() }))).toEqual(['c', 'b']);
  });
  it('light: fast models first, slow ones kept after, proxied always last', () => {
    const pool = [
      entry('ollama', 'gemma4:31b', { msPerPage: 5_000 }),
      entry('gemini', 'slow', { msPerPage: 40_000 }),
      entry('gemini', 'fast', { msPerPage: 9_000 }),
      entry('gemini', 'unknown-speed'),
    ];
    expect(ids(rankModels('light', ['i'], pool, { health: health() }))).toEqual(['fast', 'unknown-speed', 'slow', 'gemma4:31b']);
  });
  it('text: speed then busy, no vision filter', () => {
    const pool = [entry('gemini', 'gemini-flash-lite-latest', { msPerPage: 4_000 }), entry('groq', 'llama-3.3-70b-versatile', { vision: false, msPerPage: 2_300 })];
    expect(ids(rankModels('text', [], pool, { health: health() }))).toEqual(['llama-3.3-70b-versatile', 'gemini-flash-lite-latest']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/rank.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

```ts
// src/lib/ai/rank.ts
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
function speed(e: PoolEntry): number { return e.msPerPage ?? Number.MAX_SAFE_INTEGER / 2; }

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
    ? (a, b) => cmp(verdictRank(a), verdictRank(b)) || cmp(proxied(a), proxied(b)) || cmp(busy(a), busy(b))
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
```

Note the heavy comparator: the test expects a busy 3.5 Flash to sort *after* an idle 2.5 Flash and Lite, and Gemma (proxied) after all direct exact models. With `busy` before `strength`, busy 100 % sinks 3.5; `proxied` before `busy` keeps Gemma behind the direct ones. Run the test; if the expected order in `'heavy: verdict, then strength…'` does not match, the comparator order is wrong, not the test.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/rank.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/rank.ts src/lib/ai/__tests__/rank.test.ts
git commit -m "feat(ai): job-aware model ranker

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Generalise the proxy (Cloud Function + client)

**Files:**
- Modify: `functions/index.js:158-190` (replace `nvidiaProxy` block)
- Modify: `functions/nvidia-proxy.test.js` (rename assertions to `aiProxy`, keep alias check)
- Modify: `src/lib/firebase/functions.ts:21-45`
- Modify: `src/lib/ai/service.ts:497-509` (`callNvidiaProxy` → `callAiProxy`), `src/lib/ai/probe-runner.ts:246` (same), any other `callNvidiaProxy` caller (`grep -rn callNvidiaProxy src`)

**Interfaces:**
- Produces (server): callable `aiProxy` with data `{ provider: 'nvidia' | 'ollama', path: string, key: string, body?: unknown }` → `{ status, ok, body: string }`; `nvidiaProxy` kept as an alias that sets `provider: 'nvidia'`.
- Produces (client): `callAiProxy(provider: 'nvidia' | 'ollama', path: string, key: string, body?: unknown): Promise<ProxyResult>`.

- [ ] **Step 1: Write the failing function test** (edit `functions/nvidia-proxy.test.js`)

```js
const { aiProxy, nvidiaProxy } = require("./index");

assert.ok(aiProxy.__endpoint, "aiProxy should expose v2 endpoint metadata");
assert.strictEqual(aiProxy.__endpoint.timeoutSeconds, 300, "aiProxy must allow 300s — NVIDIA vision models take up to 200s per page");
assert.ok(nvidiaProxy.__endpoint, "nvidiaProxy alias must still be exported for clients built before the rename");
assert.strictEqual(nvidiaProxy.__endpoint.timeoutSeconds, 300);

console.log("nvidia-proxy.test.js: all assertions passed");
```

- [ ] **Step 2: Run to verify it fails**

Run: `node functions/nvidia-proxy.test.js`
Expected: AssertionError — `aiProxy.__endpoint` undefined

- [ ] **Step 3: Implement the function**

Replace the NVIDIA proxy block in `functions/index.js`:

```js
// ─── AI provider proxy ───
// NVIDIA (integrate.api.nvidia.com) and Ollama Cloud (ollama.com) send no CORS
// headers, so the browser cannot call them. This forwards the caller's own
// (BYOK) key server-to-server. Host and path are allowlisted so it is not an
// open proxy. The key is used for one request and never logged or stored.
//
// ponytail: every proxied request spends Cloud Functions egress (free tier
// 5 GB/month across all surveyors ≈ 10,000 two-page estimate calls). Proxied
// models rank last in the client so this is reached only when Gemini is
// unavailable. Upgrade path if the ceiling is hit: per-provider daily cap in
// Firestore, checked here.
const PROXY_TARGETS = {
  nvidia: { base: "https://integrate.api.nvidia.com/v1", paths: { models: "GET", "chat/completions": "POST" }, auth: (k) => ({ Authorization: `Bearer ${k}` }) },
  ollama: { base: "https://ollama.com", paths: { "api/tags": "GET", "api/chat": "POST" }, auth: (k) => ({ Authorization: `Bearer ${k}` }) },
};

// timeoutSeconds: NVIDIA vision inference measured at 27-200s per page; Ollama
// gemma4:31b at 55-63s for five pages. The v2 default of 60s kills every call
// before the provider answers, and the client reports it as an invalid key.
async function proxyToProvider(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  await assertActiveSubscription(request.auth.uid);

  const { provider = "nvidia", path, key, body } = request.data || {};
  const target = PROXY_TARGETS[provider];
  if (!target) throw new HttpsError("invalid-argument", `Unsupported provider: ${provider}`);
  if (!key) throw new HttpsError("invalid-argument", `${provider} key is required.`);
  const method = target.paths[path];
  if (!method) throw new HttpsError("invalid-argument", `Unsupported path: ${path}`);

  const fetch = (await import("node-fetch")).default;
  const res = await fetch(`${target.base}/${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...target.auth(key) },
    ...(method === "POST" ? { body: JSON.stringify(body || {}) } : {}),
  });

  // Pass the provider's response through verbatim; the client interprets status.
  const text = await res.text();
  return { status: res.status, ok: res.ok, body: text };
}

const PROXY_OPTS = { maxInstances: 10, memory: "512MiB", timeoutSeconds: 300 };
exports.aiProxy = onCall(PROXY_OPTS, proxyToProvider);
// Alias for clients built before the rename. Remove one release after aiProxy ships.
exports.nvidiaProxy = onCall(PROXY_OPTS, (request) => proxyToProvider({ ...request, data: { ...(request.data || {}), provider: "nvidia" } }));
```

- [ ] **Step 4: Run function test**

Run: `node functions/nvidia-proxy.test.js`
Expected: `nvidia-proxy.test.js: all assertions passed`

- [ ] **Step 5: Client helper**

Replace `callNvidiaProxy` in `src/lib/firebase/functions.ts`:

```ts
export type ProxiedProvider = 'nvidia' | 'ollama';

/**
 * Calls the aiProxy Cloud Function, which forwards to a provider whose API has
 * no CORS support (NVIDIA NIM, Ollama Cloud) server-to-server with the
 * surveyor's own key.
 */
export async function callAiProxy(
  provider: ProxiedProvider,
  path: string,
  key: string,
  body?: unknown,
): Promise<ProxyResult> {
  const fn = httpsCallable<{ provider: ProxiedProvider; path: string; key: string; body?: unknown }, ProxyResult>(
    functions,
    'aiProxy',
    // The callable SDK defaults to 70s. NVIDIA vision inference runs 27-200s per
    // page, and a client-side deadline surfaces as a FirebaseError with no HTTP
    // status — which the gateway's error classifier reports as a bad API key.
    // Must stay >= the function's own timeoutSeconds (300) in functions/index.js.
    { timeout: 300_000 },
  );
  const res = await fn({ provider, path, key, body });
  return res.data;
}
```

Update every caller: `callNvidiaProxy('chat/completions', key, body)` → `callAiProxy('nvidia', 'chat/completions', key, body)`; `callNvidiaProxy('models', key)` → `callAiProxy('nvidia', 'models', key)`.

- [ ] **Step 6: Typecheck, test, commit**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/ai && node functions/nvidia-proxy.test.js`
Expected: all clean.

```bash
git add functions/index.js functions/nvidia-proxy.test.js src/lib/firebase/functions.ts src/lib/ai/service.ts src/lib/ai/probe-runner.ts
git commit -m "feat(proxy): generalise nvidiaProxy to aiProxy with a host allowlist (nvidia, ollama)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Ollama key in profile, stripped from cloud sync, one row in Profile

**Files:**
- Modify: `src/types/vehicle.ts:157` (after `nvidiaApiKeys`)
- Modify: `src/stores/profile-store.ts:51` (default `ollamaApiKeys: []`)
- Modify: `src/lib/firebase/sync.ts:398-445` (strip `nvidiaApiKeys` and `ollamaApiKeys` on push; preserve on pull)
- Modify: `src/components/tabs/ProfileTab.tsx` — after the NVIDIA section (around line 755)
- Test: `src/lib/firebase/__tests__/sync-keys.test.ts` (new)

**Interfaces:**
- Produces: `SurveyorProfile.ollamaApiKeys: string[]`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/firebase/__tests__/sync-keys.test.ts
import { describe, it, expect, vi } from 'vitest';

const setDoc = vi.fn();
vi.mock('firebase/firestore', () => ({ doc: vi.fn(() => 'ref'), setDoc: (...a: unknown[]) => setDoc(...a), getDoc: vi.fn() }));
vi.mock('@/lib/firebase/config', () => ({ db: {} }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }));

import { pushProfileToCloud } from '../sync';

describe('pushProfileToCloud', () => {
  it('never writes any provider key to Firestore', async () => {
    await pushProfileToCloud('uid', {
      name: 'S', geminiApiKeys: ['g'], groqApiKeys: ['q'], nvidiaApiKeys: ['n'], ollamaApiKeys: ['o'],
      geminiApiKey: 'g0', groqApiKey: 'q0',
    } as never);
    const written = setDoc.mock.calls[0][1] as Record<string, unknown>;
    for (const k of ['geminiApiKeys', 'groqApiKeys', 'nvidiaApiKeys', 'ollamaApiKeys', 'geminiApiKey', 'groqApiKey']) {
      expect(written).not.toHaveProperty(k);
    }
    expect(written.name).toBe('S');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/firebase/__tests__/sync-keys.test.ts`
Expected: FAIL — `nvidiaApiKeys` (and `ollamaApiKeys`) present in the written doc

- [ ] **Step 3: Implement**

`src/types/vehicle.ts` after `nvidiaApiKeys`:
```ts
  /** Up to 3 Ollama Cloud API keys — free vision fallback (Gemma 4), reached via proxy */
  ollamaApiKeys: string[];
```

`src/stores/profile-store.ts` next to `groqApiKeys: []`:
```ts
  nvidiaApiKeys: [],
  ollamaApiKeys: [],
```
(if `nvidiaApiKeys: []` is already there, add only `ollamaApiKeys`).

`src/lib/firebase/sync.ts` — in `pushProfileToCloud`'s destructuring add:
```ts
    nvidiaApiKeys: _nKeys,
    ollamaApiKeys: _oKeys,
```
and update the doc comment to list all four. In `pullProfileFromCloud`'s `updateProfile({...})` add:
```ts
      nvidiaApiKeys: local.nvidiaApiKeys,
      ollamaApiKeys: local.ollamaApiKeys,
```

`src/components/tabs/ProfileTab.tsx` — after the NVIDIA section's closing `</div>`, mirror the Groq block:
```tsx
            {/* Ollama Cloud — free Gemma 4 vision fallback, used when Google is busy */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.1)' }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white shadow-sm">
                    <Cpu size={18} style={{ color: '#000000' }} />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground">Ollama Cloud</div>
                    <div className="text-[10px] font-medium text-muted-foreground">Optional · free backup (Gemma 4) used automatically when Google is busy</div>
                  </div>
                </div>
                <a href="https://ollama.com/settings/keys" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:opacity-80" style={{ background: '#000000', color: '#FFFFFF' }}>
                  Get Key <ExternalLink size={10} />
                </a>
              </div>
              <MultiKeyInput
                keys={profile.ollamaApiKeys || []}
                onChange={keys => updateProfile({ ollamaApiKeys: keys })}
                placeholder="Ollama API key"
                accentColor="#000000"
              />
            </div>
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/lib/firebase/__tests__/sync-keys.test.ts && npx tsc --noEmit -p .`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/types/vehicle.ts src/stores/profile-store.ts src/lib/firebase/sync.ts src/lib/firebase/__tests__/sync-keys.test.ts src/components/tabs/ProfileTab.tsx
git commit -m "feat(profile): Ollama Cloud key; stop syncing NVIDIA/Ollama keys to Firestore

nvidiaApiKeys was never in the strip list and has been reaching the cloud
profile doc. Now every provider key stays local + Drive backup only.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: `callWithKey` — thinking off, timeout, finish/details, Ollama branch

**Files:**
- Modify: `src/lib/ai/service.ts:412-538`
- Test: `src/lib/ai/__tests__/call-with-key.test.ts` (new)

**Interfaces:**
- Consumes: `parseGeminiError` (Task 1), `callAiProxy` (Task 6).
- Produces (module-internal, exported for tests):
  ```ts
  export type Finish = 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'OTHER'
  export interface CallResult { text: string; finish: Finish }
  export interface CallOptions { timeoutMs: number; thinkingOff: boolean }
  export class ProviderError extends Error { status: number; details: unknown[]; provider: string }
  export async function callWithKey(provider: AIProvider, key: string, prompt: string, images: string[], responseFormat: 'json' | 'text', opts: CallOptions): Promise<CallResult>
  ```
  A timeout rejects with `ProviderError` whose `status` is `0` and `name` is `'TimeoutError'`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/ai/__tests__/call-with-key.test.ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const callAiProxy = vi.fn();
vi.mock('@/lib/firebase/functions', () => ({ callAiProxy: (...a: unknown[]) => callAiProxy(...a) }));

import { callWithKey, ProviderError, type AIProvider } from '../service';

const gemini: AIProvider = { name: 'gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', model: 'gemini-2.5-flash', keys: ['k'] };
const ollama: AIProvider = { name: 'ollama', endpoint: 'https://ollama.com/api/chat', model: 'gemma4:31b', keys: ['k'] };
const opts = { timeoutMs: 5_000, thinkingOff: true };

function geminiOk(text: string, finishReason = 'STOP') {
  return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }) } as Response;
}

describe('callWithKey — gemini', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the key in x-goog-api-key and thinkingBudget 0 for JSON calls', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(geminiOk('{"a":1}'));
    const r = await callWithKey(gemini, 'AQ.key', 'p', [], 'json', opts);
    expect(r).toEqual({ text: '{"a":1}', finish: 'STOP' });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe(gemini.endpoint);
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('AQ.key');
    const body = JSON.parse(init!.body as string);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('omits thinkingConfig when thinkingOff is false', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(geminiOk('x'));
    await callWithKey(gemini, 'k', 'p', [], 'json', { ...opts, thinkingOff: false });
    expect(JSON.parse(spy.mock.calls[0][1]!.body as string).generationConfig.thinkingConfig).toBeUndefined();
  });

  it('reports MAX_TOKENS and SAFETY as finish, not as errors', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(geminiOk('{"partial', 'MAX_TOKENS')).mockResolvedValueOnce(geminiOk('', 'SAFETY'));
    expect((await callWithKey(gemini, 'k', 'p', [], 'json', opts)).finish).toBe('MAX_TOKENS');
    expect((await callWithKey(gemini, 'k', 'p', [], 'json', opts)).finish).toBe('SAFETY');
  });

  it('throws ProviderError with status and parsed details on a 429', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { message: 'quota', details: [{ '@type': 'QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } }) } as Response);
    await expect(callWithKey(gemini, 'k', 'p', [], 'json', opts)).rejects.toMatchObject({ status: 429, provider: 'gemini' });
    try { await callWithKey(gemini, 'k', 'p', [], 'json', opts); } catch (e) { expect((e as ProviderError).details).toHaveLength(1); }
  });

  it('aborts after timeoutMs with a TimeoutError', async () => {
    vi.useFakeTimers();
    vi.spyOn(global, 'fetch').mockImplementation((_u, init) => new Promise((_, rej) => {
      init!.signal!.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const p = callWithKey(gemini, 'k', 'p', [], 'json', { ...opts, timeoutMs: 1_000 });
    const assertion = expect(p).rejects.toMatchObject({ name: 'TimeoutError', status: 0 });
    await vi.advanceTimersByTimeAsync(1_001);
    await assertion;
    vi.useRealTimers();
  });
});

describe('callWithKey — ollama via proxy', () => {
  beforeEach(() => callAiProxy.mockReset());

  it('posts /api/chat with base64 images, format json, and maps the reply', async () => {
    callAiProxy.mockResolvedValue({ ok: true, status: 200, body: JSON.stringify({ message: { content: '{"b":2}' }, done_reason: 'stop' }) });
    const r = await callWithKey(ollama, 'ok', 'prompt', ['data:image/jpeg;base64,AAAA'], 'json', opts);
    expect(r).toEqual({ text: '{"b":2}', finish: 'STOP' });
    expect(callAiProxy).toHaveBeenCalledWith('ollama', 'api/chat', 'ok', expect.objectContaining({
      model: 'gemma4:31b', stream: false, format: 'json',
      messages: [{ role: 'user', content: 'prompt', images: ['AAAA'] }],
    }));
  });

  it('maps done_reason length to MAX_TOKENS and a 402 to ProviderError', async () => {
    callAiProxy.mockResolvedValueOnce({ ok: true, status: 200, body: JSON.stringify({ message: { content: 'x' }, done_reason: 'length' }) });
    expect((await callWithKey(ollama, 'k', 'p', [], 'json', opts)).finish).toBe('MAX_TOKENS');
    callAiProxy.mockResolvedValueOnce({ ok: false, status: 402, body: JSON.stringify({ error: 'this model requires a subscription' }) });
    await expect(callWithKey(ollama, 'k', 'p', [], 'json', opts)).rejects.toMatchObject({ status: 402, provider: 'ollama' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/call-with-key.test.ts`
Expected: FAIL — `callWithKey`/`ProviderError` not exported, wrong return shape.

- [ ] **Step 3: Implement**

At the top of the `callWithKey` region in `service.ts`, add the types and helper:

```ts
import { parseGeminiError } from './gemini-errors';

export type Finish = 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'OTHER';
export interface CallResult { text: string; finish: Finish }
export interface CallOptions { timeoutMs: number; thinkingOff: boolean }

/** One provider's HTTP failure, with enough attached for the loop to classify it. */
export class ProviderError extends Error {
  status: number;
  details: unknown[];
  provider: string;
  constructor(provider: string, status: number, message: string, details: unknown[] = []) {
    super(`${provider} API Error: ${message}`);
    this.provider = provider; this.status = status; this.details = details;
  }
}

function timeoutError(provider: string, ms: number): ProviderError {
  const e = new ProviderError(provider, 0, `no response within ${Math.round(ms / 1000)}s`);
  e.name = 'TimeoutError';
  return e;
}

/** fetch with an AbortController deadline; a timeout rejects with ProviderError name 'TimeoutError'. */
async function fetchWithTimeout(provider: string, url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw timeoutError(provider, ms);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function geminiFinish(reason: unknown): Finish {
  return reason === 'STOP' ? 'STOP' : reason === 'MAX_TOKENS' ? 'MAX_TOKENS' : reason === 'SAFETY' ? 'SAFETY' : 'OTHER';
}
```

Rewrite `callWithKey` (replace the whole function; the OpenAI-compatible branch keeps its body, wrapped with the timeout and returning `CallResult`):

```ts
export async function callWithKey(
  provider: AIProvider, key: string, prompt: string, images: string[],
  responseFormat: 'json' | 'text', opts: CallOptions,
): Promise<CallResult> {
  if (provider.name === 'gemini') {
    const parts: any[] = images.map(img => ({ inlineData: { mimeType: getMimeType(img), data: toRawBase64(img) } }));
    parts.push({ text: prompt });

    const res = await fetchWithTimeout('gemini', provider.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...geminiAuthHeaders(key) },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1, topP: 0.95, topK: 40,
          maxOutputTokens: 65536,  // a 5-page estimate needs ~14K; multi-page bills more
          ...(responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
          // Measured 2026-09-15: 2.5 Flash spent its output budget thinking and
          // returned MAX_TOKENS after 2,612 tokens. Extraction is OCR, not
          // reasoning — thinking off. The loop retries once without this when a
          // model rejects it (Gemini 3.x uses thinkingLevel).
          ...(opts.thinkingOff && responseFormat === 'json' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    }, opts.timeoutMs);

    if (!res.ok) {
      const info = parseGeminiError(res.status, await res.json().catch(() => ({})));
      throw new ProviderError('gemini', res.status, info.message, info.details);
    }
    const data = await res.json();
    const cand = data.candidates?.[0];
    useUIStore.getState().setAIProviderHealth('gemini', 'ok');
    return {
      text: (cand?.content?.parts?.[0]?.text || '').replace(/```json|```/g, '').trim(),
      finish: geminiFinish(cand?.finishReason),
    };
  }

  if (provider.name === 'ollama') {
    // Ollama Cloud has no CORS — always via aiProxy. Native /api/chat takes
    // raw base64 images on the message and `format: 'json'` for JSON mode.
    const { callAiProxy } = await import('@/lib/firebase/functions');
    const body = {
      model: provider.model, stream: false,
      ...(responseFormat === 'json' ? { format: 'json' } : {}),
      options: { temperature: 0.1, num_predict: provider.maxOutputTokens ?? 16384 },
      messages: [{ role: 'user', content: prompt, ...(images.length ? { images: images.map(toRawBase64) } : {}) }],
    };
    const proxied = await callAiProxy('ollama', 'api/chat', key, body);
    if (!proxied.ok) {
      const err = safeJsonParse(proxied.body);
      throw new ProviderError('ollama', proxied.status, typeof err?.error === 'string' ? err.error : err?.error?.message || String(proxied.status));
    }
    const data = safeJsonParse(proxied.body) ?? {};
    return {
      text: (data.message?.content || '').trim(),
      finish: data.done_reason === 'length' ? 'MAX_TOKENS' : 'STOP',
    };
  }

  // Groq / NVIDIA NIM / OpenAI-compatible — existing body, unchanged except:
  //   • fetch → fetchWithTimeout(provider.name, provider.endpoint, init, opts.timeoutMs)
  //   • every `throw Object.assign(new Error(...), { status })` → `throw new ProviderError(provider.name, status, message)`
  //   • return { text: (data.choices?.[0]?.message?.content || '').trim(),
  //              finish: data.choices?.[0]?.finish_reason === 'length' ? 'MAX_TOKENS' : 'STOP' }
  //   • callNvidiaProxy(...) → callAiProxy('nvidia', ...)
  ...
}
```

Note: the proxy path for NVIDIA/Ollama has its own 300 s callable timeout; `opts.timeoutMs` is not applied there (a callable cannot be aborted mid-flight). Leave a one-line comment saying so.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/ai/__tests__/call-with-key.test.ts`
Expected: PASS. `callWithRotation` will now fail to compile because `callWithKey` returns `CallResult` — that is expected and fixed in Task 9. Do **not** run tsc yet.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/service.ts src/lib/ai/__tests__/call-with-key.test.ts
git commit -m "feat(ai): callWithKey — thinking off, per-call timeout, finish reason, Ollama branch

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: The fallback loop and the new `callAIGateway`

**Files:**
- Modify: `src/lib/ai/service.ts` — delete `callWithRotation` (591-729), rewrite `callAIGateway` (731-805), delete `GEMINI_FALLBACK_CHAIN`, `GROQ_FALLBACK_CHAIN`, `GROQ_VISION_MODELS`, `isModelUnavailable`, `isQuotaExhausted`, `isHighDemandError`; add `buildPool`, `callWithFallback`, `AllProvidersBusyError`, `OfflineError`.
- Modify: `src/lib/ai/service.ts:292-322` (`getActiveImageCap(job)`), `:324-369` (`getAIProvider` — keep only as the "nothing configured" Firestore master-config path; used by `buildPool` last)
- Test: `src/lib/ai/__tests__/fallback-loop.test.ts` (new)

**Interfaces:**
- Consumes: `rankModels`, `PoolEntry`, `PayloadTooLargeError` (Task 5); `getHealth`, `keyHash` (Task 3); `classifyGemini429`, `isThinkingRejected`, `isModalityRejected`, `parseGeminiError` (Task 1); `AIJob`, `JOB_TIMEOUT_MS`, `JOB_NEEDS_VISION` (Task 2); `callWithKey`, `ProviderError`, `CallResult` (Task 8); `classifyGatewayError`, `gatewayErrorMessage` (existing).
- Produces:
  ```ts
  export interface GatewaySession { id: string; lastGood?: { provider: ProviderId; model: string }; avoid: Set<string> }
  export function newSession(id: string): GatewaySession
  export class AllProvidersBusyError extends Error { tried: string[] }
  export class OfflineError extends Error {}
  export async function callAIGateway(prompt: string, images?: string[], responseFormat?: 'json' | 'text', job?: AIJob, session?: GatewaySession, signal?: AbortSignal): Promise<string>
  export function buildPool(profile: SurveyorProfile | null): PoolEntry[]          // exported for tests
  export function getActiveImageCap(job?: AIJob): number | null
  ```
  Default `job` is `'light'` so untouched callers keep working; Task 10 sets it explicitly everywhere.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/ai/__tests__/fallback-loop.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const toast = { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('sonner', () => ({ toast }));
vi.mock('@/lib/firebase/functions', () => ({ callAiProxy: vi.fn() }));
vi.mock('@/lib/firebase/config', () => ({ getFirebaseApp: () => ({}), db: {} }));

import { callAIGateway, newSession, AllProvidersBusyError, OfflineError } from '../service';
import { useProfileStore } from '@/stores/profile-store';
import { useAIConfigStore } from '@/stores/ai-config-store';
import { FALLBACK_AI_MODELS_CONFIG } from '../models-config';
import { resetHealthForTests, keyHash } from '../health';

function mem() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; }

const ok = (text = '{"x":1}', finishReason = 'STOP') => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }) } as Response);
const fail = (status: number, message = 'err', quotaIds: string[] = []) => ({ ok: false, status, json: async () => ({ error: { message, ...(quotaIds.length ? { details: [{ '@type': 'QuotaFailure', violations: quotaIds.map(quotaId => ({ quotaId })) }] } : {}) } }) } as Response);
const modelOf = (call: unknown[]) => String(call[0]).match(/models\/([^:]+):/)![1];

let health: ReturnType<typeof resetHealthForTests>;
beforeEach(() => {
  health = resetHealthForTests(mem(), () => Date.UTC(2026, 8, 15, 10, 0));
  useAIConfigStore.getState().setConfig(FALLBACK_AI_MODELS_CONFIG);   // gemini: 2.5-flash, lite, 3.5-flash; ollama: gemma4
  useProfileStore.getState().updateProfile({ geminiApiKeys: ['g1'], groqApiKeys: [], nvidiaApiKeys: [], ollamaApiKeys: [], geminiModel: '' } as never);
  Object.values(toast).forEach(f => f.mockReset());
});
afterEach(() => vi.restoreAllMocks());

describe('hop before key rotation', () => {
  it('503 → next Gemini model with the same key, no in-place retry', async () => {
    useProfileStore.getState().updateProfile({ geminiApiKeys: ['g1', 'g2'] } as never);
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(503, 'high demand')).mockResolvedValueOnce(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(modelOf(spy.mock.calls[0])).not.toBe(modelOf(spy.mock.calls[1]));
    expect((spy.mock.calls[0][1]!.headers as any)['x-goog-api-key']).toBe('g1');
    expect((spy.mock.calls[1][1]!.headers as any)['x-goog-api-key']).toBe('g1');
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('per-model minute 429 → next model; per-project minute 429 → next key', async () => {
    useProfileStore.getState().updateProfile({ geminiApiKeys: ['g1', 'g2'] } as never);
    const spy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(fail(429, 'q', ['GenerateRequestsPerMinutePerProjectPerModel']))   // model A key g1 → hop model
      .mockResolvedValueOnce(fail(429, 'q', ['GenerateRequestsPerMinutePerProject']))           // model B key g1 → next key
      .mockResolvedValueOnce(ok());                                                              // model B key g2
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(modelOf(spy.mock.calls[1])).toBe(modelOf(spy.mock.calls[2]));
    expect((spy.mock.calls[2][1]!.headers as any)['x-goog-api-key']).toBe('g2');
  });

  it('per-model day 429 marks the model dead for that key and hops', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(429, 'q', ['GenerateRequestsPerDayPerProjectPerModel-FreeTier'])).mockResolvedValueOnce(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(health.isDeadToday(keyHash('g1'), modelOf(spy.mock.calls[0]))).toBe(true);
    expect(toast.info.mock.calls[0][0]).toMatch(/resets .* IST/);
  });

  it('per-project day 429 marks the whole provider dead for that key', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(429, 'q', ['GenerateRequestsPerDayPerProject']));
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toBeInstanceOf(AllProvidersBusyError);
    expect(health.isDeadToday(keyHash('g1'), 'anything')).toBe(true);
  });

  it('zero-quota 429 (day + minute) is remembered as not-found, not dead-today', async () => {
    const spy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(fail(429, 'q', ['GenerateRequestsPerDayPerProjectPerModel-FreeTier', 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier']))
      .mockResolvedValueOnce(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(health.isNotFound(modelOf(spy.mock.calls[0]))).toBe(true);
  });

  it('404 → not-found for 7 days and hop', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(404, 'not found')).mockResolvedValueOnce(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(health.isNotFound(modelOf(spy.mock.calls[0]))).toBe(true);
  });
});

describe('finish reasons', () => {
  it('MAX_TOKENS hops to the next model', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(ok('{"partial', 'MAX_TOKENS')).mockResolvedValueOnce(ok());
    expect(await callAIGateway('p', ['img'], 'json', 'heavy')).toBe('{"x":1}');
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it('SAFETY skips the rest of the provider', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(ok('', 'SAFETY'));
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toBeInstanceOf(AllProvidersBusyError);
    expect(global.fetch).toHaveBeenCalledTimes(1);   // no other provider configured; gemini abandoned after SAFETY
  });
});

describe('thinking guard', () => {
  it('a 400 mentioning thinking retries the same model once without thinkingConfig', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(400, 'thinking budget not supported')).mockResolvedValueOnce(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy');
    expect(modelOf(spy.mock.calls[0])).toBe(modelOf(spy.mock.calls[1]));
    expect(JSON.parse(spy.mock.calls[0][1]!.body as string).generationConfig.thinkingConfig).toBeDefined();
    expect(JSON.parse(spy.mock.calls[1][1]!.body as string).generationConfig.thinkingConfig).toBeUndefined();
  });
});

describe('terminal cases', () => {
  it('401 rotates key then abandons provider', async () => {
    useProfileStore.getState().updateProfile({ geminiApiKeys: ['g1', 'g2'] } as never);
    vi.spyOn(global, 'fetch').mockResolvedValue(fail(401, 'bad key'));
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toBeInstanceOf(AllProvidersBusyError);
    expect(global.fetch).toHaveBeenCalledTimes(2);   // g1 then g2 on the first model, then out
    expect(toast.error).toHaveBeenCalled();
  });
  it('413 throws PAYLOAD_TOO_LARGE immediately', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(fail(413, 'too large'));
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toMatchObject({ status: 413 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it('all network errors → OfflineError', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(callAIGateway('p', ['img'], 'json', 'heavy')).rejects.toBeInstanceOf(OfflineError);
  });
  it('busy-only chain gets exactly one 5s second pass', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(fail(503, 'high demand'));
    const p = callAIGateway('p', ['img'], 'json', 'heavy');
    const assertion = expect(p).rejects.toBeInstanceOf(AllProvidersBusyError);
    await vi.advanceTimersByTimeAsync(5_100);
    await assertion;
    expect(spy).toHaveBeenCalledTimes(6);   // 3 gemini models × 2 passes
    vi.useRealTimers();
  });
  it('abort signal stops hopping', async () => {
    const ctrl = new AbortController();
    vi.spyOn(global, 'fetch').mockImplementation(async () => { ctrl.abort(); return fail(503, 'busy'); });
    await expect(callAIGateway('p', ['img'], 'json', 'heavy', undefined, ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('session stickiness', () => {
  it('chunk 2 starts on the model that served chunk 1', async () => {
    const s = newSession('doc-1');
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(503, 'busy')).mockResolvedValue(ok());
    await callAIGateway('p1', ['img'], 'json', 'heavy', s);
    await callAIGateway('p2', ['img'], 'json', 'heavy', s);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(modelOf(spy.mock.calls[2])).toBe(modelOf(spy.mock.calls[1]));
  });
  it('session.avoid skips a model', async () => {
    const s = newSession('doc-2');
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    const first = modelOf(spy.mock.calls[0]);
    s.avoid.add(first); s.lastGood = undefined;
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    expect(modelOf(spy.mock.calls[1])).not.toBe(first);
  });
});

describe('nudge', () => {
  it('AllProvidersBusy with only a Gemini key mentions Ollama once per day', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(fail(503, 'busy'));
    vi.useFakeTimers();
    for (let i = 0; i < 2; i++) { const p = callAIGateway('p', ['img'], 'json', 'heavy').catch(() => {}); await vi.advanceTimersByTimeAsync(5_100); await p; }
    vi.useRealTimers();
    const msgs = toast.error.mock.calls.map(c => String(c[0]));
    expect(msgs.filter(m => /Ollama/.test(m))).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/fallback-loop.test.ts`
Expected: FAIL — `newSession`, `AllProvidersBusyError`, `OfflineError` not exported.

- [ ] **Step 3: Implement**

Delete from `service.ts`: `GEMINI_FALLBACK_CHAIN`, `GROQ_FALLBACK_CHAIN`, `GROQ_VISION_MODELS`, `isModelUnavailable`, `isQuotaExhausted`, `isHighDemandError`, `callWithRotation`, and the old `callAIGateway` body. Keep `isPayloadTooLarge`, `PROVIDER_LABELS`, `buildProvider`, `resolve*Keys`, `resolve*Model`, `getAIProvider` (for the master-config path only), `PROVIDER_MODELS`, `DEPRECATED_*` maps.

Add:

```ts
import { rankModels, PayloadTooLargeError, type PoolEntry } from './rank';
import { getHealth, keyHash } from './health';
import { type AIJob, JOB_TIMEOUT_MS } from './jobs';
import { classifyGemini429, isThinkingRejected, isModalityRejected } from './gemini-errors';
import { classifyGatewayError, gatewayErrorMessage } from './gateway-errors';

export interface GatewaySession {
  id: string;
  lastGood?: { provider: ProviderId; model: string };
  /** Models this document must not use again (math second opinion). */
  avoid: Set<string>;
  /** Hops already announced for this document — one toast per distinct hop. */
  announced: Set<string>;
}
export function newSession(id: string): GatewaySession { return { id, avoid: new Set(), announced: new Set() }; }

export class AllProvidersBusyError extends Error {
  tried: string[];
  constructor(job: AIJob, tried: string[]) { super(`All AI models are busy (${job}: tried ${tried.join(', ') || 'none'})`); this.tried = tried; }
}
export class OfflineError extends Error { constructor() { super("You're offline — AI extraction needs a connection."); } }

const PROXIED: ReadonlySet<ProviderId> = new Set(['nvidia', 'ollama']);
const ENDPOINTS: Record<ProviderId, (model: string) => string> = {
  gemini: m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
  groq: () => 'https://api.groq.com/openai/v1/chat/completions',
  nvidia: () => 'https://integrate.api.nvidia.com/v1/chat/completions',
  ollama: () => 'https://ollama.com/api/chat',
};
const KEY_FIELDS: Record<ProviderId, (p: NonNullable<ReturnType<typeof getProfileFromStorage>>) => string[]> = {
  gemini: resolveGeminiKeys, groq: resolveGroqKeys, nvidia: resolveNvidiaKeys,
  ollama: p => (Array.isArray(p.ollamaApiKeys) ? p.ollamaApiKeys.filter(k => k?.trim()) : []),
};

/** Every admin-enabled model on every provider the surveyor has a key for. */
export function buildPool(profile: ReturnType<typeof getProfileFromStorage>): PoolEntry[] {
  if (!profile) return [];
  const cfg = useAIConfigStore.getState().config;
  const pool: PoolEntry[] = [];
  for (const provider of ['gemini', 'groq', 'nvidia', 'ollama'] as ProviderId[]) {
    const block = cfg.providers[provider];
    if (!block?.enabled) continue;
    const keys = KEY_FIELDS[provider](profile);
    if (keys.length === 0) continue;
    for (const model of block.models) pool.push({ provider, model, proxied: PROXIED.has(provider), keys });
  }
  return pool;
}

function toProvider(e: PoolEntry): AIProvider {
  return {
    name: e.provider, model: e.model.id, keys: e.keys, endpoint: ENDPOINTS[e.provider](e.model.id),
    maxImages: e.model.imageCap ?? undefined,
    maxOutputTokens: e.provider === 'groq' ? 8192 : undefined,
  };
}

type Step = 'next-model' | 'next-key' | 'next-provider' | 'retry-no-thinking';

/** Decides what the loop does after one failed call. Pure; the loop applies side effects. */
function stepFor(err: any, provider: ProviderId, model: string, key: string): { step: Step; busy?: boolean; deadModel?: boolean; deadProvider?: boolean; notFound?: boolean; reprobe?: boolean } | { throw: Error } {
  const kind = classifyGatewayError(err);
  if (kind === 'subscription' || kind === 'unauthenticated') return { step: 'next-provider' };
  if (kind === 'timeout' || err?.name === 'TimeoutError') return { step: 'next-model', busy: true };
  if (err instanceof TypeError) return { step: 'next-provider' };            // network
  if (isPayloadTooLarge(err)) return { throw: Object.assign(new Error(`PAYLOAD_TOO_LARGE: ${err.message}`), { status: 413 }) };
  const status: number = err?.status ?? 0;
  if (status === 503 || status === 500) return { step: 'next-model', busy: true };
  if (status === 429) {
    const q = provider === 'gemini' ? classifyGemini429({ status, message: err.message, details: err.details ?? [] }) : null;
    if (q === 'zero') return { step: 'next-model', notFound: true };
    if (q?.scope === 'model') return q.period === 'day' ? { step: 'next-model', deadModel: true } : { step: 'next-model', busy: true };
    if (q?.scope === 'project' && q.period === 'day') return { step: 'next-key', deadProvider: true };
    return { step: 'next-key' };
  }
  if (status === 404) return { step: 'next-model', notFound: true };
  if (status === 402) return { step: 'next-model', reprobe: true };
  if (status === 400 && provider === 'gemini' && isThinkingRejected({ status, message: err.message, details: [] })) return { step: 'retry-no-thinking' };
  if (status === 400 && isModalityRejected(err.message ?? '')) return { step: 'next-model', reprobe: true };
  if (status === 401 || status === 403) return { step: 'next-key' };
  if (status === 0 && kind === 'other') return { step: 'next-provider' };   // proxy transport
  return { throw: err };
}

function announce(session: GatewaySession | undefined, key: string, text: string, kind: 'info' | 'error' = 'info'): void {
  if (session) { if (session.announced.has(key)) return; session.announced.add(key); }
  toast[kind](text, { duration: kind === 'info' ? 4000 : 10000 });
}

async function callWithFallback(
  job: AIJob, prompt: string, images: string[], responseFormat: 'json' | 'text',
  session: GatewaySession | undefined, signal: AbortSignal | undefined, pool: PoolEntry[], preferredModel?: string,
): Promise<string> {
  const health = getHealth();
  const profile = getProfileFromStorage();
  const timeoutMs = JOB_TIMEOUT_MS[job];
  const tried: string[] = [];
  let networkErrors = 0, calls = 0;

  const walk = async (chain: PoolEntry[], allowSecondPass: boolean): Promise<string> => {
    const busyOnly: PoolEntry[] = [];
    let skipProvider: ProviderId | null = null;

    for (const entry of chain) {
      if (signal?.aborted) throw Object.assign(new Error('Extraction cancelled'), { name: 'AbortError' });
      if (entry.provider === skipProvider) continue;
      const provider = toProvider(entry);
      const label = `${PROVIDER_LABELS[entry.provider] ?? entry.provider} ${entry.model.label || entry.model.id}`;
      tried.push(entry.model.id);
      let thinkingOff = true;

      keys: for (let i = 0; i < entry.keys.length; i++) {
        const key = entry.keys[i];
        try {
          calls++;
          const res = await callWithKey(provider, key, prompt, images, responseFormat, { timeoutMs, thinkingOff });
          if (res.finish === 'STOP' || res.finish === 'OTHER') {
            health.recordCall(entry.model.id, 'ok');
            if (session) session.lastGood = { provider: entry.provider, model: entry.model.id };
            return res.text;
          }
          health.recordCall(entry.model.id, 'other');
          if (res.finish === 'SAFETY') { skipProvider = entry.provider; break keys; }
          break keys;                                   // MAX_TOKENS → next model
        } catch (err: any) {
          if (err?.name === 'AbortError' && signal?.aborted) throw err;
          const d = stepFor(err, entry.provider, entry.model.id, key);
          if ('throw' in d) throw d.throw;
          health.recordCall(entry.model.id, d.busy ? 'busy' : 'other');
          if (err instanceof TypeError) networkErrors++;
          if (d.deadModel) { health.markDeadToday(keyHash(key), entry.model.id); announce(session, `dead:${entry.model.id}`, `${label} has hit today's free limit (resets ${health.deadUntilLabel()}) — trying the next model.`); }
          if (d.deadProvider) health.markDeadToday(keyHash(key), '*');
          if (d.notFound) health.markNotFound(entry.model.id);
          if (d.reprobe) console.warn(`[ai-fallback] ${entry.model.id} rejected the request (${err.status}) — admin should re-probe.`);
          if (d.busy) busyOnly.push(entry);
          console.info(`[ai-fallback] ${entry.provider}/${entry.model.id} key#${i + 1} → ${err.status ?? err.name}: ${d.step}`);

          if (d.step === 'retry-no-thinking') { thinkingOff = false; i--; continue; }
          if (d.step === 'next-key') {
            if (i + 1 < entry.keys.length) continue;
            const kind = classifyGatewayError(err);
            if (kind === 'auth') announce(session, `auth:${entry.provider}`, `${PROVIDER_LABELS[entry.provider]} key is invalid — check Profile → AI & Documents Intelligence.`, 'error');
            skipProvider = entry.provider; break keys;
          }
          if (d.step === 'next-provider') {
            const msg = gatewayErrorMessage(classifyGatewayError(err), PROVIDER_LABELS[entry.provider] ?? entry.provider);
            if (msg) announce(session, `provider:${entry.provider}`, msg, 'error');
            skipProvider = entry.provider; break keys;
          }
          break keys;                                   // next-model
        }
      }
      const next = chain[chain.indexOf(entry) + 1];
      if (next && next.provider !== skipProvider) announce(session, `hop:${entry.model.id}`, `${label} busy — trying ${next.model.label || next.model.id}.`);
    }

    if (allowSecondPass && busyOnly.length > 0) {
      await new Promise(r => setTimeout(r, 5_000));
      return walk(busyOnly, false);
    }
    throw new AllProvidersBusyError(job, tried);
  };

  let chain = rankModels(job, images, pool, { health, preferredModel, avoid: session?.avoid });
  if (session?.lastGood) {
    const i = chain.findIndex(e => e.model.id === session.lastGood!.model);
    if (i > 0) chain = [...chain.slice(i), ...chain.slice(0, i)];
  }

  try {
    return await walk(chain, true);
  } catch (err) {
    if (err instanceof AllProvidersBusyError) {
      if (calls > 0 && networkErrors === calls) throw new OfflineError();
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OfflineError();
      const onlyGemini = pool.every(e => e.provider === 'gemini');
      const nudgeKey = 'surveyos.ai.nudge.ollama';
      let nudge = '';
      try {
        const last = Number(localStorage.getItem(nudgeKey) ?? 0);
        if (onlyGemini && Date.now() - last > 86_400_000) { nudge = ' — or add a free Ollama backup key in Profile → AI & Documents Intelligence'; localStorage.setItem(nudgeKey, String(Date.now())); }
      } catch { /* no nudge memory */ }
      toast.error(`All AI models are busy. Try again in a minute${nudge}.`, { duration: 10000 });
    }
    throw err;
  }
}

export async function callAIGateway(
  prompt: string, images: string[] = [], responseFormat: 'json' | 'text' = 'json',
  job: AIJob = 'light', session?: GatewaySession, signal?: AbortSignal,
): Promise<string> {
  // Admin test override: one explicit provider/model/key, no ranking, no fallback.
  if (_testOverride) {
    const p = buildOverrideProvider(_testOverride);
    const res = await callWithKey(p, p.keys[0], prompt, images, responseFormat, { timeoutMs: JOB_TIMEOUT_MS[job], thinkingOff: true });
    return res.text;
  }
  const profile = getProfileFromStorage();
  let pool = buildPool(profile);
  if (pool.length === 0) {
    // Nothing configured — Firestore master config (admin-provided keys), as before.
    const master = await getAIProvider();
    pool = [{ provider: master.name as ProviderId, proxied: PROXIED.has(master.name as ProviderId), keys: master.keys,
      model: { id: master.model, label: master.model, note: '', ctxWindow: null, vision: true, imageCap: master.maxImages ?? null } }];
  }
  const preferred = profile?.geminiModel?.trim() || undefined;
  return callWithFallback(job, prompt, images, responseFormat, session, signal, pool, preferred);
}
```

`getActiveImageCap` becomes:

```ts
/** Image cap of the model the ranker would try first for this job — the processor sizes chunks from it. */
export function getActiveImageCap(job: AIJob = 'heavy'): number | null {
  const override = getAITestOverride();
  if (override) return buildOverrideProvider(override).maxImages ?? null;
  const pool = buildPool(getProfileFromStorage());
  try {
    const [first] = rankModels(job, ['x'], pool, { health: getHealth(), preferredModel: getProfileFromStorage()?.geminiModel?.trim() || undefined });
    return first?.model.imageCap ?? null;
  } catch { return null; }
}
```

Remove the now-unused `resolveEnabledModel` calls inside `buildProvider` only if `buildProvider` itself becomes unused — check with `grep -n buildProvider src/lib/ai/service.ts`; if only `getAIProvider` uses it, keep it. Delete anything the compiler reports as unused.

- [ ] **Step 4: Typecheck and run all AI tests**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/ai`
Expected: tsc clean; all tests pass, including `resolve-model.test.ts` and `shipped-defaults.test.ts` — if `resolve-model.test.ts` imports a deleted symbol, delete that test file too (its subject is gone).

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/ai
git commit -m "feat(ai): job-aware fallback loop — hop models before keys, no 503 retry, sessions, timeouts

Replaces callWithRotation and the hardcoded fallback chains. Every call
declares a job; the ranker orders every reachable model for it; failures
are classified into next-model / next-key / next-provider / stop.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Callers declare their job; processor passes session + signal

**Files:**
- Modify: `src/lib/ai/processor.ts:484-500` (signature already has `signal`), `:542-544` (`getActiveImageCap(job)`), `:645`, `:663`, `:695` (`callAIGateway(..., job, session, signal)`), `:401` (targeted page rescan — `heavy`)
- Modify: `src/lib/ai/bank-statement-extractor.ts:86` → `'heavy'`
- Modify: `src/lib/ai/insured-report.ts:220, 625` (policy images → `'light'`), `:266, 344, 497, 695` (text passes → `'text'`), `:851` (narrative, `'text'` responseFormat text)
- Test: `src/lib/ai/__tests__/processor-job.test.ts` (new, small)

**Interfaces:**
- Consumes: `callAIGateway(prompt, images, responseFormat, job, session, signal)`, `newSession`, `jobForDocType`, `getActiveImageCap(job)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ai/__tests__/processor-job.test.ts
import { describe, it, expect } from 'vitest';
import { jobForDocType } from '../jobs';
import { readFileSync } from 'node:fs';

// Guard: no caller may call callAIGateway without a job. The default exists
// only so the compiler is happy mid-migration; every real call names its job.
describe('every callAIGateway caller names a job', () => {
  it('no two-argument calls remain in src/lib/ai', () => {
    for (const f of ['processor.ts', 'bank-statement-extractor.ts', 'insured-report.ts']) {
      const src = readFileSync(`src/lib/ai/${f}`, 'utf8');
      const calls = [...src.matchAll(/callAIGateway\(([^;]*?)\)\s*;/gs)].map(m => m[1]);
      for (const args of calls) expect(args, `${f}: callAIGateway(${args.slice(0, 60)}…)`).toMatch(/'(heavy|light|text)'|\bjob\b/);
    }
  });
  it('processor derives heavy for estimates', () => {
    expect(jobForDocType('estimate')).toBe('heavy');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/processor-job.test.ts`
Expected: FAIL — calls without a job found.

- [ ] **Step 3: Implement**

`processor.ts`, inside `extractDocument` after `const files = …`:
```ts
  const job = jobForDocType(key);
  const session = newSession(`${key}-${Date.now()}`);
```
(imports: `import { jobForDocType } from './jobs'; import { newSession } from './service';` — `callAIGateway`, `getActiveImageCap` already imported.)

Line ~543: `getActiveImageCap()` → `getActiveImageCap(job)`.

Lines 645, 663, 695: `callAIGateway(chunkPrompt, chunkImages)` → `callAIGateway(chunkPrompt, chunkImages, 'json', job, session, signal)`; same for the `enhancedPrompt, visionImages` call.

Line 401 (targeted rescan in `rescanPages` or similar): `callAIGateway(targetedPrompt, [apiImages[idx]])` → `callAIGateway(targetedPrompt, [apiImages[idx]], 'json', 'heavy')`.

`bank-statement-extractor.ts:86`: `callAIGateway(prompt, [page])` → `callAIGateway(prompt, [page], 'json', 'heavy')`.

`insured-report.ts`: image calls (220, 625) → `, 'json', 'light'`; text-only JSON calls (266, 344, 497, 695) → `, 'json', 'text'`; narrative (851) → `callAIGateway(narrativePrompt, [], 'text', 'text')`.

- [ ] **Step 4: Typecheck, test, commit**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/ai`
Expected: clean.

```bash
git add src/lib/ai/processor.ts src/lib/ai/bank-statement-extractor.ts src/lib/ai/insured-report.ts src/lib/ai/__tests__/processor-job.test.ts
git commit -m "feat(ai): every gateway call declares its job; extraction passes a per-document session

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Math check as a second opinion

**Files:**
- Modify: `src/lib/ai/processor.ts:554-560` and `:724-730` — wrap the chunk loop so it can run twice.
- Test: `src/lib/ai/__tests__/second-opinion.test.ts` (new)

**Interfaces:**
- Consumes: `validateMath` (existing, module-private — export it), `GatewaySession.avoid`.
- Produces: `export function needsSecondOpinion(docType: string, data: unknown): boolean` (pure; true when `validateMath` fails for estimate/final-bill).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ai/__tests__/second-opinion.test.ts
import { describe, it, expect } from 'vitest';
import { needsSecondOpinion } from '../processor';

const good = { gross_amount: 300, subtotal_parts_taxable: 200, subtotal_labour_taxable: 100,
  spare_parts: [{ taxable_amount: 200, total_amount: 200 }], labour_items: [{ taxable_amount: 100, total_amount: 100 }], painting_items: [] };

describe('needsSecondOpinion', () => {
  it('false when rows add up', () => { expect(needsSecondOpinion('estimate', good)).toBe(false); });
  it('true when a row is missing (sum ≠ gross)', () => {
    expect(needsSecondOpinion('estimate', { ...good, spare_parts: [] })).toBe(true);
  });
  it('never for non-money documents', () => {
    expect(needsSecondOpinion('rc', { anything: 1 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/second-opinion.test.ts`
Expected: FAIL — `needsSecondOpinion` not exported.

- [ ] **Step 3: Implement**

In `processor.ts`, after `validateMath`:
```ts
/** True when the extraction's own arithmetic fails — the trigger for one re-run on the next model. */
export function needsSecondOpinion(docType: string, data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  return !validateMath(data, docType).isValid;
}
```

Refactor the chunk loop (the `for (let i = 0; i < totalPages; i += CHUNK_SIZE)` block that fills `finalResult` and `pageIssues`) into a local async function `runAllChunks(): Promise<{ result: any; issues: string[] }>` that uses the current `session`. Then:

```ts
    let { result: finalResult, issues: pageIssues } = await runAllChunks();

    // ponytail: second opinion re-runs the WHOLE document, not the failing
    // chunk — totals live on the last page, so a per-chunk check is not
    // possible. Costs one extra pass only when the arithmetic already failed.
    // Upgrade path: diff the two results per section and keep the better one.
    if (needsSecondOpinion(key, finalResult) && session.lastGood) {
      const firstModel = session.lastGood.model;
      onProgress?.('Totals don\'t add up — asking a second AI model to re-read the document…');
      session.avoid.add(firstModel);
      session.lastGood = undefined;
      try {
        const second = await runAllChunks();
        if (!needsSecondOpinion(key, second.result)) {
          console.info(`[ai-fallback] second opinion from ${session.lastGood?.model} passed the math check; first (${firstModel}) did not.`);
          finalResult = second.result; pageIssues = second.issues;
        }
      } catch (e) {
        console.warn('[ai-fallback] second opinion unavailable — keeping first result', e);
      }
      session.avoid.delete(firstModel);
    }
```

Keep the existing `validateMath` + `discrepancies` surfacing after this block unchanged.

- [ ] **Step 4: Typecheck, test, commit**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/ai`
Expected: clean.

```bash
git add src/lib/ai/processor.ts src/lib/ai/__tests__/second-opinion.test.ts
git commit -m "feat(ai): re-run a document on the next model when its totals don't add up

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Ollama catalogue in the probe

**Files:**
- Modify: `src/lib/ai/probe-runner.ts:244-290` (`fetchCatalogue`), and the per-provider ping/vision call sites (grep `provider === 'nvidia'` inside the probe's call helper around line 165-200) — add an `ollama` branch that posts `api/chat` via `callAiProxy` and treats 402 as a durable `paid` status.
- Modify: `src/lib/ai/probe-types.ts:20-30` — add `'paid'` to `ProbeStatus` and to `DURABLE_FAILURES`.
- Test: `src/lib/ai/__tests__/probe-runner.test.ts` (extend)

**Interfaces:**
- Consumes: `callAiProxy('ollama', 'api/tags' | 'api/chat', key, body)`.
- Produces: `ProbeStatus` includes `'paid'`; `fetchCatalogue('ollama', key)` returns `CatalogueEntry[]` from `/api/tags` (`{ id: m.name, ctxWindow: null, reportedVision: null }`).

- [ ] **Step 1: Write the failing test** (append to `probe-runner.test.ts`, following its existing mocking style for `callNvidiaProxy` — now `callAiProxy`)

```ts
describe('ollama catalogue', () => {
  it('lists /api/tags models via the proxy', async () => {
    callAiProxy.mockResolvedValueOnce({ ok: true, status: 200, body: JSON.stringify({ models: [{ name: 'gemma4:31b' }, { name: 'gpt-oss:120b' }] }) });
    const rows = await fetchCatalogue('ollama', 'key');
    expect(rows.map(r => r.id)).toEqual(['gemma4:31b', 'gpt-oss:120b']);
    expect(callAiProxy).toHaveBeenCalledWith('ollama', 'api/tags', 'key', undefined);
  });
});

describe('paid status', () => {
  it('is durable', () => {
    expect(DURABLE_FAILURES.has('paid')).toBe(true);
  });
});
```
(`fetchCatalogue` must be exported from `probe-runner.ts` if it is not already; `DURABLE_FAILURES` from `probe-types`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/probe-runner.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`probe-types.ts`:
```ts
  | 'paid'            // DURABLE: 402 — listed by the provider, not on this account's free tier
```
and `DURABLE_FAILURES = new Set<ProbeStatus>(['unreachable', 'no-text-input', 'ctx-too-small', 'paid'])`.

`probe-runner.ts` `fetchCatalogue` — before the Gemini branch:
```ts
  if (provider === 'ollama') {
    const { callAiProxy } = await import('@/lib/firebase/functions');
    const res = await callAiProxy('ollama', 'api/tags', key);
    if (!res.ok) throw new Error(`Ollama catalogue failed: HTTP ${res.status}`);
    const data = JSON.parse(res.body);
    // /api/tags reports name + size only; vision is measured by the probe.
    return dropNonChat((data.models ?? []).map((m: { name: string }) => ({ id: m.name, ctxWindow: null, reportedVision: null })));
  }
```

In the probe's per-model request helper (where `provider === 'nvidia'` builds an OpenAI-style body and calls the proxy), add:
```ts
    if (provider === 'ollama') {
      const { callAiProxy } = await import('@/lib/firebase/functions');
      const res = await callAiProxy('ollama', 'api/chat', key, {
        model, stream: false,
        options: { temperature: 0.1, num_predict: maxTokens },
        messages: [{ role: 'user', content: req.prompt, ...(req.images.length ? { images: req.images.map(i => i.replace(/^data:image\/\w+;base64,/, '')) } : {}) }],
      });
      const data = res.ok ? JSON.parse(res.body) : null;
      return { status: res.status, text: data?.message?.content ?? '', body: res.body };
    }
```
and in `classifyPing` (or wherever HTTP status becomes `ProbeStatus`): `402 → 'paid'` with reason "Requires credits on this provider".

- [ ] **Step 4: Typecheck, test, commit**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/ai`
Expected: clean.

```bash
git add src/lib/ai/probe-runner.ts src/lib/ai/probe-types.ts src/lib/ai/probe-classify.ts src/lib/ai/__tests__/probe-runner.test.ts
git commit -m "feat(probe): Ollama Cloud catalogue and ping via proxy; 402 is a durable 'paid' status

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Dev-only fault injection for live tests

**Files:**
- Create: `src/lib/ai/fault.ts`
- Modify: `src/lib/ai/service.ts` — in `callWithKey`'s gemini branch, before `fetchWithTimeout`: `const fault = takeFault(); if (fault) throw fault;`
- Test: `src/lib/ai/__tests__/fault.test.ts`

**Interfaces:**
- Produces: `export function takeFault(): ProviderError | null` — reads `?ai-fault=503|429-minute|429-day|429-zero|max-tokens` from `location.search` once per page load, returns a canned `ProviderError` the first time, `null` after. No-op when `process.env.NODE_ENV === 'production'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ai/__tests__/fault.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { takeFault, _setFaultForTests } from '../fault';

describe('takeFault', () => {
  beforeEach(() => _setFaultForTests(null));
  it('returns the canned 503 once, then null', () => {
    _setFaultForTests('503');
    expect(takeFault()).toMatchObject({ status: 503 });
    expect(takeFault()).toBeNull();
  });
  it('429-day carries a PerDay quotaId', () => {
    _setFaultForTests('429-day');
    const e = takeFault()!;
    expect(e.status).toBe(429);
    expect(JSON.stringify(e.details)).toContain('PerDayPerProjectPerModel');
  });
  it('unknown value → null', () => {
    _setFaultForTests('banana');
    expect(takeFault()).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/fault.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/lib/ai/fault.ts
import { ProviderError } from './service';

/**
 * Dev-only. `?ai-fault=503` (or 429-minute | 429-day | 429-zero) makes the
 * FIRST Gemini call of the page load fail with a canned Google body, so the
 * fallback loop can be watched on a real document without waiting for Google
 * to be busy. Compiled out of production builds.
 */
const violation = (quotaId: string) => ({ quotaId, quotaDimensions: { location: 'global', model: 'fault' } });
const CANNED: Record<string, () => ProviderError> = {
  '503': () => new ProviderError('gemini', 503, 'This model is currently experiencing high demand. (injected)'),
  '429-minute': () => new ProviderError('gemini', 429, 'quota (injected)', [{ '@type': 'QuotaFailure', violations: [violation('GenerateRequestsPerMinutePerProjectPerModel')] }]),
  '429-day': () => new ProviderError('gemini', 429, 'quota (injected)', [{ '@type': 'QuotaFailure', violations: [violation('GenerateRequestsPerDayPerProjectPerModel-FreeTier')] }]),
  '429-zero': () => new ProviderError('gemini', 429, 'quota (injected)', [{ '@type': 'QuotaFailure', violations: [violation('GenerateRequestsPerDayPerProjectPerModel-FreeTier'), violation('GenerateRequestsPerMinutePerProjectPerModel-FreeTier')] }]),
};

let pending: string | null | undefined;   // undefined = not read yet

function readFromUrl(): string | null {
  if (process.env.NODE_ENV === 'production' || typeof location === 'undefined') return null;
  return new URLSearchParams(location.search).get('ai-fault');
}

export function takeFault(): ProviderError | null {
  if (pending === undefined) pending = readFromUrl();
  const make = pending ? CANNED[pending] : undefined;
  pending = null;
  return make ? make() : null;
}

/** Tests only. */
export function _setFaultForTests(v: string | null): void { pending = v; }
```

- [ ] **Step 4: Typecheck, test, commit**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/ai`
Expected: clean. (`fault.ts` imports `service.ts` and `service.ts` imports `fault.ts` — a cycle that is fine for functions used at call time, not module-init; if tsc or vitest complains, move `ProviderError` into `gemini-errors.ts` and import it from there in both.)

```bash
git add src/lib/ai/fault.ts src/lib/ai/__tests__/fault.test.ts src/lib/ai/service.ts
git commit -m "chore(ai): dev-only ?ai-fault= injection for live fallback tests

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: Full test run, build, deploy functions + hosting, live verification

**Files:** none new.

- [ ] **Step 1: Whole suite**

Run: `npm test`
Expected: vitest all green; `test:functions` prints three "all assertions passed".

- [ ] **Step 2: Build**

Run: `npm run build && grep -rl "ai-fallback" out/_next/static/chunks/ | head -2`
Expected: build succeeds; at least one chunk contains the loop's console tag.

- [ ] **Step 3: Deploy functions first, then hosting** (functions must exist before clients call `aiProxy`)

```bash
firebase deploy --only functions:aiProxy,functions:nvidiaProxy --project surveyos-v2-antigravity-in
```
Expected: "Deploy complete!" listing both functions in `asia-south1`.

```bash
firebase deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in
```
Expected: "Deploy complete!", hosting URL `https://motorsurveyos-in.web.app`.

- [ ] **Step 4: Verify the live bundle**

```bash
curl -s https://motorsurveyos-in.web.app/_next/static/chunks/$(ls out/_next/static/chunks | grep -l "" | head -0)
```
Instead: `for f in $(grep -rl "ai-fallback" out/_next/static/chunks/ | xargs -n1 basename); do curl -s "https://motorsurveyos-in.web.app/_next/static/chunks/$f" | grep -c "ai-fallback"; done`
Expected: a non-zero count for each file.

- [ ] **Step 5: Live checks (user drives, Claude reads the console via Claude-in-Chrome `read_console_messages`)**

| # | Do | Expect in console / UI |
|---|---|---|
| L0 | Profile → AI: Gemini key only. Open a 5-page estimate. | Extraction completes; `[AI Extraction] estimate: N parts…`; no `[ai-fallback]` lines. Totals match the document. |
| L1 | Same document with `?ai-fault=503` in the URL. | One `[ai-fallback] gemini/<model> key#1 → 503: next-model`, one "busy — trying …" toast, extraction completes on the next model; **all chunks use that model** (only one hop line). |
| L2 | `?ai-fault=429-minute` | Same shape, `429: next-model`. |
| L3 | `?ai-fault=429-day` | Toast "…hit today's free limit (resets 1:30 pm IST)…"; reload without the param → that model is skipped (no call to it). |
| L4 | `?ai-fault=429-zero` | `429: next-model`, and the model is skipped for the rest of the week. |
| L5 | Add an Ollama key; in Admin → AI Models disable the Gemini provider; run the estimate. | `[ai-fallback]` shows no gemini entries; result within 0.1 % of the document total; Firebase console shows `aiProxy` invocations. |
| L6 | Re-enable Gemini. Open a licence (DL) photo. | Completes in < 20 s; no proxy call. |
| L7 | Airplane mode, open any document. | "You're offline" toast; exactly one `[ai-fallback]` line. |
| L8 | Admin → Probe all. | Ollama card shows `gemma4:31b` working; other Ollama models listed as `paid` under "unusable". |

Record the console output of L1 and L5 in `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/` per the agent protocol, and update `Tasks.md` / `Changelog.md`.

- [ ] **Step 6: Commit the session log**

```bash
git add SurveyOS-Antigravity-Prime-V2-KnowledgeBase/
git commit -m "docs: session log — AI fallback phase 1 live verification

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

## Self-review

**Spec coverage (Phase 1 sections):**
- §1 jobs — Task 2, 10. §3 ranker — Task 5 (probe fields optional until Phase 2; built-in default pool is `FALLBACK_AI_MODELS_CONFIG`, which the config store already holds before Firestore loads). §4 loop — Task 9 (every row of the match table is a `stepFor` branch or a `finish` branch; second pass; offline; abort; session; nudge). §5 Gemini fixes — Task 8 (thinking, timeouts), Task 9 (400 retry). §6 proxy — Task 6. §7 (Ollama catalogue part only) — Task 12. §9 (Ollama key row only) — Task 7. §10 unit tests — Tasks 1–13; live — Task 14. §11 math second opinion — Task 11.
- Deferred to Phase 2 by the spec: models.dev, outputTokens from Gemini's list, auto Tier 2, admin ranked lists/exclude, Profile redesign, schema migration, `light` per-page speed data in the request path.

**Type consistency:** `CallResult`/`CallOptions`/`ProviderError`/`Finish` defined in Task 8 and used in Tasks 9 and 13; `PoolEntry`/`rankModels`/`PayloadTooLargeError` from Task 5 used in Task 9; `Health` API from Task 3 used in Tasks 5 and 9 (`isDeadToday(hash, model)`, `markDeadToday(hash, model|'*')`, `isNotFound`, `markNotFound`, `busyRate`, `recordCall`, `deadUntilLabel`); `callAiProxy(provider, path, key, body?)` from Task 6 used in Tasks 8 and 12; `GatewaySession`/`newSession` from Task 9 used in Tasks 10 and 11; `jobForDocType`/`JOB_TIMEOUT_MS` from Task 2 used in Tasks 9 and 10.

**Known judgement calls (not placeholders):**
- Task 9's `stepFor` treats a bare `status: 0` non-timeout error as proxy transport → next-provider. Direct-fetch network errors are `TypeError` → next-provider and counted toward Offline.
- The proxy path cannot honour `opts.timeoutMs` mid-flight; its own 300 s callable timeout applies. Stated in Task 8.
- Task 13's import cycle has a stated fallback (move `ProviderError` to `gemini-errors.ts`).
