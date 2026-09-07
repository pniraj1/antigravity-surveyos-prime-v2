'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { calculateAssessmentSummary } from '@/lib/calculations/assessment';
import { sectionSubtotals, SECTION_ORDER } from '@/lib/calculations/section-subtotals';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, PlusCircle, Wrench, Settings2, Eye, EyeOff, ClipboardList } from 'lucide-react';
import { UIICSummaryDialog } from '@/components/dialogs/UIICSummaryDialog';
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
import { parseClipboardValue, buildPasteUpdates } from '@/lib/utils/grid-paste';
import { useGridSelection, clampRangeToSection } from './useGridSelection';
import { AssessmentSectionTable } from './AssessmentSectionTable';
import {
  OPTIONAL_COLUMNS,
  DEFAULT_VISIBLE,
  loadVisibility,
  saveVisibility,
  type OptionalColumn,
} from './assessment-grid-config';

// ─── Component ───────────────────────────────────────────────────
export function AssessmentGrid() {
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
  const [showSettings, setShowSettings] = useState(false);
  const { cellSelection, setCellSelection } = selection;
  const settingsRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setVisible(loadVisibility());
  }, []);

  // Close settings panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    if (showSettings) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

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

  const visibleCount = Object.values(visible).filter(Boolean).length;

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

    // Ctrl+V / Cmd+V: paste clipboard value into selected range
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && cellSelection) {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const parsedValue = parseClipboardValue(
          text,
          cellSelection.columnKey as keyof AssessmentRowType,
        );
        // Confine the paste to the anchor's own section. buildPasteUpdates
        // walks the array from anchor to focus, and the claim array is
        // interleaved — without this, pasting down the Parts column writes
        // into the labour and paint rows sitting between them in the array,
        // which are not even on screen in that table.
        const rows = currentClaim?.assessmentRows ?? [];
        const inRange = rows.filter(r =>
          clampRangeToSection(rows, cellSelection.anchorRowId, cellSelection.focusRowId).has(r.id));
        const updates = inRange.length === 0 ? {} : buildPasteUpdates(
          inRange,
          inRange[0].id,
          inRange[inRange.length - 1].id,
          cellSelection.columnKey as keyof AssessmentRowType,
          parsedValue,
        );
        Object.entries(updates).forEach(([rowId, update]) => {
          updateAssessmentRow(rowId, update);
        });
        setCellSelection(null);
      }).catch(() => {
        // Clipboard read denied — silently ignore
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
  }, [cellSelection, currentClaim?.assessmentRows, updateAssessmentRow]);

  const assessmentRows = allRows;
  const [showUiicSummary, setShowUiicSummary] = useState(false);
  const depreciationType = currentClaim?.depreciationType ?? 'standard';

  const ageMonths = getVehicleAgeMonths(
    currentClaim?.vehicle.dateOfRegistration ?? null,
    currentClaim?.vehicle.yearOfManufacture ?? null,
    currentClaim?.accident.dateAndTime ?? null,
  );

  // Find duplicate particulars
  const duplicateParticulars = new Set<string>();
  const seenParticulars = new Set<string>();
  
  assessmentRows.forEach(row => {
    if (row.particulars?.trim()) {
      const normalized = row.particulars.replace(/\s+/g, ' ').trim().toLowerCase();
      if (seenParticulars.has(normalized)) {
        duplicateParticulars.add(normalized);
      } else {
        seenParticulars.add(normalized);
      }
    }
  });

  const summary = useMemo(
    () => calculateAssessmentSummary(
      assessmentRows, ageMonths, depreciationType, 0, 0, 0,
      currentClaim ?? { depreciationType },
    ),
    [assessmentRows, ageMonths, depreciationType, currentClaim],
  );
  const subtotals = useMemo(() => sectionSubtotals(summary), [summary]);

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
      <CardHeader className="border-b border-border bg-card/50 px-4 py-3 flex flex-row items-center justify-between sticky top-0 z-20 rounded-t-xl">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Wrench size={16} className="text-primary" />
          Parts Assessment Grid
        </CardTitle>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowUiicSummary(true)}
            title="Figures for the United India portal"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition-colors border border-amber-500/20 text-xs font-semibold"
          >
            <ClipboardList size={14} /> UIIC Portal
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

          {/* ─── Settings Gear ─────────────────────────── */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all border ${
                showSettings 
                  ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground border-transparent hover:border-border'
              }`}
              title="Toggle column visibility"
            >
              <Settings2 size={14} />
              <span className="hidden sm:inline">Columns</span>
              <span className="ml-0.5 bg-primary/20 text-primary text-[10px] px-1 rounded-full font-medium leading-tight" style={showSettings ? { background: 'rgba(255,255,255,0.2)', color: 'inherit' } : {}}>
                {visibleCount}/{OPTIONAL_COLUMNS.length}
              </span>
            </button>

            {/* ─── Settings Dropdown Panel ─────────────── */}
            {showSettings && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3 py-2.5 border-b border-border bg-muted/30">
                  <p className="text-xs font-semibold text-foreground">Column Visibility</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Toggle columns to keep the grid clean</p>
                </div>
                <div className="p-2 max-h-[300px] overflow-y-auto">
                  {OPTIONAL_COLUMNS.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                        visible[col.key]
                          ? 'bg-primary/8 hover:bg-primary/12'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-7 h-4 rounded-full relative transition-colors ${
                        visible[col.key] ? 'bg-primary' : 'bg-muted-foreground/20'
                      }`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${
                          visible[col.key] ? 'left-3.5' : 'left-0.5'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-foreground">{col.label}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">{col.description}</span>
                      </div>
                      {visible[col.key] 
                        ? <Eye size={12} className="text-primary flex-shrink-0" /> 
                        : <EyeOff size={12} className="text-muted-foreground/40 flex-shrink-0" />
                      }
                    </button>
                  ))}
                </div>
                <div className="px-3 py-2 border-t border-border flex gap-2 bg-muted/20">
                  <button onClick={showAll} className="flex-1 text-[10px] font-semibold text-primary hover:bg-primary/10 rounded-md py-1.5 transition-colors">
                    Show All
                  </button>
                  <button onClick={resetDefaults} className="flex-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted rounded-md py-1.5 transition-colors">
                    Reset Defaults
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto">
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
              const sectionRows = assessmentRows.filter(r => r.section === section);
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
                  visible={visible}
                  visibleCount={visibleCount}
                  selection={selection}
                  ageMonths={ageMonths}
                  depreciationType={depreciationType}
                  duplicateParticulars={duplicateParticulars}
                  onGridKeyDown={handleGridNavigation}
                />
              );
            })
          )}
        </div>
      </DndContext>

      {showUiicSummary && (
        <UIICSummaryDialog
          rows={assessmentRows}
          ageMonths={ageMonths}
          depType={depreciationType}
          onClose={() => setShowUiicSummary(false)}
        />
      )}
    </Card>
  );
}
