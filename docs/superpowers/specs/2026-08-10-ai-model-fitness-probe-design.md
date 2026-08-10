# AI Model Fitness Probe — Design

**Date:** 2026-08-10
**Status:** Approved for planning
**Scope:** Admin AI Models panel + the NVIDIA request path

## Problem

Two failures, one root cause: the app decides what a model can do by guessing from its name.

### 1. NVIDIA extraction fails on every document

Measured against `DTC Proforma Invoice-1.PDF` (5 pages, digitally-born, 2,000–3,300 text chars/page) using the exact request shape `callWithKey` builds in `src/lib/ai/service.ts:414`.

The PDF classifies as `text` mode at `src/lib/ai/processor.ts:513`, so no images are sent. Text-mode latency, page 1:

| model | latency | extraction |
|---|---|---|
| `meta/llama-3.2-90b-vision-instruct` (current default) | 130.8s | correct |
| `meta/llama-3.2-11b-vision-instruct` | 76.0s | correct |
| `nvidia/nemotron-nano-12b-v2-vl` | 27.0s | wrong — copied `rate` into `amount`, missing 18% GST |
| `nvidia/llama-3.3-nemotron-super-49b-v1.5` | 199.7s | correct |
| `nvidia/nvidia-nemotron-nano-9b-v2` | 61.4s | correct |

`nvidiaProxy` (`functions/index.js:165`) declares no `timeoutSeconds`, so it runs at the Cloud Functions v2 default of **60s**. `callNvidiaProxy` (`src/lib/firebase/functions.ts:31`) uses `httpsCallable` with no options, so the client SDK gives up at **70s**. Every NVIDIA model except `nemotron-nano-12b-v2-vl` exceeds both.

When the deadline blows, the callable rejects with a `FirebaseError` carrying `code: 'functions/deadline-exceeded'` and **no `.status` property**. Every classifier in `callWithRotation` (`src/lib/ai/service.ts:546`) reads `err.status`, so the timeout matches no branch, falls through key rotation, and surfaces as:

> "All AI providers failed. Check your API keys in Profile → AI & Documents Intelligence."

NVIDIA is the only provider whose errors arrive as FirebaseError `code` strings rather than HTTP `status` numbers, so it is the only one misdiagnosed as a bad key. A `permission-denied` from `assertActiveSubscription` (`functions/index.js:32`) is swallowed identically.

Gemini is unaffected: it calls `generativelanguage.googleapis.com` directly from the browser with no Cloud Function in the path, and its errors carry HTTP status codes. The same PDF extracts correctly through Gemini today.

### 2. Scanned estimates return 400 on NVIDIA

NVIDIA NIM rejects multi-image requests outright:

```
400 {"message":"At most 1 image(s) may be provided in one request."}
```

`processor.ts:524` sets `VISION_CHUNK_SIZE = 2` for `estimate` and `final-bill`. `PROVIDER_IMAGE_CAPS.nvidia` is `null` in `src/lib/ai/models-config.ts:33`, and `service.ts:243` carries the comment *"No maxImages cap — NVIDIA NIM handles full documents."* That comment is false for every NVIDIA vision model tested.

Capping alone does not fix it. `service.ts:403` does `images.slice(0, cap)` — it **truncates** the chunk rather than looping, so setting the cap to 1 would silently drop page 2 of every 2-page chunk. Silent page loss on a liability document is worse than a 400.

### 3. The admin panel's guidance is fabricated

`isLikelyVisionModel` (`src/lib/ai/discovery.ts:10`) regex-matches the model **name** to guess vision support. `computeEstimateCapacity` (`src/lib/ai/models-config.ts:58`) turns that guess into a capability sentence, stamping every NVIDIA vision model with **"handles 6+ page scanned estimates."** None of them do.

`mapList` (`discovery.ts:15`) hardcodes `ctxWindow` to 128,000 for all NVIDIA models. `nvidia/llama-3.1-nemotron-nano-vl-8b-v1`'s real ceiling is 16,384, and the app requests `max_tokens: 16384` (`service.ts:422`), so it 400s unconditionally:

```
This model's maximum context length is 16384 tokens. However, you requested
16448 tokens (64 in the messages, 16384 in the completion).
```

The list itself is unreliable. NVIDIA's `/v1/models` returns 100 entries with exactly four fields and no availability information:

```json
{"id":"google/gemma-4-31b-it","object":"model","created":735790403,"owned_by":"google"}
```

