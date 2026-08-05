# Reconciliation Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Reconciliation Hub's conflict count drop as the surveyor decides, and give it the evidence viewer Claim Details already has.

**Architecture:** Conflicts are currently derived purely from whether extracted documents disagree, which the surveyor cannot change — so the count is frozen. We add an explicit decision record on the claim, fingerprinted against the source values seen at decision time, and filter decided fields out of the conflict list. Separately, the Hub holds a weaker duplicate of `InlineEvidencePanel`; we extract the good one into a shared component and delete the copy.

**Tech Stack:** Next.js 16, React, TypeScript, Zustand (with a `persist`-less evidence store), Vitest.

## Global Constraints

- **Documents are session-only.** Never persist document files or images to IndexedDB, localStorage, or the cloud. Blob URLs dying on refresh is intended behaviour. Do not "fix" it.
- **Decisions are claim data.** `reconciliationDecisions` is small text stored on `ClaimData` and persists through the existing `saveClaim` path. This does not contradict the constraint above — it stores choices, not files.
- **Decisions are recorded only by the Hub.** Editing a field in Claim Details must not create or modify a decision record.
- **Auto-fill is not a decision.** `getUnanimousFields` auto-fill in `DocumentsTab` must not record decisions — no surveyor judged anything.
- Run tests with `npx vitest run <path>` from `SurveyOS-Prime-V2/`.
- Typecheck with `npx tsc --noEmit` (expect exit 0, no output).
- Existing test suite baseline: **53 files, 340 tests passing.** Never finish a task below this.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/types/claim.ts` | `ReconciliationDecision` type; `reconciliationDecisions` on `ClaimData` | Modify |
| `src/lib/ai/reconciliation.ts` | Fingerprinting, `isDecided`, conflict filtering, context snippets on sources | Modify |
| `src/stores/slices/aiDataSlice.ts` | Record decisions when reconciling | Modify |
| `src/components/evidence/InlineEvidencePanel.tsx` | Shared evidence panel + `DOC_LABELS` | **Create** |
| `src/components/evidence/DocumentEvidenceViewer.tsx` | Add `setActiveField` (sets field without opening overlay) | Modify |
| `src/components/tabs/DetailsTab.tsx` | Consume shared panel; delete local copy | Modify |
| `src/components/tabs/reconciliation/ReconciliationDialog.tsx` | Use shared panel; delete duplicate + `hasAnyEvidence`; record decisions; bulk actions | Modify |
| `src/lib/ai/__tests__/reconciliation.test.ts` | Decision + fingerprint tests | **Create** |

---

### Task 1: Decision data model and conflict filtering

**Files:**
- Modify: `src/types/claim.ts` (add type near `ClaimData`, ~line 28; add default in `createBlankClaim`, ~line 156)
- Modify: `src/lib/ai/reconciliation.ts:3-14` (interface), `:93-131` (`buildFields`), `:134-136` (`getConflictFields`)
- Test: `src/lib/ai/__tests__/reconciliation.test.ts` (create)

**Interfaces:**
- Consumes: `ClaimData`, `createBlankClaim` from `@/types/claim`
- Produces:
  - `interface ReconciliationDecision { value: string; source: string; decidedAt: string; sourcesSeen: string }`
  - `ClaimData.reconciliationDecisions?: Record<string, ReconciliationDecision>`
  - `fingerprintSources(sources: { origin: string; value: string }[]): string`
  - `ReconciliationField` gains `isDecided: boolean` and `sourcesFingerprint: string`
  - `getConflictFields(claim)` now excludes decided fields

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/reconciliation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getConflictFields, fingerprintSources } from '../reconciliation';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types';

/** Engine number disagrees between RC and Policy — an OCR S/5 misread. */
const CONFLICTING = {
  rc: { engine_number: '1.5CR08EVXW09578' },
  policy: { engine_number: '1.SCR08EVXW09578' },
};

function claimWith(
  extractedData: Record<string, Record<string, unknown>>,
  decisions?: ClaimData['reconciliationDecisions'],
): ClaimData {
  return {
    ...createBlankClaim(),
    extractedData,
    reconciliationDecisions: decisions,
  } as ClaimData;
}

describe('getConflictFields — decided fields drop out', () => {
  it('reports the conflict when nothing has been decided', () => {
    const conflicts = getConflictFields(claimWith(CONFLICTING));
    expect(conflicts.map((f) => f.path)).toContain('vehicle.engineNumber');
  });

  it('drops the field once the surveyor has decided it', () => {
    const claim = claimWith(CONFLICTING);
    const field = getConflictFields(claim).find((f) => f.path === 'vehicle.engineNumber')!;

    const decided = claimWith(CONFLICTING, {
      'vehicle.engineNumber': {
        value: '1.5CR08EVXW09578',
        source: 'rc',
        decidedAt: '2026-08-05T10:00:00.000Z',
        sourcesSeen: field.sourcesFingerprint,
      },
    });

    expect(getConflictFields(decided).map((f) => f.path)).not.toContain('vehicle.engineNumber');
  });

  it('reopens the field when a re-scan changes a source value', () => {
    const claim = claimWith(CONFLICTING);
    const field = getConflictFields(claim).find((f) => f.path === 'vehicle.engineNumber')!;

    const decision = {
      'vehicle.engineNumber': {
        value: '1.5CR08EVXW09578',
        source: 'rc',
        decidedAt: '2026-08-05T10:00:00.000Z',
        sourcesSeen: field.sourcesFingerprint,
      },
    };

    // Policy re-scanned; it now reads something different.
    const rescanned = claimWith(
      { rc: CONFLICTING.rc, policy: { engine_number: '1.5CR08EVXW09999' } },
      decision,
    );

    expect(getConflictFields(rescanned).map((f) => f.path)).toContain('vehicle.engineNumber');
  });

  it('reopens the field when a new document adds a third opinion', () => {
    const claim = claimWith(CONFLICTING);
    const field = getConflictFields(claim).find((f) => f.path === 'vehicle.engineNumber')!;

    const withThird = claimWith(
      { ...CONFLICTING, fitness: { engine_number: '1.5CR08EVXW09578' } },
      {
        'vehicle.engineNumber': {
          value: '1.5CR08EVXW09578',
          source: 'rc',
          decidedAt: '2026-08-05T10:00:00.000Z',
          sourcesSeen: field.sourcesFingerprint,
        },
      },
    );

    expect(getConflictFields(withThird).map((f) => f.path)).toContain('vehicle.engineNumber');
  });
});

describe('fingerprintSources', () => {
  it('is stable regardless of source order', () => {
    const a = fingerprintSources([
      { origin: 'rc', value: 'ABC' },
      { origin: 'policy', value: 'XYZ' },
    ]);
    const b = fingerprintSources([
      { origin: 'policy', value: 'XYZ' },
      { origin: 'rc', value: 'ABC' },
    ]);
    expect(a).toBe(b);
  });

  it('ignores formatting differences the matcher already ignores', () => {
    const a = fingerprintSources([{ origin: 'rc', value: 'MH-12-AB-1234' }]);
    const b = fingerprintSources([{ origin: 'rc', value: 'MH12AB1234' }]);
    expect(a).toBe(b);
  });

  it('changes when a value changes', () => {
    const a = fingerprintSources([{ origin: 'rc', value: 'ABC' }]);
    const b = fingerprintSources([{ origin: 'rc', value: 'ABD' }]);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/reconciliation.test.ts`
