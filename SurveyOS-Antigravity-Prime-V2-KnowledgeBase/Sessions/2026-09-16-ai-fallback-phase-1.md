# Session: 2026-09-15 → 16 (Claude)

## What Changed

AI fallback Phase 1 — job-aware model routing, hop-before-key, Ollama Cloud
via proxy, thinking off, math second opinion. Deployed 2026-09-16 to
motorsurveyos-in.web.app (functions `aiProxy` + `nvidiaProxy` alias in
asia-south1, then hosting). 1105 tests passing.

Spec: `docs/superpowers/specs/2026-09-15-ai-fallback-and-job-routing-design.md` (rev 3)
Plan: `docs/superpowers/plans/2026-09-15-ai-fallback-phase-1.md`
Ledger: `.superpowers/sdd/progress.md` § AI Fallback Phase 1

### Commits (aade02fd..0dae7e61, 19)
- 4a6b0edb feat(ai): classify Gemini 429s by quotaId (+ scope aggregation fix)
- dd466bb2 feat(ai): job types and doc-type mapping
- a7680744 feat(ai): per-surveyor model health (+ DST fix)
- 0ece965b feat(ai): register Ollama Cloud as a provider
- 2bd52cd5 feat(ai): job-aware model ranker
- 784dce09 feat(proxy): nvidiaProxy → aiProxy with host allowlist
- e6b2a179 feat(profile): Ollama key; stop syncing NVIDIA/Ollama keys to Firestore
- 9310bfb5 feat(ai): callWithKey — thinking off, timeout, finish reason, Ollama
- f31a05e9 feat(ai): fallback loop (+ skipped-provider Set, day-limit message, 502/504)
- 83f741db feat(ai): every gateway call declares its job; per-document session
- 79f1e7fd feat(ai): math second opinion (+ cancel propagates)
- 8964e4bc feat(probe): Ollama catalogue and ping; 402 = durable 'paid'
- 05219ea4 chore(ai): dev-only ?ai-fault= injection
- 0dae7e61 fix(ai): final-review fixes (7)

### Measured (drove the design)
- 5-page DTC estimate, truth ₹2,26,860.85 / 80 items: Flash-Lite exact ×2
  (32 s / 111 s); 2.5 Flash exact ×1 then MAX_TOKENS ×2 (thinking ate the
  budget) and 503; 3.5 Flash 503 all session; Gemma 4 31B via Ollama Δ0.01 %,
  55–63 s; DL/RC on Gemma 4 correct in 5 s.
- A Gemini 503 takes 60–194 s to come back → never retry in place.
- Pro on a free key: 429 with day+minute violations at once = zero quota.
- Ollama Cloud free tier: only gemma4:31b is free AND vision; no CORS.
- Neither Gemini nor Ollama send rate-limit headers.

## Rules

### Jobs
`heavy` (estimate, final-bill, bank-statement), `light` (rc, dl, policy,
claim, permit, auth, fitness, lok-challan, fir, photos), `text` (narrative,
insured-report passes). `callAIGateway(prompt, images, format, job, session?, signal?)`.

### Loop (service.ts `callWithFallback`)
Hop model before rotating key. 503/500/502/504/timeout → next model.
Gemini 429 by quotaId: PerModel+minute → next model; PerModel+day → dead
till Pacific midnight; PerProject+day → whole key dead; day+minute together
→ zero quota (not-found 7 days). SAFETY → next provider. One 5 s second
pass over busy-only models. Per-call timeouts heavy 120 s / light,text 30 s.

### Phase 1 pool
Admin's enabled `providers[p].models` for every provider the surveyor has a
key for. No probe verdicts in the request path yet → preferred model
defaults to `CURRENT_MODELS.gemini` (2.5 Flash) until Phase 2.

### Keys
Never reach Firestore. `nvidiaApiKeys` had been leaking (missing from the
strip list) — now stripped, and `deleteField()` purges it for one release.

### Proxy
`aiProxy` allowlists nvidia (`models`, `chat/completions`) and ollama
(`api/tags`, `api/chat`). BYOK key forwarded in-flight, never stored.
Egress ceiling ≈ 10,000 two-page calls/month free.

## Live checks (Task 14 L0–L8) — PENDING
Owner drives the app; Claude reads the console via Claude-in-Chrome.
`?ai-fault=503 | 429-minute | 429-day | 429-zero` injects the first Gemini
failure (dev builds only).

## Phase 2 (not started)
Probe verdicts/msPerPage/outputTokens into the request path; models.dev
deprecation filter; auto Tier 2 for new models; benchmark set (clean /
scanned / long) with worst-case verdict; admin ranked lists + Exclude +
discovery summary; Profile provider rows with Test buttons, pickers removed;
schema migration `models` → `excluded`. Minors carried: busy-rate bucketing;
multi-page policy as `light` can time out; `finish OTHER` + empty text
should hop; legacy master-config provider name guard; dead
`resolveEnabledModel`; make `job` required; functional test for
`proxyToProvider`; e2e test for `extractDocument`.
