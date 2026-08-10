# Probe Accuracy & Throughput Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-document accuracy scoring to the admin model probe, classify models into small-document and large-document capability, and make a full probe materially faster.

**Architecture:** Tasks 1–4 are pure functions and storage with no UI and no network — each is independently unit-testable. Tasks 5–6 change the probe runner's orchestration. Task 7 wires it all into the admin panel. The pure layers land first so the UI task consumes finished, tested pieces.

**Tech Stack:** TypeScript, React, Zustand, Firestore, IndexedDB (`idb` package), Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-probe-accuracy-and-throughput-design.md`
- Tests: Vitest, colocated in `__tests__/` next to the code. Run with `npx vitest run <path>`.
- `SMALL_DOC_MAX_MS = 20_000`. Verdict bands: `exact` ≤ 0.5%, `close` ≤ 2%, `wrong` > 2% or no total.
- **The extracted grand total is `data.gross_amount`.** Never `data.total_amount` — that name exists only inside line items and means that row's GST-inclusive amount. It is numeric, it is present, and it is wrong.
- Tier 1 (capability probe) behaviour must not change. If an existing test in `probe-classify`, `probe-diff`, `probe-reconcile`, `probe-runner` or `probe-types` needs editing, the change was larger than intended — stop and report.
- Classification is derived at render time, never stored. No schema change for it.
- Immutable updates only (spread, never mutate); no `console.log`; commit directly to `main`.
- Run `npx tsc --noEmit` before every commit; it must exit 0.

## File structure

| file | responsibility |
|---|---|
| `src/lib/ai/probe-accuracy.ts` | **new** — `scoreAccuracy` pure scoring, `AccuracyResult` type |
| `src/lib/ai/model-classify.ts` | **new** — `classifyModel` pure capability classification |
| `src/lib/ai/benchmark-doc.ts` | **new** — IndexedDB read/write for the benchmark document |
| `src/lib/storage/indexeddb.ts` | schema v7 + `benchmarkDoc` object store |
| `src/lib/ai/probe-types.ts` | `ProviderProbe` gains `accuracy` map |
| `src/lib/ai/probe-runner.ts` | catalogue ordering, concurrent providers, Tier 2 runner |
| `src/components/admin/tabs/AIModelsTab.tsx` | per-provider buttons, benchmark panel, grouping, badges |

---

### Task 1: Accuracy scoring

Pure function. No network, no DOM, no storage.

**Files:**
- Create: `src/lib/ai/probe-accuracy.ts`
- Test: `src/lib/ai/__tests__/probe-accuracy.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type AccuracyVerdict = 'exact' | 'close' | 'wrong' | 'failed'`
  - `interface AccuracyResult` (full shape in Step 3)
  - `extractTotals(data: unknown): { total: number | null; itemCount: number | null }`
  - `scoreAccuracy(input: ScoreInput): AccuracyResult`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/probe-accuracy.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { extractTotals, scoreAccuracy } from '../probe-accuracy';

/**
 * The estimate schema (src/lib/ai/prompts.ts) puts the document grand total in
 * the ROOT field `gross_amount`. The name `total_amount` also exists, but only
 * inside each line item, where it means that row's GST-inclusive amount.
 * Reading it would silently score against one row instead of the document.
 */
const EXTRACTION = {
  gross_amount: 62392.5,
  subtotal_parts_taxable: 52875,
  spare_parts: [
    { description: 'BUMPER', total_amount: 2891 },
    { description: 'GRILLE', total_amount: 1392.4 },
  ],
  labour_items: [{ description: 'PANEL BEATING', total_amount: 4130 }],
  painting_items: [{ description: 'PAINTING', total_amount: 7316 }],
};

describe('extractTotals', () => {
  test('reads the root gross_amount, not a line item total_amount', () => {
    expect(extractTotals(EXTRACTION).total).toBe(62392.5);
  });

  test('counts line items across all three sections', () => {
    expect(extractTotals(EXTRACTION).itemCount).toBe(4);
  });

  test('returns nulls for a result with no usable total', () => {
    expect(extractTotals({ spare_parts: [] })).toEqual({ total: null, itemCount: 0 });
  });

  test('survives null, undefined and non-object input', () => {
    expect(extractTotals(null)).toEqual({ total: null, itemCount: null });
    expect(extractTotals(undefined)).toEqual({ total: null, itemCount: null });
    expect(extractTotals('nope')).toEqual({ total: null, itemCount: null });
  });

  test('ignores a non-numeric gross_amount', () => {
    expect(extractTotals({ gross_amount: 'N/A' }).total).toBeNull();
  });
});

const BASE = {
  modelId: 'meta/llama-3.2-90b-vision-instruct',
  expectedTotal: 62392.5,
  expectedItemCount: 4,
  ms: 250_000,
  pages: 5,
  benchmarkFileName: 'estimate.pdf',
  now: 1000,
};

describe('scoreAccuracy verdict bands', () => {
  test('an exact match is exact', () => {
    const r = scoreAccuracy({ ...BASE, data: EXTRACTION, error: null });
    expect(r.verdict).toBe('exact');
    expect(r.extractedTotal).toBe(62392.5);
    expect(r.totalDeltaPct).toBeCloseTo(0, 5);
  });

  test('0.5% off is still exact (boundary)', () => {
    const data = { ...EXTRACTION, gross_amount: 62392.5 * 1.005 };
    expect(scoreAccuracy({ ...BASE, data, error: null }).verdict).toBe('exact');
  });

  test('1% off is close', () => {
    const data = { ...EXTRACTION, gross_amount: 62392.5 * 1.01 };
    expect(scoreAccuracy({ ...BASE, data, error: null }).verdict).toBe('close');
  });

  test('2% off is still close (boundary)', () => {
    const data = { ...EXTRACTION, gross_amount: 62392.5 * 1.02 };
    expect(scoreAccuracy({ ...BASE, data, error: null }).verdict).toBe('close');
  });

  test('dropping GST lands firmly in wrong', () => {
    // 52875 taxable vs 62392.50 gross — the exact failure seen from a model
    // that copied `rate` into `amount` and lost the 18%.
    const data = { ...EXTRACTION, gross_amount: 52875 };
    const r = scoreAccuracy({ ...BASE, data, error: null });
    expect(r.verdict).toBe('wrong');
    expect(r.totalDeltaPct).toBeGreaterThan(14);
  });

  test('no extractable total is wrong, not a crash', () => {
    const r = scoreAccuracy({ ...BASE, data: { spare_parts: [] }, error: null });
    expect(r.verdict).toBe('wrong');
    expect(r.extractedTotal).toBeNull();
    expect(r.totalDeltaPct).toBeNull();
  });

  test('a thrown extraction is failed and keeps the message', () => {
    const r = scoreAccuracy({ ...BASE, data: null, error: 'nvidia API Error: 400' });
    expect(r.verdict).toBe('failed');
    expect(r.error).toBe('nvidia API Error: 400');
  });

  test('an item-count mismatch does not change the verdict', () => {
    const data = { ...EXTRACTION, spare_parts: [{ description: 'ONLY ONE', total_amount: 1 }] };
    const r = scoreAccuracy({ ...BASE, data, error: null });
    expect(r.verdict).toBe('exact');
    expect(r.extractedItemCount).toBe(3);
    expect(r.expectedItemCount).toBe(4);
  });

  test('carries the benchmark file name so stale results are detectable', () => {
    expect(scoreAccuracy({ ...BASE, data: EXTRACTION, error: null }).benchmarkFileName)
      .toBe('estimate.pdf');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/probe-accuracy.test.ts`
