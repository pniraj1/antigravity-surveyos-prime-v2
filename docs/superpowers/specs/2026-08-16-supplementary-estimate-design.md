# Supplementary Estimates — Design

**Date:** 2026-08-16
**Status:** Awaiting review
**Scope:** Assessment tab estimate upload, AI review dialog, `applyEstimate`, `AssessmentRow.source`

Follows on from *Bill Check as a Verification Layer* (2026-08-05), which listed
"uploading a supplementary estimate into the Final Report" as the next task.

---

## 1. The problem

Uploading a second estimate **silently deletes the first one's rows.**

[aiDataSlice.ts:681](../../../src/stores/slices/aiDataSlice.ts):

```ts
assessmentRows: [...claim.assessmentRows.filter((r) => r.source !== 'estimate'), ...newRows],
```

The comment above it reads "Re-applying an estimate (re-scan/re-upload returns
the FULL document again) replaces previous AI-created rows". That assumption
holds for a **re-scan** of the same document and fails for a **supplementary
estimate**, which is a different document containing only the additional items.

A surveyor who uploads a supplementary loses every line item from the original
estimate. Manually added rows survive, because they carry no `source` tag.

This was found while debugging a Bill Check crash on a claim whose surveyor had
uploaded a supplementary estimate. The crash itself was a separate defect
(fixed in `ef7927fe`); this is the bug the surveyor's account pointed at.

---

## 2. Decisions taken during brainstorming

| # | Decision |
|---|---|
| D1 | The software **asks** rather than infers. No document-hash or estimate-number heuristic decides whether an upload is a re-scan or a supplementary. |
| D2 | The question is asked **only when ambiguous** — i.e. only when the claim already holds estimate-tagged rows. A first upload asks nothing. |
| D3 | The question lives in the **existing AI review dialog**, not a new button and not a pre-upload prompt. Every extraction already pauses there for confirmation. |
| D4 | Asking **after** extraction means the dialog can show real row counts and totals for both sides, so the surveyor decides on numbers rather than on memory. |
| D5 | **No duplicate detection.** A surveyor who uploads the same document twice deletes the surplus rows manually. Explicitly chosen over a warning dialog. |
| D6 | Mode is a **parameter**, not a button identity, so a third mode later is one more branch rather than another button and another extraction key. |
| D7 | `srNo` is left alone. It is the workshop's own number from the paper document, editable, and shown only in the Assessment grid — reports and Bill Check renumber by position. Duplicate `srNo` values across two documents are correct. |

**Out of scope:** duplicate detection, per-upload batch ids, merging line items
across documents, any change to the extraction prompt or schema.

---

## 3. Why the review dialog is the right seam

Extraction already runs through a confirm gate. Nothing is applied without the
surveyor clicking through it:

```
triggerExtraction(key, file)
  └─ extractDocument(...)
       └─ finishJob(key, { key, data, file })     ← becomes reviewData
            └─ AIReviewDialog (surveyor confirms)
                 └─ confirmApply()
                      └─ applyExtractedData(key, data)
                           └─ applyEstimate(claim, data)   ← aiDataSlice.ts:746
```

[useAIExtraction.ts:216](../../../src/hooks/useAIExtraction.ts) is the whole of
`confirmApply`. Adding the choice here means:

- no new button on the Assessment tab
- no new extraction key
- **no AI-layer change at all** — the `estimate` prompt already covers "repair
  estimates, proforma invoices, and workshop bills"
  ([prompts.ts:121](../../../src/lib/ai/prompts.ts)), and a supplementary is
  structurally identical
- the choice is made with the extracted rows in hand, so both sides can be
  quantified

---

## 4. Data model

One field widens, in [assessment.ts:88](../../../src/types/assessment.ts):

```ts
/**
 * Row origin.
 *   undefined       = added by hand by the surveyor. Never touched by an upload.
 *   'estimate'      = created from the primary estimate. Replaced when that
 *                     estimate is re-scanned.
 *   'supplementary' = created from a supplementary estimate. Only ever appended;
 *                     re-scanning the primary estimate leaves these alone.
 */
source?: 'estimate' | 'supplementary';
```

This is safe to widen: `source` has exactly **one** consumer in the codebase,
the filter at `aiDataSlice.ts:681`. Nothing in the reports, the grid, the
calculations, or Bill Check reads it.

---