Expected: FAIL — `fingerprintSources` is not exported, and `sourcesFingerprint` is undefined on the field.

- [ ] **Step 3: Add the decision type to `src/types/claim.ts`**

Add above `export interface ClaimData` (~line 28):

```ts
/**
 * A surveyor's answer to one reconciliation conflict.
 *
 * The Hub exists because the AI found documents that disagree and cannot judge
 * which is right. Recording the answer is what lets a resolved conflict stop
 * being counted — without this, conflicts are derived purely from source
 * disagreement, which the surveyor cannot change, so the count never drops.
 */
export interface ReconciliationDecision {
  /** The value the surveyor chose. */
  value: string;
  /** Document it came from: 'rc' | 'policy' | 'dl' | 'claim' | 'fir' | 'fitness' | … */
  source: string;
  decidedAt: string;
  /**
   * Fingerprint of the source values at decision time. If a document is
   * re-scanned and now reads differently — or a new document adds another
   * opinion — this no longer matches and the field returns to the Hub.
   */
  sourcesSeen: string;
}
```

Add to the `ClaimData` interface body:

```ts
  /** Keyed by field path, e.g. "vehicle.engineNumber". Written only by the Reconciliation Hub. */
  reconciliationDecisions?: Record<string, ReconciliationDecision>;
```

