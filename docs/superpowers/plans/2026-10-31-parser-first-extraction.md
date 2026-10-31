# Parser-first Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For digital estimates and final bills, read line items in code from the PDF text layer (no AI call for rows) whenever they tie to the printed totals; otherwise run today's AI path unchanged.

**Architecture:** A new pure module `src/lib/ai/row-parser.ts` turns pdf.js text items (with x/y) into rows, sections and a grand total, and declines unless everything ties. `fileToImages` already calls `getTextContent()`; it now also returns the positioned items. `extractDocument` tries the parser first for all-text `estimate`/`final-bill` PDFs, then makes one small header-only AI call.

**Tech Stack:** TypeScript, Next.js 16 (static export), pdfjs-dist (already installed), vitest (`environment: 'node'`).

**Spec:** `docs/superpowers/specs/2026-10-31-parser-first-extraction-design.md`

## Global Constraints

- Applies to `estimate` and `final-bill` only. Every other doc type is untouched.
- No new dependencies.
- `processor.ts` stays < 800 lines (it is 708 now). All parsing logic lives in `row-parser.ts`.
- Parser rows are used only if all of these tie (spec §5):
  - each section sum is within **₹1** of a labelled total;
  - there is a grand total, and it matches the sum of `total_amount` within `rowCheck`'s tolerance;
  - there is no serial gap within a section, checked before the paint split.
  Anything else declines the whole document; there is no partial use.
- Labelled totals: a number on a non-item line whose text contains one of `Total`, `Sub Total`, `Grand Total`, `Net Amount`, `Total Amt`, `Part Amt`, `Labour Amt`, `Part Amount`, `Labor Amount` (case-insensitive). No other number counts.
- Grand total labels: `Grand Total`, `Net Amount`, `Total Amt`. When several are printed, take the largest. If none is printed, decline.
- `total_amount` includes GST. If only taxable + GST % is printed, use `taxable × (1 + gst%/100)`, rounded to paise. Never alter a printed value.
- `cgst_amount`/`sgst_amount` = 0. `category` = `''`. Paint rows keep their printed `sr_no`.
- The parser is skipped when:
  - `feedback` or `previousData` is set;
  - `forceDocMode` is set;
  - `getAITestOverride()` is set;
  - any page is not text-mode;
  - there is more than one file.
- The header fields come from one header-only AI call on page 1 + the last page.
  - Estimate fields: `workshop_name, workshop_address, vehicle_number, chassis_number, engine_number, estimate_date, bill_number`.
  - Final-bill fields: `workshop_name, bill_number, bill_date`.
  - If the call fails, the rows are kept and these fields stay `''`. `gross_amount` never comes from this call.
- `source: 'parser' | 'ai'` lives on `ExtractionResult` only. It is never saved into claim data.
- Real PDFs are never committed (DPDP). Tests use synthetic tokens.
- No deploy without owner approval. SurveyOS Scan impact: none.

## Review Focus

