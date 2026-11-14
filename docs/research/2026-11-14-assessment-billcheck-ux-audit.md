# Assessment and Bill Check tabs: UX audit

Date: 2026-11-14
Scope: the Assessment tab and the Bill Check tab, including the toolbar, the grid, the financial summary, policy check, printing and the floating Live Preview.
Method: I read the source of every component on both tabs, then checked it against the ui-ux-pro-max rules (accessibility, touch, layout, bulk actions, destructive actions). I did **not** look at the running app, because it needs a real login and claim data. So every finding comes from the code, with file and line references. A short pass on the live screen should confirm the visual ones.

Severity: **H** = causes wrong data or a wrong report, or fights the surveyor on every claim. **M** = slows them down or confuses them. **L** = polish.

---

## 0. Summary: the eight problems that matter most

| # | Problem | Tab | Sev |
|---|---|---|---|
| 1 | The "Select" and "Allowed" tick boxes sit next to each other, are the same size and differ only in colour. One tick queues a row for deletion. The other takes the row out of the claim. | Assessment | H |
| 2 | On a long list, column headings scroll away. Each section also has its own sideways scrollbar at its bottom, so you scroll down to scroll across. | Both | H |
| 3 | Deleting a row in Bill Check, or using "Remove 0 Amount", deletes it from the **Assessment and the Final Survey Report** too. Nothing on screen says so. | Bill Check | H |
| 4 | Neither tab can print. Assessment has a "Live Preview" pill (hidden below tablet width) that holds a 9 px Print button. Bill Check sends you to Report Center. | Both | H |
| 5 | The IMT 23 column is on by default for every claim, even when Policy Check says the policy has no IMT 23. | Assessment | M |
| 6 | Policy facts live in three places that can disagree: the Depreciation dropdown, the Policy Check pop-up, and the excess boxes in the summary. | Assessment | H |
| 7 | The financial summary permanently takes 25–33 % of the width. TOTAL LIABILITY, the most important number, is at the bottom of a card taller than the screen. | Both | M |
| 8 | The toolbar has about 20 controls in two stacked bars, with three ways to add a row and three insurer exports always shown. | Assessment | M |

---

## 1. Assessment tab

Files: `src/components/tabs/AssessmentTab.tsx`, `src/components/claim/AssessmentGrid.tsx`, `src/components/claim/AssessmentSectionTable.tsx`, `src/components/claim/AssessmentSummary.tsx`, `src/components/claim/assessment-grid-config.ts`, `src/components/policy/PolicyCheckStrip.tsx`, `PolicyCheckCard.tsx`.

### 1.1 Row start: four look-alike controls in 120 px (H)

`AssessmentSectionTable.tsx:327-361`. Each row starts with:

1. a drag handle (`GripVertical`, 30 % opacity)
2. a **Select** tick box, 14 px, red accent. Its only use is bulk delete.
3. the **Sr** number. It is an editable input with no border, so it looks like plain text.
4. the **Allowed** tick box, 14 px, blue accent. Its column heading is a 12 px `ShieldAlert` icon at 50 % opacity with no text (`:197`).

Problems:
- **The two tick boxes differ only by colour.** That breaks the "colour is not the only indicator" rule. Red-vs-blue is also hard to tell apart for colour-blind users, and on a dim laptop screen.
- **The results are completely different.** Unticking Allowed disallows the item and fades it to 40 %. Ticking Select makes a red "Delete Selected" button appear in the header.
- Both are 14 × 14 px, far below the 44 × 44 px touch minimum, with about 16 px between them. On a tablet in the field, mis-taps are expected.
- Selection is only used for delete, so the red accent turns every selection into "danger mode".

**Fix (recommended):**
- Replace the Allowed tick box with a labelled status chip: **`Allowed`** (green outline) / **`Disallowed`** (grey, struck through). It toggles on click, and the column heading reads "Status".
- Move the chip to the right, beside Assessed / Dep %, where the decision belongs.
- Keep one tick box column for Select. Make it neutral (not red), and let it drive a **bulk action bar**: *Allow · Disallow · Mark IMT 23 · Set Dep % · Move to section · Delete*. That also covers the skill's "Bulk Actions" rule. Today, disallowing 15 consumables means 15 separate clicks.
- Give the Sr input a faint border on hover/focus, plus `aria-label`s on both tick boxes.

