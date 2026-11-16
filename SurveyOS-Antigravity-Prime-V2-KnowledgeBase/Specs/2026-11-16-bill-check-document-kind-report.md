# Bill Check & Assessment: "which document is this?" — change report

> **Date:** 2026-11-16 · **By:** Claude Code · **Status:** findings only, nothing in this report is built yet.
> **Already committed, not deployed:** `d0b632d2` (cockpit restyle + dark-mode fix). Owner asked to hold the deploy until this is resolved too.

## 0. The one setting everything hangs on

A claim has one switch, `claim.billCheck.baseDocument`, read through `isFromBill(claim)` in `src/lib/reports/bill-check-mode.ts`:

| `baseDocument` | Assessment was built from | Bill Check uploads | Bill Check's ref column should say |
|---|---|---|---|
| `'estimate'` (or unset) | the estimate | the **final bill** | Bill Item No. / Billed |
| `'final-bill'` ("from-bill", UIIC) | the **final bill** | the **estimate** | Est. Item No. / Estimated |

Parts of the app that already get this right, to copy:
- `src/components/tabs/bill-check/BillCheckGrid.tsx:102`: `'Est. Item No.'` vs `'Bill Item No.'`
- `src/lib/reports/uiic-final-builder.ts:674` and `src/lib/reports/standard-report-builder.ts:339`: `'Est. No.'` vs `'Bill No.'` on print
- `src/stores/slices/assessmentSlice.ts` `linkExtraBillItem`: writes `estimateAmount` (not `billedTaxable`) in from-bill mode

Gemini's Reconciliation Cockpit (`src/lib/tally/*`, `src/components/tabs/bill-check/Stage*.tsx`, `ReconciliationWizardDialog.tsx`) never reads this switch. It always assumes "the upload is the workshop bill". That one gap causes Issues 1 and 3 below.

---

## Issue 1: the cockpit always says "Workshop bill", even when you uploaded the estimate

> **BUILT 2026-11-16** in `fee88f50` (on `main`, not deployed - owner holding).

**Owner report:** after choosing *Estimate* in the upload dialog, column 3 of the Reconciliation tab still says workshop bill / bill item number.

**Root cause:** the wording is hard-coded and the mode is never checked.

| File:line | Says now | Should say when from-bill (estimate uploaded) |
|---|---|---|
| `StageReviewTable.tsx:381` column header | Workshop bill | Estimate |
| `StageReviewTable.tsx:383` column header | Billed | Estimated |
| `StageReviewTable.tsx` difference tooltip | "Bill is cheaper / higher than assessed" | "Estimate is lower / higher than assessed" |
| `ReconciliationWizardDialog.tsx:68` header badge fallback | Workshop Bill | Estimate |
| `StageAuditView.tsx:246` heading | Insurer Savings (Allowed Items Not in Bill) + "…that the workshop did not invoice" | Billed items not in the estimate |
| `StageAuditView.tsx:323` heading | Extra Bill Items (Leftover Invoice Lines) | Estimate lines not on the bill |
| `StageAuditView.tsx:271` button | Mark All Remaining Allowed as Not in Bill (Saving) | **Hide**: in from-bill every row *is* on the bill |
| `src/lib/tally/stage3-ai-matcher.ts:24` AI prompt | "…against workshop invoice…" | "…against the repair estimate…" |

**Meaning flips, not just words (owner decision needed):** in from-bill, *Difference = estimate − assessed*, and the assessment came from the bill. A **negative** number means the workshop billed *more* than it estimated, which is not a saving. Today it shows green. Proposed: in from-bill, negative = amber ("billed above estimate"), positive = grey.

**Proposed fix (small):** one helper next to `isFromBill`:
```ts
export function uploadLabels(claim) {
  return isFromBill(claim)
    ? { doc: 'Estimate', amount: 'Estimated', itemNo: 'Est. Item No.' }
    : { doc: 'Workshop bill', amount: 'Billed', itemNo: 'Bill Item No.' };
}
```
Use it in the five cockpit files above, and in `BillCheckGrid.tsx:102` so there is one source. Test: render `StageReviewTable` with a from-bill claim and expect "Estimate" / "Estimated".

---

## Issue 2: two bugs in the Bill Check upload dialog (found while tracing Issue 1)

> **BUILT 2026-11-16** in `d1af624d` (on `main`, not deployed - owner holding).

`src/components/tabs/BillCheckTab.tsx:301-304`:
```ts
onConfirm={(file, kind) => {
  if (kind !== upload) handleUploadChange(kind);
  void processBillFile(file, false);
}}
```
- **2a. Cancel is ignored.** When switching kind, `handleUploadChange` asks "Switch to Estimate? … will be cleared". If you press **Cancel** it returns, but `processBillFile` still runs, so the file is read anyway under the old mode.
- **2b. The old mode is used after a switch.** `upload` is worked out once per screen render (`BillCheckTab.tsx:79`). After a switch, `processBillFile` and `fileUpload` still see the old value. So the replace/continue question names the wrong document, and the file is saved to Documents/Drive under the wrong name (`invoice` instead of `estimate`, or the reverse). The rows do follow the new mode, because the store has already switched by then.

