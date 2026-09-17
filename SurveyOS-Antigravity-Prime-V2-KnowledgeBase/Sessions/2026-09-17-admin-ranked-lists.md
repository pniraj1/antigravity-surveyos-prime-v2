# Session: 2026-09-17 (Claude) — Admin ranked lists and veto (AI fallback Phase 2-C)

## What changed

The admin AI Models tab stops being a tick-list. Every model the probe
finds working is in the surveyor's chain unless the admin **excludes** it;
guard rails auto-exclude obviously unsuitable ids; the admin edits daily
limits; and the tab shows the three ranked lists the loop actually uses.

Spec: `docs/superpowers/specs/2026-09-17-admin-ranked-lists-design.md`
Plan: `docs/superpowers/plans/2026-09-17-admin-ranked-lists.md`
Ledger: `.superpowers/sdd/progress.md` § Admin ranked lists
Commits: e181d862..96098c6f on `main`. Deployed (hosting only) 2026-09-17.

### Modules
- `src/lib/ai/models-config.ts` — schema 2: `ProviderConfig { enabled,
  excluded, excludedReason, keep, limits, notes }` + deprecated
  `models`/`defaultModel` (mirror, see rollout). `migrateConfig(raw, probes)`
  (pure; applies guard rails when probes known), `legacyModelsFor`,
  `FALLBACK_MODELS`, `emptyProviderConfig`. `DEPRECATED_*` maps moved here.
- `src/lib/ai/guard-rails.ts` — `guardRailReason`: `slow` → "too slow
  (>90 s/page)"; id matching `preview|exp|transcribe|robotics|tts|image|
  embedding|audio|live|omni` (word-bounded) → "not a document model".
  `applyGuardRails` respects `keep`.
- `src/lib/ai/pool.ts` — `poolFromProbes(config, probes, keys)`: ok −
  excluded − retired; no/errored probe → `FALLBACK_MODELS`. `limitOfFor`.
  Used by the request path (`service.ts buildPool`) AND the admin lists.
- `src/stores/probes-store.ts` + `useAIConfig` — surveyors load
  `ai_config/model_probes` (already readable by signed-in users).
- `src/lib/ai/rank.ts` — `RankOptions.limitOf`.
- `src/lib/ai/admin-rank.ts` — `rankedLists` (three jobs, limit-0 models
  appended with "· off"), `lastEligibleFor`, `discoveryCounts`.
- `src/components/admin/ai/RankedLists.tsx`, `ProviderCard.tsx`;
  `AIModelsTab.tsx` rewritten (200 lines). Removed: checkbox, ★ default,
  small/large buckets, accuracy test + benchmark card, `probe-reconcile.ts`.

### Rules
- Chain = probe-ok − excluded − retired, per enabled provider with a key.
- Guard rails run at admin probe time and inside `migrateConfig`;
  "Include" adds the id to `keep` so it is never re-excluded.
- `limits[id]` overrides the quota table; 0 = off (row stays visible).
- Exclude / limit-0 refused on the last eligible model of any job.
- Admin tab refuses Probe/Save when the config failed to load
  (`updatedBy: 'fallback'`); a *missing* doc (`'none'`) is allowed.

## Rollout order (important)
1. Deploy hosting. 2. Wait for surveyors' tabs to refresh (or tell them).
3. Admin → **Save** (persists the migrated veto list, schema 2, and the
   legacy `models` mirror). 4. Admin → **Probe all** → review "Excluded".
Why: a surveyor on a *stale* tab after the admin's first save reads the
legacy `models` field — the mirror keeps it equal to the in-chain list so
they keep working; before this shim it was empty → "No AI provider".

## Live check L11 (pending, owner)
Admin → Probe all. Expect the Excluded group to list `gemini-flash-latest`
(slow), `gemma-4-31b-it` (slow), `gemini-3.5-transcribe`,
`gemini-robotics-er-2-preview`, `gemini-3-flash-preview`,
`gemini-3.1-flash-lite-preview` with reasons. "Estimates & bills" starts
with a Flash model, "Licence · RC · policy" with a Flash-Lite. Upload an
RC as a surveyor → first call = the Licence list's first row.

## Carried minors / follow-ups
- (fixed same day) `other` tier for non-Google non-gemma models, after gemma.
- Migration labels old un-ticked models "excluded by you" — owner Included
  2.5-flash, 3.8-flash, flash-lite-latest, 3.1-flash-lite by hand.
- `AIControls.tsx` surveyor pickers still render the legacy mirror list and
  do nothing — remove in 2-D with `resolveEnabledModel`, `models`,
  `defaultModel`.
- `probe.error` hides the whole ProviderCard (pre-existing).
- `legacyModelsFor` order = probe map order, not ranked.
- Disabling a provider bypasses the last-model guard (red "No model" line
  shows in the list instead).
- Fallback model notes blank; groq/nvidia fallback = one model each.

## Tests
`npx vitest run` 1222 passing (150 files); `npx tsc --noEmit` clean;
functions tests green; `npm run build` OK.