### 1.2 Long lists: headers don't stick, and the sideways scrollbar sits at the bottom (H)

- `AssessmentGrid.tsx:520` wraps every section in `overflow-x-auto`. Each section table (`AssessmentSectionTable.tsx:181`) adds a second `overflow-x-auto`.
- An `overflow-x: auto` box becomes the scroll container for `position: sticky`. So the `thead ... sticky top-0` on line 183 sticks inside a box that never scrolls up or down. **In practice the column headings never stick.** It also has `z-0`, under the card header's `z-20`.
- Each section gets its own horizontal scrollbar at **its own bottom**. With 40 spare parts, you scroll all the way down to scroll sideways, then back up.
- The table's min-width is 1200 px once 6 or more optional columns are shown (`:182`). The defaults already show 7: Type, Estimate, GST, Disposal, IMT 23, Action, Price+GST. Add the 350 px Particulars column and the 25–33 % summary column, and **every common laptop width (1366 / 1440) scrolls sideways.**
- The section subtotal and the "Add row" button are only at the bottom of each section.

**Fix:**
- Use one scroll container for the whole grid, in both directions (remove the inner `overflow-x-auto`).
- Make `thead` sticky with a `top` offset equal to the card header height and `z-10`. Make the section title bar sticky too.
- Make the first columns (Sr + Particulars) `sticky left-0` so the part name stays visible when you scroll right.
- Add a slim "jump to" strip at the top of the grid: *Parts (42) · Labour (18) · Paint (9)*, with each section's subtotal shown in the chip.

### 1.3 IMT 23 is always visible (M)

`assessment-grid-config.ts:68` has `imt23: true` in `DEFAULT_VISIBLE`, so every claim shows an IMT 23 column, header `:235` and cell `:573`.

The app already knows the answer: `policyCheck.imt23` is `'yes' | 'no' | 'na'`, and `policy-check.ts:63` already warns when rows are ticked but the policy has no IMT 23.

**Fix:** derive visibility. Show the column when `pc.imt23 === 'yes'` **or** when any row already has `imt23` (so data is never hidden). Hide it otherwise. The user's column toggle stays as an override.

The same rule should apply to other columns:
- **Dep %** when Nil Dep = yes: show a read-only "0 (Nil Dep)" or drop the column.
- **Disposal**: it only matters on a minority of claims. Make it default-off, or turn it on when any row is disposal.
- The **paint material dep** controls (`:144-173`) are already conditional, which is good. They are, however, three inputs packed into the section title bar between the title and "Add row". Move them into Policy / Settings.

### 1.4 Policy facts in three places that can disagree (H)

| Fact | Where it is set |
|---|---|
| Nil Dep | toolbar **Depreciation** dropdown (`AssessmentTab.tsx:125`) **and** Policy Check "Nil / Zero Dep" pill |
| Compulsory / voluntary excess | Policy Check card (`PolicyCheckCard.tsx:62-80`) **and** Financial summary (`AssessmentSummary.tsx:161-187`) |
| IMT 23 | Policy Check pill, and a column tick on each row |

`setPolicyCheck({nilDep})` sets `depreciationType` (`claimSlice.ts:404`), but **not the other way round**. A surveyor who switches the toolbar dropdown to "Nil Depreciation" leaves Policy Check still saying "No". The print gate then reads one answer while the grid uses the other.

On placement: the Policy Check chip sits in the top-left of the toolbar, as small as the AI pills. Yet it governs Dep %, IMT 23, consumables and excess, which are everything in the summary column.

**Fix:**
- Put a **"Policy terms" card at the top of the Financial summary column**: Nil Dep · IMT 23 · Consumables · Excess (compulsory/voluntary + Confirm), each showing "AI read: …" as now. It is the input to the numbers directly below it, so it belongs there.
- Delete the separate excess inputs from the summary (they become the same fields).
- Delete the toolbar Depreciation dropdown, or make it a read-only badge "Dep: Standard · from policy" that opens the card.
- Keep a small status chip in the toolbar ("Policy: 3 of 4 ✓") that scrolls to or opens the card, so the print gate's prompt still has a target.