No deprecation flag, no capability, no context window. `created` is the same placeholder value for all 100 models. Three listed models — `google/gemma-3-12b-it`, `google/gemma-4-31b-it`, `microsoft/phi-3-vision-128k-instruct` — return **404 Not Found for this account**. `nvidia/nemotron-parse` returns 400 because it refuses text input. The catalogue is not an entitlement.

Net effect: the admin sees ~100 alphabetically-sorted IDs, several of which cannot run, each carrying a capability badge that is invented.

## Goals

- The admin sees only models that were verified to work, ranked by measured fitness.
- Models that die are removed from the surveyor-facing list without admin action.
- New models appear on their own as providers release them.
- NVIDIA is selectable as a primary provider and works.
- No per-model manual testing.

## Non-goals

- **Automated accuracy scoring.** The probe measures capability and liveness, not extraction quality. Judging whether a model reads estimates correctly stays a human call on a document the admin chooses, via the existing "Test with estimate PDF" control (`AIModelsTab.tsx:174`). The assessment is the surveyor's to sign; grading models against a synthetic fixture would add a scorer to maintain for a judgment the admin wants to make themselves.
- **Retiring BYOK.** Routing extraction through the dormant `callAI` gateway (`functions/index.js:114`) is a separate project with its own DPDP, quota, and processor-agreement work. It depends on this one: a server-side router is only as good as its knowledge of which models work.
- **Scheduled probing.** The admin runs it; the panel shows how stale the last run is.

## Design

### Discovery rule: trust metadata, probe the gaps

Provider catalogues differ in quality. Use what a provider reliably reports; probe only what it does not; when they disagree, the call wins.

| provider | reported | probed |
|---|---|---|
| Gemini | `supportedGenerationMethods`, `inputTokenLimit`, `outputTokenLimit` | latency |
| Groq | `context_window`, `active` | vision, image cap, latency |
| NVIDIA | nothing usable | everything |

Each field on a probe result records its `source` (`'provider-metadata'` or `'probe'`) so the panel can show where a number came from. A model that provider metadata claims is available but that 404s on call is recorded as unreachable.

This keeps the expensive work concentrated where the gap is, which is NVIDIA.

### Pass 1 — reachability ping

One call per catalogue entry: the prompt `Reply with OK.` and `max_tokens` set to the **real extraction budget** (16,384), not a small number.

`max_tokens` is a ceiling, not a target — a healthy model answers "OK" in two tokens and returns immediately, so the ping stays fast. But a model whose context window cannot accommodate a 16,384-token completion rejects the request outright, which is the only way to discover that ceiling. Pinging with a small `max_tokens` would let `nvidia/llama-3.1-nemotron-nano-vl-8b-v1` pass, and it would then fail on every real extraction.

| response | status | effect |
|---|---|---|
| `200` | survives to pass 2 | — |
| `404` | `unreachable` | hidden; listed under Gone with the provider's message |
| `400 "does not support text input"` | `no-text-input` | hidden |
| `400 "maximum context length is N"` | records real `ctxWindow` | survives if `N` leaves room for the extraction request; otherwise `ctx-too-small` and hidden |
| `401` / `403` | `auth-error` | probe aborts for that provider — this is a key problem, not a model problem |
| `429` | `rate-limited` | retried once after backoff, then deferred to the end of the queue |

Parsing the context window out of the 400 message is best-effort; on no match, `ctxWindow` stays `null` and the model is treated as unknown-but-usable.

### Pass 2 — capability and latency, on survivors only

Three calls per survivor:

1. **Vision** — the fixture image, asking for a reference code printed on it. A `200` alone proves nothing: a text-only model handed an image may ignore it and answer anyway. The model must return the code, which it can only read from the pixels.
2. **Image cap** — the same image twice. `400 "At most N image(s)"` records the real cap. A `200` proves only that the cap is at least 2, so rather than binary-searching for an exact number, the recorded value falls back to the provider's documented cap with `source: 'provider-metadata'`. This preserves Groq's known 5 and Gemini's uncapped behaviour while letting NVIDIA's probe overrule to 1 — the value the chunking fix depends on.
3. **Latency** — the same fixture with the real estimate prompt and `max_tokens: 512`, aborted at **90s**.

