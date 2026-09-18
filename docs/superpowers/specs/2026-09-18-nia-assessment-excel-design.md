# NIA Assessment Excel — Design

**Date:** 2026-09-18
**Status:** Approved, awaiting implementation
**Scope:** new `nia-assessment-excel` builder + `NIAExportDialog` + one button on
the Assessment tab. No existing module is modified.

New India's surveyor portal takes the assessment for a non-tieup claim as an
Excel upload rather than typed figures. This builds that file from the claim's
assessment rows, and shows the two painting numbers the portal wants typed
alongside it.

Portal behaviour below comes from reading the portal's own controller
(`surveyorHome.js`, captured 2026-09-18) — see `docs/portal-integration.md` §NIA.

---

## 1. The problem

The surveyor already has every line item in SurveyOS. Today they re-enter it in
SWAR or by hand to produce the portal's `Primary_Assessment_Template`. That is
the whole assessment typed twice.

The portal's import is strict in ways that are easy to trip:

- exactly 11 columns, checked by counting keys on the first row — a blank cell
  on row 1 fails with "Template Format is incorrect"
- `description` overrides the depreciation rate; `hsnCode` overrides the GST
  rate; the columns that look like they carry those numbers mostly don't
- `assessedAmount` is read with a string method, so numeric cells are a risk

Getting the file right once, in code, is the point.

---

## 2. Rules

| # | Rule | Source |
|---|------|--------|
| R1 | `assessedAmount` is **pre-depreciation**. The portal computes `amountAllowed = assessed − assessed × dep%`. | `getDepreciationAmount` |
| R2 | `description` sets the depreciation rate and locks it: 50% / 30% / Cost = 0 / all labour = 0. Only `Parts at Agewise Depreciation` reads the file's `depreciationPercentage`. | `getDepreciationPercent` |
| R3 | `hsnCode` sets the GST rate from the portal's own table. The file's `gstPercentage` is used only if the code is unknown — and an unknown code is blanked, which then fails Validate. So every row carries a code proven to be on the table. | `validateHsnCode`, `checkFields` |
| R4 | HSN by row GST rate: 18% → `8512`, 28% → `8708`, 0% → `72041000`. Motor rows carry no other rate. | Surveyor, confirmed against SWAR |
| R5 | Disposal parts: `Parts at Cost`, `assessedAmount` = the allowed disposal value, GST 0, HSN `72041000`. Used parts carry no depreciation and no GST. | Surveyor |
| R6 | `serviceType` is never read by the portal. Emit SWAR's proven values only: `REPLACE`, `ALLOW`, `NOT ALLOWED`. | 0 comparisons in controller |
| R7 | Paint rows are **not** in the file. Painting is typed separately as estimate + assessed with work details = Consolidated; the portal splits 75/25 and takes 50% dep on material itself. | `getLabourAmountNew`; surveyor |
| R8 | Disallowed rows are included with `assessedAmount` 0, so the insurer sees what was claimed. | SWAR practice |
| R9 | Amount cells are written as **text**. Every cell is non-empty. Sheet is named exactly `Primary_Assessment_Template`. | Import code |
| R10 | The upload happens only after the bill check, so every row has a billed figure. `billedAmount` is `billedTaxable`, with 0 only as a guard. | Surveyor |

---

## 3. Design

### 3.1 `src/lib/reports/nia-assessment-excel.ts`

Two pure functions and one exporter.

```ts
export interface NiaAssessmentRow {
  SlNo: number;
  category: 'Spare Parts' | 'Labor Charges';
  description: NiaDescription;
  partName: string;                 // ≤ 100 chars
  serviceType: 'REPLACE' | 'ALLOW' | 'NOT ALLOWED';
  estimatedAmount: string;          // "1234.56"
  billedAmount: string;
  assessedAmount: string;           // pre-dep; disposal = allowed value
  depreciationPercentage: string;   // "40"
  hsnCode: string;                  // '8512' | '8708' | '72041000'
  gstPercentage: string;
}

export interface NiaPainting { estimate: number; assessed: number }

export function niaAssessmentRows(rows, ageMonths, depType): NiaAssessmentRow[];
export function niaPainting(rows): NiaPainting;
export async function exportNiaAssessmentExcel(claimNo, rows, ageMonths, depType): Promise<void>;
```

