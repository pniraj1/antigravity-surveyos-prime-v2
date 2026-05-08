'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Trash2, Settings2, Eye, EyeOff, FileSearch } from 'lucide-react';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import type { AssessmentRow } from '@/types';
import {
  OptionalColumn, OPTIONAL_COLUMNS, DEFAULT_VISIBLE, COL_WIDTHS,
  loadVisibility, saveVisibility, statusLabel, type BillStatus,
} from './config';

interface Props {
  allRows: AssessmentRow[];
  allowedRows: AssessmentRow[];
  notInBillTotal: number;
  updateAssessmentRow: (id: string, updates: Partial<AssessmentRow>) => void;
  deleteAssessmentRow: (id: string) => void;
  deleteAssessmentRows: (ids: string[]) => void;
  claimId: string | null;
  fmt: (n: number) => string;
}

export function BillCheckGrid({
  allRows,
  allowedRows,
  notInBillTotal,
  updateAssessmentRow,
  deleteAssessmentRow,
  deleteAssessmentRows,
  claimId,
  fmt,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState<Record<OptionalColumn, boolean>>(DEFAULT_VISIBLE);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

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
    const detailCols = (['partNumber', 'hsnSac', 'section', 'quantity', 'taxable', 'gst'] as OptionalColumn[])
      .filter(k => visible[k]).map(k => COL_WIDTHS[k]);
    const billedTaxCol = visible.billedTaxable ? [COL_WIDTHS.billedTaxable] : [];
    const remarksCol = visible.remarks ? [COL_WIDTHS.remarks] : [];
    return ['32px', '50px', '2fr', ...detailCols, '100px', ...billedTaxCol, '110px', '120px', ...remarksCol, '40px'].join(' ');
  };
  const gridCols = buildCols();

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = (ids: string[]) => {
    setSelected(prev => {
      const all = ids.length > 0 && ids.every(id => prev.has(id));
      return all ? new Set() : new Set(ids);
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

  if (allRows.length === 0) {
    return (
      <div
        className="rounded-2xl p-12 flex flex-col items-center text-center"
        style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
      >
        <AlertCircle size={28} style={{ color: '#8D99AE', marginBottom: 12 }} />
        <div className="text-base font-bold mb-1" style={{ color: '#0D1B2A' }}>No items in assessment</div>
        <div className="text-sm" style={{ color: '#8D99AE' }}>
          Go to Assessment tab and add items to begin bill check.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
      {/* Grid header / toolbar */}
      <div className="px-6 py-4 flex items-start justify-between gap-4" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
        <div>
          <div className="text-sm font-black" style={{ color: '#0D1B2A' }}>
            Step 2 — Verify Each Item ({allRows.length} items · {allowedRows.length} allowed)
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border hover:bg-red-50"
            style={{ background: '#fff', color: '#dc2626', borderColor: '#dc2626' }}
            title="Remove all zero amount parts"
          >
            <Trash2 size={14} />
            Remove 0 Amount
          </button>
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all hover:opacity-90"
              style={{ background: '#dc2626', color: '#fff' }}
            >
              <Trash2 size={14} />
              Delete Selected ({selected.size})
            </button>
          )}
          {/* Column visibility dropdown */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border"
              style={{ background: showSettings ? '#0D1B2A' : '#fff', color: showSettings ? '#fff' : '#4A4E69', borderColor: '#E2E6EA' }}
              title="Toggle column visibility"
            >
              <Settings2 size={14} />
              Columns
              <span className="ml-0.5 text-[10px] px-1.5 rounded-full font-bold" style={{ background: showSettings ? 'rgba(255,255,255,0.2)' : 'rgba(13,27,42,0.08)' }}>
                {visibleCount}/{OPTIONAL_COLUMNS.length}
              </span>
            </button>
            {showSettings && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl shadow-xl z-50 overflow-hidden" style={{ background: '#fff', border: '1px solid #E2E6EA' }}>
                <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #E2E6EA', background: '#FAFAFA' }}>
                  <p className="text-xs font-black" style={{ color: '#0D1B2A' }}>Column Visibility</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#8D99AE' }}>Toggle columns to keep the grid clean</p>
                </div>
                <div className="p-2 max-h-[300px] overflow-y-auto">
                  {OPTIONAL_COLUMNS.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-slate-50"
                      style={{ background: visible[col.key] ? 'rgba(13,27,42,0.05)' : 'transparent' }}
                    >
                      <div className="flex-shrink-0 w-7 h-4 rounded-full relative transition-colors" style={{ background: visible[col.key] ? '#0D1B2A' : 'rgba(141,153,174,0.3)' }}>
                        <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all" style={{ left: visible[col.key] ? '14px' : '2px' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold" style={{ color: '#0D1B2A' }}>{col.label}</span>
                        <span className="text-[10px] ml-1.5" style={{ color: '#8D99AE' }}>{col.description}</span>
                      </div>
                      {visible[col.key] ? <Eye size={12} style={{ color: '#0D1B2A' }} /> : <EyeOff size={12} style={{ color: '#8D99AE' }} />}
                    </button>
                  ))}
                </div>
                <div className="px-3 py-2 flex gap-2" style={{ borderTop: '1px solid #E2E6EA', background: '#FAFAFA' }}>
                  <button onClick={showAllCols} className="flex-1 text-[10px] font-bold rounded-md py-1.5 transition-colors hover:bg-slate-100" style={{ color: '#0D1B2A' }}>Show All</button>
                  <button onClick={resetDefaults} className="flex-1 text-[10px] font-bold rounded-md py-1.5 transition-colors hover:bg-slate-100" style={{ color: '#0D1B2A' }}>Reset</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: `${800 + visibleCount * 90}px` }}>
          {/* Column headers */}
          <div
            className="px-6 py-3 grid gap-2 text-[9px] font-black uppercase tracking-[0.15em]"
            style={{ gridTemplateColumns: gridCols, borderBottom: '1px solid #E2E6EA', color: '#8D99AE', background: '#FAFAFA' }}
          >
            <span className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={allRows.length > 0 && allRows.every(r => selected.has(r.id))}
                ref={el => { if (el) el.indeterminate = selected.size > 0 && !allRows.every(r => selected.has(r.id)); }}
                onChange={() => toggleSelectAll(allRows.map(r => r.id))}
                className="h-3.5 w-3.5 cursor-pointer accent-red-600"
                title="Select all"
              />
            </span>
            <span>Sr.</span>
            <span>Particulars</span>
            {visible.partNumber    && <span>Part No.</span>}
            {visible.hsnSac        && <span>HSN/SAC</span>}
            {visible.section       && <span>Section</span>}
            {visible.quantity      && <span>Qty</span>}
            {visible.taxable       && <span>Assessed Tax (₹)</span>}
            {visible.gst           && <span>GST%</span>}
            <span>Assessed (₹)</span>
            {visible.billedTaxable && <span>Billed Tax (₹)</span>}
            <span>Billed Incl GST (₹)</span>
            <span>Status</span>
            {visible.remarks       && <span>Remarks</span>}
            <span></span>
          </div>

          {/* Rows */}
          {allRows.map((row, idx) => {
            const isDisallowed = !row.allowed;
            const effectiveStatus: BillStatus = isDisallowed ? 'not-allowed' : (row.billStatus || 'pending');
            const st = statusLabel(effectiveStatus);
            return (
              <div
                key={row.id}
                className="px-6 py-3 grid gap-2 items-center"
                style={{
                  gridTemplateColumns: gridCols,
                  borderBottom: '1px solid #F0F2F5',
                  background: isDisallowed ? '#F5F5F7' : 'transparent',
                  opacity: isDisallowed ? 0.75 : 1,
                }}
              >
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    className="h-3.5 w-3.5 cursor-pointer accent-red-600"
                  />
                </div>
                <div className="text-sm font-bold" style={{ color: '#4A4E69' }}>{row.srNo ?? idx + 1}</div>
                <div
                  className="group text-sm font-semibold flex items-center gap-1.5 cursor-pointer select-none"
                  style={{ color: '#0D1B2A', textDecoration: isDisallowed ? 'line-through' : 'none' }}
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
                  <FileSearch size={12} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" style={{ color: '#D4AF37' }} />
                </div>
                {visible.partNumber    && <div className="text-xs font-mono" style={{ color: '#4A4E69' }}>{row.partNumber || '—'}</div>}
                {visible.hsnSac        && <div className="text-xs font-mono" style={{ color: '#4A4E69' }}>{row.hsnSac || '—'}</div>}
                {visible.section       && <div><span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: '#F0F2F5', color: '#4A4E69' }}>{row.section}</span></div>}
                {visible.quantity      && <div className="text-sm font-semibold text-center" style={{ color: '#4A4E69' }}>{row.quantity ?? '—'}</div>}
                {visible.taxable       && <div className="text-sm font-semibold" style={{ color: '#4A4E69' }}>{fmt(row.estimated || 0)}</div>}
                {visible.gst           && <div className="text-xs font-semibold text-center" style={{ color: '#4A4E69' }}>{row.gst ?? 18}%</div>}
                <div className="text-sm font-bold" style={{ color: '#0D1B2A' }}>{fmt(row.assessed)}</div>
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
                    className="px-2 py-1 rounded-lg text-sm text-right border outline-none w-full"
                    style={{ border: '1px solid #E2E6EA', color: '#0D1B2A', background: isDisallowed || row.billStatus === 'not-in-bill' ? '#F0F2F5' : '#FAFAFA' }}
                  />
                )}
                <input
                  type="number"
                  value={row.billedAmount || ''}
                  onChange={e => updateAssessmentRow(row.id, { billedAmount: Number(e.target.value) })}
                  disabled={isDisallowed || row.billStatus === 'not-in-bill'}
                  className="px-2 py-1 rounded-lg text-sm text-right border outline-none w-full"
                  style={{ border: '1px solid #E2E6EA', color: '#0D1B2A', background: isDisallowed || row.billStatus === 'not-in-bill' ? '#F0F2F5' : '#FAFAFA' }}
                />
                {isDisallowed ? (
                  <div
                    className="px-2 py-1 rounded-lg text-[10px] font-bold text-center"
                    style={{ background: st.bg, color: st.color, border: '1px solid #E2E6EA' }}
                    title="This item was marked Not Allowed in Assessment"
                  >
                    {(row.billedAmount ?? 0) > 0 ? '⚠ Billed (Not Allowed)' : 'Not Allowed'}
                  </div>
                ) : (
                  <select
                    value={row.billStatus || 'pending'}
                    onChange={e => {
                      const s = e.target.value as BillStatus;
                      updateAssessmentRow(row.id, {
                        billStatus: s,
                        billedAmount: s === 'not-in-bill' ? 0 : (s === 'in-bill' ? row.assessed : row.billedAmount),
                      });
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold border outline-none w-full"
                    style={{ border: '1px solid #E2E6EA', background: st.bg, color: st.color }}
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
                    className="px-2 py-1 rounded-lg text-xs border outline-none w-full"
                    style={{ border: '1px solid #E2E6EA', color: '#4A4E69', background: '#FAFAFA' }}
                  />
                )}
                <button
                  onClick={() => handleDeleteRow(row.id)}
                  className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors hover:bg-red-50"
                  style={{ color: '#dc2626' }}
                  title="Delete row"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}

          {/* Footer totals */}
          <div
            className="px-6 py-4 grid gap-2"
            style={{ gridTemplateColumns: gridCols, background: '#0D1B2A' }}
          >
            <div /><div />
            <div className="text-xs font-black uppercase tracking-widest" style={{ color: '#D4AF37' }}>TOTAL</div>
            {visible.partNumber    && <div />}
            {visible.hsnSac        && <div />}
            {visible.section       && <div />}
            {visible.quantity      && <div />}
            {visible.taxable       && <div className="text-sm font-black" style={{ color: '#F8F9FA' }}>{fmt(allowedRows.reduce((s, r) => s + (r.estimated || 0), 0))}</div>}
            {visible.gst           && <div />}
            <div className="text-sm font-black" style={{ color: '#F8F9FA' }}>{fmt(allowedRows.reduce((s, r) => s + r.assessed, 0))}</div>
            {visible.billedTaxable && <div className="text-sm font-black" style={{ color: '#D4AF37' }}>{fmt(allowedRows.reduce((s, r) => s + (r.billedTaxable || 0), 0))}</div>}
            <div className="text-sm font-black" style={{ color: '#D4AF37' }}>{fmt(allowedRows.reduce((s, r) => s + (r.billedAmount || 0), 0))}</div>
            <div className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>{fmt(notInBillTotal)} not claimed</div>
            {visible.remarks && <div />}
            <div />
          </div>
        </div>
      </div>
    </div>
  );
}
