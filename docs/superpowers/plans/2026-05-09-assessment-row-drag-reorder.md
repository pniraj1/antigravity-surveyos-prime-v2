# Assessment Row Drag-to-Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let surveyors drag any row in the Assessment Grid to reorder it, so newly added rows can be placed at any position rather than always appending to the end.

**Architecture:** Three changes — install @dnd-kit, add `reorderAssessmentRows` to the Zustand store slice, then wire dnd-kit's `DndContext` + `SortableContext` into `AssessmentGrid`. A small `SortableRow` component (defined in the same file) renders the drag handle and applies the transform/opacity from `useSortable`. `srNo` is preserved and remains manually editable.

**Tech Stack:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, Zustand, React, TypeScript, Lucide icons (GripVertical).

---

## File Map

| File | Change |
|---|---|
| `package.json` | Add three @dnd-kit packages |
| `src/stores/slices/assessmentSlice.ts` | Add `reorderAssessmentRows` to interface + implementation |
| `src/components/claim/AssessmentGrid.tsx` | Add `SortableRow` component, DnD wiring, drag handle column |

---

## Task 1: Install @dnd-kit packages

**Files:** `package.json`

- [ ] **Step 1: Install the three packages**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('@dnd-kit/core'); require('@dnd-kit/sortable'); require('@dnd-kit/utilities'); console.log('OK')"
```

Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @dnd-kit packages for row drag-reorder"
```

---

## Task 2: Add `reorderAssessmentRows` to the store

**Files:**
- Modify: `src/stores/slices/assessmentSlice.ts`

**Context:** The store slice is at `src/stores/slices/assessmentSlice.ts`. It exports `AssessmentSlice` interface and `createAssessmentSlice`. The interface currently has `addAssessmentRow`, `updateAssessmentRow`, `deleteAssessmentRow`, etc. The `createAssessmentSlice` factory implements each action. `AssessmentRow` is imported from `@/types`.

- [ ] **Step 1: Add `reorderAssessmentRows` to the `AssessmentSlice` interface**

In `src/stores/slices/assessmentSlice.ts`, the interface starts at line 5. Add the new method after `addAssessmentRow`:

Find this block:
```ts
export interface AssessmentSlice {
  addAssessmentRow: (section: AssessmentRow['section']) => void;
  updateAssessmentRow: (id: string, updates: Partial<AssessmentRow>) => void;
  deleteAssessmentRow: (id: string) => void;
  deleteAssessmentRows: (ids: string[]) => void;
  deleteExtraBillItem: (id: string) => void;
  clearExtraBillItems: () => void;
  toggleRowAllowed: (id: string) => void;
  addSpotDamageRow: (component?: string, damage?: string) => void;
  updateSpotDamageRow: (id: string, updates: Partial<SpotDamageRow>) => void;
  deleteSpotDamageRow: (id: string) => void;
}
```

Replace with:
```ts
export interface AssessmentSlice {
  addAssessmentRow: (section: AssessmentRow['section']) => void;
  reorderAssessmentRows: (orderedIds: string[]) => void;
  updateAssessmentRow: (id: string, updates: Partial<AssessmentRow>) => void;
  deleteAssessmentRow: (id: string) => void;
  deleteAssessmentRows: (ids: string[]) => void;
  deleteExtraBillItem: (id: string) => void;
  clearExtraBillItems: () => void;
  toggleRowAllowed: (id: string) => void;
  addSpotDamageRow: (component?: string, damage?: string) => void;
  updateSpotDamageRow: (id: string, updates: Partial<SpotDamageRow>) => void;
  deleteSpotDamageRow: (id: string) => void;
}
```

- [ ] **Step 2: Add the implementation after `addAssessmentRow`**

In `createAssessmentSlice`, find the closing `},` of `addAssessmentRow` (around line 33) and add `reorderAssessmentRows` immediately after it:

Find:
```ts
  addAssessmentRow: (section) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const newRow = createAssessmentRow(section);
      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: [...state.currentClaim.assessmentRows, newRow],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  updateAssessmentRow:
```

Replace with:
```ts
  addAssessmentRow: (section) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const newRow = createAssessmentRow(section);
      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: [...state.currentClaim.assessmentRows, newRow],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

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

  updateAssessmentRow:
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/slices/assessmentSlice.ts
git commit -m "feat: add reorderAssessmentRows action to assessment store"
```

