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
