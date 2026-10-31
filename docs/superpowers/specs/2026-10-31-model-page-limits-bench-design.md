# Extraction bench, per-model safe limits and PDF text reading — design

Date: 2026-10-31 · Status: draft v2 for owner approval (v1 reviewed; v2 reworked for many PDFs)

## 1. Why

Surveyors read estimates with Gemini Flash-Lite. When its free quota runs out they switch to another
model, usually Ollama `gemma4:31b`. The owner has seen that Ollama reads only 1–2 dense pages per call
correctly; beyond that it misreads, re-reads or drops rows. No one knows these limits for the other
models; today they are guessed.

The owner will supply many estimate PDFs from different vehicles and workshops. Their goals:
1. **Capabilities:** what each model can read correctly, and how much per call.
2. **Tokens:** the cheapest way to read each document correctly.
3. **Errors:** find and classify each model's mistakes.

The live app then uses the measured limits, so that within them a model makes no mistakes and stays
inside free-tier quotas. Three issues are part of this work because they affect the results:
- **Row order.** After an auto-split, page 2's rows showed above page 1's (sandbox, Pawar estimate).
- **Digital PDFs are read badly.** Text mode exists (`processor.ts`, `profilePages`), but
  `extractPageText` joins every word with a space, so table rows and columns are lost.
- **Several estimates in one PDF.** For example, the Pawar PDF holds 3–4 quotes, each numbered from 1
  with its own totals.

## 2. Goals
- G1. A sandbox bench that runs many PDFs × models × settings, and scores each reading without a
  hand-made answer key for every PDF.
- G2. Measure each model's capacity as **rows per call** (not pages), plus output tokens per row.
- G3. Try token-saving settings (text vs image, image size, rows per call) and score each by **tokens
  per correct row**.
- G4. Classify every error by type, page and row, and keep the raw reply for each failure.
- G5. Count calls and tokens before, during and after a run. Never exceed a provider's per-minute,
  per-day or token limits.
- G6. Produce a per-model limits table. Once the owner approves it, the live app chunks pages by it.
- G7. Keep page order of rows. Read a digital PDF's text with its lines and columns, deciding text or
  image per page.

## 3. Non-goals
- No change to extraction prompts (`prompts.ts` stays as it is; owner rule).
- No new paid service, server, GPU or dependency.
- No per-workshop parser. Text is laid out as lines; the AI still does the reading.
- Surveyors don't choose limits or methods.

## 4. Anti-goals
- A bench run uses up the Gemini daily quota the owner needs for real claims.
- Any bench code runs on production (`motorsurveyos-in.*`).
- A setting is called safe, yet it loses, invents or misreads a row on a readable PDF.
- A rate-limit error or an unreadable scan is counted as a model mistake.
- Rows are sorted by printed serial (this breaks with several quotes and with parts and labour that
  are numbered separately).
- The owner has to type out a full answer key for every PDF.

## 5. What exists (build on it)
| Piece | Where | Use |
|---|---|---|
| Capability probe, per-provider concurrency and min gap | `src/lib/ai/probe-runner.ts` (`PROVIDER_CONCURRENCY`, `PROVIDER_MIN_GAP_MS`) | pacing starting point |
| Accuracy run on one benchmark doc (grand total + item count) | `runAccuracyProbe`, `probe-accuracy.ts`, `benchmark-doc.ts` (IndexedDB) | extend |
| One-model test path | `service.ts` `runModelTest` → `processor.ts` `extractDocument`, with `AITestOverride` | each bench cell |
| Token counts | Gemini and Groq are called from the browser (`service.ts`), and their replies carry `usageMetadata` / `usage`. NVIDIA and Ollama go through `aiProxy`, which returns `{status, ok, body}`: the body's `usage` arrives, the headers do not | token accounting |
| Gemini 429 parsing | `gemini-errors.ts` (`QuotaFailure` names the quota) | stop, don't retry |
| Chunk size per image cap | `image-cap.ts` `resolveVisionChunkSize`, used in `processor.ts` | where the limits table plugs in |
| Row/page tags, gap check | `row-check.ts` (`tagRows`, `gapsIn`), `gap-fill.ts` | order fix, serial checks |
| Page selection | `ai-pages.ts` | run a page range |
| Sandbox gate | `src/lib/sandbox.ts` `isSandbox()` | bench only in sandbox |

## 6. Design

### 6.1 Test set and truth
Every PDF in the test set gets a small **profile**, filled in by the owner or proposed by the bench and
confirmed by the owner:
- kind: digital / scan / mixed (proposed from `profilePages`);
- estimates in it: a label and page range for each;
- printed totals for each estimate: the grand total, and the subtotals where printed (proposed from the
  text layer on digital PDFs; on scans, typed by the owner — about 1 minute per PDF);
- pages the owner marks **unreadable** (excluded from model scoring).

Truth comes from three tiers, cheapest first:
1. **Self-check (free, every PDF):** computed in code from the reading itself — rows add up to each
   printed subtotal/total within ₹1; serials run 1…N per estimate with no gaps or repeats; qty × rate =
   amount where both are printed.