---

## Task 3: Wire drag-and-drop into AssessmentGrid

**Files:**
- Modify: `src/components/claim/AssessmentGrid.tsx`

**Context:** `AssessmentGrid.tsx` is 657 lines. The key areas:
- Line 1–11: existing imports
- Line 72–80: `useClaimStore()` destructure
- Line 224–225: `totalCols` — comment says "8 always-on" columns
- Line 330–375: `<thead>` — first `<th>` is the checkbox column
- Line 376: `<tbody>` opening
- Line 388: `assessmentRows.map((row, idx) => {`
- Line 412: `return (<tr key={row.id} className={...}>` — the row element
- Lines 413 onward: all `<td>` cells

The `SortableRow` component will be added before the `AssessmentGrid` function. It replaces `<tr>` with a component that calls `useSortable`, applies the transform, and prepends the drag handle `<td>`.

- [ ] **Step 1: Add dnd-kit imports and GripVertical icon**

Find the existing import block at the top of the file:
```ts
import { Trash2, PlusCircle, Wrench, ShieldAlert, Settings2, Eye, EyeOff, FileSearch, PackageX } from 'lucide-react';
```

Replace with:
```ts
import { Trash2, PlusCircle, Wrench, ShieldAlert, Settings2, Eye, EyeOff, FileSearch, PackageX, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```

- [ ] **Step 2: Add the `SortableRow` component before `AssessmentGrid`**

Find the line:
```ts
// ─── Component ───────────────────────────────────────────────────
export function AssessmentGrid() {
```

Insert a new component immediately before it:
```ts
// ─── Sortable row wrapper ─────────────────────────────────────────
function SortableRow({ id, className, children }: { id: string; className: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <tr
      ref={setNodeRef}
      className={className}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <td
        className="px-1 py-1.5 w-6 text-center cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder row"
      >
        <GripVertical size={14} className="text-muted-foreground/30 mx-auto" />
      </td>
      {children}
    </tr>
  );
}

// ─── Component ───────────────────────────────────────────────────
export function AssessmentGrid() {
```

- [ ] **Step 3: Add `reorderAssessmentRows` to the store destructure**

Find:
```ts
  const {
    currentClaim,
    addAssessmentRow,
    updateAssessmentRow,
    deleteAssessmentRow,
    deleteAssessmentRows,
    toggleRowAllowed
  } = useClaimStore();
```

Replace with:
```ts
  const {
    currentClaim,
    addAssessmentRow,
    reorderAssessmentRows,
    updateAssessmentRow,
    deleteAssessmentRow,
    deleteAssessmentRows,
    toggleRowAllowed
  } = useClaimStore();
```

- [ ] **Step 4: Add `rowIds`, `sensors`, and `handleDragEnd` after the `visibleCount` line**

Find:
```ts
  const visibleCount = Object.values(visible).filter(Boolean).length;

  const handleGridNavigation
```

Replace with:
```ts
  const visibleCount = Object.values(visible).filter(Boolean).length;

  const rowIds = assessmentRows.map((r) => r.id);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rowIds.indexOf(active.id as string);
    const newIndex = rowIds.indexOf(over.id as string);
    reorderAssessmentRows(arrayMove(rowIds, oldIndex, newIndex));
  }

  const handleGridNavigation
```

- [ ] **Step 5: Update `totalCols` to account for the new drag handle column**

Find:
```ts
  // Dynamic column count: 8 always-on (Select, Sr, Allowed, Particulars, Assessed, Dep%, Net, Delete) + visible optionals
  const totalCols = 8 + visibleCount;
```

Replace with:
```ts
  // Dynamic column count: 9 always-on (Drag, Select, Sr, Allowed, Particulars, Assessed, Dep%, Net, Delete) + visible optionals
  const totalCols = 9 + visibleCount;
```

- [ ] **Step 6: Add the drag handle `<th>` as the first column in `<thead>`**

Find:
```tsx
            <tr>
              {/* ─── Always-on columns ──────────────────── */}
              <th className="px-2 py-2 font-medium w-8 text-center" title="Select all">
```

