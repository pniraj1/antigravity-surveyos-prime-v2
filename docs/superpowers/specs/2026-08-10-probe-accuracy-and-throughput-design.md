# Probe Accuracy & Throughput — Design

**Date:** 2026-08-10
**Status:** Approved for planning
**Scope:** Admin AI Models panel — probe tiering, real-document accuracy scoring, throughput
**Builds on:** `docs/superpowers/specs/2026-08-10-ai-model-fitness-probe-design.md`

## Problem

The model fitness probe shipped earlier today answers *"can this model work at all?"*. It does not answer *"does this model read **my** documents correctly?"*, and it takes 20–30 minutes to do the first job.

### 1. The probe measures liveness, not fitness for the real workload

`runProviderProbe` sends the synthetic one-page fixture and measures seconds-per-page (`src/lib/ai/probe-runner.ts:390-395`, `images: visionOk ? [fixture] : []` — a single image, always).

The real workload is a multi-page estimate feeding the assessment sheet. Two things the probe therefore cannot tell you:

- **Whether a model extracts correctly.** A fast-wrong model and a slow-right model both report `status: 'ok'`. Measured this session: `nvidia/nemotron-nano-12b-v2-vl` returned in 27s — the fastest NVIDIA model — while copying `rate` into `amount` and losing the 18% GST. `meta/llama-3.2-90b-vision-instruct` took 131s and got it right. The panel ranks the wrong one first.
- **What a real document actually costs.** The probe reports per-page latency. A 5-page estimate chunked at the model's real image cap is roughly `pages ÷ chunk_size × per_page`, which the admin has to compute in their head, and which never exercises several pages batched into one request.

The original spec listed accuracy scoring as a non-goal, on the grounds that a real estimate would ship a named insured's GSTIN, chassis and registration to every probed model on every run. **That decision is reversed here, deliberately and with the exposure accepted** — see "Data protection" below.

### 2. Every model gets the same expensive treatment

There is one probe path for all ~170 catalogue entries. Adding a multi-page real-document extraction to it would turn a 25-minute run into hours, and would spend that time on models the admin would never enable.

### 3. Providers run strictly sequentially

`runFullProbe` loops providers with `await` (`src/lib/ai/probe-runner.ts:454-465`), commented *"Sequential across providers so progress reads clearly and free-tier rate limits are not hit from three directions at once."*

The rate-limit concern does not survive scrutiny: Gemini, Groq and NVIDIA are independent rate-limit domains with their own keys. Pacing is already enforced **per provider** (`PROVIDER_CONCURRENCY`, `PROVIDER_MIN_GAP_MS`). Running them concurrently does not increase pressure on any single provider. Meanwhile Gemini's ~9 req/min pacing — the dominant cost — leaves NVIDIA and Groq idle for the majority of the run.

### 4. Dead models are re-probed at full cost, ahead of working ones

`fetchCatalogue` returns the provider's live list in provider order; nothing reorders it. On NVIDIA, **60 of 100 entries 404** (measured). Those are re-pinged every run in whatever order they appear, so working models resolve late and the admin waits for the graveyard before seeing useful results.

They must keep being re-tested — a provider can restore a model, and the two-strike removal rule in `probe-reconcile.ts` depends on re-testing. The problem is ordering, not the re-testing itself.

### 5. No way to probe one provider

There is a single **Refresh & probe** button (`src/components/admin/tabs/AIModelsTab.tsx:196`) that always does all three. Re-checking NVIDIA after adding a key means sitting through Gemini's 15+ minutes. (The per-provider control at `:226` is `toggleProvider`, which enables/disables a provider for surveyors — unrelated.)

## Goals

- The admin can see which models extract **their** documents correctly, not just which respond.
- Accuracy testing does not make the routine probe unusably slow.
- A full probe finishes materially faster than 20–30 minutes.
- The admin can re-probe one provider without touching the others.

## Non-goals

- **Background / server-side execution.** The probe is client-side `fetch()` from the admin's tab. Making it survive tab closure needs a server-side job runner — a separate architecture change, specced on its own.
- **Automatic model selection.** The probe reports; the admin still ticks and saves. Unchanged from the previous spec.
- **Automatic per-document-type routing.** The classification groups models in the admin panel. It does *not* make the extraction path pick a different model for a licence than for an estimate — that is a routing change touching `buildProvider` and the surveyor's Profile choice, and belongs in its own spec. This one produces the data such a change would need.
- **Changing the automatic depreciation, extraction, or chunking logic.** This spec touches the probe and its panel only.