All three calls share one fixture, `public/ai-probe-page.jpg`: a synthetic one-page estimate with invented parts and amounts, carrying a printed reference code (`PROBE7X`) for the vision check, sized like a real rendered page (~200KB) so the latency measurement is representative. It is a payload, not ground truth — no extracted value is scored against it. It must be synthetic: probing with a real estimate would ship a named insured's GSTIN, chassis and registration number to every model on every run.

A model that trips the 90s cutoff records `msPerPage: null, slow: true`. It is shown and remains selectable — the admin may accept it — but is ranked last and badged. The 90s cutoff is a probe budget, not the runtime limit; the request path allows 300s, so a `slow` model can still work in production. `meta/llama-3.2-90b-vision-instruct` at 131s/page is exactly this case.

### Durable versus transient failure

A probe result must distinguish what a model *is* from what happened to it *this minute*. Measured over one full NVIDIA catalogue run: 5 models read-timed out at 95s and one returned HTTP 500 — including `meta/llama-3.2-1b-instruct`, which is plainly alive. Cold starts and queues look exactly like death if you only check whether the call succeeded.

- **Durable** — `unreachable` (404), `no-text-input`, `ctx-too-small`. These describe the model. They accrue a strike.
- **Transient** — timeouts, 429, any 5xx. These describe the moment. They never accrue a strike and never remove anything.

Pass 1 retries once after a transient failure before recording it. Auto-disable requires **two consecutive durable failures**, so a single bad afternoon at a provider cannot strip a surveyor's working models. Without this rule, one probe run against a rate-limited Gemini would have auto-disabled the provider that currently works.

### Pacing

Concurrency is per-provider, because free-tier limits are:

| provider | concurrency | min gap | why |
|---|---|---|---|
| NVIDIA | 4 | 0 | measured: 100 pings in 222s, no rate limiting |
| Groq | 2 | 2.5s | per-minute free-tier cap |
| Gemini | 1 | 6.5s | 10 requests/minute free tier — 4-wide would 429-storm |

The catalogue is also filtered against an **exclusion** list (embedding, rerank, guard, safety, tts, imagen, veo) before probing. This is not the capability guess that was deleted: it never claims a model *can* do something, it only skips families that cannot serve a chat extraction at all. On Gemini, where the budget is ~9 requests per minute, that filter roughly halves the run.

### Expected runtime

Measured pass 1 on NVIDIA: **222s for 100 models** at concurrency 4, of which **60 returned 404** and only **28 survived**. Pass 2 then runs three calls against those 28. With Gemini paced at ~9 rpm, a full three-provider run is roughly **20–30 minutes**.

Because that is long enough for a browser tab to be closed, results are **persisted as each provider completes** rather than once at the end. A run abandoned after NVIDIA keeps NVIDIA's results.

### Data model

New document `ai_config/model_probes`, admin-write, world-read. Separate from `ai_config/models` so the working config is never disturbed by a probe.

```ts
type ProbeStatus =
  | 'ok' | 'unreachable' | 'no-text-input' | 'ctx-too-small'
  | 'auth-error' | 'error';

interface ProbeResult {
  id: string;
  status: ProbeStatus;
  reason: string;                    // human-readable, shown in the Gone group
  vision: boolean;
  imageCap: number | null;           // max images accepted in one call
  ctxWindow: number | null;
  msPerPage: number | null;          // null when the 90s cutoff was hit
  slow: boolean;
  source: Record<'vision' | 'imageCap' | 'ctxWindow', 'probe' | 'provider-metadata'>;
  probedAt: number;
}

interface ModelProbes {
  probedAt: number;
  probedBy: string;                  // admin email
  providers: Record<ProviderId, {
    probedAt: number;
    error: string | null;            // set when the provider's probe aborted
    models: Record<string, ProbeResult>;
  }>;
}
```

At ~200 bytes per model and ~170 models, the document is well under Firestore's 1MB limit.

`ModelEntry.estimateCapacity` (`models-config.ts:14`) is removed. `computeEstimateCapacity` and `isLikelyVisionModel` are deleted with it — they exist only to fabricate the values the probe now measures.

### Panel behaviour

A single **Refresh & probe** action replaces the three per-provider "Refresh live list" buttons. It fetches every catalogue, runs both passes, computes the diff against the stored probe, and writes the result.

Three groups per provider:

- **New** — present now, absent from the previous probe. Badged `NEW`. Suppressed on the first ever probe, when everything would qualify.
- **Working** — `status: 'ok'`, ranked by `msPerPage` ascending, `slow` last.
- **Gone** — was `ok` in the previous probe, is not now. Shows the reason.

