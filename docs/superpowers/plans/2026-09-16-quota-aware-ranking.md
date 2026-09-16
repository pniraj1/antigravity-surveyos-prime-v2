# Quota-Aware Ranking (Phase 2-A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rank AI models by free-tier daily budget per key so estimates get the strongest tier that can finish the whole document, light documents never spend Flash quota, and Ollama's unpublished caps are learned from 429s.

**Architecture:** A pure `quota.ts` table gives each model a tier and a calls/day limit; `health.ts` keeps a per-key spend ledger that resets at Pacific midnight; `rank.ts` orders by tier then remaining budget and drops keys that cannot cover `pagesNeeded`; `service.ts` records spend per call, rests a non-Gemini model for one hour on 429, and passes the document's page count through `GatewaySession.pagesTotal`.

**Tech Stack:** TypeScript, vitest (node env), existing `callWithFallback` loop and `health` store (localStorage).

**Spec:** `docs/superpowers/specs/2026-09-16-quota-aware-ranking-design.md`

## Global Constraints

- Work on `main`, one commit per task. Attribution line: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- `dailyLimit`: gemini `/pro/` → 0, `/lite/` → 500, `/gemma/` → 14 400, other gemini → 20; ollama / groq / nvidia → `Infinity`.
- `tierOf`: gemini `/gemma/` → `gemma`, `/lite/` → `lite`, else `flash`; ollama `gemma*` → `gemma`; any other → `lite`.
- Spend ledger keyed `${keyHash}:${model}`, resets when the **Pacific** day changes; busy counts keep their local-day reset.
- `remaining` = 0 when dead/rested, else `max(0, limit − spent)`; `Infinity` limit → `Infinity`.
- Heavy sort: tier flash → lite → gemma, then best remaining desc, then existing tiebreaks. Light/text: tier lite → gemma → flash, then existing order.
- Keys with `remaining < pagesNeeded` are dropped; an entry with no surviving key is dropped. `pagesNeeded` = document pages for heavy first pass and second opinion, 1 for gap fill and every light/text call.
- Non-Gemini 429 → next model and rest that key:model for `OLLAMA_REST_MS = 3_600_000`.
- Zero extra AI calls. `preferredModel` (surveyor's saved Gemini pick) is removed from ranking — Phase 1 spec said "Removed in Phase 2".
- Toast copy: `Today's Flash quota is used up — reading with Flash-Lite` (once per day, heavy only, suppressed when the surveyor has an Ollama key).
- Run `npx vitest run src/lib/ai` after each task (baseline 340 green incl. Smart Fix tests) and `npx tsc --noEmit` before the final commit.

---

## File map

| File | Responsibility |
|---|---|
| Create `src/lib/ai/quota.ts` | `Tier`, `tierOf`, `dailyLimit`, `OLLAMA_REST_MS` |
| Modify `src/lib/ai/health.ts` | `spent` ledger, `quotaDay`, `recordSpend`, `remaining`, `rest` |
| Modify `src/lib/ai/rank.ts` | tier ordering, per-key budget filter, `pagesNeeded`; remove `preferredModel` |
| Modify `src/lib/ai/service.ts` | `GatewaySession.pagesTotal`, spend recording, non-Gemini 429 rest, Flash-exhausted nudge; remove `preferredGeminiModel` plumbing |
| Modify `src/lib/ai/processor.ts`, `src/lib/ai/gap-fill.ts` | set `session.pagesTotal`; gap fill uses 1 |
| Tests | `quota.test.ts` (new), `health.test.ts`, `rank.test.ts`, `fallback-loop.test.ts`, `gap-fill.test.ts` |

---

### Task 1: `quota.ts` — tier and daily-limit table

**Files:**
- Create: `src/lib/ai/quota.ts`
- Test: `src/lib/ai/__tests__/quota.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Tier = 'flash' | 'lite' | 'gemma';
  export function tierOf(provider: ProviderId, id: string): Tier;
  export function dailyLimit(provider: ProviderId, id: string): number;
  export const OLLAMA_REST_MS = 3_600_000;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ai/__tests__/quota.test.ts
import { describe, it, expect } from 'vitest';
import { tierOf, dailyLimit, OLLAMA_REST_MS } from '../quota';

describe('dailyLimit — Google free tier, per key (owner quota page 2026-09-16)', () => {
  it('Flash family is 20/day', () => {
    for (const id of ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3-flash-preview']) {
      expect(dailyLimit('gemini', id)).toBe(20);
    }
  });
  it('Flash-Lite is 500/day', () => {
    expect(dailyLimit('gemini', 'gemini-3.5-flash-lite')).toBe(500);
    expect(dailyLimit('gemini', 'gemini-flash-lite-latest')).toBe(500);
  });
  it('Gemma via Google is 14 400/day', () => { expect(dailyLimit('gemini', 'gemma-4-31b-it')).toBe(14_400); });
  it('Pro is 0 — never eligible on the free tier', () => { expect(dailyLimit('gemini', 'gemini-3.1-pro')).toBe(0); });
  it('other providers are unknown → Infinity', () => {
    expect(dailyLimit('ollama', 'gemma4:31b')).toBe(Infinity);
    expect(dailyLimit('groq', 'llama-3.2-90b-vision-preview')).toBe(Infinity);
    expect(dailyLimit('nvidia', 'meta/llama-3.2-90b-vision-instruct')).toBe(Infinity);
  });
});

describe('tierOf', () => {
  it('gemini: gemma > lite > flash by pattern; pro counts as flash', () => {
    expect(tierOf('gemini', 'gemma-4-31b-it')).toBe('gemma');
    expect(tierOf('gemini', 'gemini-3.5-flash-lite')).toBe('lite');
    expect(tierOf('gemini', 'gemini-3.5-flash')).toBe('flash');
    expect(tierOf('gemini', 'gemini-3.1-pro')).toBe('flash');
  });
  it('ollama gemma is gemma; everything else is lite (cheap fallback, not a reserve)', () => {
    expect(tierOf('ollama', 'gemma4:31b')).toBe('gemma');
    expect(tierOf('ollama', 'gpt-oss:120b')).toBe('lite');
    expect(tierOf('groq', 'llama-3.2-90b-vision-preview')).toBe('lite');
  });
  it('rest window is one hour', () => { expect(OLLAMA_REST_MS).toBe(3_600_000); });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/ai/__tests__/quota.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/ai/quota.ts
//
// Free-tier budgets, per key, per Pacific day. Read from the owner's Google
// quota page on 2026-09-16: every Flash model gets 20 requests/day, Flash-Lite
// 500, Gemma-via-Google 14 400, Pro 0. Other providers publish nothing usable —
// unknown until a 429 says otherwise (see health.rest).
// ponytail: shipped constant; admin-editable limits arrive with Phase 2-C.
import type { ProviderId } from './models-config';

export type Tier = 'flash' | 'lite' | 'gemma';

/** One Ollama Cloud usage window — a 429 there rests the model this long. */
export const OLLAMA_REST_MS = 3_600_000;

export function tierOf(provider: ProviderId, id: string): Tier {
  if (provider === 'gemini') return /gemma/.test(id) ? 'gemma' : /lite/.test(id) ? 'lite' : 'flash';
  if (provider === 'ollama' && /^gemma/.test(id)) return 'gemma';
  return 'lite';
}

/** Calls per day this key may make to this model; Infinity when unknown. */
export function dailyLimit(provider: ProviderId, id: string): number {
  if (provider !== 'gemini') return Infinity;
  if (/pro/.test(id)) return 0;
  if (/lite/.test(id)) return 500;
  if (/gemma/.test(id)) return 14_400;
  return 20;
}
```

- [ ] **Step 4: Run** the test file — Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/quota.ts src/lib/ai/__tests__/quota.test.ts
git commit -m "feat(ai): quota table — tier and free-tier daily limit per model

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `health.ts` — spend ledger

**Files:**
- Modify: `src/lib/ai/health.ts` (interface `Health` ~line 28, `HealthDoc` ~line 17, `createHealth` load/empty ~line 86, methods)
- Test: `src/lib/ai/__tests__/health.test.ts` (append)

**Interfaces:**
- Produces (on `Health`):
  ```ts
  recordSpend(keyHash: string, model: string): void;
  remaining(keyHash: string, model: string, limit: number): number;
  rest(keyHash: string, model: string, forMs: number): void;
  ```

- [ ] **Step 1: Write the failing tests** (append to `health.test.ts`; reuse that file's existing `mem()` helper and `createHealth` import — read the file's head first)

```ts
describe('spend ledger — per key, resets at Pacific midnight', () => {
  const T0 = Date.UTC(2026, 8, 15, 10, 0);            // 03:00 Pacific, 15 Sep
  it('counts per key:model and reports remaining against a limit', () => {
    const h = createHealth(mem(), () => T0);
    h.recordSpend('k1', 'gemini-3.5-flash');
    h.recordSpend('k1', 'gemini-3.5-flash');
    h.recordSpend('k2', 'gemini-3.5-flash');
    expect(h.remaining('k1', 'gemini-3.5-flash', 20)).toBe(18);
    expect(h.remaining('k2', 'gemini-3.5-flash', 20)).toBe(19);
    expect(h.remaining('k1', 'gemini-3.5-flash-lite', 500)).toBe(500);
  });
  it('never goes below zero; Infinity limit stays Infinity', () => {
    const h = createHealth(mem(), () => T0);
    for (let i = 0; i < 25; i++) h.recordSpend('k1', 'm');
    expect(h.remaining('k1', 'm', 20)).toBe(0);
    expect(h.remaining('k1', 'm', Infinity)).toBe(Infinity);
  });
  it('dead today or rested → 0', () => {
    let now = T0;
    const h = createHealth(mem(), () => now);
    h.markDeadToday('k1', 'a');
    expect(h.remaining('k1', 'a', 20)).toBe(0);
    h.rest('k1', 'b', 3_600_000);
    expect(h.remaining('k1', 'b', Infinity)).toBe(0);
    now = T0 + 3_600_001;
    expect(h.remaining('k1', 'b', Infinity)).toBe(Infinity);
  });
  it('resets when the Pacific day changes, independently of the local-day busy reset', () => {
    let now = T0;
    const store = mem();
    const h = createHealth(store, () => now);
    h.recordSpend('k1', 'm');
    h.recordCall('m', 'busy'); h.recordCall('m', 'busy'); h.recordCall('m', 'busy');
    now = Date.UTC(2026, 8, 16, 6, 59);                  // 23:59 Pacific, 15 Sep — same Pacific day
    expect(h.remaining('k1', 'm', 20)).toBe(19);
    now = Date.UTC(2026, 8, 16, 7, 1);                   // 00:01 Pacific, 16 Sep
    expect(h.remaining('k1', 'm', 20)).toBe(20);
  });
  it('a store that throws → full limit (no history)', () => {
    const h = createHealth({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }, () => T0);
    h.recordSpend('k1', 'm');
    expect(h.remaining('k1', 'm', 20)).toBe(20);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/ai/__tests__/health.test.ts` — Expected: FAIL, `recordSpend is not a function`.

- [ ] **Step 3: Implement**

In `HealthDoc` add:
```ts
  /** Calls made this Pacific day, `${keyHash}:${model}` → count. Quota is Google's clock. */
  spent: Record<string, number>;
  /** UTC ts of the next Pacific midnight — when `spent` resets. */
  quotaResetAt: number;
```
In `Health` add the three methods from Interfaces (with the doc comments: `/** Every call that reached the provider, any outcome. */`, `/** Calls this key may still make to this model; 0 when dead or rested. */`, `/** Park a key:model for `forMs` — a non-Gemini 429 whose window is unknown. */`).

In `createHealth`:
- `empty` becomes `{ day: localDayKey(now()), today: {}, deadToday: {}, notFound: {}, spent: {}, quotaResetAt: nextPacificMidnight(now()) }`.
- In `load()`, after parsing, normalise both clocks:
  ```ts
  const parsed = JSON.parse(raw) as Partial<HealthDoc>;
  let doc: HealthDoc = { ...empty, ...parsed, spent: parsed.spent ?? {}, quotaResetAt: parsed.quotaResetAt ?? empty.quotaResetAt };
  if (doc.day !== empty.day) doc = { ...doc, day: empty.day, today: {} };
  if (now() >= doc.quotaResetAt) doc = { ...doc, spent: {}, quotaResetAt: nextPacificMidnight(now()) };
  return doc;
  ```
  (replaces the current `return doc.day === empty.day ? doc : {...}` line; older stored docs without `spent` load cleanly.)
- Methods:
  ```ts
    recordSpend(hash, model) {
      const doc = load();
      const k = `${hash}:${model}`;
      save({ ...doc, spent: { ...doc.spent, [k]: (doc.spent[k] ?? 0) + 1 } });
    },
    remaining(hash, model, limit) {
      if (this.isDeadToday(hash, model)) return 0;
      return Math.max(0, limit - (load().spent[`${hash}:${model}`] ?? 0));
    },
    rest(hash, model, forMs) {
      const doc = load();
      save({ ...doc, deadToday: { ...doc.deadToday, [`${hash}:${model}`]: now() + forMs } });
    },
  ```
  `this.isDeadToday` — the returned object literal's methods are called as `health.remaining(...)`, so `this` is the health object; if the file's lint/TS config dislikes `this`, hoist `isDeadToday` into a local `const isDead = (hash, model) => …` used by both.

- [ ] **Step 4: Run** `npx vitest run src/lib/ai/__tests__/health.test.ts` — Expected: PASS. Then `npx vitest run src/lib/ai` — PASS (no other file constructs `HealthDoc` directly; if a test builds one, add the two fields).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/health.ts src/lib/ai/__tests__/health.test.ts
git commit -m "feat(ai): per-key spend ledger with Pacific-day reset; rest() for unknown-window 429s

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `rank.ts` — tier ordering and budget filter

**Files:**
- Modify: `src/lib/ai/rank.ts` (imports; `RankOptions`; eligibility loop; comparator; remove `preferredModel`)
- Test: `src/lib/ai/__tests__/rank.test.ts` (replace the `preferred model goes first` test; append new describe)

**Interfaces:**
- Consumes: `tierOf`, `dailyLimit` (Task 1); `health.remaining` (Task 2).
- Produces: `RankOptions = { health: Health; avoid?: ReadonlySet<string>; pagesNeeded?: number }` (default 1). `preferredModel` removed. Returned entries carry `keys` ordered by remaining desc with unaffordable keys removed.

- [ ] **Step 1: Write the failing tests**

Delete the `it('preferred model goes first when eligible', …)` test. Append:

```ts
import { tierOf } from '../quota';

describe('quota-aware ordering', () => {
  const T0 = 1_000;
  const spent = (h: ReturnType<typeof createHealth>, key: string, id: string, n: number) => { for (let i = 0; i < n; i++) h.recordSpend(keyHash(key), id); };
  const pool = () => [
    entry('gemini', 'gemini-3.5-flash'),
    entry('gemini', 'gemini-2.5-flash'),
    entry('gemini', 'gemini-3.5-flash-lite'),
    entry('ollama', 'gemma4:31b'),
  ];

  it('heavy: flash tier first, then lite, then gemma', () => {
    const r = ids(rankModels('heavy', ['i'], pool(), { health: health(), pagesNeeded: 5 }));
    expect(r.map(id => tierOf(id.startsWith('gemma4') ? 'ollama' : 'gemini', id))).toEqual(['flash', 'flash', 'lite', 'gemma']);
  });
  it('heavy: inside the flash tier the model with more remaining budget goes first', () => {
    const h = createHealth(mem(), () => T0);
    spent(h, 'k', 'gemini-3.5-flash', 15);                       // 5 left
    const r = ids(rankModels('heavy', ['i'], pool(), { health: h, pagesNeeded: 5 }));
    expect(r[0]).toBe('gemini-2.5-flash');                        // 20 left beats 5 left
  });
  it('heavy: a flash model whose budget cannot cover the document is skipped — never a half-read', () => {
    const h = createHealth(mem(), () => T0);
    spent(h, 'k', 'gemini-3.5-flash', 17); spent(h, 'k', 'gemini-2.5-flash', 18);   // 3 and 2 left
    const r = ids(rankModels('heavy', ['i'], pool(), { health: h, pagesNeeded: 5 }));
    expect(r[0]).toBe('gemini-3.5-flash-lite');
    expect(r).not.toContain('gemini-3.5-flash');
  });
  it('heavy: two keys — the fuller key comes first and an empty key is dropped', () => {
    const h = createHealth(mem(), () => T0);
    spent(h, 'k1', 'gemini-3.5-flash', 18); spent(h, 'k2', 'gemini-3.5-flash', 5);
    const e = { ...entry('gemini', 'gemini-3.5-flash'), keys: ['k1', 'k2'] };
    const [first] = rankModels('heavy', ['i'], [e], { health: h, pagesNeeded: 5 });
    expect(first.keys).toEqual(['k2']);
  });
  it('heavy: dead-today key counts as zero budget', () => {
    const h = createHealth(mem(), () => T0);
    h.markDeadToday(keyHash('k'), 'gemini-3.5-flash');
    expect(ids(rankModels('heavy', ['i'], pool(), { health: h, pagesNeeded: 1 }))).not.toContain('gemini-3.5-flash');
  });
  it('light: lite first, gemma next, flash only as last resort', () => {
    expect(ids(rankModels('light', ['i'], pool(), { health: health() }))).toEqual(['gemini-3.5-flash-lite', 'gemma4:31b', 'gemini-3.5-flash', 'gemini-2.5-flash']);
  });
  it('light: falls to flash when nothing cheaper is eligible', () => {
    const h = createHealth(mem(), () => T0);
    h.markDeadToday(keyHash('k'), 'gemini-3.5-flash-lite');
    const r = ids(rankModels('light', ['i'], [entry('gemini', 'gemini-3.5-flash-lite'), entry('gemini', 'gemini-2.5-flash')], { health: h }));
    expect(r).toEqual(['gemini-2.5-flash']);
  });
  it('pro is never eligible on the free tier', () => {
    expect(ids(rankModels('heavy', ['i'], [entry('gemini', 'gemini-3.1-pro'), entry('gemini', 'gemini-2.5-flash')], { health: health() }))).toEqual(['gemini-2.5-flash']);
  });
  it('text job: lite before flash too', () => {
    expect(ids(rankModels('text', [], pool(), { health: health() }))[0]).toBe('gemini-3.5-flash-lite');
  });
});
```
(`entry(...)` in this file uses `keys: ['k']`; `health()` uses `createHealth(mem(), () => 1_000)` — both already defined at the top of the file. Import `keyHash` is already there.)

- [ ] **Step 2: Run** `npx vitest run src/lib/ai/__tests__/rank.test.ts` — Expected: FAIL (`recordSpend` exists now, but ordering wrong / `pagesNeeded` ignored).

- [ ] **Step 3: Implement**

Imports: add `import { tierOf, dailyLimit, type Tier } from './quota';`.

`RankOptions`:
```ts
export interface RankOptions {
  health: Health;
  /** Models to skip for this call (math second opinion). */
  avoid?: ReadonlySet<string>;
  /** Calls this document still needs — a key that cannot cover them is not used. Default 1. */
  pagesNeeded?: number;
}
```

Tier order tables (module level):
```ts
const HEAVY_TIER: Record<Tier, number> = { flash: 0, lite: 1, gemma: 2 };
const CHEAP_TIER: Record<Tier, number> = { lite: 0, gemma: 1, flash: 2 };   // light/text: Flash is the last resort
```

In `rankModels`, replace `const { health, preferredModel, avoid } = opts;` with `const { health, avoid, pagesNeeded = 1 } = opts;` and add `const best = new Map<string, number>();`. Replace the key filter lines
```ts
    const keys = e.keys.filter(k => !health.isDeadToday(keyHash(k), id));
    if (keys.length === 0) continue;
    eligible.push({ ...e, keys });
```
with
```ts
    const limit = dailyLimit(e.provider, id);
    if (limit === 0) continue;                                              // Pro: not on the free tier
    // Per key: what it can still spend today. Dead/rested keys read 0. A key that
    // cannot cover the whole document is dropped — never start a 5-page read
    // on a key with 3 calls left.
    const keyed = e.keys
      .map(k => ({ k, left: health.remaining(keyHash(k), id, limit) }))
      .filter(x => x.left >= pagesNeeded)
      .sort((a, b) => b.left - a.left);
    if (keyed.length === 0) continue;
    best.set(id, keyed[0].left);
    eligible.push({ ...e, keys: keyed.map(x => x.k) });
```
Comparator: add `const tier = (e: PoolEntry, t: Record<Tier, number>) => t[tierOf(e.provider, e.model.id)];` and change `byJob` to
```ts
  const byJob: (a: PoolEntry, b: PoolEntry) => number = job === 'heavy'
    ? (a, b) => cmp(tier(a, HEAVY_TIER), tier(b, HEAVY_TIER)) || cmp(best.get(b.model.id)!, best.get(a.model.id)!)
        || cmp(verdictRank(a), verdictRank(b)) || cmp(busy(a), busy(b)) || cmp(proxied(a), proxied(b))
        || cmp(modelStrength(b.model.id), modelStrength(a.model.id)) || cmp(speed(a), speed(b))
    : job === 'light'
    ? (a, b) => cmp(tier(a, CHEAP_TIER), tier(b, CHEAP_TIER)) || cmp(proxied(a), proxied(b))
        || cmp(+(speed(a) > LIGHT_FAST_MS_PER_PAGE), +(speed(b) > LIGHT_FAST_MS_PER_PAGE)) || cmp(speed(a), speed(b)) || cmp(busy(a), busy(b))
    : (a, b) => cmp(tier(a, CHEAP_TIER), tier(b, CHEAP_TIER)) || cmp(speed(a), speed(b)) || cmp(busy(a), busy(b)) || cmp(proxied(a), proxied(b));
```
`cmp(Infinity, Infinity)` is 0 — unlimited models tie. Delete the `preferredModel` block after `sorted`; return `sorted`. Update the doc comment above `rankModels` to mention budget.

- [ ] **Step 4: Run** `npx vitest run src/lib/ai/__tests__/rank.test.ts` — PASS. `npx tsc --noEmit` — errors only in `service.ts` (`preferredModel` no longer in `RankOptions`) — Task 4 fixes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/rank.ts src/lib/ai/__tests__/rank.test.ts
git commit -m "feat(ai): rank by tier then remaining daily budget per key; drop keys that cannot cover the document

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `service.ts` — spend, rest, pagesTotal, nudge; remove preferred model

**Files:**
- Modify: `src/lib/ai/service.ts` (`GatewaySession` ~468; `stepFor` 429 branch ~546; `callWithFallback` signature/keys loop/rank call ~567–650; `callAIGateway` ~700; `getActiveImageCap` ~192; delete `preferredGeminiModel` ~150)
- Test: `src/lib/ai/__tests__/fallback-loop.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `GatewaySession.pagesTotal?: number` (calls the current document still needs on a heavy job). `callWithFallback(job, prompt, images, format, session, signal, pool)` — no `preferredModel`. `CURRENT_MODELS` and `DEPRECATED_GEMINI_MODELS` stay exported (used by `buildPool` and admin UI).

- [ ] **Step 1: Update tests**

In `fallback-loop.test.ts` replace the `describe('preferred model', …)` block with:

```ts
describe('quota-aware order', () => {
  it('heavy: a Flash-tier model is tried first when its budget covers the document', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    const s = newSession('t'); s.pagesTotal = 5;
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    expect(modelOf(spy.mock.calls[0])).toMatch(/flash$/);          // 2.5-flash or 3.5-flash, not -lite
  });
  it('light: Flash-Lite is tried first — Flash quota is reserved for estimates', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    await callAIGateway('p', ['img'], 'json', 'light');
    expect(modelOf(spy.mock.calls[0])).toMatch(/lite/);
  });
  it('every call spends one unit on that key:model, including the no-thinking retry', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(fail(400, 'Request contains an invalid argument.')).mockResolvedValueOnce(ok());
    await callAIGateway('p', ['img'], 'json', 'light');
    const m = modelOf(spy.mock.calls[0]);
    expect(health.remaining(keyHash('g1'), m, 500)).toBe(498);
  });
  it('heavy: when every Flash key is below the page count, Flash-Lite leads and the surveyor is told once', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    for (const m of ['gemini-2.5-flash', 'gemini-3.5-flash']) for (let i = 0; i < 18; i++) health.recordSpend(keyHash('g1'), m);
    const s = newSession('t'); s.pagesTotal = 5;
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    expect(modelOf(spy.mock.calls[0])).toMatch(/lite/);
    expect(toast.info.mock.calls.some(c => /Flash quota is used up/.test(String(c[0])))).toBe(true);
    toast.info.mockClear();
    await callAIGateway('p', ['img'], 'json', 'heavy', newSession('t2'));
    expect(toast.info.mock.calls.some(c => /Flash quota is used up/.test(String(c[0])))).toBe(false);   // once a day
  });
  it('heavy: with an Ollama key the Flash-exhausted toast is silent', async () => {
    useProfileStore.getState().updateProfile({ ollamaApiKeys: ['o1'] } as never);
    callAiProxy.mockResolvedValue({ ok: true, status: 200, body: JSON.stringify({ message: { content: '{"x":1}' }, done_reason: 'stop' }) });
    vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    for (const m of ['gemini-2.5-flash', 'gemini-3.5-flash']) for (let i = 0; i < 20; i++) health.recordSpend(keyHash('g1'), m);
    const s = newSession('t'); s.pagesTotal = 5;
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    expect(toast.info.mock.calls.some(c => /Flash quota/.test(String(c[0])))).toBe(false);
  });
  it('second key is used when the first cannot cover the document', async () => {
    useProfileStore.getState().updateProfile({ geminiApiKeys: ['g1', 'g2'] } as never);
    for (const m of ['gemini-2.5-flash', 'gemini-3.5-flash']) for (let i = 0; i < 18; i++) health.recordSpend(keyHash('g1'), m);
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    const s = newSession('t'); s.pagesTotal = 5;
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    expect(modelOf(spy.mock.calls[0])).toMatch(/flash$/);
    expect((spy.mock.calls[0][1]!.headers as any)['x-goog-api-key']).toBe('g2');
  });
  it('Ollama 429 → rest that model one hour and hop', async () => {
    useProfileStore.getState().updateProfile({ geminiApiKeys: [], ollamaApiKeys: ['o1'] } as never);
    callAiProxy.mockResolvedValueOnce({ ok: false, status: 429, body: 'usage limit' });
    await expect(callAIGateway('p', ['img'], 'json', 'light')).rejects.toBeInstanceOf(AllProvidersBusyError);
    expect(health.remaining(keyHash('o1'), 'gemma4:31b', Infinity)).toBe(0);
  });
});
```
Check the shape `callAiProxy` resolves to in this file's existing Ollama tests (grep `callAiProxy.mockResolvedValue`) and match it exactly for the two Ollama cases above.

- [ ] **Step 2: Run** `npx vitest run src/lib/ai/__tests__/fallback-loop.test.ts` — Expected: FAIL (tsc/import of `preferredModel`, `pagesTotal` unknown, ordering).

- [ ] **Step 3: Implement**

3a. `GatewaySession`: add
```ts
  /** Calls this document still needs on a heavy job — a key that cannot cover them is skipped. */
  pagesTotal?: number;
