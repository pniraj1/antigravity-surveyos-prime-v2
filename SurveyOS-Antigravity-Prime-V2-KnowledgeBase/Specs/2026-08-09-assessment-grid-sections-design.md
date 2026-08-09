# Design: Three Sections in the Assessment Grid

**Date:** 2026-08-09
**Status:** Approved

---

## Problem

The AI categorises every line of an uploaded garage estimate into one of three sections — `parts`, `labour`, `paint` — and every report already groups by those sections. The screen does not. `AssessmentGrid` renders one flat table, so a surveyor reading the grid sees the three kinds of work interleaved in extraction order, while the printed report shows them under three headings.

Two consequences:

1. **Screen order does not match paper order.** The surveyor cannot tie what is on screen to what will print without printing it.
2. **Paint has no way in.** The grid header offers "Part Row" and "Labour Row" buttons only. A paint row can be created solely by AI extraction or by changing an existing row's section by hand.

---

## Goal

Render the assessment grid as three sections — Spare Parts, Labour, Painting — each with its own header, subtotal and add-row control, so the screen matches the report. Allow a miscategorised row to be dragged from one section to another without silently changing its assessed value.

---

## Scope

**In scope:**
- Three grouped section renders over the existing single row list
- Per-section subtotal footer (Assessed after dep · GST · Total)
- Cross-section drag, with part-type memory and depreciation-override clearing
- Per-section select-all, one global bulk delete
- Sections hidden when empty, appearing when a row takes that section
- Fix to `reorderAssessmentRows` data loss (prerequisite)
- Component split of `AssessmentGrid.tsx` (currently 906 lines, over the 800 limit)
- Fix to the Rules of Hooks violation in the region being restructured

**Out of scope:**
- Any change to report builders — they already group by section and must stay untouched
- Per-section column configuration (one shared column set across all three)
- Collapsible sections
- Any change to the calculation engine
- `BillCheckGrid` — a separate component, not part of this work
- Undo for deletion (none exists today; not introduced here)

---

## Prerequisite: `reorderAssessmentRows` drops rows

`src/stores/slices/assessmentSlice.ts:99`

```ts
const reordered = orderedIds.map((id) => rowMap.get(id)).filter(Boolean)
```

The action rebuilds `assessmentRows` from only the IDs passed to it. Any caller supplying a partial list silently deletes every row it omitted, and auto-save persists the loss.

Today the sole caller passes all rows, so it never fires. The obvious sectioned implementation — one sortable context per section, each reordering its own rows — passes one section's IDs and destroys the other two.

**Fix:** rows absent from `orderedIds` keep their current index in the array. The rows named in `orderedIds` are redistributed, in the order given, into the index positions those named rows previously occupied. A full-list call therefore behaves exactly as it does today, and a partial call reorders only its own subset while leaving every other row untouched.

Landed and tested as its own change before any UI work.

---

## Data model

`assessmentRows` remains a single flat `AssessmentRow[]` on the claim. Sections are a rendering concern, not a storage one. This keeps report builders, `buildSerialMap`, `calculateAssessmentSummary`, AI extraction and Bill Check working unchanged.

One new optional field:

```ts
/** The partType this row carried before it was moved out of `parts`.
 *  Restores the original type when the row is moved back, so a round trip
 *  cannot silently re-price the item. */
previousPartType?: PartType;
```

---

## Store: `moveRowToSection`

```ts
moveRowToSection(rowId: string, section: AssessmentSection, targetIndex: number): void
```

Performs the whole cross-section move as one action:

| Step | Rule |
|---|---|
| Leaving `parts` | Stash current `partType` into `previousPartType` |
| Into `labour` | `partType = 'labour'` |
| Into `paint` | `partType = 'paint'` |
| Into `parts` | `partType = previousPartType ?? 'metal'` |
| Always | Clear `depOverride` |
| Always | Reposition the row at `targetIndex` |

`targetIndex` is an index into the flat `assessmentRows` array, resolved by the caller from the drop position — not an index within the destination section.

**Why the part-type memory.** `partType` decides depreciation: plastic 50%, metal by vehicle age, fibre glass 30%, glass and labour and paint Nil. A labour row must carry `partType: 'labour'`, so moving a plastic part into Labour overwrites its type. Without memory, moving it back defaults it to metal. On a ₹10,000 bumper on a three-year-old car that is ₹5,000 assessed becoming ₹7,500 — a ₹2,500 change from two drags, with nothing on screen reporting it.

**Why the override is cleared.** A manual `depOverride` follows the row. Moving a part carrying a 40% override into Labour would depreciate a labour line the tariff sets at Nil, quietly reducing an ₹8,000 line to ₹4,800.

**The existing section dropdown must call this same action.** Two code paths for one operation is how the three copies of the depreciation table came to disagree (see `2026-08-09` fibre glass fix). One path, one behaviour.

