# Design: Standard Bill Check Report

**Date:** 2026-08-18
**Status:** Draft — awaiting review

---

## Problem

The Bill Check tab collects a full set of bill-side inputs — `billedTaxable`, `billedAmount`, `billStatus`, `billRemarks` ([BillCheckGrid.tsx:394-449](../../src/components/tabs/bill-check/BillCheckGrid.tsx)) — and `extraBillItems`. The only report that consumes any of it is the UIIC Bill Check Report, which consumes three fields and throws the rest away.

`buildUIICBillCheckHTML` ([uiic-final-builder.ts:460-998](../../src/lib/reports/uiic-final-builder.ts)) reads:

- `billNo` / `billDate` → four header cells
- `billTotal` → one cell
- `billStatus` + `billedTaxable` → two summary numbers, via `calculateBillCheckSummary`

Its item table ([:771-839](../../src/lib/reports/uiic-final-builder.ts)) is built entirely from `estimated`, `assessed`, `gst` and `depOverride`. It has no Bill column, no status column, no billed figure of any kind. It is the Final Report's table with Paint split out.

For UIIC that is correct behaviour, not a defect. UIIC is a **one-pass** workflow: the Final Survey Report is itself prepared from the workshop bill, so `assessed` already carries the bill figure and there is no second number to print. The document exists to certify that disallowed items were excluded, which is exactly what it states at [:989](../../src/lib/reports/uiic-final-builder.ts).

Other insurers run a **two-pass** workflow. The Final Survey Report assesses from the garage *estimate*; weeks later the workshop's bill arrives with different figures. The bill check must show what was billed against what was assessed. No report in the codebase does this — `standard-report-builder.ts` does not read `billCheck` either.

So the missing artifact is the Standard bill check, not a fix to the UIIC one.

---

## Goal

Produce a Standard Bill Check Report that is the Standard Final Survey Report with the **Estimate column replaced by the Bill column**, so a claims officer reads Bill against Assessed in the layout they already know. All other columns, the §8 summary, the GST/HSN tables and the depreciation treatment stay exactly as they are.

---

## Scope

**In scope — report:**
- `mode: 'final' | 'bill-check'` on the existing Standard builder
- A pure row projection that moves the bill figure into the estimate slot and zeroes unreplaced parts
- Format toggle (Standard | UIIC) on the Bill Check tab, mirroring [ReportTab.tsx:58](../../src/components/tabs/ReportTab.tsx)
- Bill-check variant of the report preamble
- `billAllowed?: number` on `AssessmentRow`, so a bill-check allowance cannot rewrite an issued Final Survey Report
- Scope dialog when an Assessed edit in Bill Check diverges from the assessed figure
- Print gate resolving `pending` rows, plus a missing-remark disclaimer

**In scope — screen:**
- Align the Bill Check grid's columns, labels and order with the Assessment grid
- One shared column-config module consumed by both grids
- Rename `Billed Tax (₹)` → `Billed Taxable (₹)`; remove `Billed Incl GST (₹)`
- Correct `Assessed Tax (₹)`, which renders `row.estimated`

**Out of scope:**
- Any change to `calculateAssessmentSummary`, `aggregateGst`, `computeRowNet` or `computeRowLiability`
- Snapshotting the Final Survey Report at issue. `billAllowed` solves the case at hand; a general snapshot is the broader fix and its own piece of work
- Any change to the UIIC Bill Check Report, including its known not-in-bill total mismatch (tracked separately)
- A second Bill Check tab — the existing grid already collects every input this report needs
- Merging `BillCheckGrid` into `AssessmentSectionTable` — considered and declined; see *Screen* below
- Variance columns, remarks columns, or a deduction summary section
- Auto-selecting the format from `policy.insurerName` — it is free text and drives nothing today

---

## Design

### The whole feature is a projection

The report is the Standard Final Survey Report rendered over projected rows. Nothing downstream changes.

```ts
// ponytail: bill check IS the final report over projected rows. The estimate
// slot carries the bill figure, billAllowed overrides the assessed figure for
// this document only, and a part that was never replaced carries no money.
// Every existing calculation then works untouched.
export function projectForBillCheck(rows: AssessmentRow[]): AssessmentRow[] {
  return rows.map(r =>
    r.billStatus === 'not-in-bill'
      ? { ...r, estimated: 0, assessed: 0 }
      : { ...r, estimated: r.billedTaxable ?? 0, assessed: r.billAllowed ?? r.assessed }
  );
}
```

