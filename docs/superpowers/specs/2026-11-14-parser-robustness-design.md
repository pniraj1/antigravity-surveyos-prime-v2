# Parser robustness — blank pages, Prabal (BharatBenz DMS) layout, self-checks

Date: 2026-11-14 · Size: small change · Owner approved "improve the parser first" in chat.

## Why
A 13-page Prabal Motors tax invoice (digital PDF, 330 rows) went to AI as 12 text calls + 1 image call.
What the surveyor needs most: money right, no missing rows, never a confident wrong value, few calls.

## Findings (from running the real parser on the PDF)
1. Page 13 is blank (no text, no image). It was classed "vision", cost an image call and switched the parser off for the whole file.
2. The grand total is printed as "Total Invoice Value (in figure)" / "Balance Payable" — not in `GRAND_LABEL`.
3. With the label patched, totals tie, but in the stacked-header reading:
   - `/^part/` matched "Parts" (section title, "Total Parts Amount") → part_number held the row total.
   - The all-digit HSN column formed an "amount" cluster → the wrapped "00" of 7318|15 00 was dropped (731815).
   - "Total Parts Amount" was not mapped to total_amount.

## Approaches
- A. Patch the label only — rejected: accepts wrong part numbers silently (totals still tie).
- B. Fix the three column causes at the root + skip blank pages + narrow self-checks (chosen).
- C. Send flagged fields to AI — deferred (owner's call, step 4).

## Design
- Blank page: no text AND no image op AND < 50 operators → skip the page entirely (never rendered, never sent). Applies to every caller of `fileToImages`.
- `BLOCK_TEXT` part heading matches only "Part"/"Part No"; amount clusters under a text heading (HSN, part no) are not amount columns; `total ... amount` heading → total_amount.
- `GRAND_LABEL` adds "total invoice value" and "balance payable".
- Self-checks (blank + surveyor warning, never a wrong value): part number formatted as an amount with 2 decimals; HSN/SAC that is not 4/6/8 digits. Plain-digit part numbers (Tata, Leyland) stay — the corpus showed hundreds of them.
- Regression: opt-in `parser-corpus.test.ts` snapshots real sample PDFs kept outside the repo; every change is diffed against the before-snapshot.

## Non-goals
Learning loop, DPDP handling of samples, AI fill of flagged fields — next conversation.