Expected: FAIL — `Failed to resolve import "../probe-accuracy"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/ai/probe-accuracy.ts`:

```typescript
/**
 * Scores a model's extraction of the admin's benchmark document against an
 * admin-supplied expected grand total.
 *
 * The capability probe answers "can this model work at all". It cannot tell a
 * fast-wrong model from a slow-right one — both report status 'ok'. This does.
 */

export type AccuracyVerdict = 'exact' | 'close' | 'wrong' | 'failed';

/** Within this much of the expected total counts as exact. */
const EXACT_PCT = 0.5;
/** Within this much counts as close. Beyond it, wrong. */
const CLOSE_PCT = 2;

export interface AccuracyResult {
  modelId: string;
  verdict: AccuracyVerdict;
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

export interface ScoreInput {
  modelId: string;
  /** The `data` field of ModelTestResult — the extraction output. */
  data: unknown;
  expectedTotal: number;
  expectedItemCount: number | null;
  ms: number;
  pages: number;
  benchmarkFileName: string;
  now: number;
  /** Non-null when the extraction threw. */
  error: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function countSection(data: Record<string, unknown>, key: string): number {
  const section = data[key];
  return Array.isArray(section) ? section.length : 0;
}

/**
 * Pulls the document-level total and line-item count out of an extraction.
 *
 * The total is the ROOT `gross_amount` (src/lib/ai/prompts.ts). Do not reach
 * for `total_amount`: that field exists only inside each line item and holds
 * that row's GST-inclusive amount, so reading it scores one row as if it were
 * the whole document.
 */
export function extractTotals(data: unknown): { total: number | null; itemCount: number | null } {
  if (!isRecord(data)) return { total: null, itemCount: null };

  const gross = data.gross_amount;
  const total = typeof gross === 'number' && Number.isFinite(gross) ? gross : null;

  const itemCount =
    countSection(data, 'spare_parts') +
    countSection(data, 'labour_items') +
    countSection(data, 'painting_items');

  return { total, itemCount };
}

export function scoreAccuracy(input: ScoreInput): AccuracyResult {
  const {
    modelId, data, expectedTotal, expectedItemCount,
    ms, pages, benchmarkFileName, now, error,
  } = input;

  const base = {
    modelId,
    expectedTotal,
    expectedItemCount,
    ms,
    pages,
    benchmarkFileName,
    ranAt: now,
  };

  if (error !== null) {
    return {
      ...base,
      verdict: 'failed',
      extractedTotal: null,
      totalDeltaPct: null,
      extractedItemCount: null,
      error,
    };
  }

  const { total, itemCount } = extractTotals(data);

  if (total === null) {
    return {
      ...base,
      verdict: 'wrong',
      extractedTotal: null,
      totalDeltaPct: null,
      extractedItemCount: itemCount,
      error: null,
    };
  }

  const totalDeltaPct = Math.abs(total - expectedTotal) / expectedTotal * 100;
  const verdict: AccuracyVerdict =
    totalDeltaPct <= EXACT_PCT ? 'exact'
    : totalDeltaPct <= CLOSE_PCT ? 'close'
    : 'wrong';

  return {
    ...base,
    verdict,
    extractedTotal: total,
    totalDeltaPct,
    extractedItemCount: itemCount,
    error: null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/probe-accuracy.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Type check and commit**

Run: `npx tsc --noEmit` — must exit 0.

```bash
git add src/lib/ai/probe-accuracy.ts src/lib/ai/__tests__/probe-accuracy.test.ts
git commit -m "feat(ai): accuracy scoring for the model probe

Scores an extraction against an admin-supplied expected grand total.
Reads the root gross_amount, never the per-line-item total_amount."
```

---

### Task 2: Model classification

Pure function. Decides which of the two document classes a model is fit for.

**Files:**
- Create: `src/lib/ai/model-classify.ts`
- Test: `src/lib/ai/__tests__/model-classify.test.ts`

**Interfaces:**
- Consumes: `ProbeResult` from `src/lib/ai/probe-types.ts`; `AccuracyResult` from Task 1.
- Produces:
  - `SMALL_DOC_MAX_MS = 20_000`
  - `interface ModelCapability { smallDocs: boolean; largeDocs: boolean }`
  - `classifyModel(probe: ProbeResult, accuracy?: AccuracyResult): ModelCapability`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/model-classify.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { classifyModel, SMALL_DOC_MAX_MS } from '../model-classify';
import type { ProbeResult } from '../probe-types';
import type { AccuracyResult } from '../probe-accuracy';

function probe(o: Partial<ProbeResult> = {}): ProbeResult {
  return {
    id: 'm1', status: 'ok', reason: '', vision: true, imageCap: 1,
    ctxWindow: 128000, msPerPage: 5_000, slow: false,
    source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' },
    probedAt: 1, consecutiveFailures: 0, ...o,
  };
}

function accuracy(o: Partial<AccuracyResult> = {}): AccuracyResult {
  return {
    modelId: 'm1', verdict: 'exact', extractedTotal: 100, expectedTotal: 100,
    totalDeltaPct: 0, extractedItemCount: 4, expectedItemCount: 4,
    ms: 1000, pages: 5, benchmarkFileName: 'e.pdf', ranAt: 1, error: null, ...o,
  };
}

describe('classifyModel', () => {
  test('a fast vision model with no accuracy result is small-docs only', () => {
    expect(classifyModel(probe())).toEqual({ smallDocs: true, largeDocs: false });
  });

  test('a fast accurate vision model is both', () => {
    expect(classifyModel(probe(), accuracy())).toEqual({ smallDocs: true, largeDocs: true });
  });

  test('a close verdict also qualifies for large docs', () => {
    expect(classifyModel(probe(), accuracy({ verdict: 'close' })).largeDocs).toBe(true);
  });

  test('a text-only model that reads estimates is large-docs only', () => {
    // A scanned licence needs vision; a digitally-born estimate does not.
    const r = classifyModel(probe({ vision: false }), accuracy());
    expect(r).toEqual({ smallDocs: false, largeDocs: true });
  });

  test('a slow wrong model is neither', () => {
    // nvidia/nemotron-nano-12b-v2-vl: 27s/page, dropped GST on the amount column.
    const r = classifyModel(probe({ msPerPage: 27_000 }), accuracy({ verdict: 'wrong' }));
    expect(r).toEqual({ smallDocs: false, largeDocs: false });
  });

  test('exactly at the small-doc ceiling still qualifies', () => {
    expect(classifyModel(probe({ msPerPage: SMALL_DOC_MAX_MS })).smallDocs).toBe(true);
  });

  test('one millisecond over the ceiling does not', () => {
    expect(classifyModel(probe({ msPerPage: SMALL_DOC_MAX_MS + 1 })).smallDocs).toBe(false);
  });

  test('a model that exceeded the latency cutoff is not small-docs', () => {
    expect(classifyModel(probe({ msPerPage: null, slow: true })).smallDocs).toBe(false);
  });

  test('a failed accuracy run does not qualify for large docs', () => {
    expect(classifyModel(probe(), accuracy({ verdict: 'failed' })).largeDocs).toBe(false);
  });

  test('a model that failed tier 1 is neither, whatever the accuracy says', () => {
    const r = classifyModel(probe({ status: 'unreachable' }), accuracy());
    expect(r).toEqual({ smallDocs: false, largeDocs: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/model-classify.test.ts`