In `createBlankClaim`'s returned object, alongside the other top-level defaults:

```ts
    reconciliationDecisions: {},
```

- [ ] **Step 4: Add fingerprinting and filtering to `src/lib/ai/reconciliation.ts`**

Extend the `ReconciliationField` interface (replace lines 3-14):

```ts
export interface ReconciliationField {
  id: string;
  label: string;
  path: string;
  current: string;
  sources: {
    origin: string;
    value: string;
    label: string;
  }[];
  hasConflict: boolean;
  /** True when a decision exists AND its fingerprint still matches these sources. */
  isDecided: boolean;
  /** Fingerprint of this field's current sources — store on the decision. */
  sourcesFingerprint: string;
}
```

Add after the `normalize` function (~line 91):

```ts
/**
 * Stable fingerprint of a field's sources — which documents spoke, and what
 * each said. Sorted so ordering cannot change it, and normalized so formatting
 * differences the conflict matcher already ignores do not falsely reopen a
 * decision.
 */
export function fingerprintSources(sources: { origin: string; value: string }[]): string {
  return sources
    .map((s) => `${s.origin}=${normalize(s.value)}`)
    .sort()
    .join('|');
}
```

In `buildFields`, read the decisions map at the top (after the `extractedStore` line):

```ts
  const decisions = claim.reconciliationDecisions ?? {};
```

Replace the `result.push({...})` block at the end of the loop:

```ts
    const sourcesFingerprint = fingerprintSources(sources);
    const decision = decisions[mapping.path];
    const isDecided = !!decision && decision.sourcesSeen === sourcesFingerprint;

    result.push({
      id: mapping.path,
      label: mapping.label,
      path: mapping.path,
      current: currentValue,
      sources,
      hasConflict,
      isDecided,
      sourcesFingerprint,
    });
```

Replace `getConflictFields`:

```ts
/** Fields where extracted sources genuinely disagree and the surveyor has not yet decided. */
export function getConflictFields(claim: ClaimData): ReconciliationField[] {
  return buildFields(claim).filter((f) => f.hasConflict && !f.isDecided);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/ai/__tests__/reconciliation.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Verify nothing regressed**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0 with no output; **54 files, 347 tests passing**.

- [ ] **Step 7: Commit**

```bash
git add src/types/claim.ts src/lib/ai/reconciliation.ts src/lib/ai/__tests__/reconciliation.test.ts
git commit -m "feat(reconciliation): record surveyor decisions so conflicts can resolve"
```

---

### Task 2: Record decisions when reconciling

**Files:**
- Modify: `src/lib/ai/reconciliation.ts` (add `buildDecision` export)
- Modify: `src/stores/slices/aiDataSlice.ts:5-12` (interface), `:598-616` (`batchReconcile`), `:654-673` (`reconcileField`)
- Test: `src/stores/slices/__tests__/aiDataSlice.test.ts` (append)

**Interfaces:**
- Consumes: `fingerprintSources`, `ReconciliationField` from Task 1
- Produces:
  - `buildDecision(claim: ClaimData, path: string, value: string, source: string): ReconciliationDecision`
  - `reconcileField(path: string, value: string, source?: string)` — records a decision only when `source` is given
  - `batchReconcile(updates: { path: string; value: string; source?: string }[])` — same rule per update

- [ ] **Step 1: Write the failing test**

Append to `src/stores/slices/__tests__/aiDataSlice.test.ts`:

```ts
import { buildDecision, getConflictFields } from '@/lib/ai/reconciliation';
import { createBlankClaim } from '@/types/claim';

