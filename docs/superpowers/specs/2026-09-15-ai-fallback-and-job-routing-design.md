# AI fallback and job-aware model routing — design

Date: 2026-09-15
Status: draft for review

## Problem

1. When the surveyor's chosen Gemini model returns 503 "high demand" or a
   per-model 429, the app retries the same model twice, then abandons Gemini
   entirely and falls to Groq — which has no usable vision model. The tier is
   not exhausted; only that one model is busy. Measured 2026-09-15: a 503 takes
   60–194 s to come back, so two in-place retries can burn six minutes.
2. Model choice is a human job today. The surveyor picks a Gemini model in
   Profile; the admin ticks models and stars a default. Neither knows that
   Flash-Lite is exact and 5× faster than 2.5 Flash on a 5-page estimate, or
   that 2.5 Flash truncates because it spends its output budget thinking.
3. The hop-on-404 chain is a hardcoded constant that ignores the admin's list.
4. Deprecated and legacy models appear in the admin panel with no signal.

## Measured inputs (5-page DTC estimate, truth ₹2,26,860.85 / 80 items)

| Model | Result | Time |
|---|---|---|
| gemini-flash-lite-latest | exact ×2 | 32 s / 111 s |
| gemini-2.5-flash | exact ×1, MAX_TOKENS truncation ×2, 503 ×1 | 158–262 s |
| gemini-3.5-flash | 503 ×2 | — |
| ollama gemma4:31b (via proxy) | Δ0.01 % / Δ0.08 %, 80 / 79 items | 63 s / 55 s |
| ollama gemma4:31b — DL, RC | fields correct | 5 s |

Neither Gemini nor Ollama send rate-limit headers. Ollama Cloud's free tier
serves exactly one vision model (gemma4:31b); every other multimodal model
returns 402. Ollama Cloud and Cloudflare send no CORS headers and must be
proxied; Gemini, Z.ai and OpenRouter can be called from the browser.

## Design

### 1. Jobs, not models

Every AI call declares a **job**. The job decides which models are eligible
and in what order. Nobody picks a model by name.

| Job | Document types (prompt keys) | Needs | Ranked by |
|---|---|---|---|
| `heavy` | estimate, final-bill, bank-statement | vision, output ≥ 16 K tokens | accuracy verdict → busy rate → whole-doc time |
| `light` | rc, dl, policy, claim, permit, auth, fitness, lok-challan, fir, photos | vision, ≤ 20 s/page | seconds/page → busy rate |
| `text` | covering narrative, insured-report passes, line explanations | none | seconds/page |

Direct-call providers rank before proxied ones at equal standing (proxy adds
latency and consumes Cloud Functions egress). `light` never uses proxied
providers except as the last entry — a 1-page photo should not cross a proxy
when a direct model exists.

`callAIGateway(prompt, images, responseFormat, job)` — `job` is a new fourth
argument. `extractDocument` derives it from the doc type; the seven other call
sites pass `text` or `light` explicitly.

### 2. The preferred loop per job (as of the 2026-09-15 measurements)

```
heavy:  gemini/flash-lite → gemini/2.5-flash → gemini/3.x-flash → ollama/gemma4 (proxy)
light:  gemini/flash-lite → gemini/2.5-flash → ollama/gemma4 (proxy)
text:   groq/llama-3.3-70b → gemini/flash-lite → gemini/2.5-flash
```

These are outputs of the ranker, not constants. They change when the probe
measures something different.

### 3. The ranker

```
rank(job, pool, probes, health):
  eligible = pool
    .filter(alive, not excluded by admin, not deprecated)
    .filter(job.needsVision ? vision : true)
    .filter(job === 'heavy' ? outputTokens ≥ 16K || unknown : true)
    .filter(job === 'light' ? msPerPage ≤ 20_000 : true)
    .filter(not deadToday for this surveyor)
  sort by job's key, then direct-before-proxied, then provider catalogue order
```

Inputs:

- `pool` — every model the probe found working, across all providers the
  surveyor has a key for, minus the admin's exclusions.