2. **Agreement:** two or more models whose readings pass the self-check and match row for row form the
   PDF's **reference reading**. PDFs with no agreement or a failed self-check go into a "needs owner"
   list.
3. **Gold set:** 5–6 PDFs (Pawar first) with a full row list the owner corrects once and locks. Used to
   prove tiers 1–2 work (§6.6 D) and as the hardest test.

Real documents are sent as they are (owner: the test documents are mocked).

### 6.2 What one reading (a "cell") is
Cell = PDF × model × settings, where the settings are:
- **method:** `vision`, or `text` (text pages only, using §6.9 lines);
- **rows per call target** (vision: pages grouped up to the target using the expected row count, §6.7;
  text: same);
- **image scale:** 1.0 / 1.25 / 1.5 (vision only; 1.5 is today's).

Each cell goes through `runModelTest` → `extractDocument`. `AITestOverride` gains `method`,
`rowsPerCall` (or a fixed page grouping), `imageScale` and `raw: true`. With `raw`, auto-split and
gap-fill are **off**, so the cell shows the model's raw behaviour. Each cell records:
- per call: pages, input tokens, output tokens, ms, finish reason / error, and the raw reply if the
  call failed;
- per reading: the rows, score (§6.5), and total tokens.

### 6.3 Keeping the call count small (step-up search)
- **Hard set** (gold PDFs + the 3 densest others): per model, start at 1 page per call, and step up
  (1, 2, 3, 4 pages) only while the reading passes. Stop at the first failure and repeat that setting
  once to confirm it. Do this for each method and, at the passing setting, each image scale.
  This finds the model's **max rows per call** and the cheapest passing image scale.
- **Wide set** (all other PDFs): each model reads once, at its proposed safe setting only. A failure is
  logged and investigated; it does not restart the search.
- Borderline settings (a pass right next to a failure) are run 3 times; all must pass.

### 6.4 Calls, tokens and limits
- **Before Start:** planned calls per provider = sum over cells of the number of calls, shown with the
  daily cap. Planned tokens come from earlier runs' tokens per page for that model ("unknown" on the
  first run).
- **During:** a live counter per provider shows calls made / left, tokens in / out, current wait and
  last error.
- **Limits come from the provider, not guesses:**
  - Gemini and Groq: read token use from the reply body in the browser fetch path. Read the
    `x-ratelimit-*` headers if the browser can see them (CORS may hide them). Gemini's 429
    `QuotaFailure` names the quota that was hit.
  - NVIDIA and Ollama: `aiProxy` copies the provider's `x-ratelimit-*` / `retry-after` headers into
    its response as `rateLimit` (harmless in production too).
  - Where nothing is reported, use `PROVIDER_MIN_GAP_MS`, which can be edited on the bench screen.
- One call at a time per provider; providers run side by side. On a 429, wait as told once; a second
  429 pauses that provider and marks the cell **rate-limited**, never a model error.
- **Daily cap** per provider per run, set by the owner (default 50% of the reported daily limit, else
  100 calls). The run stops for that provider at the cap and resumes another day.
- **Gemini Flash / Flash-Lite are off by default.** Turning them on shows how much of today's quota the
  run would use.

### 6.5 Scoring and error types
The reading is compared with the reference (gold key, or the agreed reading) per estimate. Every
difference is recorded with its type, page and row:

| Error type | Counts against the model? |
|---|---|
| missed row | yes |
| invented row | yes |
| duplicated row | yes |
| wrong amount (or qty/rate) | yes |
| wrong order across pages | yes |
| totals don't tie (self-check) | yes |
| broken reply: cut off / invalid JSON / empty | yes; also lowers the rows-per-call limit |
| rate-limited / timeout / network | no; the cell is re-queued |
| row on a page marked unreadable | no |

A reading **passes** when it has none of the "yes" errors on its readable pages.
**Tokens per correct row** = total tokens ÷ correct rows; used to rank passing settings.

### 6.6 Verification checklist (the bench and the owner use this)
**A. Before a run**
- [ ] Running on the sandbox site; the bench refuses otherwise.
- [ ] Every PDF has a confirmed profile (kind, estimates and page ranges, printed totals).
- [ ] Planned calls and tokens per provider are shown, and they're under the daily cap.
- [ ] Gemini is off unless the owner turned it on.
- [ ] The gold set is locked.

**B. During a run**
- [ ] Calls made / left update after every call.
- [ ] No provider goes over its per-minute rate, and every 429 is logged with its wait.
- [ ] 429s and timeouts never count as model errors.
- [ ] The raw reply is kept for every failed call.
- [ ] Results are exported to a file after every PDF, and a stopped run resumes where it left off.

**C. Scoring a reading**
- [ ] Rows add up to each printed subtotal and grand total, per estimate.
- [ ] Serials run 1…N per estimate with no gaps or repeats.
- [ ] Rows are in printed order across pages.
- [ ] qty × rate = amount where printed, and no blank descriptions or amounts.
- [ ] No row is invented or duplicated.
- [ ] Every error is recorded with its type, page and row.

