# Parser-first extraction for digital estimates and bills — design

Date: 2026-10-31 · Status: awaiting owner approval · Size: project (plan follows via writing-plans)

## 1. Why

Surveyors upload dealer estimates and final bills. Today every page goes to an AI model,
and the owner sees three recurring failures: **missing rows, missing pages, and page 2's
rows landing before page 1's**. These come from splitting a document into per-page AI
calls and stitching the answers back together.

Most of these PDFs are *digital* (made by dealer software, with a real text layer). For
those, the exact text — every row, every amount — is already in the file. The AI is only
being asked to turn printed lines into rows, which code can do exactly, instantly and for free.

Evidence (bench of 2026-10-31, 18 real PDFs, 7 dealer formats; throwaway spike
`scratchpad/parse-spike.mjs`):

| | Parser spike | Gemini Flash-Lite | Ollama gemma4:31b |
|---|---|---|---|
| PDFs read perfectly | **13/18** | 7/18 | 7/18 |
| Invented rows | **0** | 4 | 4 |
| Rows out of order | **0** | 18 | 20 |
| Time, all 18 PDFs | **< 1 s** | ~12 min | ~10 min |
| Tokens | **0** | ~510k | ~480k |

On the 5 PDFs the spike read wrongly (Tata DTC ×2, Tata Consolidated ×2, one Maruti),
its rows did not add up to the printed totals — so a totals check caught every one.

## 2. Goal, non-goals, anti-goals

**Goal.** For a digital estimate or final bill, read the line items in code, with no API
call, whenever the result provably matches the document's printed totals. Otherwise fall
back to today's AI path unchanged.

**Non-goals (this project).**
- Image/scanned PDFs: stay on vision models. Hardening that path is Phase 2 (§8), designed here only in outline.
- OCR (Tesseract or similar).
- Other document types (RC, DL, policy, etc.).
- Per-dealer hand-written templates. One general reader; dealer quirks only as small, named adjustments if the bench shows a need.
- Fixing `/bench`'s stale model list — a separate task.

**Anti-goals — failure even if it "works".**
- Showing parser rows that don't tie to the printed totals. A wrong answer that looks right is worse than an AI call.
- Any change to the assessment itself. This only fills the extracted rows; the surveyor still makes the assessment.
- Making the AI path worse for documents the parser declines.
- New dependencies. pdf.js is already in the app.

## 3. Where it sits in the flow

In `extractDocument` (`src/lib/ai/processor.ts`), for `estimate` and `final-bill` only:

```
files → filesToImages (already reads pdf.js text per page)
      → every page text-rich?  (profilePages: all pages 'text')
           yes → parseRows(page tokens) → ties to printed totals?
                     yes → build result, NO AI call for rows      ← new
                     no  → today's AI path, unchanged
           no  → today's AI path, unchanged
```

The parser is skipped when:
- the surveyor gave feedback or asked for a re-read (`feedback` / `previousData` set); those go to AI as today;
- `forceDocMode` or the bench override (`getAITestOverride()`) forces a method;
- any page is image-only (mixed PDFs go wholly to the AI path in v1).

## 4. The reader (`src/lib/ai/row-parser.ts`, new)

Input: per page, the pdf.js text items with position (`str`, `x`, `y`, `width`). `filesToImages`
currently keeps only the laid-out text; it must also return these items (the same
`getTextContent()` call — no extra work).

Steps (proven by the spike, except column mapping, which is new):

1. **Tokens.** Split each item into words with estimated x.
2. **Row anchors.** Integers 1–999 in the leftmost numeric column, kept only if they form a sequence (`n = previous + 1`, or `1` = new section). Sequence continues across pages.
3. **Row band.** Each row owns the vertical space halfway to its neighbouring anchors, so wrapped descriptions and split numbers ("8,845." over "76") stay with their row.
4. **Number repair.** Numeric fragments stacked in the same column, where the upper one ends in `.` or `,`, are joined.
5. **Column mapping (new).** Find the header row (the line containing a serial header such as `Srl`/`S.No`/`Sr`/`Seq` plus `Qty`). Map header words to fields by x-range using a synonym table: `Qty`; `Rate`/`Rate/Unit`/`Part Amt`/`Labour Amt` → unit price; `Taxable` → taxable; `Total`/`Amount`/`Ins.Amt`/`Total Amt (Incl. Taxes)` → total; `Tax%`/`Tax` → GST %; `HSN`/`SAC` → hsn_sac; `Part No`/`Part Number`/`Part #` → part_number; `Description`/`Particulars` → description. Each row value goes to the column whose x-range it falls in. If no header maps `Qty` and at least one amount column, the parser declines (→ AI).
6. **Sections.** A serial restarting at 1 starts a new section. The section's kind comes from the nearest heading above it (`Parts`, `Part Detail`, `Part Invoice` → parts; `Labour`, `Labour Detail`, `Labour and Services` → labour). Within labour, a description containing `PAINT`/`COLOUR`/`COLOR` goes to `painting_items` (same rule as today's prompt). In a single-section document, a row whose HSN/SAC starts `9987` is labour, else a part.
7. **Output** in the existing estimate/final-bill shape (`prompts.ts`): `spare_parts`, `labour_items`, `painting_items` with `sr_no`, `description`, `part_number`, `hsn_sac`, `quantity`, `unit_price`, `taxable_amount`, `total_amount`, `gst_percent`, plus the existing `_page` tagging so the Evidence Viewer jumps to the right page. `category` (metal/plastic/glass) is left empty; today's code/UI handles a blank category.
   - **`total_amount` must include GST** (the prompt contract; `rowCheck` sums it against the after-tax gross). If the document prints a per-row total, use it. If it prints only taxable + tax %, the code computes `total = taxable × (1 + gst%/100)`, rounded to paise — consistent with the "code does the maths" principle. Printed values are never altered; computed ones are only derived from them.
   - `cgst_amount`/`sgst_amount` are left at 0: nothing outside `prompts.ts` reads them (checked 2026-10-31). *(My call.)*
   - Paint rows keep their original `sr_no`. *(My call.)*

