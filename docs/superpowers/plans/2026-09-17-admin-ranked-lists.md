# Admin Ranked Lists and Veto (Phase 2-C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The surveyor's model chain becomes "every probe-ok model minus the admin's exclusions", guard rails auto-exclude obviously unsuitable ids, admin edits daily limits, and the admin tab shows the three ranked lists the loop actually uses.

**Architecture:** Config schema v2 (`excluded`, `excludedReason`, `keep`, `limits`, `notes`) with a pure migration from the old tick-list; a pure `poolFromProbes(config, probes, keys)` shared by the request path and the admin tab; a pure `guard-rails.ts` applied by the admin probe; `RankOptions.limitOf` lets config limits override the quota table; the admin tab is split into `AIModelsTab` (state/IO), `ProviderCard` (per-provider header/hidden groups) and `RankedLists` (three job lists with Exclude/Include and limit inputs).

**Tech Stack:** TypeScript, Zustand, Firestore (`ai_config/models`, `ai_config/model_probes`), vitest (node env, `renderToStaticMarkup`), lucide-react, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-17-admin-ranked-lists-design.md`

## Global Constraints

- Work on `main`, one commit per task. Attribution line: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Zero extra AI calls. The probe stays the only spender; ranked lists are computed locally with `createHealth(null)`.
- Chain = probe `status === 'ok'` − `excluded` − retired ids (`DEPRECATED_GEMINI_MODELS` / `DEPRECATED_GROQ_MODELS`), for enabled providers the surveyor has a key for. Probes doc absent/unreadable → the provider's `fallbackModels`.
- Guard rail: `r.slow` → `"too slow (>90 s/page)"`; id matches `/(^|[-_/:.])(preview|exp|transcribe|robotics|tts|image|embedding|audio|live|omni)([-_/:.]|$)/i` → `"not a document model"`; never for text-only. Applied only by the admin probe; ids in `keep` are never re-added.
- Config schema: `schema: 2`; `ProviderConfig` = `{ enabled, excluded, excludedReason, keep, limits, notes }` plus DEPRECATED optional `models`/`defaultModel` kept for one release so `AIControls.tsx` and `resolveEnabledModel` still compile (removed in 2-D). Migration: non-empty `models` → `excluded = probeOk − models`; empty/missing → `[]`; `notes` from `ModelEntry.note`.
- `limits[id]` overrides `dailyLimit`; `0` = never eligible (UI label "off"); non-numeric/negative ignored.
- Exclude is refused when the model is the last eligible for any job, with the message `"<Job label> would have no model left."` Job labels: `Estimates & bills`, `Licence · RC · policy`, `Letters & text`. `pagesNeeded` for the admin lists: 5 / 1 / 1.
- Run `npx vitest run src/lib/ai` after each task (baseline 371) and `npx tsc --noEmit` before every commit.

---

## File map

| File | Responsibility |
|---|---|
| Modify `src/lib/ai/models-config.ts` | schema v2 types, `fallbackModels`, `migrateConfig`, `mergeWithFallback` defaults |
| Create `src/lib/ai/guard-rails.ts` | `guardRailReason`, `applyGuardRails` |
| Create `src/lib/ai/pool.ts` | `poolFromProbes`, `limitOfFor`, `JOBS_FOR_ADMIN` |
| Create `src/stores/probes-store.ts`; modify `src/hooks/useAIConfig.ts` | surveyor-side probes load |
| Modify `src/lib/ai/rank.ts`, `src/lib/ai/service.ts` | `limitOf`; `buildPool` → `poolFromProbes` |
| Create `src/components/admin/ai/RankedLists.tsx`, `src/components/admin/ai/ProviderCard.tsx`; rewrite `src/components/admin/tabs/AIModelsTab.tsx` | admin UI |
| Tests | `models-config-migrate.test.ts`, `guard-rails.test.ts`, `pool.test.ts`, `rank.test.ts`, `fallback-loop.test.ts`, `src/components/admin/ai/__tests__/ranked-lists.test.tsx` |

---

### Task 1: Config schema v2 + migration

**Files:**
- Modify: `src/lib/ai/models-config.ts`
- Test: `src/lib/ai/__tests__/models-config-migrate.test.ts` (new); existing `models-config.test.ts`, `shipped-defaults.test.ts` must stay green (adjust only if they construct `ProviderConfig` literals — add the new fields).

**Interfaces (produces):**
```ts
export interface FallbackModel { id: string; label: string; vision: boolean; imageCap: number | null; ctxWindow: number | null }
export interface ProviderConfig {
  enabled: boolean;
  excluded: string[];
  excludedReason: Record<string, string>;
  keep: string[];
  limits: Record<string, number>;
  notes: Record<string, string>;
  /** @deprecated legacy tick-list; read by migrateConfig, written empty; removed in 2-D */
  models?: ModelEntry[];
  /** @deprecated */
  defaultModel?: string;
}
export interface AIModelsConfig { schema?: 1 | 2; updatedAt; updatedBy; defaultProvider; providers }
export const FALLBACK_MODELS: Record<ProviderId, FallbackModel[]>;
export function emptyProviderConfig(enabled?: boolean): ProviderConfig;
export function migrateConfig(raw: AIModelsConfig, probes: ModelProbes | null): AIModelsConfig;   // schema 2 out; no-op if already 2
```

- [ ] **Step 1: Failing tests**

```ts
// src/lib/ai/__tests__/models-config-migrate.test.ts
import { describe, it, expect } from 'vitest';
import { migrateConfig, emptyProviderConfig, FALLBACK_AI_MODELS_CONFIG, type AIModelsConfig } from '../models-config';
import { EMPTY_PROBES, type ModelProbes } from '../probe-types';

const ok = (id: string) => ({ id, status: 'ok' as const, reason: '', vision: true, imageCap: null, ctxWindow: 1_000_000, msPerPage: 3000, slow: false,
  source: { vision: 'probe' as const, imageCap: 'probe' as const, ctxWindow: 'probe' as const }, probedAt: 1, consecutiveFailures: 0 });
const probes = (): ModelProbes => ({ ...EMPTY_PROBES, providers: { ...EMPTY_PROBES.providers,
  gemini: { probedAt: 1, error: null, accuracy: {}, models: { 'gemini-2.5-flash': ok('gemini-2.5-flash'), 'gemini-3.5-flash': ok('gemini-3.5-flash'), 'gemini-3.5-flash-lite': ok('gemini-3.5-flash-lite') } } } });
const legacy = (models: { id: string; note?: string }[]): AIModelsConfig => ({
  ...FALLBACK_AI_MODELS_CONFIG, schema: undefined,
  providers: { ...FALLBACK_AI_MODELS_CONFIG.providers,
    gemini: { enabled: true, defaultModel: models[0]?.id ?? '', models: models.map(m => ({ id: m.id, label: m.id, note: m.note ?? '', ctxWindow: null, vision: true, imageCap: null })) } as any },
});

