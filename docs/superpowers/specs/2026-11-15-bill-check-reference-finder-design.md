# Bill Check: Reference Finder — Design

Date: 2026-11-15 · Status: draft for owner approval · Prime only (Scan impact: none)

## Intent

In Bill Check, every allowed assessment row must carry the right **item number from the other document** in the Ref No. column:
- **Normal claim:** the assessment is built from the estimate, the final bill is uploaded, and Ref No. is the **bill** item number.
- **UIIC claim:** the assessment is built from the bill, one or two estimates are uploaded, and Ref No. is the **estimate** item number. Estimate 1 and/or estimate 2.

The report goes to the insurer under the surveyor's name. Today the surveyor either gets wrong numbers that look right, or gives up and does the matching outside the app (Gemini, several tries, then typing every number by hand).

**What matters to the surveyor, in order:**
1. Never a wrong number on the report. A blank is visible work; a wrong number is invisible liability.
2. Their own entries are never overwritten.
3. Fewest blanks: correct numbers filled automatically, by part number.
4. Finishing the blanks fast, confirming against the actual scan.
5. Estimate 1 and estimate 2 together.

## Evidence (MH40BG5830, owner's copy of the claim, estimate 2 uploaded in Bill Check)

| Finding | Number |
|---|---|
| AI reading of the 5-page scan | 300/300 rows, correct serials, **2 misread part numbers** (rows 68 and 69, an extra "8") |
| Rows lost by the list-shaped page answer | 54 (17 parts, 36 labour, 1 paint). **Fixed**, commits 9af8a682 and 7934f345 |
| Allowed rows (327) with a correct ref | 131 |
| Correctly blank (part not in estimate 2) | 133 |
| **Wrong ref**, linked by words although the part numbers differ | **51** (50 marked doubtful, but doubtful refs print) |
| Missed (lost rows, repeated part on the invoice) | 12 |
| Labour rows matched | 0 of 50. The invoice parser drops "Labor Code", and codes differ in the last 2 digits (43111**097** against 43111**003**) |
| One-character-off part number pairs | 24, of which only 2 were misreads. N000000005514 and 5517 are different screws. |

Conclusion: reading is not the problem. **Matching rules, data safety and review** are.

## Goals
- G1. A Ref No. is written automatically **only** when the part number (or labour code, see D4) matches.
- G2. A doubtful or suggested ref is never printed.
- G3. A Ref No. the surveyor set is never changed by any upload or re-match.
- G4. Uploading an estimate for comparison fills Ref No. only. It never touches billed amounts, bill status or Bill Total.
- G5. The surveyor sees every allowed row still without a ref, with its closest match and the scan line, and settles it in one tap.
- G6. Estimate 1 and estimate 2 can both be referenced on one row.

## Non-goals
- No change to how documents are read (prompts, models, OCR). The evidence showed reading is fine.
- No "strong model" option, no bench work, no OCR engine.
- AI never matches and never decides a ref.

## Anti-goals (a failure even if it "works")
- Any extra step for the surveyor on a clean claim. Exact matches must need zero clicks.
- A number appearing on the report that the surveyor never saw confirmed.
- Billed figures changing because an estimate was uploaded.

## Approaches considered
| | Approach | Verdict |
|---|---|---|
| **A** | **AI (or parser) reads, code matches by part number, surveyor settles the rest** | **Chosen by the owner.** Same answer every time, can be checked, free, shows its reasons. |
| B | Send the scan plus the list of part numbers to the AI and let it return item numbers | Rejected: can't be checked, answers change between runs, repeats what failed in the Gemini chat |
| C | Strong-model reading (Gemini Pro) | Rejected for now: tiny free limits, and reading isn't the problem |

## Design decisions

### D0. Claim mode: where the assessment came from (owner confirmed 2026-11-15)
- **Normal mode** (assessment built from the estimate): the Bill Check upload is the **final bill**. Ref No. is the bill item number, and the bill sets billed amounts, status, bill no., date and total, as today.
- **From-bill mode** (UIIC: assessment built from the bill): the Bill Check uploads are **Estimate 1 / Estimate 2**. In this mode:
  - every allowed row counts as **in bill** at its own figures (the rows *are* the bill), so the print gate's "resolve pending" never marks them No Bill;
  - bill no., date and total come from the header of the document the assessment was built from;
  - estimate uploads fill estimate refs only.
- **How the mode is set (decided 2026-11-15):** one choice on the Bill Check upload panel, "This upload is: Final bill / Estimate", saved per claim as `billCheck.baseDocument` (`'final-bill'` = assessment built from the bill, so uploads are estimates; unset or `'estimate'` = normal). Default: Final bill. Switching to Estimate marks every allowed row as billed at its own figures and fills an empty bill no. / date / total from the document read in the Estimate tab.