Rows carry only measured facts: `vision · 1 img/call · 128K ctx · 27s/page`. A value sourced from provider metadata is marked as such.

Models with `status !== 'ok'` never appear as candidates.

### Approval and auto-disable

Enabling is the admin's; disabling on death is automatic.

- The admin ticks models and hits **Save Config**, which writes `ai_config/models` exactly as today. Nothing reaches surveyors without that.
- When a probe finds a currently-enabled model has failed **durably twice in a row**, the panel removes it from `ai_config/models` immediately, without waiting for Save, and reports what it removed. Leaving a dead model enabled produces failed extractions for surveyors, and requiring an admin click to stop that is a worse default. A transient failure, however severe, removes nothing.
- Auto-removal never enables anything and never changes `defaultModel` except to fall back to the first surviving enabled model when the default itself dies.

### The three request-path defects

Independent of the probe, required for NVIDIA to work as a primary provider.

**Timeouts.** `nvidiaProxy` gains `timeoutSeconds: 300` (`functions/index.js:165`); `callNvidiaProxy` passes `{ timeout: 300000 }` to `httpsCallable` (`src/lib/firebase/functions.ts:31`). At 512MiB × 300s a worst-case call costs 150 GB-s against Firebase's 400,000 GB-s monthly free tier — roughly 2,600 page-calls per month before any charge.

**Chunking.** `service.ts` exports the active provider's probed image cap. `processor.ts:524` derives `VISION_CHUNK_SIZE` from it rather than hardcoding `2`. The truncating `images.slice(0, cap)` at `service.ts:403` is replaced by a thrown error: by that point a chunk larger than the cap is a caller bug, and failing loudly beats dropping a page from an estimate.

**Error classification.** `callWithRotation` (`service.ts:546`) reads FirebaseError `code` alongside HTTP `status`:

| signal | message |
|---|---|
| `functions/deadline-exceeded` | "NVIDIA timed out after 5 minutes — try a faster model." |
| `functions/permission-denied` | the subscription message, surfaced verbatim |
| `functions/unauthenticated` | "Session expired — sign in again." |
| HTTP `401` / `403` | the existing invalid-key message |

Timeouts and permission errors do not rotate keys — rotation cannot help either.

### Error handling

- A provider whose probe aborts (auth error, network failure) records `providers[p].error` and leaves its previous results intact rather than wiping them. A failed probe must never empty the working config. The same applies when no admin key is configured for a provider — that is not evidence its models died.
- The probe is idempotent. Re-running a provider overwrites that provider's block; strike counts carry forward so repeated durable failures accumulate.
- Closing the panel mid-probe keeps every provider that already finished and leaves the rest untouched.

### Testing

Unit tests (Vitest, alongside the existing `src/lib/ai/__tests__/`):

- **Response classifier** — each documented status maps to the right `ProbeStatus`, including context-window extraction from the 400 message and the "At most N image(s)" cap parse.
- **Diff** — new / working / gone partitioning across a previous and current probe, including a model that reappears after being gone.
- **Auto-disable** — an enabled model that turns unreachable is removed; an enabled model that turns `slow` is kept; a dead `defaultModel` falls back to the first surviving enabled model; an empty result set removes nothing.
- **Chunk sizing** — cap of 1 yields single-page chunks; cap of 5 with a 2-page document yields one chunk; over-cap input throws rather than truncating.
- **Error classification** — `deadline-exceeded` does not produce the invalid-key message and does not rotate keys.

Manual verification: probe against a live NVIDIA key, confirm the three known-404 models land in Gone, confirm `nemotron-nano-12b-v2-vl` reports an image cap of 1, then extract `DTC Proforma Invoice-1.PDF` end to end with NVIDIA as primary.

## Rollout

1. Ship the three request-path defects. They are independent and unblock NVIDIA immediately for anyone who selects it.
2. Ship the probe and the panel rewrite. No surveyor-visible change until the admin runs a probe and saves.

Existing `ai_config/models` documents stay valid; entries simply carry a stale `estimateCapacity` field that the new code ignores until the next probe rewrites them.

## Open questions

None. Resolved during design:

- NVIDIA is a first-class selectable provider, not a last-resort fallback.
- No hard latency ceiling at upload; the surveyor sees an estimated total before extraction starts.
- Accuracy scoring is out of scope — see Non-goals.
- Dead models auto-disable; enabling stays manual.
