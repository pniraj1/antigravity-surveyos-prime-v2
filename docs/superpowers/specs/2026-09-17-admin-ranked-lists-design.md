# Admin ranked lists and veto (AI fallback Phase 2-C)

Date: 2026-09-17 · Status: design approved in brainstorm, awaiting spec review
Follows: `2026-09-15-ai-fallback-and-job-routing-design.md` §8 (admin tab),
`2026-09-16-quota-aware-ranking-design.md` (tiers, budgets)

## Problem

The admin AI Models tab is still an allow-list: after a probe the admin
ticks models one by one, sets a ★ default and reads name-based buckets
("good for small documents"). Since Phase 2-A the ranker decides the
order by job, tier and budget — the tab shows none of that, the ticks
are the only thing that reaches surveyors, and a new model waits for a
click. The owner's decisions (2026-09-17): **veto with guard rails** —
every probe-ok model is in the chain unless the admin excludes it, and
the probe auto-excludes obviously wrong ids; **admin-editable daily
limits**; no accuracy benchmark.

## Goals

1. Admin sees the exact order surveyors get, per job, with the reason.
2. A new model enters the chain after one probe, at its ranked place, with
   no click; obviously unsuitable ids are excluded automatically.
3. One action per model: Exclude / Include. One number per model: calls
   per day per key.
4. Zero extra AI calls; the probe stays the only spender.

Non-goals: models.dev deprecation feed and NEW-model discovery summary
beyond what the probe diff already knows (2-B); Profile provider rows and
removing the surveyor pickers (2-D); accuracy benchmark (rejected).

## Design

### 1. Config schema — `src/lib/ai/models-config.ts`

```ts
export interface ProviderConfig {
  enabled: boolean;
  /** Admin veto. Chain = probe-ok − excluded. */
  excluded: string[];
  /** Why a model was auto-excluded by a guard rail; absent = admin's choice. */
  excludedReason: Record<string, string>;
  /** Models the admin re-included after a guard rail — never auto-excluded again. */
  keep: string[];
  /** Calls per day per key; overrides quota.dailyLimit. */
  limits: Record<string, number>;
  /** Admin free-text per model (was ModelEntry.note). */
  notes: Record<string, string>;
}
```
`models`, `defaultModel` and `ModelEntry.note` are removed from the
stored shape. `AIModelsConfig.defaultProvider` stays (legacy fallback
path). `FALLBACK_AI_MODELS_CONFIG` keeps a built-in `fallbackModels`
list per provider (id, vision, imageCap) used only when the probes doc
has never been written.

**Migration** (`migrateConfig(stored, probes)`, pure, run on every load
until the doc carries `schema: 2`): for each provider, `models` non-empty
→ `excluded = probeOk(p) − models.map(id)`; `models` empty or missing →
`excluded = []`; `notes` from each `ModelEntry.note`; `keep = []`,
`limits = {}`, `excludedReason = {}`. The admin tab saves the migrated doc
with `schema: 2` on its first save; the surveyor path migrates in memory
only. Reading a `schema: 2` doc is a no-op.

### 2. Pool — `src/lib/ai/pool.ts` (new, pure) and `service.ts`

```ts
export function poolFromProbes(
  config: AIModelsConfig, probes: ModelProbes | null,
  keysByProvider: Record<ProviderId, string[]>,
): PoolEntry[];
```
For each enabled provider with ≥ 1 key: models with `probes[p].models[id].status === 'ok'`, minus `excluded`, minus retired ids
(`DEPRECATED_*`), each carrying `vision`, `imageCap`, `ctxWindow`,
`msPerPage` from the probe. `probes === null` (never probed / read
failed) → the provider's `fallbackModels`. `buildPool` in `service.ts`
becomes a thin caller: keys from the profile, probes from a new
`useProbesStore` loaded next to `useAIConfig` (surveyors already have
read access to `ai_config/model_probes`). The same function feeds the
admin tab, so the admin sees the surveyor's chain by construction.

### 3. Guard rails — `src/lib/ai/guard-rails.ts` (new, pure)

```ts
export function guardRailReason(provider: ProviderId, r: ProbeResult): string | null;
```
- `r.slow` → "too slow (>90 s/page)".
- id matches `/preview|-exp|transcribe|robotics|tts|image|embedding|audio|live|omni/i` (word-bounded so `nemotron-3-nano` and `gemma` survive)
  → "not a document model".