### 1.5 No print from the Assessment tab (H)

- No print or preview button exists on the tab.
- `FloatingReportPreview.tsx:217` shows a "Live Preview" pill at `fixed bottom-6 right-6 z-50`. Inside it is a **9 px Print button** (`:294-302`). The pill is `hidden md:flex`, so it does not exist below tablet width.
- The pill also floats over the bottom-right of the grid and the summary, which is exactly where the row Delete buttons and TOTAL LIABILITY sit.

**Fix:**
- Add a **Print ▾** button to the tab toolbar (Final report · UIIC final · Insured summary). Run it through the existing `usePrintGate().gate` so the policy and repair-date questions still apply. This reuses existing code.
- Keep Live Preview, but as a toolbar toggle ("Preview") that opens the same panel. Stop using a floating pill over the work area.

### 1.6 Toolbar overload and duplicate actions (M)

There are two stacked header bars.

**Tab toolbar** (`AssessmentTab.tsx:118-198`): title, Depreciation dropdown, Policy chip, AI pill (Provider, Doc mode, Model, Health = 4 controls), Upload Estimate, Phone files, Fix reading, Show Evidence, Show Summary, Save. **12+ controls.**

**Grid card header** (`AssessmentGrid.tsx:384-505`): UIIC Portal, NIA Excel, OIC Excel, Paint Row, Part Row, Labour Row, Delete Selected, Columns. **8 controls.**

Then every section has **"Add row" at the top (`:174`) and again at the bottom (`:724`)**.

Problems:
- **Three ways to add a row.**
- The three insurer exports are always shown, even on an ICICI claim.
- The AI settings are set once per claim but take prime space on every visit.
- Five colour-coded pill buttons (amber, emerald, indigo, purple, blue) make the header noisy, and the colours mean nothing.

**Fix:**
- Show only the export for the claim's insurer (`policy.insurerName`), and put the rest in an **Export ▾** menu.
- Collapse the AI pill into one **"AI ⚙"** popover that shows the model name as its label.
- Remove Paint / Part / Labour Row from the card header and keep only the section-level "Add row". Keep it at the bottom of each section; a sticky section bar can carry a "+".
- Merge Show Evidence and Show Summary into one segmented control: `[Grid] [Grid + Summary] [Grid + Evidence]`.
- About 50 px of height is saved, which is 1–2 extra rows on a laptop.

### 1.7 The summary column eats width, and TOTAL LIABILITY is out of view (M)

- `AssessmentTab.tsx:206-211`: the summary takes `lg:col-span-4 xl:col-span-3`, which is 25–33 % of the width, permanently.
- `AssessmentSummary.tsx` is about 16 table rows, then salvage, two excess inputs and towing, and only then TOTAL LIABILITY (`:216-228`).
- The card is `sticky top-6`, but it is taller than the viewport, so the bottom (the net payable figure) only shows once you scroll to the end of the grid.
- A sticky element taller than the viewport is the classic "sticky that never shows its end" bug.

**Fix:**
- A **sticky bottom totals bar** across the grid: *Parts ₹ · Labour ₹ · Paint ₹ · GST ₹ · Gross ₹ · Less excess/salvage ₹ · **Net payable ₹***. It is always visible and takes no width.
- The detailed Estimate-vs-Assessment table moves into a collapsible drawer (the current "Show Summary"), **closed by default** once the claim has more than about 15 rows. Or make each block (Parts / Labour / Deductions) collapsible.
- Salvage, excess and towing move into the Policy terms card (1.4), which also shortens the summary.

### 1.8 Disallowed rows are unreadable (M)

- `:325` applies `opacity-40` to a disallowed row. At 40 % opacity, grey text on white is about 2:1 contrast, which fails WCAG 4.5:1.
- The surveyor must still read *what* they disallowed, and the report prints these rows.
- Bill Check does it differently: line-through at 75 % opacity (`BillCheckGrid.tsx:516-541`). That is better, but inconsistent.

**Fix:** keep full-contrast text, strike through Particulars, grey the money cells, and show a "Disallowed" chip (from 1.1). Use the same treatment on both tabs.