## Data protection

The benchmark document carries **fake PII** — the admin supplies a specimen estimate with invented vehicle, customer and tax data. That is the intended use and the UI says so.

Two things still hold, both cheap:

1. **The PDF is stored device-local, in IndexedDB.** This is an engineering choice independent of PII: Firebase Storage is currently unused by this app — no `storage.rules` exists and nothing imports `getStorage` — so using it would mean new rules, a new deploy surface, and a new persistence layer to maintain, for no benefit over the IndexedDB layer that already exists.
2. **The upload control states where the document goes**: transmitted in full to every shortlisted model across the enabled providers, on each accuracy run. Plus a one-click **Remove** control. One sentence of UI copy, so that an admin who later reaches for a real estimate does so knowingly.

No compliance-document update is required, because no new real-PII egress path is being created.

## Design

### Two-tier probe

The single probe path splits by cost and by question answered.

| | Tier 1 — Capability | Tier 2 — Accuracy |
|---|---|---|
| **Question** | Can this model work at all? | Does it read my documents correctly? |
| **Scope** | Every catalogue entry (~170) | Shortlist only |
| **Payload** | Synthetic 1-page fixture | Admin's real multi-page PDF |
| **Cost** | ~10–15 min (after throughput fixes) | ~1–3 min per model |
| **Trigger** | "Refresh & probe" (all or one provider) | "Run accuracy test" — separate button |

**Tier 1 is exactly today's probe**, unchanged in behaviour: ping with the real 16384-token budget, then vision / image-cap / per-page latency on survivors. It keeps writing `ProbeResult` as it does now.

**Tier 2 runs only on models the admin has ticked** (i.e. present in `ai_config/models` for that provider). That is the natural shortlist — the admin has already said "these are my candidates" — and it means accuracy data is never computed for a model that would not be used. Tier 2 is a **separate, explicitly-triggered action**, never automatic, because it costs real tokens against a real document.

Tier 2 runs the extraction through the **same `extractDocument` path a surveyor uses**, via the existing `runModelTest` override mechanism (`src/lib/ai/service.ts`), so it exercises the real chunking, the real prompts, and the real per-provider image caps. It is not a parallel implementation of extraction.

### Scoring

The admin supplies the ground truth once, at upload:

- **Expected grand total** (required) — printed on the document.
- **Expected line-item count** (optional).

**Which extracted field is the grand total.** `runModelTest` returns `{ ok, ms, data }` where `data` is the extraction result (`ModelTestResult`, `src/lib/ai/service.ts:865`). For `docKey: 'estimate'` the document-level total is **`data.gross_amount`** — the root-level field in the estimate schema (`src/lib/ai/prompts.ts:176`).

Do **not** read `data.total_amount`. That name exists only *inside* each line item of `spare_parts` / `labour_items` / `painting_items`, where it means that row's amount including GST. It is a trap: it exists, it is numeric, and it is wrong.

The extracted item count is `spare_parts.length + labour_items.length + painting_items.length`.

Tier 2 then scores objectively:

```
totalDeltaPct = |extractedTotal - expectedTotal| / expectedTotal × 100
```

| verdict | condition |
|---|---|
| `exact` | `totalDeltaPct <= 0.5` |
| `close` | `totalDeltaPct <= 2` |
| `wrong` | `totalDeltaPct > 2`, or no total could be extracted |
| `failed` | the extraction threw |

The item count, when supplied, is reported alongside but does not change the verdict — a model can merge two rows and still total correctly, which is worth showing without being fatal.

This banding is what catches the failure mode observed this session: a model that drops GST on the amount column lands ~15% off, firmly in `wrong`, while a model with a rounding difference stays `exact`.

### Benchmark document storage

New IndexedDB object store `benchmarkDoc`, added at **schema version 7** (currently 6, `src/lib/storage/indexeddb.ts:61`), following the established `oldVersion < N` upgrade pattern. Single-slot — one benchmark document at a time, keyed `'current'`.

```ts
interface BenchmarkDoc {
  id: 'current';
  fileName: string;
  mimeType: string;
  blob: Blob;
  pageCount: number;
  expectedTotal: number;
  expectedItemCount: number | null;
  addedAt: number;
  addedBy: string;
}
```