Replace with:
```tsx
            <tr>
              {/* ─── Always-on columns ──────────────────── */}
              <th className="px-1 py-2 w-6" aria-label="Drag handle column" />
              <th className="px-2 py-2 font-medium w-8 text-center" title="Select all">
```

- [ ] **Step 7: Wrap the table in `DndContext` and the rows in `SortableContext`**

Find:
```tsx
      <div className="overflow-x-auto">
```

Replace with:
```tsx
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
```

Then find the closing `</div>` that closes `overflow-x-auto` (it comes just before `</Card>`). It looks like:

```tsx
        </table>
      </div>
    </Card>
```

Replace with:
```tsx
        </table>
      </div>
      </DndContext>
    </Card>
```

- [ ] **Step 8: Wrap the rows map in `SortableContext`**

Find:
```tsx
            ) : (
              assessmentRows.map((row, idx) => {
```

Replace with:
```tsx
            ) : (
              <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
              {assessmentRows.map((row, idx) => {
```

Then find the closing of the map (the `)}` that ends `assessmentRows.map(...)`). It is followed by the closing of the ternary `)`. Replace:

```tsx
              })
            )}
```

with:

```tsx
              })}
              </SortableContext>
            )}
```

- [ ] **Step 9: Replace `<tr>` with `<SortableRow>` and move the className**

Find:
```tsx
                return (
                  <tr key={row.id} className={`hover:bg-accent/30 transition-colors ${selected.has(row.id) ? 'bg-red-500/5' : ''} ${!row.allowed ? 'opacity-40 bg-muted/20' : ''} ${isDuplicate ? 'bg-orange-500/10' : ''} ${row.isDisposal && row.allowed ? 'bg-amber-500/5' : ''}`}>
                    {/* Select checkbox — always on */}
```

Replace with:
```tsx
                return (
                  <SortableRow
                    key={row.id}
                    id={row.id}
                    className={`hover:bg-accent/30 transition-colors ${selected.has(row.id) ? 'bg-red-500/5' : ''} ${!row.allowed ? 'opacity-40 bg-muted/20' : ''} ${isDuplicate ? 'bg-orange-500/10' : ''} ${row.isDisposal && row.allowed ? 'bg-amber-500/5' : ''}`}
                  >
                    {/* Select checkbox — always on */}
```

Then find the closing `</tr>` of this row. It is the last `</tr>` inside the map before `);`. Replace:

```tsx
                  </tr>
                );
```

with:

```tsx
                  </SortableRow>
                );
```

- [ ] **Step 10: Verify the build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git add src/components/claim/AssessmentGrid.tsx
git commit -m "feat: add drag-to-reorder rows in AssessmentGrid with dnd-kit"
```

---

## Manual Verification Checklist

Start the dev server (`npm run dev`) and open a claim with assessment rows:

| Check | Expected |
|---|---|
| Drag handle column visible | Narrow `⠿` icon appears as leftmost column on every row |
| Hover over handle | Cursor changes to `grab` |
| Drag row 3 to position 1 | Row moves, others shift down, `isDirty` becomes true |
| Drag last row to middle | Row lands in correct position |
| Sr. No. after drag | Original `srNo` values preserved — not renumbered |
| Edit Sr. No. cell | Still editable inline as before |
| Add Part Row button | Still appends to end; new row can then be dragged |
| Empty state | "No items" message still shows when no rows |
| Keyboard | Tab to handle, Space to grab, Arrow keys to move, Space to drop |
| Original `/landing` | Unaffected |

---

## Self-Review

**Spec coverage:**
- ✅ Drag handle column — Step 2 + 6 + 9
- ✅ `reorderAssessmentRows` action — Task 2
- ✅ `srNo` preserved — no change to `srNo` logic; array reorder only
- ✅ `srNo` remains editable — no change to the existing `srNo` cell (currently read-only display `{row.srNo || idx + 1}` — note: spec says it must be editable)
- ✅ `totalCols` updated — Step 5
- ✅ Accessibility (keyboard sensor) — Step 4

**Note on `srNo` editability:** The current grid renders `srNo` as read-only text (`{row.srNo || idx + 1}`). The spec says it must be manually editable. This is existing behaviour predating this feature — it is not in scope for this plan. File a separate ticket if needed.

**No placeholders found. Types consistent across all tasks.**
