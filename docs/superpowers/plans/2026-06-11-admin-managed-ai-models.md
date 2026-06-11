# Admin-Managed AI Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin curate which AI models each provider exposes (Gemini/Groq/NVIDIA) from the Admin portal — backed by Firestore, with auto-discovery, decision-aid badges + notes, a provider on/off + NVIDIA selectability fix, and a live sample-estimate-PDF test — so model changes never require a code edit.

**Architecture:** A Firestore doc `ai_config/models` is the source of truth, loaded into a Zustand store on app start and consumed by `ProviderToggle`/`ModelSelector`. Discovery fetchers call each provider's list-models endpoint with the admin's own keys. Hardcoded `PROVIDER_MODELS`/`CURRENT_MODELS` remain only as offline fallback. The live test reuses the existing `extractDocument` pipeline via a module-level provider override in `service.ts`.

**Tech Stack:** Next.js 16 (static export), React, Zustand (+persist), Firebase Firestore, Vitest, lucide-react, sonner.

**Spec:** `docs/superpowers/specs/2026-06-11-admin-managed-ai-models-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/ai/models-config.ts` (new) | Config types, provider image-cap constants, `computeEstimateCapacity` pure helper, hardcoded fallback config, Firestore `load`/`save` repository |
| `src/lib/ai/__tests__/models-config.test.ts` (new) | Tests for capacity helper + fallback + repository |
| `src/lib/ai/discovery.ts` (new) | `isLikelyVisionModel` heuristic + `fetchNvidiaModels` + `fetchGroqModels` |
| `src/lib/ai/__tests__/discovery.test.ts` (new) | Tests for heuristic + fetch mapping |
| `src/lib/ai/service.ts` (modify) | Config-aware resolvers + fallback; `setAITestOverride`/override path in `callAIGateway`; `runModelTest` |
| `src/stores/ai-config-store.ts` (new) | Holds loaded `AIModelsConfig` for surveyor-side consumption |
| `src/hooks/useAIConfig.ts` (new) | Loads `ai_config/models` into the store on app start |
| `src/components/layout/Dashboard.tsx` (modify) | Call `useAIConfig()` so config loads with the app |
| `src/components/ai/AIControls.tsx` (modify) | `ProviderToggle` renders enabled providers (incl. NVIDIA); `ModelSelector` reads curated config |
| `src/components/admin/types.ts` (modify) | Add `'ai-models'` to `AdminTab` |
| `src/components/admin/AdminDashboard.tsx` (modify) | Add the "AI Models" tab button + content |
| `src/components/admin/tabs/AIModelsTab.tsx` (new) | Admin curation UI: cards, discovery, badges, notes, save, live test |
| `firestore.rules` (modify) | `ai_config/models` — admin write, signed-in read |

---

## Phase 1 — Config foundation

### Task 1: Config types + capacity helper

**Files:**
- Create: `src/lib/ai/models-config.ts`
- Test: `src/lib/ai/__tests__/models-config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/ai/__tests__/models-config.test.ts
import { describe, it, expect } from 'vitest';
import { computeEstimateCapacity, PROVIDER_IMAGE_CAPS, FALLBACK_AI_MODELS_CONFIG } from '../models-config';

describe('computeEstimateCapacity', () => {
  it('flags text-only models as unfit for scanned estimates', () => {
    expect(computeEstimateCapacity({ vision: false, ctxWindow: 128000, imageCap: null }))
      .toBe('text only · not for scanned estimates');
  });

  it('warns when image cap is 5 or fewer (Groq)', () => {
    expect(computeEstimateCapacity({ vision: true, ctxWindow: 131072, imageCap: 5 }))
      .toBe('vision · max 5 images · not ideal for 6-page scans');
  });

  it('approves uncapped vision models with a context badge', () => {
    expect(computeEstimateCapacity({ vision: true, ctxWindow: 1_000_000, imageCap: null }))
      .toBe('vision · ~1M ctx · handles 6+ page scanned estimates');
  });

  it('omits the context badge when ctxWindow is unknown', () => {
    expect(computeEstimateCapacity({ vision: true, ctxWindow: null, imageCap: null }))
      .toBe('vision · handles 6+ page scanned estimates');
  });
});

describe('constants', () => {
  it('caps Groq at 5 images, others uncapped', () => {
    expect(PROVIDER_IMAGE_CAPS).toEqual({ gemini: null, groq: 5, nvidia: null });
  });
  it('ships a non-empty fallback config for all three providers', () => {
    expect(FALLBACK_AI_MODELS_CONFIG.providers.gemini.models.length).toBeGreaterThan(0);
    expect(FALLBACK_AI_MODELS_CONFIG.providers.groq.models.length).toBeGreaterThan(0);
    expect(FALLBACK_AI_MODELS_CONFIG.providers.nvidia.models.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/models-config.test.ts`
