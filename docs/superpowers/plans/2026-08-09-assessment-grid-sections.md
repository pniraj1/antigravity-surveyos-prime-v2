# Three-Section Assessment Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the assessment grid as three sections — Spare Parts, Labour, Painting — over the same single row list, with per-section subtotals and cross-section drag that cannot silently re-price an item.

**Architecture:** `assessmentRows` stays one flat array on the claim; sections are purely a rendering concern, so report builders, `buildSerialMap`, `calculateAssessmentSummary`, AI extraction and Bill Check are untouched. A new store action `moveRowToSection` owns every cross-section move — both drag and the existing type dropdown route through it — so the two paths cannot drift apart. `AssessmentGrid.tsx` (906 lines) splits into an orchestrator plus a per-section table component rendered three times.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand (slice pattern), @dnd-kit/core + @dnd-kit/sortable, Tailwind v4, Vitest (node environment, no DOM/testing-library available).

## Global Constraints

- Spec: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Specs/2026-08-09-assessment-grid-sections-design.md`
- Prerequisite already landed: `reorderAssessmentRows` partial-list fix, commit `3b71f0df`. Do not re-do it.
- **No report builder may be modified.** Files under `src/lib/reports/` are out of scope entirely.
- **Do not change existing behaviour in `src/lib/calculations/`.** Tasks 1 and 4 add two NEW files there (`section-move.ts`, `section-subtotals.ts`); no existing file in that directory may be modified. Subtotals read from `calculateAssessmentSummary`; never recompute totals locally.
- Section order is fixed everywhere: `parts`, `labour`, `paint`.
- Files stay under 800 lines (`.claude/rules/common/coding-style.md`).
- No `console.log` in committed code.
- Vitest runs in `environment: 'node'` — there is **no jsdom and no @testing-library/react**. All tests in this plan are pure-function/store tests. Do not write component-render tests; they cannot run.
- Existing store tests use a hand-rolled harness, not a real Zustand store. Copy the harness from `src/stores/slices/__tests__/reorder-assessment-rows.test.ts`.
- Commit after every task. Never use `--no-verify`.
- Verify with `npx tsc --noEmit` and `npx vitest run` before each commit.

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `src/types/assessment.ts` | Add `previousPartType` to `AssessmentRow` | Modify |
| `src/lib/calculations/section-move.ts` | Pure resolver for what a section change does to a row | Create |
| `src/lib/calculations/__tests__/section-move.test.ts` | Tests for the resolver | Create |
| `src/stores/slices/assessmentSlice.ts` | Add `moveRowToSection`, `addAssessmentRowToSection` | Modify |
| `src/stores/slices/__tests__/move-row-to-section.test.ts` | Store-level tests | Create |
| `src/lib/calculations/section-subtotals.ts` | Per-section subtotal figures from the engine | Create |
| `src/lib/calculations/__tests__/section-subtotals.test.ts` | Tests for subtotals | Create |
| `src/components/claim/useGridSelection.ts` | Selection state, tri-state ticks, range clamping | Create |
| `src/components/claim/AssessmentSectionTable.tsx` | One section: header, rows, subtotal footer, add-row | Create |
| `src/components/claim/AssessmentGrid.tsx` | Orchestrator: drag context, columns, bulk delete | Modify |

The pure logic (`section-move.ts`, `section-subtotals.ts`) is deliberately separated from the store and the component so it can be tested under the node-only Vitest setup.

---

## Task 1: Row remembers its previous part type

**Files:**
- Modify: `src/types/assessment.ts`
- Create: `src/lib/calculations/section-move.ts`
- Test: `src/lib/calculations/__tests__/section-move.test.ts`

**Interfaces:**
- Consumes: `AssessmentRow`, `AssessmentSection`, `PartType` from `@/types/assessment`
- Produces: `resolveSectionMove(row: AssessmentRow, target: AssessmentSection): Partial<AssessmentRow>` — returns only the fields that change. Used by Task 2 (store) and, through it, by the type dropdown in Task 7.

**Why:** `partType` decides depreciation (plastic 50%, metal by age, fibre glass 30%, glass/labour/paint Nil). A labour row must carry `partType: 'labour'`, so moving a plastic part into Labour overwrites its type. Without memory, moving it back defaults to metal — on a ₹10,000 bumper on a three-year-old car that is ₹5,000 becoming ₹7,500, silently.

- [ ] **Step 1: Add the field to the row type**

In `src/types/assessment.ts`, inside `interface AssessmentRow`, immediately after the `partType: PartType;` line, add:

```typescript
  /**
   * The partType this row carried before it was last moved out of the `parts`
   * section. Restores the original type when the row is moved back, so a round
   * trip through Labour cannot silently re-price the item.
   */
  previousPartType?: PartType;
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/calculations/__tests__/section-move.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { resolveSectionMove } from '../section-move';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: 'r1',
    particulars: 'FRONT BUMPER',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

