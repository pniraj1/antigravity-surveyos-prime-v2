'use client';

import { useClaimStore } from '@/stores/claim-store';
import { calculateAssessmentSummary, calculateBillCheckSummary, getVehicleAgeMonths, formatCurrency } from '@/lib/calculations';
import { triggerUIICBillCheckPrint, buildUIICBillCheckHTML } from '@/lib/reports/uiic-final-builder';
import { useProfileStore } from '@/stores/profile-store';
import { useAIExtraction } from '@/hooks/useAIExtraction';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { ProcessingProgressOverlay } from '@/components/ui/ProcessingProgressOverlay';
import { ReportPreviewPanel } from '@/components/shared/ReportPreviewPanel';
import {
  Receipt, DollarSign, Calculator, CheckCircle2, XCircle,
  AlertCircle, FileText, Sparkles, Upload, Loader2, Minus, Printer, Trash2,
  Settings2, Eye, EyeOff, Layout, Columns, FileSearch,
} from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { DocumentEvidenceViewer, useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';

// ─── Column Visibility Configuration ─────────────────────────────
type OptionalColumn =
  | 'partNumber'
  | 'hsnSac'
  | 'section'
  | 'quantity'
  | 'taxable'
  | 'gst'
  | 'billedTaxable'
  | 'remarks';

interface ColumnMeta {
  key: OptionalColumn;
  label: string;
  description: string;
}

const OPTIONAL_COLUMNS: ColumnMeta[] = [
  { key: 'partNumber',    label: 'Part No.',        description: 'OEM part number' },
  { key: 'hsnSac',        label: 'HSN/SAC',         description: 'Tax classification code' },
  { key: 'section',       label: 'Section',         description: 'Parts / Labour / Paint' },
  { key: 'quantity',      label: 'Qty',             description: 'Quantity' },
  { key: 'taxable',       label: 'Assessed Taxable',description: 'Assessed taxable (net) amount before GST' },
  { key: 'gst',           label: 'GST %',           description: 'GST percentage' },
  { key: 'billedTaxable', label: 'Billed Taxable',  description: 'Billed taxable (net) amount before GST' },
  { key: 'remarks',       label: 'Remarks',         description: 'Surveyor notes' },
];

const DEFAULT_VISIBLE: Record<OptionalColumn, boolean> = {
  partNumber: false,
  hsnSac: false,
  section: true,
  quantity: false,
  taxable: true,
  gst: true,
  billedTaxable: true,
  remarks: true,
};

const COL_WIDTHS: Record<OptionalColumn, string> = {
  partNumber: '110px',
  hsnSac: '80px',
  section: '70px',
  quantity: '50px',
  taxable: '100px',
  gst: '60px',
  billedTaxable: '110px',
  remarks: '1fr',
};

const STORAGE_KEY = 'surveyos-billcheck-grid-columns';

function loadVisibility(): Record<OptionalColumn, boolean> {
  if (typeof window === 'undefined') return { ...DEFAULT_VISIBLE };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_VISIBLE, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULT_VISIBLE };
}

