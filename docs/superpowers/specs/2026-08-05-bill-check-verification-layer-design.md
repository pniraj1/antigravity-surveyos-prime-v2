# Bill Check as a Verification Layer — Design

**Date:** 2026-08-05
**Status:** Awaiting review
**Scope:** Bill Check tab, Bill Check report, final-bill matcher, bill-check liability calculation

---

## 1. The core principle

**The Final Survey Report is where assessment happens. Bill Check verifies it — it does not re-assess.**

Per-item depreciation, per-item GST, and the assessed figure are all decided on the Final assessment sheet. Bill Check replicates that sheet — same rows, same serial numbers, same depreciation, same GST, same assessed amounts — and adds only verification columns on top: was this item billed, for how much, status, remarks.

Every bug below is a consequence of Bill Check having its own arithmetic when it should have none.

---

## 2. Decisions taken during brainstorming

| # | Decision |
|---|---|
| D1 | Unmatched bill items need **both** "link to an existing row" and "add as a new row". Both cases occur in real files. |
| D2 | An added item goes into the **Final Report**, landing as **Not Allowed, ₹0 assessed**. The surveyor then allows or disallows it. Nothing is allowed without the surveyor. |
| D3 | **Bill Check report lists insurer-liability items only.** Not allowed → not insurer liability → not listed. |
| D4 | Disallowed items **are** listed in the **Final Report**, tagged "Not Allowed" — that is the record of the surveyor's decision. |
| D5 | Bill Check carries the **Final Report's serial numbers**. Numbering jumps where items were disallowed (1, 4, 5…); rows are consecutive on the page, with no blank placeholder rows. The jump is the signal to the insurer. |
| D6 | Liability per row = **lower of assessed or billed, capped at assessed**. Not in bill → ₹0. Under-billing is rare in practice. |
| D7 | Bill Check reuses the Final Report's per-row computation. It computes nothing itself. |

**Out of scope, next task:** uploading a supplementary estimate into the Final Report.
**Out of scope, later:** richer Bill Check tab (AI controls, re-scan with feedback, chatbot, section grouping, Drive upload, pending-items warning before print).

---

## 3. Bug audit

### 3.1 Money — the liability figure is wrong today

