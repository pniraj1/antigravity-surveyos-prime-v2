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
- **How the mode is set (proposed):** the first upload into an Estimate slot in Bill Check switches the claim to from-bill mode (`billCheck.baseDocument = 'final-bill'`, a field that exists today but nothing sets). Uploading a final bill sets normal mode. No extra question for the surveyor. A small label in the Bill Check header shows the mode and lets the surveyor switch it.

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

### D4. Labour codes
- The invoice parser keeps the "Labor Code" column (BharatBenz prints "PAID 14202103") as the line's `part_number`.
- **Labour codes match on their first 6 characters** at the Certain level. **Open:** this has only been seen on BharatBenz. Check one other brand's estimate and invoice before enabling; until then, treat it as Suggested.

### D5. The surveyor's refs are protected (`applyFinalBill`, `linkExtraBillItem` in `src/stores/slices/assessmentSlice.ts:274`)
- A row with `refStatus: 'manual'` is skipped by every automatic match, in both replace and continue mode.
- Linking a line to a row that already has a ref shows "Replaces E61" before the tap.
- **Claims saved before this change** (builder's call, made here): a one-time check when Bill Check opens.
  - A `clean` ref whose saved match shows two different part numbers becomes `ambiguous`, so it stops printing and appears in Tab 1.
  - A ref with no `refStatus` becomes `manual`, so it keeps printing.
- **"Leave blank"** is saved per row and per document (`refStatus: 'blank'`, or the per-document equivalent). Later uploads don't suggest that row again. A later **Certain** (exact part number) match still fills it, because it carries proof. Rows left blank move to a collapsed "Left blank (k)" group at the end of Tab 1, so they can be reopened.

### D6. Comparison slots (Bill Check upload panel)
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