Immutable, per the project's immutability rule. Because `assessed` is what every money path already reads, zeroing it is sufficient to remove an unreplaced part from §8, the GST tables and the net liability — with no arithmetic changes anywhere.

`billAllowed` is the one new field, and it exists so that a bill-check decision cannot rewrite an already-issued Final Survey Report. See *Allowing a figure above the assessed value* below.

### What `mode` actually controls

Only labels and one cell. It does not thread through the calculations.

| Location | `final` | `bill-check` |
|---|---|---|
| Document title | `MOTOR (FINAL) SURVEY REPORT` | `MOTOR BILL CHECK REPORT` |
| §3, §7 | rendered | omitted |
| §4 | `ACCIDENT & SURVEY DETAILS` | `WORKSHOP INVOICE & BILL REFERENCE` |
| §9 heading | `DETAILS OF ASSESSMENT` | `DETAILS OF BILL CHECK` |
| §9 main header ([:615](../../src/lib/reports/standard-report-builder.ts)) | `Est. ₹` | `Bill ₹` |
| §9 labour/paint sub-header ([:301](../../src/lib/reports/standard-report-builder.ts)) | `Est. ₹` | `Bill ₹` |
| §8 summary column | `Estimated` | `Billed` |
| §9 cell ([:232](../../src/lib/reports/standard-report-builder.ts), [:273](../../src/lib/reports/standard-report-builder.ts)) | `m9(r.estimated)` | `PENDING` when `billedTaxable` is undefined, else `m9(r.estimated)` |
| Preamble ([:470](../../src/lib/reports/standard-report-builder.ts)) | estimate wording | bill wording |

The §8 columns at [:128-132](../../src/lib/reports/standard-report-builder.ts) sum `r.estimated` and therefore pick up the bill figures for free once the rows are projected.

### Report structure — the Final Survey Report's format, minus the narrative

The document must read as the Standard Final Survey Report, not as a new form. It keeps that report's header, section numbering, section styling and signature block; only the narrative sections the final report already establishes are dropped.

| Element | Source | In bill check |
|---|---|---|
| Surveyor header | `getSurveyorHeader()` ([report-utils.ts:91](../../src/lib/reports/report-utils.ts)) | **Verbatim** — centred name at 13pt, qualifications, `INSURANCE SURVEYOR, LOSS ASSESSOR & VALUER`, then the licence / expiry / IIISLA / e-mail / cell row |
| Title | — | `PRIVATE AND CONFIDENTIAL — MOTOR BILL CHECK REPORT` |
| Top policy table | [:314-338](../../src/lib/reports/standard-report-builder.ts) | **Kept**, plus a Final Survey Report No. / date row tying the two documents |
| §1 Insurer & Insured | [:341](../../src/lib/reports/standard-report-builder.ts) | **Verbatim** — insurer name, appointing office, insured name/mobile/address, H.P.A. |
| §2 Vehicle Particulars | [:363](../../src/lib/reports/standard-report-builder.ts) | **Verbatim** |
| §3 Driver's Particulars | [:403](../../src/lib/reports/standard-report-builder.ts) | Omitted |
| §4 Accident & Survey | [:435](../../src/lib/reports/standard-report-builder.ts) | **Replaced** by `4. WORKSHOP INVOICE & BILL REFERENCE` |
| §7 Cause & Nature | [:467](../../src/lib/reports/standard-report-builder.ts) | Omitted |
| §8 Assessment Summary | [:471](../../src/lib/reports/standard-report-builder.ts) | Kept, `Estimated` → `Billed` |
| §9 Details of Assessment | [:608](../../src/lib/reports/standard-report-builder.ts) | Kept as `DETAILS OF BILL CHECK`, `Est. ₹` → `Bill ₹` |
| GST summaries (HSN, SAC) | [:406-409](../../src/lib/reports/standard-report-builder.ts) | Kept |
| Signature block | `getSigBlock()` ([report-utils.ts:117](../../src/lib/reports/report-utils.ts)) | **Verbatim** |

Original section numbers are preserved rather than renumbered, so a reader moving between the two documents finds the same content under the same number. The gaps at 3 and 7 follow the house style, which already skips 5 and 6.

**§4 WORKSHOP INVOICE & BILL REFERENCE** is what identifies the document as a bill check: workshop name, then **Bill / Invoice No., Bill / Invoice Date and Total Bill Amount (incl. GST)** — all three entered on the Bill Check tab — set against the figure this report allows.

### Field provenance — nothing prints without an input

Every field on the page must have a screen that writes it. Audited:

| Field | Input | Verdict |
|---|---|---|
| `billCheck.billNo` / `billDate` / `billTotal` | [BillCheckUploadPanel:37/49/60](../../src/components/tabs/bill-check/BillCheckUploadPanel.tsx) | Include — critical |
| `accident.workshopName` | [AccidentForm:138](../../src/components/claim/AccidentForm.tsx) | Include |
| `reportNo`, `reportDate`, `policy.*` | claim record | Include |
| `reinspection.actualCompletionDate` | Reinspection tab only | **Exclude** — blank without a reinspection |
| `reinspection.repairsAsAssessed` | Reinspection tab only | **Exclude** — same |
| `reinspection.repairAuthDate` | **none — no screen writes it** | **Exclude** |
| `reinspection.estCompletionDate` | **none** | **Exclude** |

`repairAuthDate` and `estCompletionDate` exist in `ReinspectionDetails` and default to `''` ([claim.ts:362](../../src/types/claim.ts)), but no component writes either. They are printed today by the UIIC reports and are always blank there.

### §9 columns

Unchanged from the Final Survey Report except the first money column:

`Sr. | Particulars | Type | Bill ₹ | Assessed ₹ | Dep% | Metal ₹ | Pla/Rub ₹ | [FbrGls ₹] | Glass ₹ | GST% | Price+GST ₹`

No Variance column and no Remarks column: with Bill sitting beside Assessed, the difference is visible by subtraction, the same way Est. and Assessed already read in the final report. GST is presented exactly as the Standard Final Survey Report presents it.

### Row behaviour

| Condition | Bill ₹ | Money columns | In PDF |
|---|---|---|---|
| `allowed === false` | — | — | **No** — excluded, as today |
| `billStatus === 'not-in-bill'` | `0` | zeroed | Yes — visible, carries no money |
| `billStatus === 'pending'` | `PENDING` | — | **No** — printing is blocked until resolved; see *Print gate* |
| otherwise | `billedTaxable` | assessed stands | Yes |

`not-in-bill` covers both real cases — *"should have been billed and wasn't"* and *"the part was never put"*. The row printing with zeros lets the insurer see that a part was assessed and not replaced, and the saving is self-evident from the assessed column beside it.

### Items in the bill that are not in the assessment

Handled by the existing supplementary flow, not by a new mechanism.

On final-bill extraction, items matching no assessment row trigger the existing prompt ([useEstimateModePrompt.tsx](../../src/hooks/useEstimateModePrompt.tsx) / [EstimateModeDialog.tsx](../../src/components/dialogs/EstimateModeDialog.tsx)): *is there a supplementary estimate for these?*

- **Yes** → promoted into the assessment sheet as `source: 'supplementary'` rows via the existing `promoteExtraBillItem` action. They then flow into bill check normally, under the supplementary divider band both reports already draw.
- **No** → they stay in `ExtraBillItemsPanel` and the surveyor decides per row. Nothing unassessed reaches the PDF.

### Allowing a figure above the assessed value

The common case: estimate ₹1,000, assessed ₹1,000 at final survey, workshop bills ₹1,200 for a standard part, and the surveyor decides to allow ₹1,200.

**The problem this solves.** There is one `assessmentRows` array on the claim and one `updateAssessmentRow` action ([assessmentSlice.ts:69](../../src/stores/slices/assessmentSlice.ts)), which both grids call. No snapshot of an issued report exists anywhere in `ClaimData` — the `version` field ([claim.ts:61](../../src/types/claim.ts)) is a cloud-sync counter, never bumped by local edits. So editing `assessed` during bill check silently rewrites the Final Survey Report that was already filed: same report number, different figure, no history. On a routine claim, not an edge case.

**The design.** A new optional field, `billAllowed?: number` (pre-GST basis). The surveyor types 1,200 into the same Assessed cell in the Bill Check grid; on committing a value that differs from `assessed`, a dialog asks how far the change should reach:

| Choice | Writes | Final Survey Report |
|---|---|---|
| **Bill Check only** | `billAllowed = 1200`, `assessed` stays 1000 | Unchanged — still prints 1,000 |
| **Both** | `assessed = 1200`, `billAllowed` cleared | Reprints as 1,200 |

"Both" is the right answer when a supplementary estimate revised the assessment; "Bill Check only" is right when the surveyor is simply allowing the bill. The dialog states plainly that "Both" changes a report that may already be with the insurer.

Asked once per row, on the first divergent edit. Later adjustments to the same row keep the scope already chosen, so tuning a figure does not re-prompt.