**M1 — GST is counted twice, on screen and in the report.**
`billedAmount` already includes GST (it is the bill's `total_amount`, [aiDataSlice.ts:522](../../../src/stores/slices/aiDataSlice.ts)). Both calculations then add GST to it again.

Worked example — bumper, ₹10,000 taxable + 18% GST = ₹11,800 billed, 10% depreciation:

| | Result |
|---|---|
| Correct (₹10,000 − 10% = ₹9,000, +18%) | **₹10,620** |
| Screen ([assessment.ts:186–200](../../../src/lib/calculations/assessment.ts)) — `11,800 × 0.90 × 1.18` | ₹12,532 (+18%) |
| Report ([uiic-final-builder.ts:457,480](../../../src/lib/reports/uiic-final-builder.ts)) — `11,800 × 1.18`, no depreciation | ₹13,924 (+31%) |

Both are inflated. They differ from each other only by depreciation, which is why they agree on labour and paint (depreciation nil) and diverge on parts.

Masked in testing by the fallback at line 457, `r.billedAmount ?? afterDep`: with no billed figure it falls back to the depreciated pre-GST amount and `× 1.18` gives the right answer. The code is correct on empty rows and wrong on filled ones.

**M2 — `billedAmount` holds three different units.**

| Written by | Unit |
|---|---|
| AI match ([aiDataSlice.ts:522](../../../src/stores/slices/aiDataSlice.ts)) | Including GST |
| Billed Tax column ([BillCheckGrid.tsx:285](../../../src/components/tabs/bill-check/BillCheckGrid.tsx)) | Including GST |
| "In Bill" dropdown ([BillCheckGrid.tsx:315](../../../src/components/tabs/bill-check/BillCheckGrid.tsx)) — writes `row.assessed` | **Excluding GST** |

The column header reads "Billed Incl GST", so the dropdown is the odd one out. It also fails to set `billedTaxable`, leaving that column and its footer total stale.

**M3 — `billedTaxable` holds the correct pre-GST figure and is used by neither calculation.**

**M4 — Hardcoded `1.18`** in both report builders, ignoring each row's own `gst`. Tyres and batteries are 28%.

**M5 — `not-in-bill` → `pending` does not restore `billedAmount`.** It was zeroed; the earlier figure is gone.

**M6 — `calculateBillCheckSummary` reimplements `computeRowNet`** ([row-net.ts:16](../../../src/lib/calculations/row-net.ts)) instead of calling it. Root cause of M1.

### 3.2 Serial numbers

**S1 — Disallowed paint is dropped from the Final Report and the remainder renumbered** ([uiic-final-builder.ts:323](../../../src/lib/reports/uiic-final-builder.ts)):

```
APT.filter(r => r.allowed !== false).map((r, i) => ... i + 1 ...)
```

Parts and labour print disallowed rows with a "Not Allowed" tag and number across the full list. Paint alone deletes them and closes the gap. With paint = [Buffing (allowed), Denting (not), Spraying (allowed)], the Final Report prints Spraying as **2** while Bill Check prints it as **3**. Same item, two documents, two numbers.

Fixing D4 for paint fixes the numbering as a side effect.

**S2 — Four numbering schemes exist.**

| Scheme | Used by |
|---|---|
| `row.srNo` — from the estimate, hand-editable | Assessment grid, Bill Check grid |
| `sn++` / `ln++` across all rows in section | Final Report parts, labour |
| `i+1` across allowed-only | Final Report paint |
| `findIndex` across all rows in section | Bill Check report |

Neither report uses `row.srNo`, so the number the surveyor verifies against on screen can differ from the number the insurer reads in both PDFs.

### 3.3 Matcher — why items land in "extra" when they shouldn't

Per the surveyor: a bill item absent from the estimate should not normally happen; genuine extra work comes via a supplementary estimate. So most entries in the extra-items panel are **matching failures**.

**X1 — Description matching is substring-only** ([aiDataSlice.ts:259–273](../../../src/stores/slices/aiDataSlice.ts)). `includes()` in both directions. "FRONT BUMPER" never matches "BUMPER FRONT".

**X2 — Section mismatch aborts matching.** Steps 2 and 3 both require `bi.section === row.section`. An AI misfiling a part under `labour_items` guarantees a false extra.

**X3 — Match reason is computed and discarded.** `reason: 'part' | 'amount' | 'desc'` never reaches the UI; a bad auto-match is invisible.

**X4 — Re-uploading the bill wipes curation.** `extraBillItems: unmatched` ([aiDataSlice.ts:561](../../../src/stores/slices/aiDataSlice.ts)) overwrites wholesale. Deleted items return; promoted items return as duplicates.

**X5 — Promotion would lose data.** `ExtraBillItem` keeps description, amount, category. `BillItem` also had taxable amount, GST%, part number and HSN — dropped at [aiDataSlice.ts:544](../../../src/stores/slices/aiDataSlice.ts).

**X6 — Rows with `estimated === 0` skip amount matching** ([aiDataSlice.ts:225](../../../src/stores/slices/aiDataSlice.ts)) and depend entirely on X1's broken description match.

**X7 — In-place mutation** at [aiDataSlice.ts:255](../../../src/stores/slices/aiDataSlice.ts) (`pick._ambiguous = true`), against the project immutability rule. Works by reference accident.

### 3.4 Panel and tab

**P1 — Unmatched items are a dead end.** [ExtraBillItemsPanel.tsx](../../../src/components/tabs/bill-check/ExtraBillItemsPanel.tsx) offers only Delete and Clear All. `addAssessmentRow(section)` creates a blank row; nothing converts an `ExtraBillItem` into an `AssessmentRow`.

**P2 — Clear All discards money silently.** No indication of the total being thrown away.

**P3 — Preview swallows every error** — `catch { return '' }` ([BillCheckTab.tsx:28](../../../src/components/tabs/BillCheckTab.tsx)) renders a blank panel on any builder crash.

### 3.5 Retracted during brainstorming

Three findings were wrong once D3 was established. Recorded so they are not re-raised:

- Extra bill items absent from the printed Bill Check report — **correct**, they are not insurer liability.
- Disallowed-but-billed items contributing to no total — **correct**, that is D3 working.
- Bill Check filtering to allowed-only — **correct as written**.

---

## 4. Design

### 4.1 One calculation, shared

`calculateBillCheckSummary` ([assessment.ts:168](../../../src/lib/calculations/assessment.ts)) stops computing depreciation and GST itself and calls `computeRowNet` — the helper the Final Report already uses.

Per allowed row:

```
depRate      = row.depOverride ?? getDepreciationRate(row.partType, ageMonths, depType)
assessedNet  = computeRowNet(row, depRate)      → + row.gst   (disposal rows: no GST)
billedNet    = billedTaxable × (1 − depRate)    → + row.gst

liability    = row.billStatus === 'not-in-bill'
                 ? 0
                 : min(assessedNet, billedNet)   // D6: capped at assessed
```

**When `billedTaxable` is absent**, `billedNet` must fall back to `assessedNet`, not to zero. A row marked in-bill with no captured taxable figure means "billed as assessed", and a naive `min()` against zero would silently drop the item from the insurer's liability. This is the same class of error as M1's masked fallback and must be explicit in the implementation.

`billedTaxable` (pre-GST) becomes the input, resolving M1 and M3. GST is applied once, at the row's own rate, resolving M4.

The report builder stops accumulating its own totals and calls this function, so the two documents cannot diverge again. This deletes code from `uiic-final-builder.ts` rather than adding to it.

**Expected effect on output:** Final Liability figures drop roughly 15–18% from what the app shows today, more on parts-heavy claims. Current figures are inflated; this is a correction, not a regression.

### 4.2 `billedAmount` unit consistency

`billedAmount` is defined as **including GST** — the display figure — and `billedTaxable` as the pre-GST basis used for calculation.

The "In Bill" dropdown is corrected to set both from the row's assessed figure, matching what the Billed Tax column already does (M2). Restoring from `not-in-bill` retains the previous figures rather than leaving zero (M5).

### 4.3 Serial numbers

One exported helper produces the serial for a row; both report builders call it. Numbering runs across all rows in a section, disallowed included, so gaps are preserved (D5).

The paint filter at [uiic-final-builder.ts:323](../../../src/lib/reports/uiic-final-builder.ts) is removed and disallowed paint prints with the "Not Allowed" tag, matching parts and labour (D4). S1 and S2 both close.

The Bill Check grid displays the report serial instead of `row.srNo`, so the number verified on screen is the number the insurer reads.

### 4.4 Unmatched items — link and add

`ExtraBillItemsPanel` gains two actions per item, alongside the existing delete:

**Link to existing item** — a searchable picker over the claim's assessment rows. On selection, the bill figures (`billedTaxable`, `billedAmount`) attach to that row, status becomes `in-bill` (or `partial` where amounts differ beyond ₹1), and the extra item is consumed.

**Add to Final Report** — creates an `AssessmentRow` carrying the description, taxable amount, GST%, part number and HSN already extracted (closing X5, which requires those fields to survive on `ExtraBillItem`). It lands as `allowed: false`, `assessed: 0`, with the billed figures populated (D2). It appears in the Final Report tagged "Not Allowed" until the surveyor allows it and enters an assessed figure.

Clear All states the total being discarded (P2).

### 4.5 Matcher

- Description comparison becomes word-set based, so word order stops mattering (X1).
- Section mismatch downgrades confidence instead of aborting the match (X2).
- Match reason surfaces in the grid so a questionable auto-match is visible (X3).
- Re-upload merges rather than overwrites, preserving deletions and promotions (X4).
- `_ambiguous` is returned in the match result rather than mutated onto the bill item (X7).

X6 resolves as a side effect of X1.

---

## 5. Testing

Per project standard, a runnable check accompanies the non-trivial logic:

- **Liability calculation** — unit tests on `calculateBillCheckSummary` covering: the bumper example above returning ₹10,620; a not-in-bill row contributing ₹0; an under-billed row taking the billed figure; an over-billed row capped at assessed; a disposal row taking no GST; a 28% GST row.
- **Screen/report agreement** — one test asserting the report's total equals `calculateBillCheckSummary`'s for the same claim. This is the regression guard for M1.
- **Serial numbers** — a claim with a disallowed paint item asserting the same serial in both builders (S1).
- **Matcher** — "FRONT BUMPER" vs "BUMPER FRONT" matches; a section-misfiled item matches; neither produces an extra item.

Existing tests in `src/lib/calculations/__tests__/` set the pattern.

---

## 6. Risks

| Risk | Handling |
|---|---|
| Liability figures change on existing claims | Expected and intended — current values are inflated. Flagged to the surveyor before implementation. Claims already issued are unaffected on paper; only re-prints change. |
| GST treatment is a professional judgement | The chosen method (depreciate, then GST once, at the row's rate) is what the Final Survey Report already does. Bill Check is being made to match it, not to introduce a new method. If UIIC reimburses full invoice GST rather than proportionate, **both** reports need revisiting — a separate conversation. |
| `billedAmount` semantics change | Confined to the three writers listed in M2; no persisted data migration, since `billedTaxable` is already populated on AI-matched rows. Rows where only `billedAmount` was hand-typed will need `billedTaxable` derived on read. |
| Adding a row changes an already-issued Final Report | Accepted by the surveyor: the correct workflow is that the item belongs in the Final Report and the surveyor decides on it there. Supplementary-estimate handling is the next task. |

---

## 7. Files touched

| File | Change |
|---|---|
| `src/lib/calculations/assessment.ts` | `calculateBillCheckSummary` rewritten on `computeRowNet`; cap logic |
| `src/lib/reports/uiic-final-builder.ts` | Own totals deleted, calls shared calculation; paint filter removed; shared serial helper; hardcoded 1.18 removed |
| `src/stores/slices/aiDataSlice.ts` | Matcher fixes X1–X4, X7; richer `ExtraBillItem` |
| `src/stores/slices/assessmentSlice.ts` | Actions for link and promote |
| `src/components/tabs/bill-check/ExtraBillItemsPanel.tsx` | Link / Add UI |
| `src/components/tabs/bill-check/BillCheckGrid.tsx` | "In Bill" unit fix; report serial; match reason |
| `src/types/assessment.ts` | `ExtraBillItem` fields |
| `src/components/tabs/BillCheckTab.tsx` | Preview error surfacing (P3) |