describe('buildDecision', () => {
  const claim = {
    ...createBlankClaim(),
    extractedData: {
      rc: { engine_number: 'ABC123' },
      policy: { engine_number: 'ABC124' },
    },
  } as ClaimData;

  it('captures the choice, its source, and the sources seen', () => {
    const d = buildDecision(claim, 'vehicle.engineNumber', 'ABC123', 'rc');

    expect(d.value).toBe('ABC123');
    expect(d.source).toBe('rc');
    expect(d.sourcesSeen).toContain('rc=abc123');
    expect(d.sourcesSeen).toContain('policy=abc124');
    expect(Date.parse(d.decidedAt)).not.toBeNaN();
  });

  it('produces a fingerprint that matches the field it came from', () => {
    const d = buildDecision(claim, 'vehicle.engineNumber', 'ABC123', 'rc');
    const decided = { ...claim, reconciliationDecisions: { 'vehicle.engineNumber': d } };

    // The whole point: a decision built this way removes the field from the Hub.
    expect(getConflictFields(decided).map((f) => f.path))
      .not.toContain('vehicle.engineNumber');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/slices/__tests__/aiDataSlice.test.ts`
Expected: FAIL — `buildDecision` is not exported from `@/lib/ai/reconciliation`.

- [ ] **Step 3: Add `buildDecision` to `src/lib/ai/reconciliation.ts`**

Append to the file:

```ts
/**
 * Builds the decision record for one reconciliation choice.
 *
 * The fingerprint must come from the same buildFields pass the Hub is showing,
 * otherwise a decision could be stored against sources that were never on
 * screen and would immediately look stale.
 */
export function buildDecision(
  claim: ClaimData,
  path: string,
  value: string,
  source: string,
): ReconciliationDecision {
  const field = buildFields(claim).find((f) => f.path === path);
  return {
    value,
    source,
    decidedAt: new Date().toISOString(),
    sourcesSeen: field?.sourcesFingerprint ?? '',
  };
}
```

Add `ReconciliationDecision` to the existing type import at the top of the file:

```ts
import { ClaimData, ReconciliationDecision } from '@/types';
```

`src/types/index.ts` does `export * from './claim'`, so the type added in Task 1 is
already re-exported. No barrel change needed.

- [ ] **Step 4: Record decisions in `src/stores/slices/aiDataSlice.ts`**

Import at the top:

```ts
import { buildDecision } from '@/lib/ai/reconciliation';
```

Update the interface (lines 9-10):

```ts
  reconcileField: (path: string, value: string, source?: string) => void;
  batchReconcile: (updates: { path: string; value: string; source?: string }[]) => void;
```

Replace the `batchReconcile` body:

```ts
  batchReconcile: (updates) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      let newClaim = state.currentClaim;
      const decisions = { ...(newClaim.reconciliationDecisions ?? {}) };

      for (const { path, value, source } of updates) {
        // Fingerprint against the claim as it was BEFORE this batch, so every
        // decision in one "Accept Recommended" click sees the same sources.
        if (source) decisions[path] = buildDecision(state.currentClaim, path, value, source);
        newClaim = setClaimPath(newClaim, path, value);
      }

      return {
        currentClaim: {
          ...newClaim,
          reconciliationDecisions: decisions,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },
```

Replace the `reconcileField` body:

```ts
  reconcileField: (path, value, source) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const newClaim = setClaimPath(state.currentClaim, path, value);

      // `source` is omitted by auto-fill (getUnanimousFields), which is not a
      // surveyor decision and must not be recorded as one.
      const reconciliationDecisions = source
        ? {
            ...(state.currentClaim.reconciliationDecisions ?? {}),
            [path]: buildDecision(state.currentClaim, path, value, source),
          }
        : state.currentClaim.reconciliationDecisions;

      return {
        currentClaim: {
          ...newClaim,
          reconciliationDecisions,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/stores/slices/__tests__/aiDataSlice.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify nothing regressed**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass (**54 files, 349 tests**).

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/reconciliation.ts src/stores/slices/aiDataSlice.ts src/stores/slices/__tests__/aiDataSlice.test.ts
git commit -m "feat(reconciliation): persist decisions on reconcile, skip auto-fill"
```

---

### Task 3: Hub passes the source origin so the count drops

**Files:**
- Modify: `src/components/tabs/reconciliation/ReconciliationDialog.tsx:175-183` (conflict rows), `:213-219` (auto-filled rows), `:255-309` (`FieldRow`), `:311-348` (`AutoFilledRow`)

**Interfaces:**
- Consumes: `reconcileField(path, value, source)` from Task 2
- Produces: no new exports — behavioural change only

- [ ] **Step 1: Widen `FieldRow`'s callback to carry the origin**

In `FieldRow`, change the prop type:

```ts
  onSelect: (val: string, origin: string) => void;
```

and the button handler:

```ts
              onClick={() => {
                onSelect(source.value, source.origin);
                onEvidenceClick(source.origin);
              }}
```

- [ ] **Step 2: Do the same for `AutoFilledRow`**

Change the prop type:

```ts
  onOverride: (val: string, origin: string) => void;
```

and the handler:

```ts
            onClick={() => {
              onOverride(source.value, source.origin);
              onEvidenceClick(source.origin);
            }}
```

- [ ] **Step 3: Pass the origin through at both call sites**

Conflict rows (~line 179):

```tsx
                      onSelect={(val, origin) => reconcileField(field.path, val, origin)}
```

Auto-filled rows (~line 217):

```tsx
                          onOverride={(val, origin) => reconcileField(field.path, val, origin)}
```

- [ ] **Step 4: Verify the count now drops in the running app**

Run: `npx tsc --noEmit`
Expected: exit 0.

Then start the preview and confirm by hand:

1. Open a claim with at least two conflicting scanned documents.
2. Note the banner count (e.g. "6 fields have conflicting values").
3. Click one value in the Hub.
4. **Expected:** the row disappears and the count reads 5.
5. Resolve all of them.
6. **Expected:** the Hub closes by itself and the banner is gone.
7. Reload the page and reopen the claim.
8. **Expected:** the decided fields do not come back.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/reconciliation/ReconciliationDialog.tsx
git commit -m "feat(reconciliation): record which document each choice came from"
```

---

### Task 4: Carry context snippets on sources

**Files:**
- Modify: `src/lib/ai/reconciliation.ts:3-14` (interface), `:101-110` (source collection)
- Test: `src/lib/ai/__tests__/reconciliation.test.ts` (append)

**Interfaces:**
- Produces: `ReconciliationField.sources[].contextSnippet: string`

Extraction already returns a `<field>_context` key holding the verbatim text each value was read from (see `CONTEXT_INSTRUCTION` in `src/lib/ai/prompts.ts`). The Hub currently throws it away. It is exactly what makes an OCR conflict decidable.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/ai/__tests__/reconciliation.test.ts`:

```ts
describe('source context snippets', () => {
  it('carries the verbatim text each value was read from', () => {
    const claim = claimWith({
      rc: {
        engine_number: '1.5CR08EVXW09578',
        engine_number_context: 'Engine No: 1.5CR08EVXW09578 Chassis No: MAT4',
      },
      policy: { engine_number: '1.SCR08EVXW09578' },
    });

    const field = getConflictFields(claim).find((f) => f.path === 'vehicle.engineNumber')!;
    const rc = field.sources.find((s) => s.origin === 'rc')!;
    const policy = field.sources.find((s) => s.origin === 'policy')!;

    expect(rc.contextSnippet).toBe('Engine No: 1.5CR08EVXW09578 Chassis No: MAT4');
    expect(policy.contextSnippet).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/reconciliation.test.ts`
Expected: FAIL — `contextSnippet` does not exist on the source type.

- [ ] **Step 3: Add the field to the interface**

In `ReconciliationField`, extend the `sources` element type:

```ts
  sources: {
    origin: string;
    value: string;
    label: string;
    /** Verbatim document text this value was read from; '' when the model returned none. */
    contextSnippet: string;
  }[];
```

- [ ] **Step 4: Populate it in `buildFields`**

Replace the `sources.push({...})` block:

```ts
      if (docData?.[aiKey]) {
        const snippet = docData[`${aiKey}_context`];
        sources.push({
          origin: docKey,
          label: docKey.toUpperCase(),
          value: String(docData[aiKey]),
          contextSnippet: snippet ? String(snippet) : '',
        });
      }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/ai/__tests__/reconciliation.test.ts && npx tsc --noEmit`
Expected: PASS; tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/reconciliation.ts src/lib/ai/__tests__/reconciliation.test.ts
git commit -m "feat(reconciliation): expose extraction context snippets on sources"
```

---

### Task 5: Extract the shared evidence panel

**Files:**
- Create: `src/components/evidence/InlineEvidencePanel.tsx`
- Modify: `src/components/evidence/DocumentEvidenceViewer.tsx:34-47` (state interface), `:49-56` (store)
- Modify: `src/components/tabs/DetailsTab.tsx:24-130` (delete local copy), `:17` and `:21` (imports)

**Interfaces:**
- Produces:
  - `InlineEvidencePanel({ claimId }: { claimId: string })` from `@/components/evidence/InlineEvidencePanel`
  - `DOC_LABELS: Record<string, string>` from the same module
  - `useEvidenceStore().setActiveField(claimId: string, field: EvidenceField): void` — sets the active field **without** setting `isOpen`

`openField` sets `isOpen: true`, which renders the full-screen `DocumentEvidenceViewer` on top of the Hub modal (`z-[120]`). The Hub needs to change the panel's document without triggering that overlay.

- [ ] **Step 1: Add `setActiveField` to the evidence store**

In `src/components/evidence/DocumentEvidenceViewer.tsx`, add to the `EvidenceState` interface after `openField`:

```ts
  /**
   * Set the active field WITHOUT opening the full-screen viewer. Used by hosts
   * that already render their own inline panel — the Reconciliation Hub is a
   * modal, and openField's `isOpen: true` would stack the overlay on top of it.
   */
  setActiveField: (claimId: string, field: EvidenceField) => void;
```

and to the store body after `openField`:

```ts
  setActiveField: (claimId, field) => set({ field, claimId }),
```

- [ ] **Step 2: Create the shared component**

Create `src/components/evidence/InlineEvidencePanel.tsx` with the component moved verbatim from `DetailsTab.tsx:24-130`:

```tsx
'use client';

import { FileSearch, ChevronRight } from 'lucide-react';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';

// ─── Inline Evidence Panel ────────────────────────────────────────────────────
// Uses blob URLs stored in the evidence store — no PNG conversion needed.
// Blob URLs are session-only by design: they die on refresh, and the panel
// shows a placeholder rather than hiding. Do not add persistence.

export const DOC_LABELS: Record<string, string> = {
  rc: 'Registration Certificate',
  policy: 'Insurance Policy',
  dl: 'Driving Licence',
  estimate: 'Repair Estimate',
  'final-bill': 'Final Bill',
  permit: 'Permit',
  fitness: 'Fitness Certificate',
  fir: 'FIR / Panchnama',
  claim: 'Claim Form',
  auth: 'Authorisation',
  'lok-challan': 'Lok Challan',
  photos: 'Damage Photos',
};

export function InlineEvidencePanel({ claimId }: { claimId: string }) {
  const { field, blobUrls } = useEvidenceStore();

  // Determine which document to show: active field's doc or first available
  let effectiveDocType = field?.docType;
  if (!effectiveDocType) {
    for (const type of ['rc', 'policy', 'dl', 'estimate']) {
      if (blobUrls[`${claimId}_${type}`]) {
        effectiveDocType = type;
        break;
      }
    }
  }

  const docLabel = effectiveDocType ? (DOC_LABELS[effectiveDocType] ?? effectiveDocType.toUpperCase()) : '';
  const blobEntry = effectiveDocType ? blobUrls[`${claimId}_${effectiveDocType}`]?.[0] : undefined;
  const isPdf = blobEntry?.mimeType === 'application/pdf';

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-border bg-[var(--color-neutral-50)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-[var(--color-neutral-50)] border-b border-border">
        <div className="flex items-center gap-2">
          <FileSearch size={16} className="text-primary" />
          <div>
            <div className="text-xs font-medium text-foreground">Evidence Viewer</div>
            {docLabel && <div className="text-[10px] text-primary mt-0.5">{docLabel}</div>}
          </div>
        </div>
        {blobEntry && (
          <a
            href={blobEntry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary underline hover:opacity-80"
          >
            Open in new tab
          </a>
        )}
      </div>

      {/* Context snippet */}
      {field?.contextSnippet && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg shrink-0 bg-[var(--color-status-warning-tint)] border border-[var(--color-status-warning)]/30">
          <div className="text-[10px] font-medium tracking-wide text-[var(--color-status-warning)] mb-1">Extracted from document</div>
          <div className="text-[11px] leading-relaxed font-mono text-[var(--color-neutral-900)]">{field.contextSnippet}</div>
        </div>
      )}

      {/* Document viewer */}
      <div className={`flex-1 overflow-hidden ${blobEntry ? '' : 'p-3'}`}>
        {blobEntry ? (
          isPdf ? (
            <iframe
              src={blobEntry.url}
              className="w-full h-full border-none block"
              title={docLabel}
            />
          ) : (
            <div className="h-full overflow-auto p-3">
              <img
                src={blobEntry.url}
                alt={`${docLabel} source document`}
                className="w-full block rounded-md shadow-lg"
              />
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-center text-[var(--color-neutral-400)] p-5">
            <div>
              <FileSearch size={36} className="opacity-30 mb-3 mx-auto" />
              <p className="text-xs m-0">
                {field
                  ? 'Upload the document to view it here.'
                  : 'Scan a document (RC / Policy / DL)\nto see the source here.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border shrink-0 flex items-center gap-1.5">
        <ChevronRight size={12} className="text-[var(--color-neutral-400)]" />
        <span className="text-[10px] text-[var(--color-neutral-400)]">Upload a document above to populate this panel</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Delete the copy in `DetailsTab.tsx` and import the shared one**

Delete lines 24-130 (the `DOC_LABELS` const and the whole `InlineEvidencePanel` function). Add to the imports:

```ts
import { InlineEvidencePanel } from '@/components/evidence/InlineEvidencePanel';
```

Leave the `useEvidenceStore` import — `DetailsTab` still uses it elsewhere (line 43 of the old panel is gone, but other call sites remain). If `tsc` reports `FileSearch` or `ChevronRight` as unused in `DetailsTab.tsx:17`, remove only the ones it names.

- [ ] **Step 4: Verify Claim Details is unchanged**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass.

Then in the preview: open a claim, upload an RC, click a field with an eye icon.
**Expected:** the evidence panel behaves exactly as before — document renders, context snippet shows, "Open in new tab" works.

- [ ] **Step 5: Commit**

```bash
git add src/components/evidence/InlineEvidencePanel.tsx src/components/evidence/DocumentEvidenceViewer.tsx src/components/tabs/DetailsTab.tsx
git commit -m "refactor(evidence): extract InlineEvidencePanel for reuse"
```

---

### Task 6: Hub uses the shared panel

**Files:**
- Modify: `src/components/tabs/reconciliation/ReconciliationDialog.tsx:1-8` (imports), `:28-41` (state), `:228-234` (panel slot), `:350-404` (delete local `EvidencePanel`), `FieldRow`/`AutoFilledRow` evidence handlers

**Interfaces:**
- Consumes: `InlineEvidencePanel` (Task 5), `setActiveField` (Task 5), `sources[].contextSnippet` (Task 4)

- [ ] **Step 1: Replace the imports**

```ts
import { useClaimStore } from '@/stores/claim-store';
import { ReconciliationField, getBestSourceValue } from '@/lib/ai/reconciliation';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { InlineEvidencePanel } from '@/components/evidence/InlineEvidencePanel';
```

- [ ] **Step 2: Delete the `hasAnyEvidence` gate**

Remove these lines (~28-36):

```ts
  const blobUrls = useEvidenceStore((state) => state.blobUrls);
  const hasAnyEvidence = useMemo(
    () =>
      conflictFields.some(f => f.sources.some(s => !!blobUrls[`${claimId}_${s.origin}`])) ||
      autoFilledFields.some(f => f.sources.some(s => !!blobUrls[`${claimId}_${s.origin}`])),
    [conflictFields, autoFilledFields, claimId, blobUrls]
  );
```

Replace `activeOrigin` state with the store action:

```ts
  const setActiveField = useEvidenceStore((state) => state.setActiveField);
  const [activeOrigin, setActiveOrigin] = useState<string | null>(null);
```

(`activeOrigin` is kept only to highlight the selected button.)

- [ ] **Step 3: Always render the shared panel**

Replace the conditional block (~228-234):

```tsx
          {/* RIGHT: evidence panel — always shown; it renders its own placeholder
              when no document is loaded. Session-only by design. */}
          <div className="w-[480px] flex-shrink-0 border-l border-border flex flex-col overflow-hidden p-3">
            <InlineEvidencePanel claimId={claimId} />
          </div>
```

- [ ] **Step 4: Show the clicked source's document and snippet**

Add a shared handler inside `ReconciliationDialog`:

```ts
  const showEvidence = (field: ReconciliationField, origin: string) => {
    const source = field.sources.find((s) => s.origin === origin);
    setActiveOrigin(origin);
    // setActiveField, not openField: openField sets isOpen and would stack the
    // full-screen viewer on top of this modal.
    setActiveField(claimId, {
      docType: origin,
      fieldKey: field.path,
      contextSnippet: source?.contextSnippet ?? '',
    });
  };
```

Change both row components' `onEvidenceClick` props to `(origin: string) => void` and pass:

```tsx
                      onEvidenceClick={(origin) => showEvidence(field, origin)}
```

for conflict rows, and the same for auto-filled rows.

- [ ] **Step 5: Delete the duplicate `EvidencePanel`**

Remove the entire `function EvidencePanel({ claimId, activeOrigin })` block (~350-404) and drop `Upload` from the `lucide-react` import if `tsc` reports it unused.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass.

In the preview:
1. Open a claim with conflicts, **without** uploading anything this session.
   **Expected:** the panel is visible showing "Scan a document…", not missing.
2. Upload an RC and a Policy, reopen the Hub, click the RC value on a conflict.
   **Expected:** the RC document renders and the yellow "Extracted from document" snippet shows the text that value came from.
3. Click the POLICY value on the same row.
   **Expected:** the panel switches to the Policy document and its snippet.
4. Confirm no full-screen overlay appears on top of the modal at any point.

- [ ] **Step 7: Commit**

```bash
git add src/components/tabs/reconciliation/ReconciliationDialog.tsx
git commit -m "feat(reconciliation): show evidence and context snippets in the Hub"
```

---

### Task 7: Bulk actions

**Files:**
- Modify: `src/components/tabs/reconciliation/ReconciliationDialog.tsx:76-92` (handlers), `:124-159` (bulk bar)

**Interfaces:**
- Consumes: `batchReconcile` with `source` (Task 2)

- [ ] **Step 1: Remove "accept all from source"**

Delete the `handleAcceptFromSource` function and the `availableSources` memo, plus the `<select>` block in the bulk bar (~138-157). A blanket per-source pick contradicts the Hub's purpose: the AI surfaces a discrepancy because it cannot judge, so each one warrants its own answer.

- [ ] **Step 2: Add a confirmation state**

```ts
  const [confirmingRecommended, setConfirmingRecommended] = useState(false);
```

Reset it alongside the existing close effect:

```ts
  useEffect(() => {
    if (!isOpen) {
      setActiveOrigin(null);
      setConfirmingRecommended(false);
    }
  }, [isOpen]);
```

- [ ] **Step 3: Record decisions and require a second click**

```ts
  const handleAcceptRecommended = () => {
    if (recommendedActions.length === 0) return;
    if (!confirmingRecommended) {
      setConfirmingRecommended(true);
      return;
    }
    batchReconcile(
      recommendedActions.map((a) => ({ path: a.path, value: a.value, source: a.source })),
    );
    setConfirmingRecommended(false);
    setActiveOrigin(null);
  };
```

- [ ] **Step 4: Reflect the pending state in the button**

Replace the button's label content:

```tsx
                  <Zap size={13} />
                  {confirmingRecommended ? 'Confirm — apply to all' : 'Accept Recommended'}
                  {recommendedSummary && (
                    <span className="font-normal opacity-80 ml-1">({recommendedSummary})</span>
                  )}
```

and add a cancel affordance beside it:

```tsx
                {confirmingRecommended && (
                  <button
                    onClick={() => setConfirmingRecommended(false)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                )}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass.

In the preview:
1. Confirm the "or accept all from…" dropdown is gone.
2. Click "Accept Recommended" once. **Expected:** it becomes "Confirm — apply to all" with a Cancel beside it; nothing has changed yet.
3. Click Cancel. **Expected:** returns to normal, no fields changed.
4. Click it twice. **Expected:** all conflicts resolve, the count hits 0, the Hub closes.
5. Reload. **Expected:** none of the resolved conflicts return.

- [ ] **Step 6: Commit**

```bash
git add src/components/tabs/reconciliation/ReconciliationDialog.tsx
git commit -m "feat(reconciliation): confirm bulk accept, drop per-source bulk pick"
```

---

## Final verification

- [ ] Run `npx tsc --noEmit` — exit 0, no output
- [ ] Run `npx vitest run` — all pass, no fewer than **54 files / 350 tests**
- [ ] Manual pass on a real claim: two conflicting documents → decide each → count drops to 0 → Hub closes → reload → conflicts stay resolved
- [ ] Confirm the evidence panel appears in the Hub even with no documents loaded this session