### D1. Part number decides (matching, `src/lib/reports/bill-match-score.ts`, `matchBillItemsToRows` in `src/stores/slices/aiDataSlice.ts`)
Each pair gets one of four levels:

| Level | Rule | Effect |
|---|---|---|
| **Certain** | Same part number, ignoring spaces, '-', '_' and '.' | Ref No. written automatically |
| **Suggested: near** | Part numbers differ by one character **and** the descriptions match (`desc ≥ 0.99`) | Shown in the panel; never written |
| **Suggested: words** | One or both sides have **no** part number, and description plus amount score ≥ 40 | Shown in the panel; never written |
| **Not a match** | **Both** sides have part numbers and they differ (and not "near") | Never linked, never suggested as the top candidate |

- **The left/right, front/rear, upper/lower and inner/outer clash rule stays as it is.**
- **Billed amounts in a normal claim:** today, word matches also fill Billed Taxable and Billed Amount. Under this design they only fill on Certain, or when the surveyor accepts a suggestion. Rows with no part number (many estimates) therefore rely on the panel. This is a deliberate trade: no figure lands on a row without part-number proof or the surveyor's tap.

### D2. Repeated part numbers
- If one part number appears on several assessment rows and once in the document, every one of those rows gets the same Ref No.
- **The ref only.** Billed amounts fill only on the first such row in a normal claim, so nothing is counted twice.
- If one part number appears on several document lines (CUTTING RING on estimate rows 61, 65, 71, 75 and 79), the Ref No. lists all of them: "61, 65, 71, 75, 79". *Default; owner may change.*
- **Several rows and several lines with the same part number** (builder's call, made here):
  - pair them one to one in serial order;
  - extra rows get the last line's ref, with no amount;
  - in a normal claim, extra lines go to Tab 2 ("Billed but not assessed"), so their money stays visible and is never added onto a row silently.

### D3. What prints (`src/lib/reports/uiic-final-builder.ts:692`, `src/lib/reports/standard-report-builder.ts:342`)
- Ref No. prints only when `refStatus` is `clean` (Certain) or `manual` (surveyor set or accepted).
- Anything else prints "—".

### D4. Labour codes (owner 2026-11-15: codes differ by brand; no rule from one brand)
**Decided:** no 6-character rule. A labour code printed identically on both documents is already matched by D1 (exact part number). Labour without codes is matched by exact wording (D4a). The text below is kept for history.

### D4a. Labour and paint by exact wording (Plan 2)
- A labour or paint row with no part number and a line of the same section with no part number match when their words are identical, ignoring case, spaces and punctuation ("FRONT BUMPER R&R" = "front bumper r & r").
- Repeats follow D2. Different wording stays blank: paste, Link, or the AI suggestion step (D11).
- Parts rows are not matched by wording: two different parts often share a name ("BOLT").

### D4 (history)
- The invoice parser keeps the "Labor Code" column (BharatBenz prints "PAID 14202103") as the line's `part_number`.
- **Labour codes match on their first 6 characters** at the Certain level. **Open:** this has only been seen on BharatBenz. Check one other brand's estimate and invoice before enabling; until then, treat it as Suggested.

### D5. The surveyor's refs are protected (`applyFinalBill`, `linkExtraBillItem` in `src/stores/slices/assessmentSlice.ts:274`)
- A row with `refStatus: 'manual'` is skipped by every automatic match, in both replace and continue mode.
- Linking a line to a row that already has a ref shows "Replaces E61" before the tap.
- **Claims saved before this change** (builder's call, made here): a one-time check when Bill Check opens.
  - A `clean` ref whose saved match shows two different part numbers becomes `ambiguous`, so it stops printing and appears in Tab 1.
  - A ref with no `refStatus` becomes `manual`, so it keeps printing.
- **"Leave blank"** is saved per row and per document (`refStatus: 'blank'`, or the per-document equivalent). Later uploads don't suggest that row again. A later **Certain** (exact part number) match still fills it, because it carries proof. Rows left blank move to a collapsed "Left blank (k)" group at the end of Tab 1, so they can be reopened.

### D6. Comparison slots — superseded 2026-11-15 (owner: generally there is no Estimate 2)
**Decided (Option A):** no slots. The upload panel's one choice (D0) says whether the upload is the final bill or the estimate. An estimate upload fills only Ref No. (`refSrNo`); it never writes billed amounts, bill status, bill no., bill date or Bill Total, and Link/Unlink on its lines touch only the ref. A rare second estimate's refs are pasted or typed ("E2-43", D10). The text below is kept for history.

### D6 (history)
- Three slots: **Final bill**, **Estimate 1**, **Estimate 2**. The surveyor picks the slot; an estimate file is never treated as a bill.
- An **estimate** slot fills only the estimate ref for that slot (`refE1`, `refE2`). It never writes billed amounts, bill status, bill no., bill date or Bill Total.
- The **final bill** slot keeps today's behaviour, under D1's rules.
- **Display and print:** "E1-301 / E2-43", or just the number when only one document is referenced. Exact print format to be checked against a UIIC sample.
- Needs: new row fields (or a small map) for refs per comparison document, while keeping `refSrNo` for the bill.

### D7. Bottom panel (replaces `ExtraBillItemsPanel.tsx`)
- **Tab 1: "Rows without a ref (N)".** Always present, open by default. It lists allowed rows with no Certain or manual ref for the active comparison document. Each row shows:
  - the row (#, description, part no., qty, amount) and its closest candidate (E-number or bill number, description, part no., qty, amount);
  - **the differing characters of the two part numbers highlighted**;
  - reason pills: "Part no. 1 character off", "Words match", "Amount matches", "Part no. differs";
  - **a scan strip**: the candidate's line cut from the page image, with the rows above and below, the line outlined (see D8);
  - actions: **Accept** · **Other lines ▾** · **Leave blank**, with the effect stated ("Sets Ref No. of #23 to E68");
  - for rows with nothing close: "No line in Estimate 2 has this part no. or a close one", plus **Search** and **Leave blank**.
- **Which document Tab 1 shows:** in from-bill mode with both estimates uploaded, a two-button switcher at the top of Tab 1 ("Estimate 1 · Estimate 2"). A row counts as "without a ref" for the document selected. In normal mode, Tab 1 always means the bill.
- **Tab 2: "Billed but not assessed (M)".** Shown **only** when a final bill is uploaded. It keeps today's Link and Add as Not Allowed. Its Link picker shows the same full detail as Tab 1, both item numbers and both part numbers, which it doesn't today.
- **Everywhere:**
  - search by part number, row number or words;
  - a warning when a line is already used ("E68 already linked to #30");
  - **Undo** right after Accept or Link;
  - **Show in grid** to jump to the row.
- Reference mockup: `bill-check-ref-demo.html`, sent to the owner on 2026-11-15. Rows #23, #28 and #75 from MH40BG5830.

### D8. Locating a line on the scan
- **Digital PDF (parser):** each row's position is already known from the text tokens. Crop exactly.
- **Scan (AI read):** the page is known (`_page`); the line's vertical position is not. Default: add a `y` field to the line-item prompts, the row's top as % of page height. It's a few tokens per row. Check that `y` increases with the serials on a page. If `y` is missing or out of order, show the whole page, scrolled to an estimate from the row's position among that page's serials.
- **Storage** (builder's call, made here):
  - **The lines of each comparison document** are saved on the claim, so the candidates, Other lines and Search work after a reload. That's every line, with sr, part no., description, qty, amount, `_page` and `y`; up to about 300 lines per document, compact.
  - **Page images** (Evidence Viewer blobs live only in memory today) are saved **on this device only**, in IndexedDB, keyed by claim and slot. They are never synced to Firestore, the same rule photos follow.
  - On another device, or once the images are cleared, the strip shows "Attach the file again to see the scan". Everything else still works.

### D9. Done already (no further work)
- Rows no longer lost on list-shaped page answers (9af8a682, 7934f345).
- The model that read each document is stored as `_models` (cc8ef1aa). Optional: show it in the evidence view.

### D10. Paste refs from a spreadsheet (owner approved 2026-11-15; ships first, as Plan A)
Why: the owner typed every estimate number by hand from the sheet Gemini produced. The assessment grid already takes an Excel paste; the Bill Check Ref No. column does not.
- **Where:** pasting into any Ref No. cell. A single value (no line break, no tab) pastes as it does today.
- **One column pasted:** values fill that row and the rows below it, in on-screen order (section by section, honouring the "needs a ref" filter). A blank line leaves its row unchanged; it never clears a ref.
- **Two columns pasted, the first all whole numbers:** read as row Sr No. → Ref No. Each pair goes to the row with that Sr No. among the rows Bill Check shows. A Sr No. found on no row, or on more than one, is skipped. A first line whose first column is not a number is a header and is dropped. This is the safe shape: a shifted paste cannot happen.
- **Anything else** (three or more columns, a non-numeric first column): nothing is written; the surveyor is told to copy the Ref No. column, or the Sr No. and Ref No. columns.
- **Values** are kept as typed ("61, 65, 71", "E1-301 / E2-43").
- **A pasted ref is the surveyor's** (`manual`), like a typed one, and the row's old `refMatch` is dropped when the ref changes.
- **The check:** a ref made only of serials is checked against every line Bill Check has read: the stored read (`extractedData['final-bill']`), the unmatched lines, and the lines already matched to rows. A serial not on that document, or a line whose part number differs from the row's (both present, compared with `normPart`), marks the row `ambiguous` instead: it does not print and blocks the print gate until checked. Refs with letters (E1-…) are not checked.
- **After the paste:** one message says how many were filled, flagged and skipped, with an Undo that restores those rows' previous Ref No. and status.
- No AI call, no new storage.

### D12. The real estimate's amount, UIIC only on paper (owner decided 2026-11-15)
Study: `docs/research/2026-11-15-estimate-amount-in-bill-check-study.md`.
- **`estimateAmount` on a row:** the taxable amount of the estimate line(s) matched to it in a from-bill claim, by an exact match or a Link. It is never read by any money calculation (cap, subtotal, liability, export).
- **Bill Check grid, from-bill mode:** the Estimate column shows `estimateAmount` (or "—"); Billed shows the row's own bill figure.
- **"Billed more than estimated":** a non-blocking note on screen only, when the bill figure is above `estimateAmount`. Never printed, never blocks.
- **From-bill mode skips the "billed above / below what you assessed" flags:** there, billed is the row's own figure, so the difference is the surveyor's own cut.
- **Reset all (D0) is required:** wrong billed figures also lowered the claim through the Bill Check cap (`billCheckAssessed` = min(assessed, billed)).
- **Switching mode clears the unmatched lines list**, so lines from the other document are not counted.
- **UIIC Bill Check report, "Estimated" column:** heads Metal, Plastic / Rubber, Glass, Fibre Glass, Labour, Painting.
  - Default figures: matched lines take the surveyor's category (row `partType` / section); unmatched estimate lines take the category the AI read (parts) or their section (labour, paint).
  - Before a UIIC Bill Check print of a from-bill claim with estimate lines, a dialog shows the heads. The surveyor edits any head and confirms. The dialog also shows the lines' total incl. GST against the estimate's printed total, with any difference in red; confirming is still allowed.
  - Confirmed figures are saved (`billCheck.estimateHeads`) and printed. The dialog asks again only after the estimate is uploaded again.
  - Other insurers and reports: unchanged.

### D11. AI suggestions for rows still blank (sandbox first; built only if needed)
Trimmed with the owner 2026-11-15.
- **Gate:** after Plan 2, the owner counts blank allowed rows on 3 real claims. Usually under 5 → not built (the Plan 3 panel's ranked candidates suffice).
- **Shape:** a button "Ask AI to suggest (N rows)" in the panel. One text call: the blank rows plus all unmatched lines of the same section, with short ids the code assigns; 3 few-shot examples (shorthand match, left/right → none, not listed → none); output `{ rowId: lineId | "none" }`.
- **Code check:** id exists, same section, no left/right clash, no line picked twice; otherwise "none". A pick shows as "AI suggests" on that row; the surveyor taps Accept.
- **Not built:** second model / self-consistency, reason field, learned wording aliases, bulk accept, automatic call. Each returns only if the bench shows the need.
- **Bench pass bar:** 5 runs each of a bare prompt and the final prompt on known answers; 0 wrong suggestions; ≥ 70 % of rows with a true match get it; runs agree. Reference: dair-ai prompt-engineering guide.

## Constraints
- Free-tier BYOK: the design adds no AI calls. D8 adds a few output tokens per scanned row.
- The assessment is the surveyor's: suggestions are never applied without a tap.
- Commit to `main`. Prime only; touches no Scan coupling point (doc types, folder layout, field labels, manifest).
- Next.js 16. Reports are restyle-safe; the Bill Check tab is not routing.

## Success criteria (MH40BG5830 copy, estimate 2)
1. 0 wrong Ref Nos. print, down from 51.
2. ≥ 131 correct refs filled automatically, plus rows recovered by the lost-rows fix (247–263).
3. A ref typed by the surveyor survives a re-upload in both modes.
4. Billed amounts and Bill Total are unchanged after uploading an estimate.
5. Every allowed row without a ref, and not left blank, appears in Tab 1, with a scan strip for its candidate.
7. In from-bill mode, no row prints "No Bill" because an estimate was uploaded, and the report totals equal those before the upload.
6. A clean digital claim (all exact part numbers) needs zero clicks in Tab 1.

## Open questions for the owner
0. ~~D0 mode rule~~: confirmed by the owner 2026-11-15.
1. In a UIIC report, is "—" acceptable for an allowed row found in neither estimate? **Default until answered: yes** (it is what prints today).
2. Repeated estimate lines: list all serials ("61, 65, 71") or just the first?
3. D4: a second brand's estimate and invoice, to confirm the labour-code rule.

## Left to the builder
- Field names and storage shape for per-document refs (D6), within the existing `AssessmentRow` type.
- Exact panel styling, within the existing Bill Check look.
- Crop margins and the zoom level of the scan strip.
- Ordering of Tab 1. Suggested: by section, then row number.