### 1.9 Colour-only and conflicting row states (M)

Row background classes stack (`:325`): selected (red/5), disallowed (muted), **duplicate** (orange/10), disposal (amber/5), IMT 23 (primary/5), plus an estimate-colour left border.

- Tailwind applies whichever class comes last in its stylesheet, so a row that is both a duplicate and disposal shows one colour arbitrarily.
- **A duplicate is shown only as an orange left border on the Select cell (`:328`)**, with no text and no tooltip. The surveyor sees an orange line and has to guess.

**Fix:**
- Show states as small labelled chips in the Particulars cell: `Duplicate`, `Disposal 50 %`, `IMT 23`, `Re-read`. The Re-read chip and the category tags already work this way.
- Keep at most one background tint (selected).
- Give "Duplicate" a tooltip naming the other row: "Same as Sr 12".

### 1.10 Assessment row delete: no confirmation and no undo (M)

- `:670` calls `deleteAssessmentRow` directly. The trash icon is the last cell, next to Remarks and Price+GST, and sits under the floating Live Preview pill.
- Bill Check confirms a single delete (`BillCheckGrid.tsx:194`); Assessment does not. That is inconsistent.

**Fix:** delete straight away, but show a **sonner "Row deleted · Undo" toast** for 6 s (sonner is already a dependency). This is better than a `confirm()` pop-up, which people learn to click through.

### 1.11 Typography and target size (M)

- Inputs are 11 px, headers 12 px uppercase, Dep % 11 px. There are 10 px chips, a 9 px column-width hint and an 8 px "DISP" badge (`:627`).
- Row inputs are 28 px tall. The evidence button is about 20 px and **only appears on hover** (`:397`), so it is undiscoverable and does not exist on touch.

**Fix:**
- Minimum 12 px for data, 13 px for Particulars and money.
- Add a density toggle (Compact / Comfortable) in the Columns menu, so desk users keep density and tablet users get 36–40 px rows.
- Keep the evidence icon at 40 % opacity always (not hidden).

### 1.12 Smaller issues (L)

- **Emoji in the Type dropdown** (`:489-494`: 🟦🟧🟪🟩🎨⚙️). This breaks the "no emoji icons" rule, and emoji render differently on each OS. Use a coloured dot via the select's text colour, or plain text.
- **Column label "Estimate(taxable amount)"** (`:224`) has no space before the bracket and sits in a `w-20` column, so it wraps over 3 lines. Use "Est. (taxable)" with the full text as a tooltip.
- **The Particulars resize handle shows "350px"** on hover (`:204`). That is developer information; drop it.
- **Total Loss form** (`AssessmentTab.tsx:215`) renders under the grid on every claim. It only matters for CTL cases. Put it behind a "Check total loss" button, or show it automatically when gross approaches the CTL threshold.
- **Empty-state copy** (`AssessmentGrid.tsx:527`) says "Use the buttons above". Use a direct "Upload estimate" and "Add first row" instead.
- **Keyboard power features** exist (Shift+Arrow, Ctrl+D fill-down, multi-line paste), but nothing on screen mentions them. Add a "⌨ Shortcuts" hint in the Columns menu.

---

## 2. Bill Check tab

Files: `src/components/tabs/BillCheckTab.tsx`, `src/components/tabs/bill-check/BillCheckHeader.tsx`, `BillCheckGrid.tsx`, `BillCheckSummaryPanel.tsx`, `BillCheckAttentionBanner.tsx`, `config.ts`, `src/components/tabs/report/BillCheckActions.tsx`.

### 2.1 Delete in Bill Check silently changes the Final Survey Report (H)

`BillCheckGrid.tsx:190, 195, 355` (Delete Selected, row trash, "Remove 0 Amount") all call `deleteAssessmentRow(s)`. These are the **same rows the Assessment tab and the Final Survey Report print**. "Add row" (`:818`) also adds to the assessment.

- A surveyor tidying up the bill check reasonably thinks they are editing the bill check only.
- The file's own comment (`:117-126`) already treats this risk as serious for *allowance*: `billAllowed` was split from `assessed` so a filed Final report is not silently reprinted. Delete has no such guard.