```

3b. Delete `preferredGeminiModel` (function + its doc comment). In `callAIGateway` delete the ponytail comment and `const preferred = …`; call `callWithFallback(job, prompt, images, responseFormat, session, signal, pool)`. In `getActiveImageCap` call `rankModels(job, ['x'], pool, { health: getHealth() })`. Remove the `preferredModel?: string` parameter from `callWithFallback`.

3c. Import: `import { tierOf, OLLAMA_REST_MS } from './quota';`

3d. In `callWithFallback` the rank call becomes
```ts
  const pagesNeeded = job === 'heavy' ? session?.pagesTotal ?? 1 : 1;
  let chain = rankModels(job, images, pool, { health, avoid: session?.avoid, pagesNeeded });
```
Directly after the `chain.length === 0 && …deadToday` block add the nudge:
```ts
  // Heavy fell off the Flash tier because no Flash key can cover this document.
  // Tell the surveyor once a day — unless Ollama is there, which handles it fine.
  if (job === 'heavy' && chain[0] && tierOf(chain[0].provider, chain[0].model.id) !== 'flash'
      && pool.some(e => tierOf(e.provider, e.model.id) === 'flash' && e.keys.length > 0)
      && !pool.some(e => e.provider === 'ollama')) {
    try {
      const k = 'surveyos.ai.nudge.flash';
      if (Date.now() - Number(localStorage.getItem(k) ?? 0) > 86_400_000) {
        toast.info("Today's Flash quota is used up — reading with Flash-Lite", { duration: 8000 });
        localStorage.setItem(k, String(Date.now()));
      }
    } catch { /* no nudge memory */ }
  }
