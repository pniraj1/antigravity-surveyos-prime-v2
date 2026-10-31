# Extraction Bench & Per-Model Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sandbox-only bench that measures each AI model's safe rows per call, token cost and error types on many estimate PDFs. Its approved limits then drive page grouping in the live app. Also fixes row page order and digital-PDF text layout.

**Architecture:**
- Small pure modules under `src/lib/bench/`: pacing, scoring, agreement, step-up and the run store.
- Hooks into the existing extraction path: `AITestOverride` gains bench settings, and `callWithKey` reports usage to a call meter.
- A sandbox-only `/bench` page drives it all from the browser.
- The live app only reads a committed `page-limits.ts`.

**Tech Stack:** Next.js 16 static export, TypeScript, Zustand, idb (IndexedDB), pdfjs-dist, Vitest, Firebase Functions (Node 22, `functions/index.js`).

**Spec:** `docs/superpowers/specs/2026-10-31-model-page-limits-bench-design.md`

## Global Constraints
- Work and commit directly on `main`. No branches, no PRs. Conventional commit messages, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never edit `src/lib/ai/prompts.ts`.
- No new npm dependencies (root or `functions/`).
- Bench code runs only when `isSandbox()` is true. Production hosts `motorsurveyos-in.*` never run it.
- Never sort rows by printed serial number.
- Rate-limited / timeout / network failures are never counted as model errors.
- Gemini is off by default on the bench. Default daily cap = 50% of the reported daily limit, else 100 calls per provider per run.
- Grand-total and subtotal tie tolerance: ₹1.
- Before every commit: `npx vitest run` and `npx tsc --noEmit` are clean. Write the test first for logic.
- UTF-8 files (`₹`, `→`, `—`): never rewrite them through PowerShell / Python re-encoding.
- Files stay under 800 lines. `processor.ts` is 823 already, so new logic goes into new modules, and processor only calls them.
- Prime ↔ Scan impact: none expected. Each task report states "Scan impact: none" after checking that no coupling file was touched.

## Review Focus
1. **An estimate whose serials restart per section** (parts 1–20, labour 1–15). Gap/duplicate/order checks must run per section and per estimate, and must not report false gaps. → Task 7 test `restarted serials per section are not gaps`.
2. **A page with zero line items** (a cover or terms page) inside a multi-page run. The reading must not fail the order check or the expected-rows grouping. → Task 7 test `empty page passes`; Task 12 test `zero expected rows still yields a group`.
3. **A provider that returns 429 and then succeeds.** The cell is retried, not failed, and the retry counts as a call made. → Task 3 test `429 then ok`.
4. **The browser tab sleeps or reloads mid-run.** Resume skips finished cells and doesn't re-spend calls. → Task 10 test `resume skips done cells`.
5. **A digital PDF whose text layer is garbage** (fonts mapped to symbols). It must stay on vision, never be sent as text. → Task 6 test `garbage page stays vision`.

---

### Task 1: Rows keep page order after gap-fill

The cause, found in the code: `mergeBySerial` (`row-check.ts:175`) appends gap-fill rows to the end of each section. A re-read page 1 therefore lands after page 2.

**Files:**
- Modify: `src/lib/ai/row-check.ts` (`mergeBySerial`, new `orderByPage`)
- Test: `src/lib/ai/__tests__/row-check.test.ts`

**Interfaces:**
- Produces: `export function orderByPage<T>(data: T): T`. For each section, a **stable** sort by `_page` ascending; rows without `_page` keep their relative position after tagged rows of a lower page. `mergeBySerial` returns `orderByPage(result)`.