**Fix:**
- In Bill Check, replace the row delete with **"Not in bill"**, which already exists as a status and is what the surveyor means. Keep real delete only in Assessment.
- If delete must stay, the confirm text must say: "Also removes it from the Assessment and the Final Survey Report."
- "Remove 0 Amount" belongs in Assessment, not here.

### 2.2 No print here; "View & Print in Report Center" is at the bottom (H)

- `BillCheckSummaryPanel.tsx:395-404` holds the only output action. It sits at the very end of a tall sticky card, below the audit block, and it navigates away from the tab.
- The print gate already exists as a hook: `useBillCheckPrintGate().requestPrint('standard' | 'uiic')`. It is used in `BillCheckActions.tsx`.

**Fix:**
- Add **Print ▾ (Standard / UIIC)** to the Bill Check toolbar. Pre-select UIIC when the insurer is UIIC, and reuse `requestPrint` plus `dialogs`.
- When the red attention banner is blocking, the button shows "Print (2 to review)" and clicking it scrolls to the first flag instead of failing.
- Keep "Open in Report Center" as a small secondary link.

### 2.3 The "Step" structure is broken (M)

- The grid says **"Step 2 — Verify Each Item"** (`:343`). There is no Step 1 and no Step 3 on screen.
- Step 1 is really "upload the bill" (toolbar) plus "invoice details" (top of the right-hand summary). Step 3 is print (another tab).
- The help text says "Mark each item as In Bill / Not In Bill / **Partial**", but the dropdown (`:714-716`) has only *Pending / In Bill / Not in Bill*.

**Fix:**
- A 3-step strip under the toolbar: **① Bill details (No. · Date · Total · ✓ verified) → ② Verify items (n pending) → ③ Print**. Each step shows its state.
- Move the invoice fields out of the summary card into step ① as a single horizontal line. It is 4 fields; they fit in one row.
- Fix the help text to match the dropdown.

### 2.4 Rows are tall, headings tiny, and the grid isn't a table (M)

- Rows are `px-6 py-3` with a 7–8 px input inside (`:512`), about 52 px tall, against about 40 px in Assessment. That means about 25 % fewer rows per screen.
- Column headings are **9 px uppercase with 0.15em letter-spacing** (`:210`), the hardest text on the screen to read.
- The grid is built from `div`s with CSS grid, not `<table>`, so screen readers get no header/cell relationship.
- The heading row repeats per section but is not sticky, so the same scroll problem as 1.2 applies.

**Fix:**
- Use the same row density as Assessment (`py-1.5`) and 11–12 px headings in normal case.
- Make the heading rows sticky.
- Long term, render Bill Check with the same table component as Assessment (see 3.1).

### 2.5 Thirty dropdowns for thirty rows: no bulk status (M)

Every allowed row needs its status dropdown set. The only bulk actions are the banner's "Confirm all billed under / Keep my assessment".

**Fix:**
- Selection-driven bulk bar: **Mark In Bill · Mark Not in Bill · Reset to Pending**, plus a **"Mark all remaining Pending as In Bill"** button.
- Add a **"Show Pending only (n)"** filter beside the existing "Review Ref Numbers".
- Replace the dropdown with a 2-button segmented control (✓ In bill | ✗ Not in bill). One click instead of two, with no hidden option.

### 2.6 Two different "difference" figures on one screen (M)

- The amber banner's gap comes from `reconcileInvoice`: Σ `billedTaxable × (1+GST)` over **all** rows, including rejected-but-billed ones (`bill-check-flags.ts:145-150`).
- The summary's "Difference" is `billTotal − inBillTotal`, where `inBillTotal` = Σ `billedAmount` of **allowed rows with status in-bill** only (`BillCheckTab.tsx:78`, `BillCheckSummaryPanel.tsx:96`).
- Rounding and population differ, so with any rejected-but-billed row or partial billing **the two numbers disagree**.

**Fix:** show one reconciliation figure, from `reconcileInvoice`, in both places. Make the summary line read "Invoice ₹X · Lines ₹Y · Gap ₹Z".

### 2.7 Duplicated and mislabelled header information (M)