Expected: FAIL — `Cannot find module '../models-config'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/ai/models-config.ts
export type ProviderId = 'gemini' | 'groq' | 'nvidia';

export interface ModelEntry {
  id: string;
  label: string;
  note: string;          // admin free-text guidance
  ctxWindow: number | null;
  vision: boolean;
  imageCap: number | null;
  estimateCapacity: string;
}

export interface ProviderConfig {
  enabled: boolean;
  defaultModel: string;
  models: ModelEntry[];
}

export interface AIModelsConfig {
  updatedAt: number | null;
  updatedBy: string;
  defaultProvider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
}

/** Per-provider image cap. Groq accepts max 5 images; others are uncapped. */
export const PROVIDER_IMAGE_CAPS: Record<ProviderId, number | null> = {
  gemini: null,
  groq: 5,
  nvidia: null,
};

/** Formats a context window token count into a short badge string (1M, 131K). */
export function formatCtx(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Honest, use-case-framed verdict for handling multi-page estimate PDFs. */
export function computeEstimateCapacity(input: {
  vision: boolean;
  ctxWindow: number | null;
  imageCap: number | null;
}): string {
  const { vision, ctxWindow, imageCap } = input;
  if (!vision) return 'text only · not for scanned estimates';
  if (imageCap !== null && imageCap <= 5) {
    return `vision · max ${imageCap} images · not ideal for 6-page scans`;
  }
  const ctx = ctxWindow ? `~${formatCtx(ctxWindow)} ctx · ` : '';
  return `vision · ${ctx}handles 6+ page scanned estimates`;
}

function entry(p: ProviderId, id: string, label: string, note: string, ctxWindow: number | null, vision: boolean): ModelEntry {
  const imageCap = PROVIDER_IMAGE_CAPS[p];
  return { id, label, note, ctxWindow, vision, imageCap, estimateCapacity: computeEstimateCapacity({ vision, ctxWindow, imageCap }) };
}

/** Offline fallback used when Firestore is unreachable or the doc is absent. */
export const FALLBACK_AI_MODELS_CONFIG: AIModelsConfig = {
  updatedAt: null,
  updatedBy: 'fallback',
  defaultProvider: 'gemini',
  providers: {
    gemini: {
      enabled: true,
      defaultModel: 'gemini-2.5-flash',
      models: [
        entry('gemini', 'gemini-2.5-pro', '2.5 Pro', 'Most capable · deep reasoning', 1_000_000, true),
        entry('gemini', 'gemini-2.5-flash', '2.5 Flash', 'Best value · 10 RPM · 500/day', 1_000_000, true),
        entry('gemini', 'gemini-2.5-flash-lite', '2.5 Flash-Lite', 'Fastest · 15 RPM · 1000/day', 1_000_000, true),
      ],
    },
    groq: {
      enabled: true,
      defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
      models: [
        entry('groq', 'meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout', 'Vision + text · free tier', 131_072, true),
        entry('groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B', 'Text only · reliable', 131_072, false),
      ],
    },
    nvidia: {
      enabled: true,
      defaultModel: 'meta/llama-3.2-90b-vision-instruct',
      models: [
        entry('nvidia', 'meta/llama-3.2-90b-vision-instruct', 'Llama 3.2 90B', 'Best vision', 128_000, true),
        entry('nvidia', 'meta/llama-3.2-11b-vision-instruct', 'Llama 3.2 11B', 'Smaller · faster', 128_000, true),
      ],
    },
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/models-config.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/models-config.ts src/lib/ai/__tests__/models-config.test.ts
git commit -m "feat(ai): config types, image caps, estimate-capacity helper, fallback config"
```

---

### Task 2: Firestore repository (load/save config)

**Files:**
- Modify: `src/lib/ai/models-config.ts`
- Test: `src/lib/ai/__tests__/models-config.test.ts`

- [ ] **Step 1: Write the failing test** (append to existing test file)

```typescript
import { vi } from 'vitest';
import { mergeWithFallback } from '../models-config';

describe('mergeWithFallback', () => {
  it('returns fallback when raw is null', () => {
    expect(mergeWithFallback(null)).toEqual(FALLBACK_AI_MODELS_CONFIG);
  });

  it('fills missing providers from fallback but keeps provided ones', () => {
    const raw = {
      updatedAt: 123, updatedBy: 'admin@x.com', defaultProvider: 'nvidia',
      providers: { nvidia: { enabled: true, defaultModel: 'meta/llama-3.2-90b-vision-instruct', models: [] } },
    };
    const merged = mergeWithFallback(raw as any);
    expect(merged.defaultProvider).toBe('nvidia');
    expect(merged.providers.gemini.models.length).toBeGreaterThan(0); // backfilled
    expect(merged.providers.nvidia.models).toEqual([]);               // kept
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/models-config.test.ts`
Expected: FAIL — `mergeWithFallback` not exported.

- [ ] **Step 3: Write minimal implementation** (append to `src/lib/ai/models-config.ts`)

```typescript
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

const PROVIDER_IDS: ProviderId[] = ['gemini', 'groq', 'nvidia'];

/** Backfills any missing provider blocks from the fallback so the UI never crashes. */
export function mergeWithFallback(raw: Partial<AIModelsConfig> | null): AIModelsConfig {
  if (!raw || !raw.providers) return FALLBACK_AI_MODELS_CONFIG;
  const providers = { ...FALLBACK_AI_MODELS_CONFIG.providers };
  for (const p of PROVIDER_IDS) {
    if (raw.providers[p]) providers[p] = raw.providers[p]!;
  }
  return {
    updatedAt: raw.updatedAt ?? null,
    updatedBy: raw.updatedBy ?? 'unknown',
    defaultProvider: raw.defaultProvider ?? FALLBACK_AI_MODELS_CONFIG.defaultProvider,
    providers,
  };
}

/** Loads the admin model config from Firestore; falls back gracefully on any error. */
export async function loadAIModelsConfig(): Promise<AIModelsConfig> {
  try {
    const snap = await getDoc(doc(db, 'ai_config', 'models'));
    if (!snap.exists()) return FALLBACK_AI_MODELS_CONFIG;
    return mergeWithFallback(snap.data() as Partial<AIModelsConfig>);
  } catch {
    return FALLBACK_AI_MODELS_CONFIG;
  }
}

/** Admin-only write. Caller must be admin (enforced by Firestore rules). */
export async function saveAIModelsConfig(config: AIModelsConfig, updatedBy: string): Promise<void> {
  await setDoc(doc(db, 'ai_config', 'models'), {
    ...config,
    updatedAt: Date.now(),
    updatedBy,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/models-config.test.ts`
