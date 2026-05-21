# Grid Excel-Style Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Excel-style cell range selection + Ctrl+V paste to any column of AssessmentGrid, and fix the AI bill extractor summing CGST+SGST as 18% instead of reading just one component.

**Architecture:** A pure utility module (`grid-paste.ts`) handles value parsing and update-map construction with full skip-rule logic. AssessmentGrid adds a `cellSelection` state, a `onMouseDown` handler for click/shift+click range selection, and extends the existing `onKeyDown` handler for Ctrl+V paste and Escape clearing. Each `<td>` gets `data-row-id`/`data-column-key` attributes for DOM-driven cell identification. The CGST fix is a one-line addition to the AI prompts.

**Tech Stack:** TypeScript, React, Vitest (existing), Zustand (existing `updateAssessmentRow`), Clipboard API (`navigator.clipboard.readText`)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/utils/grid-paste.ts` | **CREATE** | Pure parsing + update-map logic, no React |
| `src/lib/utils/__tests__/grid-paste.test.ts` | **CREATE** | Unit tests for above |
| `src/components/claim/AssessmentGrid.tsx` | **MODIFY** | Selection state, mouse handler, Ctrl+V, Escape, data attributes, ring highlight |
| `src/lib/ai/prompts.ts` | **MODIFY** | CGST+SGST extraction clarification |

---

## Task 1: Pure utility — `grid-paste.ts` (TDD)

**Files:**
- Create: `src/lib/utils/grid-paste.ts`
- Create: `src/lib/utils/__tests__/grid-paste.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/lib/utils/__tests__/grid-paste.test.ts
import { describe, test, expect } from 'vitest';
import { parseClipboardValue, buildPasteUpdates } from '../grid-paste';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: 'r1', particulars: 'Bonnet', section: 'parts',
    estimated: 8000, assessed: 5600, gst: 18,
    allowed: true, action: 'replace', isDisposal: false,
    partType: 'metal', partNumber: '', hsnSac: '',
    ...overrides,
  } as AssessmentRow;
}

describe('parseClipboardValue', () => {
  test('parses number for gst column', () => {
    expect(parseClipboardValue('18', 'gst')).toBe(18);
  });
  test('parses float for assessed column', () => {
    expect(parseClipboardValue('1234.5', 'assessed')).toBe(1234.5);
  });
  test('returns null for NaN number column', () => {
    expect(parseClipboardValue('abc', 'gst')).toBeNull();
  });
  test('trims and returns string for particulars', () => {
    expect(parseClipboardValue('  Bonnet  ', 'particulars')).toBe('Bonnet');
  });
  test('returns null for empty string column', () => {
    expect(parseClipboardValue('   ', 'particulars')).toBeNull();
  });
  test('accepts valid action enum', () => {
    expect(parseClipboardValue('repair', 'action')).toBe('repair');
    expect(parseClipboardValue('disallow', 'action')).toBe('disallow');
    expect(parseClipboardValue('', 'action')).toBe('');
  });
  test('rejects invalid action enum', () => {
    expect(parseClipboardValue('destroy', 'action')).toBeNull();
  });
  test('accepts valid partType enum', () => {
    expect(parseClipboardValue('plastic', 'partType')).toBe('plastic');
    expect(parseClipboardValue('labour', 'partType')).toBe('labour');
  });
  test('rejects invalid partType enum', () => {
    expect(parseClipboardValue('wood', 'partType')).toBeNull();
  });
  test('parses boolean true variants', () => {
    expect(parseClipboardValue('true', 'isDisposal')).toBe(true);
    expect(parseClipboardValue('1', 'isDisposal')).toBe(true);
    expect(parseClipboardValue('yes', 'isDisposal')).toBe(true);
    expect(parseClipboardValue('TRUE', 'isDisposal')).toBe(true);
  });
  test('parses boolean false variants', () => {
    expect(parseClipboardValue('false', 'isDisposal')).toBe(false);
    expect(parseClipboardValue('0', 'isDisposal')).toBe(false);
    expect(parseClipboardValue('no', 'isDisposal')).toBe(false);
  });
  test('returns null for unrecognised boolean input', () => {
    expect(parseClipboardValue('maybe', 'isDisposal')).toBeNull();
  });
});