describe('migrateConfig', () => {
  it('non-empty tick list → excluded is the complement of probe-ok', () => {
    const out = migrateConfig(legacy([{ id: 'gemini-2.5-flash' }]), probes());
    expect(out.schema).toBe(2);
    expect(out.providers.gemini.excluded.sort()).toEqual(['gemini-3.5-flash', 'gemini-3.5-flash-lite']);
    expect(out.providers.gemini.excludedReason).toEqual({});
    expect(out.providers.gemini.keep).toEqual([]);
    expect(out.providers.gemini.limits).toEqual({});
  });
  it('empty tick list → nothing excluded', () => {
    expect(migrateConfig(legacy([]), probes()).providers.gemini.excluded).toEqual([]);
  });
  it('no probes yet → nothing excluded (the tick list cannot be inverted)', () => {
    expect(migrateConfig(legacy([{ id: 'gemini-2.5-flash' }]), null).providers.gemini.excluded).toEqual([]);
  });
  it('notes carried from ModelEntry.note', () => {
    expect(migrateConfig(legacy([{ id: 'gemini-2.5-flash', note: 'best' }]), probes()).providers.gemini.notes).toEqual({ 'gemini-2.5-flash': 'best' });
  });
  it('legacy fields are written empty, not dropped (2-D removes them)', () => {
    const out = migrateConfig(legacy([{ id: 'gemini-2.5-flash' }]), probes());
    expect(out.providers.gemini.models).toEqual([]);
    expect(out.providers.gemini.defaultModel).toBe('');
  });
  it('schema 2 in → same object out', () => {
    const v2: AIModelsConfig = { ...FALLBACK_AI_MODELS_CONFIG, schema: 2, providers: { ...FALLBACK_AI_MODELS_CONFIG.providers, gemini: { ...emptyProviderConfig(), excluded: ['x'] } } };
    expect(migrateConfig(v2, probes())).toBe(v2);
  });
  it('every provider block gets all v2 fields even when missing from the stored doc', () => {
    const out = migrateConfig({ ...legacy([]), providers: { gemini: legacy([]).providers.gemini } as any }, probes());
    for (const p of ['gemini', 'groq', 'nvidia', 'ollama'] as const) {
      expect(out.providers[p]).toMatchObject({ excluded: expect.any(Array), excludedReason: {}, keep: [], limits: {}, notes: expect.any(Object) });
    }
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/ai/__tests__/models-config-migrate.test.ts` — FAIL (`migrateConfig` not exported).

- [ ] **Step 3: Implement** in `models-config.ts`

Add `import type { ModelProbes } from './probe-types';` (type-only — `probe-types` imports firebase; a type import keeps the module graph unchanged).

Types: replace `ProviderConfig` and `AIModelsConfig` with the Interfaces block above (keep `ModelEntry` as is — still used by legacy fields and `AIControls`). Add:
```ts
export interface FallbackModel { id: string; label: string; vision: boolean; imageCap: number | null; ctxWindow: number | null }

/** Used only when the probes doc has never been written. Ids verified live 2026-09-16. */
export const FALLBACK_MODELS: Record<ProviderId, FallbackModel[]> = {
  gemini: [
    { id: 'gemini-2.5-flash', label: '2.5 Flash', vision: true, imageCap: null, ctxWindow: 1_048_576 },
    { id: 'gemini-flash-lite-latest', label: 'Flash-Lite', vision: true, imageCap: null, ctxWindow: 1_048_576 },
    { id: 'gemini-3.5-flash', label: '3.5 Flash', vision: true, imageCap: null, ctxWindow: 1_048_576 },
  ],
  groq: [{ id: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B', vision: true, imageCap: 5, ctxWindow: 131_072 }],
  nvidia: [{ id: 'meta/llama-3.2-90b-vision-instruct', label: 'Llama 3.2 90B', vision: true, imageCap: 1, ctxWindow: 128_000 }],
  ollama: [{ id: 'gemma4:31b', label: 'Gemma 4 31B', vision: true, imageCap: null, ctxWindow: 131_072 }],
};

export function emptyProviderConfig(enabled = true): ProviderConfig {
  return { enabled, excluded: [], excludedReason: {}, keep: [], limits: {}, notes: {}, models: [], defaultModel: '' };
}
```
`FALLBACK_AI_MODELS_CONFIG` becomes `{ schema: 2, updatedAt: null, updatedBy: 'fallback', defaultProvider: 'gemini', providers: { gemini: emptyProviderConfig(), groq: emptyProviderConfig(), nvidia: emptyProviderConfig(), ollama: emptyProviderConfig() } }` — but keep the legacy `models` lists populated from `FALLBACK_MODELS` mapped to `ModelEntry` (`note: ''`) so `AIControls.tsx` keeps a picker list until 2-D: `models: FALLBACK_MODELS[p].map(m => ({ ...m, note: '' }))`, `defaultModel: FALLBACK_MODELS[p][0].id`. Delete the local `entry()` helper and `resolveModelImageCap` (grep confirms no callers outside this file; delete its test if one exists in `models-config.test.ts`).

`mergeWithFallback`: for each provider present in `raw`, spread `{ ...emptyProviderConfig(), ...raw.providers[p] }` so missing v2 fields get defaults; carry `schema: raw.schema`.

```ts
/**
 * Old docs are a tick-list (`models`). The veto model needs the complement:
 * everything the probe found working that the admin had NOT ticked. Without
 * probes the complement is unknowable, so nothing is excluded — the admin
 * sees the full chain after the next probe and vetoes from there.
 */
export function migrateConfig(raw: AIModelsConfig, probes: ModelProbes | null): AIModelsConfig {
  if (raw.schema === 2) return raw;
  const providers = { ...raw.providers };
  for (const p of PROVIDER_IDS) {
    const block: ProviderConfig = { ...emptyProviderConfig(), ...(raw.providers[p] ?? {}) };
    const ticked = block.models ?? [];
    const okIds = Object.values(probes?.providers[p]?.models ?? {}).filter(m => m.status === 'ok').map(m => m.id);
    const excluded = ticked.length && okIds.length ? okIds.filter(id => !ticked.some(m => m.id === id)) : [];
    const notes = Object.fromEntries(ticked.filter(m => m.note).map(m => [m.id, m.note]));
    providers[p] = { ...block, excluded, excludedReason: {}, keep: [], limits: {}, notes, models: [], defaultModel: '' };
  }
  return { ...raw, schema: 2, providers };
}
```
`loadAIModelsConfig` unchanged (migration happens where probes are known — Task 3 pool and Task 5 admin). `saveAIModelsConfig` writes `schema: 2`.

- [ ] **Step 4: Run** `npx vitest run src/lib/ai` — PASS after fixing any test that builds a `ProviderConfig` literal (add the v2 fields via `emptyProviderConfig()` spread). `npx tsc --noEmit` — errors allowed only where `block.models` is read without `?? []` (`service.ts buildPool`, `AIControls.tsx`, `AIModelsTab.tsx`, `probe-reconcile.ts`): make each read `block.models ?? []` — one-line changes, no behaviour change. tsc must be clean at commit.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ai/models-config.ts src/lib/ai/__tests__ src/lib/ai/service.ts src/lib/ai/probe-reconcile.ts src/components/ai/AIControls.tsx src/components/admin/tabs/AIModelsTab.tsx
git commit -m "feat(ai): config schema v2 — excluded/keep/limits/notes with migration from the tick list

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Guard rails

**Files:**
- Create: `src/lib/ai/guard-rails.ts`
- Test: `src/lib/ai/__tests__/guard-rails.test.ts`

**Interfaces (produces):**
```ts
export function guardRailReason(provider: ProviderId, r: ProbeResult): string | null;
export function applyGuardRails(config: AIModelsConfig, probes: ModelProbes): AIModelsConfig;   // new object; adds to excluded+excludedReason, respects keep
```

- [ ] **Step 1: Failing tests**
```ts
// src/lib/ai/__tests__/guard-rails.test.ts
import { describe, it, expect } from 'vitest';
import { guardRailReason, applyGuardRails } from '../guard-rails';
import { FALLBACK_AI_MODELS_CONFIG, emptyProviderConfig } from '../models-config';
import { EMPTY_PROBES, type ProbeResult, type ModelProbes } from '../probe-types';

const r = (id: string, over: Partial<ProbeResult> = {}): ProbeResult => ({ id, status: 'ok', reason: '', vision: true, imageCap: null, ctxWindow: 1e6, msPerPage: 3000, slow: false,
  source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' }, probedAt: 1, consecutiveFailures: 0, ...over });

describe('guardRailReason', () => {
  it('slow → too slow', () => { expect(guardRailReason('gemini', r('gemini-flash-latest', { slow: true, msPerPage: null }))).toBe('too slow (>90 s/page)'); });
  it.each(['gemini-3-flash-preview', 'gemini-2.0-flash-exp', 'gemini-3.5-transcribe', 'gemini-robotics-er-2-preview', 'gemini-2.5-flash-tts', 'gemini-3.1-flash-image', 'gemini-embedding-2', 'gemini-2.5-flash-audio', 'gemini-live-2.5', 'gemini-omni-flash'])
    ('%s → not a document model', id => { expect(guardRailReason('gemini', r(id))).toBe('not a document model'); });
  it.each(['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemma-4-31b-it', 'gemma4:31b', 'nemotron-3-nano:30b', 'gpt-oss:120b', 'llama-3.2-90b-vision-preview'.replace('-preview', '')])
    ('%s survives', id => { expect(guardRailReason('gemini', r(id))).toBeNull(); });
  it('text-only is not a guard-rail reason', () => { expect(guardRailReason('ollama', r('gpt-oss:20b', { vision: false }))).toBeNull(); });
});

describe('applyGuardRails', () => {
  const probes = (): ModelProbes => ({ ...EMPTY_PROBES, providers: { ...EMPTY_PROBES.providers, gemini: { probedAt: 1, error: null, accuracy: {}, models: {
    'gemini-3.5-flash': r('gemini-3.5-flash'), 'gemini-3-flash-preview': r('gemini-3-flash-preview'), 'gemini-flash-latest': r('gemini-flash-latest', { slow: true }),
  } } } });
  it('adds reasons for every ok model that trips a rail; leaves others alone', () => {
    const out = applyGuardRails(FALLBACK_AI_MODELS_CONFIG, probes());
    expect(out.providers.gemini.excluded.sort()).toEqual(['gemini-3-flash-preview', 'gemini-flash-latest']);
    expect(out.providers.gemini.excludedReason['gemini-flash-latest']).toBe('too slow (>90 s/page)');
    expect(out).not.toBe(FALLBACK_AI_MODELS_CONFIG);
  });
  it('never re-adds a model the admin chose to keep', () => {
    const cfg = { ...FALLBACK_AI_MODELS_CONFIG, providers: { ...FALLBACK_AI_MODELS_CONFIG.providers, gemini: { ...emptyProviderConfig(), keep: ['gemini-3-flash-preview'] } } };
    expect(applyGuardRails(cfg, probes()).providers.gemini.excluded).toEqual(['gemini-flash-latest']);
  });
  it('does not duplicate an existing exclusion and keeps an admin reason-less exclusion', () => {
    const cfg = { ...FALLBACK_AI_MODELS_CONFIG, providers: { ...FALLBACK_AI_MODELS_CONFIG.providers, gemini: { ...emptyProviderConfig(), excluded: ['gemini-3-flash-preview', 'gemini-3.5-flash'] } } };
    const out = applyGuardRails(cfg, probes()).providers.gemini;
    expect(out.excluded.sort()).toEqual(['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-flash-latest']);
    expect(out.excludedReason['gemini-3.5-flash']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** — FAIL, module not found.

- [ ] **Step 3: Implement**
```ts
// src/lib/ai/guard-rails.ts
//
// Veto with guard rails: every probe-ok model enters the chain unless the
// admin excludes it — and a few kinds of id are excluded for the admin,
// once, with a reason they can see and undo ("Include" adds the id to `keep`).
import type { ProviderId, AIModelsConfig } from './models-config';
import type { ModelProbes, ProbeResult } from './probe-types';

const NOT_A_DOCUMENT_MODEL = /(^|[-_/:.])(preview|exp|transcribe|robotics|tts|image|embedding|audio|live|omni)([-_/:.]|$)/i;

export function guardRailReason(_provider: ProviderId, r: ProbeResult): string | null {
  if (r.slow) return 'too slow (>90 s/page)';
  if (NOT_A_DOCUMENT_MODEL.test(r.id)) return 'not a document model';
  return null;
}

/** Adds guard-rail exclusions (with reasons) to a config. Pure; respects `keep`. */
export function applyGuardRails(config: AIModelsConfig, probes: ModelProbes): AIModelsConfig {
  const providers = { ...config.providers };
  for (const p of Object.keys(providers) as ProviderId[]) {
    const block = providers[p];
    const excluded = [...block.excluded];
    const excludedReason = { ...block.excludedReason };
    for (const r of Object.values(probes.providers[p]?.models ?? {})) {
      if (r.status !== 'ok' || block.keep.includes(r.id) || excluded.includes(r.id)) continue;
      const reason = guardRailReason(p, r);
      if (!reason) continue;
      excluded.push(r.id); excludedReason[r.id] = reason;
    }
    providers[p] = { ...block, excluded, excludedReason };
  }
  return { ...config, providers };
}
```

- [ ] **Step 4: Run** — PASS. (`llama-3.2-90b-vision` survives; the `it.each` list's last entry is deliberately a non-preview id.)

- [ ] **Step 5: Commit**
```bash
git add src/lib/ai/guard-rails.ts src/lib/ai/__tests__/guard-rails.test.ts
git commit -m "feat(ai): guard rails — auto-exclude slow and non-document model ids with a visible reason

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Pool from probes, probes store, `limitOf`

**Files:**
- Create: `src/lib/ai/pool.ts`, `src/stores/probes-store.ts`
- Modify: `src/hooks/useAIConfig.ts`, `src/lib/ai/rank.ts` (`RankOptions`, eligibility loop), `src/lib/ai/service.ts` (`buildPool`, `callWithFallback` rank call + `spentOut`, `getActiveImageCap`)
- Test: `src/lib/ai/__tests__/pool.test.ts` (new), `rank.test.ts`, `fallback-loop.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `migrateConfig`, `FALLBACK_MODELS`; `DEPRECATED_GEMINI_MODELS`/`DEPRECATED_GROQ_MODELS` — move these two constants from `service.ts` into `models-config.ts` (re-export from `service.ts` so existing imports keep working) to avoid a `pool.ts → service.ts` cycle.
- Produces:
  ```ts
  // pool.ts
  export function poolFromProbes(config: AIModelsConfig, probes: ModelProbes | null, keysByProvider: Partial<Record<ProviderId, string[]>>): PoolEntry[];
  export function limitOfFor(config: AIModelsConfig): (provider: ProviderId, id: string) => number;
  // probes-store.ts
  export const useProbesStore: UseBoundStore<{ probes: ModelProbes | null; loaded: boolean; setProbes(p: ModelProbes | null): void }>;
  // rank.ts
  RankOptions.limitOf?: (provider: ProviderId, id: string) => number;   // default dailyLimit
  ```

- [ ] **Step 1: Failing tests**

`pool.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { poolFromProbes, limitOfFor } from '../pool';
import { FALLBACK_AI_MODELS_CONFIG, emptyProviderConfig, type AIModelsConfig } from '../models-config';
import { EMPTY_PROBES, type ProbeResult, type ModelProbes } from '../probe-types';

const r = (id: string, over: Partial<ProbeResult> = {}): ProbeResult => ({ id, status: 'ok', reason: '', vision: true, imageCap: null, ctxWindow: 1e6, msPerPage: 3000, slow: false,
  source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' }, probedAt: 1, consecutiveFailures: 0, ...over });
const probes = (): ModelProbes => ({ ...EMPTY_PROBES, providers: { ...EMPTY_PROBES.providers,
  gemini: { probedAt: 1, error: null, accuracy: {}, models: { 'gemini-3.5-flash': r('gemini-3.5-flash'), 'gemini-1.5-flash': r('gemini-1.5-flash'), 'gemini-3.5-flash-lite': r('gemini-3.5-flash-lite', { imageCap: 3, msPerPage: 1500 }), 'gemini-dead': r('gemini-dead', { status: 'unreachable' }) } },
  ollama: { probedAt: 1, error: null, accuracy: {}, models: { 'gemma4:31b': r('gemma4:31b') } },
} });
const cfg = (gemini: Partial<ReturnType<typeof emptyProviderConfig>> = {}): AIModelsConfig => ({ ...FALLBACK_AI_MODELS_CONFIG, providers: { ...FALLBACK_AI_MODELS_CONFIG.providers, gemini: { ...emptyProviderConfig(), ...gemini } } });
const ids = (pool: ReturnType<typeof poolFromProbes>) => pool.map(e => `${e.provider}/${e.model.id}`).sort();

describe('poolFromProbes', () => {
  it('ok − excluded − retired, only providers with a key', () => {
    expect(ids(poolFromProbes(cfg({ excluded: ['gemini-3.5-flash-lite'] }), probes(), { gemini: ['g1'] }))).toEqual(['gemini/gemini-3.5-flash']);
  });
  it('carries probe metadata into the entry', () => {
    const [e] = poolFromProbes(cfg(), probes(), { gemini: ['g1'] }).filter(e => e.model.id === 'gemini-3.5-flash-lite');
    expect(e.model.imageCap).toBe(3); expect(e.msPerPage).toBe(1500); expect(e.keys).toEqual(['g1']); expect(e.proxied).toBe(false);
  });
  it('proxied providers are flagged', () => {
    expect(poolFromProbes(cfg(), probes(), { ollama: ['o1'] })[0].proxied).toBe(true);
  });
  it('disabled provider is skipped', () => {
    expect(poolFromProbes(cfg({ enabled: false }), probes(), { gemini: ['g1'] })).toEqual([]);
  });
  it('no probes → fallback models', () => {
    expect(ids(poolFromProbes(cfg(), null, { gemini: ['g1'] }))).toEqual(['gemini/gemini-2.5-flash', 'gemini/gemini-3.5-flash', 'gemini/gemini-flash-lite-latest']);
  });
  it('a legacy (schema 1) config is migrated on the fly', () => {
    const legacy = { ...cfg(), schema: undefined, providers: { ...cfg().providers, gemini: { enabled: true, defaultModel: 'gemini-3.5-flash', models: [{ id: 'gemini-3.5-flash', label: '', note: '', ctxWindow: null, vision: true, imageCap: null }] } as any } };
    expect(ids(poolFromProbes(legacy, probes(), { gemini: ['g1'] }))).toEqual(['gemini/gemini-3.5-flash']);
  });
});

describe('limitOfFor', () => {
  it('config limit overrides the table; blank falls back', () => {
    const f = limitOfFor(cfg({ limits: { 'gemini-3.5-flash': 50, 'gemini-3.5-flash-lite': 0 } }));
    expect(f('gemini', 'gemini-3.5-flash')).toBe(50);
    expect(f('gemini', 'gemini-3.5-flash-lite')).toBe(0);
    expect(f('gemini', 'gemini-2.5-flash')).toBe(20);
    expect(f('ollama', 'gemma4:31b')).toBe(Infinity);
  });
  it('ignores non-numeric or negative overrides', () => {
    const f = limitOfFor(cfg({ limits: { 'gemini-3.5-flash': -1, 'gemini-2.5-flash': NaN } }));
    expect(f('gemini', 'gemini-3.5-flash')).toBe(20); expect(f('gemini', 'gemini-2.5-flash')).toBe(20);
  });
});
```
`rank.test.ts` — append to `quota-aware ordering`:
```ts
  it('limitOf override: 0 drops the model, a bigger limit reorders inside the tier', () => {
    const limitOf = (_p: string, id: string) => id === 'gemini-3.5-flash' ? 0 : id === 'gemini-2.5-flash' ? 100 : 20;
    const r = ids(rankModels('heavy', ['i'], [entry('gemini', 'gemini-3.5-flash'), entry('gemini', 'gemini-2.5-flash'), entry('gemini', 'gemini-3.8-flash')], { health: health(), pagesNeeded: 5, limitOf }));
    expect(r).toEqual(['gemini-2.5-flash', 'gemini-3.8-flash']);
  });
```
`fallback-loop.test.ts` — the `beforeEach` sets `useAIConfigStore` config to `FALLBACK_AI_MODELS_CONFIG`; add `useProbesStore.getState().setProbes(null)` there (import from `@/stores/probes-store`) so the pool comes from `FALLBACK_MODELS` (same three Gemini ids + gemma4 as before). Add one test:
```ts
  it('admin limit override reaches the loop', async () => {
    useAIConfigStore.getState().setConfig({ ...FALLBACK_AI_MODELS_CONFIG, providers: { ...FALLBACK_AI_MODELS_CONFIG.providers, gemini: { ...FALLBACK_AI_MODELS_CONFIG.providers.gemini, limits: { 'gemini-3.5-flash': 0, 'gemini-2.5-flash': 0 } } } });
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(ok());
    const s = newSession('t'); s.pagesTotal = 2;
    await callAIGateway('p', ['img'], 'json', 'heavy', s);
    expect(modelOf(spy.mock.calls[0])).toMatch(/lite/);
  });
```

- [ ] **Step 2: Run** the three files — FAIL.

- [ ] **Step 3: Implement**

`src/stores/probes-store.ts`:
```ts
import { create } from 'zustand';
import type { ModelProbes } from '@/lib/ai/probe-types';

/** Admin probe results, readable by every signed-in surveyor; null until loaded or when the read failed. */
interface ProbesState { probes: ModelProbes | null; loaded: boolean; setProbes: (p: ModelProbes | null) => void }
export const useProbesStore = create<ProbesState>((set) => ({ probes: null, loaded: false, setProbes: (probes) => set({ probes, loaded: true }) }));
```
`useAIConfig.ts`: also `loadModelProbes().then(p => { if (!cancelled) setProbes(p.probedAt > 0 ? p : null); }).catch(() => { if (!cancelled) setProbes(null); })`.

`pool.ts`:
```ts
// src/lib/ai/pool.ts
//
// "Every model the surveyor can reach": probe-ok minus the admin's veto, for
// providers the surveyor has a key for. One function for the request path
// and the admin tab, so the admin sees the surveyor's chain by construction.
import { type AIModelsConfig, type ProviderId, FALLBACK_MODELS, migrateConfig, DEPRECATED_GEMINI_MODELS, DEPRECATED_GROQ_MODELS } from './models-config';
import type { ModelProbes } from './probe-types';
import type { PoolEntry } from './rank';
import { dailyLimit } from './quota';

const PROVIDERS: ProviderId[] = ['gemini', 'groq', 'nvidia', 'ollama'];
const PROXIED: ReadonlySet<ProviderId> = new Set(['nvidia', 'ollama']);

function retired(p: ProviderId): Record<string, string> {
  return p === 'gemini' ? DEPRECATED_GEMINI_MODELS : p === 'groq' ? DEPRECATED_GROQ_MODELS : {};
}

export function poolFromProbes(rawConfig: AIModelsConfig, probes: ModelProbes | null, keysByProvider: Partial<Record<ProviderId, string[]>>): PoolEntry[] {
  const config = migrateConfig(rawConfig, probes);
  const pool: PoolEntry[] = [];
  for (const provider of PROVIDERS) {
    const block = config.providers[provider];
    const keys = keysByProvider[provider] ?? [];
    if (!block?.enabled || keys.length === 0) continue;
    const dead = retired(provider);
    const probed = probes?.providers[provider];
    if (!probed || probed.probedAt === 0) {
      for (const m of FALLBACK_MODELS[provider]) {
        if (m.id in dead || block.excluded.includes(m.id)) continue;
        pool.push({ provider, proxied: PROXIED.has(provider), keys, model: { id: m.id, label: m.label, note: '', ctxWindow: m.ctxWindow, vision: m.vision, imageCap: m.imageCap } });
      }
      continue;
    }
    for (const r of Object.values(probed.models)) {
      if (r.status !== 'ok' || r.id in dead || block.excluded.includes(r.id)) continue;
      pool.push({ provider, proxied: PROXIED.has(provider), keys, msPerPage: r.msPerPage,
        model: { id: r.id, label: r.id, note: block.notes[r.id] ?? '', ctxWindow: r.ctxWindow, vision: r.vision, imageCap: r.imageCap } });
    }
  }
  return pool;
}

/** Admin's per-model daily limit, else the quota table. 0 = never eligible. */
export function limitOfFor(config: AIModelsConfig): (provider: ProviderId, id: string) => number {
  return (provider, id) => {
    const v = config.providers[provider]?.limits?.[id];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : dailyLimit(provider, id);
  };
}
```
`rank.ts`: `RankOptions.limitOf?`; in `rankModels` `const { health, avoid, pagesNeeded = 1, limitOf = dailyLimit } = opts;` and `const limit = limitOf(e.provider, id);`.

`service.ts`: move `DEPRECATED_GEMINI_MODELS`/`DEPRECATED_GROQ_MODELS` definitions to `models-config.ts` and `export { DEPRECATED_GEMINI_MODELS, DEPRECATED_GROQ_MODELS } from './models-config';` in service.ts (keep other importers working). Replace `buildPool` body:
```ts
export function buildPool(profile: ReturnType<typeof getProfileFromStorage>): PoolEntry[] {
  if (!profile) return [];
  const keys = Object.fromEntries((['gemini', 'groq', 'nvidia', 'ollama'] as ProviderId[]).map(p => [p, KEY_FIELDS[p](profile)]));
  return poolFromProbes(useAIConfigStore.getState().config, useProbesStore.getState().probes, keys);
}
```
In `callWithFallback`: `const limitOf = limitOfFor(useAIConfigStore.getState().config);` and pass `limitOf` to `rankModels(...)`; `spentOut` uses `limitOf(e.provider, e.model.id)` instead of `dailyLimit(...)`; the nudge's `dailyLimit(...) > 0` check likewise. `getActiveImageCap`: pass `limitOf` too. Remove now-unused `PROXIED` set in service.ts if nothing else uses it (grep).

- [ ] **Step 4: Run** `npx vitest run src/lib/ai` — PASS; `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ai/pool.ts src/stores/probes-store.ts src/hooks/useAIConfig.ts src/lib/ai/rank.ts src/lib/ai/service.ts src/lib/ai/models-config.ts src/lib/ai/__tests__
git commit -m "feat(ai): surveyor chain = probe-ok minus admin veto; admin daily limits override the quota table

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `RankedLists` component

**Files:**
- Create: `src/components/admin/ai/RankedLists.tsx`, `src/lib/ai/admin-rank.ts`
- Test: `src/lib/ai/__tests__/admin-rank.test.ts`, `src/components/admin/ai/__tests__/ranked-lists.test.tsx`

**Interfaces (produces):**
```ts
// admin-rank.ts (pure)
export const ADMIN_JOBS: { job: AIJob; label: string; pagesNeeded: number }[];   // heavy 'Estimates & bills' 5, light 'Licence · RC · policy' 1, text 'Letters & text' 1
export interface RankedRow { provider: ProviderId; id: string; tier: Tier; limit: number; msPerPage: number | null; proxied: boolean; reason: string; isNew: boolean }
export function rankedLists(config: AIModelsConfig, probes: ModelProbes | null, newIds: ReadonlySet<string>): Record<AIJob, RankedRow[]>;
export function lastEligibleFor(config: AIModelsConfig, probes: ModelProbes | null, provider: ProviderId, id: string): string | null;   // job label that would be emptied, else null
// RankedLists.tsx
export function RankedLists(props: { config: AIModelsConfig; probes: ModelProbes | null; newIds: ReadonlySet<string>;
  onExclude(provider: ProviderId, id: string): void; onInclude(provider: ProviderId, id: string): void; onLimit(provider: ProviderId, id: string, value: number | null): void }): JSX.Element;
```

- [ ] **Step 1: Failing tests**

`admin-rank.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { rankedLists, lastEligibleFor, ADMIN_JOBS } from '../admin-rank';
import { FALLBACK_AI_MODELS_CONFIG, emptyProviderConfig } from '../models-config';
import { EMPTY_PROBES, type ProbeResult, type ModelProbes } from '../probe-types';

const r = (id: string, over: Partial<ProbeResult> = {}): ProbeResult => ({ id, status: 'ok', reason: '', vision: true, imageCap: null, ctxWindow: 1e6, msPerPage: 3000, slow: false,
  source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' }, probedAt: 1, consecutiveFailures: 0, ...over });
const probes = (): ModelProbes => ({ ...EMPTY_PROBES, providers: { ...EMPTY_PROBES.providers,
  gemini: { probedAt: 1, error: null, accuracy: {}, models: { 'gemini-3.5-flash': r('gemini-3.5-flash'), 'gemini-3.5-flash-lite': r('gemini-3.5-flash-lite', { msPerPage: 1500 }), 'gemini-text': r('gemini-text', { vision: false }) } },
  ollama: { probedAt: 1, error: null, accuracy: {}, models: { 'gemma4:31b': r('gemma4:31b', { msPerPage: 12000 }) } },
} });
const cfg = FALLBACK_AI_MODELS_CONFIG;

describe('rankedLists', () => {
  it('three jobs in the loop order: heavy leads with Flash, light with Flash-Lite', () => {
    const lists = rankedLists(cfg, probes(), new Set(['gemma4:31b']));
    expect(ADMIN_JOBS.map(j => j.job)).toEqual(['heavy', 'light', 'text']);
    expect(lists.heavy[0].id).toBe('gemini-3.5-flash');
    expect(lists.light[0].id).toBe('gemini-3.5-flash-lite');
    expect(lists.heavy.map(x => x.id)).not.toContain('gemini-text');       // vision needed
    expect(lists.text.map(x => x.id)).toContain('gemini-text');
  });
  it('rows carry tier, limit, speed, proxied, NEW and a plain reason', () => {
    const row = rankedLists(cfg, probes(), new Set(['gemma4:31b'])).heavy.find(x => x.id === 'gemma4:31b')!;
    expect(row).toMatchObject({ tier: 'gemma', limit: Infinity, msPerPage: 12000, proxied: true, isNew: true });
    expect(row.reason).toBe('Gemma tier · no daily cap · 12 s/page · via proxy');
    expect(rankedLists(cfg, probes(), new Set()).heavy[0].reason).toBe('Flash tier · 20/day per key · 3 s/page');
  });
  it('excluded models are absent; a config limit shows in the row', () => {
    const c = { ...cfg, providers: { ...cfg.providers, gemini: { ...emptyProviderConfig(), excluded: ['gemini-3.5-flash'], limits: { 'gemini-3.5-flash-lite': 300 } } } };
    const lists = rankedLists(c, probes(), new Set());
    expect(lists.heavy.map(x => x.id)).not.toContain('gemini-3.5-flash');
    expect(lists.light[0]).toMatchObject({ id: 'gemini-3.5-flash-lite', limit: 300 });
  });
});

describe('lastEligibleFor', () => {
  it('names the job that would be left empty', () => {
    const c = { ...cfg, providers: { ...cfg.providers, gemini: { ...emptyProviderConfig(), excluded: ['gemini-3.5-flash', 'gemini-3.5-flash-lite'] }, ollama: { ...emptyProviderConfig(), excluded: ['gemma4:31b'] } } };
    expect(lastEligibleFor(c, probes(), 'gemini', 'gemini-text')).toBe('Letters & text');
  });
  it('null when other models remain', () => { expect(lastEligibleFor(cfg, probes(), 'gemini', 'gemini-3.5-flash')).toBeNull(); });
});
```
`ranked-lists.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RankedLists } from '@/components/admin/ai/RankedLists';
import { FALLBACK_AI_MODELS_CONFIG, emptyProviderConfig } from '@/lib/ai/models-config';
import { EMPTY_PROBES, type ProbeResult, type ModelProbes } from '@/lib/ai/probe-types';

const r = (id: string, over: Partial<ProbeResult> = {}): ProbeResult => ({ id, status: 'ok', reason: '', vision: true, imageCap: null, ctxWindow: 1e6, msPerPage: 3000, slow: false,
  source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' }, probedAt: 1, consecutiveFailures: 0, ...over });
const probes: ModelProbes = { ...EMPTY_PROBES, providers: { ...EMPTY_PROBES.providers,
  gemini: { probedAt: 1, error: null, accuracy: {}, models: { 'gemini-3.5-flash': r('gemini-3.5-flash'), 'gemini-3.5-flash-lite': r('gemini-3.5-flash-lite'), 'gemini-3-flash-preview': r('gemini-3-flash-preview') } } } };
const cfg = { ...FALLBACK_AI_MODELS_CONFIG, providers: { ...FALLBACK_AI_MODELS_CONFIG.providers, gemini: { ...emptyProviderConfig(), excluded: ['gemini-3-flash-preview'], excludedReason: { 'gemini-3-flash-preview': 'not a document model' } } } };
const noop = () => {};

describe('RankedLists', () => {
  const html = renderToStaticMarkup(<RankedLists config={cfg} probes={probes} newIds={new Set(['gemini-3.5-flash'])} onExclude={noop} onInclude={noop} onLimit={noop} />);
  it('renders the three job lists with rank numbers', () => {
    for (const label of ['Estimates & bills', 'Licence · RC · policy', 'Letters & text']) expect(html).toContain(label);
    expect(html).toContain('gemini-3.5-flash');
  });
  it('shows the NEW badge and the reason line', () => {
    expect(html).toContain('NEW');
    expect(html).toContain('Flash tier · 20/day per key · 3 s/page');
  });
  it('lists excluded models with their reason and an Include button', () => {
    expect(html).toContain('gemini-3-flash-preview');
    expect(html).toContain('not a document model');
    expect(html).toContain('Include');
  });
  it('limit input shows the table default as placeholder', () => {
    expect(html).toMatch(/placeholder="20"/);
  });
});
```

- [ ] **Step 2: Run** both — FAIL.

- [ ] **Step 3: Implement**

`src/lib/ai/admin-rank.ts`:
```ts
// The admin sees exactly what a fully-keyed surveyor's loop would try, in order.
import { type AIModelsConfig, type ProviderId } from './models-config';
import type { ModelProbes } from './probe-types';
import type { AIJob } from './jobs';
import { rankModels, type PoolEntry } from './rank';
import { createHealth } from './health';
import { poolFromProbes, limitOfFor } from './pool';
import { tierOf, type Tier } from './quota';

export const ADMIN_JOBS: { job: AIJob; label: string; pagesNeeded: number }[] = [
  { job: 'heavy', label: 'Estimates & bills', pagesNeeded: 5 },
  { job: 'light', label: 'Licence · RC · policy', pagesNeeded: 1 },
  { job: 'text', label: 'Letters & text', pagesNeeded: 1 },
];
const ALL_KEYS: Record<ProviderId, string[]> = { gemini: ['admin'], groq: ['admin'], nvidia: ['admin'], ollama: ['admin'] };
const TIER_LABEL: Record<Tier, string> = { flash: 'Flash tier', lite: 'Flash-Lite tier', gemma: 'Gemma tier' };

export interface RankedRow { provider: ProviderId; id: string; tier: Tier; limit: number; msPerPage: number | null; proxied: boolean; reason: string; isNew: boolean }

function reasonFor(e: PoolEntry, tier: Tier, limit: number): string {
  const parts = [TIER_LABEL[tier], limit === Infinity ? 'no daily cap' : limit === 0 ? 'off' : `${limit}/day per key`];
  parts.push(e.msPerPage == null ? 'speed untested' : `${Math.round(e.msPerPage / 1000)} s/page`);
  if (e.proxied) parts.push('via proxy');
  return parts.join(' · ');
}

function rankFor(job: AIJob, pagesNeeded: number, config: AIModelsConfig, probes: ModelProbes | null): PoolEntry[] {
  const pool = poolFromProbes(config, probes, ALL_KEYS);
  try {
    return rankModels(job, job === 'text' ? [] : ['x'], pool, { health: createHealth(null), pagesNeeded, limitOf: limitOfFor(config) });
  } catch { return []; }   // PayloadTooLargeError cannot happen with one image, but never let the admin tab crash
}

export function rankedLists(config: AIModelsConfig, probes: ModelProbes | null, newIds: ReadonlySet<string>): Record<AIJob, RankedRow[]> {
  const limitOf = limitOfFor(config);
  const out = {} as Record<AIJob, RankedRow[]>;
  for (const { job, pagesNeeded } of ADMIN_JOBS) {
    out[job] = rankFor(job, pagesNeeded, config, probes).map(e => {
      const tier = tierOf(e.provider, e.model.id), limit = limitOf(e.provider, e.model.id);
      return { provider: e.provider, id: e.model.id, tier, limit, msPerPage: e.msPerPage ?? null, proxied: e.proxied, reason: reasonFor(e, tier, limit), isNew: newIds.has(e.model.id) };
    });
  }
  return out;
}

/** The job label that excluding `id` would leave with no model, else null. */
export function lastEligibleFor(config: AIModelsConfig, probes: ModelProbes | null, provider: ProviderId, id: string): string | null {
  const block = config.providers[provider];
  const after = { ...config, providers: { ...config.providers, [provider]: { ...block, excluded: [...block.excluded, id] } } };
  for (const { job, label, pagesNeeded } of ADMIN_JOBS) {
    const before = rankFor(job, pagesNeeded, config, probes);
    if (before.some(e => e.provider === provider && e.model.id === id) && rankFor(job, pagesNeeded, after, probes).length === 0) return label;
  }
  return null;
}
```

`src/components/admin/ai/RankedLists.tsx`:
```tsx
'use client';
import { Ban, RotateCcw } from 'lucide-react';
import type { AIModelsConfig, ProviderId } from '@/lib/ai/models-config';
import type { ModelProbes } from '@/lib/ai/probe-types';
import { rankedLists, lastEligibleFor, ADMIN_JOBS, type RankedRow } from '@/lib/ai/admin-rank';
import { dailyLimit } from '@/lib/ai/quota';
import { toast } from 'sonner';

const PROVIDER_LABEL: Record<ProviderId, string> = { gemini: 'Gemini', groq: 'Groq', nvidia: 'NVIDIA', ollama: 'Ollama' };

interface Props {
  config: AIModelsConfig; probes: ModelProbes | null; newIds: ReadonlySet<string>;
  onExclude: (provider: ProviderId, id: string) => void;
  onInclude: (provider: ProviderId, id: string) => void;
  onLimit: (provider: ProviderId, id: string, value: number | null) => void;
}

/** What the surveyor's loop will try, per job, in order — with the one lever per row: Exclude. */
export function RankedLists({ config, probes, newIds, onExclude, onInclude, onLimit }: Props) {
  const lists = rankedLists(config, probes, newIds);
  const excluded = (Object.keys(config.providers) as ProviderId[]).flatMap(p =>
    config.providers[p].excluded.map(id => ({ provider: p, id, reason: config.providers[p].excludedReason[id] ?? 'excluded by you' })));

  const exclude = (row: RankedRow) => {
    const empty = lastEligibleFor(config, probes, row.provider, row.id);
    if (empty) { toast.error(`${empty} would have no model left.`); return; }
    onExclude(row.provider, row.id);
  };

  return (
    <div className="space-y-4">
      {ADMIN_JOBS.map(({ job, label }) => (
        <div key={job} className="bg-white rounded-2xl border border-border shadow-sm p-4">
          <h3 className="text-sm font-medium text-foreground mb-2">{label}</h3>
          {lists[job].length === 0 ? (
            <p className="text-xs text-status-danger">No model — every candidate is excluded or off.</p>
          ) : (
            <ol className="space-y-1">
              {lists[job].map((row, i) => {
                const custom = config.providers[row.provider].limits[row.id];
                return (
                  <li key={`${row.provider}/${row.id}`} className="flex items-center gap-3 text-xs">
                    <span className="w-5 text-right text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="font-mono text-foreground truncate">{PROVIDER_LABEL[row.provider]} · {row.id}</span>
                    {row.isNew && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-status-success-tint text-status-success">NEW</span>}
                    <span className="text-muted-foreground truncate flex-1">{row.reason}</span>
                    <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      /day
                      <input type="number" min={0} className="w-16 px-1.5 py-0.5 rounded border border-border text-xs text-right"
                        value={typeof custom === 'number' ? custom : ''}
                        placeholder={String(dailyLimit(row.provider, row.id) === Infinity ? '∞' : dailyLimit(row.provider, row.id))}
                        onChange={e => onLimit(row.provider, row.id, e.target.value === '' ? null : Number(e.target.value))} />
                    </label>
                    <button onClick={() => exclude(row)} title="Exclude from every job"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border border-border text-muted-foreground hover:text-status-danger">
                      <Ban size={11} /> Exclude
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ))}
      {excluded.length > 0 && (
        <details className="bg-white rounded-2xl border border-border shadow-sm p-4">
          <summary className="text-sm font-medium text-foreground cursor-pointer">Excluded ({excluded.length})</summary>
          <ul className="mt-2 space-y-1">
            {excluded.map(x => (
              <li key={`${x.provider}/${x.id}`} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-foreground">{PROVIDER_LABEL[x.provider]} · {x.id}</span>
                <span className="text-muted-foreground flex-1">{x.reason}</span>
                <button onClick={() => onInclude(x.provider, x.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border border-border text-muted-foreground hover:text-foreground">
                  <RotateCcw size={11} /> Include
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
```
(`renderToStaticMarkup` of a `'use client'` component works in node — `AIReviewDialog` is tested the same way. `sonner` needs no DOM at import time; if it throws in node, `vi.mock('sonner', () => ({ toast: { error: () => {} } }))` at the top of the test.)

- [ ] **Step 4: Run** both test files — PASS; `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ai/admin-rank.ts src/components/admin/ai/RankedLists.tsx src/lib/ai/__tests__/admin-rank.test.ts src/components/admin/ai/__tests__/ranked-lists.test.tsx
git commit -m "feat(admin): ranked lists per job — the loop's own order, Exclude/Include, editable daily limits

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Admin tab rewrite + `ProviderCard`

**Files:**
- Create: `src/components/admin/ai/ProviderCard.tsx`
- Rewrite: `src/components/admin/tabs/AIModelsTab.tsx`
- Delete: `src/lib/ai/probe-reconcile.ts` + its test (dead: the tick list is gone; a model that stops working simply isn't `ok` anymore) — only if `grep -rn reconcileEnabledModels src` shows no other caller.

**Interfaces:**
- Consumes: Tasks 1–4 (`migrateConfig`, `applyGuardRails`, `RankedLists`, `emptyProviderConfig`, `useProbesStore`).
- Produces: `ProviderCard(props: { provider: ProviderId; meta: { label: string; color: string }; block: ProviderConfig; probe: ProviderProbe; diff: ProbeDiff; hasKey: boolean; probing: boolean; onToggleProvider(): void; onProbe(): void; onTest(modelId: string, file: File): void; testing: string | null; testResult: Record<string, ModelTestResult>; testProgress: string; onNote(id: string, note: string): void })`.

- [ ] **Step 1: `ProviderCard.tsx`** — move from the old tab: the provider header (enable toggle, colour dot, label, key-present hint, per-provider Probe button), the **discovery line** computed as
  `${found} found · ${inChain} in chain · ${diff.added.length} NEW · ${autoExcluded} auto-excluded · ${byAdmin} excluded by you · ${hidden} not served / paid / retired (hidden)` where `found = Object.keys(probe.models).length`, `okIds = ok models`, `autoExcluded = okIds ∩ excluded with a reason`, `byAdmin = okIds ∩ excluded without reason`, `inChain = okIds − excluded`, `hidden = found − okIds.length`; the collapsible hidden group (old "unusable" list, plus retired ids labelled "retired"); per-model **Test with estimate PDF** button and result (old `runTest` UI) for in-chain models; the note textarea per in-chain model (`onNote`). No checkbox, no ★, no buckets, no accuracy button/badge. Keep the existing Tailwind classes and the `badge()` helper (move it here).

- [ ] **Step 2: `AIModelsTab.tsx` rewrite** (target ≤ 220 lines). State: `config`, `probes`, `prevProbes`, `probing`, `probeStatus`, `saving`, `testing`, `testResult`, `testProgress`. Load: `Promise.all([loadAIModelsConfig(), loadModelProbes()])` then `setConfig(migrateConfig(cfg, probes.probedAt > 0 ? probes : null))`. `probeAll` as today minus the reconcile block; after `saveModelProbes(next)`: `const railed = applyGuardRails(config, next); setConfig(railed); await saveAIModelsConfig(railed, adminEmail); setStoreConfig(railed); useProbesStore.getState().setProbes(next);` and toast `Probe complete — N in chain, M auto-excluded (see Excluded).` `probeOne(p)` likewise applies guard rails for that provider. Handlers: `onExclude(p, id)` → `excluded + id` (delete any `excludedReason[id]`); `onInclude(p, id)` → remove from `excluded`/`excludedReason`, add to `keep` if it had a reason; `onLimit(p, id, v)` → `v === null ? delete limits[id] : limits[id] = v`; `onNote(p, id, note)`; `toggleProvider`. `save()` → `saveAIModelsConfig({ ...config, schema: 2 })`, `setStoreConfig`, `useProbesStore` untouched. Layout: header (text + Refresh & probe + Save), probing banner, `<RankedLists …/>`, then one `<ProviderCard …/>` per provider. Benchmark card and accuracy runner removed from the JSX (leave `probe-accuracy.ts`/`benchmark-doc.ts` modules in place, untouched). Remove unused imports (`Star`, `Check`, `FlaskConical`, `classifyModel`, `reconcileEnabledModels`, `runAccuracyProbe`, `getBenchmarkDoc`, `BenchmarkUploader`).

- [ ] **Step 3: Verify** `npx tsc --noEmit` clean; `npx vitest run` green (delete `probe-reconcile.test.ts` with the module; `model-classify.ts` may become unused — leave it, 2-B decides). `npm run build` succeeds (static export compiles the admin page).

- [ ] **Step 4: Commit**
```bash
git add src/components/admin src/lib/ai
git commit -m "feat(admin): AI Models tab is veto-based — discovery line, ranked lists, guard rails on probe; tick list, default star and buckets removed

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Docs and verification

**Files:** `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`, `Tasks.md`, new `Sessions/2026-09-17-admin-ranked-lists.md`; `docs/superpowers/plans/2026-09-15-ai-fallback-phase-1.md` Task 14 table (+L11).

- [ ] **Step 1:** `npx tsc --noEmit && npm test` — clean/green.
- [ ] **Step 2:** Session log: what changed, rules (chain = ok − excluded; guard-rail patterns; limits; migration), admin how-to (Probe → review Excluded → Save), L11 procedure from the spec §7, carried minors, and the note that `AIControls.tsx` pickers + `models`/`defaultModel` legacy fields go in 2-D.
- [ ] **Step 3:** Changelog entry + Tasks.md (2-C done; L11 + deploy open; 2-B, 2-D open).
- [ ] **Step 4: Commit** `docs: session log, changelog and tasks — admin ranked lists (Phase 2-C)` with attribution. Do NOT deploy.

---

## Self-review
- **Spec coverage:** §1 → Task 1; §2 → Task 3; §3 → Task 2 + Task 5 (applied on probe); §4 → Tasks 4, 5 (discovery line, lists, Exclude guard, removals, `schema: 2` on save); §5 → Task 3 (`limitOf`, `limitOfFor`); §6 → Task 3 (fallback on null probes; legacy path untouched), Task 4 (`lastEligibleFor`), Task 3 (`limitOfFor` ignores bad values); §7 → tests in Tasks 1–4, L11 in Task 6.
- **Placeholders:** none. Task 5 is prose-heavy by necessity (moving existing JSX); the behaviours it must keep/remove are enumerated.
- **Type consistency:** `emptyProviderConfig`, `migrateConfig`, `FALLBACK_MODELS` (Task 1) used in Tasks 3–5; `applyGuardRails` (Task 2) in Task 5; `poolFromProbes`/`limitOfFor` (Task 3) in Task 4; `rankedLists`/`lastEligibleFor`/`ADMIN_JOBS` (Task 4) in `RankedLists`; `RankedLists` props match Task 5 handlers; `RankOptions.limitOf` name consistent in Tasks 3 and 4.
