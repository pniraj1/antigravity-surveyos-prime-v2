'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { getVehicleAgeMonths, toDepreciationType } from '@/lib/calculations/depreciation';
import { calculateAssessmentSummary } from '@/lib/calculations/assessment';
import { sectionSubtotals, SECTION_ORDER } from '@/lib/calculations/section-subtotals';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, PlusCircle, Wrench, ClipboardList } from 'lucide-react';
import { ColumnPicker } from './ColumnPicker';
import { UIICSummaryDialog } from '@/components/dialogs/UIICSummaryDialog';
import { NIAExportDialog } from '@/components/dialogs/NIAExportDialog';
import { OICExportDialog } from '@/components/dialogs/OICExportDialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { AssessmentRow as AssessmentRowType, AssessmentSection } from '@/types';
import {
  parseClipboardValue,
  buildPasteUpdates,
  buildMultiLinePasteUpdates,
  getSelectionClipboardText,
} from '@/lib/utils/grid-paste';
import { useGridSelection, clampRangeToSection } from './useGridSelection';
import { useColumnResize } from '@/hooks/useColumnResize';
import { AssessmentSectionTable } from './AssessmentSectionTable';
import { EstimateViewSwitcher } from './EstimateViewSwitcher';
import { EstimateTallyBanner } from './EstimateTallyBanner';
import {
  OPTIONAL_COLUMNS,
  DEFAULT_VISIBLE,
  loadVisibility,
  saveVisibility,
  imt23ColumnShown,
  duplicateParticularsOf,
  type OptionalColumn,
} from './assessment-grid-config';

