# Final fix wave 2-A — quota-aware ranking

## F1 — budget is calls still needed, updated per chunk

- `src/lib/ai/processor.ts:410` — kept the initial `session.pagesTotal = totalPages` (first-ranking budget before any chunk runs).
- `src/lib/ai/processor.ts:483` — added, right before the normal per-chunk gateway call: `session.pagesTotal = Math.ceil((totalPages - i) / CHUNK_SIZE);` (calls still needed from this chunk on).
- `src/lib/ai/processor.ts:619` — the 413 one-page-at-a-time fallback loop now sets `session.pagesTotal = (chunkImages.length - p) + Math.ceil((totalPages - currentBatchEnd) / CHUNK_SIZE);` per page.
- `src/lib/ai/service.ts:469` — `GatewaySession.pagesTotal` doc comment updated to "calls this document still needs (updated per chunk)".

Tests:
- `src/lib/ai/__tests__/processor-flow.test.ts` — capture `pagesTotal` at call time (a mutable session object made reading it off `mock.calls` after the fact show only the final value) into `pagesTotalAtCall`; asserts `[3, 2, 1]` across the 3 clean-read calls.
- `src/lib/ai/__tests__/fallback-loop.test.ts` (`quota-aware order`) — new test `F1: budget is calls still needed...`: key `g1` with 2 Flash calls left on `gemini-3.5-flash`, 0 on `gemini-2.5-flash`; `s.pagesTotal = 2`, call heavy, then `s.pagesTotal = 1`, call heavy again on the same session — both calls land on `gemini-3.5-flash` with key `g1` (no mid-document switch).

## F2 — Infinity budget ties, not wins

- `src/lib/ai/rank.ts:101` — added `budgetCmp(a, b)`: returns `0` when either side is `Infinity`, else `cmp(b, a)` (desc). The heavy comparator now uses `budgetCmp(best.get(a.model.id)!, best.get(b.model.id)!)` in place of the raw `cmp`.

Test:
- `src/lib/ai/__tests__/rank.test.ts` — new test `F2: an unlimited budget ties with the fullest inside a tier`: pool `[groq llama-3.2-90b-vision-preview (untested), gemini-3.5-flash-lite (exact)]` → Flash-Lite ranks first (budget ties inside the lite tier, verdict breaks the tie).

## F3 — quota toasts fire only when a key is truly spent

- `src/lib/ai/service.ts:654` — `spentOut(e, k)` now checks `health.remaining(...) === 0` instead of `< pagesNeeded`. Used by both the day-limit toast (`chain.length === 0 && ...`) and the Flash-nudge condition. The ranker (`rankModels`, called via `pagesNeeded`) is unchanged — eligibility still drops a key that can't cover the document; only the *messaging* predicate changed.

Tests:
- `src/lib/ai/__tests__/fallback-loop.test.ts` — new test `F3: a 25-page doc on a fresh 20/day key is not "spent out"`: config limited to the two Flash models, `s.pagesTotal = 25`, fresh keys → `AllProvidersBusyError`, neither `toast.error` ("free limit is used up") nor `toast.info` ("Flash quota") fires.
- Updated the pre-existing test `heavy: when every Flash key is below the page count, Flash-Lite leads and the surveyor is told once` to spend the full 20 calls (was 18) so it still exercises the nudge under the new "truly spent" semantics — 18/20 no longer counts as spent, so the old fixture would have silently stopped nudging.

## F4 — `health.ts` duplicated `isDead` helper

- `src/lib/ai/health.ts` — one `isDead(hash, model)` closure defined at the top of `createHealth`; `isDeadToday` now delegates to it (`return isDead(hash, model);`) instead of repeating the same two lines. `rest`/`remaining` already called the closure form. No behaviour change — existing tests cover it, all still pass.

## F5 — `gap-fill.ts` redundant cast

- `src/lib/ai/gap-fill.ts:46` — `const s = input.session as { pagesTotal?: number } | undefined;` → `const s = input.session;` (`GatewaySession` already declares `pagesTotal?: number`).

## F6 — `ProviderHealthBadge` no longer names the surveyor's saved model

- `src/components/ai/AIControls.tsx` — `ProviderHealthBadge` no longer reads `profile.geminiModel`/`nvidiaModel`/`groqModel`; it now shows `"{Provider} · auto"` (e.g. `Gemini · auto`), since the ranker — not the saved model — decides which model actually runs each call. Health colour/label logic unchanged. Removed the now-unused `CURRENT_MODELS` import. No existing test covered this badge's text, so none needed updating.

## Spec update

- `docs/superpowers/specs/2026-09-16-quota-aware-ranking-design.md` §3 — replaced the stale "Ollama gemma ranks after Google gemma" paragraph with: "Inside a tier an unlimited budget ties with the fullest, so the existing tiebreaks (verdict, busy, direct-before-proxied) decide."

## Verification

```
npx vitest run
```
→ 146 test files, **1183 passed** (baseline 1180+; added 3 tests: F1 fallback-loop, F2 rank, F3 fallback-loop, plus F1 processor-flow assertion strengthened and one pre-existing test updated for F3 semantics).

```
npx tsc --noEmit
```
→ clean, no output.

## Skipped

Nothing skipped — all six items (F1–F6) plus the spec sentence were implemented as specified.
