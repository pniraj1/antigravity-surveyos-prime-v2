'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Trash2, Settings2, Eye, EyeOff, FileSearch } from 'lucide-react';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import type { AssessmentRow, AssessmentSummary } from '@/types';
import type { DepreciationType } from '@/types/vehicle';
import { shouldStartSupplementaryBand } from '@/lib/calculations/utils';
import { computeRowNet, getDepreciationRate } from '@/lib/calculations';
import { billCheckAssessed } from '@/lib/reports/bill-check-projection';
import {
  sectionSubtotals, billedTotals, SECTION_ORDER, type BilledTotals,
} from '@/lib/calculations/section-subtotals';
import { sectionTickState } from '@/components/claim/useGridSelection';
import {
  OptionalColumn, OPTIONAL_COLUMNS, DEFAULT_VISIBLE, COL_WIDTHS,
  loadVisibility, saveVisibility, statusLabel, type BillStatus,
} from './config';
import { GRID_COLUMNS } from '@/components/claim/grid-columns';
import { AllowanceScopeDialog } from '@/components/dialogs/AllowanceScopeDialog';

interface Props {
  allRows: AssessmentRow[];
  allowedRows: AssessmentRow[];
  /** Engine summary — the source of the per-section assessed subtotals. */
  summary: AssessmentSummary;
  /** Row id → the serial the insurer reads in both PDFs. */
  serials: Map<string, number>;
  updateAssessmentRow: (id: string, updates: Partial<AssessmentRow>) => void;
  deleteAssessmentRow: (id: string) => void;
  deleteAssessmentRows: (ids: string[]) => void;
  claimId: string | null;
  fmt: (n: number) => string;
  /** Vehicle age at the date of loss — feeds the same rate table the report reads. */
  ageMonths: number;
  depreciationType: DepreciationType;
}