- otherwise `null`. Text-only models are not excluded (the `text` job
  uses them); the ranker's vision filter keeps them off documents.

Applied by the **admin probe** only (`applyGuardRails(config, probes)`,
pure): every ok model with a reason and not in `keep` → added to
`excluded` with `excludedReason`. Admin "Include" on an auto-excluded
model removes it from `excluded`/`excludedReason` and adds it to `keep`.

### 4. Ranked lists — admin tab

Split `src/components/admin/tabs/AIModelsTab.tsx` (582 lines) into
`AIModelsTab.tsx` (state, load/save/probe, ≈200 lines),
`admin/ai/ProviderCard.tsx` (discovery line, key, probe buttons, hidden
groups, note), `admin/ai/RankedLists.tsx` (the three lists).

- **Discovery line** per provider from the probe diff: "39 found · 13 in
  chain · 2 NEW · 4 auto-excluded · 3 excluded by you · 17 not served /
  paid / retired (hidden)". Hidden groups expand.
- **Three lists** — Estimates & bills (`heavy`, `pagesNeeded` 5),
  Licence · RC · policy (`light`, 1), Letters & text (`text`, 1) — each
  `rankModels(job, ['x'] or [], poolFromProbes(config, probes, allKeys),
  { health: createHealth(null), pagesNeeded, limitOf })` where `allKeys`
  gives every enabled provider one placeholder key. Rows: rank · model
  (NEW badge) · tier · **limit/day** (number input → `limits[id]`; blank
  = table default, shown greyed) · s/page · "via proxy" · reason (tier +
  budget + speed in words, e.g. "Flash tier · 20/day · 3 s/page") ·
  **Exclude** button · note. Excluded models appear in a collapsed
  "Excluded" group under each list with an **Include** button and the
  reason.
- Exclude is refused when the model is the last eligible for any job:
  "Licence · RC · policy would have no model left."
- Removed from the UI: per-model checkbox, ★ default, the
  small/large/limited buckets, "Run accuracy test" (code kept, button
  hidden). Kept: Probe all, per-provider Probe, "Test with estimate
  PDF", provider on/off, last-probed nudge, benchmark uploader (hidden
  with the accuracy button).
- Save writes `schema: 2`.

### 5. Ranker + quota hook-up

`RankOptions.limitOf?: (provider: ProviderId, id: string) => number`;
default `dailyLimit`. `service.ts` builds `limitOf` as
`config.providers[p].limits[id] ?? dailyLimit(p, id)`; the admin lists
use the same. `quota.ts` unchanged. A limit of `0` means "never eligible"
(same as Pro today) — the UI labels it "off".

### 6. Errors and edge cases

- Probes doc unreadable on a surveyor device → `fallbackModels` chain;
  console warning once. No toast.
- Admin excludes everything for a job → refused at the click (§4).
- A model in `excluded` that a later probe reports gone → stays in
  `excluded` (harmless, hidden); shown in the hidden group as "retired".
- `limits[id]` non-numeric or negative → ignored, default used, input
  shows red.
- Legacy master-config path (`ai_config/routing`, no profile keys) is
  untouched.

### 7. Testing

- `guard-rails.test.ts`: each pattern; slow; text-only not excluded;
  `keep` respected by `applyGuardRails`.
- `models-config` migration tests: non-empty `models` → complement;
  empty; already `schema: 2`; notes carried.
- `pool.test.ts`: ok − excluded − retired; provider without key skipped;
  probes null → fallback; probe metadata carried into `PoolEntry`.
- `rank.test.ts`: `limitOf` override changes tier eligibility (limit 0)
  and budget order.
- Admin: `RankedLists` render test (`renderToStaticMarkup`) — three
  lists in the loop's order; Exclude disabled on the last eligible model;
  excluded group shows the reason.
- Live: L11 — Admin → Probe all → the auto-excluded group lists
  `gemini-flash-latest` (slow), `gemini-3.5-transcribe`,
  `gemini-robotics-er-2-preview`, `gemini-3-flash-preview`,
  `gemini-3.1-flash-lite-preview`; Estimates list starts with a Flash
  model, Licence list with a Flash-Lite; upload an RC as a surveyor →
  first call matches the Licence list's first row.

## Out of scope / later
models.dev deprecation and richer NEW detection (2-B); Profile rows (2-D);
per-surveyor remaining-budget view (ledgers are per device).
