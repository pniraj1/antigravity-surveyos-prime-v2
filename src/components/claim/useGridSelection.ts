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
 * The row ids covered by a column range selection, confined to the anchor's
 * section.
 *
 * Resolved against the anchor's section rows — the order the user actually
 * sees — not the flat claim array.
 *
 * The flat array is interleaved: AI extraction writes rows in estimate order,
 * so `[part, labour, part, paint]` is the normal shape, and the three tables
 * are produced by filtering at render time. An earlier version walked outward
 * from the anchor through the flat array and stopped at the first row of
 * another section. On `[p1, l1, p2]` that meant shift-clicking p2 — the row
 * directly beneath p1 in the Parts table — selected p1 alone, because `l1` sat
 * between them in the array while being invisible in that table.
 *
 * A focus row in a different section clamps to the far end of the anchor's own
 * section, in the direction of the drag.
 */
export function clampRangeToSection(
  rows: AssessmentRow[],
  anchorId: string,
  focusId: string
): Set<string> {
  const anchor = rows.find(r => r.id === anchorId);
  if (!anchor) return new Set();

  const sectionRows = rows.filter(r => r.section === anchor.section);
  const anchorPos = sectionRows.findIndex(r => r.id === anchorId);
  const focusPos = sectionRows.findIndex(r => r.id === focusId);

  let endPos: number;
  if (focusPos !== -1) {
    endPos = focusPos;
  } else {
    // Focus is in another section (or gone). Extend to this section's edge on
    // the side the drag went, using flat position only to read the direction.
    const anchorFlat = rows.findIndex(r => r.id === anchorId);
    const focusFlat = rows.findIndex(r => r.id === focusId);
    if (focusFlat === -1) return new Set([anchorId]);
    endPos = focusFlat > anchorFlat ? sectionRows.length - 1 : 0;
  }

  const [from, to] = anchorPos <= endPos ? [anchorPos, endPos] : [endPos, anchorPos];
  return new Set(sectionRows.slice(from, to + 1).map(r => r.id));
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
    return clampRangeToSection(rows, cellSelection.anchorRowId, cellSelection.focusRowId).has(rowId);
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