Expected: FAIL — `Failed to resolve import "../model-classify"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/ai/model-classify.ts`:

```typescript
import type { ProbeResult } from './probe-types';
import type { AccuracyResult } from './probe-accuracy';

/**
 * Sorts working models into the two kinds of document this app extracts.
 *
 *   Small — driving licence, RC, policy, claim form. One page, few fields,
 *           usually a photo or scan, so vision is required. A surveyor is
 *           waiting, so speed is the binding constraint.
 *   Large — repair estimate, final bill. Multi-page, dense tables. Table
 *           accuracy is the binding constraint; vision is optional because a
 *           digitally-born PDF is read through its text layer.
 *
 * The two are not nested: a text-only model can be fit for large documents and
 * unfit for small ones.
 *
 * Derived, never stored — a stored category would drift from the measurements
 * it came from.
 */

/**
 * A model slower than this per page is unusable for a licence however accurate,
 * because the surveyor is sitting in front of the vehicle waiting for it.
 */
export const SMALL_DOC_MAX_MS = 20_000;

export interface ModelCapability {
  smallDocs: boolean;
  largeDocs: boolean;
}

export function classifyModel(probe: ProbeResult, accuracy?: AccuracyResult): ModelCapability {
  if (probe.status !== 'ok') return { smallDocs: false, largeDocs: false };

  const smallDocs =
    probe.vision &&
    probe.msPerPage !== null &&
    probe.msPerPage <= SMALL_DOC_MAX_MS;

  // Requires tier 2 to have run. Untested means unknown, not good.
  const largeDocs = accuracy?.verdict === 'exact' || accuracy?.verdict === 'close';

  return { smallDocs, largeDocs };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/model-classify.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Type check and commit**

Run: `npx tsc --noEmit` — must exit 0.

```bash
git add src/lib/ai/model-classify.ts src/lib/ai/__tests__/model-classify.test.ts
git commit -m "feat(ai): classify models by document size capability

Small documents need vision and speed; large documents need table
accuracy over many pages. Not nested - a text-only model can pass one
and fail the other. Derived at render time, never stored."
```

---

### Task 3: Benchmark document storage

The admin's specimen estimate, stored device-local.

**Files:**
- Modify: `src/lib/storage/indexeddb.ts` (`DB_VERSION` at line 61; `SurveyOSDB` interface ending line 156; `upgrade` function ending line 222)
- Create: `src/lib/ai/benchmark-doc.ts`
- Test: `src/lib/ai/__tests__/benchmark-doc.test.ts`

**Interfaces:**
- Consumes: `getDB()` (module-private in `indexeddb.ts` — the new helpers live in that file and re-export through `benchmark-doc.ts`).
- Produces:
  - `interface BenchmarkDoc`
  - `saveBenchmarkDoc(doc: BenchmarkDoc): Promise<void>`
  - `getBenchmarkDoc(): Promise<BenchmarkDoc | null>`
  - `deleteBenchmarkDoc(): Promise<void>`
  - `validateBenchmarkInput(expectedTotal: number): string | null`

- [ ] **Step 1: Write the failing test**

Only `validateBenchmarkInput` is unit-tested — the rest is IndexedDB I/O, which needs a browser and is covered by the manual verification in Task 7.

Create `src/lib/ai/__tests__/benchmark-doc.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { validateBenchmarkInput } from '../benchmark-doc';