export function BillCheckGrid({
  allRows,
  allowedRows,
  summary,
  serials,
  updateAssessmentRow,
  deleteAssessmentRow,
  deleteAssessmentRows,
  claimId,
  fmt,
  ageMonths,
  depreciationType,
}: Props) {
  // Same rate the report computes, so the grid and the PDF cannot disagree.
  const depRateFor = (row: AssessmentRow) =>
    row.depOverride !== undefined ? row.depOverride : getDepreciationRate(row.partType, ageMonths, depreciationType);

  /**
   * The row as this document values it. computeRowNet reads `assessed`, so a
   * raw row makes the screen ignore an allowance the report already applied.
   */
  const asBilled = (row: AssessmentRow): AssessmentRow =>
    ({ ...row, assessed: billCheckAssessed(row) });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState<Record<OptionalColumn, boolean>>(DEFAULT_VISIBLE);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingAllowance, setPendingAllowance] = useState<{ id: string; assessed: number; proposed: number } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  /**
   * Allowing above the assessed figure means editing `assessed` — the field
   * both this grid and the Final Survey Report read, with no snapshot of an
   * issued report anywhere. Writing it directly would silently reprint a
   * report already filed. `billAllowed` is bill-check-only; the surveyor
   * chooses to also touch `assessed` via AllowanceScopeDialog.
   *
   * A row that already carries billAllowed, or a value equal to assessed,
   * does not re-prompt — only the first divergent edit asks.
   */
  const commitAllowance = (row: AssessmentRow, value: number) => {
    if (value === row.assessed || row.billAllowed !== undefined) {
      updateAssessmentRow(row.id, { billAllowed: value });
      return;
    }
    setPendingAllowance({ id: row.id, assessed: row.assessed, proposed: value });
  };

  useEffect(() => { setVisible(loadVisibility()); }, []);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    }
    if (showSettings) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  const toggleColumn = (key: OptionalColumn) => {
    const next = { ...visible, [key]: !visible[key] };
    setVisible(next); saveVisibility(next);
  };
  const showAllCols = () => {
    const next = Object.fromEntries(OPTIONAL_COLUMNS.map(c => [c.key, true])) as Record<OptionalColumn, boolean>;
    setVisible(next); saveVisibility(next);
  };
  const resetDefaults = () => { setVisible({ ...DEFAULT_VISIBLE }); saveVisibility({ ...DEFAULT_VISIBLE }); };
  const visibleCount = Object.values(visible).filter(Boolean).length;

  const buildCols = () => {
    const detailCols = (['partNumber', 'hsnSac', 'section', 'quantity', 'unitPrice', 'gst'] as OptionalColumn[])
      .filter(k => visible[k]).map(k => COL_WIDTHS[k]);
    const priceWithGstCol = visible.priceWithGst ? [COL_WIDTHS.priceWithGst] : [];
    const billedTaxCol = visible.billedTaxable ? [COL_WIDTHS.billedTaxable] : [];
    const remarksCol = visible.remarks ? [COL_WIDTHS.remarks] : [];
    return ['32px', '50px', '2fr', ...detailCols, '100px', '70px', '100px', ...priceWithGstCol, ...billedTaxCol, '120px', ...remarksCol, '40px'].join(' ');
  };
  const gridCols = buildCols();

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  /**
   * Ticks or clears one section without disturbing the others.
   *
   * This used to return `new Set(ids)`, replacing the whole selection. That was
   * harmless while the only caller passed every row, but with a tick box per
   * section it would silently drop a Parts selection the moment Labour was
   * ticked — and the next Delete Selected would act on the wrong rows.
   */
  const toggleSelectAll = (ids: string[]) => {
    setSelected(prev => {
      const next = new Set(prev);
      const allOn = ids.length > 0 && ids.every(id => next.has(id));
      for (const id of ids) {
        if (allOn) next.delete(id); else next.add(id);
      }
      return next;
    });
  };
  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected item${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return;
    deleteAssessmentRows(Array.from(selected));
    setSelected(new Set());
  };
  const handleDeleteRow = (id: string) => {
    if (!confirm('Delete this row? This cannot be undone.')) return;
    deleteAssessmentRow(id);
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const subtotals = sectionSubtotals(summary);

  /**
   * One column-header row, repeated above every section so a section scrolled
   * into view still says what its columns mean — the Assessment tab does the
   * same by rendering one table per section.
   */
  const headerRow = (sectionIds: string[]) => {
    const tick = sectionTickState(sectionIds, selected);
    return (
      <div
        className="px-6 py-3 grid gap-2 text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground border-b border-border"
        style={{ gridTemplateColumns: gridCols, background: 'var(--color-neutral-50)' }}
      >
        <span className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={tick === 'all'}
            ref={el => { if (el) el.indeterminate = tick === 'some'; }}
            onChange={() => toggleSelectAll(sectionIds)}
            className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-status-danger)]"
            title="Select every row in this section"
          />
        </span>
        <span>Sr.</span>
        <span>Particulars</span>
        {visible.partNumber    && <span>Part No.</span>}
        {visible.hsnSac        && <span>HSN/SAC</span>}
        {visible.section       && <span>Section</span>}
        {visible.quantity      && <span>Qty</span>}
        {visible.unitPrice     && <span>{GRID_COLUMNS.unitPrice.label}</span>}
        {visible.gst           && <span>{GRID_COLUMNS.gst.label}</span>}
        <span>Assessed (₹)</span>
        <span>Dep%</span>
        <span>Net (₹)</span>
        {visible.priceWithGst  && <span>{GRID_COLUMNS.priceWithGst.label}</span>}
        {visible.billedTaxable && <span>{GRID_COLUMNS.billedTaxable.label} (₹)</span>}
        <span>Status</span>
        {visible.remarks       && <span>Remarks</span>}
        <span></span>
      </div>
    );
  };

  /**
   * A totals row aligned to the columns above it.
   *
   * Emits the same cells in the same order under the same visibility guards as
   * headerRow. One mismatch shifts every figure a column to the right, which is
   * why both live here rather than being written out per section.
   */
  const totalsRow = (label: string, t: BilledTotals, onDark: boolean) => {
    const money = onDark ? { color: 'var(--color-neutral-50)' } : undefined;
    return (
      <div
        className="px-6 py-3 grid gap-2"
        style={{
          gridTemplateColumns: gridCols,
          background: onDark ? 'var(--color-neutral-900)' : 'var(--color-neutral-100)',
        }}
      >
        <div /><div />
        <div className={`text-xs font-medium uppercase tracking-widest ${onDark ? 'text-primary' : 'text-muted-foreground'}`}>
          {label}
        </div>
        {visible.partNumber    && <div />}
        {visible.hsnSac        && <div />}
        {visible.section       && <div />}
        {visible.quantity      && <div />}
        {visible.unitPrice     && <div className="text-sm font-medium" style={money}>{fmt(t.estimated)}</div>}
        {visible.gst           && <div />}
        <div className="text-sm font-medium" style={money}>{fmt(t.assessed)}</div>
        <div />
        <div />
        {visible.priceWithGst  && <div />}
        {visible.billedTaxable && <div className="text-sm font-medium text-primary">{fmt(t.billedTaxable)}</div>}
        <div className={`text-xs font-medium ${onDark ? 'text-white/50' : 'text-muted-foreground'}`}>
          {fmt(t.notInBill)} not claimed
        </div>
        {visible.remarks && <div />}
        <div />
      </div>
    );
  };

  if (allRows.length === 0) {
    return (
      <div
        className="rounded-2xl p-12 flex flex-col items-center text-center bg-card border border-border"
      >
        <AlertCircle size={28} className="text-muted-foreground" style={{ marginBottom: 12 }} />
        <div className="text-base font-medium mb-1 text-foreground">No items in assessment</div>
        <div className="text-sm text-muted-foreground">
          Go to Assessment tab and add items to begin bill check.
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="rounded-2xl overflow-hidden bg-card border border-border">
      {/* Grid header / toolbar */}
      <div className="px-6 py-4 flex items-start justify-between gap-4" style={{ borderBottom: '1px solid var(--color-neutral-100)', background: 'var(--color-neutral-50)' }}>
        <div>
          <div className="text-sm font-medium text-foreground">
            Step 2 — Verify Each Item ({allRows.length} items · {allowedRows.length} allowed)
          </div>
          <div className="text-xs mt-0.5 text-muted-foreground">
            Mark each item as In Bill / Not In Bill / Partial. Disallowed items are shown greyed out — flagged if workshop billed them anyway.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const zeros = allRows.filter(r => r.assessed === 0 && r.estimated === 0);
              if (zeros.length === 0) { alert('No zero amount parts found.'); return; }
              if (confirm(`Remove ${zeros.length} zero amount parts? This cannot be undone.`)) {
                deleteAssessmentRows(zeros.map(r => r.id));
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all border hover:bg-status-danger-tint text-status-danger border-status-danger bg-card"
            title="Remove all zero amount parts"
          >
            <Trash2 size={14} />
            Remove 0 Amount
          </button>
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all hover:opacity-90 bg-status-danger text-white"
            >
              <Trash2 size={14} />
              Delete Selected ({selected.size})
            </button>
          )}
          {/* Column visibility dropdown */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all border border-border"
              style={{
                background: showSettings ? 'var(--color-neutral-900)' : 'var(--color-neutral-50)',
                color: showSettings ? 'white' : 'var(--color-neutral-600)',
              }}
              title="Toggle column visibility"
            >
              <Settings2 size={14} />
              Columns
              <span
                className={`ml-0.5 text-[10px] px-1.5 rounded-full font-medium ${showSettings ? 'bg-white/20' : 'bg-[var(--color-neutral-100)]'}`}
              >
                {visibleCount}/{OPTIONAL_COLUMNS.length}
              </span>
            </button>
            {showSettings && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl shadow-xl z-50 overflow-hidden bg-card border border-border">
                <div className="px-3 py-2.5 border-b border-border" style={{ background: 'var(--color-neutral-50)' }}>
                  <p className="text-xs font-medium text-foreground">Column Visibility</p>
                  <p className="text-[10px] mt-0.5 text-muted-foreground">Toggle columns to keep the grid clean</p>
                </div>
                <div className="p-2 max-h-[300px] overflow-y-auto">
                  {OPTIONAL_COLUMNS.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-[var(--color-neutral-100)]"
                      style={{ background: visible[col.key] ? 'var(--color-neutral-50)' : 'transparent' }}
                    >
                      <div
                        className="flex-shrink-0 w-7 h-4 rounded-full relative transition-colors"
                        style={{ background: visible[col.key] ? 'var(--color-neutral-900)' : 'var(--color-neutral-200)' }}
                      >
                        <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all" style={{ left: visible[col.key] ? '14px' : '2px' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-foreground">{col.label}</span>
                        <span className="text-[10px] ml-1.5 text-muted-foreground">{col.description}</span>
                      </div>
                      {visible[col.key] ? <Eye size={12} className="text-foreground" /> : <EyeOff size={12} className="text-muted-foreground" />}
                    </button>
                  ))}
                </div>
                <div className="px-3 py-2 flex gap-2 border-t border-border" style={{ background: 'var(--color-neutral-50)' }}>
                  <button onClick={showAllCols} className="flex-1 text-[10px] font-medium rounded-md py-1.5 transition-colors hover:bg-[var(--color-neutral-100)] text-foreground">Show All</button>
                  <button onClick={resetDefaults} className="flex-1 text-[10px] font-medium rounded-md py-1.5 transition-colors hover:bg-[var(--color-neutral-100)] text-foreground">Reset</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: `${800 + visibleCount * 90}px` }}>
          {/*
            Grouped Parts / Labour / Painting, mirroring the Assessment tab and
            the printed Bill Check, which the surveyor reads side by side.

            Grouping also straightens two things the flat list got wrong:
            buildSerialMap numbers per section, so Sr. now runs 1..n instead of
            restarting mid-list; and the supplementary band is computed over the
            section's own rows rather than the interleaved claim array.
          */}
          {SECTION_ORDER.map(({ section, title }) => {
          // Rejected at final survey — already absent from every Bill Check
          // report, and nothing here can give them liability. The header count
          // states how many, and the serial gaps show where they sat.
          //
          // One exception, and it is the whole reason this is not a plain
          // `r.allowed`: a rejected row the workshop billed anyway still needs
          // the surveyor's eye. That is a claim for refused work, and hiding it
          // would hide the one thing on this screen worth acting on.
          const sectionRows = allRows.filter(
            r => r.section === section && (r.allowed || (r.billedAmount ?? 0) > 0),
          );
          // An empty section is not rendered at all, as in AssessmentGrid.
          if (sectionRows.length === 0) return null;
          const sectionIds = sectionRows.map(r => r.id);
          const sub = subtotals[section];
          // Allowed only: sectionSubtotals reads a summary the engine built from
          // allowed rows, and the two footer lines must describe one population.
          const billed = billedTotals(sectionRows.filter(r => r.allowed));

          return (
          <div key={section}>
          {/* Section title — full width, deliberately not a grid row */}
          <div className="px-6 pt-5 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {title} <span className="ml-2 opacity-60">({sectionRows.length})</span>
            </h3>
          </div>

          {headerRow(sectionIds)}

          {sectionRows.map((row, idx) => {
            const isDisallowed = !row.allowed;
            const effectiveStatus: BillStatus = isDisallowed ? 'not-allowed' : (row.billStatus || 'pending');
            const st = statusLabel(effectiveStatus);
            return [
              shouldStartSupplementaryBand(sectionRows, idx) && (
                <div
                  key={`band-${section}-${idx}`}
                  className="px-6 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-gradient-to-r from-muted via-muted to-transparent"
                >
                  Supplementary Estimate
                </div>
              ),
              <div
                key={row.id}
                className="px-6 py-3 grid gap-2 items-center"
                style={{
                  gridTemplateColumns: gridCols,
                  borderBottom: '1px solid var(--color-neutral-100)',
                  background: isDisallowed ? 'var(--color-neutral-100)' : 'transparent',
                  opacity: isDisallowed ? 0.75 : 1,
                }}
              >
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-status-danger)]"
                  />
                </div>
                {/* The number the insurer reads in both PDFs, not the estimate's srNo. */}
                <div className="text-sm font-medium" style={{ color: 'var(--color-neutral-600)' }}>{serials.get(row.id) ?? idx + 1}</div>
                <div
                  className="group text-sm font-medium flex items-center gap-1.5 cursor-pointer select-none text-foreground"
                  style={{ textDecoration: isDisallowed ? 'line-through' : 'none' }}
                  onClick={() => {
                    if (!claimId) return;
                    useEvidenceStore.getState().openField(claimId, {
                      docType: 'final-bill',
                      fieldKey: 'bill_item',
                      contextSnippet: row.particulars
                        ? `${row.particulars}${row.assessed ? ` — Assessed: ₹${row.assessed}` : ''}${row.billedAmount ? ` — Billed: ₹${row.billedAmount}` : ''}`
                        : 'Bill item',
                    });
                  }}
                  title="Click to view in Evidence Viewer"
                >
                  <span>{row.particulars || '—'}</span>
                  <FileSearch size={12} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0 text-primary" />
                </div>
                {visible.partNumber    && <div className="text-xs font-mono" style={{ color: 'var(--color-neutral-600)' }}>{row.partNumber || '—'}</div>}
                {visible.hsnSac        && <div className="text-xs font-mono" style={{ color: 'var(--color-neutral-600)' }}>{row.hsnSac || '—'}</div>}
                {visible.section       && <div><span className="text-[9px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)' }}>{row.section}</span></div>}
                {visible.quantity      && <div className="text-sm font-medium text-center" style={{ color: 'var(--color-neutral-600)' }}>{row.quantity ?? '—'}</div>}
                {visible.unitPrice     && <div className="text-sm font-medium" style={{ color: 'var(--color-neutral-600)' }}>{fmt(row.estimated || 0)}</div>}
                {visible.gst           && <div className="text-xs font-medium text-center" style={{ color: 'var(--color-neutral-600)' }}>{row.gst ?? 18}%</div>}
                <input
                  type="number"
                  value={row.billAllowed ?? row.assessed ?? ''}
                  onChange={e => commitAllowance(row, Number(e.target.value) || 0)}
                  disabled={isDisallowed}
                  title={row.billAllowed !== undefined ? `Allowed above the assessed value of ₹${row.assessed}` : undefined}
                  className="px-2 py-1 rounded-lg text-sm text-right border outline-none w-full border-border font-medium"
                  style={{
                    background: isDisallowed ? 'var(--color-neutral-100)' : 'var(--color-neutral-50)',
                    color: row.billAllowed !== undefined ? 'var(--color-status-warning)' : 'var(--color-foreground)',
                  }}
                />
                <div className="text-xs font-medium text-center" style={{ color: row.depOverride !== undefined ? 'var(--color-status-warning)' : 'var(--color-status-danger)' }}>
                  {row.depOverride !== undefined ? `${row.depOverride}%*` : `${depRateFor(row)}%`}
                </div>
                <div className="text-sm font-medium text-right" style={{ color: 'var(--color-neutral-600)' }}>
                  {fmt(computeRowNet(asBilled(row), depRateFor(row)).netBeforeGst)}
                </div>
                {visible.priceWithGst && (
                  <div className="text-sm font-medium text-right" style={{ color: 'var(--color-neutral-600)' }}>
                    {(() => {
                      const { isDisposal, netBeforeGst } = computeRowNet(asBilled(row), depRateFor(row));
                      return fmt(isDisposal ? netBeforeGst : netBeforeGst * (1 + (row.gst ?? 18) / 100));
                    })()}
                  </div>
                )}
                {visible.billedTaxable && (
                  <input
                    type="number"
                    value={row.billedTaxable ?? ''}
                    onChange={e => {
                      const tax = Number(e.target.value);
                      const gstPct = row.gst ?? 18;
                      updateAssessmentRow(row.id, { billedTaxable: tax, billedAmount: Math.round(tax * (1 + gstPct / 100)) });
                    }}
                    disabled={isDisallowed || row.billStatus === 'not-in-bill'}
                    className="px-2 py-1 rounded-lg text-sm text-right border outline-none w-full border-border text-foreground"
                    style={{ background: isDisallowed || row.billStatus === 'not-in-bill' ? 'var(--color-neutral-100)' : 'var(--color-neutral-50)' }}
                  />
                )}
                {isDisallowed ? (
                  <div
                    className="px-2 py-1 rounded-lg text-[10px] font-medium text-center border border-border"
                    style={{ background: st.bg, color: st.color }}
                    title="This item was marked Not Allowed in Assessment"
                  >
                    {(row.billedAmount ?? 0) > 0 ? '⚠ Billed (Not Allowed)' : 'Not Allowed'}
                  </div>
                ) : (
                  <select
                    value={row.billStatus || 'pending'}
                    onChange={e => {
                      const s = e.target.value as BillStatus;
                      const gstPct = row.gst ?? 18;
                      if (s === 'in-bill') {
                        // "Billed as assessed." assessed is pre-GST, so it is the
                        // taxable basis; billedAmount is the incl-GST display figure.
                        updateAssessmentRow(row.id, {
                          billStatus: s,
                          billedTaxable: row.assessed,
                          billedAmount: Math.round(row.assessed * (1 + gstPct / 100)),
                        });
                      } else if (s === 'not-in-bill') {
                        updateAssessmentRow(row.id, { billStatus: s, billedTaxable: 0, billedAmount: 0 });
                      } else {
                        updateAssessmentRow(row.id, { billStatus: s });
                      }
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-medium border outline-none w-full border-border"
                    style={{ background: st.bg, color: st.color }}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-bill">In Bill ✓</option>
                    <option value="not-in-bill">Not in Bill ✗</option>
                    <option value="partial">Partial</option>
                  </select>
                )}
                {visible.remarks && (
                  <input
                    value={row.billRemarks || ''}
                    onChange={e => updateAssessmentRow(row.id, { billRemarks: e.target.value })}
                    placeholder="Notes…"
                    className="px-2 py-1 rounded-lg text-xs border outline-none w-full border-border"
                    style={{ color: 'var(--color-neutral-600)', background: 'var(--color-neutral-50)' }}
                  />
                )}
                <button
                  onClick={() => handleDeleteRow(row.id)}
                  className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors hover:bg-status-danger-tint text-status-danger"
                  title="Delete row"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ];
          }).flat()}

          {/*
            Assessed subtotal. Full width rather than column-aligned because
            these are post-depreciation figures and this grid has no column that
            means any of them — "Assessed Tax" and "Assessed" both show the
            pre-depreciation amounts, and GST% is a rate, not an amount. Printing
            sub.base under "Assessed Tax" would put a depreciated number under a
            heading that promises an undepreciated one.
          */}
          <div
            className="px-6 py-1.5 text-right text-[11px] text-muted-foreground border-b border-border"
            style={{ background: 'var(--color-neutral-50)' }}
          >
            {title} assessed —{' '}
            taxable <span className="font-medium text-foreground">{fmt(sub.base)}</span>
            {' · '}GST <span className="font-medium text-foreground">{fmt(sub.gst)}</span>
            {' · '}total <span className="font-medium text-foreground">{fmt(sub.total)}</span>
          </div>

          {totalsRow(`${title} billed`, billed, false)}
          </div>
          );
          })}

          {totalsRow('TOTAL', billedTotals(allowedRows), true)}
        </div>
      </div>
    </div>

    {pendingAllowance && (
      <AllowanceScopeDialog
        assessed={pendingAllowance.assessed}
        proposed={pendingAllowance.proposed}
        onCancel={() => setPendingAllowance(null)}
        onChoose={scope => {
          updateAssessmentRow(
            pendingAllowance.id,
            scope === 'both'
              ? { assessed: pendingAllowance.proposed, billAllowed: undefined }
              : { billAllowed: pendingAllowance.proposed },
          );
          setPendingAllowance(null);
        }}
      />
    )}
    </>
  );
}
