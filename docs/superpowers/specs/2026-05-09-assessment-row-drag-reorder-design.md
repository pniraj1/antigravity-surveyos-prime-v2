# Assessment Row Drag-to-Reorder Design Spec
**Date:** 2026-05-09  
**Status:** Approved  

---

## 1. Problem

When a surveyor uploads an estimate (e.g. 80 rows pulled from a workshop bill), the "Add Part Row" and "Add Labour Row" buttons always append to the end of the grid. If the surveyor needs to add a part near row 56, they must add it at row 80 then manually find it. There is no way to reorder rows.

---

## 2. Solution

Add a drag handle to every row in the Assessment Grid. The surveyor grabs the handle and drags the row to the desired position. On drop, the store reorders the array. `srNo` (the original estimate serial number) is preserved and remains manually editable — it is not auto-renumbered on drag.

---

## 3. Scope

**In scope:**
- Drag-to-reorder rows in the Assessment Grid (`AssessmentGrid.tsx`)
- New `reorderAssessmentRows` store action
- `srNo` remains editable via the existing inline cell editor

**Out of scope:**
- Drag reorder for Spot Damage rows (separate grid, separate feature)
- Auto-renumbering `srNo` on reorder
- PDF output changes (array order already drives PDF sequence — no change needed)

---

## 4. Dependencies

Add to `package.json`:
```
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
```

These three packages are the standard dnd-kit split. No other new dependencies.

---

## 5. Store Change

**File:** `src/stores/slices/assessmentSlice.ts`

Add to `AssessmentSlice` interface:
```ts
reorderAssessmentRows: (orderedIds: string[]) => void;
```

Implementation:
```ts
reorderAssessmentRows: (orderedIds) => {
  set((state: WithClaim) => {
    if (!state.currentClaim) return {};
    const rowMap = new Map(state.currentClaim.assessmentRows.map((r) => [r.id, r]));
    const reordered = orderedIds.map((id) => rowMap.get(id)).filter(Boolean) as AssessmentRow[];
    return {
      currentClaim: {
        ...state.currentClaim,
        assessmentRows: reordered,
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    };
  });
},
```

---

## 6. UI Change — AssessmentGrid

**File:** `src/components/claim/AssessmentGrid.tsx`

### 6.1 Drag Handle Column

A new column is prepended before the existing Sr. No. column. It is narrow (~32px), non-resizable, and contains a `GripVertical` icon (Lucide) in muted color.

- `cursor: grab` at rest, `cursor: grabbing` while dragging
- The column header is empty (no label)
- The handle is the only interactive element in the column — clicking it does not select the row

### 6.2 DnD Wiring

```
<DndContext
  sensors={sensors}           // PointerSensor + KeyboardSensor
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={rowIds}             // string[] of row IDs in current order
    strategy={verticalListSortingStrategy}
  >
    {/* table rows */}
  </SortableContext>
</DndContext>
```

Each `<tr>` uses `useSortable(row.id)` to get:
- `attributes` + `listeners` → spread onto the drag handle `<td>`
- `transform` + `transition` → applied as inline style on the `<tr>`
- `isDragging` → sets the row to `opacity: 0.4` while being dragged

### 6.3 handleDragEnd

```ts
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIndex = rowIds.indexOf(active.id as string);
  const newIndex = rowIds.indexOf(over.id as string);
  reorderAssessmentRows(arrayMove(rowIds, oldIndex, newIndex));
}
```

### 6.4 Drop Indicator

Standard dnd-kit behavior: the dragged row lifts and becomes semi-transparent (`opacity: 0.4`). A blue insertion line is shown at the drop target via the `DragOverlay` pattern (optional enhancement — not required for MVP).

### 6.5 Column Count

The existing `totalCols` calculation (line ~225) increments by 1 to account for the new handle column.

---

## 7. srNo Editability

`srNo` is already editable via `updateAssessmentRow` in the existing grid. No changes needed. After a drag, the surveyor can click the Sr. No. cell and type a new number if desired.

---

## 8. Accessibility

- `KeyboardSensor` is included in the sensor list — allows reorder via keyboard (Space to grab, arrow keys to move, Space/Enter to drop)
- The drag handle has `aria-label="Drag to reorder row"`
- `sortableKeyboardCoordinates` from `@dnd-kit/sortable` provides the keyboard coordinate strategy

---

## 9. Files Changed

| File | Change |
|---|---|
| `package.json` | Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| `src/stores/slices/assessmentSlice.ts` | Add `reorderAssessmentRows` action + interface entry |
| `src/components/claim/AssessmentGrid.tsx` | Add drag handle column, DnD context, `handleDragEnd`, update `totalCols` |

No other files are modified.
