# Reconciliation Hub — Decisions and Evidence

**Date:** 2026-08-05
**Status:** Approved, ready for implementation plan

## Problem

Two defects reported against the Data Reconciliation Hub.

**1. The conflict count never decreases.** A surveyor resolves all six conflicts, clicks
"Finish Reconciliation", and the banner still reads "6 fields have conflicting values".

**2. No evidence viewer while resolving.** When choosing between two values the surveyor
cannot see the documents they came from, so the choice is made blind.

## Root cause

### The count is mathematically unable to drop

Conflict is defined in `src/lib/ai/reconciliation.ts`:

```ts
const allValues = [currentValue, ...sources.map(s => s.value)];
const uniqueNormalized = new Set(allValues.filter(v => v !== '').map(normalize));
const hasConflict = uniqueNormalized.size > 1;
```

`sources` are the raw values extracted from each document. They are stored in
`claim.extractedData` and never change when the surveyor reconciles. Selecting a value
only updates `currentValue`, which is already a member of that set.

Concrete case from the report: RC reads `1.5CR08EVXW09578`, Policy reads
`1.SCR08EVXW09578` — an OCR misread of `S` as `5`. Those two strings disagree
permanently. Whichever the surveyor picks, the set still contains both, so
`size > 1` holds and the field stays counted.

Consequences:

- `getConflictFields` never shrinks, so the banner in `DocumentsTab` is frozen.
- The "auto-close dialog when all conflicts are resolved" effect at
  `DocumentsTab.tsx:123` is unreachable code.

The missing concept: the system records *whether the documents disagree* but never
*whether the surveyor has decided*.

### The Hub has a second, weaker copy of the evidence panel

Two implementations exist:

| | `InlineEvidencePanel` (`DetailsTab.tsx:42`) | `EvidencePanel` (`ReconciliationDialog.tsx:350`) |
|---|---|---|
| Renders when no file present | Yes — shows a placeholder | No — whole panel is removed |
| Context snippet (verbatim source text) | Yes | No |
| Open in new tab | Yes | No |
| Fallback to first available document | Yes | No |

The Hub wraps its panel in `hasAnyEvidence`, which is false whenever `blobUrls` is
empty. The panel therefore vanishes rather than explaining itself — the reported
symptom.

Evidence files are held in a non-persisted zustand store as `URL.createObjectURL`
links, so they are session-scoped by construction.

**Session-scoped evidence is intended behaviour, not a defect.** A survey is completed
in one sitting; if a document is needed later the surveyor re-uploads it. Documents are
not to be persisted locally or to the cloud. This is a deliberate product decision and
constrains the design below.

## Design

### Part 1 — Record decisions

Add one optional field to `ClaimData`:

```ts
reconciliationDecisions?: Record<string, {
  value: string;        // the value the surveyor chose
  source: string;       // the document it came from: 'rc' | 'policy' | 'dl' | 'claim' | 'fir'
  decidedAt: string;    // ISO timestamp
  sourcesSeen: string;  // fingerprint of the source values at decision time
}>;
```

Keyed by field path, e.g. `vehicle.engineNumber`.

This is small text on the claim record, so it persists and syncs with the claim through
the existing `saveClaim` path. It is unrelated to document files and does not conflict
with the session-only evidence rule.

**`sourcesSeen` handles re-scanning.** It is a normalized fingerprint of the source
values present when the decision was made. On each evaluation the current fingerprint is
recomputed:

- Fingerprint matches → the decision stands; the field stays out of the Hub.
- Fingerprint differs → a document was re-scanned and now reads differently, so the
  decision is stale and the field returns to the conflict list.

This re-asks the surveyor only when the underlying evidence actually changed, without a
separate invalidation mechanism. The fingerprint covers the set of sources as well as
their values, so uploading a new document that introduces a third opinion on a decided
field also reopens it — which is correct, since there is now evidence the surveyor has
not seen.

**Decisions are recorded only by the Hub.** Editing a field directly in Claim Details
does not create or modify a decision record. Two consequences, both intended:

- A conflicted field that was never answered in the Hub keeps appearing there even if
  its value was hand-edited elsewhere. The Hub's question — "which document is right?"
  — has still not been answered.
- A field already decided in the Hub, then later hand-edited, stays out of the Hub. The
  decision record preserves what was chosen at reconciliation time; the claim holds the
  current value. These may differ, and the record is an audit of the reconciliation
  step, not a mirror of the field.