describe('buildPasteUpdates', () => {
  const rows = [
    row({ id: 'r1', gst: 5 }),
    row({ id: 'r2', gst: 5 }),
    row({ id: 'r3', gst: 5, isDisposal: true }),
    row({ id: 'r4', gst: 5 }),
  ];

  test('applies value to all rows in range', () => {
    const updates = buildPasteUpdates(rows, 'r1', 'r4', 'particulars', 'Test');
    expect(Object.keys(updates)).toHaveLength(4);
    expect(updates['r1']).toEqual({ particulars: 'Test' });
    expect(updates['r4']).toEqual({ particulars: 'Test' });
  });

  test('works when anchor is below focus (reverse selection)', () => {
    const updates = buildPasteUpdates(rows, 'r4', 'r1', 'particulars', 'Test');
    expect(Object.keys(updates)).toHaveLength(4);
  });

  test('skips disposal rows for gst column', () => {
    const updates = buildPasteUpdates(rows, 'r1', 'r4', 'gst', 28);
    expect(updates['r3']).toBeUndefined();
    expect(Object.keys(updates)).toHaveLength(3);
  });

  test('skips non-parts rows for depOverride', () => {
    const mixed = [
      row({ id: 'r1', section: 'parts', allowed: true }),
      row({ id: 'r2', section: 'labour' as any, allowed: true }),
      row({ id: 'r3', section: 'parts', allowed: false }),
    ];
    const updates = buildPasteUpdates(mixed, 'r1', 'r3', 'depOverride', 10);
    expect(updates['r1']).toEqual({ depOverride: 10 });
    expect(updates['r2']).toBeUndefined();
    expect(updates['r3']).toBeUndefined();
  });

  test('returns empty object for null parsedValue', () => {
    const updates = buildPasteUpdates(rows, 'r1', 'r2', 'gst', null);
    expect(updates).toEqual({});
  });

  test('returns empty object if anchor row not found', () => {
    const updates = buildPasteUpdates(rows, 'missing', 'r2', 'gst', 18);
    expect(updates).toEqual({});
  });

  test('single-row selection (anchor === focus) applies to one row', () => {
    const updates = buildPasteUpdates(rows, 'r2', 'r2', 'gst', 28);
    expect(Object.keys(updates)).toHaveLength(1);
    expect(updates['r2']).toEqual({ gst: 28 });
  });
});
```

- [ ] **Step 2: Run tests — confirm they all fail**

```
npx vitest run src/lib/utils/__tests__/grid-paste.test.ts
```
Expected: `FAIL` — `Cannot find module '../grid-paste'`

- [ ] **Step 3: Create `src/lib/utils/grid-paste.ts`**

```typescript
import type { AssessmentRow } from '@/types/assessment';

const NUMBER_COLUMNS = new Set<keyof AssessmentRow>([
  'gst', 'assessed', 'estimated', 'quantity', 'unitPrice',
  'depOverride', 'disposalPercent', 'billedTaxable', 'billedAmount',
]);

const VALID_ACTION_VALUES = new Set(['replace', 'repair', 'disallow', '']);
const VALID_PART_TYPE_VALUES = new Set(['metal', 'plastic', 'fiberglass', 'glass', 'paint', 'labour']);

export function parseClipboardValue(
  text: string,
  columnKey: keyof AssessmentRow,
): unknown {
  const trimmed = text.trim();

  if (NUMBER_COLUMNS.has(columnKey)) {
    const n = parseFloat(trimmed);
    return isNaN(n) ? null : n;
  }

  if (columnKey === 'isDisposal') {
    const lower = trimmed.toLowerCase();
    if (['true', '1', 'yes'].includes(lower)) return true;
    if (['false', '0', 'no'].includes(lower)) return false;
    return null;
  }

  if (columnKey === 'action') {
    return VALID_ACTION_VALUES.has(trimmed) ? trimmed : null;
  }

  if (columnKey === 'partType') {
    return VALID_PART_TYPE_VALUES.has(trimmed) ? trimmed : null;
  }

  // String columns: particulars, partNumber, hsnSac
  return trimmed.length > 0 ? trimmed : null;
}

