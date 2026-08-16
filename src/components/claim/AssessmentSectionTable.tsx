'use client';

import React from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { getDepreciationRate } from '@/lib/calculations/depreciation';
import { formatCurrency, shouldStartSupplementaryBand } from '@/lib/calculations/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, PlusCircle, PackageX, FileSearch, GripVertical, Wrench, ShieldAlert } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { CATEGORY_BADGE_LABELS, CATEGORY_BADGE_COLOURS } from '@/lib/constants/deduction-categories';
import { SmartRemarksCell } from '@/components/claim/SmartRemarksCell';
import type { PartType, AssessmentRow as AssessmentRowType, AssessmentSection } from '@/types';
import type { DeductionCategory } from '@/lib/constants/deduction-categories';
import type { SectionSubtotal } from '@/lib/calculations/section-subtotals';
import type { useGridSelection } from './useGridSelection';
import { CATEGORY_TAGS, type OptionalColumn } from './assessment-grid-config';

function SortableRow({ id, className, children }: { id: string; className: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <tr
      ref={setNodeRef}
      className={className}
      data-row-id={id}
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

export interface AssessmentSectionTableProps {
  section: AssessmentSection;
  title: string;
  /** This section's rows, in claim-array order. */
  rows: AssessmentRowType[];
  /** The full flat list — needed to resolve a drop index into the claim array. */
  allRows: AssessmentRowType[];
  subtotal: SectionSubtotal;
  visible: Record<OptionalColumn, boolean>;
  visibleCount: number;
  selection: ReturnType<typeof useGridSelection>;
  ageMonths: number;
  depreciationType: 'standard' | 'nil';
  duplicateParticulars: Set<string>;
  onGridKeyDown: (e: React.KeyboardEvent<HTMLTableSectionElement>) => void;
}

/**
 * One section of the assessment grid — Spare Parts, Labour or Painting.
 *
 * The markup is the grid's original single table, rendered once per section.
 * Sections are a rendering concern only: the claim still holds one flat row
 * array, so reports, serial numbers and the calculation engine are untouched.
 */
export function AssessmentSectionTable({
  section,
  title,
  rows,
  allRows,
  subtotal,
  visible,
  visibleCount,
  selection,
  ageMonths,
  depreciationType,
  duplicateParticulars,
  onGridKeyDown,
}: AssessmentSectionTableProps) {
  const {
    currentClaim,
    updateAssessmentRow,
    deleteAssessmentRow,
    toggleRowAllowed,
    moveRowToSection,
    addAssessmentRowToSection,
  } = useClaimStore();

  const sectionRowIds = rows.map(r => r.id);
  const totalCols = 9 + visibleCount;

  return (
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left" style={{ minWidth: visibleCount >= 6 ? '1200px' : '800px' }}>
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase sticky top-0 z-0 shadow-sm">
            <tr>
              {/* ─── Always-on columns ──────────────────── */}
              <th className="px-1 py-2 w-6" aria-label="Drag handle column" />
              <th className="px-2 py-2 font-medium w-8 text-center" title="Select all">
                <input
                  type="checkbox"
                  checked={selection.sectionTickState(sectionRowIds) === 'all'}
                  ref={el => { if (el) el.indeterminate = selection.sectionTickState(sectionRowIds) === 'some'; }}
                  onChange={() => selection.toggleSectionSelectAll(sectionRowIds)}
                  className="rounded border-border h-3.5 w-3.5 cursor-pointer accent-red-600"
                />
              </th>
              <th className="px-2 py-2 font-medium w-10 text-center">Sr</th>
              <th className="px-2 py-2 font-medium w-8 text-center" title="Allowed?"><ShieldAlert size={12} className="mx-auto opacity-50" /></th>
              <th className="px-2 py-2 font-medium min-w-[350px] w-[40%]">Particulars</th>

              {/* ─── Optional columns ──────────────────── */}
              {visible.partNumber && <th className="px-2 py-2 font-medium w-24">Part No.</th>}
              {visible.hsnSac && <th className="px-2 py-2 font-medium w-20">HSN/SAC</th>}
              {visible.type && <th className="px-2 py-2 font-medium w-24">Type</th>}
              {visible.quantity && <th className="px-2 py-2 font-medium w-12 text-center">Qty</th>}
              {visible.unitPrice && <th className="px-2 py-2 font-medium w-20">Estimate(taxable amount)</th>}
              {visible.gst && <th className="px-2 py-2 font-medium w-14 text-center">GST%</th>}
              {visible.disposal && (
                <th className="px-2 py-2 font-medium w-28 text-center text-amber-600" title="Disposal: used/salvaged part — no GST">
                  <span className="flex items-center justify-center gap-1">
                    <PackageX size={11} />
                    Disposal
                  </span>
                </th>
              )}

              {/* ─── Always-on assessment columns ──────── */}
              <th className="px-2 py-2 font-medium w-24 text-primary">Assessed</th>
              <th className="px-2 py-2 font-medium w-16 text-danger text-center">Dep%</th>
              <th className="px-2 py-2 font-medium w-24 text-right">Net (₹)</th>
              {visible.priceWithGst && <th className="px-2 py-2 font-medium w-24 text-right">Price+GST</th>}

              {/* ─── Optional trailing columns ─────────── */}
              {visible.action && <th className="px-2 py-2 font-medium w-20">Action</th>}
              {visible.remarks && <th className="px-2 py-2 font-medium w-28">Remarks</th>}

              {/* ─── Always-on delete ──────────────────── */}
              <th className="px-1 py-2 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody
            className="divide-y divide-border"
            onKeyDown={onGridKeyDown}
            onMouseDown={selection.handleCellMouseDown}
          >
            {rows.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                    <Wrench size={20} className="opacity-50" />
                  </div>
                  <p className="text-sm">No items in assessment.</p>
                  <p className="text-xs opacity-60">Click the buttons above to add parts or labour.</p>
                </td>
              </tr>
            ) : (
              <SortableContext items={sectionRowIds} strategy={verticalListSortingStrategy}>
              {rows.map((row, idx) => {
                const autoDepRate = getDepreciationRate(row.partType, ageMonths, depreciationType);
                const depRate = row.depOverride !== undefined ? row.depOverride : autoDepRate;
                const isDepOverridden = row.depOverride !== undefined;
                const depFactor = depRate / 100;
                const valueAfterDep = row.assessed * (1 - depFactor);
                // Disposal: no GST; surveyor allows disposalPercent% of the depreciated value
                const netAssessed = row.isDisposal
                  ? valueAfterDep * ((row.disposalPercent ?? 50) / 100)
                  : valueAfterDep;
                const priceWithGst = row.allowed
                  ? netAssessed * (1 + (row.isDisposal ? 0 : row.gst) / 100)
                  : 0;

                const handleEvidenceClick = () => {
                  if (!currentClaim?.id) return;
                  useEvidenceStore.getState().openField(currentClaim.id, {
                    docType: 'estimate',
                    fieldKey: 'particulars',
                    contextSnippet: row.particulars
                      ? `${row.particulars}${row.estimated ? ` — Taxable: ₹${row.estimated}` : ''}${row.partNumber ? ` (Part No: ${row.partNumber})` : ''}`
                      : 'Click any field in the estimate document.',
                  });
                };

                const normalizedParticulars = row.particulars?.replace(/\s+/g, ' ').trim().toLowerCase();
                const isDuplicate = normalizedParticulars ? duplicateParticulars.has(normalizedParticulars) : false;

                return [
                  // Supplementary divider band (appears before the first supplementary row)
                  shouldStartSupplementaryBand(rows, idx) && (
                    <tr key={`band-${idx}`} className="h-6 bg-gradient-to-r from-muted via-muted to-transparent">
                      <td colSpan={totalCols} className="px-4 py-1.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Supplementary Estimate
                      </td>
                    </tr>
                  ),
                  // Row itself
                  <SortableRow
                    key={row.id}
                    id={row.id}
                    className={`hover:bg-accent/30 transition-colors ${selection.selected.has(row.id) ? 'bg-red-500/5' : ''} ${!row.allowed ? 'opacity-40 bg-muted/20' : ''} ${isDuplicate ? 'bg-orange-500/10' : ''} ${row.isDisposal && row.allowed ? 'bg-amber-500/5' : ''}`}
                  >
                    {/* Select checkbox — always on */}
                    <td className={`px-2 py-1.5 text-center ${isDuplicate ? 'border-l-4 border-orange-500' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selection.selected.has(row.id)}
                        onChange={() => selection.toggleSelect(row.id)}
                        className="rounded border-border h-3.5 w-3.5 cursor-pointer accent-red-600"
                      />
                    </td>
                    {/* Sr No — always on, editable */}
                    <td className={`px-1 py-1.5${selection.isCellSelected(row.id, 'srNo') ? ' ring-2 ring-blue-400 ring-inset' : ''}`} data-column-key="srNo">
                      <Input
                        type="number"
                        value={row.srNo ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          updateAssessmentRow(row.id, {
                            srNo: raw === '' ? undefined : Math.max(0, parseInt(raw, 10) || 0),
                          });
                        }}
                        className="h-7 w-10 text-[11px] text-center font-medium text-muted-foreground bg-transparent border-transparent hover:border-input focus:bg-background px-0"
                        placeholder={String(idx + 1)}
                        min="0"
                        title="Serial number — editable"
                      />
                    </td>
                    {/* Allowed — always on */}
                    <td className="px-2 py-1.5 text-center">
                      <input 
                        type="checkbox" 
                        checked={row.allowed}
                        onChange={() => toggleRowAllowed(row.id)}
                        className="rounded border-border focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary" 
                      />
                    </td>
                    {/* Particulars — always on — click opens Evidence Viewer */}
                    <td className={`px-2 py-1.5${selection.isCellSelected(row.id, 'particulars') ? ' ring-2 ring-blue-400 ring-inset' : ''}`} data-column-key="particulars">
                      <div className="relative group flex items-start gap-1">
                        {/*
                          A textarea, not an Input: an <input> cannot wrap, so a
                          long description scrolled out of sight and the only way
                          to read it was the tooltip. `field-sizing-content` (on
                          the shared Textarea) grows the box to fit its text, so
                          the row is one line tall until it needs to be more.
                        */}
                        <Textarea
                          value={row.particulars}
                          onChange={(e) => updateAssessmentRow(row.id, { particulars: e.target.value })}
                          onKeyDown={(e) => {
                            // Enter would insert a newline that follows the item
                            // into every report, where it has nowhere to go.
                            // Commit and leave the cell instead, as the Input did.
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                          rows={1}
                          className="min-h-7 py-1 px-2 text-xs font-semibold leading-snug bg-transparent border-transparent hover:border-input focus:bg-background resize-none"
                          placeholder="Item Description"
                          title={row.particulars}
                        />
                        <button
                          type="button"
                          onClick={handleEvidenceClick}
                          title="View in Evidence Viewer"
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                        >
                          <FileSearch size={12} />
                        </button>
                        {row.deductionCategory && (() => {
                          const tag = CATEGORY_TAGS.find((t: { value: DeductionCategory }) => t.value === row.deductionCategory);
                          return tag ? (
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${tag.color}`}>
                              {tag.label}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </td>

                    {/* ─── Optional columns ────────────────── */}
                    {visible.partNumber && (
                      <td className={`px-1 py-1.5${selection.isCellSelected(row.id, 'partNumber') ? ' ring-2 ring-blue-400 ring-inset' : ''}`} data-column-key="partNumber">
                        <Input
                          value={row.partNumber || ''}
                          onChange={(e) => updateAssessmentRow(row.id, { partNumber: e.target.value })}
                          className="h-7 text-[11px] bg-transparent border-transparent hover:border-input focus:bg-background px-1 font-mono"
                          placeholder="—"
                        />
                      </td>
                    )}
                    {visible.hsnSac && (
                      <td className={`px-1 py-1.5${selection.isCellSelected(row.id, 'hsnSac') ? ' ring-2 ring-blue-400 ring-inset' : ''}`} data-column-key="hsnSac">
                        <Input
                          value={row.hsnSac || ''}
                          onChange={(e) => updateAssessmentRow(row.id, { hsnSac: e.target.value })}
                          className="h-7 text-[11px] bg-transparent border-transparent hover:border-input focus:bg-background px-1 font-mono"
                          placeholder="—"
                        />
                      </td>
                    )}
                    {visible.type && (
                      <td className={`px-1 py-1.5${selection.isCellSelected(row.id, 'partType') ? ' ring-2 ring-blue-400 ring-inset' : ''}`} data-column-key="partType">
                        <select
                          value={row.partType}
                          onChange={(e) => {
                            const val = e.target.value as PartType;
                            const target: AssessmentSection =
                              val === 'labour' ? 'labour' : val === 'paint' ? 'paint' : 'parts';
                            if (target === row.section) {
                              updateAssessmentRow(row.id, { partType: val });
                              return;
                            }
                            // Same action the drag handler uses, so the section
                            // change and the dep-override clearing cannot drift
                            // apart between the two paths.
                            let lastOfTarget = -1;
                            allRows.forEach((r, i) => { if (r.section === target) lastOfTarget = i; });
                            moveRowToSection(
                              row.id,
                              target,
                              lastOfTarget === -1 ? allRows.length : lastOfTarget + 1,
                            );
                            // The remembered part type exists for DRAGGING,
                            // where no type is stated. Here the surveyor named
                            // one, so it wins — otherwise picking "Metal" on a
                            // paint row silently hands back "Plastic".
                            if (target === 'parts') {
                              updateAssessmentRow(row.id, { partType: val });
                            }
                          }}
                          className={`h-7 w-full text-[11px] rounded-md border border-transparent hover:border-input focus:border-input focus:bg-background bg-transparent px-1 disabled:cursor-not-allowed
                            ${row.partType === 'metal' ? 'text-blue-500' : 
                              row.partType === 'plastic' ? 'text-amber' : 
                              row.partType === 'fiberglass' ? 'text-fuchsia-500' :
                              row.partType === 'glass' ? 'text-teal' : 
                              row.partType === 'paint' ? 'text-purple-500' : 
                              'text-sidebar-foreground'} font-medium
                          `}
                        >
                          <option value="metal">🟦 Metal</option>
                          <option value="plastic">🟧 Plastic</option>
                          <option value="fiberglass">🟪 Fibre</option>
                          <option value="glass">🟩 Glass</option>
                          <option value="paint">🎨 Paint</option>
                          <option value="labour">⚙️ Labour</option>
                        </select>
                      </td>
                    )}
                    {visible.quantity && (
                      <td className={`px-1 py-1.5${selection.isCellSelected(row.id, 'quantity') ? ' ring-2 ring-blue-400 ring-inset' : ''}`} data-column-key="quantity">
                        <Input
                          type="number"
                          value={row.quantity || ''}
                          onChange={(e) => updateAssessmentRow(row.id, { quantity: parseInt(e.target.value) || 1 })}
                          className="h-7 text-[11px] text-center border-transparent hover:border-input focus:bg-background px-0"
                          placeholder="1"
                          min="1"
                        />
                      </td>
                    )}
                    {visible.unitPrice && (
                      <td className={`px-1 py-1.5${selection.isCellSelected(row.id, 'estimated') ? ' ring-2 ring-blue-400 ring-inset' : ''}`} data-column-key="estimated">
                        <Input
                          type="number"
                          value={row.estimated || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateAssessmentRow(row.id, {
                              estimated: val,
                              // if this row is already marked allowed, keep assessed in sync
                              ...(row.allowed && { assessed: val }),
                            });
                          }}
                          className="h-7 text-[11px] text-right bg-transparent border-transparent hover:border-input focus:bg-background px-1"
                          placeholder="0.00"
                          min="0"
                        />
                      </td>
                    )}
                    {visible.gst && (
                      <td className={`px-1 py-1.5${selection.isCellSelected(row.id, 'gst') ? ' ring-2 ring-blue-400 ring-inset' : ''}`} data-column-key="gst">
                        <Input
                          type="number"
                          value={row.isDisposal ? 0 : row.gst}
                          onChange={(e) => updateAssessmentRow(row.id, { gst: parseInt(e.target.value) || 0 })}
                          disabled={!!row.isDisposal}
                          className="h-7 text-[11px] text-center border-transparent hover:border-input focus:bg-background px-0 disabled:opacity-40 disabled:cursor-not-allowed"
                          placeholder="18"
                          title={row.isDisposal ? 'No GST on disposal parts' : undefined}
                        />
                      </td>
                    )}

                    {/* ─── Disposal column ─────────────────── */}
                    {visible.disposal && (
                      <td className={`px-2 py-1.5${selection.isCellSelected(row.id, 'isDisposal') ? ' ring-2 ring-blue-400 ring-inset' : ''}`} data-column-key="isDisposal">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={!!row.isDisposal}
                            onChange={(e) => updateAssessmentRow(row.id, { isDisposal: e.target.checked })}
                            className="h-3.5 w-3.5 cursor-pointer rounded accent-amber-500 shrink-0"
                            title="Disposal / Used Part (No GST)"
                          />
                          {row.isDisposal && (
                            <div className="flex items-center gap-0.5">
                              <Input
                                type="number"
                                value={row.disposalPercent ?? 50}
                                onChange={(e) => updateAssessmentRow(row.id, { disposalPercent: parseFloat(e.target.value) || 0 })}
                                className="h-6 w-12 text-[11px] text-center px-0 font-medium"
                                style={{ borderColor: 'var(--color-status-warning)', background: 'var(--color-status-warning-tint)', color: 'var(--color-status-warning)' }}
                                min="0"
                                max="100"
                                title="Disposal % of depreciated value"
                              />
                              <span className="text-[10px] font-medium text-[var(--color-status-warning)]">%</span>
                            </div>
                          )}
                        </div>
                      </td>
                    )}

                    {/* ─── Always-on assessment columns ────── */}
                    <td className={`px-1 py-1.5${selection.isCellSelected(row.id, 'assessed') ? ' ring-2 ring-blue-400 ring-inset' : ''}`} data-column-key="assessed">
                      <Input
                        type="number"
                        value={row.assessed || ''}
                        onChange={(e) => updateAssessmentRow(row.id, { assessed: parseFloat(e.target.value) || 0 })}
                        className="h-7 text-[11px] text-right font-medium text-primary bg-transparent border-transparent hover:border-input focus:bg-background px-1"
                        placeholder="0.00"
                        min="0"
                      />
                    </td>
                    <td className={`px-1 py-1 text-center${selection.isCellSelected(row.id, 'depOverride') ? ' ring-2 ring-blue-400 ring-inset' : ''}`} data-column-key="depOverride">
                      {row.allowed ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={row.depOverride !== undefined ? row.depOverride : autoDepRate}
                          onChange={e => {
                            const raw = e.target.value;
                            if (raw === '') {
                              updateAssessmentRow(row.id, { depOverride: undefined });
                            } else {
                              const v = Math.min(100, Math.max(0, Number(raw)));
                              updateAssessmentRow(row.id, { depOverride: v === autoDepRate ? undefined : v });
                            }
                          }}
                          className={`w-12 text-center text-[11px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-[var(--color-status-warning)] ${
                            isDepOverridden
                              ? 'bg-[var(--color-status-warning-tint)] border-[var(--color-status-warning)] text-[var(--color-status-warning)]'
                              : 'bg-transparent border-transparent text-danger hover:border-input'
                          }`}
                          title={isDepOverridden ? `Auto: ${autoDepRate}% — Click to clear override` : `IRDAI rate: ${autoDepRate}%`}
                        />
                      ) : '-'}
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs font-medium tabular-nums">
                      {row.allowed ? (
                        <span className={row.isDisposal ? 'text-amber-700' : ''}>
                          {formatCurrency(netAssessed)}
                          {row.isDisposal && (
                            <span
                              className="ml-1 inline-block text-[8px] font-medium uppercase tracking-wide px-1 py-0.5 rounded"
                              style={{ background: 'var(--color-status-warning-tint)', color: 'var(--color-status-warning)' }}
                              title={`Disposal: ${row.disposalPercent ?? 50}% of depreciated value, no GST`}
                            >
                              DISP
                            </span>
                          )}
                        </span>
                      ) : '₹0.00'}
                    </td>
                    {visible.priceWithGst && (
                      <td className="px-2 py-1.5 text-right text-xs font-medium tabular-nums">
                        {row.allowed ? formatCurrency(priceWithGst) : '₹0.00'}
                      </td>
                    )}

                    {/* ─── Optional trailing columns ─────────── */}
                    {visible.action && (
                      <td className={`px-1 py-1.5${selection.isCellSelected(row.id, 'action') ? ' ring-2 ring-blue-400 ring-inset' : ''}`} data-column-key="action">
                        <select
                          value={row.action || ''}
                          onChange={(e) => updateAssessmentRow(row.id, { action: e.target.value as any })}
                          className="h-7 w-full text-[11px] rounded-md border border-transparent hover:border-input focus:border-input bg-transparent px-1 font-medium"
                        >
                          <option value="">—</option>
                          <option value="replace">Replace</option>
                          <option value="repair">Repair</option>
                          <option value="disallow">Disallow</option>
                        </select>
                      </td>
                    )}
                    {visible.remarks && (
                      <td className="px-1 py-1.5" data-column-key="remarks">
                        <SmartRemarksCell
                          row={row}
                          autoDepRate={autoDepRate}
                          onUpdate={(updates) => updateAssessmentRow(row.id, updates)}
                        />
                      </td>
                    )}

                    {/* Delete — always on */}
                    <td className="px-1 py-1.5 text-center">
                      <button 
                        onClick={() => deleteAssessmentRow(row.id)}
                        className="text-muted-foreground hover:text-danger hover:bg-danger/10 p-1 rounded-md transition-colors"
                        title="Delete Row"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </SortableRow>
                ];
              }).flat()}
              </SortableContext>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 text-xs font-semibold">
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
        </table>
      </div>
    </div>
  );
}