**Fix:** `handleUploadChange` returns `true/false`; stop on `false`; read the mode from `useClaimStore.getState().currentClaim` after switching, not from the render-time `upload`. Test: pure function for "kind to use after the switch", plus a cancel test.

---

## Issue 3: labour (and anything not matched at read time) never reaches Stage 2 / Stage 3 on claims made from the bill

> **BUILT 2026-11-16** in `07008b88` (on `main`, not deployed - owner holding).

**Owner report:** "it didn't check for labour". Stage 2 and Stage 3 both showed **0**.

**There are two labour/paint checks today:**
1. **At read time** (`src/stores/slices/aiDataSlice.ts:322-329`): labour and paint pair **only on identical wording**. This was the deliberate Plan 2 rule ("a blank beats a wrong number").
2. **Stage 2, Name & Price** (`src/lib/tally/stage2-name-cost.ts`): pairs differently-worded labour and paint in the same section. A probe of 6 typical wordings paired 4, e.g. "FRONT BUMPER R/R" with "R&R FRONT BUMPER".

**Root cause (proven):** every stage only takes rows that have **no billed figure yet** (`r.billedTaxable === undefined`). In a from-bill claim, every allowed row is "self-billed" on opening Bill Check (`BillCheckTab.tsx:74` calls `fromBillSelfBillUpdates`, which sets `billedTaxable = estimated`). So **no** row is ever a candidate, and anything not paired at read time skips Stages 1–3 and lands in Stage 4's tray.

Evidence: the same labour row and the same estimate line, rendered through `BillCheckStepper`:
- normal claim: **Stage 2: 1**
- from-bill claim (row self-billed): **Stage 2: 0, Stage 3: 0**

The same filter is copied in six places, all needing the change:
- `BillCheckStepper.tsx:87` (stage counts)
- `StageReviewTable.tsx:134` (Stage 1 candidates) and `:199` (Stage 2 candidates)
- `StageAITrigger.tsx:58` (Stage 3)
- `StageAuditView.tsx:89` (savings list)
- `tallySlice.ts:29` (`markRemainingAllowedAsNotInBill`)

**Proposed fix:** one shared rule in `src/lib/tally/`:
```ts
/** A row still waiting for its counterpart on the uploaded document. */
export function isTallyCandidate(r, fromBill) {
  if (!r.allowed || r.refMatch || r.refSrNo || r.billStatus === 'not-in-bill') return false;
  return fromBill || r.billedTaxable === undefined; // from-bill rows are self-billed; that is not a match
}
```
Use it in all six places.

**Also needed for from-bill:** `StageReviewTable.tsx` `handleKeep` has a fallback branch that writes `billedTaxable = <uploaded figure>`. In from-bill that would overwrite the **bill** figure with the **estimate** figure. It must write `estimateAmount` + `refSrNo` instead, as `linkExtraBillItem` already does.

**Secondary (normal claims):** printing marks every unbilled allowed row "Not in bill" (`useBillCheckPrintGate.tsx:174`). Once marked, a row is excluded from matching for good. If the bill is re-read later, those rows never get another chance. Owner decision: should a row marked by the print gate (not by hand) go back into matching on a fresh bill read? Marking it with a flag such as `billStatusSource: 'print-gate'` would let us tell the two apart.

**Optional Stage 2 improvement:** the 2 probe misses were word forms ("removing" vs "remove", "tilting" vs "tilt"). Light stemming in `normalizeTerms` would catch them. It needs a probe on the parser corpus before shipping.

---

## Issue 4: the Assessment tab should ask "bill or estimate?" on every upload, and its headings should follow

> **BUILT 2026-11-16** in `67ca0865` (on `main`, not deployed - owner holding).

**What happens today:**
- The question is asked **only on a claim's first upload** (`asksDocumentKind` in `src/lib/documents/upload-doc-type.ts:15`: no rows and no `baseDocument` yet). Every later upload is silently treated as the earlier choice. Changing it later is only possible through the 8-second Undo toast or the Bill Check dialog.
- The button always reads **"Upload Estimate"** (`AssessmentTab.tsx:198-202`).
- The headings are fixed to estimate wording even on claims made from the bill:
  - `src/components/claim/AssessmentSectionTable.tsx:227`: "Estimate(taxable amount)"
  - `src/components/claim/assessment-grid-config.ts:51`: column chooser "Estimate (taxable)"
  - `src/components/claim/AssessmentSummary.tsx:58`: "Estimate vs assessment comparison", and `:64` "Estimated"