describe('validateBenchmarkInput', () => {
  test('accepts a normal total', () => {
    expect(validateBenchmarkInput(62392.5)).toBeNull();
  });

  test('rejects zero — it would make the delta percentage undefined', () => {
    expect(validateBenchmarkInput(0)).toBe('Expected total must be greater than zero.');
  });

  test('rejects a negative total', () => {
    expect(validateBenchmarkInput(-100)).toBe('Expected total must be greater than zero.');
  });

  test('rejects NaN', () => {
    expect(validateBenchmarkInput(Number.NaN)).toBe('Enter the grand total printed on the document.');
  });

  test('rejects Infinity', () => {
    expect(validateBenchmarkInput(Number.POSITIVE_INFINITY))
      .toBe('Enter the grand total printed on the document.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/benchmark-doc.test.ts`
Expected: FAIL — `Failed to resolve import "../benchmark-doc"`.

- [ ] **Step 3: Add the object store to the IndexedDB schema**

In `src/lib/storage/indexeddb.ts`, change line 61:

```typescript
const DB_VERSION = 7;
```

Add to the `SurveyOSDB` interface, immediately after the `recoveredClaims` block and before the closing `}` of the interface:

```typescript
  benchmarkDoc: {
    key: string;
    value: {
      id: 'current';
      fileName: string;
      mimeType: string;
      blob: Blob;
      pageCount: number;
      expectedTotal: number;
      expectedItemCount: number | null;
      addedAt: number;
      addedBy: string;
    };
  };
```

Add to the `upgrade` function, immediately after the `recoveredClaims` block:

```typescript
      // Benchmark document — the admin's specimen estimate for probe accuracy
      // testing. Single slot, device-local (v7)
      if (oldVersion < 7 && !db.objectStoreNames.contains('benchmarkDoc')) {
        db.createObjectStore('benchmarkDoc', { keyPath: 'id' });
      }
```

- [ ] **Step 4: Add the storage helpers**

Append to `src/lib/storage/indexeddb.ts`, following the same shape as the Drive Backup Tracking helpers at lines 482-497:

```typescript
// ─── Benchmark Document ──────────────────────────────────────────────────────
// The admin's specimen estimate, used by the AI Models panel to score how
// accurately each model extracts a real multi-page document. Single slot,
// device-local — it never goes to Firestore or Firebase Storage.

export interface BenchmarkDocRecord {
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

export async function putBenchmarkDoc(doc: BenchmarkDocRecord): Promise<void> {
  const db = await getDB();
  await db.put('benchmarkDoc', doc);
}

export async function readBenchmarkDoc(): Promise<BenchmarkDocRecord | null> {
  const db = await getDB();
  return (await db.get('benchmarkDoc', 'current')) ?? null;
}

export async function removeBenchmarkDoc(): Promise<void> {
  const db = await getDB();
  await db.delete('benchmarkDoc', 'current');
}
```

- [ ] **Step 5: Write the benchmark-doc module**

Create `src/lib/ai/benchmark-doc.ts`:

```typescript
import {
  putBenchmarkDoc, readBenchmarkDoc, removeBenchmarkDoc,
  type BenchmarkDocRecord,
} from '@/lib/storage/indexeddb';

/**
 * The admin's specimen estimate for probe accuracy testing.
 *
 * Stored in IndexedDB rather than Firebase: Firebase Storage is unused by this
 * app (no storage.rules, nothing imports getStorage), so using it would mean
 * new rules, a new deploy surface and a second persistence layer for one file.
 *
 * The document is transmitted in full to every shortlisted model on each
 * accuracy run, which is why the panel says so at the point of upload.
 */

export type BenchmarkDoc = BenchmarkDocRecord;

export async function saveBenchmarkDoc(doc: BenchmarkDoc): Promise<void> {
  await putBenchmarkDoc(doc);
}

export async function getBenchmarkDoc(): Promise<BenchmarkDoc | null> {
  try {
    return await readBenchmarkDoc();
  } catch {
    // No DB open yet (not signed in) — the panel treats this as "none set".
    return null;
  }
}

export async function deleteBenchmarkDoc(): Promise<void> {
  await removeBenchmarkDoc();
}

/** Returns an error message, or null when the value is usable. */
export function validateBenchmarkInput(expectedTotal: number): string | null {
  if (!Number.isFinite(expectedTotal)) {
    return 'Enter the grand total printed on the document.';
  }
  if (expectedTotal <= 0) {
    return 'Expected total must be greater than zero.';
  }
  return null;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/benchmark-doc.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Type check and commit**

Run: `npx tsc --noEmit` — must exit 0.

```bash
git add src/lib/storage/indexeddb.ts src/lib/ai/benchmark-doc.ts src/lib/ai/__tests__/benchmark-doc.test.ts
git commit -m "feat(ai): store the probe benchmark document in IndexedDB

Schema v7 adds a single-slot benchmarkDoc store. Device-local by design:
Firebase Storage is unused by this app, so adopting it would mean new
rules and a new deploy surface for one file."
```

---

### Task 4: Accuracy results on the probe document

Extends the persisted probe shape so Tier 2 results live beside Tier 1 without either overwriting the other.

**Files:**
- Modify: `src/lib/ai/probe-types.ts`
- Test: `src/lib/ai/__tests__/probe-types.test.ts` (extend)

**Interfaces:**
- Consumes: `AccuracyResult` from Task 1.
- Produces: `ProviderProbe.accuracy: Record<string, AccuracyResult>`; `isAccuracyStale(result, benchmarkFileName): boolean`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/ai/__tests__/probe-types.test.ts`:

```typescript
import { isAccuracyStale, emptyProviderProbe } from '../probe-types';
import type { AccuracyResult } from '../probe-accuracy';

function acc(fileName: string): AccuracyResult {
  return {
    modelId: 'm1', verdict: 'exact', extractedTotal: 100, expectedTotal: 100,
    totalDeltaPct: 0, extractedItemCount: 4, expectedItemCount: 4,
    ms: 1, pages: 5, benchmarkFileName: fileName, ranAt: 1, error: null,
  };
}

describe('accuracy on a provider probe', () => {
  test('a fresh provider probe has an empty accuracy map', () => {
    expect(emptyProviderProbe().accuracy).toEqual({});
  });

  test('a result from the current benchmark is not stale', () => {
    expect(isAccuracyStale(acc('estimate.pdf'), 'estimate.pdf')).toBe(false);
  });

  test('a result from a replaced benchmark is stale', () => {
    expect(isAccuracyStale(acc('old.pdf'), 'estimate.pdf')).toBe(true);
  });

  test('any result is stale when no benchmark is set', () => {
    expect(isAccuracyStale(acc('estimate.pdf'), null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/probe-types.test.ts`
Expected: FAIL — `isAccuracyStale` is not exported, and `emptyProviderProbe().accuracy` is undefined.

- [ ] **Step 3: Extend the types**

In `src/lib/ai/probe-types.ts`, add the import at the top:

```typescript
import type { AccuracyResult } from './probe-accuracy';
```

Add `accuracy` to `ProviderProbe`:

```typescript
export interface ProviderProbe {
  probedAt: number;
  /** Set when the provider's probe aborted; previous results are kept. */
  error: string | null;
  models: Record<string, ProbeResult>;
  /**
   * Tier 2 results, keyed by model id. A separate map from `models` so a
   * capability re-probe never destroys accuracy data, and vice versa.
   */
  accuracy: Record<string, AccuracyResult>;
}
```

Update `emptyProviderProbe`:

```typescript
export function emptyProviderProbe(): ProviderProbe {
  return { probedAt: 0, error: null, models: {}, accuracy: {} };
}
```

Add at the end of the file:

```typescript
/**
 * True when an accuracy result was produced against a different benchmark
 * document than the one currently loaded. Stale results are shown and marked
 * rather than deleted, so the admin can see what changed and re-run knowingly.
 */
export function isAccuracyStale(
  result: AccuracyResult,
  currentBenchmarkFileName: string | null,
): boolean {
  if (currentBenchmarkFileName === null) return true;
  return result.benchmarkFileName !== currentBenchmarkFileName;
}
```

In `loadModelProbes`, the per-provider merge must tolerate documents saved before this change, which have no `accuracy` key. Replace the loop body inside `loadModelProbes`:

```typescript
    for (const p of PROVIDER_IDS) {
      const raw_p = raw.providers?.[p];
      if (raw_p) {
        // Documents written before accuracy scoring existed have no map.
        providers[p] = { ...raw_p, accuracy: raw_p.accuracy ?? {} };
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/probe-types.test.ts`
Expected: PASS.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`

Expected: errors only in `src/lib/ai/probe-runner.ts` and `src/components/admin/tabs/AIModelsTab.tsx`, where `ProviderProbe` objects are constructed without the new `accuracy` field. Fix each by adding `accuracy: {}` to the object literal, or `accuracy: previous.providers[p]?.accuracy ?? {}` where a previous probe is in scope. Any other error means the change was larger than intended.

- [ ] **Step 6: Run the full suite and commit**

Run: `npx vitest run` — all tests must pass.

```bash
git add src/lib/ai/probe-types.ts src/lib/ai/__tests__/probe-types.test.ts src/lib/ai/probe-runner.ts src/components/admin/tabs/AIModelsTab.tsx
git commit -m "feat(ai): carry accuracy results alongside capability results

A separate map keyed by model id, so a tier 1 re-probe never destroys
tier 2 data. Documents written before this change read as untested."
```

---

### Task 5: Catalogue ordering — working models first

Dead models keep being re-probed (a provider can restore one, and the two-strike removal rule depends on it), but they stop blocking the useful results.

**Files:**
- Modify: `src/lib/ai/probe-runner.ts`
- Test: `src/lib/ai/__tests__/probe-runner.test.ts` (extend)

**Interfaces:**
- Consumes: `ProviderProbe` from Task 4.
- Produces: `orderCatalogue<T extends { id: string }>(entries: T[], previous: ProviderProbe): T[]`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/ai/__tests__/probe-runner.test.ts`:

```typescript
import { orderCatalogue } from '../probe-runner';
import type { ProbeResult, ProviderProbe } from '../probe-types';

function prev(statuses: Record<string, ProbeResult['status']>): ProviderProbe {
  return {
    probedAt: 1, error: null, accuracy: {},
    models: Object.fromEntries(Object.entries(statuses).map(([id, status]) => [id, {
      id, status, reason: '', vision: true, imageCap: 1, ctxWindow: 1,
      msPerPage: 1, slow: false,
      source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' },
      probedAt: 1, consecutiveFailures: 0,
    } as ProbeResult])),
  };
}

describe('orderCatalogue', () => {
  const entries = [{ id: 'dead1' }, { id: 'ok1' }, { id: 'new1' }, { id: 'dead2' }, { id: 'ok2' }];

  test('working models first, never-probed next, dead last', () => {
    const ordered = orderCatalogue(entries, prev({
      dead1: 'unreachable', ok1: 'ok', dead2: 'unreachable', ok2: 'ok',
    }));
    expect(ordered.map(e => e.id)).toEqual(['ok1', 'ok2', 'new1', 'dead1', 'dead2']);
  });

  test('order is stable within each group', () => {
    const ordered = orderCatalogue(entries, prev({ ok1: 'ok', ok2: 'ok' }));
    // new1, dead1, dead2 were all never probed — original relative order kept.
    expect(ordered.map(e => e.id)).toEqual(['ok1', 'ok2', 'dead1', 'new1', 'dead2']);
  });

  test('an empty previous probe leaves the order untouched', () => {
    const ordered = orderCatalogue(entries, prev({}));
    expect(ordered.map(e => e.id)).toEqual(['dead1', 'ok1', 'new1', 'dead2', 'ok2']);
  });

  test('does not mutate the input array', () => {
    const input = [...entries];
    orderCatalogue(input, prev({ ok2: 'ok' }));
    expect(input.map(e => e.id)).toEqual(['dead1', 'ok1', 'new1', 'dead2', 'ok2']);
  });

  test('every entry survives — nothing is dropped', () => {
    const ordered = orderCatalogue(entries, prev({ dead1: 'unreachable', ok1: 'ok' }));
    expect(ordered).toHaveLength(entries.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/probe-runner.test.ts`
Expected: FAIL — `orderCatalogue` is not exported.

- [ ] **Step 3: Write the implementation**

Add to `src/lib/ai/probe-runner.ts`, above `runProviderProbe`:

```typescript
/**
 * Sorts a catalogue so previously-working models are probed first and
 * previously-failed ones last.
 *
 * Everything is still probed — a provider can restore a model, and the
 * two-strike removal rule in probe-reconcile depends on re-testing. This only
 * changes the order, so the admin sees useful results while the graveyard is
 * still being checked. On NVIDIA that moves 60 known-404s behind the 28 that
 * work.
 */
export function orderCatalogue<T extends { id: string }>(
  entries: T[],
  previous: ProviderProbe,
): T[] {
  const rank = (id: string): number => {
    const prior = previous.models[id];
    if (!prior) return 1;                    // never probed
    return prior.status === 'ok' ? 0 : 2;    // working : failed
  };
  // Array.prototype.sort is stable in every engine this app targets, so
  // entries of equal rank keep their provider-supplied order.
  return [...entries].sort((a, b) => rank(a.id) - rank(b.id));
}
```

In `runProviderProbe`, apply it immediately after the catalogue is fetched. Replace:

```typescript
    const catalogue = await fetchCatalogue(provider, key);
```

with:

```typescript
    const catalogue = orderCatalogue(await fetchCatalogue(provider, key), previous);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/probe-runner.test.ts`
Expected: PASS.

- [ ] **Step 5: Type check, full suite, commit**

Run: `npx tsc --noEmit && npx vitest run` — both clean.

```bash
git add src/lib/ai/probe-runner.ts src/lib/ai/__tests__/probe-runner.test.ts
git commit -m "perf(ai): probe working models before known-dead ones

Everything is still re-probed - a provider can restore a model and the
two-strike rule depends on it - but 60 of NVIDIA's 100 entries are 404s
and were blocking the 28 that work."
```

---

### Task 6: Concurrent providers and the Tier 2 runner

Two changes to `runFullProbe`'s orchestration, plus the new accuracy run.

**Files:**
- Modify: `src/lib/ai/probe-runner.ts`
- Test: `src/lib/ai/__tests__/probe-runner.test.ts` (extend)

**Interfaces:**
- Consumes: `scoreAccuracy`, `AccuracyResult` (Task 1); `BenchmarkDoc` (Task 3); `runModelTest` from `src/lib/ai/service.ts`.
- Produces:
  - `mergeProviderResult(current: ModelProbes, provider: ProviderId, result: ProviderProbe): ModelProbes`
  - `runAccuracyProbe(provider, key, modelIds, benchmark, onProgress): Promise<Record<string, AccuracyResult>>`
  - `runFullProbe` keeps its existing signature.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/ai/__tests__/probe-runner.test.ts`:

```typescript
import { mergeProviderResult } from '../probe-runner';
import type { ModelProbes } from '../probe-types';

function probes(): ModelProbes {
  return {
    probedAt: 0, probedBy: '',
    providers: {
      gemini: { probedAt: 0, error: null, models: {}, accuracy: {} },
      groq: { probedAt: 0, error: null, models: {}, accuracy: {} },
      nvidia: { probedAt: 0, error: null, models: {}, accuracy: {} },
    },
  };
}

function providerProbe(tag: string): ProviderProbe {
  return {
    probedAt: 1, error: null, accuracy: {},
    models: { [tag]: { id: tag, status: 'ok', reason: '', vision: true, imageCap: 1,
      ctxWindow: 1, msPerPage: 1, slow: false,
      source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' },
      probedAt: 1, consecutiveFailures: 0 } as ProbeResult },
  };
}

describe('mergeProviderResult', () => {
  test('two providers completing out of order both survive', () => {
    // Under Promise.all, completion order is not the loop order. Merging into
    // a captured snapshot instead of the latest state loses one of them.
    let state = probes();
    state = mergeProviderResult(state, 'nvidia', providerProbe('nv'));
    state = mergeProviderResult(state, 'gemini', providerProbe('gem'));

    expect(Object.keys(state.providers.nvidia.models)).toEqual(['nv']);
    expect(Object.keys(state.providers.gemini.models)).toEqual(['gem']);
  });

  test('merging one provider leaves the others untouched', () => {
    const before = probes();
    const after = mergeProviderResult(before, 'groq', providerProbe('gq'));
    expect(after.providers.gemini).toBe(before.providers.gemini);
    expect(after.providers.nvidia).toBe(before.providers.nvidia);
  });

  test('does not mutate the input', () => {
    const before = probes();
    mergeProviderResult(before, 'groq', providerProbe('gq'));
    expect(Object.keys(before.providers.groq.models)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/probe-runner.test.ts`
Expected: FAIL — `mergeProviderResult` is not exported.

- [ ] **Step 3: Add the merge helper**

Add to `src/lib/ai/probe-runner.ts`:

```typescript
/**
 * Folds one provider's finished probe into the running state.
 *
 * Needed because providers now finish concurrently and therefore in
 * unpredictable order. Merging into a snapshot captured before the run would
 * let two providers finishing close together overwrite one another.
 */
export function mergeProviderResult(
  current: ModelProbes,
  provider: ProviderId,
  result: ProviderProbe,
): ModelProbes {
  return {
    ...current,
    providers: { ...current.providers, [provider]: result },
  };
}
```

- [ ] **Step 4: Make providers run concurrently**

In `src/lib/ai/probe-runner.ts`, replace the sequential loop inside `runFullProbe` (the `for (const p of PROVIDER_IDS)` block) with:

```typescript
  // Concurrent across providers. Gemini, Groq and NVIDIA are independent
  // rate-limit domains with their own keys, and pacing is already enforced
  // per provider (PROVIDER_CONCURRENCY / PROVIDER_MIN_GAP_MS), so running them
  // together adds no pressure to any one of them. Sequentially, Gemini's
  // ~9 req/min pacing left the other two idle for most of the run.
  let running: ModelProbes = { ...previous };

  await Promise.all(PROVIDER_IDS.map(async (p) => {
    const key = keys[p]?.trim();
    if (!key) {
      // No key means we learned nothing — keep the previous results rather
      // than replacing them with an empty block the reconciler might act on.
      const skipped: ProviderProbe = {
        ...(previous.providers[p] ?? emptyProviderProbe()),
        error: 'No admin key for this provider.',
      };
      running = mergeProviderResult(running, p, skipped);
      await onProviderComplete(p, skipped);
      return;
    }

    // One provider failing must not reject the outer Promise.all and abort
    // the others. runProviderProbe already catches its own errors, but a
    // throw from onProviderComplete would escape.
    try {
      const result = await runProviderProbe(
        p, key, previous.providers[p] ?? emptyProviderProbe(),
        (done, total) => onProgress(p, done, total),
      );
      running = mergeProviderResult(running, p, result);
      await onProviderComplete(p, result);
    } catch (err: unknown) {
      const failed: ProviderProbe = {
        ...(previous.providers[p] ?? emptyProviderProbe()),
        error: err instanceof Error ? err.message : 'Probe failed',
      };
      running = mergeProviderResult(running, p, failed);
    }
  }));

  return { probedAt: Date.now(), probedBy: '', providers: running.providers };
```

- [ ] **Step 5: Add the Tier 2 accuracy runner**

Add to `src/lib/ai/probe-runner.ts`:

```typescript
/**
 * Tier 2 — runs the admin's benchmark document through the real extraction
 * path for each shortlisted model and scores the result.
 *
 * Uses runModelTest, the same override mechanism the "Test with estimate PDF"
 * button uses, so this exercises the real chunking, the real prompts and the
 * real per-provider image caps rather than a parallel implementation.
 *
 * Sequential within a provider: each run is a full multi-page extraction, and
 * running several at once against one provider's rate limit would produce
 * timeouts that look like model faults.
 */
export async function runAccuracyProbe(
  provider: ProviderId,
  key: string,
  modelIds: string[],
  benchmark: BenchmarkDoc,
  onProgress: (modelId: string, done: number, total: number) => void,
): Promise<Record<string, AccuracyResult>> {
  const { runModelTest } = await import('./service');
  const results: Record<string, AccuracyResult> = {};
  const file = new File([benchmark.blob], benchmark.fileName, { type: benchmark.mimeType });

  let done = 0;
  for (const modelId of modelIds) {
    onProgress(modelId, done, modelIds.length);
    const started = Date.now();

    const outcome = await runModelTest(
      { provider, model: modelId, key },
      'estimate',
      file,
      () => { /* per-page progress is too noisy for this view */ },
    );

    results[modelId] = scoreAccuracy({
      modelId,
      data: outcome.data,
      expectedTotal: benchmark.expectedTotal,
      expectedItemCount: benchmark.expectedItemCount,
      ms: Date.now() - started,
      pages: benchmark.pageCount,
      benchmarkFileName: benchmark.fileName,
      now: Date.now(),
      error: outcome.ok ? null : (outcome.error ?? 'Extraction failed'),
    });

    done++;
    onProgress(modelId, done, modelIds.length);
  }

  return results;
}
```

Add the imports at the top of the file:

```typescript
import { scoreAccuracy, type AccuracyResult } from './probe-accuracy';
import type { BenchmarkDoc } from './benchmark-doc';
```

- [ ] **Step 6: Run tests and type check**

Run: `npx vitest run src/lib/ai/__tests__/probe-runner.test.ts && npx tsc --noEmit`
Expected: PASS and exit 0.

- [ ] **Step 7: Run the full suite**

Run: `npx vitest run`
Expected: all pass. `probe-runner`'s existing tests cover Tier 1 behaviour, which must be unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/probe-runner.ts src/lib/ai/__tests__/probe-runner.test.ts
git commit -m "perf(ai): run providers concurrently, add the tier 2 accuracy runner

Providers are independent rate-limit domains and pacing is already per
provider, so the sequential loop only meant Gemini's ~9 req/min left the
other two idle. Completion order is now unpredictable, so results merge
into the latest state rather than a captured snapshot.

Tier 2 runs the benchmark document through runModelTest - the real
extraction path - so it exercises real chunking and image caps."
```

---

### Task 7: Panel — benchmark upload, per-provider probing, capability grouping

**Files:**
- Modify: `src/components/admin/tabs/AIModelsTab.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–6 — `classifyModel`, `SMALL_DOC_MAX_MS`, `getBenchmarkDoc`, `saveBenchmarkDoc`, `deleteBenchmarkDoc`, `validateBenchmarkInput`, `runAccuracyProbe`, `isAccuracyStale`, `runProviderProbe`, `loadPdf`.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Add state and imports**

Add to the imports in `src/components/admin/tabs/AIModelsTab.tsx`:

```typescript
import { classifyModel } from '@/lib/ai/model-classify';
import { isAccuracyStale } from '@/lib/ai/probe-types';
import { runProviderProbe, runAccuracyProbe } from '@/lib/ai/probe-runner';
import {
  getBenchmarkDoc, saveBenchmarkDoc, deleteBenchmarkDoc, validateBenchmarkInput,
  type BenchmarkDoc,
} from '@/lib/ai/benchmark-doc';
import { loadPdf } from '@/lib/photos/pdf-to-images';
```

Add to the component's state:

```typescript
  const [benchmark, setBenchmark] = useState<BenchmarkDoc | null>(null);
  const [benchmarkError, setBenchmarkError] = useState('');
  const [accuracyRunning, setAccuracyRunning] = useState<ProviderId | null>(null);
  const [accuracyStatus, setAccuracyStatus] = useState('');
```

Load it alongside the existing initial load:

```typescript
  useEffect(() => {
    loadAIModelsConfig().then(setConfig);
    loadModelProbes().then(setProbes);
    getBenchmarkDoc().then(setBenchmark);
  }, []);
```

- [ ] **Step 2: Add the benchmark upload handler**

Add inside the component:

```typescript
  async function onBenchmarkFile(file: File, expectedTotalRaw: string, expectedItemsRaw: string) {
    const expectedTotal = Number(expectedTotalRaw);
    const invalid = validateBenchmarkInput(expectedTotal);
    if (invalid) { setBenchmarkError(invalid); return; }

    setBenchmarkError('');
    try {
      const pdf = await loadPdf(file);
      const pageCount = pdf.numPages;
      await pdf.destroy();

      const items = Number(expectedItemsRaw);
      const doc: BenchmarkDoc = {
        id: 'current',
        fileName: file.name,
        mimeType: file.type,
        blob: file,
        pageCount,
        expectedTotal,
        expectedItemCount: Number.isFinite(items) && items > 0 ? items : null,
        addedAt: Date.now(),
        addedBy: adminEmail,
      };
      await saveBenchmarkDoc(doc);
      setBenchmark(doc);
      toast.success(`Benchmark set — ${file.name}, ${pageCount} pages.`);
    } catch (e: unknown) {
      setBenchmarkError(e instanceof Error ? e.message : 'Could not read that PDF.');
    }
  }

  async function clearBenchmark() {
    await deleteBenchmarkDoc();
    setBenchmark(null);
    toast.success('Benchmark document removed.');
  }
```

- [ ] **Step 3: Add per-provider probe and accuracy handlers**

```typescript
  async function probeOne(p: ProviderId) {
    const key = adminKey(p);
    if (!key) { toast.error(`Add a ${PROVIDER_META[p].label} key in your Profile first.`); return; }

    setProbing(true);
    setProbeStatus(`${PROVIDER_META[p].label}: starting…`);
    try {
      const previous = probes;
      const result = await runProviderProbe(
        p, key, previous.providers[p],
        (done, total) => setProbeStatus(`${PROVIDER_META[p].label}: ${done} of ${total}`),
      );
      const next: ModelProbes = {
        ...previous,
        providers: { ...previous.providers, [p]: result },
      };
      await saveModelProbes(next, adminEmail);
      setPrevProbes(previous);
      setProbes(next);
      toast.success(`${PROVIDER_META[p].label} probed.`);
    } catch (e: unknown) {
      toast.error(`Probe failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setProbing(false);
      setProbeStatus('');
    }
  }

  async function runAccuracy(p: ProviderId) {
    const key = adminKey(p);
    if (!key || !benchmark) return;
    const modelIds = config!.providers[p].models.map(m => m.id);
    if (modelIds.length === 0) { toast.error('Tick at least one model first.'); return; }

    setAccuracyRunning(p);
    try {
      const results = await runAccuracyProbe(
        p, key, modelIds, benchmark,
        (modelId, done, total) => setAccuracyStatus(`${done}/${total} — ${modelId}`),
      );
      const next: ModelProbes = {
        ...probes,
        providers: {
          ...probes.providers,
          [p]: { ...probes.providers[p], accuracy: { ...probes.providers[p].accuracy, ...results } },
        },
      };
      await saveModelProbes(next, adminEmail);
      setProbes(next);
      toast.success(`Accuracy test complete for ${PROVIDER_META[p].label}.`);
    } catch (e: unknown) {
      toast.error(`Accuracy test failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setAccuracyRunning(null);
      setAccuracyStatus('');
    }
  }
```

- [ ] **Step 4: Add the accuracy badge helper**

Add above the component's `return`:

```typescript
  /** Short label for an accuracy result, or null when tier 2 has not run. */
  function accuracyBadge(p: ProviderId, modelId: string): { text: string; tone: string } | null {
    const r = probes.providers[p].accuracy[modelId];
    if (!r) return null;
    const stale = isAccuracyStale(r, benchmark?.fileName ?? null);
    const mins = (r.ms / 60000).toFixed(1);
    if (r.verdict === 'failed') {
      return { text: `failed${stale ? ' (stale)' : ''}`, tone: 'bg-status-danger-tint text-status-danger' };
    }
    const delta = r.totalDeltaPct === null ? '' : ` (${r.totalDeltaPct > 0 ? '−' : ''}${r.totalDeltaPct.toFixed(1)}%)`;
    const tone =
      r.verdict === 'exact' ? 'bg-status-success-tint text-status-success'
      : r.verdict === 'close' ? 'bg-status-warning-tint text-status-warning'
      : 'bg-status-danger-tint text-status-danger';
    return { text: `${r.verdict}${r.verdict === 'exact' ? '' : delta} · ${mins}m${stale ? ' · stale' : ''}`, tone };
  }
```

- [ ] **Step 5: Render the benchmark panel**

Insert immediately after the header block (after the closing `</div>` of the flex header, before the `{probing && …}` progress line):

```tsx
      <div className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Benchmark document</h2>
          {benchmark && (
            <button onClick={clearBenchmark}
              className="text-[10px] font-medium text-status-danger hover:underline">Remove</button>
          )}
        </div>
        {benchmark ? (
          <div className="text-xs text-muted-foreground">
            <div className="font-mono text-foreground">{benchmark.fileName}</div>
            <div className="mt-0.5">
              {benchmark.pageCount} pages · expected total {benchmark.expectedTotal.toLocaleString('en-IN')}
              {benchmark.expectedItemCount !== null && ` · ${benchmark.expectedItemCount} items`}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            A specimen multi-page estimate used to measure how accurately each model extracts a
            real document. Use a specimen with invented vehicle, customer and tax data.
          </p>
        )}
        <p className="text-[10px] text-muted-foreground">
          This document is sent in full to every ticked model on the providers you test, each time
          you run an accuracy test.
        </p>
        <BenchmarkUploader onSubmit={onBenchmarkFile} />
        {benchmarkError && <p className="text-[10px] text-status-danger">{benchmarkError}</p>}
      </div>
```

Add this small component at the bottom of the same file, outside `AIModelsTab`:

```tsx
function BenchmarkUploader({
  onSubmit,
}: { onSubmit: (file: File, total: string, items: string) => void }) {
  const [total, setTotal] = useState('');
  const [items, setItems] = useState('');
  return (
    <div className="flex items-end gap-2 flex-wrap">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-muted-foreground">Expected grand total</span>
        <input value={total} onChange={e => setTotal(e.target.value)} inputMode="decimal"
          placeholder="62392.50"
          className="w-32 text-[11px] px-2 py-1 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-muted-foreground">Line items (optional)</span>
        <input value={items} onChange={e => setItems(e.target.value)} inputMode="numeric"
          placeholder="12"
          className="w-24 text-[11px] px-2 py-1 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary" />
      </label>
      <label className="inline-flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg border border-border cursor-pointer hover:bg-card">
        Choose PDF
        <input type="file" accept="application/pdf" className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onSubmit(f, total, items);
            e.currentTarget.value = '';
          }} />
      </label>
    </div>
  );
}
```

- [ ] **Step 6: Add the per-provider buttons**

In the provider block header, replace the `{d.working.length > 0 && …}` count span with:

```tsx
              <div className="ml-auto flex items-center gap-2">
                {d.working.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{d.working.length} usable</span>
                )}
                <button onClick={() => probeOne(p)} disabled={probing || saving || accuracyRunning !== null}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-border disabled:opacity-50">
                  <RefreshCw size={11} /> Probe
                </button>
                <button
                  onClick={() => runAccuracy(p)}
                  disabled={probing || saving || accuracyRunning !== null || !benchmark || block.models.length === 0}
                  title={
                    !benchmark ? 'Set a benchmark document first'
                    : block.models.length === 0 ? 'Tick at least one model first'
                    : 'Run the benchmark document through every ticked model'
                  }
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-border disabled:opacity-50">
                  <FlaskConical size={11} /> Run accuracy test
                </button>
              </div>
```

Add the running indicator directly beneath the provider header:

```tsx
            {accuracyRunning === p && (
              <div className="px-6 py-2 text-[10px] text-muted-foreground border-b border-border flex items-center gap-2">
                <Loader2 size={11} className="animate-spin" /> Accuracy test — {accuracyStatus}
              </div>
            )}
```

- [ ] **Step 7: Group the working list by capability**

Do this as a mechanical two-part refactor rather than by rewriting the row markup — the row JSX is long and retyping it invites mistakes.

**7a — extract the existing row into a function, unchanged.** The current code is:

```tsx
              <div className="divide-y divide-border">
                {d.working.map(row => {
                  const enabled = isEnabled(p, row.id);
                  /* …existing row body… */
                })}
                {/* unusable disclosure */}
              </div>
```

Cut everything from `const enabled = isEnabled(p, row.id);` through the row's closing `);` into a function declared just above the provider block's `return`. Change nothing inside it:

```tsx
              const renderRow = (row: ProbeResult) => {
                const enabled = isEnabled(p, row.id);
                /* …the exact existing body, pasted verbatim… */
              };
```

`ProbeResult` is already imported in this file. `p`, `block`, `testing`, `testResult`, `testProgress` and `addedSet` all remain in scope because `renderRow` is declared inside the same `.map(p => …)` callback.

**7b — build the groups and map over them.** Declare directly beneath `renderRow`:

```tsx
              const capabilityOf = (r: ProbeResult) =>
                classifyModel(r, probes.providers[p].accuracy[r.id]);

              const groups = [
                {
                  key: 'small',
                  label: 'Good for small documents — licence, RC, policy',
                  rows: d.working.filter(r => capabilityOf(r).smallDocs),
                },
                {
                  key: 'large',
                  label: 'Good for estimates & multi-page bills',
                  rows: d.working.filter(r => capabilityOf(r).largeDocs),
                },
                {
                  key: 'limited',
                  label: 'Limited — too slow for small documents, untested or wrong on large',
                  rows: d.working.filter(r => {
                    const c = capabilityOf(r);
                    return !c.smallDocs && !c.largeDocs;
                  }),
                },
              ].filter(g => g.rows.length > 0);
```

Then replace `{d.working.map(row => { … })}` with:

```tsx
                {groups.map(g => (
                  <div key={g.key}>
                    <div className="px-6 py-2 bg-card text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {g.label}
                    </div>
                    {g.rows.map(renderRow)}
                  </div>
                ))}
```

Leave the "Show N unusable" disclosure exactly where it is, after the groups, still inside the same `<div className="divide-y divide-border">`.

A model qualifying for both headings appears under both — the grouping is a lens on one list, not a partition. Because `renderRow` keys on `row.id` and the same id can now render twice, change the row's outer `key={row.id}` to `key={`${g.key}-${row.id}`}` — pass the group key in as a second argument: `const renderRow = (row: ProbeResult, groupKey: string) => …` and call it as `{g.rows.map(r => renderRow(r, g.key))}`.

- [ ] **Step 8: Add the accuracy badge to each row**

In the row's badge line, immediately after the existing `{row.slow && …}` SLOW badge, add:

```tsx
                            {(() => {
                              const b = accuracyBadge(p, row.id);
                              return b
                                ? <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${b.tone}`}>{b.text}</span>
                                : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-card text-muted-foreground">not tested</span>;
                            })()}
```

- [ ] **Step 9: Type check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0, build succeeds.

- [ ] **Step 10: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 11: Manual verification**

Start the dev server, sign in as admin, open **Admin → AI Models**.

Confirm:
1. **Benchmark panel** — choose a multi-page specimen estimate, enter its grand total, confirm the file name and page count appear.
2. **Rejects bad input** — enter `0` as the total, confirm the inline error and that nothing is stored.
3. **Per-provider probe** — click **Probe** on NVIDIA alone; Gemini and Groq results are untouched.
4. **Accuracy test** — tick two NVIDIA models, click **Run accuracy test**, confirm each gets a verdict badge and that the time shown is whole-document, not per-page.
5. **Grouping** — a fast vision model appears under "small documents"; a model with a `wrong` verdict appears under "Limited".
6. **Staleness** — replace the benchmark with a different file; existing verdicts show `stale` rather than disappearing.
7. **Concurrency** — click **Refresh & probe**; all three provider blocks show progress at the same time, and the run finishes materially faster than 20 minutes.

- [ ] **Step 12: Commit**

```bash
git add src/components/admin/tabs/AIModelsTab.tsx
git commit -m "feat(admin): benchmark document, per-provider probing, capability grouping

Models are grouped by what they are actually fit for - small documents
need vision and speed, large documents need table accuracy - instead of
one flat list ranked by speed that put a fast-wrong model on top."
```

---

## Verification checklist

- [ ] `npm test` passes
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` succeeds
- [ ] Tier 1 behaviour unchanged — no existing probe test needed editing
- [ ] A full probe shows all three providers progressing at once
- [ ] Probing one provider leaves the other two's results intact
- [ ] An accuracy verdict of `wrong` puts a model under "Limited", not at the top of the list
- [ ] Replacing the benchmark marks existing verdicts stale rather than deleting them