The Final Survey Report never reads `billAllowed`, so it cannot be affected by a bill-check decision — by construction, not by discipline.

---

## Screen: the Bill Check grid

Bill check is an upgrade of the assessment sheet, and the screen should say so. Today it does not.

### The divergence

`BillCheckGrid` ([:128-146](../../src/components/tabs/bill-check/BillCheckGrid.tsx)) and `AssessmentSectionTable` ([:120-152](../../src/components/claim/AssessmentSectionTable.tsx)) render overlapping data under different names:

| Assessment grid | Bill Check grid | Problem |
|---|---|---|
| `Estimate(taxable amount)` → `row.estimated` | `Assessed Tax (₹)` → `row.estimated` | Same field, two names. The Bill Check header says "Assessed" over the estimate, directly beside the real `Assessed (₹)` column |
| `Type` (Metal / Plastic / Glass) | `Section` (Parts / Labour / Paint) | Different data; both are useful |
| `Dep%`, `Net (₹)` — always on | absent | Bill Check cannot show depreciation |
| `Price+GST`, `Disposal`, `Action`, Allowed toggle | absent | |
| — | `Billed Taxable`, `Status` | Bill-only, correct |
| — | `Billed Incl GST (₹)` | Always-on; to be removed |

`Dep%` and `Price+GST` are printed by the bill check PDF, so the surveyor cannot see on screen what will appear on paper — the same defect [2026-08-09-assessment-grid-sections-design.md](2026-08-09-assessment-grid-sections-design.md) was written to fix.

### Approach: align, keep both components

Merging the two into one component with a mode was considered. It would delete roughly 430 lines and make drift impossible, but it rewrites a screen in daily use. **Decision: keep both components and align them**, accepting the higher drift risk for the lower blast radius.

Drift is mitigated structurally rather than by discipline: both grids import **one shared column-config module** — key, label, width and order defined once. Two components may render the columns, but only one file names them. This is the direct fix for how `Estimate(taxable amount)` and `Assessed Tax (₹)` came to describe the same field.

### Target columns

Assessment's column set and order, with the bill columns appended as a block:

```
☐ | Sr | 🛡 | Particulars | [Part No.] | [HSN/SAC] | [Type] | [Qty]
  | [Estimate (taxable amount)] | [GST%] | [Disposal]
  | Assessed | Dep% | Net (₹) | [Price+GST]
  | Billed Taxable | Status
  | [Action] | [Remarks] | ⌫
```

`[…]` = optional, per-grid defaults. The bill block is appended rather than interleaved so the always-on assessment trio (`Assessed`, `Dep%`, `Net`) stays contiguous and the screen reads as *assessment, then bill*.

`Section` becomes optional and defaults off in both grids: both already group rows by section, so the column repeats its own heading.

### Editability

Assessment fields stay **editable** in the Bill Check grid, exactly as in the Assessment grid. This is required by the design: the bill check's money derives from `assessed`, so allowing a figure above assessment means editing `assessed`. The consequence — that this retroactively changes an already-issued Final Survey Report — is documented above and left to the surveyor's judgement, not enforced in code.

---

## Print gate: no bill check on an incomplete bill

A bill check is not issued while the bill is still pending. `pending` is not a state the report should ever have to render — it means the workshop has not given a figure for that item, and the surveyor must say what that means before the document exists.

**On Power Print, if any allowed row is still `pending`**, printing is blocked and a dialog lists those rows, offering to resolve each one:

- **Not in Bill** — the part was not replaced, or was not billed. Sets `billStatus: 'not-in-bill'`, `billedTaxable: 0`; the row prints at zero and carries no liability.
- **Go back and edit** — returns to the grid to enter the billed figure.

Bulk-resolve for the common case where several items are simply absent from the bill.

**Disclaimer before printing.** If rows carry no `billRemarks` where one is expected — any `not-in-bill` row, or any row where billed differs from allowed — a disclaimer is shown before the print proceeds. It does not block: a missing remark is a documentation gap, not a wrong number.

Consequence for the report: `PENDING` cannot reach the PDF, so §8 needs no pending banner. The `PENDING` cell rendering is kept as a cheap fallback only — a blank cell is a worse failure than a labelled one — but no reachable path produces it.

---

## Files touched

**Report**

