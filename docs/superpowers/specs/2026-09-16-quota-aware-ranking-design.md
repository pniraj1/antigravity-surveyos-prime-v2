# Quota-aware ranking (AI fallback Phase 2-A)

Date: 2026-09-16 · Status: design approved in brainstorm, awaiting spec review
Follows: `2026-09-15-ai-fallback-and-job-routing-design.md` §3 (ranker),
`2026-09-16-smart-fix-missed-rows-design.md` (gap fill, second opinion)

## Problem

Google's free tier, read from the owner's quota page on 2026-09-16
(requests per day, per key):

| Family | RPM | RPD |
|---|---|---|
| Gemini Flash — 2.5, 3, 3.5, 3.6, 3.7, 3.8 (each) | 5 | **20** |
| Gemini Flash-Lite — 3.5, 3.1 | 15 | **500** |
| Gemma 4 31B / 26B via Google | 30 | 14 400 (TPM 16K) |
| Gemini Pro (any) | 0 | 0 |

A 5-page estimate is 5 calls = a quarter of a Flash model's day. The
ranker today sorts heavy by *strength* (newer generation, flash > lite),
so it spends the scarcest quota first, hits the day limit mid-document,
then `deadToday` parks the model till Pacific midnight. Light documents
(RC, DL — one page each, many per day) also land on Flash and eat the
same 20.

Ollama Cloud's free tier has usage caps too (hourly and daily windows,
numbers unpublished, HTTP 429 when hit).

Decisions from the brainstorm: keep the powerful Flash models for
estimates and bills; light documents must never spend Flash quota while
anything cheaper works; a heavy user gets backup keys from more Google
accounts, so budgets are per key; no accuracy benchmark (it would cost
13 calls per model per run).

## Goals

1. A heavy document runs on the strongest tier that still has enough
   budget for the whole document, across all of the surveyor's keys.
2. Light and text jobs never touch a 20/day model while a 500/day or
   unlimited model is eligible.
3. Zero extra AI calls. Everything is derived from counts the app already
   makes plus one shipped table.
4. Unknown limits (Ollama, Groq, NVIDIA) are learned from 429s, not
   guessed.

Non-goals: admin-editable budgets and the ranked-list UI (Phase 2-C);
discovery / deprecation (2-B); Profile rows (2-D); cross-device ledgers.

## Design

### 1. Budget table — `src/lib/ai/quota.ts` (new, pure)

```ts
export type Tier = 'flash' | 'lite' | 'gemma';
export function tierOf(provider: ProviderId, id: string): Tier;
export function dailyLimit(provider: ProviderId, id: string): number;   // calls/day per key; Infinity = unknown
export const OLLAMA_REST_MS = 60 * 60_000;                               // one usage window
```

`dailyLimit` — gemini: `/pro/` → 0 (never eligible on the free tier),
`/lite/` → 500, `/gemma/` → 14 400, anything else → 20. ollama, groq,
nvidia → `Infinity`. `tierOf` — gemini: `/gemma/` → gemma, `/lite/` →
lite, else flash (Pro counts as flash — never eligible anyway); ollama
`gemma*` → gemma; other providers → lite (they are cheap fallbacks, not
reserves). A shipped constant; admin editing comes with 2-C.

### 2. Ledger — `src/lib/ai/health.ts` (extend)

The health doc gains `spent: Record<string, number>` keyed
`${keyHash}:${model}` and a `quotaDay` stamp. Counts reset when the
**Pacific** day changes (reuse `nextPacificMidnight`); the existing
`today` busy counts keep their local-day reset — two clocks, as in
Phase 1.

```ts
recordSpend(keyHash: string, model: string): void;          // every call that reached the provider, any outcome
remaining(keyHash: string, model: string, limit: number): number;
   // 0 if isDeadToday(keyHash, model) or rested; else max(0, limit − spent)
rest(keyHash: string, model: string, untilTs: number): void;   // Ollama 429 → now + OLLAMA_REST_MS
```

`deadToday` (PerDay 429) stays as the hard stop — it covers quota eaten
by other apps on the same key (Antigravity, AI Studio), which the ledger
cannot see. `rest` is the same mechanism with a caller-chosen expiry;
stored in the same `deadToday` map.