export function buildPasteUpdates(
  rows: AssessmentRow[],
  anchorRowId: string,
  focusRowId: string,
  columnKey: keyof AssessmentRow,
  parsedValue: unknown,
): Record<string, Partial<AssessmentRow>> {
  if (parsedValue === null || parsedValue === undefined) return {};

  const anchorIdx = rows.findIndex(r => r.id === anchorRowId);
  const focusIdx = rows.findIndex(r => r.id === focusRowId);
  if (anchorIdx === -1 || focusIdx === -1) return {};

  const start = Math.min(anchorIdx, focusIdx);
  const end = Math.max(anchorIdx, focusIdx);

  const updates: Record<string, Partial<AssessmentRow>> = {};

  for (let i = start; i <= end; i++) {
    const row = rows[i];

    // Skip rules
    if (columnKey === 'gst' && row.isDisposal) continue;
    if (columnKey === 'depOverride' && (!row.allowed || row.section !== 'parts')) continue;

    updates[row.id] = { [columnKey]: parsedValue } as Partial<AssessmentRow>;
  }

  return updates;
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```
npx vitest run src/lib/utils/__tests__/grid-paste.test.ts
```
Expected: `17 passed`

- [ ] **Step 5: Commit**

```
git add src/lib/utils/grid-paste.ts src/lib/utils/__tests__/grid-paste.test.ts
git commit -m "feat: add grid-paste utility with parseClipboardValue and buildPasteUpdates"
```

---

## Task 2: Selection state + mouse handler in AssessmentGrid

**Files:**
- Modify: `src/components/claim/AssessmentGrid.tsx`

- [ ] **Step 1: Add import for grid-paste utilities**

Find the import block at the top of `AssessmentGrid.tsx` (around line 1–22). After the last import, add:

```typescript
import { parseClipboardValue, buildPasteUpdates } from '@/lib/utils/grid-paste';
import type { AssessmentRow } from '@/types/assessment';
```

Note: `AssessmentRow` may already be imported via `@/types` — if so, skip that line.

- [ ] **Step 2: Add `cellSelection` state**

Find the block of `useState` calls near the top of the component (around line 155–185 where `selectedRows`, `showColumnSettings` etc. are declared). Add directly after the last useState:

```typescript
const [cellSelection, setCellSelection] = useState<{
  columnKey: string;
  anchorRowId: string;
  focusRowId: string;
} | null>(null);
```

- [ ] **Step 3: Add `isCellSelected` helper**

Find `const handleGridNavigation` (around line 219). Insert this helper immediately before it:

```typescript
const isCellSelected = useCallback((rowId: string, columnKey: string): boolean => {
  if (!cellSelection || cellSelection.columnKey !== columnKey) return false;
  const rows = claim?.assessmentRows ?? [];
  const anchorIdx = rows.findIndex(r => r.id === cellSelection.anchorRowId);
  const focusIdx = rows.findIndex(r => r.id === cellSelection.focusRowId);
  const rowIdx = rows.findIndex(r => r.id === rowId);
  if (anchorIdx === -1 || focusIdx === -1 || rowIdx === -1) return false;
  const start = Math.min(anchorIdx, focusIdx);
  const end = Math.max(anchorIdx, focusIdx);
  return rowIdx >= start && rowIdx <= end;
}, [cellSelection, claim?.assessmentRows]);
```

- [ ] **Step 4: Add `handleCellMouseDown` handler**

Insert immediately after `isCellSelected`:

```typescript
const handleCellMouseDown = useCallback((e: React.MouseEvent<HTMLTableSectionElement>) => {
  const td = (e.target as HTMLElement).closest('td');
  if (!td) return;
  const columnKey = (td as HTMLElement & { dataset: DOMStringMap }).dataset.columnKey;
  const tr = td.closest('tr');
  const rowId = (tr as HTMLElement & { dataset: DOMStringMap })?.dataset.rowId;
  if (!rowId || !columnKey) return;

  if (e.shiftKey && cellSelection && cellSelection.columnKey === columnKey) {
    // Extend existing selection within the same column
    setCellSelection(prev => prev ? { ...prev, focusRowId: rowId } : null);
  } else {
    // New anchor — start fresh selection
    setCellSelection({ columnKey, anchorRowId: rowId, focusRowId: rowId });
  }
}, [cellSelection]);
```

- [ ] **Step 5: Add `data-row-id` to the `<tr>` element**

Find the `assessmentRows.map((row, idx) =>` block (around line 476). The `<tr>` element for each row is a few lines below. It currently looks like:

```tsx
<SortableRow key={row.id} id={row.id} ...>
```
or
```tsx
<tr key={row.id} ...>
```

Add `data-row-id={row.id}` to whichever element is the row container. Search for the pattern `key={row.id}` on the row-level element and add the data attribute next to it.

- [ ] **Step 6: Add `onMouseDown` to `<tbody>`**

Find the `<tbody>` opening tag (around line 465):
```tsx
<tbody className="divide-y divide-border" onKeyDown={handleGridNavigation}>
```
Change to:
```tsx
<tbody
  className="divide-y divide-border"
  onKeyDown={handleGridNavigation}
  onMouseDown={handleCellMouseDown}
>
```

- [ ] **Step 7: Type-check**

```
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 8: Commit**

```
git add src/components/claim/AssessmentGrid.tsx
git commit -m "feat: add cell selection state and mouse handler to AssessmentGrid"
```

---

## Task 3: Ctrl+V paste + Escape + data attributes + visual ring

**Files:**
- Modify: `src/components/claim/AssessmentGrid.tsx`

- [ ] **Step 1: Extend `handleGridNavigation` with Ctrl+V and Escape**

Find `const handleGridNavigation` (around line 219). The function currently starts with `if (!e.shiftKey) return;`. Replace the entire function with:

```typescript
const handleGridNavigation = useCallback((e: React.KeyboardEvent<HTMLTableSectionElement>) => {
  // Escape: clear cell selection
  if (e.key === 'Escape') {
    setCellSelection(null);
    return;
  }

  // Ctrl+V (or Cmd+V on Mac): paste clipboard value into selected cell range
  if ((e.ctrlKey || e.metaKey) && e.key === 'v' && cellSelection) {
    e.preventDefault();
    navigator.clipboard.readText().then(text => {
      const parsedValue = parseClipboardValue(
        text,
        cellSelection.columnKey as keyof AssessmentRow,
      );
      const rows = claim?.assessmentRows ?? [];
      const updates = buildPasteUpdates(
        rows,
        cellSelection.anchorRowId,
        cellSelection.focusRowId,
        cellSelection.columnKey as keyof AssessmentRow,
        parsedValue,
      );
      Object.entries(updates).forEach(([rowId, update]) => {
        updateAssessmentRow(rowId, update);
      });
      setCellSelection(null);
    }).catch(() => {
      // Clipboard read denied — silently ignore (user may need to interact with page first)
    });
    return;
  }

  if (!e.shiftKey) return;

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;

    const td = target.closest('td');
    const tr = td?.closest('tr');
    const tbody = tr?.closest('tbody');

    if (!td || !tr || !tbody) return;

    e.preventDefault();

    const tds = Array.from(tr.children);
    const colIndex = tds.indexOf(td);
    const trs = Array.from(tbody.children);
    const rowIndex = trs.indexOf(tr);

    let nextInput: HTMLElement | null = null;
    let nextRowId: string | null = null;

    if (e.key === 'ArrowRight') {
      for (let i = colIndex + 1; i < tds.length; i++) {
        const input = tds[i].querySelector('input:not([disabled]), select:not([disabled])') as HTMLElement;
        if (input) { nextInput = input; break; }
      }
    } else if (e.key === 'ArrowLeft') {
      for (let i = colIndex - 1; i >= 0; i--) {
        const input = tds[i].querySelector('input:not([disabled]), select:not([disabled])') as HTMLElement;
        if (input) { nextInput = input; break; }
      }
    } else if (e.key === 'ArrowDown') {
      if (rowIndex < trs.length - 1) {
        const nextTr = trs[rowIndex + 1] as HTMLElement;
        nextInput = nextTr.children[colIndex]?.querySelector('input:not([disabled]), select:not([disabled])') as HTMLElement;
        nextRowId = nextTr.dataset.rowId ?? null;
      }
    } else if (e.key === 'ArrowUp') {
      if (rowIndex > 0) {
        const prevTr = trs[rowIndex - 1] as HTMLElement;
        nextInput = prevTr.children[colIndex]?.querySelector('input:not([disabled]), select:not([disabled])') as HTMLElement;
        nextRowId = prevTr.dataset.rowId ?? null;
      }
    }

    if (nextInput) {
      nextInput.focus();
      if (nextInput instanceof HTMLInputElement && nextInput.type !== 'checkbox') {
        nextInput.select();
      }

      // Extend cell selection on Shift+Up/Down
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && nextRowId) {
        const columnKey = (td as HTMLElement).dataset.columnKey;
        if (columnKey) {
          setCellSelection(prev =>
            prev && prev.columnKey === columnKey
              ? { ...prev, focusRowId: nextRowId! }
              : { columnKey, anchorRowId: nextRowId!, focusRowId: nextRowId! },
          );
        }
      }
    }
  }
}, [cellSelection, claim?.assessmentRows, updateAssessmentRow]);
```

- [ ] **Step 2: Add `data-column-key` and ring highlight to every `<td>` in the row**

For each column's `<td>`, add two things:
1. `data-column-key="<columnKey>"` attribute
2. Append `${isCellSelected(row.id, '<columnKey>') ? ' ring-2 ring-blue-400 ring-inset' : ''}` to the `className`

Apply to each column below. Find each `<td>` by searching for its unique content/structure near the column's `<Input>` or `<select>`.

**particulars column `<td>`** (search for `row.particulars` input, ~line 530):
```tsx
<td
  className={`px-1 py-1.5${isCellSelected(row.id, 'particulars') ? ' ring-2 ring-blue-400 ring-inset' : ''}`}
  data-column-key="particulars"