| File | Change |
|---|---|
| `src/lib/reports/bill-check-projection.ts` | **New** — `projectForBillCheck`, ~10 lines |
| `src/types/assessment.ts` | `billAllowed?: number` on `AssessmentRow` |
| `src/lib/reports/standard-report-builder.ts` | `mode` param; 2 header labels; §8 label; PENDING fallback cell; title; preamble branch |
| `src/lib/reports/final-survey-preamble.ts` | Bill-check preamble variant |
| `src/components/tabs/BillCheckTab.tsx` | Standard \| UIIC toggle; route preview and Power Print through it |
| `src/lib/reports/__tests__/standard-bill-check.test.ts` | **New** |

**Screen**

| File | Change |
|---|---|
| `src/components/claim/grid-columns.ts` | **New** — the shared column config both grids consume |
| `src/components/claim/assessment-grid-config.ts` | Re-point at the shared module |
| `src/components/tabs/bill-check/config.ts` | Re-point at the shared module |
| `src/components/tabs/bill-check/BillCheckGrid.tsx` | Adopt Assessment's column set, labels and order; add `Dep%`, `Net`, `Price+GST`, `Disposal`, `Action`, Allowed toggle; rename `Billed Tax` → `Billed Taxable`; remove `Billed Incl GST` |
| `src/components/claim/AssessmentSectionTable.tsx` | Consume the shared config; `Section` optional, default off |
| `src/components/dialogs/AllowanceScopeDialog.tsx` | **New** — Bill Check only / Both, on a divergent Assessed edit |
| `src/components/dialogs/PendingRowsDialog.tsx` | **New** — resolve `pending` rows before printing |

`buildStandardPrintDocument` ([:665](../../src/lib/reports/standard-report-builder.ts)) and `triggerStandardPrint` ([:678](../../src/lib/reports/standard-report-builder.ts)) take a `mode` passthrough.

The builder grows to roughly 710 lines, within the 800 limit. Extending it rather than writing a parallel builder is deliberate: a copy would drift, which is the exact failure the depreciation table already caused ([:35-39](../../src/lib/reports/standard-report-builder.ts)).

---

## Testing

One vitest file, `standard-bill-check.test.ts`:

1. `projectForBillCheck` moves `billedTaxable` into `estimated`, and uses `billAllowed` for `assessed` when set
2. A `not-in-bill` row projects to `estimated: 0, assessed: 0`
3. **`billAllowed` never reaches the Final Survey Report** — `buildStandardFinalSurveyHTML` over rows carrying `billAllowed: 1200, assessed: 1000` prints 1,000. This is the regression guard for the whole design
4. `allowed: false` rows stay out of the rendered HTML
5. §8 totals over projected rows equal `calculateAssessmentSummary` over the same projected rows — i.e. the summary and the table cannot disagree
6. Projection is immutable: the input array and its rows are unmodified
7. Net liability over projected rows containing one `not-in-bill` row equals net liability over the same rows with that row removed

Plus one grid test, `grid-columns.test.ts`:

8. Every column key rendered by either grid resolves to a label in the shared config — so a column can never again carry two names, which is the defect this alignment exists to fix

---

## Found in passing — not fixed here

**The UIIC Bill Check Report certifies something nobody said.** [uiic-final-builder.ts:752](../../src/lib/reports/uiic-final-builder.ts) prints `Repairs As Per Assessment` as `g(ri?.repairsAsAssessed) || 'YES'`. `repairsAsAssessed` is written only by the Reinspection tab, so on any claim without a reinspection the report tells the insurer **YES** — a certification the surveyor never made. A blank cell would be honest; a defaulted "YES" is a statement of fact in a document an insurer relies on.

Out of scope for this spec, which does not touch the UIIC builder. Worth its own fix.

---

## Risks

- **"Both" still rewrites an issued report.** `billAllowed` removes the *silent* case, not the deliberate one. Choosing "Both" changes a filed document, which is correct when a supplementary estimate exists and wrong otherwise. The dialog states the consequence; it does not verify the supplementary exists.
- **Rows edited before this ships** carry no `billAllowed`, so existing claims behave exactly as today. No migration.
- **`billedTaxable` vs `billedAmount`.** The projection must use `billedTaxable` (pre-GST). Using `billedAmount` would feed a GST-inclusive figure into a column the builder then taxes again — the same class of error that produced a ~31% overstatement in the UIIC builder ([:560-563](../../src/lib/reports/uiic-final-builder.ts)).
- **The two grids can drift again.** Keeping both components is a deliberate trade for a smaller blast radius. The shared config module and test 8 are the structural guards; neither prevents a future column being added to one grid and not the other.
- **Verification limits.** This is an auth-gated screen needing real claim data; correctness will be established by the unit tests above, not by running the dev server.
