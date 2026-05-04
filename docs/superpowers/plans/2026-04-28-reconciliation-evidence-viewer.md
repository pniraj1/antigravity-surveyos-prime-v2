# Reconciliation Evidence Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the source document alongside conflict values in the reconciliation hub so surveyors can verify which value is correct without leaving the modal.

**Architecture:** Widen the reconciliation modal and split it into a left conflict panel and a right evidence panel. Clicking a source value (RC, Policy, DL, etc.) selects it and loads its document in the right panel. The right panel reads blob URLs from the existing `useEvidenceStore` — no new storage needed. If no documents have been uploaded, the right panel is hidden.

**Tech Stack:** React, Zustand (`useEvidenceStore`), Tailwind CSS, existing `ReconciliationDialog.tsx` + `DocumentsTab.tsx`

---

## File Map

| File | Change |
|------|--------|
| `src/components/tabs/reconciliation/ReconciliationDialog.tsx` | Add `claimId` prop, `activeOrigin` state, `EvidencePanel` component, flex-row layout, widen modal, update `FieldRow` + `AutoFilledRow` |
| `src/components/tabs/DocumentsTab.tsx` | Pass `claimId={currentClaim.id}` to `ReconciliationDialog` |

---

## Task 1: Add `claimId` prop and `activeOrigin` state to ReconciliationDialog

**Files:**
- Modify: `src/components/tabs/reconciliation/ReconciliationDialog.tsx`

- [ ] **Step 1: Update imports**

Add to the top of `ReconciliationDialog.tsx` — add `useEvidenceStore` import and missing icons:

```typescript
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { Sparkles, Check, AlertTriangle, Info, ChevronDown, ChevronUp, Zap, FileSearch, Upload } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';
```

- [ ] **Step 2: Add `claimId` to props interface**

```typescript
interface ReconciliationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflictFields: ReconciliationField[];
  autoFilledFields: ReconciliationField[];
  claimId: string;
}
```

Update the destructure:

```typescript
export function ReconciliationDialog({
  isOpen,
  onClose,
  conflictFields,
  autoFilledFields,
  claimId,
}: ReconciliationDialogProps) {
```

- [ ] **Step 3: Add `activeOrigin` state and evidence availability check**

Inside the component, after the existing `useState` calls:

```typescript
const [activeOrigin, setActiveOrigin] = useState<string | null>(null);

const blobUrls = useEvidenceStore((state) => state.blobUrls);
const hasAnyEvidence = useMemo(
  () => conflictFields.some(f => f.sources.some(s => !!blobUrls[`${claimId}_${s.origin}`])),
  [conflictFields, claimId, blobUrls]
);

// Reset active doc when modal closes
useEffect(() => {
  if (!isOpen) setActiveOrigin(null);
}, [isOpen]);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/reconciliation/ReconciliationDialog.tsx
git commit -m "feat: add claimId prop and activeOrigin state to ReconciliationDialog"
```

---

## Task 2: Add `EvidencePanel` component

**Files:**
- Modify: `src/components/tabs/reconciliation/ReconciliationDialog.tsx` (append at bottom of file)

- [ ] **Step 1: Add `EvidencePanel` at bottom of file**

Append after the `AutoFilledRow` function:

```typescript
function EvidencePanel({ claimId, activeOrigin }: { claimId: string; activeOrigin: string | null }) {
  const blobUrls = useEvidenceStore((state) => state.blobUrls);

  if (!activeOrigin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-6 bg-muted/10">
        <FileSearch size={32} className="text-muted-foreground/25" />
        <p className="text-xs text-muted-foreground/60 font-medium">
          Click any value to view its source document
        </p>
      </div>
    );
  }

  const entry = blobUrls[`${claimId}_${activeOrigin}`];

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-6 bg-muted/10">
        <Upload size={28} className="text-muted-foreground/25" />
        <p className="text-xs font-bold text-muted-foreground">{activeOrigin.toUpperCase()} not uploaded</p>
        <p className="text-[10px] text-muted-foreground/50">Upload in Documents tab to view evidence</p>
      </div>
    );
  }

  const isPdf = entry.mimeType === 'application/pdf';

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2 flex-shrink-0">
        <FileSearch size={13} className="text-primary" />
        <span className="text-xs font-bold text-foreground">{activeOrigin.toUpperCase()}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">Source document</span>
      </div>
      <div className="flex-1 overflow-hidden">
        {isPdf ? (
          <iframe
            src={entry.url}
            className="w-full h-full border-0"
            title={`${activeOrigin} document`}
          />
        ) : (
          <div className="w-full h-full overflow-auto p-3 flex items-start justify-center bg-zinc-50">
            <img
              src={entry.url}
              alt={`${activeOrigin} document`}
              className="max-w-full rounded-lg shadow-md"
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "C:\Users\Manasi\OneDrive\Desktop\Antigravity Surveyor V6 fixed\SurveyOS-Prime-V2"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tabs/reconciliation/ReconciliationDialog.tsx
git commit -m "feat: add EvidencePanel component to ReconciliationDialog"
```

---