>
```

**partNumber column `<td>`** (search for `row.partNumber`, ~line 565):
```tsx
<td
  className={`px-1 py-1.5${isCellSelected(row.id, 'partNumber') ? ' ring-2 ring-blue-400 ring-inset' : ''}`}
  data-column-key="partNumber"
>
```

**hsnSac column `<td>`** (~line 575):
```tsx
<td
  className={`px-1 py-1.5${isCellSelected(row.id, 'hsnSac') ? ' ring-2 ring-blue-400 ring-inset' : ''}`}
  data-column-key="hsnSac"
>
```

**partType column `<td>`** (~line 586):
```tsx
<td
  className={`px-1 py-1.5${isCellSelected(row.id, 'partType') ? ' ring-2 ring-blue-400 ring-inset' : ''}`}
  data-column-key="partType"
>
```

**quantity column `<td>`** (~line 615):
```tsx
<td
  className={`px-1 py-1.5${isCellSelected(row.id, 'quantity') ? ' ring-2 ring-blue-400 ring-inset' : ''}`}
  data-column-key="quantity"
>
```

**estimated column `<td>`** (~line 627):
```tsx
<td
  className={`px-1 py-1.5${isCellSelected(row.id, 'estimated') ? ' ring-2 ring-blue-400 ring-inset' : ''}`}
  data-column-key="estimated"