**D. Proving the checker**
- [ ] On the gold set, tiers 1–2 (self-check + agreement) reach the same verdict as the owner's locked
  key on every reading. Until this holds, no other result counts.

**E. Safe settings**
- [ ] For each model and method there is a max rows per call, a page grouping rule and an image scale.
- [ ] Each passes on every readable PDF, including 3 runs at the borderline.
- [ ] Tokens per correct row are recorded, and the cheapest passing setting wins.
- [ ] Every result is stamped with the model id/version and the date; results older than 30 days show
  as stale.

**F. Before shipping to production**
- [ ] The owner approves the limits table.
- [ ] The `?sandbox=true` fix is live.
- [ ] The real app (auto-split and gap-fill on) reading the gold set with the table gives the same rows
  and totals as the bench.
- [ ] Models not in the table behave as they do today.
- [ ] Page order holds: page 1's rows before page 2's, after auto-split and gap-fill too.

### 6.7 Limits table and live app
- The table holds, per model and method: `maxRowsPerCall`, `maxPagesPerCall`, `imageScale`, the date and
  the model version. It is exported from the bench as `src/lib/ai/page-limits.ts` and committed after
  the owner approves it. Nothing in the sandbox writes to production.
- In the live app, pages are grouped up to the model's `maxRowsPerCall` using the **expected rows**:
  - text pages: the row count of the text layer (lines that end in an amount);
  - scanned pages: the first group is 1 page; later groups use the average rows per page read so far.
  Groups are also capped by `maxPagesPerCall` and the image cap.
- Models not in the table keep today's behaviour (2 pages + auto-split). Fallback to another model
  re-groups for that model. Auto-split and gap-fill stay on in the live app as the safety net.
- Surveyors see no new controls.

### 6.8 Page-order fix
- `tagRows` tags rows with their call's page range (`_page`, `_pageEnd`), not per row. So within one
  call, keep the order the model returned (a call reads its pages top to bottom). Across calls, order by
  each call's first page. Auto-split and gap-fill results go in by their page, never appended at the
  end. No prompt change and no sort by serial.
- Parts / labour / paint stay grouped as now, with page order kept inside each group (assumed; owner to
  confirm).
- Tests first: page 1 fails once and is filled in by gap-fill; page 1 has labour and page 2 has parts.

### 6.9 Reading a digital PDF's text
- Rebuild lines from the PDF.js text positions: group items by vertical position into lines, sort each
  line left to right, and mark wide gaps as a column break (` | `).
- Decide text or image per page (`profilePages` already profiles each page). Consecutive pages with the
  same method form a run, grouped by that method's limits. The surveyor never chooses the method.
- The live app uses text for a model only if the bench passed it for that model.

## 7. Sandbox only
- The bench screen and its code paths run only when `isSandbox()` is true; it isn't rendered otherwise.
- `surveyos-v2-antigravity-in.web.app` is the owner's sandbox site on purpose. Production is only
  `motorsurveyos-in.*`.
- Shipping the limits table to production first requires `?sandbox=true` to be ignored on
  `motorsurveyos-in.*`.

## 8. Cost and resources
- Money: ₹0. It uses the owner's free-tier keys; proxy calls are well within the Firebase free tier.
- Calls (estimate, to be replaced by the bench's own plan):
  - Hard set, about 8 PDFs at ~6 pages: the step-up uses ~4 settings, and ~2 calls per setting on
    average with confirmations. That is ~60 calls per model per method, plus ~20 for image scales.
  - Wide set: about 1 call per 1–2 pages per model, so 50 PDFs × 5 pages ≈ 150–250 calls per model.
  - For 5 non-Gemini models and both methods, that is about 2,000 calls, spread over several days
    within each provider's daily cap.
- Storage: IndexedDB in the sandbox browser, with a JSON export after every PDF.
- Time: hours per run, unattended. The tab must stay open (a wake lock is requested); a stopped run
  resumes.

## 9. Parts, in order
1. Page-order fix (§6.8), test first — a live-app bug that stands alone.
2. Token and rate-limit reporting (browser path + `aiProxy`), pacing, daily caps, planned/done counters
   (§6.4).
3. PDF profiles, self-check and error typing (§6.1 tier 1, §6.5), extending `probe-accuracy.ts`.
4. Bench screen: test set, cells, step-up search, resume, export; agreement and gold set (§6.1–6.3).
5. Text-layer lines and per-page text/image (§6.9).
6. Limits table export + live-app grouping by rows (§6.7). Shipping it needs the owner's approval and
   the `?sandbox=true` fix.

Prime ↔ Scan impact: none (no doc types, labels, claim paths or manifest touched).

## 10. Left to the builder
- Bench screen layout.
- Row matching rule (normalised description + amount, small edit distance) as long as §6.5 holds.
- Detecting "lines that end in an amount" for expected rows.
- Where run logs live (IndexedDB is fine).
