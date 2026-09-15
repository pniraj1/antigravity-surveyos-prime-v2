# AI fallback and job-aware model routing — design

Date: 2026-09-15 (rev 3 — heavy-doc accuracy safeguards, Pro/zero-quota handling)
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
models.dev (`https://models.dev/api.json`, 4.6 MB, CORS open) lists every
Gemini id exactly, with `deprecated`, output limit and modalities, and has
an `ollama-cloud` provider entry.

Pro models on a free key: `gemini-2.5-pro` 404 ("no longer available to
new users"); `gemini-3.1-pro-preview` and `gemini-pro-latest` 429 listing
four violations at once (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`,
`GenerateRequestsPerMinutePerProjectPerModel-FreeTier`,
`GenerateContentInputTokensPerModelPerMinute-FreeTier`,
`GenerateContentInputTokensPerModelPerDay-FreeTier`), `quotaValue` absent,
`retryDelay` 34–41 s. That shape means "zero quota on this tier", not "used
up". Pro is paid-only; a surveyor who enables billing on their own project
will see Pro ranked by the same machinery with no code change.

Evidence limits: heavy verdicts so far come from one clean, digitally-born
PDF with a text layer — the easiest case. Lite's exact result there does not
prove it on scanned or hand-annotated estimates. Sections 3 and 12 exist
because of this. Not measured: Gemini 3.6/3.7/3.8 Flash (3.5 was 503 all
session), Ollama's daily ceiling.

## Design

### 1. Jobs, not models

Every AI call declares a **job**. The job decides which models are eligible
and in what order. Nobody picks a model by name.

| Job | Document types (prompt keys) | Hard requirements | Ranked by |
|---|---|---|---|
| `heavy` | estimate, final-bill, bank-statement | vision · output ≥ 16 K tokens (or unknown) · imageCap ≥ images in this call | accuracy verdict → busy rate → whole-doc time |
| `light` | rc, dl, policy, claim, permit, auth, fitness, lok-challan, fir, photos | vision · imageCap ≥ images in this call | seconds/page (≤ 20 s preferred, slower ones after, never dropped) → busy rate |
| `text` | covering narrative, insured-report passes, line explanations | none | seconds/page |

Direct-call providers rank before proxied ones at equal standing (proxy adds
latency and consumes Cloud Functions egress). For `light`, proxied models are
always last — a 1-page photo should not cross a proxy when a direct model
exists.

`callAIGateway(prompt, images, responseFormat, job, session?)` — `job` is a
new fourth argument; `session` (a per-document id) is optional and makes the
loop start from the model that last succeeded for that document, so one bill
is never extracted by two different models. `extractDocument` derives the job
from the doc type and passes its own id as the session; the seven other call
sites pass `text` or `light` with no session.

### 2. The preferred loop per job (as of the 2026-09-15 measurements)

```
heavy:  gemini/2.5-flash → gemini/flash-lite → gemini/3.x-flash → ollama/gemma4 (proxy)
        (2.5 Flash and Lite both exact on the one benchmark; the stronger
         model leads on a tie — until its busy rate demotes it, or a scanned
         benchmark separates them)
light:  gemini/flash-lite → gemini/2.5-flash → gemini/3.x-flash → ollama/gemma4 (proxy)
text:   groq/llama-3.3-70b → gemini/flash-lite → gemini/2.5-flash
```

Pro models appear in none of these on a free key (zero quota). These are
outputs of the ranker, not constants. They change when the probe
measures something different, and per surveyor as their own health data
accumulates.

### 3. The ranker

```
rank(job, images, pool, probes, health):
  eligible = pool
    .filter(status ok — not excluded, deprecated, paid, or notFound for this surveyor)
    .filter(job.needsVision ? vision : true)
    .filter(imageCap === null || imageCap ≥ images.length)
    .filter(job === 'heavy' ? outputTokens ≥ 16K || outputTokens unknown : true)
    .filter(not deadToday for this surveyor's key)
  sort by:
    heavy: verdict = WORST result across the benchmark set
           (exact > close > untested; wrong/failed excluded)
           → stronger model first (newer generation, then larger tier:
             pro > flash > flash-lite; gemma4:31b sits with flash)
           → busyRate asc → wholeDocMs asc → direct before proxied
           Speed decides only when accuracy and strength are tied.
    light: (msPerPage ≤ 20 s first, then the rest) → msPerPage asc
           → busyRate asc → direct before proxied (proxied always last)
    text:  msPerPage asc → busyRate asc → direct before proxied
  if eligible is empty and job needs vision and images.length > 1:
    throw PAYLOAD_TOO_LARGE   // processor re-chunks smaller (existing path)
```

Inputs:

- `pool` — every model the probe found working, across all providers the
  surveyor has a key for, minus the admin's exclusions. When no probes doc
  exists yet (fresh install, Firestore read pending), the pool is a built-in
  default of `gemini-flash-lite-latest` and `gemini-2.5-flash`, vision, output
  65 536, unknown speed — enough to work on day one.
- `probes` — status, vision, imageCap, ctxWindow, **outputTokens** (new, from
  Google's `outputTokenLimit` or models.dev), msPerPage, accuracy verdict,
  probe-time busy count.
- `health` — per surveyor, in localStorage, wrapped in try/catch so private
  mode degrades to "no history":
  - `today[model] = {calls, busy}` — busy counts 503, PerMinute 429, and
    per-call timeouts. Resets at local midnight. `busyRate = busy / calls`
    when `calls ≥ 3`, else 0. The surveyor's own rate outweighs the probe's.
  - `deadToday[keyHash:model] = untilTs` — set on a PerModel PerDay 429;
    `untilTs` is the next midnight Pacific (toast says "resets 1:30 pm IST").
  - `deadToday[keyHash:*]` — set on a PerProject PerDay 429; the whole
    provider is skipped for that key until reset.
  - `notFound[model] = untilTs` — set on 404 for this surveyor's key, and on
    a zero-quota 429 (see classification below), 7-day expiry, so a model the
    admin's key sees but the surveyor's doesn't is not re-tried on every call.

Two clocks are deliberate: busy counts are a local-day habit signal; quota
resets are Google's Pacific-midnight fact.

Derived, never stored, like `model-classify.ts` today.

### 4. The fallback loop

```
chain = rank(job, images, …)
if session?.lastGood in chain: rotate chain so it starts there
busyOnly = []

for (provider, model) in chain:
  if signal?.aborted: throw Cancelled
  for key in surveyor.keys[provider]:
    res = call(provider, model, key, timeout = job.timeout)
    record health(model, res)
    match res:
      200, finishReason STOP          → session.lastGood = model; return
      200, finishReason MAX_TOKENS    → NEXT MODEL
      200, finishReason SAFETY        → NEXT PROVIDER
      503 / 500 overloaded / timeout  → busyOnly.push(model); NEXT MODEL   (no in-place retry)
      429 zero-quota (not on tier)    → notFound[model]; NEXT MODEL
      429 per-model, minute           → busyOnly.push(model); NEXT MODEL
      429 per-model, day              → deadToday[key:model]; NEXT MODEL
      429 per-project, minute         → NEXT KEY, else NEXT PROVIDER
      429 per-project, day            → deadToday[key:*]; NEXT KEY, else NEXT PROVIDER
      429 unclassifiable (Groq, Ollama, NVIDIA, or no details) → NEXT KEY, else NEXT PROVIDER
      404 model not found             → notFound[model]; NEXT MODEL
      402 model needs credits         → mark for probe; NEXT MODEL
      400 mentioning thinking         → retry same model once without thinkingConfig
      400 mentioning image / vision / modality → mark for probe; NEXT MODEL
      401 / 403                       → NEXT KEY, else NEXT PROVIDER
      413 / payload too large         → throw PAYLOAD_TOO_LARGE
      proxy: subscription lapsed      → toast once (existing message); NEXT PROVIDER
      proxy: other transport failure  → NEXT PROVIDER
      network error (fetch TypeError) → NEXT PROVIDER
      other 4xx                       → throw

if every failure was a network error, or navigator.onLine === false:
  throw Offline
if busyOnly not empty:                     // one bounded second chance for a blip
  wait 5 s; re-walk busyOnly once with the same rules, no further second pass
throw AllProvidersBusy(job, tried)
```

NEXT MODEL = next chain entry. NEXT PROVIDER = skip remaining entries of this
provider. Model hop happens **before** key rotation: Gemini quotas are per
project and per model, Groq quotas are per organisation, and a surveyor's
second key is usually in the same project or org — rotating keys rarely helps.

**Per-call timeouts** (`AbortController`, threaded into the two `fetch`
calls): heavy 120 s, light 30 s, text 30 s. Measured 503s took up to 194 s to
return; without a timeout four busy models could take 13 minutes to fail.

**Gemini 429 classification** (`classifyGemini429`): read `error.details[]`;
if absent, try `JSON.parse(error.message).error.details` (Google sometimes
double-encodes). Find the `QuotaFailure` violation's `quotaId`:

- contains `PerModel` → per-model, else per-project
  (note `GenerateRequestsPerMinutePerProjectPerModel` contains both words —
  the presence of `PerModel` decides)
- contains `PerDay` → day, else minute
- **zero-quota**: the violations list contains both a `PerDay` and a
  `PerMinute` entry (measured: Pro on a free key lists all four at once).
  One call cannot exhaust a daily and a per-minute limit simultaneously
  unless the limit is zero — the model is not on this tier.

Returns `{scope: 'model' | 'project', period: 'minute' | 'day'} | 'zero' | null`.

Surveyor-facing messages, at most one toast per distinct hop per document
(session stickiness makes chunk 2..n reuse chunk 1's model):

- hop: "Flash-Lite busy — trying 2.5 Flash"
- deadToday: "2.5 Flash has hit today's free limit (resets 1:30 pm IST) —
  using Flash-Lite"
- Offline: "You're offline — AI extraction needs a connection."
- AllProvidersBusy: "All AI models are busy. Try again in a minute." When the
  surveyor has only a Gemini key, the message adds "— or add a free Ollama
  backup key in Profile → AI" with a link, at most once per day.

### 5. Gemini request fixes

- `thinkingConfig: { thinkingBudget: 0 }` on every JSON-format Gemini call.
  Measured: 2.5 Flash hit MAX_TOKENS after 2,612 output tokens with a 65 K
  budget because thinking consumed it. Flash-Lite, which does not think, was
  exact twice. Gemini 3.x uses `thinkingLevel` and some models cannot disable
  thinking — hence the 400-retry-without-thinkingConfig row above. Verified
  against 3.5/3.6 Flash before Phase 0 ships. Ships first as its own commit.
- Remove the 2× 1.5 s in-place 503 retry.
- `callWithKey` attaches `finishReason` and parsed `details` to its result /
  thrown error so the loop can branch on them.

### 6. Proxy generalisation

`nvidiaProxy` becomes `aiProxy` with a host allowlist:

```
{ nvidia: 'https://integrate.api.nvidia.com/v1', ollama: 'https://ollama.com' }
```

Same contract: BYOK key forwarded in-flight, never logged or stored, caller
must be authenticated with an active subscription, path allowlisted. Client
`callNvidiaProxy` becomes `callAiProxy(provider, path, key, body)`.

Cost ceiling: Cloud Functions free egress is 5 GB/month across all surveyors.
The processor already sends ≤ 2 pages per call for estimates (~0.5 MB), so
roughly 10,000 proxied heavy calls/month are free, then ~₹0.01 each. Proxied
models rank last so this is reached only when Gemini is genuinely
unavailable. `// ponytail:` comment at the proxy names the ceiling. A $1
billing alert on the Firebase project is a one-time console setting. Cold
start adds 2–5 s to the first proxied call — acceptable for heavy, and light
only reaches the proxy last.

### 7. Catalogue and metadata

- `fetchCatalogue('ollama')` — `GET https://ollama.com/api/tags` via proxy.
  Models that return 402 on the ping are recorded `status: 'paid'` (new
  durable status) and hidden.
- Gemini catalogue records `outputTokenLimit` → `ProbeResult.outputTokens`.
- The **admin probe only** (never surveyor devices) fetches models.dev once,
  matches on exact `provider/id`, and marks listed-as-deprecated models
  `status: 'deprecated'` (durable, hidden). No prefix or fuzzy matching. If
  the fetch fails the probe proceeds without it. It also fills `outputTokens`
  for providers whose list API doesn't report it.
- Tier 2 (benchmark accuracy) runs automatically for any model that is
  working now and has no accuracy result for the current benchmark. One
  extraction per new model per probe. A 503 / 429 / timeout during Tier 2
  leaves the verdict `untested` — only a content failure (no total, wrong
  total) becomes `wrong`. One bad afternoon must not exclude a model from
  heavy until the next manual probe.
- Probe records `busy` per model during passes 1 and 2 (503s seen / calls
  made). Small sample; shown to the admin, weighted below the surveyor's own
  health by the ranker.

### 8. Admin AI Models tab

Keeps: Probe button, benchmark upload + expected total/items, per-model
"Test with estimate PDF", provider on/off, "last probed N days ago" nudge at
30 days.

Removes: per-model checkbox, ★ default, the small/large/limited buckets.

Adds:

- **Discovery summary** per provider, written by the probe and shown at the
  top of the provider card: "Found 39 models · 6 usable · 3 NEW since last
  probe · 12 deprecated (hidden) · 4 paid (hidden) · 14 not chat/vision".
  Hidden groups expand on click; nothing is silently dropped.
- **Three ranked lists** — Estimates & bills / Licence, RC, policy / Letters
  & text — each row showing rank, model, NEW badge when applicable, and a
  one-line reason: verdict, whole-doc or per-page time, output limit, busy %
  from the probe, and "via proxy" where relevant. Rows are the ranker's
  output for an admin with keys for every enabled provider, so what the
  admin sees is what a fully-configured surveyor gets.
- **Exclude** toggle per row. Excluded models are stored as
  `providers[p].excluded: string[]` and skipped by the ranker for every job.
  The UI refuses to exclude the last eligible model for any job and says so.

Schema change: `ProviderConfig.models` and `defaultModel` are removed;
`excluded` is added. One-time migration on first load: a stored non-empty
`models` list becomes `excluded = working − models` so existing choices carry
over; an empty or missing `models` list becomes `excluded = []`. The doc is
rewritten once.

### 9. Surveyor Profile

- Remove the Gemini and Groq model pickers.
- Add an Ollama Cloud key row.
- Each provider row: name, "Get a free key" link, key input(s), **Test**
  button (one cheap call — `models` list for Gemini/Groq, `/api/tags` via
  proxy for Ollama — shows ✓ / ✗ with the reason), and a one-line role:
  "Required" (Gemini) or "Optional — backup when Google is busy" (others).
- Keys stay local + Drive backup, unchanged.

### 10. Testing

Unit (vitest, fetch mocked with the real Google error bodies captured in
this session plus the documented PerDay shape):

- `classifyGemini429` — PerMinutePerProjectPerModel → model/minute;
  PerDayPerProjectPerModel → model/day; PerDayPerProject → project/day;
  double-encoded message; missing details → null.
- `rank` — heavy excludes text-only, low-output, and imageCap-too-small
  models; light keeps slow models after fast ones (never empty while a
  vision model exists); proxied sorts last for light; deadToday, notFound,
  excluded, deprecated, paid all skipped; empty vision pool with >1 image
  throws PAYLOAD_TOO_LARGE; no probes doc → built-in default pool;
  admin pool `[3.6, 2.5, lite]` with lite fastest+exact → lite first.
- Loop — 503 hops without retry; timeout counts as busy; MAX_TOKENS hops;
  SAFETY skips provider; PerModel-day marks deadToday and hops;
  PerProject-day marks provider dead; 402 and vision-400 hop; thinking-400
  retries once without thinkingConfig; 401 rotates key; 413 throws; abort
  between hops stops; all-network-errors throws Offline; busy-only chain
  gets exactly one 5 s second pass; exhausted chain throws
  AllProvidersBusy; session makes chunk 2 start on chunk 1's model.
- Migration — non-empty old list → complement; empty → no exclusions;
  single benchmark → array of one.
- `classifyGemini429` — captured Pro body (four violations) → 'zero'.
- rank — worst-across-benchmarks verdict; exact-tied models order by
  strength before speed.
- Math second opinion — failing chunk re-runs once on the next heavy model;
  passing result wins; both failing keeps the first with discrepancies.
- Tier 2 — transient failure leaves `untested`.

Live (manual, one dev-only `?ai-fault=503|429-minute|429-day|max-tokens`
URL param that makes the first call return a canned body):

- L0 3.5/3.6 Flash accept `thinkingBudget: 0` or the retry path handles
  the 400.
- L1 real 5-page estimate through the app with the AQ. key — exact result,
  one model for all chunks.
- L2–L5 induced faults — observe the hop toasts and the `[ai-fallback]`
  console line per hop.
- L6 Ollama key added, Gemini provider disabled in admin → estimate goes via
  proxy, result within 0.1 %.
- L7 Airplane mode → Offline message, no hops.

### 11. Heavy-document accuracy safeguards

Ranking cannot be trusted from one clean benchmark, and no ranking prevents
a model from dropping a row on a bad scan. Two safeguards:

**Benchmark set.** The admin uploads up to three benchmark documents, each
with its expected total and item count: a clean digital PDF, a scanned or
photographed estimate, a long (10+ page) final bill. Tier 2 runs every model
against every benchmark; the heavy verdict is the worst result across the
set. With fewer than three, the admin tab says "benchmarked on 1 of 3
document types" next to the heavy list so the evidence gap is visible.
`BenchmarkDoc` becomes an array; existing single-benchmark data migrates as
element 0.

**Math check as second opinion.** `validateMath` already detects when
extracted rows do not add up to the document's own totals — a dropped or
misread row makes the arithmetic fail regardless of which model dropped it.
Today it only shows a toast. Change: when the math fails for a chunk, re-run
that chunk once on the next heavy model in the chain and keep whichever
result satisfies the math; if neither does, keep the first and show the
discrepancy as today. Cost: one extra call, only when the result is already
wrong. This is the safeguard that does not depend on the ranking being right.

### 12. Out of scope

- Z.ai, Cloudflare, OpenRouter adapters (data-residency decision pending for
  Z.ai; Cloudflare/OpenRouter add when Gemini + Gemma prove insufficient).
- OCR-then-text pipeline.
- Encrypted cross-device key sync.
- Automatic scheduled probes.

## Phases

Each phase ships and deploys on its own. Decisions 2026-09-15: bank-statement
is heavy; heavy per-call timeout 120 s; thinking fix bundled into Phase 1.

- **Phase 1** — `thinkingBudget: 0` with the 400-retry guard (verified live
  on 3.x Flash first), plus loop + jobs + health: sections 3, 4, 5, 6 and the
  `ollama` adapter. Ranker reads today's `providers[p].models` as the pool so the
  admin tab keeps working unchanged. Surveyor sees the new hops immediately.
  Includes the math-check second opinion (section 11) since it rides on the
  loop.
- **Phase 2** — catalogue + admin + profile: sections 7, 8, 9, the benchmark
  set (section 11) and the schema migrations.

## Files

New: `src/lib/ai/rank.ts`, `src/lib/ai/health.ts`,
`src/lib/ai/gemini-errors.ts`, tests beside them.

Changed: `service.ts` (job/session args, loop, timeouts, thinkingBudget,
details + finishReason on results), `processor.ts` + 7 call sites (job,
session, math second opinion), `benchmark-doc.ts` (array), `probe-runner.ts` (ollama catalogue, outputTokens, models.dev,
auto tier 2, busy count, discovery summary), `probe-types.ts` (new statuses,
fields), `models-config.ts` (excluded, migration), `AIModelsTab.tsx`
(discovery summary, ranked lists, exclude), `ProfileTab.tsx` (rows, test
buttons, no pickers), `functions/index.js` (aiProxy),
`src/lib/firebase/functions.ts`.

Deleted: `GEMINI_FALLBACK_CHAIN`, `GROQ_FALLBACK_CHAIN`, `resolveGeminiModel`,
`resolveGroqModel`, `resolveNvidiaModel`, `resolveEnabledModel`,
`CURRENT_MODELS`, `model-classify.ts`.