```
(`toast` from `sonner` is already imported in service.ts; tests mock it.)

3e. In the keys loop, right after `calls++;` add `health.recordSpend(keyHash(key), entry.model.id);` — every attempt, including the `i--` retry.

3f. `stepFor` return type: add `rest?: boolean`. In the 429 branch change the final `return { step: 'next-key' };` to
```ts
    // Gemini minute/project limits rotate keys; any other provider's 429 is an
    // unpublished usage window — park this key:model for one window and move on.
    return provider === 'gemini' ? { step: 'next-key' } : { step: 'next-model', rest: true };
```
In the catch block, next to `if (d.deadModel) …`, add `if (d.rest) health.rest(keyHash(key), entry.model.id, OLLAMA_REST_MS);`.

- [ ] **Step 4: Run** `npx vitest run src/lib/ai` — PASS (other tests that pinned `CURRENT_MODELS.gemini` first for heavy must be updated to the new expectation — search `CURRENT_MODELS` in `__tests__`; a light-job test expecting a Flash model first is now wrong by design, fix its expectation to `/lite/`). `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/service.ts src/lib/ai/__tests__
git commit -m "feat(ai): spend ledger in the loop, one-hour rest on non-Gemini 429, Flash-exhausted nudge; surveyor model pick no longer steers ranking

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Processor and gap fill — `pagesTotal`

