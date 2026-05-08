# Estimate Extraction — Hybrid Pipeline Design

**Date:** 2026-05-06
**Branch:** feature/insured-claim-summary
**Status:** Design — pending approval
**Owner:** SurveyOS-Prime-V2 AI extraction subsystem

---

## 1. Problem Statement

Multi-page repair-estimate PDFs (typically 4–8 pages, 50–80+ line items) fail extraction reliably. Three concrete failure modes have been confirmed in code:

1. **Gemini free-tier quota exhaustion.** Each 2-page chunk emits 10,000–20,000 output tokens of JSON. Three or four estimates exhaust the daily TPM budget on Gemini 1.5 Flash free tier.
2. **Groq vision pathway is dead.** `GROQ_FALLBACK_CHAIN` contains only text-only models (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`). The vision-only filter in `callWithRotation()` rejects all of them, so any scanned estimate routed to Groq silently returns nothing.
3. **Groq output truncation.** `max_tokens: 8192` truncates large estimate JSON mid-array, causing `JSON.parse()` failures and silent skipping in multi-page mode.

Underlying these bugs is a **design mistake**: the system uses a vision LLM as a parser for documents that are, in 90%+ of cases, structured ERP exports with text layers (Tata DTC, Maruti MGA, Hyundai DMS, etc.). AI is the wrong tool for the common case.

## 2. Goals and Non-Goals

### Goals

- Eliminate quota-related failures for digital workshop estimates.
- Make scanned estimates extract reliably and resumably under free-tier limits.
- Keep all existing downstream contracts intact (reconciliation.ts, claim-store.ts, AssessmentTab) — same JSON shape in, same store paths out.
- No paid-tier API requirement.
- No UI redesign — only opportunistic UX improvements (quota meter, parser confidence badge).

### Non-Goals

- Not building a generic OCR engine.
- Not replacing AI extraction for documents that genuinely need vision (RC books, scanned policies, photos).
- Not introducing background workers, server-side processing, or new infra.

## 3. Solution Overview

A six-layer pipeline replaces the single-shot AI-only flow:

```
┌─────────────────────────────────────────────────────────────────┐
│  Upload  →  Layer 1: Profile  →  Layer 2: Cache lookup          │
│                                          │                      │
│                              hit?  ──────┴───── miss            │
│                               ↓                  ↓              │
│                          return cached    Layer 3: Parser       │
│                                                  │              │
│                                       parsed?  ──┴── unparsed   │
│                                          ↓             ↓        │
│                              Layer 4: Categorize  Layer 5: AI   │
│                              (cheap Groq call)    (vision path) │
│                                          ↓             ↓        │
│                                   Layer 6: Validate + cache     │
│                                          ↓                      │
│                                  reconciliation.ts  →  store    │
└─────────────────────────────────────────────────────────────────┘
```

The pipeline short-circuits at the cheapest viable layer. AI is invoked only when local parsing cannot meet a confidence threshold.

## 4. Architecture by Layer

### Layer 1 — Document Profiling

**Purpose:** Decide which strategy to use before any expensive work.

**Input:** raw `File` object.
**Output:** `DocumentProfile` describing routing decisions.

```ts
interface DocumentProfile {
  fileHash: string;              // SHA-256 of bytes — cache key
  pageCount: number;
  hasTextLayer: boolean;
  textLayerQuality: 'rich' | 'sparse' | 'garbled' | 'none';
  detectedFormat:
    | 'tata-dtc'
    | 'maruti-mga'
    | 'hyundai-dms'
    | 'mahindra-mds'
    | 'generic-table'
    | 'unknown';
  formatConfidence: number;      // 0–1
  estimatedItemCount: number;    // rough row count from text layer
}
```

**Module:** `src/lib/ai/document-profiler.ts` (new file).

**Detection logic:**
- `hasTextLayer` and `textLayerQuality` reuse existing `profilePages()` and `isGarbageText()` from `processor.ts`.
- `detectedFormat` matches against vendor-specific signatures in the text layer (e.g. presence of `"TATA MOTORS"`, `"GENUINE PARTS"`, characteristic column headers, layout fingerprints).
- File hashing uses `crypto.subtle.digest('SHA-256', ...)` — runs in browser, no dependencies.

### Layer 2 — Extraction Cache

**Purpose:** Eliminate redundant API calls during testing, retries, and accidental re-uploads.

**Storage:** IndexedDB (existing in project for claim-store).

```ts
interface CachedExtraction {
  fileHash: string;
  docType: string;              // 'estimate' | 'final-bill' | ...
  extractedAt: number;          // unix ms
  data: any;                    // the JSON the rest of the system expects
  source: 'parser' | 'ai-vision' | 'ai-text';
  parserName?: string;
  modelUsed?: string;
}
```

**Module:** `src/lib/ai/extraction-cache.ts` (new file).

**Eviction policy:** LRU by `extractedAt`, capped at 200 entries (~50 MB). Manual clear from Profile page.

**API:**
```ts
getCachedExtraction(fileHash: string, docType: string): Promise<CachedExtraction | null>
saveCachedExtraction(entry: CachedExtraction): Promise<void>
clearExtractionCache(): Promise<void>
```

### Layer 3 — Deterministic Format Parsers

**Purpose:** Extract structured estimate data from text layers without any AI.

**Why this is the keystone:** Workshop ERP exports follow strict tabular layouts. A regex/state-machine parser produces 99% accurate output in milliseconds, with zero token cost, no rate limits, no truncation, no hallucination.

**Module structure:**
```
src/lib/ai/parsers/
  ├── index.ts            // routing: detectedFormat → parser
  ├── types.ts            // shared types (ParserResult, ParserConfidence)
  ├── tata-dtc.ts         // Tata workshop format
  ├── maruti-mga.ts       // Maruti dealer format
  ├── hyundai-dms.ts      // Hyundai DMS format
  ├── mahindra-mds.ts     // Mahindra format
  ├── generic-table.ts    // Fallback for unknown digital tables
  └── __tests__/          // sample text fixtures + expected JSON
```

**Output contract:** Each parser returns the **exact same JSON shape** that the current AI prompt produces — `spare_parts[]`, `labour_items[]`, `painting_items[]`, summary totals, header. This means `reconciliation.ts` and `claim-store.ts` need zero changes.

```ts
interface ParserResult {
  data: ExtractedEstimate;       // same shape as AI output
  confidence: {
    header: number;              // 0–1 per category
    items: number;
    totals: number;
  };
  unparsableSections?: string[]; // raw text snippets we couldn't classify
}
```

**Confidence-based escalation:**
- Items confidence ≥ 0.85 AND totals confidence ≥ 0.85 → return parser result directly.
- Items confidence ≥ 0.85 BUT category classification weak → call Layer 4 (categorize-only AI).
- Below 0.85 on items → escalate to Layer 5 (full vision AI).

**Generic table parser strategy:**
- Identify column headers via fuzzy matching (`Description|Part Name`, `Qty|Quantity`, `Rate|Unit Price`, `Total|Amount`).
- Once headers are located, parse subsequent lines as `\s+`-separated columns.
- Numeric columns identified by trailing `.\d{2}` decimals.
- Categorization heuristic on description: presence of `PAINT|SOLID|METALLIC` → painting; `R&R|REMOVE|REPLACE|FITMENT|DIAGNOSIS|WELDING` → labour; HSN starts with `87/85/27/35` → spare_part.
- Summary detection: bottom-of-document lines containing `TOTAL|GRAND TOTAL|NET PAYABLE`.

### Layer 4 — Categorize-Only AI Pass

**Purpose:** When the parser extracts rows reliably but cannot confidently categorize them, ask AI to classify a small input → small output.

**Input shape (sent to Groq):**
```json
{
  "items": [
    { "id": 1, "description": "FR BUMPER ASSY" },
    { "id": 2, "description": "FR BUMPER PAINT SOLID" },
    ...
  ]
}
```

**Output shape:**
```json
{
  "items": [
    { "id": 1, "category": "spare_parts", "subcategory": "plastic" },
    { "id": 2, "category": "painting" },
    ...
  ]
}
```

**Why Groq is fine here:**
- Pure text, no images.
- Output for 80 items ≈ 1,500 tokens — well under 8K cap.
- Production text-only models on free tier are reliable.

**Module:** Lives in `src/lib/ai/categorizer.ts` (new). Reuses `callAIGateway()` with a forced `provider: 'groq'` hint via a new optional param.

### Layer 5 — AI Vision Path (Scanned Documents Only)

**Purpose:** Handle the genuine fallback case — PDFs without text layers.

This is the existing `extractDocument()` flow, with the following hardening applied **only when invoked for scanned estimates**:

#### 5a. Page-aware prompt injection
For each page chunk, append:
> `EXTRACTION SCOPE: This is page N of M. Extract ONLY the line items physically visible on this page. Do not invent rows from other pages. If this page contains the summary block (subtotals/grand total/tax), extract those into the corresponding fields and leave the line-item arrays empty.`

#### 5b. Per-page chunk size
`CHUNK_SIZE = 1` for estimate/final-bill in vision mode (currently 2). Per-call output drops from ~20K to ~3–5K tokens.

#### 5c. Streaming accumulation
After each successful chunk parse, immediately call a new `onChunkExtracted(fragment, pageIndex)` callback supplied by the caller. The caller writes partial results to the claim store. The user sees rows populate page-by-page.

#### 5d. Resume state
A new `ExtractionProgress` record persisted in IndexedDB:
```ts
interface ExtractionProgress {
  fileHash: string;
  docType: string;
  totalPages: number;
  completedPages: number[];
  failedPages: number[];
  partialData: any;
  lastError?: string;
  updatedAt: number;
}
```
On retry, the loop in `extractDocument()` skips indices in `completedPages`. New items append via existing `mergeAIResults()`. Already-extracted pages are not re-charged against quota.

#### 5e. Deduplication on resume
`mergeAIResults()` is replaced for the line-item arrays with a smarter merger that deduplicates by `(sr_no, description)` tuple. If a page is reprocessed (e.g. user-triggered Smart Fix), its items overwrite the existing entries for that page rather than appending.

#### 5f. Provider routing
- Vision needed → Gemini → NVIDIA NIM (if configured) → fail with actionable toast.
- Groq is never called for vision — vision filter is correct, the fallback chain is the bug. Groq remains for Layer 4 categorization only.

#### 5g. Groq fixes (for completeness, even though Layer 5 doesn't use Groq for vision)
- `max_tokens` raised from 8192 to 16384 (llama-3.3-70b supports 32K). This benefits the categorize-only and any other text-only Groq usage.
- Documentation comment in `service.ts` corrected: text-only Groq models were never going to handle images.

### Layer 6 — Validation, Caching, Reconciliation

**Purpose:** Final QA gate before the data hits the claim store.

1. **Math validation** (existing `validateMath()` from processor.ts) — kept as-is. Runs on the merged result.
2. **Discrepancy auto-fix** — if math fails AND we're in vision-mode, automatically call `rescanTargetPages()` for the last page only. Existing function. One extra call resolves most rounding mismatches.
3. **Cache write** — on validated success, save to extraction cache (Layer 2).
4. **Reconciliation** — unchanged. Same JSON shape arrives, same field mapping fires.

## 5. Data Flow Examples

### Case A — Digital Tata DTC estimate (the common case)

```
1. Upload → profile: { hasTextLayer: true, format: 'tata-dtc', confidence: 0.95 }
2. Cache lookup: miss
3. Parser tata-dtc.ts runs → confidence { header: 0.99, items: 0.97, totals: 0.99 }
4. Skip Layer 4, skip Layer 5
5. Math validation passes
6. Cache write
7. Reconciliation → AssessmentTab populated

API calls: 0
Time: ~50 ms
Tokens: 0
```

### Case B — Generic digital estimate (unknown vendor)

```
1. Profile: { hasTextLayer: true, format: 'generic-table', confidence: 0.6 }
2. Cache miss
3. generic-table.ts parser → items: 0.88, totals: 0.92, but category confidence 0.4
4. Layer 4 categorize call to Groq → 80 descriptions → 80 categories returned
5. Merge categories into parser result
6. Math validation passes
7. Cache write

API calls: 1 (Groq, ~1500 tokens)
Time: ~1.5 s
Tokens: ~1.5K (negligible)
```

### Case C — Scanned 6-page estimate

```
1. Profile: { hasTextLayer: false, format: 'unknown' }
2. Cache miss
3. Parser skipped (no text layer)
4. Layer 5 vision path:
   - Page 1 → Gemini → 13 items → write to store, user sees rows
   - Page 2 → Gemini → 14 items → write to store
   - Page 3 → Gemini → quota exhausted → save progress, abort cleanly
5. User adds backup Gemini key OR waits for reset
6. Re-trigger extraction → resumes from page 3
   - Page 3 → success → write to store
   - Page 4 → success
   - Page 5 → success
   - Page 6 (summary page) → totals extracted into header fields
7. Math validation runs on full merged result
8. Cache write

API calls: 6 Gemini (across two sessions)
Time: ~25 s total user-perceived
Tokens: ~30K total — fits free tier
```

## 6. Error Handling

| Error | Layer | Behavior |
|---|---|---|
| Cache I/O failure | 2 | Log, continue to Layer 3 (cache is opportunistic) |
| Parser throws | 3 | Catch, mark `formatConfidence: 0`, fall through to Layer 5 |
| Parser returns low confidence | 3 | Fall through (Layer 4 if items OK, Layer 5 otherwise) |
| Groq categorize failure | 4 | Use parser's heuristic categorization, log warning |
| Gemini quota exhausted mid-extraction | 5 | Save progress, surface actionable toast: "X of Y pages extracted. Add backup Gemini key in Profile, then click Resume." |
| All providers fail on a page | 5 | Save progress, mark page as `failed`, show "Page N could not be extracted — enter manually or retry later" |
| Math validation fails | 6 | Auto-rescan summary page once. If still failing, surface toast — do not abort extraction. |

## 7. Testing Strategy

### Unit tests (vitest)
- Each parser in `src/lib/ai/parsers/__tests__/` with at least 3 fixture text-layer samples per format.
- Profiler format detection on synthetic and real samples.
- Cache layer: write, read, hit, miss, eviction.
- Resume merger: correct dedup behavior on re-uploaded pages.

### Integration tests
- End-to-end pipeline with mocked AI gateway:
  - Digital PDF → parser path, no AI calls asserted.
  - Scanned PDF → vision path, page-aware prompts asserted.
  - Mid-extraction quota error → progress saved correctly.
  - Resume → only failed pages re-requested.

### Manual QA checklist
- Upload a known Tata DTC estimate → 0 API calls, instant.
- Upload a scanned 6-page estimate → progressive page-by-page UI updates.
- Force quota error mid-extraction → resume button appears, completes correctly on retry.
- Re-upload same file → instant cache hit, no API calls.

## 8. Implementation Phases

Ordered by ROI per hour:

### Phase 1 — Cache and profiler foundation (4 hours)
- `extraction-cache.ts` with IndexedDB
- `document-profiler.ts` with file hashing and format detection
- Wire into `extractDocument()` as opt-in path
- Tests for both modules
- **Outcome:** Re-uploads stop costing quota immediately.

### Phase 2 — Generic table parser (4 hours)
- `parsers/generic-table.ts` with column-header fuzzy matching
- Confidence scoring
- Test fixtures from real anonymized estimates
- Wire into pipeline as Layer 3
- **Outcome:** ~50% of digital estimates bypass AI entirely.

### Phase 3 — Vendor-specific parsers (6 hours, 2h each)
- `parsers/tata-dtc.ts`
- `parsers/maruti-mga.ts`
- `parsers/hyundai-dms.ts`
- Format detection logic in profiler
- **Outcome:** ~85% of digital estimates bypass AI.

### Phase 4 — Categorize-only Groq pass (3 hours)
- `categorizer.ts` module
- Groq-pinned routing in `callAIGateway()`
- Wire into pipeline for low-category-confidence cases
- **Outcome:** Generic-parsed estimates get accurate categories cheaply.

### Phase 5 — Vision path hardening (8 hours)
- Page-aware prompt injection
- `CHUNK_SIZE = 1` for estimate vision mode
- Streaming `onChunkExtracted` callback
- `ExtractionProgress` resume state in IndexedDB
- Smarter dedup merger
- Resume UI affordance in upload component
- Fix `GROQ_FALLBACK_CHAIN` documentation, raise `max_tokens` to 16384
- **Outcome:** Scanned estimates extract reliably and resumably.

### Phase 6 — UX polish (3 hours)
- Quota meter widget on Profile page
- Parser-source badge on extracted items ("Extracted via local parser — instant" vs "AI vision — N pages")
- Cache size + clear button on Profile
- **Outcome:** Surveyors understand cost/speed of each upload.

**Total: ~28 hours.** Phases 1, 2, 5 are the critical path; 3, 4, 6 are pure-upside optimizations.

## 9. Migration and Rollout

- All new code is additive. Existing `extractDocument()` keeps its current signature.
- A feature flag in profile (`useHybridExtractionPipeline`, default `true` after Phase 5) gates the new pipeline. Power users can revert to AI-only if a parser misclassifies and we need to ship a quick fix.
- Cache and progress storage live in new IndexedDB stores — no migration of existing data needed.
- No prompt-mode changes for non-estimate documents (RC, DL, policy, etc.) — they continue using the current single-shot AI path.

## 10. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Parser misclassifies a real estimate, bad data reaches store | Medium | High | Confidence thresholds force AI fallback below 0.85; parser-source badge in UI lets surveyor spot anomalies and re-run via AI |
| New vendor format doesn't match any parser | High | Medium | Generic-table parser catches most; explicit "format unknown" path falls through to AI vision cleanly |
| IndexedDB cache corruption | Low | Low | Cache is opportunistic — failures fall through silently to Layer 3 |
| Resume state gets stale across browser sessions | Low | Medium | `ExtractionProgress` records expire after 7 days; user can also clear from Profile |
| Free-tier limits change at provider | Medium | Medium | Pipeline is provider-agnostic by design; categorize layer can swap to NVIDIA NIM trivially |

## 11. Open Questions

None at design time. All decisions made above.

## 12. References

- `src/lib/ai/processor.ts` — current orchestrator, becomes Layer 5
- `src/lib/ai/service.ts` — provider gateway, gets Groq fixes only
- `src/lib/ai/prompts.ts` — `estimate` prompt gets the page-aware suffix in Layer 5
- `src/lib/ai/reconciliation.ts` — unchanged
- `src/stores/claim-store.ts` — unchanged
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/AI_Field_Extraction_Mapping.md` — gets a new section documenting the parser path
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Token_Optimization_Guide.md` — gets a new section on cache + parser-first strategy
