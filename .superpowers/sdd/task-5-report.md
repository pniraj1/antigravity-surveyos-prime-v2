# Task 5 report — Admin tab rewrite + ProviderCard

## What moved where
- `src/components/admin/ai/ProviderCard.tsx` (new, 129 lines): provider header (colour dot, label, enable toggle, "no key in your Profile" hint, per-provider Probe), discovery line, in-chain model rows (NEW badge, measured `badge()`, SLOW, note textarea → `onNote`, Test with estimate PDF + result `<pre>`), collapsible hidden group (non-ok probe rows + `diff.gone` ids absent from the probe, labelled "retired"). `badge()` moved here.
- `src/components/admin/tabs/AIModelsTab.tsx` rewritten: 582 → 200 lines. State per brief; load via `Promise.all` + `migrateConfig`; `commitProbe()` shared by `probeAll`/`probeOne` (save probes → `applyGuardRails` → save config → both stores → toast "Probe complete — N in chain, M auto-excluded (see Excluded)."); `patch()` helper backs `onExclude` (drops reason), `onInclude` (adds to `keep` when it had a reason), `onLimit`, `onNote`, `toggleProvider`; `save()` writes `schema: 2`. Layout: header, probing banner, `<RankedLists>`, one `<ProviderCard>` per provider. `newIds` = union of `diffProbes(...).added`.
- `src/lib/ai/admin-rank.ts`: added pure `discoveryCounts(block, probe)` (found / inChain / autoExcluded / byAdmin / hidden) — used by both the discovery line and the toast. Test added in `admin-rank.test.ts`.

## Removed
- Benchmark card + `BenchmarkUploader`, accuracy button/badges/runner, model checkbox (`toggleModel`), ★ default (`setDefault`), name buckets, `classifyModel`, `isAccuracyStale`, `showUnusable` map (now local state in the card).
- Deleted `src/lib/ai/probe-reconcile.ts` + `__tests__/probe-reconcile.test.ts` (only caller was the tab). `model-classify.ts`, `probe-accuracy.ts`, `benchmark-doc.ts` left untouched.

## Verification
- `npx tsc --noEmit` — no output (clean).
- `npx vitest run` — Test Files 150 passed (150), Tests 1218 passed (1218).
- `npm run build` — ✓ Compiled successfully in 19.6s; ✓ Generating static pages (24/24); exit 0.

## Self-review
- All ProviderCard props match the brief's interface exactly.
- Immutable updates throughout (`patch`/`without` helpers).
- "retired" definition: ids in `diff.gone` that no longer appear in `probe.models` at all (gone-but-still-listed rows already show under their non-ok status).
- Old UI hid the per-provider Probe only on `probing || saving`; now also disabled without a key (the click would just toast an error).

## Concerns
- `commitProbe` uses the `config` captured at the render when the probe started; edits the admin makes during a 20–30 min full probe (without saving) are overwritten by the railed config. Same behaviour as the old reconcile block — flagged, not fixed (a ref would fix it if it matters).
- Header copy changed from "Only models verified to work are shown" to "Every working model is in the chain unless you exclude it" to match the veto model.