- **"Invoice Verified / Unverified" appears twice**: as a header badge (`BillCheckHeader.tsx:55-63`) and as a summary card badge (`BillCheckSummaryPanel.tsx:123-131`).
- **Net Liability appears twice**: in the header pill and in the summary.
- **"Saving: −₹…" is in red** (`BillCheckHeader.tsx:72`). A saving is the good outcome for the insurer, but red plus a minus sign reads as a loss.
- **The same quantity has four names**: "Not in bill", "not claimed" (`BillCheckGrid.tsx:313`), "Saving", and "Items Not in Bill (Saving)".

**Fix:**
- One status location: step ① of the strip.
- The header pill shows **Billed ₹ · Allowed ₹ · Not billed ₹** in neutral colours.
- Pick one term, **"Not billed"**, and use it everywhere.

### 2.8 Alarm styling on normal data (L)

- **The Ref Item No. input is always red italic on a red tint** (`:732`), even for a perfect match. That is alarm fatigue: the ambiguous dot (`:735`) is the real signal.
- The ✎ rename uses `window.prompt()` (`:260`). "Remove 0 Amount" uses `alert()` and `confirm()`. These are native pop-ups that look nothing like the app's dialogs.

**Fix:**
- Use neutral styling. Go red or amber only when `refStatus === 'ambiguous'` or the ref is missing.
- Use an inline rename or the app's Dialog instead of native pop-ups.

### 2.9 Toolbar navigation buttons don't say what they navigate (L)

`‹ Prev  Next ›  3 / 7` (`:387-392`) gives no label for *what* is being stepped through.

**Fix:** "‹ Flag 3 of 7 ›", coloured like the banner, and placed in the banner instead of the toolbar.

### 2.10 Summary panel order (M)

The current order is: invoice details → Loss assessment table → salvage/excess → **TOTAL LIABILITY** → audit/reconciliation → Report Center link. The hero figure is in the middle, and the panel is taller than the screen (same issue as 1.7).

**Fix:** use the same sticky bottom totals bar as Assessment (*Assessed ₹ · Billed ₹ · Not billed ₹ · Less excess/salvage ₹ · **Liability ₹***). The panel then only holds the detail table and salvage, and is collapsible.

---

## 3. Across both tabs

### 3.1 Two grids that should be one (M, larger work)

Assessment is a `<table>` with sticky-ish headers, drag and drop, and cell selection. Bill Check is a `div` CSS grid with different row height, header style, column config (`assessment-grid-config.ts` vs `bill-check/config.ts`), resize storage key and delete behaviour. `GRID_COLUMNS` already exists as a shared column list.

The surveyor reads the two side by side, so they should look identical: same widths, same headings, Bill Check adds its 3 columns on the right.

**Path:** extract one `ClaimGrid` table (columns from `GRID_COLUMNS`), with Bill Check passing its extra columns. Do this only after the quick wins below, because it is the riskiest change.

### 3.2 Consistency checklist

| Behaviour | Assessment | Bill Check | Should be |
|---|---|---|---|
| Disallowed row | 40 % opacity | line-through, 75 % | line-through, full contrast, chip |
| Single row delete | no confirm | confirm | undo toast; no delete in Bill Check |
| Particulars click | edits text, hover icon opens evidence | whole cell opens evidence | icon always visible on both |
| Row height | ~40 px | ~52 px | same, with a density toggle |
| Headings | 12 px | 9 px | 11–12 px |
| Column defaults | IMT 23 on, Remarks off | Remarks on | driven by policy + data |
| Print | hidden FAB | other tab | toolbar Print ▾ on both |

---

## 4. Proposed layout