`pageCount` is derived at upload time via the existing `loadPdf()` helper (`src/lib/photos/pdf-to-images.ts`), which already returns `numPages` and is the same parser the extraction path uses. It is stored for display only — the extraction re-reads the blob itself.

The database is per-user (`surveyos-v2-${uid}`) and only opens after login, which is already true when the admin panel renders.

### Accuracy results

Stored beside the existing probe results in `ai_config/model_probes`, on a new sibling map so a Tier 1 re-probe never destroys Tier 2 data and vice versa:

```ts
interface AccuracyResult {
  modelId: string;
  verdict: 'exact' | 'close' | 'wrong' | 'failed';
  extractedTotal: number | null;
  expectedTotal: number;
  totalDeltaPct: number | null;
  extractedItemCount: number | null;
  expectedItemCount: number | null;
  /** Whole-document wall time — what a surveyor actually waits. */
  ms: number;
  pages: number;
  /** Identifies which benchmark produced this, so stale results are visible. */
  benchmarkFileName: string;
  ranAt: number;
  error: string | null;
}
```

`ProviderProbe` gains `accuracy: Record<string, AccuracyResult>`. When the admin replaces the benchmark document, existing results are **kept but marked stale** in the UI (their `benchmarkFileName` no longer matches), rather than silently deleted — the admin can see what changed and re-run deliberately.

### Model classification — the clutter fix

A flat list ranked by speed asks the admin to hold the whole trade-off in their head. But the app extracts two genuinely different kinds of document, with different demands:

| | Small documents | Large documents |
|---|---|---|
| Examples | Driving licence, RC, policy, claim form | Repair estimate, final bill |
| Shape | One page, a handful of fields | Multi-page, dense tables |
| Usually | A photo or scan → **needs vision** | Digital PDF (text layer) *or* scan |
| What matters | Speed — a surveyor is waiting | Table accuracy over many pages |

So every working model is classified into these two capabilities, derived from what the probe already measures:

```ts
smallDocs = status === 'ok' && vision && msPerPage !== null && msPerPage <= SMALL_DOC_MAX_MS
largeDocs = status === 'ok' && accuracy?.verdict === 'exact' | 'close'
```

`SMALL_DOC_MAX_MS = 20_000`. A model taking longer than 20s to read a driving licence is not usable for that job however accurate it is, because the surveyor is sitting there.

The two are **not nested** and a model can be in both, one, or neither:

- A text-only model fails `smallDocs` (a scanned licence needs vision) but can pass `largeDocs` on a digitally-born estimate via the text layer.
- `nvidia/nemotron-nano-12b-v2-vl` — 27s/page, dropped GST on the amount column — fails both: too slow for a licence, wrong on an estimate.
- A fast accurate vision model passes both.

`largeDocs` requires Tier 2 to have run. Until it has, a model is reported **untested for large documents** rather than assumed good — the honest default, and the thing that makes the shortlist worth running.

Classification is **derived at render time**, not stored. It is a pure function of the probe and accuracy results already persisted, so there is no schema change, nothing to migrate, and no possibility of a stored category drifting out of date with the measurements it came from.

### Throughput

**Providers run concurrently.** `runFullProbe` replaces its sequential `for … await` with `Promise.all` across providers. Per-provider concurrency and pacing are untouched, so no provider sees more pressure than today. Progress reporting becomes per-provider rather than a single line — each provider block shows its own `12 / 39` while running.

`onProviderComplete` persistence still fires per provider as each finishes, so partial results survive a closed tab exactly as now. Because completions are no longer ordered, the persist callback must merge into the latest state rather than overwrite a captured snapshot — otherwise two providers finishing close together can lose one another's results.

**Dead models sort last.** `fetchCatalogue` results are ordered before probing: entries whose previous result was `ok` first, never-probed entries next, previously-failed entries last. Everything is still probed; working models simply resolve first. On NVIDIA that moves 60 known-404s behind the 28 that work.

**Per-provider probing.** Each provider block gets its own **Probe** button running Tier 1 for that provider alone. The existing **Refresh & probe** stays as the all-providers action. Both share one code path — the all-providers version is the per-provider one run across three.

### Panel