// ─── Component ───────────────────────────────────────────────────
/** `footer`: rendered at the end of the scrolling rows (the tab puts the Total Loss form there). */
export function AssessmentGrid({ footer }: { footer?: React.ReactNode } = {}) {
  const {
    currentClaim,
    addAssessmentRowToSection,
    reorderAssessmentRows,
    moveRowToSection,
    updateAssessmentRow,
    deleteAssessmentRow,
    deleteAssessmentRows,
    toggleRowAllowed
  } = useClaimStore();

  const [visible, setVisible] = useState<Record<OptionalColumn, boolean>>(DEFAULT_VISIBLE);

  // Every hook must run before the `if (!currentClaim)` guard further down, so
  // the row list is read defensively here rather than after destructuring.
  const allRows = currentClaim?.assessmentRows ?? [];
  const selection = useGridSelection(allRows);

  const handleBulkDelete = () => {
    if (selection.selected.size === 0) return;
    const n = selection.selected.size;
    if (!confirm(`Delete ${n} selected row${n === 1 ? '' : 's'}? This cannot be undone.`)) return;
    deleteAssessmentRows(Array.from(selection.selected));
    selection.clearSelection();
  };
  const { cellSelection, setCellSelection } = selection;

  // Load from localStorage on mount
  useEffect(() => {
    setVisible(loadVisibility());
  }, []);

  const toggleColumn = (key: OptionalColumn) => {
    const next = { ...visible, [key]: !visible[key] };
    setVisible(next);
    saveVisibility(next);
  };

  const showAll = () => {
    const next = Object.fromEntries(OPTIONAL_COLUMNS.map(c => [c.key, true])) as Record<OptionalColumn, boolean>;
    setVisible(next);
    saveVisibility(next);
  };

  const resetDefaults = () => {
    setVisible({ ...DEFAULT_VISIBLE });
    saveVisibility({ ...DEFAULT_VISIBLE });
  };

  // What the grid actually draws: the picker, with IMT 23 following the policy answer.
  const shown: Record<OptionalColumn, boolean> = {
    ...visible,
    imt23: imt23ColumnShown(visible.imt23, currentClaim?.policyCheck?.imt23, allRows),
  };
  const visibleCount = Object.values(shown).filter(Boolean).length;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleGridNavigation = useCallback((e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    // Escape: clear cell selection
    if (e.key === 'Escape') {
      setCellSelection(null);
      return;
    }

    // Ctrl+D / Cmd+D: Fill Down top cell value into selected column range
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && cellSelection) {
      e.preventDefault();
      const rows = currentClaim?.assessmentRows ?? [];
      const anchor = rows.find(r => r.id === cellSelection.anchorRowId);
      if (!anchor) return;

      const sectionRows = rows.filter(r => r.section === anchor.section);
      const inRangeSet = clampRangeToSection(rows, cellSelection.anchorRowId, cellSelection.focusRowId);
      let targetRows = sectionRows.filter(r => inRangeSet.has(r.id));
      if (targetRows.length < 2) {
        // One cell: copy the cell above into it, as Excel does.
        const i = sectionRows.findIndex(r => r.id === anchor.id);
        if (i < 1) return;
        targetRows = [sectionRows[i - 1], anchor];
      }
      // FormulaNumericInput only resyncs from the store while not focused.
      (document.activeElement as HTMLElement | null)?.blur();

      const topRow = targetRows[0];
      const columnKey = cellSelection.columnKey as keyof AssessmentRowType;
      const topValue = topRow[columnKey];

      for (let i = 1; i < targetRows.length; i++) {
        const row = targetRows[i];
        if (columnKey === 'gst' && row.isDisposal) continue;
        if (columnKey === 'depOverride' && !row.allowed) continue;
        updateAssessmentRow(row.id, { [columnKey]: topValue });
      }
      return;
    }

    // In a text box or textarea plain ↑/↓ and Enter move a row, like Excel.
    // Tab and Shift+Tab move across columns. Dropdowns and Particulars support arrows.
    const el = e.target as HTMLElement;
    const isText = (el instanceof HTMLInputElement && el.type === 'text') || el instanceof HTMLTextAreaElement;
    const isTab = e.key === 'Tab';
    const plain = !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && isText;
    const key = plain && e.key === 'Enter' ? 'ArrowDown' : (isTab ? (e.shiftKey ? 'ArrowLeft' : 'ArrowRight') : e.key);
    if (!e.shiftKey && !(plain && (key === 'ArrowUp' || key === 'ArrowDown')) && !isTab) return;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') return;

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

      if (key === 'ArrowRight') {
        for (let i = colIndex + 1; i < tds.length; i++) {
          const input = tds[i].querySelector('input:not([disabled]):not([type="checkbox"]), textarea:not([disabled]), select:not([disabled])') as HTMLElement;
          if (input) { nextInput = input; break; }
        }
        if (!nextInput && isTab && rowIndex < trs.length - 1) {
          const nextTr = trs[rowIndex + 1] as HTMLElement;
          nextInput = nextTr.querySelector('input:not([disabled]):not([type="checkbox"]), textarea:not([disabled]), select:not([disabled])') as HTMLElement;
          nextRowId = nextTr.dataset.rowId ?? null;
        }
      } else if (key === 'ArrowLeft') {
        for (let i = colIndex - 1; i >= 0; i--) {
          const input = tds[i].querySelector('input:not([disabled]):not([type="checkbox"]), textarea:not([disabled]), select:not([disabled])') as HTMLElement;
          if (input) { nextInput = input; break; }
        }
        if (!nextInput && isTab && rowIndex > 0) {
          const prevTr = trs[rowIndex - 1] as HTMLElement;
          const prevInputs = prevTr.querySelectorAll('input:not([disabled]):not([type="checkbox"]), textarea:not([disabled]), select:not([disabled])');
          if (prevInputs.length > 0) {
            nextInput = prevInputs[prevInputs.length - 1] as HTMLElement;
            nextRowId = prevTr.dataset.rowId ?? null;
          }
        }
      } else if (key === 'ArrowDown') {
        if (rowIndex < trs.length - 1) {
          const nextTr = trs[rowIndex + 1] as HTMLElement;
          nextInput = nextTr.children[colIndex]?.querySelector('input:not([disabled]), textarea:not([disabled]), select:not([disabled])') as HTMLElement;
          nextRowId = nextTr.dataset.rowId ?? null;
        }
      } else if (key === 'ArrowUp') {
        if (rowIndex > 0) {
          const prevTr = trs[rowIndex - 1] as HTMLElement;
          nextInput = prevTr.children[colIndex]?.querySelector('input:not([disabled]), textarea:not([disabled]), select:not([disabled])') as HTMLElement;
          nextRowId = prevTr.dataset.rowId ?? null;
        }
      }

      if (nextInput) {
        nextInput.focus();
        if (nextInput instanceof HTMLInputElement && nextInput.type !== 'checkbox') {
          nextInput.select();
        } else if (nextInput instanceof HTMLTextAreaElement) {
          nextInput.select();
        }
        // Extend cell selection on Shift+Up/Down
        if ((key === 'ArrowUp' || key === 'ArrowDown') && nextRowId) {
          const columnKey = (td as HTMLElement).dataset.columnKey;
          const currentRowId = (tr as HTMLElement).dataset.rowId;
          if (columnKey && plain) {
            // A plain move starts a fresh selection on the new cell, as Excel does.
            setCellSelection({ columnKey, anchorRowId: nextRowId, focusRowId: nextRowId });
          } else if (columnKey) {
            setCellSelection(prev =>
              prev && prev.columnKey === columnKey
                ? { ...prev, focusRowId: nextRowId! }
                : { columnKey, anchorRowId: currentRowId ?? nextRowId!, focusRowId: nextRowId! },
            );
          }
        }
      }
    }
  }, [cellSelection, currentClaim?.assessmentRows, updateAssessmentRow]);

  const handleGridPaste = useCallback((e: React.ClipboardEvent<HTMLTableSectionElement>) => {
    if (!cellSelection) return;

    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const rows = currentClaim?.assessmentRows ?? [];
    const anchor = rows.find(r => r.id === cellSelection.anchorRowId);
    if (!anchor) return;

    const sectionRows = rows.filter(r => r.section === anchor.section);
    const inRangeSet = clampRangeToSection(rows, cellSelection.anchorRowId, cellSelection.focusRowId);
    const targetRows = sectionRows.filter(r => inRangeSet.has(r.id));
    const targetRowIds = targetRows.map(r => r.id);

    if (targetRowIds.length === 0) return;

    const rawLines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (rawLines.length === 0) return;

    // If only 1 cell selected and 1 line pasted:
    // If typing in a text field (particulars, remarks, partNumber), allow native caret paste
    const isSingleCell = targetRowIds.length === 1;
    const isSingleLine = rawLines.length === 1;
    const columnKey = cellSelection.columnKey as keyof AssessmentRowType;
    const textColumns = new Set(['particulars', 'remarks', 'partNumber', 'hsnSac']);
    const target = e.target as HTMLElement;

    if (isSingleCell && isSingleLine && textColumns.has(columnKey) && target.tagName === 'INPUT') {
      return;
    }

    const updates = buildMultiLinePasteUpdates(
      sectionRows,
      targetRowIds,
      columnKey,
      rawLines,
    );

    const updateCount = Object.keys(updates).length;
    if (updateCount > 0) {
      e.preventDefault();
      Object.entries(updates).forEach(([rowId, update]) => {
        updateAssessmentRow(rowId, update);
      });
    }
  }, [cellSelection, currentClaim?.assessmentRows, updateAssessmentRow]);

  const handleGridCopy = useCallback((e: React.ClipboardEvent<HTMLTableSectionElement>) => {
    if (!cellSelection) return;

    // If user highlighted substring text inside an input, let native copy handle it
    const windowSel = window.getSelection()?.toString();
    if (windowSel && windowSel.length > 0) return;

    const rows = currentClaim?.assessmentRows ?? [];
    const anchor = rows.find(r => r.id === cellSelection.anchorRowId);
    if (!anchor) return;

    const sectionRows = rows.filter(r => r.section === anchor.section);
    const inRangeSet = clampRangeToSection(rows, cellSelection.anchorRowId, cellSelection.focusRowId);
    const targetRows = sectionRows.filter(r => inRangeSet.has(r.id));
    const targetRowIds = targetRows.map(r => r.id);

    if (targetRowIds.length === 0) return;

    const text = getSelectionClipboardText(
      sectionRows,
      targetRowIds,
      cellSelection.columnKey as keyof AssessmentRowType,
    );

    if (text) {
      e.clipboardData.setData('text/plain', text);
      e.preventDefault();
    }
  }, [cellSelection, currentClaim?.assessmentRows]);

  const assessmentRows = allRows;
  const [activeEstimateId, setActiveEstimateId] = useState<string | 'all'>('all');

  const displayedRows = useMemo(() => {
    if (activeEstimateId === 'all') return assessmentRows;
    if (activeEstimateId === '__untagged__') return assessmentRows.filter((r) => !r.estimateId);
    return assessmentRows.filter((r) => r.estimateId === activeEstimateId);
  }, [assessmentRows, activeEstimateId]);
  const [showUiicSummary, setShowUiicSummary] = useState(false);
  const [showNiaExport, setShowNiaExport] = useState(false);
  const [showOicExport, setShowOicExport] = useState(false);
  const { width: particularsWidth, resizeHandleProps: particularsResizeHandleProps } = useColumnResize({
    storageKey: 'surveyos_assessment_particulars_width',
    defaultWidth: 240,
    minWidth: 160,
    maxWidth: 750,
  });
  // Normalised, not raw: persisted claims can hold 'Nil Depreciation' or odd
  // casing, and the engine already routes through toDepreciationType. A raw
  // 'Standard' would make the engine depreciate paint while the grid's strict
  // equality check hid the control that governs it.
  const depreciationType = toDepreciationType(currentClaim?.depreciationType);

  const ageMonths = getVehicleAgeMonths(
    currentClaim?.vehicle.dateOfRegistration ?? null,
    currentClaim?.vehicle.yearOfManufacture ?? null,
    currentClaim?.accident.dateAndTime ?? null,
  );

  const duplicateParticulars = useMemo(() => duplicateParticularsOf(assessmentRows), [assessmentRows]);

  const summary = useMemo(
    () => calculateAssessmentSummary(
      assessmentRows, ageMonths, depreciationType, 0, 0, 0,
      currentClaim ?? { depreciationType },
      currentClaim?.feeBill?.towingCharges || 0,
    ),
    [assessmentRows, ageMonths, depreciationType, currentClaim],
  );
  const subtotals = useMemo(() => sectionSubtotals(summary), [summary]);

  /** Excel's status bar: Sum and Count of the selected figures (two or more cells). */
  const selectionSum = useMemo(() => {
    const col = cellSelection?.columnKey as keyof AssessmentRowType | undefined;
    if (!cellSelection || !col || !['quantity', 'estimated', 'assessed'].includes(col)) return null;
    const ids = clampRangeToSection(assessmentRows, cellSelection.anchorRowId, cellSelection.focusRowId);
    if (ids.size < 2) return null;
    const sum = assessmentRows.filter(r => ids.has(r.id)).reduce((a, r) => a + (Number(r[col]) || 0), 0);
    return { count: ids.size, sum };
  }, [cellSelection, assessmentRows]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeRow = assessmentRows.find(r => r.id === active.id);
    const overRow = assessmentRows.find(r => r.id === over.id);
    if (!activeRow || !overRow) return;

    if (activeRow.section === overRow.section) {
      // Only this section's ids. Safe since the partial-list fix (3b71f0df) —
      // before it, this deleted every row it did not name.
      const sectionIds = assessmentRows
        .filter(r => r.section === activeRow.section)
        .map(r => r.id);
      const oldIndex = sectionIds.indexOf(active.id as string);
      const newIndex = sectionIds.indexOf(over.id as string);
      reorderAssessmentRows(arrayMove(sectionIds, oldIndex, newIndex));
      return;
    }

    moveRowToSection(
      activeRow.id,
      overRow.section,
      assessmentRows.findIndex(r => r.id === over.id),
    );
  }, [assessmentRows, reorderAssessmentRows, moveRowToSection]);

  // Dynamic column count: 9 always-on (Drag, Select, Sr, Allowed, Particulars, Assessed, Dep%, Net, Delete) + visible optionals
  const totalCols = 9 + visibleCount;


  if (!currentClaim) return null;

  return (
    <Card className="flex flex-col h-full border-border">
      <CardHeader className="border-b border-border bg-card/50 px-4 py-3 flex flex-row items-center justify-between shrink-0 rounded-t-xl">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Wrench size={16} className="text-primary" />
          Parts Assessment Grid
        </CardTitle>
        <div className="flex flex-wrap justify-end gap-2 items-center [&>button]:whitespace-nowrap">
          <button
            onClick={() => setShowUiicSummary(true)}
            title="Figures for the United India portal"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition-colors border border-amber-500/20 text-xs font-semibold"
          >
            <ClipboardList size={14} /> UIIC Portal
          </button>
          <button
            onClick={() => setShowNiaExport(true)}
            title="Excel for the New India portal"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors border border-emerald-500/20 text-xs font-semibold"
          >
            <ClipboardList size={14} /> NIA Excel
          </button>
          <button
            onClick={() => setShowOicExport(true)}
            title="Excel for the Oriental Insurance portal"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 transition-colors border border-indigo-500/20 text-xs font-semibold"
          >
            <ClipboardList size={14} /> OIC Excel
          </button>
          <button
            onClick={() => addAssessmentRowToSection('paint')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 transition-colors border border-purple-500/20 text-xs font-semibold"
          >
            <PlusCircle size={14} /> Paint Row
          </button>
          <button
            onClick={() => addAssessmentRowToSection('parts')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold transition-colors"
          >
            <PlusCircle size={14} /> Part Row
          </button>
          <button
            onClick={() => addAssessmentRowToSection('labour')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary transition-colors border border-primary/20 text-xs font-semibold"
          >
            <PlusCircle size={14} /> Labour Row
          </button>

          {selection.selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
              title={`Delete ${selection.selected.size} selected row${selection.selected.size === 1 ? '' : 's'}`}
            >
              <Trash2 size={14} /> Delete Selected ({selection.selected.size})
            </button>
          )}

          <ColumnPicker
            columns={OPTIONAL_COLUMNS}
            visible={visible}
            count={visibleCount}
            onToggle={toggleColumn}
            onShowAll={showAll}
            onReset={resetDefaults}
          />
        </div>
      </CardHeader>

      <EstimateViewSwitcher
        rows={assessmentRows}
        activeEstimateId={activeEstimateId}
        onSelectEstimate={setActiveEstimateId}
      />
      <EstimateTallyBanner
        rows={assessmentRows}
        activeEstimateId={activeEstimateId}
        onResetView={() => setActiveEstimateId('all')}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {/* The one scroll box, both ways: column headings stick to its top, and
            there is a single sideways scrollbar at its bottom edge. */}
        <div className="flex-1 min-h-0 overflow-auto">

          {assessmentRows.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                <Wrench size={20} className="opacity-50" />
              </div>
              <p className="text-sm">No items in assessment.</p>
              <p className="text-xs opacity-60">Use the buttons above to add parts, labour or painting.</p>
            </div>
          ) : (
            SECTION_ORDER.map(({ section, title }) => {
              const sectionRows = displayedRows.filter(r => r.section === section);
              // An empty section is not rendered at all. It reappears the
              // moment a row takes that section via the type dropdown.
              if (sectionRows.length === 0) return null;
              return (
                <AssessmentSectionTable
                  key={section}
                  section={section}
                  title={title}
                  rows={sectionRows}
                  allRows={assessmentRows}
                  subtotal={subtotals[section]}
                  visible={shown}
                  visibleCount={visibleCount}
                  selection={selection}
                  ageMonths={ageMonths}
                  depreciationType={depreciationType}
                  duplicateParticulars={duplicateParticulars}
                  onGridKeyDown={handleGridNavigation}
                  onGridPaste={handleGridPaste}
                  onGridCopy={handleGridCopy}
                  particularsWidth={particularsWidth}
                  particularsResizeHandleProps={particularsResizeHandleProps}
                />
              );
            })
          )}
          {footer}
        </div>
      </DndContext>

      {selectionSum && (
        <div className="shrink-0 border-t border-border bg-muted/50 px-4 py-1 text-right text-[11px] text-muted-foreground">
          Sum <span className="font-semibold text-foreground">{selectionSum.sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          {' · '}Count <span className="font-semibold text-foreground">{selectionSum.count}</span>
        </div>
      )}

      {showUiicSummary && (
        <UIICSummaryDialog
          claim={currentClaim}
          rows={assessmentRows}
          ageMonths={ageMonths}
          depType={depreciationType}
          onClose={() => setShowUiicSummary(false)}
        />
      )}

      {showNiaExport && (
        <NIAExportDialog
          claim={currentClaim}
          claimNo={currentClaim?.policy?.claimNumber ?? ''}
          rows={assessmentRows}
          ageMonths={ageMonths}
          depType={depreciationType}
          onClose={() => setShowNiaExport(false)}
        />
      )}

      {showOicExport && currentClaim && (
        <OICExportDialog
          claim={currentClaim}
          claimNo={currentClaim?.policy?.claimNumber ?? ''}
          rows={assessmentRows}
          ageMonths={ageMonths}
          depType={depreciationType}
          onClose={() => setShowOicExport(false)}
        />
      )}
    </Card>
  );
}