## Task 3: Update FieldRow and AutoFilledRow to trigger evidence on click

**Files:**
- Modify: `src/components/tabs/reconciliation/ReconciliationDialog.tsx`

- [ ] **Step 1: Update `FieldRow` signature and click handler**

Replace the existing `FieldRow` function with:

```typescript
function FieldRow({
  field,
  onSelect,
  onEvidenceClick,
  activeOrigin,
}: {
  field: ReconciliationField;
  onSelect: (val: string) => void;
  onEvidenceClick: (origin: string) => void;
  activeOrigin: string | null;
}) {
  return (
    <div className="grid grid-cols-[1.5fr,1.5fr,3fr] gap-4 px-6 py-4 items-center transition-colors hover:bg-zinc-50/50 bg-orange-50/20">
      <div className="flex flex-col">
        <span className="text-xs font-bold text-foreground">{field.label}</span>
        <span className="text-[9px] font-extrabold text-orange-600 uppercase flex items-center gap-0.5 mt-0.5">
          <AlertTriangle size={10} /> Discrepancy Found
        </span>
      </div>

      <div className="text-sm font-medium text-muted-foreground truncate italic">
        {field.current || <span className="opacity-30">Not Set</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {field.sources.map((source, i) => {
          const isSelected = field.current === source.value;
          const isActiveEvidence = !isSelected && activeOrigin === source.origin;
          return (
            <button
              key={`${source.origin}-${i}`}
              onClick={() => {
                onSelect(source.value);
                onEvidenceClick(source.origin);
              }}
              className={`
                group flex flex-col items-start px-3 py-1.5 rounded-xl border text-left transition-all max-w-[180px]
                ${isSelected
                  ? 'bg-primary border-primary text-primary-foreground shadow-md scale-105 z-10'
                  : isActiveEvidence
                  ? 'bg-primary/5 border-primary/50 text-foreground ring-2 ring-primary/20'
                  : 'bg-white border-border text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-95'}
              `}
            >
              <span className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${isSelected ? 'text-primary-foreground/70' : 'text-primary'}`}>
                {source.label}
              </span>
              <span className="text-xs font-bold truncate w-full">{source.value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `AutoFilledRow` signature and click handler**

Replace the existing `AutoFilledRow` function with:

```typescript
function AutoFilledRow({
  field,
  onOverride,
  onEvidenceClick,
}: {
  field: ReconciliationField;
  onOverride: (val: string) => void;
  onEvidenceClick: (origin: string) => void;
}) {
  const filledValue = field.sources[0]?.value ?? '';

  return (
    <div className="grid grid-cols-[1.5fr,1.5fr,3fr] gap-4 px-6 py-3 items-center">
      <span className="text-xs font-semibold text-green-800">{field.label}</span>

      <div className="flex items-center gap-1.5">
        <Check size={11} className="text-green-500 flex-shrink-0" />
        <span className="text-xs font-bold text-green-800 truncate">{filledValue}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {field.sources.map((source, i) => (
          <button
            key={`${source.origin}-${i}`}
            onClick={() => {
              onOverride(source.value);
              onEvidenceClick(source.origin);
            }}
            className="flex flex-col items-start px-2.5 py-1 rounded-lg border border-green-200 bg-white text-left hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-95 max-w-[160px]"
          >
            <span className="text-[8px] font-bold uppercase tracking-wider text-green-600 mb-0.5">{source.label}</span>
            <span className="text-xs font-bold truncate w-full text-foreground">{source.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tabs/reconciliation/ReconciliationDialog.tsx
git commit -m "feat: wire onEvidenceClick into FieldRow and AutoFilledRow"
```

---

## Task 4: Split modal layout and mount EvidencePanel

**Files:**
- Modify: `src/components/tabs/reconciliation/ReconciliationDialog.tsx`

- [ ] **Step 1: Update `FieldRow` and `AutoFilledRow` call sites**

Inside `ReconciliationDialog`, find all `<FieldRow ... />` calls and add the two new props:

```typescript
{conflictFields.map(field => (
  <FieldRow
    key={field.id}
    field={field}
    onSelect={val => reconcileField(field.path, val)}
    onEvidenceClick={setActiveOrigin}
    activeOrigin={activeOrigin}
  />
))}
```

Find all `<AutoFilledRow ... />` calls and add `onEvidenceClick`:

```typescript
{autoFilledFields.map(field => (
  <AutoFilledRow
    key={field.id}
    field={field}
    onOverride={val => reconcileField(field.path, val)}
    onEvidenceClick={setActiveOrigin}
  />
))}
```

- [ ] **Step 2: Widen modal and apply flex-row layout**

Replace the outer `<Card>` className:

```typescript
// BEFORE
<Card className="w-full max-w-4xl shadow-2xl border-primary/20 overflow-hidden flex flex-col max-h-[90vh] bg-white">

// AFTER
<Card className="w-full max-w-7xl shadow-2xl border-primary/20 overflow-hidden flex flex-col max-h-[90vh] bg-white">
```

Replace the `<CardContent>` section with a flex-row wrapper. The full structure inside `<Card>` should be:

```tsx
<CardHeader className="bg-primary/5 border-b border-primary/10 py-6 flex-shrink-0">
  {/* unchanged header content */}
</CardHeader>

{/* NEW: flex-row body */}
<div className="flex flex-row flex-1 overflow-hidden min-h-0">
  {/* LEFT: existing CardContent */}
  <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
    {/* Bulk accept bar */}
    {totalConflicts > 0 && (
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-orange-50/60 border-b border-orange-100 flex-shrink-0">
        {/* unchanged bulk accept content */}
      </div>
    )}

    {/* Column headers */}
    {totalConflicts > 0 && (
      <div className="grid grid-cols-[1.5fr,1.5fr,3fr] gap-4 px-6 py-4 bg-muted/30 border-b text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex-shrink-0">
        <div>Field Name</div>
        <div>Current Value</div>
        <div>Scanned Data (Click to Select)</div>
      </div>
    )}

    {/* Scrollable rows */}
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      {totalConflicts > 0 ? (
        <div className="divide-y divide-border/50">
          {conflictFields.map(field => (
            <FieldRow
              key={field.id}
              field={field}
              onSelect={val => reconcileField(field.path, val)}
              onEvidenceClick={setActiveOrigin}
              activeOrigin={activeOrigin}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <Check size={36} className="text-green-500" />
          <p className="text-sm font-bold text-green-700">All conflicts resolved</p>
          <p className="text-xs text-muted-foreground">Review auto-filled fields below if needed.</p>
        </div>
      )}

      {/* Auto-filled section */}
      {autoFilledFields.length > 0 && (
        <div className="border-t border-border">
          <button
            onClick={() => setIsAutoFilledExpanded(v => !v)}
            className="w-full flex items-center justify-between px-6 py-3 bg-green-50/50 hover:bg-green-50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Zap size={13} className="text-green-600" />
              <span className="text-xs font-bold text-green-800">
                Auto-filled from documents ({autoFilledFields.length} field{autoFilledFields.length !== 1 ? 's' : ''})
              </span>
            </div>
            {showAutoFilledExpanded
              ? <ChevronUp size={14} className="text-green-600" />
              : <ChevronDown size={14} className="text-green-600" />}
          </button>

          {showAutoFilledExpanded && (
            <div className="divide-y divide-border/30 bg-green-50/20">
              {autoFilledFields.map(field => (
                <AutoFilledRow
                  key={field.id}
                  field={field}
                  onOverride={val => reconcileField(field.path, val)}
                  onEvidenceClick={setActiveOrigin}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  </div>

  {/* RIGHT: evidence panel (only if any doc uploaded) */}
  {hasAnyEvidence && (
    <div className="w-[480px] flex-shrink-0 border-l border-border flex flex-col overflow-hidden">
      <EvidencePanel claimId={claimId} activeOrigin={activeOrigin} />
    </div>
  )}
</div>

<CardFooter className="flex justify-between items-center gap-3 bg-muted/30 p-6 border-t border-border flex-shrink-0">
  {/* unchanged footer */}
</CardFooter>
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd "C:\Users\Manasi\OneDrive\Desktop\Antigravity Surveyor V6 fixed\SurveyOS-Prime-V2"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/reconciliation/ReconciliationDialog.tsx
git commit -m "feat: split reconciliation modal into conflict list + evidence panel"
```

---

## Task 5: Pass `claimId` from DocumentsTab

**Files:**
- Modify: `src/components/tabs/DocumentsTab.tsx`

- [ ] **Step 1: Update `ReconciliationDialog` usage**

Find the `<ReconciliationDialog ... />` render in `DocumentsTab.tsx` and add `claimId`:

```tsx
<ReconciliationDialog
  isOpen={isReconOpen}
  onClose={() => setIsReconOpen(false)}
  conflictFields={conflicts}
  autoFilledFields={autoFilledFields}
  claimId={currentClaim.id}
/>
```

Note: `currentClaim` is already guaranteed non-null at this point (`if (!currentClaim) return null` guard exists above).

- [ ] **Step 2: Final type check + build**

```bash
cd "C:\Users\Manasi\OneDrive\Desktop\Antigravity Surveyor V6 fixed\SurveyOS-Prime-V2"
npx tsc --noEmit && npm run build
```

Expected: no errors, clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/tabs/DocumentsTab.tsx
git commit -m "feat: pass claimId to ReconciliationDialog for evidence viewer"
```

---

## Verification Checklist

1. Upload RC + Policy docs → open reconciliation hub → right panel appears
2. Click RC value → right panel shows RC document
3. Click Policy value → right panel switches to Policy document
4. Clicked source gets ring highlight (if not yet selected)
5. Selected source gets primary filled style as before
6. Open hub with no docs uploaded → modal stays narrow (no right panel)
7. Hub with docs uploaded but click not yet made → "Click any value to view its source document" empty state
8. Click origin with uploaded doc but no blob URL (e.g., doc uploaded after page load in another session) → "X not uploaded" empty state
9. PDF doc → iframe render, image doc → img render
10. Close + reopen modal → evidence panel resets to empty state