1. **Labelled-total line that is also an item line.** For example, a row described "TOTAL LOSS COVER". Expected: an item row (it has a serial anchor) never counts as a labelled total. Test in Task 2.
2. **Two documents merged into one PDF** (the owner's `ilovepdf_merged` case: 3–4 estimates back to back). Serials restart at 1 several times and there are several grand totals. Expected: decline, because the summed rows can't match a single largest grand total. Test in Task 2.
3. **Indian digit grouping** (`2,27,794.00`) and amounts printed without commas (`1075.99`). Expected: both parse to the right number. Test in Task 1.
4. **A page with an anchor-looking integer in the left column that isn't a serial**, such as a pin code fragment or a page number. Expected: the sequence filter (`n = prev+1` or `1`) drops it, and a stray `1` that starts a bogus section fails the tie and declines. Test in Task 2.
5. **Image-only page inside an otherwise digital PDF.** Expected: parser skipped, AI path as today. Test in Task 4.

---

### Task 1: Rows from positioned tokens

**Files:**
- Create: `src/lib/ai/row-parser.ts`
- Test: `src/lib/ai/__tests__/row-parser.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PdfToken { s: string; x: number; y: number; w: number }   // y grows upward (pdf.js)
  export function tokensFromItems(items: Array<{ str: string; transform: number[]; width: number }>): PdfToken[]
  export function parseMoney(s: string): number | null      // '2,27,794.00'→227794, '1075.99'→1075.99, '8,845.'→null, '8708.99.00'→null
  export type Field = 'sr_no'|'part_number'|'description'|'hsn_sac'|'quantity'|'unit_price'|'taxable_amount'|'total_amount'|'gst_percent';
  export interface RawRow { sr: number; page: number; cells: Partial<Record<Field, string>>; text: string }  // page 0-based
  export function readRows(pages: PdfToken[][]): { rows: RawRow[]; nonItemLines: { page: number; text: string; nums: number[] }[] } | { declined: string }
  ```

- [ ] **Step 1: Write failing tests.** In the test file, add a helper `line(y, [[x, 'text'], …]): PdfToken[]` with `w = text.length * 5`. Tests:
  - `tokensFromItems splits multi-word items with estimated x`: item `{str:'206.78 206.78', transform:[1,0,0,1,100,500], width:65}` → two tokens, at x 100 and x 135.
  - `parseMoney`: the four cases in the signature comment, plus `'0.00'→0`.
  - `single-line rows map to header columns`: a header line `Srl | Part Number | Description | Qty. | Rate | Taxable` at y=700, then rows 1–3 at y=680/670/660. Expect 3 rows with `cells.quantity`, `cells.unit_price`, `cells.taxable_amount` and `cells.description` equal to the given strings, and `sr` 1..3.
  - `wrapped row keeps description and split number with its row`: anchor `1` at y=600 with `CED ASSY` at y=606 and `TAILGATE` at y=594; total-column fragments `8,845.` at y=603 and `76` at y=597 in the same x. Expect `cells.total_amount === '8,845.76'` and `cells.description === 'CED ASSY TAILGATE'`.
  - `serials continue across pages`: page 0 has rows 1–2 and page 1 has row 3, with the header on both pages. Expect 3 rows with `page` 0, 0, 1.
  - `no Qty header → declined`: the result has a `declined` string containing `header`.

- [ ] **Step 2: Run:** `npx vitest run src/lib/ai/__tests__/row-parser.test.ts`. Expected: FAIL (the module doesn't exist).

- [ ] **Step 3: Implement** the algorithm proven in `scratchpad/parse-spike.mjs` (copy it into the repo as the reference when starting):
  - **Anchors** are `^\d{1,3}$` tokens within 12pt of the minimum x of such tokens. Keep only those that continue the sequence (`n === prev+1 || n === 1`).
  - **Row band** reaches halfway to each neighbouring anchor.
  - **Number repair:** join a fragment that ends in `.` or `,` with the fragment directly below it when their x-ranges overlap within 2pt and the vertical gap is under 14pt.
  - **Header line:** the first line on the page containing a serial word (`Srl|S\.?No\.?|Sr|Seq\.?|S`) and `Qty`.
  - **Header synonyms → Field:** `Part Number|Part No|Part #` → part_number; `Description|Particulars|Part Description|Labour Description|Part Labor Description` → description; `HSN|HSN/SAC|HSN/SAC` → hsn_sac; `Qty|Qty.` → quantity; `Rate|Rate/Unit|Part Amt|Labour Amt` → unit_price; `Taxable` → taxable_amount; `Total|Amount|Ins.Amt|Ins Share Amount|Total Amt` → total_amount; `Tax%|Tax %` → gst_percent.
  - **Column x-range:** each header token spans from its x to the next header token's x. A row token goes to the range containing its centre.
  - `nonItemLines`: every line (tokens grouped by y within 2pt) outside all row bands, with `parseMoney` of its tokens.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit** `feat(ai): read estimate rows from pdf text positions`.

### Task 2: Sections, totals, tie check → parse outcome

**Files:**
- Modify: `src/lib/ai/row-parser.ts`
- Test: `src/lib/ai/__tests__/row-parser.test.ts`

**Interfaces:**
- Consumes: `readRows`, `parseMoney`, `PdfToken` (Task 1).
- Produces:
  ```ts
  export interface ParsedEstimate { spare_parts: any[]; labour_items: any[]; painting_items: any[]; gross_amount: number }
  export type ParseOutcome = { ok: true; data: ParsedEstimate } | { ok: false; reason: string };
  export function parseEstimate(pages: PdfToken[][]): ParseOutcome
  ```
  Rows are in the `prompts.ts` estimate row shape, tagged `_page` (0-based), as `tagRows` does.

- [ ] **Step 1: Write failing tests** (synthetic token builders as in Task 1):
  - `two sections tie to their subtotals and grand total` (the Kia layout): heading `Part Invoice`, rows 1–2 with totals 2738.98 and 1398.30; heading `Labour and Services`, rows 1–3 with 1426, 450 and 4092 (row 3 `Painting Charges`); lines `Sub Total | 4,137.28 | 5,968.00`, `Total | 4,882.00 | 7,042.24` and `Grand Total | (Rounded) | 11924`.
    - Taxable + Tax% columns only (18%), so totals are computed.
    - Expect `ok`, 2 spare_parts, 2 labour_items, 1 painting_items (`sr_no` 3), `gross_amount` 11924.
  - `section off by ₹2 declines`: same layout with one amount changed by 2. `reason` contains `section`.
  - `no grand total declines`: `reason` contains `grand total`.
  - `serial gap declines`: rows 1, 2, 4. `reason` contains `gap`.
  - `item row with TOTAL in its description is not a labelled total` (Review Focus 1).
  - `merged PDF of two estimates declines` (Review Focus 2): two complete layouts on pages 0 and 1, each with its own grand total.
  - `stray integer in serial column does not create a row` (Review Focus 4): a `7` between rows 2 and 3 is ignored, and the result is still `ok`.
  - `single-section doc classifies 9987 SAC as labour`: rows with `hsn_sac` `998729` land in labour_items.
  - `printed total column is used as-is`: when the `Total` column exists, `total_amount` equals the printed value, not a computed one.

- [ ] **Step 2: Run** `npx vitest run src/lib/ai/__tests__/row-parser.test.ts`. Expected: new tests FAIL.

- [ ] **Step 3: Implement `parseEstimate`.**
  - **Sections:** split where `sr === 1`. Kind comes from the nearest `nonItemLines` text above the first row: parts if it matches `/part/i`; labour if `/labou?r|service/i`; otherwise unknown, and rows are classified by `hsn_sac` starting `9987` → labour, else part.
  - **Gap check:** within each section.
  - **Section tie:** the sum of `taxable_amount`, or the sum of `total_amount` when that column was printed, is within ₹1 of some number on a labelled `nonItemLines` entry (labels per Global Constraints).
  - **Grand total:** taken from the grand-total-labelled lines. `Σ total_amount` must be within `Math.max(5, gross * 0.001)`, the same tolerance as `rowCheck`.
  - **Paint split last:** a labour row whose description matches `/PAINT|COLOU?R/i` goes to `painting_items`.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit** `feat(ai): tie parser rows to printed totals before use`.

### Task 3: Positioned tokens from the PDF loader

**Files:**
- Modify: `src/lib/ai/processor.ts:27-35` (`extractPageText`), `:75-126` (`fileToImages`), `:152-175` (`filesToImages`)
- Test: `src/lib/ai/__tests__/page-runs-flow.test.ts` (or the existing test that mocks `fileToImages`; keep its mocks compiling)

**Interfaces:**
- Consumes: `tokensFromItems` (Task 1).
- Produces:
  - `fileToImages(...)` returns an added `pageTokens?: PdfToken[][]`.
  - `filesToImages(...)` returns `pageTokens?: PdfToken[][]`, set only when `files.length === 1` and that file returned them.

- [ ] **Step 1:** Change `extractPageText` to return `{ text, tokens }`. It must still make exactly one `getTextContent()` call per page, and on error return `{ text: '', tokens: [] }`.
- [ ] **Step 2:** Thread `pageTokens` through both functions. Images keep `pageTokens` undefined.
- [ ] **Step 3: Run** `npx vitest run src/lib/ai` and `npx tsc --noEmit`. Expected: all pass, no type errors.
- [ ] **Step 4: Commit** `refactor(ai): keep positioned text tokens from pdf pages`.

### Task 4: Parser-first branch and header call in `extractDocument`

**Files:**
- Modify: `src/lib/ai/processor.ts` (`ExtractionResult` at :268; `extractDocument` after `runs` is computed, ~:344)
- Modify: `src/lib/ai/prompts.ts`, adding `getHeaderPrompt(key: 'estimate' | 'final-bill'): string`
- Create: `src/lib/ai/parser-first.ts` (keeps `processor.ts` under 800 lines)
- Test: `src/lib/ai/__tests__/parser-first.test.ts`

**Interfaces:**
- Consumes: `parseEstimate`, `ParseOutcome` (Task 2); `pageTokens` (Task 3); `callAIGateway(prompt, images, 'json', job, session, signal)` from `./service`; `rowCheck`/`toFindings` from `./row-check`.
- Produces:
  ```ts
  // parser-first.ts
  export function parserEligible(o: { key: string; allText: boolean; fileCount: number; feedback?: string; previousData?: unknown; forceDocMode?: string; override: unknown }): boolean
  export async function readHeader(key: 'estimate'|'final-bill', textLayers: string[], call: (prompt: string) => Promise<string>): Promise<Record<string, string>>
  // ExtractionResult gains:  source: 'parser' | 'ai'
  ```

- [ ] **Step 1: Write failing tests:**
  - `parserEligible` is true only for estimate/final-bill with `allText`, one file and no feedback/previousData/forceDocMode/override. Cover each false case, including mixed pages (`allText:false`, Review Focus 5).
  - `readHeader` sends only page 1 + the last page's text, and returns only the listed fields (extra keys from the model are dropped, and `gross_amount` is never returned). On a thrown call it returns every field as `''`.
- [ ] **Step 2: Run** `npx vitest run src/lib/ai/__tests__/parser-first.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `getHeaderPrompt` is a lean prompt asking for only the fields in Global Constraints, as JSON with `""` for anything not found.
  - In `extractDocument`, when `parserEligible` and `pageTokens` exist, run `parseEstimate`.
    - **On `ok`:** `data = { ...header, ...parsed }`, `findings = toFindings(rowCheck(data, textLayers))` with gap findings filtered out (spec §5), `source: 'parser'`. Return before `runAllChunks`, with `issues: []`. Log `[Parser] read N rows, tie ok`.
    - **On decline:** log `[Parser] declined: <reason>` and continue to the AI path with `source: 'ai'`.
  - Every other return of `ExtractionResult` sets `source: 'ai'`.
- [ ] **Step 4: Run** `npx vitest run src/lib/ai` and `npx tsc --noEmit`. Expected: PASS. Check `wc -l src/lib/ai/processor.ts` is < 800.
- [ ] **Step 5: Commit** `feat(ai): parser-first reading for digital estimates and bills`.

### Task 5: Review dialog note

**Files:**
- Modify: `src/components/dialogs/AIReviewDialog.tsx`, plus each caller that passes `findings` from an `ExtractionResult` (`AssessmentTab.tsx`, `BillCheckTab.tsx`; grep for `findings=`)
- Test: `src/components/dialogs/__tests__/ai-review-findings.test.tsx`

**Interfaces:**
- Consumes: `ExtractionResult.source` (Task 4).
- Produces: the optional `source?: 'parser' | 'ai'` prop on `AIReviewDialog`.

- [ ] **Step 1: Failing test:** rendering with `source="parser"` shows the text `Read from the PDF text — totals match`. With `source="ai"` or no source, that text is absent.
- [ ] **Step 2: Run** `npx vitest run src/components/dialogs/__tests__/ai-review-findings.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** One line of muted text in the dialog's existing summary area, plus passing the prop from the callers. The prop is never written to claim data.
- [ ] **Step 4: Run** the same test plus `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): note parser-read estimates in review dialog`.

### Task 6: Bench regression on the real PDFs, and `/bench` method

**Files:**
- Modify: `src/components/bench/bench-logic.ts`, `src/lib/bench/runner.ts` (add method `'parser'` next to text/vision; it calls `parseEstimate` and records 0 calls and 0 tokens)
- Scratch only (not committed): a copy of `parse-spike.mjs` changed to load `src/lib/ai/row-parser.ts` through jiti, the way `extract-text.mjs` does

**Interfaces:**
- Consumes: `tokensFromItems`, `parseEstimate` (Tasks 1–2).

- [ ] **Step 1:** Run the scratch script over `C:\Users\Manasi\Downloads\drive-download-20261031T095514Z-1-001`, then `node score.mjs texts results scores.csv`.
  - **Expected:** ≥ 13/18 PDFs `ok`, and every `ok` PDF has coverage 1, invented 0 and inversions 0.
  - The Consolidated and INTRA formats score below 1 through the scorer's known artefact. For those, check `gross_amount` against `score.mjs`'s `GRAND` instead.
  - **Any `ok` PDF that is wrong blocks the release.** Fix the parser, never loosen the tie.
- [ ] **Step 2:** Add the `'parser'` method to `/bench`. Run `npx vitest run src/lib/bench` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 3: Commit** `feat(bench): parser as a bench method`.
- [ ] **Step 4:** Update the vault (`Changelog.md`, `Tasks.md`, a new `Sessions/` log) and the memory note `antigravity-round-2026-10-31.md`. Commit `docs(kb): parser-first extraction`.
- [ ] **Step 5:** Ask the owner about a sandbox deploy. Don't deploy without a yes.