describe('resolveSectionMove', () => {
  test('moving a part into labour stashes its type and switches to labour', () => {
    const r = row({ partType: 'plastic', section: 'parts' });
    expect(resolveSectionMove(r, 'labour')).toEqual({
      section: 'labour',
      partType: 'labour',
      previousPartType: 'plastic',
      depOverride: undefined,
    });
  });

  test('moving a part into paint stashes its type and switches to paint', () => {
    const r = row({ partType: 'fiberglass', section: 'parts' });
    expect(resolveSectionMove(r, 'paint')).toEqual({
      section: 'paint',
      partType: 'paint',
      previousPartType: 'fiberglass',
      depOverride: undefined,
    });
  });

  test('moving back into parts restores the remembered type', () => {
    // The regression this exists to prevent: plastic depreciates at 50%,
    // metal at the age scale. Defaulting to metal re-prices the item.
    const r = row({ partType: 'labour', section: 'labour', previousPartType: 'plastic' });
    expect(resolveSectionMove(r, 'parts')).toEqual({
      section: 'parts',
      partType: 'plastic',
      previousPartType: undefined,
      depOverride: undefined,
    });
  });

  test('moving into parts with nothing remembered falls back to metal', () => {
    const r = row({ partType: 'labour', section: 'labour' });
    expect(resolveSectionMove(r, 'parts')).toEqual({
      section: 'parts',
      partType: 'metal',
      previousPartType: undefined,
      depOverride: undefined,
    });
  });

  test('a manual depreciation override is cleared in every direction', () => {
    // Labour and paint are Nil depreciation under the tariff. A 40% override
    // riding along would quietly cut an 8,000 labour line to 4,800.
    for (const [from, to] of [
      ['parts', 'labour'],
      ['parts', 'paint'],
      ['labour', 'parts'],
      ['paint', 'parts'],
      ['labour', 'paint'],
    ] as const) {
      const r = row({ section: from, partType: from === 'parts' ? 'metal' : from, depOverride: 40 });
      const changes = resolveSectionMove(r, to);
      expect(changes.depOverride).toBeUndefined();
      // The key must be PRESENT and undefined, not absent. Callers spread this
      // over the row, and an absent key leaves the old 40 in place — which
      // toBeUndefined() alone would not catch.
      expect('depOverride' in changes).toBe(true);
    }
  });

  test('labour to paint does not overwrite a remembered part type', () => {
    const r = row({ partType: 'labour', section: 'labour', previousPartType: 'plastic' });
    expect(resolveSectionMove(r, 'paint')).toEqual({
      section: 'paint',
      partType: 'paint',
      previousPartType: 'plastic',
      depOverride: undefined,
    });
  });

  test('moving to the section it already occupies changes nothing', () => {
    const r = row({ partType: 'plastic', section: 'parts' });
    expect(resolveSectionMove(r, 'parts')).toEqual({});
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/calculations/__tests__/section-move.test.ts`
Expected: FAIL — `Failed to resolve import "../section-move"`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/calculations/section-move.ts`:

```typescript
import type { AssessmentRow, AssessmentSection, PartType } from '@/types/assessment';

/**
 * Resolves what changes when a row moves to a different section.
 *
 * Returns only the fields that change, so callers can spread it over the row.
 * An empty object means the row is already in the target section.
 *
 * Two rules earn their keep here:
 *
 * `partType` decides depreciation — plastic 50%, metal by vehicle age, fibre
 * glass 30%, glass and labour and paint Nil. A labour row must carry
 * `partType: 'labour'`, so moving a plastic part into Labour overwrites its
 * type. `previousPartType` remembers what it was, so moving it back restores
 * plastic instead of defaulting to metal. Without that, a round trip re-prices
 * a 10,000 part on a three-year-old car from 5,000 to 7,500 with nothing on
 * screen reporting it.
 *
 * A manual `depOverride` is cleared on every section change. Labour and paint
 * are Nil depreciation under the tariff, so an override riding along from the
 * parts section would silently reduce the line.
 */
export function resolveSectionMove(
  row: AssessmentRow,
  target: AssessmentSection
): Partial<AssessmentRow> {
  if (row.section === target) return {};

  // `undefined` is written explicitly rather than omitted: callers spread this
  // over the existing row, and an omitted key would leave the old value in place.
  const base = { section: target, depOverride: undefined } as Partial<AssessmentRow>;

  if (target === 'parts') {
    return {
      ...base,
      partType: row.previousPartType ?? 'metal',
      previousPartType: undefined,
    };
  }

  const partType: PartType = target === 'labour' ? 'labour' : 'paint';

  // Only remember a type worth restoring. Moving labour → paint must not
  // overwrite the plastic that was stashed on the way out of parts.
  const previousPartType = row.section === 'parts' ? row.partType : row.previousPartType;

  return { ...base, partType, previousPartType };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/calculations/__tests__/section-move.test.ts`
Expected: PASS — 7 passed.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/types/assessment.ts src/lib/calculations/section-move.ts src/lib/calculations/__tests__/section-move.test.ts
git commit -m "feat(assessment): resolve part type and dep override on a section move

partType decides depreciation and a labour row must carry partType
'labour', so moving a plastic part into Labour overwrites its type.
previousPartType remembers what it was, so moving it back restores
plastic rather than defaulting to metal -- a round trip would otherwise
re-price a 10,000 part on a three-year-old car from 5,000 to 7,500 with
nothing on screen reporting it.

A manual depOverride is cleared on every section change, since labour
and paint are Nil depreciation under the tariff."
```

---

## Task 2: Store action for moving a row between sections

**Files:**
- Modify: `src/stores/slices/assessmentSlice.ts`
- Test: `src/stores/slices/__tests__/move-row-to-section.test.ts`

**Interfaces:**
- Consumes: `resolveSectionMove` from Task 1
- Produces: `moveRowToSection(rowId: string, section: AssessmentSection, targetIndex: number): void` on `AssessmentSlice`. `targetIndex` is an index into the flat `assessmentRows` array, not a position within the destination section. Used by Task 6 (drag) and Task 7 (dropdown).

- [ ] **Step 1: Write the failing test**

Create `src/stores/slices/__tests__/move-row-to-section.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { createAssessmentSlice } from '../assessmentSlice';
import type { ClaimData } from '@/types';
import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

function row(id: string, section: AssessmentSection, overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id,
    particulars: id.toUpperCase(),
    estimated: 1000,
    assessed: 1000,
    partType: section === 'labour' ? 'labour' : section === 'paint' ? 'paint' : 'metal',
    gst: 18,
    section,
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

/** Minimal harness: runs the slice's set() against a plain state object. */
function harness(rows: AssessmentRow[]) {
  let state: { currentClaim: ClaimData | null; isDirty?: boolean } = {
    currentClaim: { id: 'c1', assessmentRows: rows } as unknown as ClaimData,
  };
  const set = (fn: (s: typeof state) => Partial<typeof state>) => {
    state = { ...state, ...fn(state) };
  };
  const slice = createAssessmentSlice(set as never, (() => state) as never, {} as never);
  return {
    slice,
    rows: () => state.currentClaim!.assessmentRows,
    ids: () => state.currentClaim!.assessmentRows.map(r => r.id),
    byId: (id: string) => state.currentClaim!.assessmentRows.find(r => r.id === id)!,
  };
}

describe('moveRowToSection', () => {
  test('changes the row section and repositions it', () => {
    const h = harness([row('p1', 'parts'), row('p2', 'parts'), row('l1', 'labour')]);
    h.slice.moveRowToSection('p2', 'labour', 2);
    expect(h.byId('p2').section).toBe('labour');
    expect(h.ids()).toEqual(['p1', 'l1', 'p2']);
  });

  test('a plastic part survives a round trip through labour', () => {
    const h = harness([row('p1', 'parts', { partType: 'plastic' })]);
    h.slice.moveRowToSection('p1', 'labour', 0);
    expect(h.byId('p1').partType).toBe('labour');
    h.slice.moveRowToSection('p1', 'parts', 0);
    expect(h.byId('p1').partType).toBe('plastic');
    expect(h.byId('p1').previousPartType).toBeUndefined();
  });

  test('clears a manual depreciation override', () => {
    const h = harness([row('p1', 'parts', { depOverride: 40 })]);
    h.slice.moveRowToSection('p1', 'labour', 0);
    expect(h.byId('p1').depOverride).toBeUndefined();
  });

  test('leaves every other row untouched', () => {
    const h = harness([row('p1', 'parts'), row('l1', 'labour'), row('t1', 'paint')]);
    const before = h.byId('l1');
    h.slice.moveRowToSection('p1', 'paint', 2);
    expect(h.rows()).toHaveLength(3);
    expect(h.byId('l1')).toEqual(before);
  });

  test('an unknown row id is a no-op', () => {
    const h = harness([row('p1', 'parts')]);
    h.slice.moveRowToSection('ghost', 'labour', 0);
    expect(h.ids()).toEqual(['p1']);
    expect(h.byId('p1').section).toBe('parts');
  });

  test('a same-section move still repositions the row', () => {
    // resolveSectionMove returns no field changes, but the row is still
    // removed and reinserted at the target index -- this is the path a
    // within-section drag would take if it ever routed through here.
    const h = harness([row('p1', 'parts'), row('p2', 'parts')]);
    h.slice.moveRowToSection('p1', 'parts', 1);
    expect(h.ids()).toEqual(['p2', 'p1']);
    expect(h.byId('p1').partType).toBe('metal');
    expect(h.byId('p1').previousPartType).toBeUndefined();
  });

  test('an out-of-range index clamps instead of creating holes', () => {
    const h = harness([row('p1', 'parts'), row('l1', 'labour')]);
    h.slice.moveRowToSection('p1', 'labour', 99);
    expect(h.rows()).toHaveLength(2);
    expect(h.rows().every(Boolean)).toBe(true);
    expect(h.ids()).toEqual(['l1', 'p1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/slices/__tests__/move-row-to-section.test.ts`
Expected: FAIL — `slice.moveRowToSection is not a function`.

- [ ] **Step 3: Declare the action on the slice interface**

In `src/stores/slices/assessmentSlice.ts`, add to `interface AssessmentSlice` immediately after the `reorderAssessmentRows` line:

```typescript
  moveRowToSection: (rowId: string, section: AssessmentRow['section'], targetIndex: number) => void;
```

- [ ] **Step 4: Add the import**

At the top of `src/stores/slices/assessmentSlice.ts`, after the existing `import { createAssessmentRow } from '@/lib/calculations';` line, add:

```typescript
import { resolveSectionMove } from '@/lib/calculations/section-move';
```

- [ ] **Step 5: Implement the action**

In `src/stores/slices/assessmentSlice.ts`, immediately after the closing `},` of `reorderAssessmentRows`, add:

```typescript
  /**
   * Moves a row into another section and repositions it, in one action.
   *
   * `targetIndex` is an index into the flat assessmentRows array, resolved by
   * the caller from the drop position — not a position within the destination
   * section.
   *
   * Both the drag handler and the type dropdown call this. Two code paths for
   * one operation is how three copies of the depreciation table came to
   * disagree; see the fibre glass fix of 2026-08-09.
   */
  moveRowToSection: (rowId, section, targetIndex) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const rows = state.currentClaim.assessmentRows;
      const from = rows.findIndex((r) => r.id === rowId);
      if (from === -1) return {};

      const changes = resolveSectionMove(rows[from], section);
      const moved = { ...rows[from], ...changes };

      const without = rows.filter((_, i) => i !== from);
      const to = Math.max(0, Math.min(targetIndex, without.length));
      const next = [...without.slice(0, to), moved, ...without.slice(to)];

      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: next,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/stores/slices/__tests__/move-row-to-section.test.ts`
Expected: PASS — 7 passed.

- [ ] **Step 7: Full suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: TS silent; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/stores/slices/assessmentSlice.ts src/stores/slices/__tests__/move-row-to-section.test.ts
git commit -m "feat(assessment): add moveRowToSection store action

One action owns every cross-section move: the section change, the part
type swap, clearing the depreciation override, and the repositioning.
Both the drag handler and the type dropdown will call it, so the two
cannot drift apart."
```

---

## Task 3: Insert a new row into its own section

**Files:**
- Modify: `src/stores/slices/assessmentSlice.ts`
- Test: `src/stores/slices/__tests__/add-row-to-section.test.ts`

**Interfaces:**
- Produces: `addAssessmentRowToSection(section: AssessmentRow['section']): void` on `AssessmentSlice`. Appends after the last row of that section rather than at the end of the array. Used by Task 5.

**Why:** `addAssessmentRow` appends to the end of the flat array. In a sectioned view, adding a part row would make it appear at the bottom of the *Painting* section's position in the array, so it would render as the last parts row only by accident. It must land after the last existing row of its own section.

- [ ] **Step 1: Write the failing test**

Create `src/stores/slices/__tests__/add-row-to-section.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { createAssessmentSlice } from '../assessmentSlice';
import type { ClaimData } from '@/types';
import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

function row(id: string, section: AssessmentSection): AssessmentRow {
  return {
    id,
    particulars: id.toUpperCase(),
    estimated: 1000,
    assessed: 1000,
    partType: section === 'labour' ? 'labour' : section === 'paint' ? 'paint' : 'metal',
    gst: 18,
    section,
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
  };
}

function harness(rows: AssessmentRow[]) {
  let state: { currentClaim: ClaimData | null; isDirty?: boolean } = {
    currentClaim: { id: 'c1', assessmentRows: rows } as unknown as ClaimData,
  };
  const set = (fn: (s: typeof state) => Partial<typeof state>) => {
    state = { ...state, ...fn(state) };
  };
  const slice = createAssessmentSlice(set as never, (() => state) as never, {} as never);
  return { slice, rows: () => state.currentClaim!.assessmentRows };
}

describe('addAssessmentRowToSection', () => {
  test('inserts after the last row of its own section', () => {
    const h = harness([row('p1', 'parts'), row('l1', 'labour'), row('t1', 'paint')]);
    h.slice.addAssessmentRowToSection('parts');
    const sections = h.rows().map(r => r.section);
    expect(sections).toEqual(['parts', 'parts', 'labour', 'paint']);
  });

  test('appends to the end when the section has no rows yet', () => {
    const h = harness([row('p1', 'parts')]);
    h.slice.addAssessmentRowToSection('paint');
    expect(h.rows().map(r => r.section)).toEqual(['parts', 'paint']);
    expect(h.rows()[1].partType).toBe('paint');
  });

  test('the new row carries the right section and part type', () => {
    const h = harness([]);
    h.slice.addAssessmentRowToSection('labour');
    expect(h.rows()).toHaveLength(1);
    expect(h.rows()[0].section).toBe('labour');
    expect(h.rows()[0].partType).toBe('labour');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/slices/__tests__/add-row-to-section.test.ts`
Expected: FAIL — `slice.addAssessmentRowToSection is not a function`.

- [ ] **Step 3: Declare on the interface**

In `src/stores/slices/assessmentSlice.ts`, add to `interface AssessmentSlice` after the `addAssessmentRow` line:

```typescript
  addAssessmentRowToSection: (section: AssessmentRow['section']) => void;
```

- [ ] **Step 4: Implement**

In `src/stores/slices/assessmentSlice.ts`, immediately after the closing `},` of `addAssessmentRow`, add:

```typescript
  /**
   * Adds a blank row directly after the last row of its own section.
   *
   * addAssessmentRow appends to the end of the flat array, which in a sectioned
   * view drops a new parts row below the painting rows.
   */
  addAssessmentRowToSection: (section) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const rows = state.currentClaim.assessmentRows;
      const newRow = createAssessmentRow(section);

      let lastOfSection = -1;
      rows.forEach((r, i) => { if (r.section === section) lastOfSection = i; });
      const at = lastOfSection === -1 ? rows.length : lastOfSection + 1;

      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: [...rows.slice(0, at), newRow, ...rows.slice(at)],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/stores/slices/__tests__/add-row-to-section.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/stores/slices/assessmentSlice.ts src/stores/slices/__tests__/add-row-to-section.test.ts
git commit -m "feat(assessment): add a row into its own section

addAssessmentRow appends to the end of the flat array, which in a
sectioned view drops a new parts row below the painting rows."
```

---

## Task 4: Per-section subtotals from the engine

**Files:**
- Create: `src/lib/calculations/section-subtotals.ts`
- Test: `src/lib/calculations/__tests__/section-subtotals.test.ts`

**Interfaces:**
- Consumes: `calculateAssessmentSummary` from `@/lib/calculations/assessment`, `AssessmentSummary` from `@/types`
- Produces:
  ```typescript
  export interface SectionSubtotal { base: number; gst: number; total: number; }
  export function sectionSubtotals(summary: AssessmentSummary): Record<AssessmentSection, SectionSubtotal>
  ```
  Used by Task 5.

**Why a separate module:** the summary already carries every figure needed (`partsBase`/`partsTotal`, `labourOnlyBase`/`labourOnlyTotal`, `paintOnlyBase`/`paintOnlyTotal`). This maps them into a per-section shape without recomputing anything. Recomputing totals beside the engine is the exact defect corrected in the report builders on 2026-08-09.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/section-subtotals.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { sectionSubtotals } from '../section-subtotals';
import { calculateAssessmentSummary } from '../assessment';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Item',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

describe('sectionSubtotals', () => {
  test('each section total equals the engine figure it came from', () => {
    const rows = [
      row({ partType: 'metal', assessed: 10000, section: 'parts' }),
      row({ partType: 'labour', assessed: 2000, section: 'labour' }),
      row({ partType: 'paint', assessed: 5000, section: 'paint' }),
    ];
    const summary = calculateAssessmentSummary(rows, 38, 'standard');
    const s = sectionSubtotals(summary);

    expect(s.parts.base).toBe(summary.partsBase);
    expect(s.parts.total).toBe(summary.partsTotal);
    expect(s.labour.base).toBe(summary.labourOnlyBase);
    expect(s.labour.total).toBe(summary.labourOnlyTotal);
    expect(s.paint.base).toBe(summary.paintOnlyBase);
    expect(s.paint.total).toBe(summary.paintOnlyTotal);
  });

  test('gst is the difference between total and base', () => {
    const rows = [row({ partType: 'metal', assessed: 10000, gst: 28 })];
    const summary = calculateAssessmentSummary(rows, 38, 'standard');
    const s = sectionSubtotals(summary);

    // 10000 at 25% dep = 7500 base; 28% GST = 2100
    expect(s.parts.base).toBeCloseTo(7500, 2);
    expect(s.parts.gst).toBeCloseTo(2100, 2);
    expect(s.parts.total).toBeCloseTo(9600, 2);
  });

  test('the three section totals sum to the grand total', () => {
    const rows = [
      row({ partType: 'metal', assessed: 10000, section: 'parts' }),
      row({ partType: 'plastic', assessed: 4000, section: 'parts' }),
      row({ partType: 'labour', assessed: 2000, section: 'labour' }),
      row({ partType: 'paint', assessed: 5000, section: 'paint' }),
    ];
    const summary = calculateAssessmentSummary(rows, 38, 'standard');
    const s = sectionSubtotals(summary);

    expect(s.parts.total + s.labour.total + s.paint.total).toBeCloseTo(summary.grandTotal, 2);
  });

  test('an empty claim gives three zeroed sections', () => {
    const summary = calculateAssessmentSummary([], 38, 'standard');
    const s = sectionSubtotals(summary);
    for (const key of ['parts', 'labour', 'paint'] as const) {
      expect(s[key]).toEqual({ base: 0, gst: 0, total: 0 });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calculations/__tests__/section-subtotals.test.ts`
Expected: FAIL — `Failed to resolve import "../section-subtotals"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/calculations/section-subtotals.ts`:

```typescript
import type { AssessmentSummary } from '@/types';
import type { AssessmentSection } from '@/types/assessment';

export interface SectionSubtotal {
  /** Assessed amount after depreciation, before GST. */
  base: number;
  gst: number;
  /** base + gst */
  total: number;
}

/**
 * Maps the assessment summary into per-section figures for the grid footers.
 *
 * Every number is read from the summary the engine already produced — nothing
 * is recomputed here. A local recomputation sitting beside the engine is what
 * let the report builders print two different answers on one page.
 */
export function sectionSubtotals(
  summary: AssessmentSummary
): Record<AssessmentSection, SectionSubtotal> {
  const of = (base: number, total: number): SectionSubtotal => ({
    base,
    gst: total - base,
    total,
  });

  return {
    parts: of(summary.partsBase, summary.partsTotal),
    labour: of(summary.labourOnlyBase, summary.labourOnlyTotal),
    paint: of(summary.paintOnlyBase, summary.paintOnlyTotal),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/calculations/__tests__/section-subtotals.test.ts`
Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/section-subtotals.ts src/lib/calculations/__tests__/section-subtotals.test.ts
git commit -m "feat(assessment): per-section subtotals read from the engine

Maps the existing summary into per-section base/GST/total for the grid
footers. Nothing is recomputed -- a local total beside the engine is what
let the report builders print two different answers on one page."
```

---

## Task 5: Serial numbers survive grouping

**Files:**
- Test: `src/lib/calculations/__tests__/serial-numbers-sectioned.test.ts`

**Interfaces:**
- Consumes: `buildSerialMap` from `@/lib/calculations/serial-numbers`

**Why:** `buildSerialMap` counts per section in array order. Grouping rows physically must not renumber anything, because those serials appear on both the Final Report and the Bill Check and the insurer cross-references them. This task adds no production code — it locks the invariant before the UI starts reordering rows.

- [ ] **Step 1: Write the test**

Create `src/lib/calculations/__tests__/serial-numbers-sectioned.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { buildSerialMap } from '../serial-numbers';
import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

function row(id: string, section: AssessmentSection): AssessmentRow {
  return {
    id,
    particulars: id.toUpperCase(),
    estimated: 1000,
    assessed: 1000,
    partType: section === 'labour' ? 'labour' : section === 'paint' ? 'paint' : 'metal',
    gst: 18,
    section,
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
  };
}

const SECTION_ORDER: AssessmentSection[] = ['parts', 'labour', 'paint'];

/** How the sectioned grid renders: same rows, grouped, relative order kept. */
function grouped(rows: AssessmentRow[]): AssessmentRow[] {
  return SECTION_ORDER.flatMap(s => rows.filter(r => r.section === s));
}

describe('serial numbers under section grouping', () => {
  test('grouping interleaved rows does not renumber them', () => {
    const interleaved = [
      row('p1', 'parts'),
      row('l1', 'labour'),
      row('p2', 'parts'),
      row('t1', 'paint'),
      row('l2', 'labour'),
      row('p3', 'parts'),
    ];

    const before = buildSerialMap(interleaved);
    const after = buildSerialMap(grouped(interleaved));

    for (const r of interleaved) {
      expect(after.get(r.id)).toBe(before.get(r.id));
    }
  });

  test('serials count within a section, not across the claim', () => {
    const rows = [row('p1', 'parts'), row('l1', 'labour'), row('p2', 'parts')];
    const map = buildSerialMap(rows);
    expect(map.get('p1')).toBe(1);
    expect(map.get('p2')).toBe(2);
    expect(map.get('l1')).toBe(1);
  });

  test('reordering within a section does renumber that section only', () => {
    const rows = [row('p1', 'parts'), row('p2', 'parts'), row('l1', 'labour')];
    const swapped = [rows[1], rows[0], rows[2]];
    const map = buildSerialMap(swapped);
    expect(map.get('p2')).toBe(1);
    expect(map.get('p1')).toBe(2);
    expect(map.get('l1')).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/lib/calculations/__tests__/serial-numbers-sectioned.test.ts`
Expected: PASS — 3 passed. This test documents existing correct behaviour; it should pass immediately. If it fails, stop and report — the grouping assumption in the spec is wrong and the design needs revisiting.

- [ ] **Step 3: Commit**

```bash
git add src/lib/calculations/__tests__/serial-numbers-sectioned.test.ts
git commit -m "test(assessment): lock serial numbers against section grouping

Serials appear on both the Final Report and the Bill Check and the
insurer cross-references them, so grouping rows by section must not
renumber anything."
```

---

## Task 6: Selection hook with per-section ticks and range clamping

**Files:**
- Create: `src/components/claim/useGridSelection.ts`
- Test: `src/components/claim/__tests__/grid-selection.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export function clampRangeToSection(
    rows: AssessmentRow[], anchorId: string, focusId: string
  ): { startIdx: number; endIdx: number } | null;

  export function useGridSelection(rows: AssessmentRow[]): {
    selected: Set<string>;
    toggleSelect: (id: string) => void;
    toggleSectionSelectAll: (sectionRowIds: string[]) => void;
    sectionTickState: (sectionRowIds: string[]) => 'none' | 'some' | 'all';
    clearSelection: () => void;
    isCellSelected: (rowId: string, columnKey: string) => boolean;
    handleCellMouseDown: (e: React.MouseEvent<HTMLTableSectionElement>) => void;
    setCellSelection: (v: { columnKey: string; anchorRowId: string; focusRowId: string } | null) => void;
    cellSelection: { columnKey: string; anchorRowId: string; focusRowId: string } | null;
  };
  ```
  Used by Tasks 7 and 8.

**Note:** only `clampRangeToSection` and `sectionTickState` are unit-tested — Vitest has no DOM, so the hook itself cannot be rendered. Export those two as standalone pure functions from the same module so they are testable.

- [ ] **Step 1: Write the failing test**

Create `src/components/claim/__tests__/grid-selection.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { clampRangeToSection, sectionTickState } from '../useGridSelection';
import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

function row(id: string, section: AssessmentSection): AssessmentRow {
  return {
    id,
    particulars: id.toUpperCase(),
    estimated: 1000,
    assessed: 1000,
    partType: section === 'labour' ? 'labour' : section === 'paint' ? 'paint' : 'metal',
    gst: 18,
    section,
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
  };
}

const ROWS = [
  row('p1', 'parts'),
  row('p2', 'parts'),
  row('l1', 'labour'),
  row('l2', 'labour'),
  row('t1', 'paint'),
];

describe('clampRangeToSection', () => {
  test('a range inside one section is returned whole', () => {
    expect(clampRangeToSection(ROWS, 'p1', 'p2')).toEqual({ startIdx: 0, endIdx: 1 });
  });

  test('a range crossing into another section stops at the boundary', () => {
    // Anchored in parts, dragged down into labour: the selection must not
    // extend past the last parts row, because in a sectioned view that
    // renders as a highlight jumping between tables.
    expect(clampRangeToSection(ROWS, 'p1', 'l2')).toEqual({ startIdx: 0, endIdx: 1 });
  });

  test('an upward range crossing a boundary clamps to the section start', () => {
    expect(clampRangeToSection(ROWS, 'l2', 'p1')).toEqual({ startIdx: 2, endIdx: 3 });
  });

  test('a single-row range is valid', () => {
    expect(clampRangeToSection(ROWS, 't1', 't1')).toEqual({ startIdx: 4, endIdx: 4 });
  });

  test('an unknown id yields no range', () => {
    expect(clampRangeToSection(ROWS, 'ghost', 'p1')).toBeNull();
  });
});

describe('sectionTickState', () => {
  test('none when nothing in the section is selected', () => {
    expect(sectionTickState(['p1', 'p2'], new Set())).toBe('none');
  });

  test('some when part of the section is selected', () => {
    expect(sectionTickState(['p1', 'p2'], new Set(['p1']))).toBe('some');
  });

  test('all when every row in the section is selected', () => {
    expect(sectionTickState(['p1', 'p2'], new Set(['p1', 'p2']))).toBe('all');
  });

  test('an empty section is none, never all', () => {
    expect(sectionTickState([], new Set(['p1']))).toBe('none');
  });

  test('selections in other sections do not affect this one', () => {
    expect(sectionTickState(['p1'], new Set(['p1', 'l1', 't1']))).toBe('all');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/claim/__tests__/grid-selection.test.ts`
Expected: FAIL — `Failed to resolve import "../useGridSelection"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/claim/useGridSelection.ts`:

```typescript
'use client';

import React, { useState, useCallback } from 'react';
import type { AssessmentRow } from '@/types/assessment';

export interface CellSelection {
  columnKey: string;
  anchorRowId: string;
  focusRowId: string;
}

export type SectionTickState = 'none' | 'some' | 'all';

/**
 * Row-index range for a column selection, clamped to the anchor's section.
 *
 * Ranges used to resolve straight into the flat row array, so a selection
 * anchored in parts and extended downward swept up labour rows too. Three
 * tables make that visually impossible — the highlight would jump between
 * them — so a range now stops at its own section's boundary.
 */
export function clampRangeToSection(
  rows: AssessmentRow[],
  anchorId: string,
  focusId: string
): { startIdx: number; endIdx: number } | null {
  const anchorIdx = rows.findIndex(r => r.id === anchorId);
  const focusIdx = rows.findIndex(r => r.id === focusId);
  if (anchorIdx === -1 || focusIdx === -1) return null;

  const section = rows[anchorIdx].section;
  const start = Math.min(anchorIdx, focusIdx);
  const end = Math.max(anchorIdx, focusIdx);

  // Walk outward from the anchor and stop at the first row of another section.
  let startIdx = anchorIdx;
  for (let i = anchorIdx; i >= start; i--) {
    if (rows[i].section !== section) break;
    startIdx = i;
  }
  let endIdx = anchorIdx;
  for (let i = anchorIdx; i <= end; i++) {
    if (rows[i].section !== section) break;
    endIdx = i;
  }

  return { startIdx, endIdx };
}

/** Tri-state for a section's header tick box. An empty section is never 'all'. */
export function sectionTickState(
  sectionRowIds: string[],
  selected: Set<string>
): SectionTickState {
  if (sectionRowIds.length === 0) return 'none';
  const hits = sectionRowIds.filter(id => selected.has(id)).length;
  if (hits === 0) return 'none';
  return hits === sectionRowIds.length ? 'all' : 'some';
}

export function useGridSelection(rows: AssessmentRow[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cellSelection, setCellSelection] = useState<CellSelection | null>(null);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /** Ticks or clears one section without disturbing selections elsewhere. */
  const toggleSectionSelectAll = useCallback((sectionRowIds: string[]) => {
    setSelected(prev => {
      const next = new Set(prev);
      const allOn = sectionRowIds.length > 0 && sectionRowIds.every(id => next.has(id));
      for (const id of sectionRowIds) {
        if (allOn) next.delete(id); else next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const isCellSelected = useCallback((rowId: string, columnKey: string): boolean => {
    if (!cellSelection || cellSelection.columnKey !== columnKey) return false;
    const range = clampRangeToSection(rows, cellSelection.anchorRowId, cellSelection.focusRowId);
    if (!range) return false;
    const rowIdx = rows.findIndex(r => r.id === rowId);
    return rowIdx >= range.startIdx && rowIdx <= range.endIdx;
  }, [cellSelection, rows]);

  const handleCellMouseDown = useCallback((e: React.MouseEvent<HTMLTableSectionElement>) => {
    const td = (e.target as HTMLElement).closest('td');
    if (!td) return;
    const columnKey = (td as HTMLElement).dataset.columnKey;
    const tr = td.closest('tr');
    const rowId = (tr as HTMLElement | null)?.dataset.rowId;
    if (!rowId || !columnKey) return;

    if (e.shiftKey && cellSelection && cellSelection.columnKey === columnKey) {
      setCellSelection(prev => (prev ? { ...prev, focusRowId: rowId } : null));
    } else {
      setCellSelection({ columnKey, anchorRowId: rowId, focusRowId: rowId });
    }
  }, [cellSelection]);

  return {
    selected,
    toggleSelect,
    toggleSectionSelectAll,
    sectionTickState: (ids: string[]) => sectionTickState(ids, selected),
    clearSelection,
    isCellSelected,
    handleCellMouseDown,
    cellSelection,
    setCellSelection,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/claim/__tests__/grid-selection.test.ts`
Expected: PASS — 10 passed.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/claim/useGridSelection.ts src/components/claim/__tests__/grid-selection.test.ts
git commit -m "feat(assessment): selection hook with per-section ticks and clamped ranges

Column ranges used to resolve straight into the flat row array, so a
selection anchored in parts and dragged down swept up labour rows too.
Three tables make that visually impossible, so a range now stops at its
own section's boundary. Section tick boxes are tri-state and independent."
```

---

## Task 7: Extract the per-section table component

**Files:**
- Create: `src/components/claim/AssessmentSectionTable.tsx`
- Modify: `src/components/claim/AssessmentGrid.tsx`

**Interfaces:**
- Consumes: `useGridSelection` (Task 6), `sectionSubtotals` (Task 4), `addAssessmentRowToSection` (Task 3)
- Produces: `<AssessmentSectionTable />` with props:
  ```typescript
  interface AssessmentSectionTableProps {
    section: AssessmentSection;
    title: string;
    rows: AssessmentRow[];          // this section's rows, in array order
    allRows: AssessmentRow[];       // the full flat list, for serial + index math
    subtotal: SectionSubtotal;
    visible: Record<OptionalColumn, boolean>;
    selection: ReturnType<typeof useGridSelection>;
    ageMonths: number;
    depreciationType: DepreciationType;
    duplicateParticulars: Set<string>;
  }
  ```
  The component reads `moveRowToSection`, `updateAssessmentRow`, `deleteAssessmentRow`, `toggleRowAllowed` and `addAssessmentRowToSection` from `useClaimStore()` directly, as `AssessmentGrid` does today — they are not passed as props.

**This is a mechanical extraction, not a rewrite.** Move the existing `<thead>`, the row-rendering `map` and the `SortableRow` usage out of `AssessmentGrid.tsx` into the new component **unchanged**, except for: the header tick box calling `selection.toggleSectionSelectAll(rows.map(r => r.id))` instead of the global toggle, and the addition of the subtotal footer row.

- [ ] **Step 1: Create the component by moving existing markup**

Create `src/components/claim/AssessmentSectionTable.tsx`. Move, verbatim from `AssessmentGrid.tsx`:
- the `SortableRow` wrapper component (currently near line 120)
- the entire `<table>` element including `<thead>` (currently lines 496–543)
- the `<tbody>` and the `assessmentRows.map(...)` body (currently lines 544 onward)

Replace inside the moved code:
- `assessmentRows` → `rows` (the section's rows)
- `rowIds` → `rows.map(r => r.id)`
- the select-all `onChange` → `() => selection.toggleSectionSelectAll(rows.map(r => r.id))`
- `checked={allSelected}` → `checked={selection.sectionTickState(rows.map(r => r.id)) === 'all'}`
- the `indeterminate` ref → `el.indeterminate = selection.sectionTickState(rows.map(r => r.id)) === 'some'`
- `selected.has(...)`, `toggleSelect`, `isCellSelected`, `handleCellMouseDown` → the same names off `selection.`
- the serial-number `placeholder={String(idx + 1)}` → `placeholder={String(sectionIndex + 1)}` where `sectionIndex` is the row's index **within this section**

Wrap the table in a section heading:

```tsx
<div className="mb-6">
  <div className="flex items-center justify-between px-1 py-2">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {title} <span className="ml-2 opacity-60">({rows.length})</span>
    </h3>
    <button
      onClick={() => addAssessmentRowToSection(section)}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-[11px] font-semibold transition-colors"
    >
      <PlusCircle size={12} /> Add row
    </button>
  </div>
  {/* moved <table> goes here */}
</div>
```

- [ ] **Step 2: Add the subtotal footer**

Inside the moved `<table>`, immediately before the closing `</table>` tag and after `</tbody>`, add:

```tsx
<tfoot>
  <tr className="bg-muted/40 font-semibold text-xs">
    <td colSpan={totalCols - 3} className="px-2 py-2 text-right text-muted-foreground">
      {title} subtotal
    </td>
    <td className="px-2 py-2 text-right" title="Assessed after depreciation, before GST">
      {formatCurrency(subtotal.base)}
    </td>
    <td className="px-2 py-2 text-right" title="GST on this section">
      {formatCurrency(subtotal.gst)}
    </td>
    <td className="px-2 py-2 text-right text-primary" title="Section total including GST">
      {formatCurrency(subtotal.total)}
    </td>
  </tr>
</tfoot>
```

`totalCols` is `9 + visibleCount`, computed in the component from the `visible` prop exactly as `AssessmentGrid` does today.

- [ ] **Step 3: Route the type dropdown through the store action**

In the moved type-dropdown `onChange` (currently `AssessmentGrid.tsx` lines 701–707), replace:

```tsx
onChange={(e) => {
  const val = e.target.value as PartType;
  updateAssessmentRow(row.id, {
    partType: val,
    section: (val === 'labour' || val === 'paint') ? val : 'parts'
  });
}}
```

with:

```tsx
onChange={(e) => {
  const val = e.target.value as PartType;
  const target: AssessmentSection =
    val === 'labour' ? 'labour' : val === 'paint' ? 'paint' : 'parts';

  if (target !== row.section) {
    // Same action the drag handler uses, so the two cannot drift apart.
    // It owns the part-type memory and clears any manual dep override.
    const lastOfTarget = allRows.reduce(
      (acc, r, i) => (r.section === target ? i : acc), -1
    );
    moveRowToSection(row.id, target, lastOfTarget === -1 ? allRows.length : lastOfTarget + 1);
  } else {
    updateAssessmentRow(row.id, { partType: val });
  }
}}
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: TS silent; build completes.

- [ ] **Step 5: Commit**

```bash
git add src/components/claim/AssessmentSectionTable.tsx src/components/claim/AssessmentGrid.tsx
git commit -m "refactor(assessment): extract the per-section table component

Mechanical move of the table markup out of AssessmentGrid so it can be
rendered once per section, plus a subtotal footer.

The type dropdown now routes through moveRowToSection instead of writing
partType and section directly, so it shares the drag path's part-type
memory and override clearing."
```

---

## Task 8: Render three sections with cross-section drag

**Files:**
- Modify: `src/components/claim/AssessmentGrid.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2–7.

- [ ] **Step 1: Move the early return below every hook**

`AssessmentGrid.tsx` currently has `if (!currentClaim) return null;` at line 355, **before** the `useMemo` at line 380 and the `useCallback`s after it. That is a Rules of Hooks violation: 17 hooks render with no claim, 18 with one, and React throws *"Rendered more hooks than during the previous render"* when the claim appears or clears while mounted.

Delete that line from its current position and place it immediately before the component's `return (` statement, after every hook call.

- [ ] **Step 2: Render the three sections**

Replace the single `<div className="overflow-x-auto">…</table>…</div>` block inside `<DndContext>` with:

```tsx
const SECTION_ORDER: { section: AssessmentSection; title: string }[] = [
  { section: 'parts',  title: 'Spare Parts' },
  { section: 'labour', title: 'Labour' },
  { section: 'paint',  title: 'Painting' },
];
```

declared at module scope, and in the render body:

```tsx
<div className="overflow-x-auto">
  {assessmentRows.length === 0 ? (
    <div className="px-6 py-12 text-center text-muted-foreground">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
        <Wrench size={20} className="opacity-50" />
      </div>
      <p className="text-sm">No items in assessment.</p>
      <p className="text-xs opacity-60">Click the buttons above to add parts, labour or painting.</p>
    </div>
  ) : (
    SECTION_ORDER.map(({ section, title }) => {
      const sectionRows = assessmentRows.filter(r => r.section === section);
      // A section with no rows is not rendered at all. It reappears the moment
      // a row takes that section via the type dropdown.
      if (sectionRows.length === 0) return null;
      return (
        <AssessmentSectionTable
          key={section}
          section={section}
          title={title}
          rows={sectionRows}
          allRows={assessmentRows}
          subtotal={subtotals[section]}
          visible={visible}
          selection={selection}
          ageMonths={ageMonths}
          depreciationType={depreciationType}
          duplicateParticulars={duplicateParticulars}
        />
      );
    })
  )}
</div>
```

with `const subtotals = useMemo(() => sectionSubtotals(summary), [summary]);` where `summary` comes from `calculateAssessmentSummary(assessmentRows, ageMonths, depreciationType)`.

- [ ] **Step 3: Handle cross-section drops**

Replace `handleDragEnd` with:

```tsx
const handleDragEnd = useCallback((event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const activeRow = assessmentRows.find(r => r.id === active.id);
  const overRow = assessmentRows.find(r => r.id === over.id);
  if (!activeRow || !overRow) return;

  const overIndex = assessmentRows.findIndex(r => r.id === over.id);

  if (activeRow.section === overRow.section) {
    // Within a section: reorder only this section's ids. Safe since the
    // partial-list fix (3b71f0df) — before it, this deleted the other sections.
    const sectionIds = assessmentRows
      .filter(r => r.section === activeRow.section)
      .map(r => r.id);
    const oldIndex = sectionIds.indexOf(active.id as string);
    const newIndex = sectionIds.indexOf(over.id as string);
    reorderAssessmentRows(arrayMove(sectionIds, oldIndex, newIndex));
    return;
  }

  moveRowToSection(activeRow.id, overRow.section, overIndex);
}, [assessmentRows, reorderAssessmentRows, moveRowToSection]);
```

- [ ] **Step 4: Add the missing add-row controls**

In the `CardHeader`, replace the two existing buttons with three calling `addAssessmentRowToSection('parts' | 'labour' | 'paint')`. Painting has never had an add button; this is the first one.

- [ ] **Step 5: Typecheck, full suite, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: TS silent; all tests pass; build completes.

- [ ] **Step 6: Verify in the browser**

The Assessment tab sits behind auth, and `AuthGate` (`src/components/auth/AuthGate.tsx:29`) substitutes the landing page for any route not in its `publicRoutes` list. To see the real grid, temporarily create `src/app/screenshots/zz-gridcheck/page.tsx` (the `/screenshots` prefix is already public), seed the claim store **during render** via a lazy `useState` initialiser so `AssessmentGrid` mounts with a claim already present, render `<AssessmentGrid />`, and check with `mcp__Claude_Browser__*`:

1. Three headings appear, in the order Spare Parts → Labour → Painting
2. A section with no rows is absent
3. Changing a row's type to Paint makes the Painting section appear
4. Dragging a row from Parts onto a Labour row moves it and the type becomes Labour
5. Dragging it back restores its original part type — **not** metal
6. Subtotals match the Summary panel
7. `read_console_messages` shows no hook-order errors

**Delete the harness page before committing.**

- [ ] **Step 7: Commit**

```bash
git add src/components/claim/AssessmentGrid.tsx
git commit -m "feat(assessment): render the grid as three sections

Spare Parts, Labour and Painting, in the order the report prints them, so
screen order matches paper order. Sections with no rows are hidden and
reappear when a row takes that section.

Dragging within a section reorders it; dragging across calls
moveRowToSection, which remembers the part type and clears any manual
depreciation override. Painting gets an add-row button for the first time.

Also moves the early return below every hook call. It sat before a
useMemo, so the component rendered 17 hooks without a claim and 18 with
one, and React threw whenever the claim changed while mounted."
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Three grouped section renders | 8 |
| Per-section subtotal footer | 4, 7 |
| Cross-section drag with type memory | 1, 2, 8 |
| depOverride cleared on move | 1, 2 |
| Per-section select-all, one global delete | 6, 7, 8 |
| Sections hidden when empty | 8 |
| `reorderAssessmentRows` fix | Done — `3b71f0df` |
| Component split under 800 lines | 6, 7 |
| Rules of Hooks fix | 8 Step 1 |
| Dropdown routes through `moveRowToSection` | 7 Step 3 |
| Serial numbers preserved | 5 |
| New rows land in their own section | 3 |
| Reports untouched | Global constraint |

**Type consistency:** `resolveSectionMove` (Task 1) is consumed by `moveRowToSection` (Task 2) with the signature declared in Task 1's Interfaces block. `SectionSubtotal` (Task 4) is the `subtotal` prop type in Task 7. `useGridSelection`'s return shape (Task 6) is the `selection` prop in Task 7. `addAssessmentRowToSection` (Task 3) is called in Tasks 7 and 8. Names match across all tasks.

**Known risk:** Task 7 is the largest and least mechanical-looking step despite being a move. If the extracted component exceeds 800 lines, split the row body into `AssessmentRowCells.tsx` and note it in the commit.
