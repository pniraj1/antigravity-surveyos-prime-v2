# Session: 2026-09-16 (Claude) — Quota-aware ranking (AI fallback Phase 2-A)

## Why

Owner's Google quota page (free tier, per key, per day): every Gemini
Flash model **20** requests, Flash-Lite **500**, Gemma-via-Google 14 400,
Pro 0. A 5-page estimate = 5 calls = a quarter of a Flash model's day. The
Phase 1 ranker sorted heavy by strength (Flash before Lite) and light
documents (RC, DL — many per day) also landed on Flash, so the scarce
quota died by lunchtime. Ollama Cloud has unpublished hourly/daily caps
(429 when hit). Accuracy benchmark rejected — 13 calls per model per run.

Spec: `docs/superpowers/specs/2026-09-16-quota-aware-ranking-design.md`
Plan: `docs/superpowers/plans/2026-09-16-quota-aware-ranking.md`
Ledger: `.superpowers/sdd/progress.md` § Quota-aware ranking
Commits: be766f12..0f054cbc on `main`. **Not deployed** (hosting only when
the owner says go; no functions change).

## Rules now in force

- `src/lib/ai/quota.ts` — `dailyLimit(provider, id)`: gemini `/pro/` 0,
  `/lite/` 500, `/gemma/` 14 400, other gemini 20; ollama/groq/nvidia
  `Infinity` (unknown). `tierOf`: flash | lite | gemma. `OLLAMA_REST_MS` 1 h.
- `health.ts` — `spent[keyHash:model]` ledger, resets at **Pacific**
  midnight (busy counts keep their local-day reset). `recordSpend` on every
  attempt (incl. the no-thinking retry). `remaining(hash, model, limit)` =
  0 when dead/rested. `rest(hash, model, ms)` parks in `deadToday`.
- `rank.ts` — heavy: tier flash → lite → gemma, then remaining budget desc
  (unlimited ties with the fullest finite, capped — transitive), then
  verdict/busy/proxied/strength/speed. light/text: lite → gemma → flash
  (Flash last resort only). Per key: dropped when `remaining < pagesNeeded`;
  keys ordered fullest-first; entry dropped with no key. Pro never eligible.
  **Surveyor's saved Gemini pick no longer steers ranking** (Profile picker
  inert until 2-D; `ProviderHealthBadge` now says "Gemini · auto").
- `service.ts` — `GatewaySession.pagesTotal` = calls still needed,
  re-computed before every chunk (`ceil((totalPages − i) / CHUNK_SIZE)`);
  gap fill uses 1 and restores. Non-Gemini 429 → next model + 1 h rest.
  Day-limit toast fires when every key is dead **or ledger-spent**. Once a
  day, heavy only, no Ollama key: "Today's Flash quota is used up — reading
  with Flash-Lite" (only when a Flash key is truly at 0).

## Surveyor-facing consequences

- RC/DL/policy → Flash-Lite (500/day) first, always.
- Estimates rotate across Flash siblings (6 × 20/day per key) and across
  backup keys; a key that cannot finish the document is never started.
- A 25-page bill goes straight to Flash-Lite. With an Ollama key gemma4
  takes over silently when Flash is spent.

## Live check L10 (pending, owner)
DevTools → Application → Local Storage → `surveyos.ai.health.v1`: set
`spent["<keyHash>:gemini-2.5-flash"] = 20` and the same for every Flash
model in the admin pool; reload; upload the 5-page DTC estimate.
Expect: first call on a Flash-Lite model; toast "Today's Flash quota is
used up — reading with Flash-Lite" (only without an Ollama key); no
half-read. Then an RC photo: first call on Flash-Lite regardless.
L2–L9 from earlier sessions still open.

## Carried minors
- `recordSpend` runs before the network call — an offline attempt burns a
  ledger unit (self-heals at Pacific midnight).
- `tierOf` reports Pro as flash while `dailyLimit` is 0 (Pro is dropped
  before tier matters; nudge guards `dailyLimit > 0`).
- Day-limit toast condition is `some` spent key, not `every` (pre-existing).
- `getActiveImageCap` ranks with `pagesNeeded = 1` and no `avoid`, so chunk
  sizing can disagree with the loop's first model; harmless within Gemini.
- 2-D must remove the Profile Gemini/Groq model pickers (now inert).

## Tests
`npx vitest run` 1184 passing (146 files); `npx tsc --noEmit` clean;
functions tests green.