>
```

**gst column `<td>`** (~line 646):
```tsx
<td
  className={`px-1 py-1.5${isCellSelected(row.id, 'gst') ? ' ring-2 ring-blue-400 ring-inset' : ''}`}
  data-column-key="gst"
>
```

**disposal column `<td>`** (~line 662):
```tsx
<td
  className={`px-1 py-1.5${isCellSelected(row.id, 'isDisposal') ? ' ring-2 ring-blue-400 ring-inset' : ''}`}
  data-column-key="isDisposal"
>
```

**assessed column `<td>`** (~line 690):
```tsx
<td
  className={`px-1 py-1.5${isCellSelected(row.id, 'assessed') ? ' ring-2 ring-blue-400 ring-inset' : ''}`}
  data-column-key="assessed"
>
```

**depOverride column `<td>`** (~line 701):
```tsx
<td
  className={`px-1 py-1.5${isCellSelected(row.id, 'depOverride') ? ' ring-2 ring-blue-400 ring-inset' : ''}`}
  data-column-key="depOverride"
>
```

**action column `<td>`** (~line 750):
```tsx
<td
  className={`px-1 py-1.5${isCellSelected(row.id, 'action') ? ' ring-2 ring-blue-400 ring-inset' : ''}`}
  data-column-key="action"