**Files:**
- Modify: `src/lib/ai/processor.ts` (`extractDocument` after `filesToImages`; `smartFixRescan`), `src/lib/ai/gap-fill.ts` (`fillGaps`)
- Test: `src/lib/ai/__tests__/gap-fill.test.ts` (append), `src/lib/ai/__tests__/processor-flow.test.ts` (append one assertion)

**Interfaces:**
- Consumes: `GatewaySession.pagesTotal` (Task 4).

- [ ] **Step 1: Failing tests**

`gap-fill.test.ts` — the mock `newSession` there returns `{}`; append:
```ts
it('sets session.pagesTotal to 1 for its calls and restores it afterwards', async () => {
  gw.mockImplementation(async () => JSON.stringify({ spare_parts: [row(2)] }));
  const session: any = { avoid: new Set(), announced: new Set(), pagesTotal: 5 };
  let seen: number | undefined;
  gw.mockImplementationOnce(async (_p: string, _i: string[], _f: string, _j: string, s: any) => { seen = s.pagesTotal; return JSON.stringify({ spare_parts: [row(2)] }); });
  await fillGaps({ basePrompt: 'P', apiImages: images, data: base, srNos: [2], pages: [1], session });
  expect(seen).toBe(1);
  expect(session.pagesTotal).toBe(5);
});
```
`processor-flow.test.ts` — in the clean-read case, capture the session passed on the first gateway call and assert `pagesTotal === 3` (the mocked `newSession` there must return a plain mutable object; adjust the mock if it returns a frozen/shared object).