## 5. Apply logic

`applyEstimate` gains a mode rather than growing a near-duplicate twin:

```ts
export type EstimateApplyMode = 'replace' | 'append';

export function applyEstimate(
  claim: ClaimData,
  data: any,
  mode: EstimateApplyMode = 'replace',
): ClaimData
```

| Mode | Existing rows | New rows tagged | Used for |
|---|---|---|---|
| `replace` | drops rows tagged `'estimate'`; keeps `'supplementary'` and manual | `'estimate'` | first upload, re-scan of the primary |
| `append` | drops nothing | `'supplementary'` | supplementary estimate |

The default is `'replace'`, so the existing behaviour and the existing test at
[aiDataSlice.test.ts:39](../../../src/stores/slices/__tests__/aiDataSlice.test.ts)
("re-applying replaces previous AI rows but keeps manual rows") both stand
unchanged. That test staying green is the signal that primary behaviour has not
moved.

Note `replace` deliberately spares `'supplementary'` rows. Re-scanning a badly
extracted primary estimate must not discard a supplementary the surveyor has
already reviewed.

---

## 6. Routing the mode

`applyExtractedData` gains an optional third parameter, defaulting so that every
existing call site is untouched:

```ts
applyExtractedData(key: string, data: any, mode?: EstimateApplyMode)
```

At [aiDataSlice.ts:746](../../../src/stores/slices/aiDataSlice.ts):

```ts
else if (key === 'estimate') newClaim = applyEstimate(newClaim, data, mode ?? 'replace');
```

`confirmApply` in `useAIExtraction` takes the mode from the dialog and passes it
through. Keys other than `estimate` ignore it.

---

## 7. UI

**When the dialog asks.** Only when both hold:

1. the extraction key is `estimate`, and
2. the claim already contains at least one row tagged `'estimate'` or
   `'supplementary'`

Otherwise the dialog keeps its single confirm button and today's behaviour.

**What it shows.** Both sides quantified, so the decision is made on numbers:

> **This claim already has an estimate.**
> Currently on the assessment sheet: **12 rows, ₹1,42,300**
> In this document: **5 rows, ₹34,500**
>
> [ Add as supplementary ]  [ Replace the existing estimate ]  [ Cancel ]

Both totals are sums of `estimated`, formatted with the existing `fmt` helper.
The claim-side figure counts **every row on the sheet** — manual rows included —
because that is what the surveyor sees in the grid and what "already has" means
to them; counting only tagged rows would print a total that matches nothing on
screen. The document-side figure counts the rows this extraction produced.

**Button order and emphasis.** "Add as supplementary" is the primary action and
sits first: it is the non-destructive choice, and on the evidence of this bug it
is also the more common intent. "Replace" is styled as the destructive action.
Cancel dismisses without applying, leaving the extracted data in the review
store exactly as Cancel does today.

---

## 8. Error handling

- **No claim loaded** — unreachable; the dialog only renders inside a loaded claim.
- **Extraction returned zero rows** — the mode question is pointless, so it is
  skipped and the existing single-confirm path runs, matching today's behaviour
  for an empty extraction.
- **Cancel** — nothing is applied and nothing is tagged. Unchanged from today.
- **Malformed rows in the incoming document** — out of scope here and already
  handled: `createAssessmentRow` drops undefined overrides and `loadClaim`
  repairs persisted rows, both landed in `ef7927fe`.

---

## 9. Testing

Unit, against `applyEstimate` directly:

1. `append` adds rows without removing existing `'estimate'` rows
2. `append` tags its new rows `'supplementary'`
3. `replace` drops `'estimate'` rows but **keeps** `'supplementary'` rows
4. `replace` still keeps manual rows — the existing test, unchanged
5. default mode is `'replace'` when the argument is omitted
6. two successive `append` calls accumulate, confirming D5 (no dedupe)

Component, against the dialog:

7. no mode question on a claim with no estimate rows
8. mode question appears when estimate rows exist
9. each button routes the matching mode into `applyExtractedData`

---

## 10. What this does not do

Per D5, a surveyor who uploads the same supplementary twice gets duplicate rows
with no warning, and the assessment total silently inflates. The surveyor is the
only check on that. This is a deliberate trade, taken on the grounds that
correction is already a manual delete in this workflow; revisit it if it bites
in practice, most cheaply as a row count in the success toast.