---

## Component structure

`AssessmentGrid.tsx` is 906 lines, already past the 800-line limit in `Rules/`. Rendering three tables inline would take it past 1,100.

| File | Responsibility |
|---|---|
| `AssessmentSectionTable.tsx` | One section: header, tick box, rows, subtotal footer, add-row. Rendered three times. |
| `useGridSelection.ts` | Selection state, tri-state header tick boxes, range clamping |
| `AssessmentGrid.tsx` | Orchestrator: drag context, column config, bulk delete, add controls |

Three sections is a loop over one component; the extraction is what makes it one rather than three copies.

### Bundled fix

`AssessmentGrid.tsx:355` has `if (!currentClaim) return null;` before the `useMemo` at line 380 and the callbacks after it — a Rules of Hooks violation. The component renders 17 hooks with no claim and 18 with one, so React throws *"Rendered more hooks than during the previous render"* when the claim changes while mounted.

Masked today because `AssessmentTab.tsx:58` guards the same condition before mounting the grid. Reachable if the claim is cleared while the tab stays mounted — switching claims, signing out, deleting the open claim. The restructure touches this exact region; the early return moves below all hook calls.

---

## Rendering

Section order is fixed: **Parts, Labour, Painting** — matching report sections 8 and 9.

A section renders only when it holds at least one row. An empty section is absent entirely, and appears the moment a row takes that section via the type dropdown.

**Consequence, accepted:** a hidden section cannot be a drop target. The first row of a new section is created through the type dropdown, not by dragging. Cross-section dragging operates between visible sections only.

---

## Drag behaviour

One `DndContext` wrapping all three sections; one `SortableContext` per section holding that section's row IDs.

- **Within a section** — reorder, via the corrected `reorderAssessmentRows`
- **Across sections** — `moveRowToSection` with the drop index

---

## Subtotals

A footer row per section showing **Assessed (after dep) · GST · Total**, read from `calculateAssessmentSummary`, which already exposes `partsBase`/`partsTotal`, `labourOnlyBase`/`labourOnlyTotal` and `paintOnlyBase`/`paintOnlyTotal`.

Read from the engine, never recomputed locally. Local recomputation beside an engine is the precise defect pattern corrected in the report builders on 2026-08-09.

---

## Selection

- Each section header carries its own tri-state tick box selecting only that section's rows
- `Delete Selected (n)` remains a single button showing the combined count, so rows ticked across sections clear in one action
- Column range selection (Shift-click) **clamps to the section of the anchor row**

Range selection currently resolves by index into the flat array, so a range can already span parts and labour rows. In a sectioned view that renders as a highlight jumping between tables, which is why it now stops at the boundary.

---

## Add-row controls

Each visible section carries its own add-row control appending to the end of **that section**, not the end of the grid.

For sections not currently visible, the grid header offers an add control that creates the first row and brings the section into view. This gives Painting a first-class add path for the first time.

---

## Scenarios considered

| Scenario | Resolution |
|---|---|
| Per-section reorder deletes other sections | Prerequisite fix |
| Plastic → Labour → Parts re-prices the item | `previousPartType` |
| Dep% override survives into a labour row | Cleared on move |
| Dropdown and drag diverge | Both call `moveRowToSection` |
| Shift-range spans two sections | Clamped to anchor's section |
| Drag into a hidden section | Not possible; dropdown creates it |
| Last row of a section deleted | Section disappears; other rows unaffected |
| AI extraction adds rows | Appends as today; sections appear automatically |
| Serial numbers shift | Preserved — per-section counters in array order; locked by test |
| Disposal rows in Labour | Remain valid; unaffected |
| Bill Check grid | Separate component; untouched |
| Deleting selected rows | No undo exists; confirm dialog retained |

---

## Testing

**Store**
- `reorderAssessmentRows` with a partial ID list preserves the omitted rows
- `moveRowToSection` round trip (`parts → labour → parts`) restores the original `partType`
- `moveRowToSection` clears `depOverride` in every direction
- The section dropdown and a cross-section drag produce identical row state

**Calculations**
- `buildSerialMap` output is unchanged when rows are grouped by section
- Section subtotals equal the corresponding `calculateAssessmentSummary` fields

**Selection**
- A Shift range anchored in one section does not select rows in another

---

## Risks

**This is a medium refactor, not a layout change.** The store action, the component split and the drag rules are the bulk of the work; the three headings are the smallest part.

**It sits ahead of the Standard Bill Check report**, which remains the original goal and is not yet started.

**Outstanding calculation defects are untouched by this work** and remain open: the Bill Check panel comparing a raw figure against a depreciated one, Section 8 labour/painting disagreeing with the engine on override and disposal rows, and the Section 9 parts subtotal excluding disposal rows from the material columns while including them in the row total.