- Header keeps **Refresh & probe** (all) and **Save Config**.
- Each provider block gains its own **Probe** button and its own progress line.
- A **Benchmark document** area: the current file name, page count, expected total, a **Replace** and a **Remove** control, and the plain-language exposure warning. Empty state explains what it is for and recommends a redacted document.
- Each enabled model row gains an accuracy badge once Tier 2 has run: `exact · 62,392.50 · 4m 10s`, or `wrong · 53,120.00 (−14.9%)`, or `not tested`.
- A **Run accuracy test** button per provider block, enabled only when a benchmark document exists and at least one model is ticked. Disabled with an explanatory tooltip otherwise.
- **Working models are grouped by capability**, not listed flat:
  - **Good for small documents** — licence, RC, policy
  - **Good for estimates & multi-page bills**
  - **Limited** — passed Tier 1 but too slow for small documents and untested or `wrong` on large ones
  A model qualifying for both appears under both headings; the grouping is a lens on one list, not a partition of it. Within each group, sorting stays fastest-first, except that a `wrong` accuracy verdict sorts below every untested model — a model known to extract incorrectly should never sit at the top.

## Error handling

- **No benchmark document** → Tier 2 controls disabled with a tooltip. Tier 1 unaffected.
- **Extraction throws** → `verdict: 'failed'`, `error` recorded and shown in the badge tooltip. Other models continue; one bad model never aborts the run.
- **Non-numeric or absent extracted total** → `verdict: 'wrong'`, `extractedTotal: null`. Not treated as a crash.
- **A provider's Tier 1 fails mid-run under `Promise.all`** → that provider records its `error` and keeps its previous results, exactly as today. The other providers are unaffected; one rejected promise must not abort the others, so per-provider failures are caught inside each branch rather than allowed to reject the outer `Promise.all`.
- **`expectedTotal` of 0 or negative** → rejected at upload with an inline message; it would make `totalDeltaPct` undefined.

## Testing

Pure-logic units get unit tests; the network layer does not.

- **Scoring** (`scoreAccuracy`): each verdict band at its boundaries (0.5%, 2%), a null extracted total → `wrong`, a thrown extraction → `failed`, item-count mismatch does not change the verdict, and `expectedTotal <= 0` is rejected.
- **Total-field selection**: given an extraction result carrying both a root `gross_amount` and line items each carrying `total_amount`, the score reads `gross_amount`. This test exists specifically to pin the trap described above.
- **Catalogue ordering**: previously-`ok` first, never-probed next, previously-failed last; stable within each group; an empty previous probe leaves order untouched.
- **Merge-on-complete**: two providers completing out of order both survive in the persisted document — the regression that ordered sequential completion used to hide.
- **Staleness**: an `AccuracyResult` whose `benchmarkFileName` differs from the stored benchmark is reported stale.
- **Shortlist selection**: Tier 2 targets exactly the ticked models for that provider, and no others.
- **Classification** (`classifyModel`): a fast vision model with no accuracy result is `smallDocs` only; a text-only model with an `exact` verdict is `largeDocs` only; a 27s/page model with a `wrong` verdict is neither; a fast accurate vision model is both; a model at exactly `SMALL_DOC_MAX_MS` still qualifies; a model with `msPerPage: null` (cutoff exceeded) is not `smallDocs`.
- **Existing suites must stay green** — `probe-classify`, `probe-diff`, `probe-reconcile`, `probe-runner`, `probe-types`. Tier 1 behaviour is unchanged and its tests must not need editing; if one does, the change was larger than intended.

Manual verification: upload a real multi-page estimate, run Tier 1 on NVIDIA alone, tick two models, run accuracy, confirm the verdicts match a hand check of the same PDF through the existing "Test with estimate PDF" control.

## Rollout

Additive and backward-compatible. Existing `ai_config/model_probes` documents lack the `accuracy` map and read as "not tested". The IndexedDB upgrade to v7 adds a store without touching existing ones. No stored claim or config is migrated. Tier 1 behaviour is unchanged, so an admin who never uploads a benchmark document sees only the speed improvements and the new per-provider buttons.

## Open questions

None. Resolved during design:

- Benchmark document is admin-supplied with fake PII, stored device-local in IndexedDB.
- Ground truth is an admin-entered expected grand total, not a heuristic or a reference model.
- Tier 2 shortlist is the admin's ticked models.
- Models are classified into small-document and large-document capability, derived at render time rather than stored.
- Background execution and automatic per-document-type routing are out of scope.