### 3. Ranker — `src/lib/ai/rank.ts`

`RankOptions` gains `pagesNeeded: number` (default 1). The ranker hashes
each of `PoolEntry.keys` with `keyHash` from health.

Per entry the ranker computes, for each key, `remaining(keyHash(key),
model, dailyLimit(provider, model))`, drops keys with `remaining <
pagesNeeded`, orders the survivors by remaining desc, and drops the
entry if no key survives. `best = max remaining` (Infinity for unknown
limits).

Sort:
- **heavy**: tier flash → lite → gemma; inside a tier `best` desc (an
  unlimited model ties with the fullest); then the existing tiebreaks
  (verdict, busy rate, strength, speed, direct before proxied).
- **light / text**: tier lite → gemma → flash; inside a tier the
  existing order (speed, busy, proxied last). Flash sits at the end as
  last resort only.

`pagesNeeded` per call site: `GatewaySession` gains `pagesTotal?:
number`, set by `extractDocument` after rasterising; `callAIGateway`
passes `job === 'heavy' ? session?.pagesTotal ?? 1 : 1`. The gap fill
needs one page: `fillGaps` sets `session.pagesTotal = 1` for its calls
and restores the previous value in `finally` (the session is already
mutable — `avoid`, `lastGood`). The second opinion re-runs the whole
document with the original `pagesTotal`.

Inside a tier an unlimited budget ties with the fullest, so the existing
tiebreaks (verdict, busy, direct-before-proxied) decide.

### 4. Loop — `src/lib/ai/service.ts`

- Every `callWithKey` attempt that reached the provider (ok, busy, 4xx,
  timeout) calls `health.recordSpend(keyHash(key), model)`. The
  no-thinking retry counts as a second call.
- `stepFor`: a non-Gemini 429 (Ollama, Groq, NVIDIA) → `{ step:
  'next-model', rest: true }`; the loop calls `health.rest(keyHash,
  model, now + OLLAMA_REST_MS)`. Gemini 429 classification unchanged.
- Chain order and key order come from the ranker; no structural change
  to the walk.
- Nudge: when a **heavy** call falls out of the flash tier because every
  Flash (key, model) is below `pagesNeeded`, one toast per day: "Today's
  Flash quota is used up — reading with Flash-Lite". Suppressed when the
  surveyor has an Ollama key (gemma handles it; nothing to fix). Uses
  the existing once-per-day nudge mechanism.

### 5. Errors and edge cases

- Ledger says budget left but Google says PerDay 429 → `deadToday` as
  today; next document skips the model. No double counting.
- Ledger says spent but the surveyor got a new key mid-day → new
  `keyHash`, fresh budget. Correct by construction.
- A document longer than any Flash budget (e.g. 25 pages) → Flash tier
  has no survivor → Flash-Lite (500) takes it. Never a half-read.
- All tiers empty → existing `AllProvidersBusyError` with the day-limit
  message from Phase 1.
- Private mode / storage blocked → `remaining` returns the full limit
  (no history), as `health` degrades today.

### 6. Testing

- `quota.test.ts`: table by family; Pro = 0; unknown providers Infinity;
  tiers.
- `health.test.ts`: `recordSpend` per key; `remaining` with limit, dead,
  rested; Pacific-day reset independent of local-day busy reset.
- `rank.test.ts`: heavy tier order; inside-tier by remaining; key drop
  below `pagesNeeded`; entry drop when no key survives; two keys — the
  fuller key first; light never Flash while a lite is eligible; light
  falls to Flash when nothing else is eligible.
- `fallback-loop.test.ts`: spend recorded per key per call incl. retry;
  Ollama 429 → rest 1 h and next model; second key used when the first
  is below `pagesNeeded`.
- Live: L10 — set `spent` for every Flash to 19 in localStorage, upload
  the 5-page DTC estimate, expect first call on `gemini-3.5-flash-lite`
  and the once-a-day toast (when no Ollama key).

## Out of scope / later

Admin-editable limits and the "budget 480/500 today" column (2-C);
learning a limit from the first PerDay 429 of an unknown model (Groq/
NVIDIA) — they are cheap fallbacks and `deadToday` already handles the
day; per-minute (RPM) pacing — the loop's busy hop covers it.
