# Reconciliation Hub — Evidence Viewer

**Date:** 2026-04-28
**Status:** Approved

## Problem

Surveyors must choose between conflicting values (e.g. RC shows "MH02AB1234", Policy shows "MH02CD9999") without seeing the source document. They have to remember what each doc said, or switch tabs to verify. This slows decisions and causes errors.

## Solution

Split the reconciliation modal into two panels. Left: existing conflict list. Right: document viewer. Clicking any source value selects it AND loads that document in the right panel simultaneously.

---

## Layout

Modal expands from `max-w-4xl` → `max-w-[90vw] max-w-7xl`. Layout changes from `flex-col` to `flex-row`.

```
┌──────────────────────────────────┬────────────────────────┐
│  LEFT PANEL (flex-1, min-w-0)    │  RIGHT PANEL (480px)   │
│                                  │                        │
│  [Bulk accept bar]               │  PDF iframe            │
│  [Column headers]                │  — or —               │
│  [Conflict field rows]           │  Image                 │
│  [Auto-filled section]           │  — or —               │
│                                  │  Empty state           │
└──────────────────────────────────┴────────────────────────┘
```

**Conditional render:** Right panel only mounts if at least one blob URL exists for any conflict source origin. If no documents were uploaded, modal stays single-column (no dead space).

---

## Interaction

Clicking a source value button does two things atomically:
1. Selects the value (existing behaviour — calls `reconcileField`)
2. Loads that source's document in the right panel

Active source button gets a secondary ring highlight (in addition to existing selected-value highlight) showing which doc is currently displayed in the panel.

---

## Evidence Panel Component

New component: `EvidencePanel` inside `ReconciliationDialog.tsx`.

**Props:**
```typescript
interface EvidencePanelProps {
  claimId: string;
  activeOrigin: string | null;
}
```

**Rendering:**
- Reads `useEvidenceStore().blobUrls[`${claimId}_${activeOrigin}`]`
- `mimeType === 'application/pdf'` → `<iframe src={url} />`
- `mimeType.startsWith('image/')` → `<img src={url} />`
- No blob URL for origin → grey empty state: `"[ORIGIN] not uploaded"` with upload icon
- `activeOrigin === null` → neutral empty state: `"Click a value to view its source document"`

---

## State

```typescript
// Inside ReconciliationDialog
const [activeOrigin, setActiveOrigin] = useState<string | null>(null);
```

`EvidencePanel` reads blob URL directly from `useEvidenceStore` using `activeOrigin`. Resets to `null` on modal close (`isOpen` → false).

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/tabs/reconciliation/ReconciliationDialog.tsx` | Add `claimId` prop, `activeEvidence` state, `EvidencePanel`, widen modal, `flex-row` layout, pass `onEvidenceClick` to `FieldRow` |
| `src/components/tabs/DocumentsTab.tsx` | Pass `claimId={currentClaim.id}` to `ReconciliationDialog` |

No new files. No store changes. Reuses `useEvidenceStore` directly.

---

## Data Flow

```
User clicks source button (e.g. "RC: MH02AB1234")
  → reconcileField(field.path, value)         // select value
  → setActiveOrigin('rc')                      // load doc
  → EvidencePanel reads blobUrls['claimId_rc']
  → renders PDF iframe or image
```

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Doc not uploaded | Empty state: "RC not uploaded" |
| No docs uploaded at all | Right panel hidden, modal stays narrow |
| Auto-filled row clicked | Shows doc in right panel (no value change since already set) |
| Modal closes | `activeEvidence` resets to null |
| PDF too large | iframe handles natively (scroll/zoom) |