- [ ] **Step 1: Write failing tests**
```ts
it('gap-filled page-1 rows go before page-2 rows', () => {
  const data = tagRows({ labour_items: [{ sr_no: 11 }, { sr_no: 12 }] }, 1, 1);
  const out = mergeBySerial(data, tagRows({ labour_items: [{ sr_no: 1 }, { sr_no: 2 }] }, 0, 0));
  expect(out.labour_items.map(r => r.sr_no)).toEqual([1, 2, 11, 12]);
});
it('keeps model order within one page (no serial sort)', () => {
  const data = tagRows({ spare_parts: [{ sr_no: 5 }, { sr_no: 3 }] }, 0, 0);
  expect(orderByPage(data).spare_parts.map(r => r.sr_no)).toEqual([5, 3]);
});
it('parts and labour stay in their sections', () => {
  const data = { ...tagRows({ spare_parts: [{ sr_no: 9 }] }, 1, 1), ...tagRows({ labour_items: [{ sr_no: 1 }] }, 0, 0) };
  const out = orderByPage(data);
  expect(out.spare_parts).toHaveLength(1); expect(out.labour_items).toHaveLength(1);
});
```
- [ ] **Step 2:** `npx vitest run src/lib/ai/__tests__/row-check.test.ts`. Expected: FAIL (`orderByPage` is not exported, and the first test gets `[11,12,1,2]`).
- [ ] **Step 3:** Implement `orderByPage` with `mapSections` and a stable sort (`Array.prototype.sort` is stable). Return `orderByPage(out)` from `mergeBySerial`.
- [ ] **Step 4:** Run the same test file, then `npx vitest run src/lib/ai`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(ai): gap-filled rows keep page order`

---

### Task 2: Call meter, recording tokens and rate limits per call

**Files:**
- Create: `src/lib/ai/call-meter.ts`
- Modify: `src/lib/ai/service.ts` (`CallResult`, `callWithKey`: Gemini, Ollama, Groq and NVIDIA branches)
- Modify: `src/lib/firebase/functions.ts` (`ProxyResult` gains `rateLimit?`)
- Test: `src/lib/ai/__tests__/call-meter.test.ts`

**Interfaces:**
- Produces:
```ts
export interface RateLimitInfo { limitRequests?: number; remainingRequests?: number; limitTokens?: number; remainingTokens?: number; retryAfterMs?: number }
export interface CallRecord { provider: ProviderId; model: string; tokensIn: number | null; tokensOut: number | null; ms: number; finish: Finish | 'ERROR'; status?: number; rateLimit?: RateLimitInfo; at: number }
export function parseRateLimit(h: Record<string, string | null | undefined>): RateLimitInfo | undefined
export function usageOf(provider: ProviderId, body: any): { tokensIn: number | null; tokensOut: number | null }
export function recordCall(r: CallRecord): void
export function subscribeCalls(fn: (r: CallRecord) => void): () => void   // returns unsubscribe
```
- `CallResult` becomes `{ text; finish; usage?: { tokensIn: number | null; tokensOut: number | null } }`.
- `usageOf`:
  - gemini: `usageMetadata.promptTokenCount` / `candidatesTokenCount`
  - groq / nvidia: `usage.prompt_tokens` / `completion_tokens`
  - ollama: `prompt_eval_count` / `eval_count`
  - missing values → `null`
- `parseRateLimit` reads these headers, case-insensitive:
  - `x-ratelimit-limit-requests`, `x-ratelimit-remaining-requests`
  - `x-ratelimit-limit-tokens`, `x-ratelimit-remaining-tokens`
  - `retry-after`, in seconds or as an HTTP date → ms
  - all absent → `undefined`
- `callWithKey` calls `recordCall` once per attempt, on success and on `ProviderError` alike (`finish: 'ERROR'`, `status`).
  - For a Gemini 429, set `retryAfterMs` from `RetryInfo.retryDelay` in the error details when present.
  - Recording never throws into the caller (wrap it in try/catch).

- [ ] **Step 1: Write failing tests**
  - `usageOf` for each of the 4 providers, plus `null` when the field is absent.
  - `parseRateLimit({ 'X-RateLimit-Remaining-Requests': '7', 'retry-after': '2' })` → `{ remainingRequests: 7, retryAfterMs: 2000 }`.
  - `parseRateLimit({})` → `undefined`.
  - `subscribeCalls` receives a recorded call, and stops receiving after unsubscribe.
- [ ] **Step 2:** Run `npx vitest run src/lib/ai/__tests__/call-meter.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `call-meter.ts` (a plain listener `Set`), then wire `callWithKey`. For the browser fetches (Gemini, Groq), read `res.headers.get(...)`; CORS may hide them, and `undefined` is fine. For proxied calls, use `proxied.rateLimit`.
- [ ] **Step 4:** Run `npx vitest run src/lib/ai` and `npx tsc --noEmit`. Expected: PASS / clean, with existing service tests unchanged.
- [ ] **Step 5: Commit** `feat(ai): call meter records tokens and rate limits per call`

---