function saveVisibility(v: Record<OptionalColumn, boolean>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

// ─── Bill Check Row State ───────────────────────────────────────────────────
type BillStatus = 'in-bill' | 'not-in-bill' | 'partial' | 'pending' | 'not-allowed';

interface BillCheckRow {
  id: string;
  particulars: string;
  section: string;
  assessedAmount: number;
  billedAmount: number;
  status: BillStatus;
  remarks: string;
}

function statusLabel(s: BillStatus) {
  switch (s) {
    case 'in-bill':     return { label: 'In Bill',         color: '#059669', bg: 'rgba(5,150,105,0.1)' };
    case 'not-in-bill': return { label: 'Not in Bill',     color: '#dc2626', bg: 'rgba(220,38,38,0.1)' };
    case 'partial':     return { label: 'Partial',         color: '#d97706', bg: 'rgba(217,119,6,0.1)' };
    case 'not-allowed': return { label: 'Not Allowed',     color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
    default:            return { label: 'Pending Review',  color: '#8D99AE', bg: 'rgba(141,153,174,0.1)' };
  }
}

// ─── Inline Live Preview ─────────────────────────────────────────────────────
function BillCheckPreview({ claim, profile }: { claim: any; profile: any }) {
  const html = useMemo(() => {
    try { return buildUIICBillCheckHTML(claim, profile); } catch { return ''; }
  }, [claim, profile]);

  return (
    <ReportPreviewPanel
      html={html}
      title="Bill Check Report — Live Preview"
      printLabel="Power Print"
      onPrint={() => triggerUIICBillCheckPrint(claim, profile)}
    />
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export function BillCheckTab() {
  const currentClaim  = useClaimStore(s => s.currentClaim);
  const updateAssessmentRow = useClaimStore(s => s.updateAssessmentRow);
  const deleteAssessmentRow = useClaimStore(s => s.deleteAssessmentRow);
  const deleteAssessmentRows = useClaimStore(s => s.deleteAssessmentRows);
  const deleteExtraBillItem = useClaimStore(s => s.deleteExtraBillItem);
  const clearExtraBillItems = useClaimStore(s => s.clearExtraBillItems);
  const updateBillCheck = useClaimStore(s => s.updateBillCheck);
  const { profile } = useProfileStore();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState<Record<OptionalColumn, boolean>>(DEFAULT_VISIBLE);
  const [showSettings, setShowSettings] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
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

  // Build dynamic grid template string.
  // Fixed: select, sr, particulars, assessed, billed(incl), status, delete.
  // Optional (visible only): inserted between particulars and assessed (detail cols) and remarks goes before delete.
  const buildCols = () => {
    const detailCols = (['partNumber', 'hsnSac', 'section', 'quantity', 'taxable', 'gst'] as OptionalColumn[])
      .filter(k => visible[k]).map(k => COL_WIDTHS[k]);
    const billedTaxCol = visible.billedTaxable ? [COL_WIDTHS.billedTaxable] : [];
    const remarksCol = visible.remarks ? [COL_WIDTHS.remarks] : [];
    return [
      '32px',        // select
      '50px',        // sr
      '2fr',         // particulars
      ...detailCols,
      '100px',       // assessed
      ...billedTaxCol,
      '110px',       // billed (incl GST)
      '120px',       // status
      ...remarksCol,
      '40px',        // delete
    ].join(' ');
  };
  const gridCols = buildCols();
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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

  const fb = currentClaim?.feeBill;
  const bc = currentClaim?.billCheck || { billNo: '', billDate: '', billTotal: 0 };
  const { isProcessing, progress, reviewData, triggerExtraction, confirmApply, cancelReview } = useAIExtraction();

  if (!currentClaim) return null;

  const allRows = currentClaim.assessmentRows;
  const allowedRows = allRows.filter(r => r.allowed);
  const extraBillItems = currentClaim.extraBillItems || [];


  if (!currentClaim) return null;

  // Compute the ageMonths for summary
  const ageMonths = getVehicleAgeMonths(
    currentClaim.vehicle.dateOfRegistration,
    currentClaim.vehicle.yearOfManufacture,
    currentClaim.accident.dateAndTime,
  );

  const summary = calculateAssessmentSummary(
    currentClaim.assessmentRows,
    ageMonths,
    currentClaim.depreciationType,
    fb?.salvageValue ?? 0,
    fb?.compulsoryExcess ?? 0,
    fb?.voluntaryExcess ?? 0,
  );

  const bcSummary = calculateBillCheckSummary(
    currentClaim.assessmentRows,
    ageMonths,
    currentClaim.depreciationType,
    fb?.salvageValue ?? 0,
    fb?.compulsoryExcess ?? 0,
    fb?.voluntaryExcess ?? 0,
  );



  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) triggerExtraction('final-bill', file);
    e.target.value = '';
  };


  // Metrics
  const inBillTotal    = allowedRows.filter(r => r.billStatus === 'in-bill').reduce((s, r) => s + (r.billedAmount || 0), 0);
  const notInBillTotal = allowedRows.filter(r => r.billStatus === 'not-in-bill').reduce((s, r) => s + r.assessed, 0);
  const partialTotal   = allowedRows.filter(r => r.billStatus === 'partial').reduce((s, r) => s + r.assessed - (r.billedAmount || 0), 0);
  const netAllowed     = summary.netAssessedLoss;


  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#F8F9FA' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="px-8 py-8 lg:px-12"
        style={{ background: 'linear-gradient(135deg, #0D1B2A 0%, #1e3a5f 100%)' }}
      >
        <div className="max-w-5xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-4"
            style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
          >
            <CheckCircle2 size={11} />
            Final Bill Verification
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black mb-2" style={{ color: '#F8F9FA', letterSpacing: '-0.02em' }}>
                Bill Check Report
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const next = !showEvidence;
                  setShowEvidence(next);
                  if (next && currentClaim) {
                    useEvidenceStore.getState().openField(currentClaim.id, {
                      docType: 'final-bill',
                      fieldKey: 'bill_items',
                      contextSnippet: 'Reviewing extracted bill items against assessment...'
                    });
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg"
                style={{
                  background: showEvidence ? '#D4AF37' : 'rgba(255,255,255,0.1)',
                  color: showEvidence ? '#0D1B2A' : '#F8F9FA',
                  border: '1px solid rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {showEvidence ? <Layout size={16} /> : <Columns size={16} />}
                {showEvidence ? 'Full View' : 'Show Evidence'}
              </button>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'rgba(232,236,240,0.65)' }}>
            Verify that items <strong style={{ color: '#D4AF37' }}>allowed</strong> in the Final Survey Report are correctly
            reflected in the workshop&apos;s final bill submitted to the insurer.
          </p>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-3 mt-5">
            <div className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(5,150,105,0.15)', color: '#34d399' }}>
               Total Billed: {fmt(bcSummary.grandTotalBilled)}
            </div>
            <div className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
              Final Liability: {fmt(bcSummary.netLiability)}
            </div>
            <div className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(220,38,38,0.15)', color: '#f87171' }}>
              Saving to Insurer: {fmt(bcSummary.notInBillTotal)}
            </div>

          </div>
        </div>
      </div>

      <PanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
        <Panel defaultSize={60} minSize={30} className="h-full overflow-y-auto">
          <div className="px-6 lg:px-12 py-8 space-y-8">

        {/* ── Upload Final Bill to AI ─────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
        >
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
            <div className="text-sm font-black" style={{ color: '#0D1B2A' }}>Step 1 — Upload Final Workshop Bill</div>
            <div className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>
              AI will extract the bill items to compare against allowed assessment
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: '#8D99AE' }}>
                  Bill / Invoice No.
                </label>
                <input
                  value={bc.billNo}
                  onChange={e => updateBillCheck({ billNo: e.target.value })}
                  placeholder="INV-001"
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ border: '1px solid #E2E6EA', color: '#0D1B2A', background: '#FAFAFA' }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: '#8D99AE' }}>
                  Bill Date
                </label>
                <input
                  type="date"
                  value={bc.billDate}
                  onChange={e => updateBillCheck({ billDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ border: '1px solid #E2E6EA', color: '#0D1B2A', background: '#FAFAFA' }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: '#8D99AE' }}>
                  Total Bill Amount (₹)
                </label>
                <input
                  type="number"
                  value={bc.billTotal || ''}
                  onChange={e => updateBillCheck({ billTotal: Number(e.target.value) })}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ border: '1px solid #E2E6EA', color: '#0D1B2A', background: '#FAFAFA' }}
                />
              </div>

            </div>

            {/* Upload button */}
            <label
              className="relative flex items-center gap-3 px-5 py-3 rounded-xl cursor-pointer transition-all"
              style={{
                background: 'rgba(13,27,42,0.04)',
                border: '1.5px dashed #C3C9D4',
                pointerEvents: isProcessing ? 'none' : 'auto',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.background = 'rgba(212,175,55,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#C3C9D4'; e.currentTarget.style.background = 'rgba(13,27,42,0.04)'; }}
            >
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={isProcessing} />
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>
                {isProcessing ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: '#0D1B2A' }}>
                  {isProcessing ? progress || 'Scanning bill…' : 'Upload Final Workshop Bill'}
                </div>
                <div className="text-xs" style={{ color: '#8D99AE' }}>
                  {isProcessing ? 'AI is reading the bill…' : 'Image or PDF — AI extracts all line items'}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* ── Bill Check Grid ────────────────────────── */}
        {allRows.length === 0 ? (
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
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
          >
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
                    const zeroAmountRows = allRows.filter(r => r.assessed === 0 && r.estimated === 0);
                    if (zeroAmountRows.length === 0) {
                      alert('No zero amount parts found.');
                      return;
                    }
                    if (confirm(`Remove ${zeroAmountRows.length} zero amount parts? This cannot be undone.`)) {
                      deleteAssessmentRows(zeroAmountRows.map(r => r.id));
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border hover:bg-red-50"
                  style={{
                    background: '#fff',
                    color: '#dc2626',
                    borderColor: '#dc2626',
                  }}
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
                <div className="relative" ref={settingsRef}>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border"
                    style={{
                      background: showSettings ? '#0D1B2A' : '#fff',
                      color: showSettings ? '#fff' : '#4A4E69',
                      borderColor: '#E2E6EA',
                    }}
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
            {/* Table header */}
            <div
              className="px-6 py-3 grid gap-2 text-[9px] font-black uppercase tracking-[0.15em]"
              style={{
                gridTemplateColumns: gridCols,
                borderBottom: '1px solid #E2E6EA',
                color: '#8D99AE',
                background: '#FAFAFA',
              }}
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

                  <div className="text-sm font-bold" style={{ color: '#4A4E69' }}>
                    {row.srNo ?? idx + 1}
                  </div>

                  <div
                    className="group text-sm font-semibold flex items-center gap-1.5 cursor-pointer select-none"
                    style={{ color: '#0D1B2A', textDecoration: isDisallowed ? 'line-through' : 'none' }}
                    onClick={() => {
                      if (!currentClaim?.id) return;
                      useEvidenceStore.getState().openField(currentClaim.id, {
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

                  {visible.partNumber && (
                    <div className="text-xs font-mono" style={{ color: '#4A4E69' }}>{row.partNumber || '—'}</div>
                  )}

                  {visible.hsnSac && (
                    <div className="text-xs font-mono" style={{ color: '#4A4E69' }}>{row.hsnSac || '—'}</div>
                  )}

                  {visible.section && (
                    <div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: '#F0F2F5', color: '#4A4E69' }}>
                        {row.section}
                      </span>
                    </div>
                  )}

                  {visible.quantity && (
                    <div className="text-sm font-semibold text-center" style={{ color: '#4A4E69' }}>{row.quantity ?? '—'}</div>
                  )}

                  {visible.taxable && (
                    <div className="text-sm font-semibold" style={{ color: '#4A4E69' }}>{fmt(row.estimated || 0)}</div>
                  )}

                  {visible.gst && (
                    <div className="text-xs font-semibold text-center" style={{ color: '#4A4E69' }}>{row.gst ?? 18}%</div>
                  )}

                  <div className="text-sm font-bold" style={{ color: '#0D1B2A' }}>
                    {fmt(row.assessed)}
                  </div>

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
                      style={{
                        border: '1px solid #E2E6EA',
                        color: '#0D1B2A',
                        background: isDisallowed || row.billStatus === 'not-in-bill' ? '#F0F2F5' : '#FAFAFA',
                      }}
                    />
                  )}

                  <input
                    type="number"
                    value={row.billedAmount || ''}
                    onChange={e => updateAssessmentRow(row.id, { billedAmount: Number(e.target.value) })}
                    disabled={isDisallowed || row.billStatus === 'not-in-bill'}
                    className="px-2 py-1 rounded-lg text-sm text-right border outline-none w-full"
                    style={{
                      border: '1px solid #E2E6EA',
                      color: '#0D1B2A',
                      background: isDisallowed || row.billStatus === 'not-in-bill' ? '#F0F2F5' : '#FAFAFA',
                    }}
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
                          billedAmount: s === 'not-in-bill' ? 0 : (s === 'in-bill' ? row.assessed : row.billedAmount)
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

            {/* Footer Totals */}
            <div
              className="px-6 py-4 grid gap-2"
              style={{
                gridTemplateColumns: gridCols,
                background: '#0D1B2A',
              }}
            >
              <div />
              <div />
              <div className="text-xs font-black uppercase tracking-widest" style={{ color: '#D4AF37' }}>
                TOTAL
              </div>
              {visible.partNumber && <div />}
              {visible.hsnSac && <div />}
              {visible.section && <div />}
              {visible.quantity && <div />}
              {visible.taxable && (
                <div className="text-sm font-black" style={{ color: '#F8F9FA' }}>
                  {fmt(allowedRows.reduce((s, r) => s + (r.estimated || 0), 0))}
                </div>
              )}
              {visible.gst && <div />}
              <div className="text-sm font-black" style={{ color: '#F8F9FA' }}>
                {fmt(allowedRows.reduce((s, r) => s + r.assessed, 0))}
              </div>
              {visible.billedTaxable && (
                <div className="text-sm font-black" style={{ color: '#D4AF37' }}>
                  {fmt(allowedRows.reduce((s, r) => s + (r.billedTaxable || 0), 0))}
                </div>
              )}
              <div className="text-sm font-black" style={{ color: '#D4AF37' }}>
                {fmt(allowedRows.reduce((s, r) => s + (r.billedAmount || 0), 0))}
              </div>
              <div className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {fmt(notInBillTotal)} not claimed
              </div>
              {visible.remarks && <div />}
              <div />
            </div>
            </div>
            </div>

          </div>
        )}

        {/* ── Extra Bill Items (Not in Assessment) ─────── */}
        {extraBillItems.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '2px solid #ef4444' }}
          >
            <div className="px-6 py-4 flex items-start justify-between gap-4" style={{ borderBottom: '1px solid #F0F2F5', background: 'rgba(239,68,68,0.06)' }}>
              <div className="flex items-start gap-3">
                <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div className="text-sm font-black" style={{ color: '#b91c1c' }}>
                    ⚠ Extra Bill Items — Not in Assessment ({extraBillItems.length})
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#7f1d1d' }}>
                    The workshop billed for these items but they were NOT in the Assessment. Review carefully — these may be unauthorized additions.
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Clear all ${extraBillItems.length} extra bill items? This cannot be undone.`)) clearExtraBillItems();
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all hover:opacity-90"
                style={{ background: '#dc2626', color: '#fff' }}
              >
                <Trash2 size={14} />
                Clear All
              </button>
            </div>

            <div
              className="px-6 py-3 grid gap-3 text-[9px] font-black uppercase tracking-[0.15em]"
              style={{
                gridTemplateColumns: '2fr 120px 120px 40px',
                borderBottom: '1px solid #E2E6EA',
                color: '#8D99AE',
                background: '#FAFAFA',
              }}
            >
              <span>Description</span>
              <span>Category</span>
              <span>Amount (₹)</span>
              <span></span>
            </div>

            {extraBillItems.map((item) => (
              <div
                key={item.id}
                className="px-6 py-3 grid gap-3 items-center"
                style={{
                  gridTemplateColumns: '2fr 120px 120px 40px',
                  borderBottom: '1px solid #F0F2F5',
                  border: '2px solid #ef4444',
                  borderRadius: '8px',
                  margin: '6px 12px',
                  background: 'rgba(239,68,68,0.04)',
                }}
              >
                <div className="text-sm font-semibold" style={{ color: '#0D1B2A' }}>
                  {item.description}
                </div>
                <div>
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ background: '#F0F2F5', color: '#4A4E69' }}
                  >
                    {item.category || '—'}
                  </span>
                </div>
                <div className="text-sm font-bold" style={{ color: '#b91c1c' }}>
                  {fmt(item.amount)}
                </div>
                <button
                  onClick={() => {
                    if (confirm('Delete this extra bill item?')) deleteExtraBillItem(item.id);
                  }}
                  className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors hover:bg-red-100"
                  style={{ color: '#dc2626' }}
                  title="Delete item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <div
              className="px-6 py-3 grid gap-3"
              style={{
                gridTemplateColumns: '2fr 120px 120px 40px',
                background: 'rgba(239,68,68,0.08)',
                borderTop: '1px solid #fecaca',
              }}
            >
              <div className="text-xs font-black uppercase tracking-widest" style={{ color: '#b91c1c' }}>
                Extra Billed Total
              </div>
              <div />
              <div className="text-sm font-black" style={{ color: '#b91c1c' }}>
                {fmt(extraBillItems.reduce((s, i) => s + (i.amount || 0), 0))}
              </div>
              <div />
            </div>
          </div>
        )}

        {/* ── Summary Cards ─────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Assessed (Allowed)', value: fmt(summary.grandTotal), accent: '#0D1B2A', icon: <DollarSign size={15} /> },
            { label: 'In Bill',            value: fmt(inBillTotal),         accent: '#059669', icon: <CheckCircle2 size={15} /> },
            { label: 'Not in Bill',        value: fmt(notInBillTotal),      accent: '#dc2626', icon: <XCircle size={15} /> },
            { label: 'Variance',           value: fmt(partialTotal),        accent: '#d97706', icon: <Minus size={15} /> },
          ].map(card => (
            <div
              key={card.label}
              className="p-5 rounded-2xl relative overflow-hidden"
              style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
            >
              <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-2xl" style={{ background: card.accent }} />
              <div className="flex items-center gap-1.5 mb-2 mt-1" style={{ color: card.accent }}>
                {card.icon}
                <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: '#8D99AE' }}>
                  {card.label}
                </span>
              </div>
              <div className="text-xl font-black" style={{ color: '#0D1B2A' }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* ── Final Liability Summary ─────────────────── */}
        <div 
          className="rounded-2xl p-6 shadow-sm border"
          style={{ background: '#FFFFFF', borderColor: '#E2E6EA' }}
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
              <Calculator size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black" style={{ color: '#0D1B2A' }}>Final Liability Summary</h3>
              <p className="text-[10px]" style={{ color: '#8D99AE' }}>Consolidated verification results including GST and Depreciation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Assessed</p>
              <p className="text-lg font-black text-slate-700">{fmt(bcSummary.grandTotalAssessed)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Billed (After Dep)</p>
              <p className="text-lg font-black text-emerald-600">{fmt(bcSummary.grandTotalBilled)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saving (Not in Bill)</p>
              <p className="text-lg font-black text-red-600">-{fmt(bcSummary.notInBillTotal)}</p>
            </div>
            <div className="p-4 rounded-xl shadow-lg border-2 border-blue-600/20" style={{ background: 'linear-gradient(135deg, #0D1B2A 0%, #1e3a5f 100%)' }}>
               <p className="text-[9px] font-bold text-blue-300 uppercase tracking-[0.2em] mb-1">Final Liability</p>
               <p className="text-2xl font-black text-white">{fmt(bcSummary.netLiability)}</p>
               <div className="mt-2 text-[8px] text-blue-200/50 uppercase font-bold tracking-widest">Payable to Workshop</div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t flex items-center gap-2" style={{ borderColor: '#F0F2F5' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-[10px] font-medium text-slate-500 italic">
              Verification results update in real-time as you match items to the final bill.
            </p>
          </div>
        </div>

        {/* ── Power Print — Bill Check Report ─────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
        >
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
            <div className="text-sm font-black" style={{ color: '#0D1B2A' }}>Download Bill Check Report</div>
            <div className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>
              Generates a UIIC-compliant Bill Check Report — only allowed items, original serial numbers
            </div>
          </div>
          <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 text-xs leading-relaxed" style={{ color: '#4A4E69' }}>
              <strong>How Bill Check works:</strong> The Final Survey logs what was <em>allowed</em>.
              Once repairs are done, the workshop submits a final bill. This report verifies every
              allowed item appears in the bill — flagging missing or mismatched amounts. Only allowed
              items appear in this report; disallowed items are excluded.
            </div>
            <button
              id="btn-print-bill-check"
              onClick={() => currentClaim && triggerUIICBillCheckPrint(currentClaim, profile)}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #0D1B2A 0%, #1e3a5f 100%)',
                color: '#F8F9FA',
                boxShadow: '0 4px 14px rgba(13,27,42,0.3)',
              }}
            >
              <Printer size={16} />
              Power Print — Bill Check Report
            </button>
          </div>
        </div>

        {/* ── Info note ───────────────────────────────── */}
        <div
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)' }}
        >
          <FileText size={16} style={{ color: '#D4AF37', flexShrink: 0, marginTop: 1 }} />
          <div className="text-xs" style={{ color: '#4A4E69', lineHeight: 1.6 }}>
            <strong>Note:</strong> The Bill Check Report will open in a new tab. Use your browser&apos;s print dialog
            (Ctrl+P / ⌘P) to save as PDF. Ensure &quot;Background graphics&quot; is enabled in print settings for
            full colour output.
          </div>
        </div>

        {/* ── Live Bill Check Report Preview ──────────── */}
        <BillCheckPreview claim={currentClaim} profile={profile} />
      </div>
    </Panel>

    {showEvidence && (
      <>
        <PanelResizeHandle className="w-1.5 bg-slate-200 hover:bg-blue-400 transition-colors cursor-col-resize relative">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-slate-300" />
        </PanelResizeHandle>
        <Panel defaultSize={40} minSize={25} className="h-full border-l bg-white">
          <DocumentEvidenceViewer embedded={true} />
        </Panel>
      </>
    )}
  </PanelGroup>

      <AIReviewDialog
        isOpen={!!reviewData}
        onClose={cancelReview}
        onConfirm={confirmApply}
        title={reviewData?.key || ''}
        data={reviewData?.data}
      />

      <ProcessingProgressOverlay
        isVisible={isProcessing}
        progress={progress}
        onCancel={cancelReview}
      />
    </div>
  );
}

