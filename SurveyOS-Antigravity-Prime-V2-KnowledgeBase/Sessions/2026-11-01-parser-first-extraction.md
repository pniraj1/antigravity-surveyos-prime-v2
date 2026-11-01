# Session 2026-11-01 — Parser-first extraction (Claude Code)

Spec: `docs/superpowers/specs/2026-10-31-parser-first-extraction-design.md`
Plan: `docs/superpowers/plans/2026-10-31-parser-first-extraction.md`
Commits: `b8a18753..c17346e3` on `main`. **Not pushed, not deployed.**
Checks: 752 Vitest tests in the touched areas pass, `tsc` clean. Built subagent-driven; each task reviewed, then a whole-branch review and a fix wave.

## Why
Live model check (2026-10-31) showed the AI path on digital PDFs drops rows, swaps page order and costs ~250k tokens per 18 PDFs. Digital PDFs already contain the exact text, so code can read rows; AI stays for scanned/image PDFs and as the fallback.

## What changed
- `src/lib/ai/row-parser.ts`: rows from text positions (serial anchors, row bands, split-number repair, header → column mapping by synonyms, right-edge assignment for amounts), sections, labelled totals, grand total, tie checks.
- `src/lib/ai/parser-first.ts`: eligibility, `safeParse`, header-only AI call.
- `processor.ts`: keeps per-page tokens; tries the parser first for single, all-text estimate/final-bill PDFs.
- Review dialog note; `/bench` parser method.

## Safety rules (decline → AI)
Section sum ≠ labelled subtotal (₹1); no grand total; gross off (₹5/0.1%, or ₹1/rows×₹0.01 when any total was computed); serial gap; anything after the first grand total that looks like another estimate; ambiguous bare Tax.

## Real-PDF result
9/18 read with 0 calls, all 9 gross = printed, 0 wrong. Declines: 4 Maruti, 5 Tata.

## Rulings made on the owner's behalf
1. Duplicate header columns: rightmost non-zero cell wins; bare "Labor" header = taxable.
2. Amounts are assigned by right edge, only when their centre column is an amount column.
3. Anything resembling a second estimate after the first grand total declines.
4. 9/18 accepted below the 13 target, because 0 were wrong.
5. Tighter gross tolerance when any row total is computed.

## Impact on SurveyOS Scan
None.

## Later the same day: Maruti and Tata
The owner sent 7 more digital PDFs (Maruti estimate, Maruti final bill ×3, Tata ×2). All 23 now read with 0 calls; every gross equals the printed total; rows spot-checked against the PDF text.
- Maruti: grand total "Net Estimate Amounts" / "Net Bill Amount (Rounded)"; labour printed pre-tax with CGST+SGST under the section → `footerTax` applies the single GST rate whose with-tax subtotal is printed. Estimate parts print no rate and are tax-inclusive → total = printed amount, rate blank.
- Tata: headings stacked over 3–5 lines and split mid-word → `findHeaderBlock` (fallback reading): amount columns from right-aligned values, named by heading words; text columns start halfway between headings. Row GST inferred when taxable and total are printed.
- Fixes found on the way: "2.000" quantities read as 1; "Suggested Jobs" caption leaking into Maruti row 1; wrapped HSN codes.
- Ruling: tax-inclusive rows with no printed rate keep `gst_percent` blank rather than a guessed 18 (the app's own default then applies).