### Task 3: Proxy passes rate-limit headers, and a per-provider pacer

**Files:**
- Modify: `functions/index.js` (`proxyToProvider` return)
- Test: the existing functions proxy test file (find it with `grep -rl proxyToProvider functions/`). Add one case.
- Create: `src/lib/bench/pacer.ts`
- Test: `src/lib/bench/__tests__/pacer.test.ts`

**Interfaces:**
- The proxy returns `{ status, ok, body, rateLimit }`, where `rateLimit` is an object holding only the response headers present among: `x-ratelimit-limit-requests`, `x-ratelimit-remaining-requests`, `x-ratelimit-limit-tokens`, `x-ratelimit-remaining-tokens`, `retry-after`. Keys stay header names; the client parses them with `parseRateLimit`.
- Produces:
```ts
export interface PacerOptions { minGapMs: number; dailyCap: number; now?: () => number; sleep?: (ms: number) => Promise<void> }
export interface Pacer {
  take(): Promise<'go' | 'capped'>;           // waits for the gap; 'capped' once callsMade >= dailyCap
  onRateLimited(retryAfterMs?: number): 'retry' | 'pause'; // first 429 in a row → 'retry' (and the next take waits retryAfterMs ?? 60_000); second in a row → 'pause'
  onSuccess(): void;                           // resets the 429 streak
  readonly callsMade: number;
  readonly paused: boolean;
}
export function createPacer(o: PacerOptions): Pacer
export function defaultDailyCap(limitRequestsPerDay?: number): number   // floor(limit*0.5) or 100
```

- [ ] **Step 1: Write failing tests** (inject `now` and `sleep`):
  - `take` waits `minGapMs` between calls.
  - `capped` after `dailyCap` calls.
  - **`429 then ok`:** `onRateLimited(2000)` → `'retry'`, the next `take` sleeps 2000, then `onSuccess`, and a later single 429 → `'retry'` again.
  - Two 429s in a row → `'pause'` and `paused === true`.
  - `defaultDailyCap(1000) === 500`, and `defaultDailyCap() === 100`.
  - Functions test: a mocked provider response with `x-ratelimit-remaining-requests: 5` → result `rateLimit['x-ratelimit-remaining-requests'] === '5'`.
- [ ] **Step 2:** Run `npx vitest run src/lib/bench` and `npm run test:functions`. Expected: FAIL.
- [ ] **Step 3:** Implement both.
- [ ] **Step 4:** Run both commands again. Expected: PASS.
- [ ] **Step 5: Commit** `feat(bench): provider pacer and proxy rate-limit pass-through`. Functions deploy is deferred to Task 14.

---

### Task 4: Bench settings on the extraction override

**Files:**
- Modify: `src/lib/ai/service.ts` (`AITestOverride`)
- Create: `src/lib/ai/bench-override.ts` (helpers, keeping `processor.ts` small)
- Modify: `src/lib/ai/processor.ts` (chunk size, method, image scale, raw)
- Modify: `src/lib/ai/processor.ts` `fileToImages` (API image scale; today hard-coded 1.5)
- Test: `src/lib/ai/__tests__/processor-flow.test.ts`

**Interfaces:**
- `AITestOverride` gains `pagesPerCall?: number; method?: 'text' | 'vision'; imageScale?: 1 | 1.25 | 1.5; raw?: boolean`.
- Produces in `bench-override.ts`:
```ts
export function chunkSizeFor(defaultSize: number, o: AITestOverride | null): number   // o?.pagesPerCall ?? defaultSize, then clamped by the image cap as today
export function isRaw(o: AITestOverride | null): boolean
export function apiImageScale(o: AITestOverride | null): number                      // o?.imageScale ?? 1.5
```
- With `raw`:
  - the auto-split branch in `mergeResponse` is skipped, so a failed chunk only adds an issue;
  - `fillGaps`, `dropDuplicates` and the second opinion are skipped.
- `method` overrides `docMode` (the same effect as `forceDocMode`).
- With no override, behaviour is unchanged.

- [ ] **Step 1: Write failing tests** in `processor-flow.test.ts`, mocking `callAIGateway` the way the file already does:
  - `pagesPerCall: 1` on a 3-page vision doc → 3 gateway calls.
  - `raw: true` and a truncated JSON reply on a 2-page chunk → no split calls, and the issue lists pages 1–2.
  - `raw: true` with a serial gap → `fillGaps` is not called.
  - No override → today's call count (2-page chunks).