```
┌ Assessment ── Policy: 4/4 ✓ ── [Upload estimate] [Phone] [Fix reading] ── [AI ⚙ Gemma] [View ▾] [Export ▾] [Print ▾] [Save] ┐
│ Jump: Parts 42 · ₹1,24,300 │ Labour 18 · ₹22,100 │ Paint 9 · ₹18,400          ☐ 3 selected: Allow · Disallow · IMT23 · Dep% · Delete │
├────────────────────────────────────────────────────────────────────────────────────────────────────┬───────────────────────┤
│ SPARE PARTS (42)                                                       sticky ▲                    │ POLICY TERMS          │
│ ☐ Sr │ Particulars (sticky ◀)            │ Type │ Est. │ GST │ Assessed │ Dep% │ Net │ Status    │ Nil Dep  [Yes][No]    │
│ ☐ 1  │ Front bumper  Duplicate·Sr 12     │ Plas │ 8200 │ 18  │ 7500     │ 50   │3750 │ ✓Allowed  │ IMT 23   [Yes][No][NA]│
│ ☐ 2  │ ~~Wiper blade~~                   │ …    │      │     │          │  —   │  —  │ Disallowed│ Excess  1000 / 0  ☑   │
│ …                                                                    + Add part                    │ Salvage / Towing      │
├────────────────────────────────────────────────────────────────────────────────────────────────────┴───────────────────────┤
│ Parts ₹1,24,300 · Labour ₹22,100 · Paint ₹18,400 · GST ₹27,500 · Gross ₹1,92,300 · Less ₹2,000 ·  NET PAYABLE ₹1,90,300  │ sticky
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Bill Check is the same frame. The jump strip becomes the 3-step strip (① Bill details · ② Verify — 12 pending · ③ Print), and the totals bar becomes *Assessed · Billed · Not billed · Liability*.

---

## 5. Suggested order of work

Effort is my estimate for one developer, including tests. There is no runtime cost: these are UI-only changes, with no AI calls, storage or new dependencies.

**Phase 1: quick wins (≈ 1–1.5 days)**
1. Allowed chip + neutral select tick box + aria labels (1.1) — 3 h
2. IMT 23 / Disposal column visibility driven by policy and data (1.3) — 1 h
3. Toolbar Print ▾ on both tabs via the existing `usePrintGate` / `useBillCheckPrintGate` (1.5, 2.2) — 3 h
4. Bill Check: remove row delete and "Remove 0 Amount", or warn that delete also changes the Final report (2.1) — 1 h
5. Undo toast on Assessment delete (1.10) — 1 h
6. Copy fixes: "Partial" text, one "Not billed" term, neutral "Saving", Ref input colour, column label (2.3, 2.7, 2.8, 1.12) — 1.5 h

**Phase 2: layout (≈ 2–3 days)**
7. One scroll container, sticky headers, sticky Sr + Particulars, section jump strip (1.2, 2.4) — 1 day. This needs a real check with a 60-row claim.
8. Sticky bottom totals bar; summary collapsible and closed by default on long claims (1.7, 2.10) — 0.5 day
9. Policy terms card in the summary column; one excess input; dropdown/pill sync (1.4) — 0.5 day
10. Toolbar consolidation: Export ▾, AI ⚙ popover, View segmented control, drop duplicate Add-row buttons (1.6) — 0.5 day
11. Bill Check 3-step strip with invoice fields in one line; single reconciliation figure (2.3, 2.6) — 0.5 day

**Phase 3: bulk and consistency (≈ 2 days)**
12. Bulk action bar for Allow / Disallow / IMT 23 / Dep % / status, plus "Pending only" filter (1.1, 2.5) — 1 day
13. Row-state chips instead of stacked tints; duplicate tooltip (1.9) — 0.5 day
14. Typography floor and density toggle (1.11) — 0.5 day

**Phase 4: optional (≈ 3–4 days)**
15. One shared grid component for both tabs (3.1).

---

## 6. Impact on SurveyOS Scan

None expected. These changes stay inside the tab UI. None of the Prime↔Scan coupling points are touched: doc types, insurer table, folder layout, spot/valuation labels, `spotDetails.*` / `valuationDetails.*`, or the `_surveyos-scan.json` manifest. If phase 3 renames any column label that a report builder also prints, re-run Scan's drift tests.

## 7. What this audit could not check

- The live screen: it needs a login and a real claim. Visual findings (exact wrap points, overlap of the Live Preview pill, real row heights) are inferred from the classes and should be confirmed on a 1366 px laptop and a tablet.
- Behaviour with 60+ rows: the sticky and scroll findings in 1.2 follow from how CSS sticky works, but they are worth a two-minute look on a long estimate before Phase 2.