**Changes in `src/lib/ai/reconciliation.ts`:**

- `buildFields` reads `claim.reconciliationDecisions` and computes `isDecided` per field
  (a decision exists AND its `sourcesSeen` matches the current fingerprint).
- `getConflictFields` returns fields where sources disagree AND `!isDecided`.

**Changes in the Hub:**

- Selecting a value records a decision alongside the value write.
- Decided fields are removed from the Hub entirely. There is no "Decided" review
  section — once answered, the question is gone.
- The count drops as fields are decided; at zero the existing auto-close effect fires.

To revise a decision the surveyor edits the field directly in the Claim Details tab. The
Hub will not resurface it.

### Part 2 — Share one evidence panel

A removal, not an addition.

1. Extract `InlineEvidencePanel` from `DetailsTab.tsx` into a shared component under
   `src/components/evidence/`.
2. Consume it from both `DetailsTab` and `ReconciliationDialog`.
3. Delete `EvidencePanel` from `ReconciliationDialog.tsx` and the `hasAnyEvidence` gate.

The Hub inherits the placeholder, "Open in new tab", the first-available-document
fallback, and the context snippet.

The context snippet is the most valuable part for this workflow: when deciding between
`1.5CR08EVXW09578` and `1.SCR08EVXW09578`, the verbatim surrounding text from each
document is what makes the choice possible. Extraction already captures these as
`<field>_context` keys; the Hub currently discards them.

4. Clicking a source button sets the active evidence field so the panel shows that
   document and its context snippet. This requires `ReconciliationField.sources[]` to
   carry the snippet, read from `extractedData[origin][`${aiKey}_context`]`.

**Implementation detail — do not miss this.** `openField()` sets `isOpen: true`, which
renders the full-screen `DocumentEvidenceViewer` overlay on top of the Hub modal
(`z-[120]`). The Hub needs a store action that sets the active field *without* toggling
`isOpen`. Add `setActiveField(claimId, field)` to `useEvidenceStore`, or set state
directly.

The Hub's evidence panel will still be empty after a page refresh. That is correct and
matches Claim Details.

### Part 3 — Bulk actions

- **Remove** the "or accept all from [source]" dropdown. A blanket per-source pick
  contradicts the Hub's purpose: the AI surfaces a discrepancy precisely because it
  cannot judge, so each one warrants a deliberate answer.
- **Keep** "Accept Recommended", gated behind a confirmation showing what it will do
  (`RC: 1 field · Policy: 2 fields · DL: 2 fields`) before applying. Bulk speed without a
  one-click resolve of everything.

Both bulk paths record decisions for every field they touch, same as individual clicks.

## Testing

- Deciding one field drops the count by one; deciding all closes the Hub.
- Decisions survive a reload; decided fields never reappear.
- Re-scan that changes a source value reopens that conflict.
- Re-scan that changes nothing leaves the decision intact.
- The Hub renders the evidence placeholder when no file is loaded, rather than hiding
  the panel.
- Clicking a source shows that document and its context snippet.
- Clicking a source does not open the full-screen overlay on top of the modal.
- "Accept Recommended" requires confirmation and records a decision per field.

## Out of scope

- **Persisting documents** to IndexedDB or the cloud. Session-only evidence is the
  intended product behaviour.
- **A "Decided" review section** in the Hub.
- **Fixing the OCR `S`/`5` misread.** The surveyor still judges that case — the change
  ensures they are asked once rather than indefinitely.

## Files affected

| File | Change |
|---|---|
| `src/types/claim.ts` | Add `reconciliationDecisions` to `ClaimData` and `createBlankClaim` |
| `src/lib/ai/reconciliation.ts` | `isDecided`, fingerprint, filter in `getConflictFields`, carry context snippets on sources |
| `src/stores/slices/aiDataSlice.ts` | Record decisions on reconcile; keep existing path coercion |
| `src/components/evidence/` | New shared `InlineEvidencePanel`; add `setActiveField` |
| `src/components/tabs/DetailsTab.tsx` | Consume the shared panel |
| `src/components/tabs/reconciliation/ReconciliationDialog.tsx` | Use shared panel, delete local one and `hasAnyEvidence`, remove source dropdown, confirm on Accept Recommended |
| `src/components/tabs/DocumentsTab.tsx` | No change expected — count flows from `getConflictFields` |