**Row selection:** `section === 'parts'` and `section === 'labour'`. Paint rows
are skipped (R7). Both allowed and disallowed rows are emitted (R8).

**Column mapping**

| Column | Value |
|---|---|
| `SlNo` | 1…n in emitted order |
| `category` | parts → `Spare Parts`; labour → `Labor Charges` |
| `description` | disposal → `Parts at Cost`; else by `partType`: metal → `Parts at Agewise Depreciation`, plastic → `Parts at 50% Depreciation`, fiberglass → `Parts at 30% Depreciation`, glass → `Parts at Cost`; labour → `Labor charges for Removing and Refitting` |
| `partName` | `particulars` trimmed, cut at 100 |
| `serviceType` | not allowed → `NOT ALLOWED`; parts → `REPLACE`; labour → `ALLOW` |
| `estimatedAmount` | `estimated` |
| `billedAmount` | `billedTaxable ?? 0` (R10 — the bill always exists by upload time) |
| `assessedAmount` | not allowed → 0; disposal → `computeRowNet().netBeforeGst`; else `assessed` |
| `depreciationPercentage` | disposal → 0; else the row's rate via `depOverride ?? getDepreciationRate(...)` |
| `hsnCode` | disposal → `72041000`; else by `gst`: 28 → `8708`, 0 → `72041000`, 18 → `8512` |
| `gstPercentage` | disposal → 0; else `gst` |

**Painting:** `estimate` = Σ `estimated` over paint rows; `assessed` = Σ
`assessed` over allowed paint rows, pre-dep (R7).

**Number formatting:** every amount is `toFixed(2)` as a string; percentages
are integer strings (R9).

**Exporter:** ExcelJS workbook, one sheet `Primary_Assessment_Template`,
header row in the exact column order above, one row per `NiaAssessmentRow`,
saved via `file-saver` as `<claimNo>_Primary_Assessment_Template.xlsx`. Mirrors
`irdai-summary-builder.ts`.

### 3.2 `src/lib/reports/__tests__/nia-assessment-excel.test.ts`

Fixtures on `niaAssessmentRows` and `niaPainting`:

1. **Metal at 40%** → `Parts at Agewise Depreciation`, `depreciationPercentage: '40'`, `assessedAmount` is the raw pre-dep figure as a string, HSN `8512`
2. **Disposal metal** at 50% disposal → `Parts at Cost`, assessed = net, dep `'0'`, HSN `72041000`, GST `'0'`
3. **Disallowed part** → `NOT ALLOWED`, assessed `'0.00'`, still present
4. **Labour** → `Labor Charges` / `Labor charges for Removing and Refitting` / `ALLOW`, dep `'0'`
5. **28% part** → HSN `8708`
6. **Paint rows excluded** from rows, and summed correctly by `niaPainting`
7. **Header/key order** — `Object.keys(row)` equals the 11 columns in order; every value non-empty

### 3.3 `src/components/dialogs/NIAExportDialog.tsx`

Small. Follows `UIICSummaryDialog`.

- Painting **Estimate** and **Assessed**, large, with tick + copy (paste is not
  blocked on NIA, so copy is useful here)
- Row count being exported
- **Download Excel** button → `exportNiaAssessmentExcel`
- One line reminding: upload → Validate

### 3.4 Button in `AssessmentGrid`

"NIA Excel", beside "UIIC Portal", opens the dialog. Same wiring pattern.

---

## 4. Out of scope

- Supplementary estimate upload (`readExcelSup`) — same format, separate
  upload slot; add when a claim needs it
- Multi-invoice — the file covers one invoice; a claim with 2–3 invoices gets
  one file per invoice later
- The portal's typed fields — quick update, deductions, add-on covers, fee
  bill, declarations. A read-off panel for these is the next spec
- Tie-ups (Maruti, KIA) — no Excel; approve-per-line flow, separate design
- Any automation against the portal
