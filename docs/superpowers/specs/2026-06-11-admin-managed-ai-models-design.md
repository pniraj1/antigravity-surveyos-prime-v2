# Admin-Managed AI Models — Design Spec

**Date:** 2026-06-11
**Status:** Approved (design) — pending implementation plan
**Author:** Brainstormed with admin/service-provider

## Problem

Model lists and defaults are hardcoded in `src/lib/ai/service.ts` (`PROVIDER_MODELS`, `CURRENT_MODELS`). When a provider releases a new model or retires an old one, the service provider (admin) must edit code and redeploy via Claude Code. This is slow and error-prone:

- The Gemini list is a generation behind (missing `gemini-3.5-flash`, `gemini-3.1-flash-lite`); all three listed models still work but are not the latest.
- NVIDIA exposes ~120 live models, but the app curates only 2 — **and** NVIDIA cannot even be selected: `ProviderToggle` in `src/components/ai/AIControls.tsx` renders only Gemini + Groq buttons, so NVIDIA only ever runs as a silent last-resort fallback.
- The admin has no way to tell, per model, whether it can handle a real **multi-page estimate PDF** (the input the Assessment tab depends on).

## Goals

1. Admin manages the available models per provider from the Admin portal — no code change, no redeploy.
2. New models surface automatically (auto-discovery); obsolete ones can be removed instantly for all surveyors.
3. NVIDIA becomes a first-class, selectable provider; admin can enable/disable whole providers.
4. Admin gets per-model decision-aid info (capability badges + free-text notes) and can **empirically test** a model against a sample estimate PDF before enabling it.

## Non-Goals

- Managing API **keys** through this system. Keys stay per-surveyor (BYO key) in the profile; this system manages *which models*, never the keys.
- Per-surveyor custom model IDs / overrides. Surveyors choose only from the admin-curated subset.
- Changing the runtime extraction/reconciliation pipeline behavior beyond adding a model/provider override path for testing.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Keeping the list current | **Auto-discover + admin curate** (hybrid) |
| Surveyor control | Admin enables a subset per provider; **surveyors pick among that subset**; admin can deselect obsolete models |
| Provider scope | **All 3** (Gemini, Groq, NVIDIA), with provider **on/off** + the NVIDIA selectability fix |
| Discovery key | **Admin's own keys** (from the admin's surveyor profile); surveyors still use their own keys at runtime |
| Decision-aid source | **Auto badges + admin free-text notes** |
| Live test tool | **Yes — included in v1** |

## Architecture

### A. Config storage — Firestore `ai_config/models`

A single admin-writable, world-readable document is the source of truth. New doc (not the existing `ai_config/routing`) to avoid disturbing the working fallback path.

```
ai_config/models = {
  updatedAt: Timestamp,
  updatedBy: string,            // admin uid/email
  defaultProvider: 'gemini' | 'groq' | 'nvidia',
  providers: {
    gemini: {
      enabled: boolean,
      defaultModel: string,     // must be one of models[].id
      models: ModelEntry[]      // curated, admin-enabled subset
    },
    groq:   { enabled, defaultModel, models[] },
    nvidia: { enabled, defaultModel, models[] }
  }
}

ModelEntry = {
  id: string,                   // exact provider model id
  label: string,                // human label
  note: string,                 // admin free-text guidance (decision aid)
  ctxWindow: number | null,     // auto-discovered input token limit
  vision: boolean,              // auto-discovered multimodal support
  imageCap: number | null,      // provider-level cap (Groq=5, others=null)
  estimateCapacity: string      // computed verdict, e.g. "handles 6+ page scans"
}
```

The hardcoded `PROVIDER_MODELS` / `CURRENT_MODELS` remain in code **only as an offline fallback** when Firestore is unreachable or the doc is absent.

### B. Discovery layer (live model lists)

Three fetchers in `src/lib/ai/service.ts`, each called with the admin's key for that provider:

- **Gemini** — `fetchAvailableGeminiModels(key)` already exists (`GET …/v1beta/models`). Returns `inputTokenLimit`, `supportedGenerationMethods`, display name → feeds `ctxWindow` and `vision`.
- **NVIDIA** — new `fetchAvailableNvidiaModels(key)`: `GET https://integrate.api.nvidia.com/v1/models`. Returns sparse metadata (id only). Show all, with a "likely vision-capable" hint via name heuristic (`vision|vl|llama-4|gemma-3|phi-3-vision|nemotron…`).
- **Groq** — new `fetchAvailableGroqModels(key)`: `GET https://api.groq.com/openai/v1/models`. Sparse metadata; same heuristic approach.

If the admin has no key saved for a provider, the card shows a clear "Add a {provider} key in your profile to discover models" message instead of a list.

### C. Admin portal — new "AI Models" tab

Added to `AdminDashboard.tsx` beside Surveyors / Signups / Payments / Dev Notes (admin-gated by `profile.isAdmin`). One card per provider, each with:

- **Provider on/off** switch (writes `providers.<p>.enabled`).
- **"Refresh live list"** button — runs discovery with the admin's key.
- A **searchable list** of live models; per row: **checkbox** to expose to surveyors, **radio** to mark default, **badges** (ctx window, vision, image cap, estimate capacity), and an editable **note** field.
- **"Test with sample estimate PDF"** action (see section G).
- **Save** → writes `ai_config/models`.

### D. Surveyor side (consumes the config)

- New loader hook `useAIConfig` reads `ai_config/models` on app start into a small store (cached; falls back to hardcoded constants if unavailable).
- `ProviderToggle` renders **only enabled providers** (now including NVIDIA) instead of the hardcoded Gemini+Groq pair.
- `ModelSelector` lists the **curated models from config** instead of hardcoded `PROVIDER_MODELS`. For Gemini it may still merge with the per-user live fetch, but the curated set is the menu.
- Resolver functions in `service.ts` (`resolveGeminiModel` / `resolveGroqModel` / `resolveNvidiaModel`) validate a surveyor's saved model against the enabled set; if it was disabled, fall back to `providers.<p>.defaultModel` (then hardcoded `CURRENT_MODELS` as last resort) with a toast.

### E. Migration / safety

- First run with no Firestore doc → app uses hardcoded fallback; admin clicks "Refresh + Save" once to seed the doc.
- Keep the existing `DEPRECATED_GEMINI_MODELS` / `DEPRECATED_GROQ_MODELS` migration maps.
- Firestore rule: only `isAdmin` may write `ai_config/models`; all authenticated users may read.

### F. Decision-aid layer (per model)

**Auto badges** (derived from discovery, zero maintenance):
- **Context window** — `inputTokenLimit` (Gemini) or provider default.
- **Vision/multimodal** — yes/no.
- **Image cap** — provider-level: Groq = 5 images + 8192 output tokens; NVIDIA/Gemini = uncapped.
- **Estimate capacity** — a computed verdict combining context window **and** image cap, framed for the estimate→Assessment use case. Examples:
  - Gemini 3.5 Flash → "vision · ~1M ctx · handles 6+ page scanned estimates"
  - Groq Scout → "vision · max 5 images · not ideal for 6-page scans"

**Admin note** — free-text per enabled model for arbitrary guidance.

### G. Live test tool (v1)

A **"Test with sample estimate PDF"** action per provider card:

- Admin uploads a 3/6-page estimate PDF (in-memory; nothing stored).
- Runs it through the **existing extraction pipeline**, forced to the selected provider+model, using the admin's key.
- Displays **pass/fail**, **time taken**, and the **extracted line-items JSON** — the real Assessment-tab output — so the admin sees actual quality before enabling.
- Requires a small override path: a `runModelTest(provider, model, key, file)` wrapper so the extraction call targets a specific provider/model instead of reading the surveyor profile. `callAIGateway` / the processor get an optional `{ providerOverride, modelOverride, keyOverride }` parameter.

## Affected code

| File | Change |
|---|---|
| `src/lib/ai/service.ts` | Add NVIDIA/Groq discovery fetchers; config-aware resolvers + fallback; provider/model override param on `callAIGateway`; `runModelTest` helper |
| `src/components/ai/AIControls.tsx` | `ProviderToggle` renders enabled providers from config (incl. NVIDIA); `ModelSelector` reads curated config list |
| `src/components/admin/AdminDashboard.tsx` | Add "AI Models" tab |
| `src/components/admin/tabs/AIModelsTab.tsx` (new) | The admin curation UI: cards, discovery, badges, notes, save, live test |
| `src/hooks/useAIConfig.ts` (new) | Load + cache `ai_config/models` |
| `src/stores/…` | Small store/state for the loaded AI config |
| `firestore.rules` | `ai_config/models` — admin write, authenticated read |
| Extraction pipeline (`useAIExtraction` / `processor.ts`) | Accept provider/model/key override for the test path |

## Testing

- **Unit:** NVIDIA/Groq discovery filters + vision heuristic; estimate-capacity computation (token + image-cap matrix); config→selector mapping; "saved model no longer enabled → fallback to default" resolution.
- **Integration:** admin save writes correct Firestore shape; surveyor app reads enabled providers/models; disabled provider hidden from toggle.
- **Manual/E2E:** live test tool against a real 3-page and 6-page estimate PDF for each enabled model; verify Groq 5-image cap surfaces as a failure/warning on 6-page scans.
- Maintain ≥80% coverage on new non-UI logic.

## Open questions / risks

- NVIDIA/Groq `/models` endpoints give sparse metadata, so `ctxWindow`/`vision` for those providers rely on heuristics or provider defaults rather than authoritative values. The live test tool is the mitigation — empirical truth over metadata.
- The estimate-capacity verdict is a heuristic, not a guarantee; the note field + live test cover the gaps.