- [ ] **Step 2:** Run that file. Expected: FAIL.
- [ ] **Step 3:** Implement. `fileToImages` takes the scale from `apiImageScale(getAITestOverride())`.
- [ ] **Step 4:** Run `npx vitest run src/lib/ai` and `npx tsc --noEmit`. Expected: PASS / clean.
- [ ] **Step 5: Commit** `feat(ai): bench override for pages per call, method, image scale and raw mode`

---

### Task 5: Digital-PDF text laid out as lines

**Files:**
- Create: `src/lib/ai/text-lines.ts`
- Modify: `src/lib/ai/processor.ts` `extractPageText` → `layoutLines(textContent.items)`
- Test: `src/lib/ai/__tests__/text-lines.test.ts`

**Interfaces:**
- Produces:
```ts
export interface TextItem { str: string; transform: number[]; width: number }   // pdf.js item; x = transform[4], y = transform[5]
export function layoutLines(items: TextItem[]): string   // lines top→bottom, each left→right; gap > 2× the median char width → ' | '; lines joined by '\n'
export function countAmountLines(text: string): number   // lines ending in an amount like 1,234.00 or 1234 → expected rows (used in Task 12)
```
- Same line = |Δy| ≤ half the median item height (use `transform[3]`, falling back to 10).

- [ ] **Step 1: Write failing tests**
  - Three items on two y values come out as two lines in reading order.
  - Two items with a wide x gap are joined by `' | '`.
  - Items arriving out of order (pdf.js order isn't guaranteed) still sort.
  - Empty → `''`.
  - `countAmountLines('Bumper | 1 | 2,450.00\nTotal\n')` → `1`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement, and switch `extractPageText` to it. `profilePages` thresholds stay as they are.
- [ ] **Step 4:** Run `npx vitest run src/lib/ai` (existing text-mode tests must pass; update any whose expected text was space-joined, saying why in the commit).
- [ ] **Step 5: Commit** `feat(ai): digital PDF text keeps lines and columns`

---

### Task 6: Text or image decided per page, in runs

**Files:**
- Create: `src/lib/ai/page-runs.ts`
- Modify: `src/lib/ai/processor.ts` (the chunk loop iterates runs; it no longer uses one `docMode` for the whole document)
- Test: `src/lib/ai/__tests__/page-runs.test.ts`, `processor-flow.test.ts`

**Interfaces:**
- Produces:
```ts
export interface PageRun { method: 'text' | 'vision'; pages: number[] }   // 0-based, ascending, consecutive
export function pageRuns(modes: ('text' | 'vision')[], force?: 'text' | 'vision'): PageRun[]
```
- `modes` comes from `profilePages(...).pages[i].mode` (garbage text → vision, as today).
- Chunks never cross a run boundary. Text chunks keep today's 1 page per call unless Task 12 grouping applies. Vision runs use today's chunk size.

- [ ] **Step 1: Write failing tests**
  - `['text','text','vision','text']` → three runs.
  - `force: 'vision'` → one run.
  - **`garbage page stays vision`:** a profile of one page with symbol-garbage text → a vision run.
  - processor-flow: a mixed 3-page doc sends page 3 as an image and pages 1–2 as text, and the result rows are in page order.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Remove the "≥85% → whole doc text" rule; the per-page modes decide.
- [ ] **Step 4:** Run `npx vitest run src/lib/ai` and `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(ai): mixed PDFs read text pages as text and scans as images`

---

### Task 7: Self-check and error typing

**Files:**
- Create: `src/lib/bench/types.ts`, `src/lib/bench/score.ts`
- Test: `src/lib/bench/__tests__/score.test.ts`

**Interfaces (types.ts):**
```ts
export interface EstimateSpan { label: string; firstPage: number; lastPage: number; grandTotal: number | null; subtotals?: Partial<Record<'spare_parts' | 'labour_items' | 'painting_items', number>> }
export interface PdfProfile { id: string; fileName: string; kind: 'digital' | 'scan' | 'mixed'; pageCount: number; estimates: EstimateSpan[]; unreadablePages: number[]; confirmed: boolean }   // pages 1-based
export interface BenchRow { section: 'spare_parts' | 'labour_items' | 'painting_items'; srNo: number | null; description: string; qty: number | null; rate: number | null; amount: number; page: number }   // page 1-based (first page of its call)
export type ErrorType = 'missed' | 'invented' | 'duplicated' | 'wrong_amount' | 'wrong_order' | 'totals_mismatch' | 'broken_reply' | 'rate_limited' | 'unreadable';
export interface BenchError { type: ErrorType; estimate: string; page: number | null; srNo: number | null; detail: string }
export const COUNTS_AGAINST_MODEL: ReadonlySet<ErrorType>   // all except rate_limited, unreadable
```
**Interfaces (score.ts):**
```ts
export function toBenchRows(data: unknown): BenchRow[]                       // from extraction data with _page tags; amount = total_amount ?? amount ?? 0
export function selfCheck(rows: BenchRow[], profile: PdfProfile): BenchError[]   // per estimate: totals within ₹1, serial gaps/dups per section, qty×rate=amount (±₹1)
export function compareToReference(rows: BenchRow[], ref: BenchRow[], profile: PdfProfile): BenchError[]   // missed / invented / duplicated / wrong_amount / wrong_order
export function passes(errors: BenchError[]): boolean                        // no error in COUNTS_AGAINST_MODEL
```
- Rows on `unreadablePages` are excluded from both checks.
- Matching: same estimate (by page span) and section, normalised description (lower case, collapsed whitespace, punctuation removed) with Levenshtein ≤ 3 or one contains the other, **and** amount within ₹1. Exact rule = builder's call within this.
- `wrong_order`: matched rows' order differs from the reference order within the estimate.

- [ ] **Step 1: Write failing tests**
  - Totals off by ₹2 → `totals_mismatch`.
  - **`restarted serials per section are not gaps`.**
  - **`empty page passes`:** a page with no rows inside the span gives no error.
  - Two estimates numbered from 1 are not duplicates of each other.
  - A missing row → `missed`, with page and serial.
  - Swapped page blocks → `wrong_order`.
  - A row on an unreadable page → no error.
  - `passes` ignores `rate_limited`.
- [ ] **Step 2–4:** Run `npx vitest run src/lib/bench`: FAIL, then implement, then PASS.
- [ ] **Step 5: Commit** `feat(bench): self-check and typed errors per estimate`

---

### Task 8: Agreement, a reference reading without a hand key

**Files:**
- Create: `src/lib/bench/agree.ts`
- Test: `src/lib/bench/__tests__/agree.test.ts`

**Interfaces:**
```ts
export interface Reading { cellId: string; model: string; rows: BenchRow[]; errors: BenchError[] }
export function referenceFor(readings: Reading[], profile: PdfProfile, gold?: BenchRow[]): { source: 'gold' | 'agreement'; rows: BenchRow[] } | null
```
- Gold, when given, always wins.
- Otherwise: take readings whose `selfCheck` has no errors that count; if two or more from **different models** have `compareToReference(a, b)` with zero counting errors, return the first one's rows as `'agreement'`; else `null` (the PDF goes to "needs owner").

- [ ] **Step 1: Write failing tests:** gold wins; two agreeing models → agreement; two readings from the same model don't count; one disagreement → `null`; a reading that fails the self-check is ignored.
- [ ] **Step 2–4:** Run, implement, pass.
- [ ] **Step 5: Commit** `feat(bench): agreement reference from independent models`

---

### Task 9: Bench store, saved runs and JSON export

**Files:**
- Modify: `src/lib/storage/indexeddb.ts` (`DB_VERSION` 7 → 8; stores `benchProfiles` keyPath `id`, `benchGold` keyPath `profileId`, `benchCells` keyPath `id`, `benchPdfs` keyPath `id` holding `{ id, blob, fileName }`)
- Create: `src/lib/bench/store.ts`
- Test: `src/lib/bench/__tests__/store.test.ts` (use the existing IndexedDB test setup; check how `prune-storage.test.ts` does it)

**Interfaces:**
```ts
export interface CellKey { profileId: string; provider: ProviderId; model: string; method: 'text' | 'vision'; pagesPerCall: number; imageScale: 1 | 1.25 | 1.5; runNo: number }
export interface CellResult extends CellKey { id: string; status: 'done' | 'rate_limited' | 'capped'; rows: BenchRow[]; errors: BenchError[]; calls: CallRecord[]; tokensIn: number; tokensOut: number; ms: number; modelVersion: string; at: number }
export function cellId(k: CellKey): string        // stable join of all key fields
export const bench: {
  putProfile(p: PdfProfile): Promise<void>; profiles(): Promise<PdfProfile[]>;
  putPdf(id: string, blob: Blob, fileName: string): Promise<void>; pdf(id: string): Promise<File | null>;
  putGold(profileId: string, rows: BenchRow[]): Promise<void>; gold(profileId: string): Promise<BenchRow[] | null>;
  putCell(c: CellResult): Promise<void>; cells(): Promise<CellResult[]>;
  exportJson(): Promise<string>;   // profiles + gold + cells (no PDF blobs)
  importJson(json: string): Promise<void>;   // merges by id
}
```
- [ ] **Step 1: Write failing tests:** a profile round-trips; `cellId` is stable and distinct per field; export → clear → import restores cells; the version-8 upgrade keeps existing claims (open v7, put a claim, reopen v8, the claim is still there).
- [ ] **Step 2–4:** Run, implement, pass.
- [ ] **Step 5: Commit** `feat(bench): IndexedDB store for profiles, gold keys and cell results`

---

### Task 10: Step-up planner and runner

**Files:**
- Create: `src/lib/bench/plan.ts`, `src/lib/bench/runner.ts`
- Test: `src/lib/bench/__tests__/plan.test.ts`, `src/lib/bench/__tests__/runner.test.ts`

**Interfaces (plan.ts):**
```ts
export const PAGES_STEPS = [1, 2, 3, 4] as const;
export const SCALES = [1, 1.25, 1.5] as const;
export interface ModelPick { provider: ProviderId; model: string; key: string; methods: ('text' | 'vision')[] }
export function plannedCalls(profile: PdfProfile, pagesPerCall: number): number          // sum over runs of ceil(pages/pagesPerCall), excluding nothing
export function nextCell(done: CellResult[], profile: PdfProfile, pick: ModelPick, set: 'hard' | 'wide', proposed?: number): CellKey | null
export function planEstimate(profiles: PdfProfile[], picks: ModelPick[], hardIds: string[]): Record<ProviderId, number>   // upper-bound calls per provider, shown before Start
```
- `nextCell`, hard set, per method:
  1. Start at 1 page, scale 1.5.
  2. Step up while the last cell passed.
  3. At the first failure, repeat it once (`runNo` 2). If the repeat passes, treat that step as borderline and run it a 3rd time.
  4. Stop when a step fails twice, or after 4 pages.
  5. Then, at the best passing pages-per-call, try scales 1.25 and then 1.0, stopping at the first failure.
- `nextCell`, wide set: one cell at `proposed` pages, scale = the best from the hard set.
- `rate_limited` cells are re-queued (the same key, the same `runNo`).

**Interfaces (runner.ts):**
```ts
export interface RunnerDeps { runModelTest: typeof import('@/lib/ai/service').runModelTest; store: typeof bench; pacerFor(p: ProviderId): Pacer; subscribeCalls: typeof subscribeCalls }
export interface RunProgress { provider: ProviderId; callsMade: number; callsPlanned: number; tokensIn: number; tokensOut: number; waitMs: number; lastError: string | null; paused: boolean }
export function runBench(deps: RunnerDeps, profiles: PdfProfile[], picks: ModelPick[], hardIds: string[], onProgress: (p: RunProgress) => void, signal: AbortSignal): Promise<void>
```
- Providers run side by side (`Promise.all` per provider), one cell at a time within a provider.
- Each cell:
  1. `pacer.take()`; on `'capped'`, stop that provider.
  2. Run `runModelTest` with the override `{ ..., pagesPerCall, method, imageScale, raw: true }`.
  3. Collect `CallRecord`s by subscribing.
  4. Score with `selfCheck` and, when a reference exists, `compareToReference`.
  5. `putCell`, then export JSON to a download only when the user asked (see Task 11). The automatic file save is the per-PDF export below.
- A 429 `ProviderError` → `pacer.onRateLimited` → retry or pause, recorded `rate_limited`.
- **`resume skips done cells`:** `nextCell` reads `store.cells()`, so a restart continues.
- `modelVersion` = the model id string as returned by the provider when present, else the id.

- [ ] **Step 1: Write failing tests**
  - Step-up: pass@1, pass@2, fail@3 → repeat@3, which fails → stop, and scales come next at 2.
  - Borderline: fail@3 then pass@3 → a 3rd run@3.
  - Wide set gives exactly one cell.
  - `plannedCalls` for 13 pages at 1/2/3/4 = 13/7/5/4.
  - Runner with fake deps: **`resume skips done cells`**; a 429 → retry → ok is stored `done`; two 429s pause only that provider while the others continue; `capped` stops the provider and keeps the remaining cells for the next run.
- [ ] **Step 2–4:** Run, implement, pass.
- [ ] **Step 5: Commit** `feat(bench): step-up planner and paced runner with resume`

---

### Task 11: The sandbox `/bench` page

**Files:**
- Create: `src/app/bench/page.tsx`
- Create, under `src/components/bench/`:
  - `BenchPage.tsx`
  - `ProfileEditor.tsx`: PDF upload, kind, estimate spans, totals, unreadable pages, confirm
  - `GoldEditor.tsx`: an editable row table seeded from the best reading, with a Lock button
  - `RunPanel.tsx`: model picks; Gemini unchecked by default with a "uses N of today's quota" note; daily caps; planned calls per provider; Start / Stop; live `RunProgress` rows; a wake lock
  - `ResultsTable.tsx`: per model and method, max passing pages, max rows per call, tokens per correct row, error counts by type, a "needs owner" PDF list, a stale (>30 days) badge
  - a **"Checker vs gold"** line (spec checklist D): for every reading of a gold PDF, does the pass/fail from `selfCheck` plus agreement (computed without gold) equal the pass/fail against gold? It shows N/N agree, and other results are greyed out until N/N holds. Test: one disagreeing reading greys the results.
- Test: `src/components/bench/__tests__/BenchPage.test.tsx`

**Interfaces:**
- Consumes `bench`, `runBench`, `planEstimate`, `referenceFor`, `isSandbox`.
- Proposing totals on digital PDFs: use `pageTexts` from `src/lib/documents/kit/page-text.ts` and take the largest amount on lines containing "total". This is only a proposal; the owner confirms it.
- `src/app/bench/page.tsx` renders `<BenchPage/>` only when `isSandbox()`, else the text "The bench runs only on the sandbox site." It isn't linked from the app nav, so `AppTab`, `useRouteSync` and the URL contract are untouched.
- Export buttons: "Export results (JSON)" (`bench.exportJson`) and "Import". After each PDF finishes in a run, a JSON snapshot is saved automatically (`<a download>`) **only if** the owner ticked "Save a file after each PDF". The default is ticked.
- Keys: entered on the page and kept only in memory, never stored.

- [ ] **Step 1: Write failing tests**
  - When `isSandbox()` is false, the bench isn't rendered.
  - Gemini is unchecked by default.
  - The planned calls shown match `planEstimate` for a mocked profile.
  - Start is disabled until at least one profile is confirmed.
- [ ] **Step 2–4:** Run, implement, pass. Keep each component under ~250 lines.
- [ ] **Step 5: Commit** `feat(bench): sandbox bench page`

---

### Task 12: Limits table and grouping by rows in the live app

**Files:**
- Create: `src/lib/ai/page-limits.ts` (the committed table; starts empty)
- Create: `src/lib/ai/group-pages.ts`
- Create: `src/lib/bench/export-limits.ts` (bench → TypeScript source text)
- Modify: `src/lib/ai/processor.ts` (use `groupPages` when `limitsFor(model, method)` exists)
- Modify: `src/components/bench/ResultsTable.tsx` (an "Export limits table" button that copies the source text)
- Test: `src/lib/ai/__tests__/group-pages.test.ts`, `src/lib/bench/__tests__/export-limits.test.ts`

**Interfaces:**
```ts
// page-limits.ts
export interface ModelLimit { model: string; method: 'text' | 'vision'; maxRowsPerCall: number; maxPagesPerCall: number; imageScale: 1 | 1.25 | 1.5; measuredAt: string; modelVersion: string }
export const PAGE_LIMITS: readonly ModelLimit[] = [];
export function limitsFor(model: string, method: 'text' | 'vision'): ModelLimit | undefined
// group-pages.ts
export function groupPages(pages: number[], expectedRows: (number | null)[], limit: ModelLimit, imageCap: number | null): number[][]
// export-limits.ts
export function proposeLimits(cells: CellResult[]): ModelLimit[]   // per model+method: the largest pages-per-call passing on every hard PDF in 2 runs (3 at borderline) and its wide-set cells; maxRowsPerCall = the smallest row count among the passing calls at that setting's densest page group; imageScale = the cheapest passing
export function limitsSource(limits: ModelLimit[]): string          // full page-limits.ts file text
```
- `groupPages`:
  - fill a group while (rows so far + the next page's expected rows) ≤ `maxRowsPerCall`, the group length < `maxPagesPerCall`, and it is under the image cap;
  - a `null` estimate (scan) = the running average of rows read so far, or `maxRowsPerCall` when there is none yet, so the first scanned page is always its own group;
  - **`zero expected rows still yields a group`**;
  - a single page over the limit is still its own group.
- Expected rows for text pages = `countAmountLines(layout text)`.
- The live app with a model not in `PAGE_LIMITS` behaves exactly as today. Auto-split and gap-fill stay on.
- The fallback to another model re-groups: grouping is computed per run, in the chunk loop, from the session's current model. If the gateway switches the model mid-document, the remaining pages are grouped for the new model (read it from `session.lastGood?.model` before each chunk).

- [ ] **Step 1: Write failing tests**
  - `groupPages` with rows [30,30,30] and max 60 → [[1,2],[3]].
  - Null on the first scanned page → its own group.
  - Respects `maxPagesPerCall` and the image cap.
  - `zero expected rows still yields a group`.
  - `proposeLimits` picks 2 when 3 failed.
  - `limitsSource` output compiles (import it in the test via a `new Function` check, or just snapshot it).
  - processor-flow: with an empty `PAGE_LIMITS`, the call count is unchanged.
- [ ] **Step 2–4:** Run, implement, pass. Run `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(ai): group pages by each model's measured rows-per-call limit`

---

### Task 13: Production guard for `?sandbox=true`

**Files:**
- Modify: `src/lib/sandbox.ts` (`isSandbox`)
- Test: `src/lib/__tests__/sandbox.test.ts` (create it if absent)

**Interfaces:** `isSandbox()` returns false whenever the host matches `/^motorsurveyos-in\.(web\.app|firebaseapp\.com)$/`. Everything else is unchanged: sandbox hosts, preview channels, localhost `?sandbox=true` and `NEXT_PUBLIC_SANDBOX_MODE`.

- [ ] **Step 1: Write failing tests:**
  - production host + `?sandbox=true` → false;
  - `surveyos-v2-antigravity-in.web.app` → true;
  - `motorsurveyos-in--sandbox-abc.web.app` → true;
  - `localhost` + `?sandbox=true` → true.
- [ ] **Step 2–4:** Run, implement, pass.
- [ ] **Step 5: Commit** `fix(sandbox): ?sandbox=true is ignored on the production host`

---

### Task 14: Whole check, sandbox deploy, vault

- [ ] **Step 1:** Run `npx vitest run`, `npx tsc --noEmit` and `npm run test:functions`. All must be green; record the counts.
- [ ] **Step 2:** Confirm no coupling file changed: `git diff --stat <start>..HEAD -- src/types/documents.ts src/lib/scan-import src/components/print/SpotPrintReport.tsx` is empty. Scan impact: none.
- [ ] **Step 3: Ask the owner** before deploying functions and the sandbox site:
  - `npm run build`
  - `firebase deploy --only functions:aiProxy,hosting:surveyos-v2-antigravity-in --project surveyos-v2-antigravity-in`

  Never deploy `hosting:motorsurveyos-in` in this plan.
- [ ] **Step 4:** Verify the sandbox deploy with no login: grep `out/_next/static/chunks/` for `The bench runs only on the sandbox site`, then curl that chunk from `https://surveyos-v2-antigravity-in.web.app` and grep the same text.
- [ ] **Step 5:** Update the vault per `AGENT_PROTOCOL.md`: `Tasks.md` (the bench and the owner's checklist §6.6 A–F), `Changelog.md`, and a new `Sessions/2026-10-31-extraction-bench.md`. Then commit `docs(kb): extraction bench session`.

Not in this plan, and owner-gated: shipping a filled `PAGE_LIMITS` to production. That happens after bench runs, owner approval and checklist F.