## 5. The tie check — the safety net

The parser's result is used only if **all** hold:
- **Only labelled totals count.** A "printed total" is a number on a line, outside the item rows, whose text contains a total label (`Total`, `Sub Total`, `Grand Total`, `Net Amount`, `Total Amt`, `Part Amt`, `Labour Amt`, `Part Amount`, `Labor Amount`). Numbers elsewhere on the page never count. This keeps the chance of an accidental match near zero. *(My call — the spike's "any number on the PDF" was too permissive.)*
- every section's sum equals one of those labelled totals, within **₹1 per section** (rupee rounding only — the spike's `rows × ₹0.5` was too loose: it passed a ₹2 error on the 540-row UP80 estimate). The sum may be of the section's taxable column or its total column; whichever is used, it must match a labelled total;
- **the parser reads the grand total itself** from the `Grand Total` / `Net Amount` / `Total Amt` label (the largest such labelled number, when several are printed), sets `gross_amount`, and the sum of all rows' `total_amount` must match it within `rowCheck`'s existing tolerance. **No grand total found → decline.** It does not rely on the header AI call for this;
- no gap in serials within a section, checked **before** paint rows are split out of labour. On the parser path, `rowCheck` gap results are not shown (the serials were already verified). Only its gross check is used. *(My call — avoids false "row 3 missing" when row 3 moved to painting.)*

Any failure → decline, log the reason (`[Parser] declined: <reason>`), run the AI path.
No partial use in v1 (e.g. parts tie but labour doesn't → whole document goes to AI).

## 6. Header fields

Rows are the hard, failure-prone part; header fields (workshop name, vehicle no., chassis,
dates, bill no., gross) are few and on page 1 / the last page.

**Owner decided (2026-10-31): option (a).** The two options were:
- **(a)** one small text-only AI call with a header-only prompt on page 1 + the last page (~1–2k tokens, against ~15–30k for the whole document today);
- **(b)** regex for the common labels, leaving the rest blank for the surveyor.

Chosen because header formats vary more than row tables, and a single cheap call is reliable. If that call fails, rows are still shown and the header fields stay blank. The grand total never depends on this call (§5).

## 7. What the surveyor sees

No new screen. Rows appear as today, faster. The extraction source is recorded on
`ExtractionResult` only (`source: 'parser' | 'ai'`). It is not saved into claim data, so there is no new claim field. and shown as a small note in the existing review dialog
("Read from the PDF text — totals match"). When the parser declines, nothing visible
changes except that AI runs as today.

## 8. Phase 2 — image PDFs (outline only, separate plan)

Parsing can't read images, so vision models stay. The fix is to make the code, not the
model, control order and coverage:
1. One page per call; page number set by the code, rows ordered by page (`orderByPage`, already on `main`).
2. Each page must return rows or an explicit "no items"; an empty or failed page is retried alone, so whole pages can't vanish.
3. The same totals check; a failing page is named to the surveyor ("page 3 doesn't add up") instead of a silently short list.
4. Later, testable on the bench: OCR that keeps word positions, feeding this same parser for clean laser-printed scans.

## 9. Testing and measurement

- **Unit tests** (`row-parser.test.ts`) on small *synthetic* token fixtures — one per layout trait: single-line rows, wrapped rows, split numbers, two sections with subtotals, a page break mid-table, and a decline case (totals don't tie). Real PDFs contain insured persons' personal data (DPDP), so they are **not** committed.
- **Bench regression:** the scratch bench runs the real parser module over the owner's PDF folder (outside the repo) and scores it with `score.mjs` next to the AI models. Acceptance: ≥ 13/18 tie and are correct; **0** PDFs that tie but are wrong.
- `/bench` in the sandbox gains "parser" as a method alongside text/vision (small; reuses the same module).

## 10. Decisions

**Owner decided:** parser for digital PDFs; vision models only for image PDFs; totals must tie or AI takes over.

**My calls (owner to check):**
- Estimates and final bills only.
- Whole-document decline in v1; no per-page or per-section mixing.
- Mixed text/image PDFs go wholly to AI in v1.
- Feedback/re-read requests skip the parser.
- Synthetic fixtures in tests; real PDFs stay out of the repo.
- `category` left blank on parser rows.

**Owner decided:** header fields via one small header-only AI call (§6, option a).

## 11. Constraints and impact

- Cost: zero API cost for rows; header call (if chosen) ~1–2k tokens per document.
- No new dependency. `processor.ts` is 708 lines; the parser lives in its own file and `processor.ts` gains only the branch (stays < 800).
- Deploy only after owner approval; sandbox first.
- **SurveyOS Scan impact:** none. No doc types, labels, folder layout, field labels or claim paths change. The extracted-row shape is unchanged.
