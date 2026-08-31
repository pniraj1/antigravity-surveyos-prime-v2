# UIIC Portal Summary Panel — Design

**Date:** 2026-08-31
**Status:** Approved, awaiting implementation
**Scope:** new `uiic-portal-summary` calculation + `UIICSummaryDialog`. No existing
module is modified.

A surveyor who has finished a claim in SurveyOS still has to key the assessment
into United India's surveyor portal by hand. This panel computes the exact
figures that portal asks for, in its own wording and order, so the surveyor
reads them off instead of recomputing them.

The reference point is SWAR, a competing surveyor package, whose "Report
Verification → Assessment Summary" window does the same job. Matching it is the
goal of this spec.

---

## 1. The problem

### 1.1 The portal wants numbers our report does not print

The portal's assessment section takes parts split into four depreciation
classes, a GST table by rate, and a single labour figure. Our Final Survey
Report prints per-material totals and a GST summary, but neither is in the
portal's shape:

- the report's material totals are **after** depreciation; the portal's four
  boxes want the amount **before** it
- the report has no notion of "parts at 50% depreciation" as a heading — it has
  `plasticTotal`, which happens to cover the same rows
- disposal parts are spread across materials in the report; the portal wants
  them collected in one box

So the surveyor re-derives all of it mentally, on every claim.

### 1.2 Copy-paste does not rescue it

45 of the portal's inputs carry `onpaste="return false;"`, including every money
field in the assessment section. Whatever we produce gets **typed**. That shapes
the UI: a value the surveyor can read at a glance and tick off matters more than
a copy button.

---

## 2. Rules

Confirmed with a practising surveyor on 2026-08-31. Sources are the portal's own
markup (captured DOM — see `docs/uiic-portal-integration.md`) and the surveyor's
answers where the markup is ambiguous.

| # | Rule | Source |
|---|------|--------|
| R1 | The four parts boxes take the **full amount before depreciation**, excluding GST. The portal depreciates and shows the result in a readonly "Depreciated Amount" twin. | Portal help text: "User should enter full amount for all parts. The system will calculate depreciated amount automatically." |
| R2 | **Disposal parts go into the Nil Depreciation box**, at their allowed value, with **GST 0**. Their value is already depreciated, or not to be depreciated, so it must not pass through the portal's depreciation again. | Surveyor |
| R3 | GST table amounts are the **net assessed after depreciation**, grouped by rate. | Surveyor |
| R4 | Labour and paint combine into one figure: `labour + (paint − paintDep)`. | Surveyor, matches SWAR |
| R5 | On a Nil Depreciation policy the whole parts amount goes into the Nil Depreciation box, not split across the other three. | Surveyor |
| R6 | Round to the rupee. A ±1–2 difference against the report is tolerated; the surveyor absorbs it in excess or salvage. | Surveyor |
| R7 | Labour carries no depreciation — a surveyor who wants to allow less reduces the assessed amount directly. Paint depreciation is real and is shown separately. | Surveyor |

### 2.1 The asymmetry, stated plainly

R1 and R3 together mean **the parts boxes are pre-depreciation while the GST
table is post-depreciation.** This looks like a bug and is not. It must carry a
comment in the code, or someone will "fix" it.

---

## 3. Design

Three new files. Nothing existing is touched, so no report output can regress.

### 3.1 `src/lib/calculations/uiic-portal-summary.ts`

A pure function — no React, no formatting, no I/O.

```ts
export interface UiicGstSlab { rate: number; amount: number }

export interface UiicPortalSummary {
  parts: {
    ageBasedDep: number;   // portal: ageBasedDep — metal, pre-dep
    dep50: number;         // portal: dep50       — plastic/rubber/tyres, pre-dep
    dep30: number;         // portal: dep30       — fibreglass, pre-dep
    nilDep: number;        // portal: nilDep      — glass pre-dep + all disposal
  };
  partsGst: UiicGstSlab[];   // portal: gst28AmountP … gst0AmountP
  labour: {
    labour: number;
    paint: number;
    lessPaintDep: number;
    totalLabour: number;     // portal: labourCharge
  };
  labourGst: UiicGstSlab[];  // portal: gst18AmountL, gst0AmountL
  tieOut: { bucketTotal: number; reportTotal: number; delta: number };
}

export function uiicPortalSummary(
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType
): UiicPortalSummary;
```

**Bucket assignment**, in order — first match wins:

1. `depType === 'nil'` → every allowed parts row lands in `nilDep` (R5)
2. row is disposal **and** `section === 'parts'` → `nilDep`, at
   `computeRowNet().netBeforeGst`, which already includes the disposal
   percentage (R2)
3. otherwise by `partType`: `metal → ageBasedDep`, `plastic → dep50`,
   `fiberglass → dep30`, `glass → nilDep`, at raw `row.assessed` (R1)

Rows with `allowed === false` are excluded throughout.

Disposal rows in the labour or paint sections stay in labour. They are not parts
and must not reach `nilDep`.

**GST tables** reuse `aggregateGst` from `gst-bands.ts`, which already:

- computes the taxable base as the net after depreciation (R3)
- puts disposal rows in a 0% band with the disposal factor applied (R2)

It bands by `hsnSac|rate`; the portal wants one row per rate, so the selector
re-groups the bands by `rate` alone. Parts rows and labour+paint rows are
aggregated separately, matching the portal's `*P` / `*L` field split.

**Labour** (R4, R7):

- `labour` = allowed rows with `section === 'labour'`, at their net
- `paint` = allowed rows with `section === 'paint'`, at raw `assessed`
- `lessPaintDep` = `paint − paintNet`
- `totalLabour` = `labour + paintNet`

**Rounding** (R6): every output is rounded to the rupee on the way out.
`tieOut` reports the rounded bucket total against the report's own parts total,
so the surveyor sees the delta rather than discovering it later.

### 3.2 `src/lib/calculations/__tests__/uiic-portal-summary.test.ts`

Three fixtures:

1. **All-disposal** — mirrors a real claim where every part was allowed on a
   disposal basis. Everything lands in `nilDep`; the whole GST table is one 0%
   band.
2. **Mixed, with metal depreciation** — a metal part at ₹10,000 carrying 40%
   depreciation. Asserts `ageBasedDep === 10000` **and** the 18% GST band
   `=== 6000`. This is the test that fails if someone "corrects" the pre/post
   asymmetry in §2.1.
3. **Nil depreciation policy** — all parts collapse into `nilDep`.

### 3.3 `src/components/dialogs/UIICSummaryDialog.tsx`

Follows the existing `IRDAISummaryDialog` pattern.

- Section headings and field wording taken from the portal verbatim: "Vehicle
  Age Based Depreciation (Excluding GST)", "Parts at 50% Depreciation (All
  rubber nylon/ plastic parts, tyres and tubes, batteries and air bags)", and so
  on
- Values large and monospaced — they are read while typing into another window
- A tick per row so the surveyor keeps their place down a long form
- Copy button present but secondary, per §1.2
- **Source toggle: Assessment | Bill Check**, matching SWAR, reusing the
  existing bill-check projection
- Tie-out delta shown at the foot

---

## 4. Out of scope

Deliberately excluded:

- The rest of the portal's fields — `quickUpdate` (17), `documentVerified` (18
  radio pairs), salvage, excesses, towing, add-on covers. The panel matches
  SWAR; these get added when asked for.
- The portal's Assessment Excel import. Researched and halted — see
  `docs/uiic-portal-integration.md` §4.
- Any automation against the portal: no autofill, no RPA, no stored credentials.
- OIC and NIA. Their field shapes are unseen; abstracting for them now would be
  guessing.