>
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Run all tests**

```
npx vitest run
```
Expected: all pass (grid-paste tests + existing tests)

- [ ] **Step 5: Commit**

```
git add src/components/claim/AssessmentGrid.tsx
git commit -m "feat: wire Ctrl+V paste, Escape, and cell highlight ring into AssessmentGrid"
```

---

## Task 4: Fix CGST+SGST AI extraction bug

**Files:**
- Modify: `src/lib/ai/prompts.ts`

- [ ] **Step 1: Fix the estimate bill extraction prompt**

Find the `estimate` bill extraction prompt (around line 92–148). Locate the rule that mentions `gst_percent`. In the JSON schema example it looks like:
```
{ ..., "gst_percent": 18, ... }
```

Find the numbered rules section above the schema. After rule 4 (which describes AMOUNTS / cgst_amount / sgst_amount), add:

```
5. "gst_percent": TOTAL GST rate for this line — add ALL components together: CGST rate + SGST rate + IGST rate. Example: CGST 9% + SGST 9% = 18, not 9. Never write just one component's rate.
```

Renumber the subsequent rules (5→6, 6→7, etc.) if they use numbered bullets.

- [ ] **Step 2: Fix the final-bill extraction prompt**

Find the `final-bill` prompt (around line 150–186). Apply the identical clarification. Locate the rule describing AMOUNTS (rule 4, which mentions cgst_amount / sgst_amount / total_amount). Add immediately after it:

```
5. "gst_percent": TOTAL GST rate for this line — add ALL components: CGST rate + SGST rate + IGST rate. Example: CGST 9% + SGST 9% = 18, not 9. Never write just one component's rate.
```

Renumber subsequent rules if needed.

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```
git add src/lib/ai/prompts.ts
git commit -m "fix: prompt clarification — CGST+SGST must be summed for gst_percent (9+9=18)"
```

---

## Task 5: Build, deploy, and manual verification

- [ ] **Step 1: Full build**

```
npm run build
```
Expected: `✓ Compiled successfully`

- [ ] **Step 2: Deploy**

```
firebase deploy --only hosting
```
Expected: `✓ Deploy complete!`

- [ ] **Step 3: Manual verification checklist**

Open a claim → Assessment tab.

1. Click a cell in the GST% column → blue ring appears on that cell
2. Shift+click a cell 4 rows lower in the same column → all 5 cells highlighted blue
3. Copy `18` to clipboard → Ctrl+V → all 5 rows show GST 18%; ring clears
4. Find a disposal row in the range — its GST must remain 0 (skipped)
5. Shift+click a cell in the `Assessed` column → selection resets to Assessed column
6. Press Escape → blue ring clears
7. Click a cell in the `Particulars` column, Shift+click 2 rows down → copy any text → Ctrl+V → all 3 rows updated
8. Click a cell in the `Action` column, copy `repair` → Ctrl+V → rows updated; copy `invalid` → nothing changes
9. Shift+ArrowDown twice from a GST cell → selection extends 2 rows, Ctrl+V pastes correctly
10. Upload a bill with CGST 9% + SGST 9% → AI-extracted GST% shows 18, not 9

- [ ] **Step 4: Final commit (if any last tweaks made during verification)**

```
git add -p
git commit -m "fix: post-deploy verification tweaks"
```

- [ ] **Step 5: Update Obsidian Tasks.md**

Add to the "Completed This Session" section:
```
### AssessmentGrid — Excel-style Column Paste (2026-05-16)
- [x] grid-paste.ts: parseClipboardValue + buildPasteUpdates with skip rules
- [x] 17 unit tests passing
- [x] Cell range selection: click to anchor, Shift+click/Shift+Arrow to extend
- [x] Ctrl+V pastes clipboard value across selected column range
- [x] Escape clears selection
- [x] Blue ring highlight on selected cells
- [x] AI prompt fix: CGST+SGST now summed to gst_percent (not just one component)
- [x] Deployed: https://motorsurveyos.web.app
```