- Extraction always runs as `'estimate'` (`AssessmentTab.tsx:76`), even when the answer was "Final bill". **To check:** whether the bill's number, date and total then land in `billCheck`, or are lost.

**Proposed:**
1. Button reads **"Upload Document"**. Every upload opens the same Bill / Estimate choice. Reuse `BillCheckUploadDialog` for one look across both tabs. It is preselected to the claim's current mode.
2. If the answer differs from the current mode on a claim that already has rows, show the same warning Bill Check uses (`rowsLostOnSwitch` wording), and go ahead only on OK. That avoids silently flipping a claim's mode under existing rows.
3. Headings follow `uploadLabels(claim)`. When the bill is the uploaded document (from-bill):
   - grid column `AssessmentSectionTable.tsx:227` "Estimate(taxable amount)" → **"Billed(taxable amount)"** (owner's wording, 2026-11-16)
   - column chooser `assessment-grid-config.ts:51` "Estimate (taxable)" → "Billed (taxable)"
   - summary `AssessmentSummary.tsx:58` "Estimate vs assessment comparison" → "Bill vs assessment comparison", and `:64` "Estimated" → "Billed"
   - On a normal claim (estimate uploaded) nothing changes.
4. Leave `PartHistoryButton` "Est." alone (past claims' own history).

---

## Issue 5: Bill Check grid: the sideways scrollbar is only reachable by scrolling right to the bottom

> **BUILT 2026-11-16** in `409373fc, 40bf3ef9` (on `main`, not deployed - owner holding).

**Owner report:** on Bill Check you have to scroll all the way down before you can scroll right. On the Assessment grid you don't.

**Root cause: two scroll boxes, one inside the other.**
- Bill Check (`BillCheckTab.tsx:215`): the panel is `overflow-y-auto` and scrolls the attention banner, the grid card and the Extra Bill Items panel together. Inside it, the grid's own box (`BillCheckGrid.tsx:563`) scrolls both ways with `maxHeight: calc(100dvh - 240px)`. That height ignores everything above the grid (header bar, attention banner, grid toolbar), so the box's bottom edge, which holds the sideways scrollbar, sits below the visible area. You must scroll the outer panel down to reach it.
- Assessment (`AssessmentTab.tsx:248`, `AssessmentGrid.tsx:474`) is the working example: **one** scroll box (`flex-1 min-h-0 overflow-auto`) that exactly fills the space left, so its sideways scrollbar is always on screen at the bottom.

**Proposed fix: copy the Assessment layout.**
- The Bill Check panel becomes a flex column with no outer scroll.
- The attention banner and the grid toolbar stay fixed at the top.
- The grid's box becomes `flex-1 min-h-0 overflow-auto`, and the hard-coded `calc(100dvh - 240px)` goes.
- **The Extra Bill Items panel** (now below the grid in the same outer scroll) needs a new home, so one owner choice:
  - (a) inside the grid's scroll box, after the last row, pinned to the left edge so it doesn't slide sideways (recommended: nothing changes for you, and it is still "below the grid"); or
  - (b) a collapsible strip under the grid.
- The summary panel on the right keeps its own column and scroll.

Size: small, 2 files. Risk: low, layout only. Check on a short laptop screen and with the evidence panel open.

---

## Suggested order and size

| # | Change | Files | Size | Risk |
|---|---|---|---|---|
| 1 | Issue 3: `isTallyCandidate` + `handleKeep` from-bill branch | 6 + 1 | small | medium: changes what reaches matching; covered by tests |
| 2 | Issue 2: upload dialog cancel + stale mode | 1 | tiny | low |
| 3 | Issue 1: `uploadLabels` + cockpit wording, and the from-bill colour rule | 6 | small | low (wording) |
| 4 | Issue 4: Assessment upload choice + headings | 4–5 | medium | medium: touches the claim's mode switch |
| 5 | Issue 5: Bill Check single scroll box | 2 | small | low |

**Cost:** no AI calls added or changed, except the Stage 3 prompt wording (same call, same size). Zero running cost.
**Impact on SurveyOS Scan:** none. The doc types `invoice` / `estimate`, the folder names and the manifest are unchanged. Only Prime screens and matching code change.

## Owner decisions needed
1. In from-bill, should "estimate lower than the bill" show amber (workshop billed above estimate) rather than green?
2. Should rows marked "Not in bill" automatically by printing go back into matching when a new bill is read?
3. Assessment tab: confirm "ask on every upload, preselected to the current mode, warn before switching" (rather than only on the first upload).
4. Bill Check scroll: Extra Bill Items panel inside the grid's scroll box after the last row (a, recommended) or as a collapsible strip under the grid (b)?