- [ ] **Step 2: Run** both files — Expected: FAIL.

- [ ] **Step 3: Implement**

`processor.ts`, in `extractDocument` right after `const totalPages = apiImages.length;`:
```ts
    session.pagesTotal = totalPages;   // heavy ranking skips keys that cannot cover the whole document
```
`gap-fill.ts`, in `fillGaps` wrap the page loop:
```ts
  const s = input.session;
  const prevPages = s?.pagesTotal;
  if (s) s.pagesTotal = 1;             // one page per gap call — a nearly-spent Flash key may still take it
  try {
    for (const p of pages) { … existing body … }
  } finally {
    if (s) s.pagesTotal = prevPages;
  }
  return data;
```
(`smartFixRescan` creates a fresh session and calls `fillGaps`, so it is covered.)

- [ ] **Step 4: Run** `npx vitest run src/lib/ai` — PASS. `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/processor.ts src/lib/ai/gap-fill.ts src/lib/ai/__tests__/gap-fill.test.ts src/lib/ai/__tests__/processor-flow.test.ts
git commit -m "feat(ai): document page count drives budget checks; gap fill needs one page

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Docs and full verification

**Files:**
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`, `Tasks.md`; `docs/superpowers/plans/2026-09-15-ai-fallback-phase-1.md` (Task 14 table: add L10)
- Create: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-09-16-quota-aware-ranking.md`

- [ ] **Step 1:** `npx tsc --noEmit && npm test` — Expected: clean, all green (≥ 1150 + new).
- [ ] **Step 2:** Session log: what changed (files above), the rules (limits table, tiers, `pagesNeeded`, rest window, nudge), the surveyor-facing consequence (RC/DL now go to Flash-Lite; estimates rotate across Flash siblings and keys; a 25-page bill goes straight to Flash-Lite), live check L10:
  ```
  L10: DevTools → Application → Local Storage → surveyos.ai.health.v1: set spent["<keyHash>:gemini-2.5-flash"] = 19 and the same for every Flash model in the admin pool; reload; upload the 5-page DTC estimate.
  Expect: first call on a Flash-Lite model; toast "Today's Flash quota is used up — reading with Flash-Lite" (only when no Ollama key); no half-read.
  Then upload an RC photo: first call on Flash-Lite regardless.
  ```
  and note: the Profile Gemini model picker is now inert (removed in 2-D).
- [ ] **Step 3:** Changelog entry under 2026-09-16 and Tasks.md: mark "Phase 2-A" done, add "deploy 2-A (hosting only)" and "L10" open, keep 2-B/2-C/2-D open.
- [ ] **Step 4: Commit**
```bash
git add SurveyOS-Antigravity-Prime-V2-KnowledgeBase docs/superpowers/plans/2026-09-15-ai-fallback-phase-1.md
git commit -m "docs: session log, changelog and tasks — quota-aware ranking (Phase 2-A)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
- [ ] **Step 5:** Do NOT deploy. Report: hosting-only deploy pending owner's go.

---

## Self-review

- **Spec coverage:** §1 → Task 1; §2 → Task 2 (`rest(hash, model, forMs)` — duration instead of the spec's `untilTs`; same behaviour, avoids a second clock in callers); §3 → Task 3 + Task 5 (`pagesTotal`); §4 → Task 4 (spend, rest, nudge, order); §5 edge cases → covered by Task 2/3 tests (dead → 0, no survivor → drop, storage blocked → full limit) and existing `AllProvidersBusyError` path; §6 → tests in Tasks 1–5, L10 in Task 6.
- **Placeholders:** none.
- **Type consistency:** `remaining(hash, model, limit)` used identically in Tasks 2, 3, 4 tests; `pagesNeeded` on `RankOptions` (Task 3) fed from `session.pagesTotal` (Task 4) set in Task 5; `tierOf(provider, id)` signature used in Tasks 3 and 4; `OLLAMA_REST_MS` from Task 1 used in Task 4.