Expected: PASS (8 tests). (load/save hit Firestore and are verified manually in Task 11's E2E.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/models-config.ts src/lib/ai/__tests__/models-config.test.ts
git commit -m "feat(ai): Firestore load/save + mergeWithFallback for model config"
```

---

### Task 3: Firestore security rule for `ai_config/models`

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add the rule** (insert after the existing `match /ai_config/routing { … }` block)

```
    // AI model catalog — admin curates, all signed-in surveyors read.
    // Contains NO secrets (model ids/labels only); keys stay per-user.
    match /ai_config/models {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
```

- [ ] **Step 2: Verify rules compile**

Run: `npx firebase-tools deploy --only firestore:rules --dry-run`
Expected: "rules file compiled successfully" (no syntax errors). If `--dry-run` is unsupported, run `npx firebase-tools firestore:rules:canary` is NOT needed — instead just confirm `firebase deploy --only firestore:rules` reports a successful compile when you deploy in Task 14's rollout.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(firestore): ai_config/models rule — admin write, signed-in read"
```

---

## Phase 2 — Discovery layer

### Task 4: Vision heuristic + NVIDIA/Groq discovery fetchers

**Files:**
- Create: `src/lib/ai/discovery.ts`
- Test: `src/lib/ai/__tests__/discovery.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/ai/__tests__/discovery.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isLikelyVisionModel, fetchNvidiaModels, fetchGroqModels } from '../discovery';

describe('isLikelyVisionModel', () => {
  it('matches known vision families', () => {
    ['meta/llama-3.2-90b-vision-instruct', 'meta/llama-4-maverick-17b-128e-instruct',
     'google/gemma-3-12b-it', 'microsoft/phi-3-vision-128k-instruct',
     'nvidia/nemotron-nano-12b-v2-vl'].forEach(id =>
      expect(isLikelyVisionModel(id)).toBe(true));
  });
  it('rejects text-only / embedding / safety models', () => {
    ['meta/llama-3.2-3b-instruct', 'nvidia/llama-3.2-nv-embedqa-1b-v1',
     'nvidia/nemotron-content-safety-reasoning-4b'].forEach(id =>
      expect(isLikelyVisionModel(id)).toBe(false));
  });
});

describe('fetchNvidiaModels', () => {
  afterEach(() => vi.restoreAllMocks());
  it('maps the OpenAI-style list response to ModelEntry rows', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'meta/llama-3.2-90b-vision-instruct' }, { id: 'meta/llama-3.2-3b-instruct' }] }),
    } as Response);
    const rows = await fetchNvidiaModels('nvapi-test');
    expect(rows).not.toBeNull();
    const vision = rows!.find(r => r.id === 'meta/llama-3.2-90b-vision-instruct');
    expect(vision!.vision).toBe(true);
    expect(vision!.imageCap).toBeNull();
    expect(rows!.find(r => r.id === 'meta/llama-3.2-3b-instruct')!.vision).toBe(false);
  });
  it('returns null on HTTP error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    expect(await fetchNvidiaModels('bad')).toBeNull();
  });
});

describe('fetchGroqModels', () => {
  afterEach(() => vi.restoreAllMocks());
  it('maps Groq list response and caps images at 5', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'meta-llama/llama-4-scout-17b-16e-instruct' }] }),
    } as Response);
    const rows = await fetchGroqModels('gsk-test');
    expect(rows![0].imageCap).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/discovery.test.ts`
Expected: FAIL — `Cannot find module '../discovery'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/ai/discovery.ts
import { ModelEntry, PROVIDER_IMAGE_CAPS, computeEstimateCapacity } from './models-config';

/**
 * Heuristic for NVIDIA/Groq, whose /models endpoints return only an id.
 * Matches known multimodal families; excludes embedding/safety/guard/text-only.
 */
export function isLikelyVisionModel(id: string): boolean {
  const s = id.toLowerCase();
  if (/embed|guard|safety|reward|retriev|nemoretriever|parse|reranking|tts|whisper/.test(s)) return false;
  return /vision|-vl\b|vl-|maverick|gemma-3|gemma-4|phi-3-vision|phi-4|llama-4|nemotron-nano-\d+b-v\d+-vl|pixtral|qwen.*vl/.test(s);
}

function mapList(provider: 'nvidia' | 'groq', ids: string[]): ModelEntry[] {
  const imageCap = PROVIDER_IMAGE_CAPS[provider];
  const ctxWindow = provider === 'groq' ? 131_072 : 128_000; // provider default; endpoints don't report it
  return ids
    .filter(id => !!id)
    .sort()
    .map(id => {
      const vision = isLikelyVisionModel(id);
      return {
        id,
        label: id.split('/').pop() ?? id,
        note: '',
        ctxWindow,
        vision,
        imageCap,
        estimateCapacity: computeEstimateCapacity({ vision, ctxWindow, imageCap }),
      };
    });
}

async function fetchOpenAIStyleModels(url: string, key: string): Promise<string[] | null> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const list: Array<{ id: string }> = data.data ?? [];
    return list.map(m => m.id);
  } catch {
    return null;
  }
}

export async function fetchNvidiaModels(key: string): Promise<ModelEntry[] | null> {
  const ids = await fetchOpenAIStyleModels('https://integrate.api.nvidia.com/v1/models', key);
  return ids ? mapList('nvidia', ids) : null;
}

export async function fetchGroqModels(key: string): Promise<ModelEntry[] | null> {
  const ids = await fetchOpenAIStyleModels('https://api.groq.com/openai/v1/models', key);
  return ids ? mapList('groq', ids) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/discovery.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/discovery.ts src/lib/ai/__tests__/discovery.test.ts
git commit -m "feat(ai): NVIDIA/Groq model discovery + vision heuristic"
```

---

### Task 5: Gemini discovery → ModelEntry shape

**Files:**
- Modify: `src/lib/ai/service.ts` (the existing `fetchAvailableGeminiModels`)
- Create: `src/lib/ai/__tests__/gemini-discovery.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/ai/__tests__/gemini-discovery.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchGeminiModelEntries } from '../service';

describe('fetchGeminiModelEntries', () => {
  afterEach(() => vi.restoreAllMocks());
  it('maps ListModels into ModelEntry with ctxWindow + vision + uncapped images', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ models: [
        { name: 'models/gemini-3.5-flash', displayName: '3.5 Flash', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-004', displayName: 'Embed', supportedGenerationMethods: ['embedContent'] },
      ] }),
    } as Response);
    const rows = await fetchGeminiModelEntries('AIza-test');
    expect(rows).not.toBeNull();
    expect(rows!.length).toBe(1);
    expect(rows![0]).toMatchObject({ id: 'gemini-3.5-flash', vision: true, imageCap: null, ctxWindow: 1048576 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/gemini-discovery.test.ts`
Expected: FAIL — `fetchGeminiModelEntries` not exported.

- [ ] **Step 3: Add implementation** (append near `fetchAvailableGeminiModels` in `src/lib/ai/service.ts`)

```typescript
import { ModelEntry, PROVIDER_IMAGE_CAPS, computeEstimateCapacity } from './models-config';

/** Like fetchAvailableGeminiModels but returns full ModelEntry rows (ctx, vision, capacity). */
export async function fetchGeminiModelEntries(apiKey: string): Promise<ModelEntry[] | null> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${apiKey}`);
    if (!res.ok) return null;
    const data = await res.json();
    const raw: Array<{ name: string; displayName?: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }> = data.models ?? [];
    const imageCap = PROVIDER_IMAGE_CAPS.gemini;
    const rows = raw
      .filter(m => {
        const n = m.name;
        return m.supportedGenerationMethods?.includes('generateContent') &&
          n.startsWith('models/gemini-') &&
          !/embedding|aqa|-tts|-image|-live|robotics|computer-use|deep-research|-exp/.test(n);
      })
      .map(m => {
        const id = m.name.replace('models/', '');
        const ctxWindow = m.inputTokenLimit ?? null;
        const vision = true; // gemini-* generateContent models are multimodal
        return { id, label: m.displayName ?? id, note: '', ctxWindow, vision, imageCap,
          estimateCapacity: computeEstimateCapacity({ vision, ctxWindow, imageCap }) };
      });
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/gemini-discovery.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/service.ts src/lib/ai/__tests__/gemini-discovery.test.ts
git commit -m "feat(ai): fetchGeminiModelEntries returns full ModelEntry rows"
```

---

## Phase 3 — Surveyor consumption

### Task 6: AI config store + loader hook

**Files:**
- Create: `src/stores/ai-config-store.ts`
- Create: `src/hooks/useAIConfig.ts`
- Modify: `src/components/layout/Dashboard.tsx`

- [ ] **Step 1: Write the store** (`src/stores/ai-config-store.ts`)

```typescript
import { create } from 'zustand';
import { AIModelsConfig, FALLBACK_AI_MODELS_CONFIG } from '@/lib/ai/models-config';

interface AIConfigState {
  config: AIModelsConfig;
  loaded: boolean;
  setConfig: (config: AIModelsConfig) => void;
}

export const useAIConfigStore = create<AIConfigState>((set) => ({
  config: FALLBACK_AI_MODELS_CONFIG,
  loaded: false,
  setConfig: (config) => set({ config, loaded: true }),
}));
```

- [ ] **Step 2: Write the loader hook** (`src/hooks/useAIConfig.ts`)

```typescript
import { useEffect } from 'react';
import { loadAIModelsConfig } from '@/lib/ai/models-config';
import { useAIConfigStore } from '@/stores/ai-config-store';

/** Loads the admin-curated AI model config once on app start. */
export function useAIConfig(): void {
  const setConfig = useAIConfigStore(s => s.setConfig);
  useEffect(() => {
    let cancelled = false;
    loadAIModelsConfig().then(cfg => { if (!cancelled) setConfig(cfg); });
    return () => { cancelled = true; };
  }, [setConfig]);
}
```

- [ ] **Step 3: Wire into Dashboard** — in `src/components/layout/Dashboard.tsx`, add the import and call it inside the `Dashboard` component beside `useRouteSync()`.

```typescript
import { useAIConfig } from '@/hooks/useAIConfig';
// …
export default function Dashboard() {
  const { activeTab } = useUIStore();
  useRouteSync();
  useAIConfig();   // ← add this line
  // …
```

- [ ] **Step 4: Verify typecheck + build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/stores/ai-config-store.ts src/hooks/useAIConfig.ts src/components/layout/Dashboard.tsx
git commit -m "feat(ai): ai-config store + useAIConfig loader wired into Dashboard"
```

---

### Task 7: Config-aware resolvers + fallback in service.ts

**Files:**
- Modify: `src/lib/ai/service.ts`
- Test: `src/lib/ai/__tests__/resolve-model.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/ai/__tests__/resolve-model.test.ts
import { describe, it, expect } from 'vitest';
import { resolveEnabledModel } from '../service';
import type { ProviderConfig } from '../models-config';

const cfg: ProviderConfig = {
  enabled: true,
  defaultModel: 'gemini-2.5-flash',
  models: [
    { id: 'gemini-2.5-flash', label: 'x', note: '', ctxWindow: null, vision: true, imageCap: null, estimateCapacity: '' },
    { id: 'gemini-3.5-flash', label: 'y', note: '', ctxWindow: null, vision: true, imageCap: null, estimateCapacity: '' },
  ],
};

describe('resolveEnabledModel', () => {
  it('keeps the saved model when it is still enabled', () => {
    expect(resolveEnabledModel('gemini-3.5-flash', cfg)).toBe('gemini-3.5-flash');
  });
  it('falls back to defaultModel when the saved model was disabled', () => {
    expect(resolveEnabledModel('gemini-1.5-flash', cfg)).toBe('gemini-2.5-flash');
  });
  it('falls back to defaultModel when nothing is saved', () => {
    expect(resolveEnabledModel(undefined, cfg)).toBe('gemini-2.5-flash');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/resolve-model.test.ts`
Expected: FAIL — `resolveEnabledModel` not exported.

- [ ] **Step 3: Add the pure resolver** (append to `src/lib/ai/service.ts`)

```typescript
import type { ProviderConfig } from './models-config';

/** Returns the saved model if still enabled, else the provider's configured default. */
export function resolveEnabledModel(saved: string | undefined, providerCfg: ProviderConfig): string {
  const trimmed = saved?.trim();
  if (trimmed && providerCfg.models.some(m => m.id === trimmed)) return trimmed;
  return providerCfg.defaultModel;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/resolve-model.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire resolver into provider building** — in `buildProvider` (service.ts), after computing the per-provider `model` via the existing `resolveGeminiModel`/`resolveGroqModel`/`resolveNvidiaModel`, pass it through `resolveEnabledModel` against the loaded config so disabled models fall back. Add at the top of `service.ts`:

```typescript
import { useAIConfigStore } from '@/stores/ai-config-store';
```

In each branch of `buildProvider`, replace `const model = resolveGeminiModel(profile);` with:

```typescript
const cfg = useAIConfigStore.getState().config.providers.gemini;
const model = resolveEnabledModel(resolveGeminiModel(profile), cfg);
```

(and analogously `…providers.groq` with `resolveGroqModel`, `…providers.nvidia` with `resolveNvidiaModel`.)

- [ ] **Step 6: Verify typecheck + existing tests**

Run: `npx tsc --noEmit && npx vitest run src/lib/ai`
Expected: no type errors; all AI tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/service.ts src/lib/ai/__tests__/resolve-model.test.ts
git commit -m "feat(ai): fall back to enabled default when a saved model is disabled"
```

---

### Task 8: Wire ProviderToggle + ModelSelector to config

**Files:**
- Modify: `src/components/ai/AIControls.tsx`

- [ ] **Step 1: ProviderToggle renders enabled providers (incl. NVIDIA)** — replace the body of `ProviderToggle` so the buttons are generated from the config's enabled providers:

```typescript
import { useAIConfigStore } from '@/stores/ai-config-store';
import { Sparkles, Zap, Cpu } from 'lucide-react';
// …
export function ProviderToggle() {
  const { profile, updateProfile } = useProfileStore();
  const config = useAIConfigStore(s => s.config);
  const aiProvider = profile.aiProvider ?? 'gemini';

  const PROVIDERS: { id: 'gemini' | 'groq' | 'nvidia'; label: string; icon: React.ReactNode; activeBg: string; activeColor: string }[] = [
    { id: 'gemini', label: 'Gemini', icon: <Sparkles size={11} />, activeBg: 'rgba(212,175,55,0.9)', activeColor: '#0D1B2A' },
    { id: 'groq',   label: 'Groq',   icon: <Zap size={11} />,      activeBg: 'rgba(242,102,57,0.9)', activeColor: '#FFFFFF' },
    { id: 'nvidia', label: 'NVIDIA', icon: <Cpu size={11} />,      activeBg: 'rgba(118,185,0,0.9)',  activeColor: '#0D1B2A' },
  ];
  const enabled = PROVIDERS.filter(p => config.providers[p.id]?.enabled);

  return (
    <div className="flex items-center p-1 rounded-xl gap-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
      {enabled.map(p => {
        const active = aiProvider === p.id;
        return (
          <button
            key={p.id}
            onClick={() => updateProfile({ aiProvider: p.id })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all"
            style={{ background: active ? p.activeBg : 'transparent', color: active ? p.activeColor : 'rgba(232,236,240,0.6)' }}
          >
            {p.icon}{p.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: ModelSelector reads curated config list** — in `ModelSelector`, replace the `models` source:

```typescript
import { useAIConfigStore } from '@/stores/ai-config-store';
// …
const config = useAIConfigStore(s => s.config);
const providerCfg = config.providers[provider];
// Gemini may still merge the per-user live list, but the curated set is the menu:
const models = provider === 'gemini'
  ? (providerCfg.models.length > 0 ? providerCfg.models : (availableGeminiModels ?? PROVIDER_MODELS.gemini))
  : (providerCfg.models.length > 0 ? providerCfg.models : PROVIDER_MODELS[provider] ?? []);
```

And change the `activeId` defaults to use the config default:

```typescript
const activeId = provider === 'gemini'
  ? (profile.geminiModel?.trim() || providerCfg.defaultModel)
  : provider === 'nvidia'
  ? (profile.nvidiaModel?.trim() || providerCfg.defaultModel)
  : (profile.groqModel?.trim() || providerCfg.defaultModel);
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open a claim → Documents tab. Confirm: (a) NVIDIA now appears in the provider toggle, (b) selecting each provider shows its curated models, (c) the dropdown label matches the selection.

- [ ] **Step 5: Commit**

```bash
git add src/components/ai/AIControls.tsx
git commit -m "feat(ai): provider toggle + model selector driven by admin config (adds NVIDIA)"
```

---

## Phase 4 — Admin AI Models tab

### Task 9: Register the "AI Models" admin tab

**Files:**
- Modify: `src/components/admin/types.ts`
- Modify: `src/components/admin/AdminDashboard.tsx`

- [ ] **Step 1: Extend the AdminTab union** (`src/components/admin/types.ts`)

```typescript
export type AdminTab = 'surveyors' | 'signups' | 'payments' | 'dev-notes' | 'ai-models';
```

- [ ] **Step 2: Add the tab button** — in `AdminDashboard.tsx`, after the `dev-notes` tab button, add:

```tsx
<button
  onClick={() => setActiveTab('ai-models')}
  className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-lg transition-all ${
    activeTab === 'ai-models'
      ? 'bg-white border border-b-white border-[#E2E6EA] text-primary -mb-px'
      : 'text-[#8D99AE] hover:text-[#0D1B2A]'
  }`}
>
  <Cpu size={14} />
  AI Models
</button>
```

Add `Cpu` to the existing lucide-react import in this file.

- [ ] **Step 3: Render the tab content** — beside the other `{activeTab === … }` blocks, add:

```tsx
{activeTab === 'ai-models' && <AIModelsTab adminEmail={user?.email ?? 'admin'} />}
```

Add the import: `import { AIModelsTab } from './tabs/AIModelsTab';`

- [ ] **Step 4: Stub the component so it compiles** — create `src/components/admin/tabs/AIModelsTab.tsx`:

```tsx
'use client';
export function AIModelsTab({ adminEmail }: { adminEmail: string }) {
  return <div className="text-sm text-[#8D99AE]">AI Models — coming in next task ({adminEmail})</div>;
}
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/types.ts src/components/admin/AdminDashboard.tsx src/components/admin/tabs/AIModelsTab.tsx
git commit -m "feat(admin): register AI Models tab (stub)"
```

---

### Task 10: AI Models tab — curation UI (discovery, badges, notes, save)

**Files:**
- Modify: `src/components/admin/tabs/AIModelsTab.tsx`

- [ ] **Step 1: Implement the curation UI**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Cpu, RefreshCw, Check, Star, Power, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProfileStore } from '@/stores/profile-store';
import { useAIConfigStore } from '@/stores/ai-config-store';
import {
  AIModelsConfig, ModelEntry, ProviderId,
  loadAIModelsConfig, saveAIModelsConfig,
} from '@/lib/ai/models-config';
import { fetchGeminiModelEntries } from '@/lib/ai/service';
import { fetchNvidiaModels, fetchGroqModels } from '@/lib/ai/discovery';

const PROVIDER_META: Record<ProviderId, { label: string; color: string; keyField: 'geminiApiKeys' | 'groqApiKeys' | 'nvidiaApiKeys' }> = {
  gemini: { label: 'Google Gemini', color: '#D4AF37', keyField: 'geminiApiKeys' },
  groq:   { label: 'Groq',          color: '#F26639', keyField: 'groqApiKeys' },
  nvidia: { label: 'NVIDIA NIM',    color: '#76B900', keyField: 'nvidiaApiKeys' },
};

export function AIModelsTab({ adminEmail }: { adminEmail: string }) {
  const { profile } = useProfileStore();
  const setStoreConfig = useAIConfigStore(s => s.setConfig);
  const [config, setConfig] = useState<AIModelsConfig | null>(null);
  const [discovered, setDiscovered] = useState<Record<ProviderId, ModelEntry[]>>({ gemini: [], groq: [], nvidia: [] });
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAIModelsConfig().then(setConfig); }, []);

  if (!config) return <div className="flex items-center gap-2 text-sm text-[#8D99AE]"><Loader2 size={14} className="animate-spin" /> Loading config…</div>;

  const adminKey = (p: ProviderId): string | undefined =>
    (profile[PROVIDER_META[p].keyField] as string[] | undefined)?.[0]?.trim();

  async function refresh(p: ProviderId) {
    const key = adminKey(p);
    if (!key) { toast.error(`Add a ${PROVIDER_META[p].label} key in your Profile to discover models.`); return; }
    setBusy(p);
    try {
      const rows = p === 'gemini' ? await fetchGeminiModelEntries(key)
        : p === 'nvidia' ? await fetchNvidiaModels(key)
        : await fetchGroqModels(key);
      if (!rows) { toast.error(`Discovery failed for ${PROVIDER_META[p].label} — check the key.`); return; }
      setDiscovered(prev => ({ ...prev, [p]: rows }));
      toast.success(`Found ${rows.length} live ${PROVIDER_META[p].label} models.`);
    } finally { setBusy(null); }
  }

  function isEnabled(p: ProviderId, id: string) { return config!.providers[p].models.some(m => m.id === id); }

  function toggleModel(p: ProviderId, row: ModelEntry) {
    setConfig(prev => {
      if (!prev) return prev;
      const block = prev.providers[p];
      const exists = block.models.some(m => m.id === row.id);
      const models = exists ? block.models.filter(m => m.id !== row.id) : [...block.models, row];
      const defaultModel = exists && block.defaultModel === row.id ? (models[0]?.id ?? '') : block.defaultModel;
      return { ...prev, providers: { ...prev.providers, [p]: { ...block, models, defaultModel } } };
    });
  }

  function setDefault(p: ProviderId, id: string) {
    setConfig(prev => prev ? { ...prev, providers: { ...prev.providers, [p]: { ...prev.providers[p], defaultModel: id } } } : prev);
  }

  function setNote(p: ProviderId, id: string, note: string) {
    setConfig(prev => prev ? { ...prev, providers: { ...prev.providers, [p]: {
      ...prev.providers[p], models: prev.providers[p].models.map(m => m.id === id ? { ...m, note } : m),
    } } } : prev);
  }

  function toggleProvider(p: ProviderId) {
    setConfig(prev => prev ? { ...prev, providers: { ...prev.providers, [p]: { ...prev.providers[p], enabled: !prev.providers[p].enabled } } } : prev);
  }

  async function save() {
    setSaving(true);
    try {
      await saveAIModelsConfig(config!, adminEmail);
      setStoreConfig(config!);
      toast.success('AI model config saved — live for all surveyors.');
    } catch (e: unknown) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally { setSaving(false); }
  }

  const providers: ProviderId[] = ['gemini', 'groq', 'nvidia'];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#4A4E69]">Curate which models each provider exposes to surveyors. Discovery uses <strong>your</strong> profile keys.</p>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-[#0D1B2A] text-[#D4AF37] disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Config
        </button>
      </div>

      {providers.map(p => {
        const meta = PROVIDER_META[p];
        const block = config.providers[p];
        const rows = discovered[p].length > 0 ? discovered[p] : block.models;
        return (
          <div key={p} className="bg-white rounded-2xl border border-[#E2E6EA] shadow-sm overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-3 border-b border-[#F0F2F5] bg-[#FAFAFA]">
              <Cpu size={16} style={{ color: meta.color }} />
              <h2 className="text-sm font-black text-[#0D1B2A]">{meta.label}</h2>
              <button onClick={() => toggleProvider(p)}
                className={`ml-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ${block.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                <Power size={11} /> {block.enabled ? 'Enabled' : 'Disabled'}
              </button>
              <button onClick={() => refresh(p)} disabled={busy === p}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border border-[#E2E6EA] text-[#0D1B2A] disabled:opacity-50">
                {busy === p ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh live list
              </button>
            </div>
            <div className="divide-y divide-[#F0F2F5]">
              {rows.length === 0 && <div className="px-6 py-4 text-xs text-[#8D99AE]">No models yet — click “Refresh live list”.</div>}
              {rows.map(row => {
                const enabled = isEnabled(p, row.id);
                const isDefault = block.defaultModel === row.id;
                const note = block.models.find(m => m.id === row.id)?.note ?? row.note;
                return (
                  <div key={row.id} className="px-6 py-3 flex items-start gap-3">
                    <button onClick={() => toggleModel(p, row)}
                      className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-[#0D1B2A] text-white' : 'border border-[#E2E6EA]'}`}>
                      {enabled && <Check size={12} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs font-black text-[#0D1B2A]">{row.label}</code>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0F2F5] text-[#4A4E69]">{row.estimateCapacity}</span>
                        {enabled && (
                          <button onClick={() => setDefault(p, row.id)}
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1 ${isDefault ? 'bg-amber-100 text-amber-700' : 'text-[#8D99AE]'}`}>
                            <Star size={9} /> {isDefault ? 'Default' : 'Set default'}
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-[#8D99AE] mt-0.5 font-mono">{row.id}</div>
                      {enabled && (
                        <input value={note} onChange={e => setNote(p, row.id, e.target.value)}
                          placeholder="Admin note (e.g. great on 6-page estimates)"
                          className="mt-1.5 w-full text-[11px] px-2 py-1 rounded border border-[#E2E6EA] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev` → Admin Panel → AI Models. For each provider: click "Refresh live list" (with your key in Profile), check/uncheck models, set a default, type a note, click "Save Config". Reload the page and confirm the saved selection persists (reads back from Firestore).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/tabs/AIModelsTab.tsx
git commit -m "feat(admin): AI Models curation UI — discovery, badges, notes, default, save"
```

---

## Phase 5 — Live test tool

### Task 11: Test override path in service.ts + runModelTest

**Files:**
- Modify: `src/lib/ai/service.ts`
- Test: `src/lib/ai/__tests__/test-override.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/ai/__tests__/test-override.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { setAITestOverride, getAITestOverride } from '../service';

describe('AI test override', () => {
  afterEach(() => setAITestOverride(null));
  it('stores and clears the override', () => {
    expect(getAITestOverride()).toBeNull();
    setAITestOverride({ provider: 'nvidia', model: 'meta/llama-3.2-90b-vision-instruct', key: 'nvapi-x' });
    expect(getAITestOverride()?.provider).toBe('nvidia');
    setAITestOverride(null);
    expect(getAITestOverride()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/test-override.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement override + wire into callAIGateway** — add near the top of `service.ts`:

```typescript
export interface AITestOverride { provider: 'gemini' | 'groq' | 'nvidia'; model: string; key: string; }
let _testOverride: AITestOverride | null = null;
export function setAITestOverride(o: AITestOverride | null): void { _testOverride = o; }
export function getAITestOverride(): AITestOverride | null { return _testOverride; }

/** Builds a one-off provider from a test override (no profile, no fallback chain). */
function buildOverrideProvider(o: AITestOverride): AIProvider {
  if (o.provider === 'gemini') {
    return { name: 'gemini', endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${o.model}:generateContent`, model: o.model, keys: [o.key] };
  }
  if (o.provider === 'nvidia') {
    return { name: 'nvidia', endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions', model: o.model, keys: [o.key] };
  }
  return { name: 'groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', model: o.model, keys: [o.key], maxImages: 5, maxOutputTokens: 8192 };
}
```

Then, at the very start of `callAIGateway` (before reading the profile), add:

```typescript
  if (_testOverride) {
    return callWithRotation(buildOverrideProvider(_testOverride), prompt, images, responseFormat);
  }
```

- [ ] **Step 4: Add the runModelTest wrapper** (append to `service.ts`)

```typescript
import { extractDocument } from './processor';

export interface ModelTestResult { ok: boolean; ms: number; data: unknown | null; error?: string; }

/** Runs a sample document through the extraction pipeline forced to one provider+model+key. */
export async function runModelTest(
  override: AITestOverride,
  docKey: string,
  file: File,
  onProgress: (msg: string) => void,
): Promise<ModelTestResult> {
  const started = Date.now();
  setAITestOverride(override);
  try {
    const { data } = await extractDocument(docKey, file, onProgress);
    return { ok: true, ms: Date.now() - started, data };
  } catch (e: unknown) {
    return { ok: false, ms: Date.now() - started, data: null, error: e instanceof Error ? e.message : 'unknown error' };
  } finally {
    setAITestOverride(null);
  }
}
```

> Note: `extractDocument` already imports `callAIGateway` from this module, so the override is honored on every internal pass. If a circular-import warning appears for `extractDocument`, import it lazily inside `runModelTest` via `const { extractDocument } = await import('./processor');` instead of the top-level import.

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run src/lib/ai/__tests__/test-override.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/service.ts src/lib/ai/__tests__/test-override.test.ts
git commit -m "feat(ai): provider/model test override + runModelTest wrapper"
```

---

### Task 12: Live test UI in the AI Models tab

**Files:**
- Modify: `src/components/admin/tabs/AIModelsTab.tsx`

- [ ] **Step 1: Add test state + handler** — inside `AIModelsTab`, add:

```tsx
import { FlaskConical } from 'lucide-react';
import { runModelTest, ModelTestResult, AITestOverride } from '@/lib/ai/service';
// …
const [testing, setTesting] = useState<string | null>(null); // `${provider}:${modelId}`
const [testResult, setTestResult] = useState<Record<string, ModelTestResult>>({});
const [testProgress, setTestProgress] = useState('');

async function runTest(p: ProviderId, modelId: string, file: File) {
  const key = adminKey(p);
  if (!key) { toast.error(`Add a ${PROVIDER_META[p].label} key in your Profile first.`); return; }
  const tag = `${p}:${modelId}`;
  setTesting(tag);
  setTestProgress('Uploading…');
  const override: AITestOverride = { provider: p, model: modelId, key };
  const result = await runModelTest(override, 'estimate', file, setTestProgress);
  setTestResult(prev => ({ ...prev, [tag]: result }));
  setTesting(null);
  setTestProgress('');
  toast[result.ok ? 'success' : 'error'](result.ok ? `Extraction OK in ${(result.ms / 1000).toFixed(1)}s` : `Failed: ${result.error}`);
}
```

- [ ] **Step 2: Add the test control to each enabled model row** — inside the `enabled &&` block (after the note input), add:

```tsx
{enabled && (
  <div className="mt-2">
    <label className="inline-flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-lg border border-[#E2E6EA] cursor-pointer hover:bg-[#F8F9FA]">
      {testing === `${p}:${row.id}` ? <Loader2 size={11} className="animate-spin" /> : <FlaskConical size={11} />}
      Test with estimate PDF
      <input type="file" accept="application/pdf,image/*" className="hidden"
        disabled={testing !== null}
        onChange={e => { const f = e.target.files?.[0]; if (f) runTest(p, row.id, f); e.currentTarget.value = ''; }} />
    </label>
    {testing === `${p}:${row.id}` && <span className="ml-2 text-[10px] text-[#8D99AE]">{testProgress}</span>}
    {testResult[`${p}:${row.id}`] && (
      <pre className={`mt-1.5 max-h-48 overflow-auto text-[10px] p-2 rounded-lg border ${testResult[`${p}:${row.id}`].ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
        {testResult[`${p}:${row.id}`].ok
          ? `✅ ${(testResult[`${p}:${row.id}`].ms / 1000).toFixed(1)}s\n` + JSON.stringify(testResult[`${p}:${row.id}`].data, null, 2)
          : `❌ ${testResult[`${p}:${row.id}`].error}`}
      </pre>
    )}
  </div>
)}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification (the real test)**

Run: `npm run dev` → Admin → AI Models. Enable a Gemini model, click "Test with estimate PDF", upload a real **3-page** then **6-page** estimate. Confirm the extracted line-items JSON appears with timing. Repeat for a Groq model with a 6-page scan and confirm the 5-image cap surfaces as a failure/warning (validates the capacity badge).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/tabs/AIModelsTab.tsx
git commit -m "feat(admin): live sample-estimate-PDF test per model"
```

---

### Task 13: Update Dev Notes + full verification + rollout

**Files:**
- Modify: `src/components/admin/tabs/DevNotesTab.tsx`

- [ ] **Step 1: Replace the now-stale "update these 4 things" guidance** — in `DevNotesTab.tsx`, replace the "When a Gemini model is retired — update these 4 things" section heading and body with a short note pointing admins to the new tab:

```tsx
<div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
  <p className="text-xs font-bold text-emerald-800">
    Model lists are now managed in the <strong>AI Models</strong> tab — no code edit needed.
    Discovery pulls live models from each provider using your profile keys; check/uncheck to
    expose them to surveyors, set a default, and use “Test with estimate PDF” to verify
    multi-page extraction before enabling. The static lists in <code>service.ts</code> remain
    only as an offline fallback.
  </p>
</div>
```

- [ ] **Step 2: Full test + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/tabs/DevNotesTab.tsx
git commit -m "docs(admin): point Dev Notes at the new AI Models tab"
```

- [ ] **Step 4: Deploy (only when the user approves rollout)**

Run: `npx firebase-tools deploy --only firestore:rules,hosting`
Expected: "Deploy complete!" — rules + hosting updated. Then, as admin, open AI Models and click "Refresh + Save" once per provider to seed `ai_config/models`.

---

## Self-Review

**Spec coverage:**
- A. Config storage (`ai_config/models`) → Tasks 1–2 (types/repo), Task 3 (rules). ✅
- B. Discovery layer (Gemini/NVIDIA/Groq) → Tasks 4–5. ✅
- C. Admin "AI Models" tab → Tasks 9–10. ✅
- D. Surveyor consumption (store, ProviderToggle, ModelSelector, resolver fallback) → Tasks 6–8. ✅
- E. Migration/safety (fallback config, mergeWithFallback, rules) → Tasks 1, 2, 3. ✅
- F. Decision-aid badges + admin notes → Task 1 (`computeEstimateCapacity`), Task 10 (badges + note field). ✅
- G. Live test tool → Tasks 11–12. ✅
- Testing (unit + manual E2E) → embedded in each task; full pass in Task 13. ✅

**Type consistency:** `ModelEntry`/`ProviderConfig`/`AIModelsConfig`/`ProviderId` defined in Task 1 and reused verbatim in Tasks 2, 4, 5, 6, 7, 10. `AITestOverride`/`ModelTestResult`/`runModelTest`/`setAITestOverride` defined in Task 11 and consumed in Task 12. `resolveEnabledModel` defined and wired in Task 7. No signature drift.

**Placeholder scan:** No TBD/TODO; every code step shows full code; manual-verification steps are used only for UI behavior that can't be unit-tested, each with concrete actions and expected results.