- `probes` — status, vision, imageCap, ctxWindow, **outputTokens** (new, from
  Google's `outputTokenLimit`), msPerPage, accuracy verdict.
- `health` — per-surveyor, per-model, rolling today: `{calls, busy}` where
  `busy` counts 503 and PerMinute-429 responses. Stored in localStorage,
  reset at local midnight. `busyRate = busy / calls` when `calls ≥ 3`, else 0.
- `deadToday` — per-surveyor set of models that returned a PerDay 429, with
  expiry at the next midnight Pacific. localStorage.

Derived, never stored, like `model-classify.ts` today.

### 4. The fallback loop

```
chain = rank(job, …)
for (provider, model) in chain:
  for key in surveyor.keys[provider]:
    res = call(provider, model, key)
    record health(model, res)
    match res:
      200                         → return
      503 / 500 overloaded        → NEXT MODEL            (no in-place retry)
      429 quotaId ~ PerModel+PerMinute → NEXT MODEL
      429 quotaId ~ PerModel+PerDay    → deadToday.add(model); NEXT MODEL
      429 quotaId ~ PerProject    → NEXT KEY, else NEXT PROVIDER
      429 unparseable             → NEXT KEY, else NEXT PROVIDER
      404 model not found         → mark for probe; NEXT MODEL
      401 / 403                   → NEXT KEY, else NEXT PROVIDER
      413 / payload too large     → throw PAYLOAD_TOO_LARGE (caller shrinks chunk)
      other 4xx                   → throw
      proxy transport failure     → NEXT PROVIDER
throw AllProvidersBusy(job, tried)
```

NEXT MODEL = next chain entry. NEXT PROVIDER = skip remaining entries of this
provider. Model hop happens **before** key rotation: Gemini quotas are per
project and per model, and a surveyor's second key is usually in the same
project.

`callWithKey` attaches the parsed `error.details[]` to the thrown error so the
loop can read `quotaId`. A new `classifyGemini429(err)` returns
`'per-model-minute' | 'per-model-day' | 'per-project' | 'unknown'`.

Surveyor-facing messages, one toast per hop at most:

- hop: "Flash-Lite busy — trying 2.5 Flash"
- deadToday: "2.5 Flash has hit today's free limit (resets 1:30 pm) — using
  Flash-Lite"
- AllProvidersBusy: "All AI models are busy. Try again in a minute, or add a
  backup key in Profile → AI." with a link.

### 5. Gemini request fixes

- `thinkingConfig: { thinkingBudget: 0 }` on every JSON-format Gemini call.
  Measured: 2.5 Flash hit MAX_TOKENS after 2,612 output tokens with a 65 K
  budget because thinking consumed it. Flash-Lite, which does not think, was
  exact twice. Ships first as its own commit.
- Remove the 2× 1.5 s in-place 503 retry.

### 6. Proxy generalisation

`nvidiaProxy` becomes `aiProxy` with a host allowlist:

```
{ nvidia: 'https://integrate.api.nvidia.com/v1', ollama: 'https://ollama.com' }
```

Same contract: BYOK key forwarded in-flight, never logged or stored, caller
must be authenticated with an active subscription, path allowlisted. Client
`callNvidiaProxy` becomes `callAiProxy(provider, path, key, body)`.

Cost ceiling: Cloud Functions free egress is 5 GB/month across all surveyors.
A 5-page estimate is ~1.3 MB, so roughly 3,800 proxied heavy documents/month
free, then ~₹0.02 each. Proxied models rank last so this is reached only
when Gemini is genuinely unavailable. `// ponytail:` comment at the proxy
names the ceiling.

### 7. Catalogue and metadata

- `fetchCatalogue('ollama')` — `GET https://ollama.com/api/tags` via proxy.
  Models that return 402 on the ping are recorded `status: 'paid'` (new
  durable status) and hidden.
- Gemini catalogue records `outputTokenLimit` → `ProbeResult.outputTokens`.
- The probe fetches `https://models.dev/api.json` once and marks any model it
  lists as deprecated with `status: 'deprecated'` (durable, hidden, never
  shown). If the fetch fails the probe proceeds without it.
- Tier 2 (benchmark accuracy) runs automatically for any model that is
  working now and has no accuracy result for the current benchmark. One
  extraction per new model per probe.
- Probe records `busy503` per model during pass 1 and 2 (503s seen / calls
  made) so the admin sees demand before surveyors do.

### 8. Admin AI Models tab

Keeps: Probe button, benchmark upload + expected total/items, per-model
"Test with estimate PDF", provider on/off, "last probed N days ago" nudge at
30 days.

Removes: per-model checkbox, ★ default, the small/large/limited buckets.

Adds: three ranked lists — Estimates & bills / Licence, RC, policy / Letters
& text — each row showing rank, model, one-line reason (verdict, time, busy
%), and an **Exclude** toggle. Excluded models are stored as
`providers[p].excluded: string[]` and skipped by the ranker for every job.

Schema change: `ProviderConfig.models` and `defaultModel` are removed;
`excluded` is added. A one-time migration on first load treats a stored
`models` list as "everything else excluded" so existing admin choices carry
over, then rewrites the doc.

### 9. Surveyor Profile

- Remove the Gemini and Groq model pickers.
- Add an Ollama Cloud key row.
- Each provider row: name, "Get a free key" link, key input(s), **Test**
  button (one cheap call; shows ✓ / ✗ with the reason), and a one-line role:
  "Required" (Gemini) or "Optional — backup when Google is busy" (others).
- Keys stay local + Drive backup, unchanged.

### 10. Testing

Unit (vitest, fetch mocked with the real Google error bodies captured in
this session):

- `classifyGemini429` — PerMinute, PerDay, PerProject, missing details.
- `rank` — heavy excludes text-only and low-output models; light excludes
  >20 s/page; proxied sorts after direct; deadToday and excluded skipped;
  admin pool `[3.6, 2.5, lite]` with lite fastest+exact → lite first.
- Loop — 503 hops without retry; PerDay marks deadToday and hops;
  PerProject rotates key then provider; 401 rotates key; 413 throws;
  exhausted chain throws AllProvidersBusy.
- Migration — old `models` list becomes `excluded` complement.

Live (manual, one dev-only `?ai-fault=503|429-minute|429-day` URL param
that makes the first call throw a canned body):

- L1 real 5-page estimate through the app with the AQ. key — exact result.
- L2–L4 induced 503 / PerMinute / PerDay — observe the hop toasts and the
  `[ai-fallback]` console line per hop.
- L5 Ollama key added, Gemini provider disabled in admin → estimate goes via
  proxy, result within 0.1 %.

### 11. Out of scope

- Z.ai, Cloudflare, OpenRouter adapters (data-residency decision pending for
  Z.ai; Cloudflare/OpenRouter add when Gemini + Gemma prove insufficient).
- OCR-then-text pipeline.
- Encrypted cross-device key sync.
- Automatic scheduled probes.

## Phases

Each phase ships and deploys on its own.

- **Phase 0** — `thinkingBudget: 0` on Gemini JSON calls. One line, one test.
- **Phase 1** — loop + jobs: sections 3, 4, 5, 6 and the `ollama` adapter.
  Ranker reads today's `providers[p].models` as the pool so the admin tab
  keeps working unchanged. Surveyor sees the new hops immediately.
- **Phase 2** — catalogue + admin + profile: sections 7, 8, 9 and the
  schema migration.

## Files

New: `src/lib/ai/rank.ts`, `src/lib/ai/health.ts`,
`src/lib/ai/gemini-errors.ts`, tests beside them.

Changed: `service.ts` (job arg, loop, thinkingBudget, details on error),
`processor.ts` + 7 call sites (job), `probe-runner.ts` (ollama catalogue,
outputTokens, models.dev, auto tier 2, busy count), `probe-types.ts` (new
statuses, fields), `models-config.ts` (excluded, migration),
`AIModelsTab.tsx` (ranked lists), `ProfileTab.tsx` (rows, no pickers),
`functions/index.js` (aiProxy), `src/lib/firebase/functions.ts`.

Deleted: `GEMINI_FALLBACK_CHAIN`, `GROQ_FALLBACK_CHAIN`, `resolveGeminiModel`,
`resolveGroqModel`, `resolveNvidiaModel`, `resolveEnabledModel`,
`CURRENT_MODELS`, `model-classify.ts`.
