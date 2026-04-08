'use client';

import { useClaimStore } from '@/stores/claim-store';
import { calculateAssessmentSummary, calculateBillCheckSummary, getVehicleAgeMonths, formatCurrency } from '@/lib/calculations';

import { useAIExtraction } from '@/hooks/useAIExtraction';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import {
  Receipt, DollarSign, Calculator, CheckCircle2, XCircle,
  AlertCircle, FileText, Sparkles, Upload, Loader2, Minus,
} from 'lucide-react';
import { useState } from 'react';

// ─── Bill Check Row State ───────────────────────────────────────────────────
type BillStatus = 'in-bill' | 'not-in-bill' | 'partial' | 'pending';

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
    default:            return { label: 'Pending Review',  color: '#8D99AE', bg: 'rgba(141,153,174,0.1)' };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export function BillCheckTab() {
  const currentClaim  = useClaimStore(s => s.currentClaim);
  const updateAssessmentRow = useClaimStore(s => s.updateAssessmentRow);
  const updateBillCheck = useClaimStore(s => s.updateBillCheck);
  
  const fb = currentClaim?.feeBill;
  const bc = currentClaim?.billCheck || { billNo: '', billDate: '', billTotal: 0 };
  const { isProcessing, progress, reviewData, triggerExtraction, confirmApply, cancelReview } = useAIExtraction();

  if (!currentClaim) return null;

  const allowedRows = currentClaim.assessmentRows.filter(r => r.allowed);


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
    <div className="h-full overflow-y-auto" style={{ background: '#F8F9FA' }}>

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
          <h1 className="text-2xl lg:text-3xl font-black mb-2" style={{ color: '#F8F9FA', letterSpacing: '-0.02em' }}>
            Bill Check Report
          </h1>
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

      <div className="px-6 lg:px-12 py-8 max-w-5xl mx-auto space-y-8">

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
        {allowedRows.length === 0 ? (
          <div
            className="rounded-2xl p-12 flex flex-col items-center text-center"
            style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
          >
            <AlertCircle size={28} style={{ color: '#8D99AE', marginBottom: 12 }} />
            <div className="text-base font-bold mb-1" style={{ color: '#0D1B2A' }}>No allowed items in assessment</div>
            <div className="text-sm" style={{ color: '#8D99AE' }}>
              Go to Assessment tab and mark parts as allowed to begin bill check.
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
          >
            <div className="px-6 py-4" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
              <div className="text-sm font-black" style={{ color: '#0D1B2A' }}>
                Step 2 — Verify Each Allowed Item ({allowedRows.length} items)
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>
                Mark each item as In Bill / Not In Bill / Partial. Enter actual billed amount where applicable.
              </div>
            </div>

            {/* Table header */}
            <div
              className="px-6 py-3 grid gap-3 text-[9px] font-black uppercase tracking-[0.15em]"
              style={{
                gridTemplateColumns: '2fr 80px 120px 120px 120px 1fr',
                borderBottom: '1px solid #E2E6EA',
                color: '#8D99AE',
                background: '#FAFAFA',
              }}
            >
              <span>Particulars</span>
              <span>Section</span>
              <span>Assessed (₹)</span>
              <span>Billed (₹)</span>
              <span>Status</span>
              <span>Remarks</span>
            </div>

            {allowedRows.map((row) => {
              const st = statusLabel(row.billStatus || 'pending');
              return (
                <div
                  key={row.id}
                  className="px-6 py-3 grid gap-3 items-center"
                  style={{
                    gridTemplateColumns: '2fr 80px 120px 120px 120px 1fr',
                    borderBottom: '1px solid #F0F2F5',
                  }}
                >
                  <div className="text-sm font-semibold" style={{ color: '#0D1B2A' }}>{row.particulars || '—'}</div>

                  <div>
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ background: '#F0F2F5', color: '#4A4E69' }}
                    >
                      {row.section}
                    </span>
                  </div>

                  <div className="text-sm font-bold" style={{ color: '#0D1B2A' }}>
                    {fmt(row.assessed)}
                  </div>

                  <input
                    type="number"
                    value={row.billedAmount || ''}
                    onChange={e => updateAssessmentRow(row.id, { billedAmount: Number(e.target.value) })}
                    disabled={row.billStatus === 'not-in-bill'}
                    className="px-2 py-1 rounded-lg text-sm text-right border outline-none w-full"
                    style={{
                      border: '1px solid #E2E6EA',
                      color: '#0D1B2A',
                      background: row.billStatus === 'not-in-bill' ? '#F0F2F5' : '#FAFAFA',
                    }}
                  />

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

                  <input
                    value={row.billRemarks || ''}
                    onChange={e => updateAssessmentRow(row.id, { billRemarks: e.target.value })}
                    placeholder="Notes…"
                    className="px-2 py-1 rounded-lg text-xs border outline-none w-full"
                    style={{ border: '1px solid #E2E6EA', color: '#4A4E69', background: '#FAFAFA' }}
                  />
                </div>
              );
            })}

            {/* Footer Totals */}
            <div
              className="px-6 py-4 grid gap-3"
              style={{
                gridTemplateColumns: '2fr 80px 120px 120px 120px 1fr',
                background: '#0D1B2A',
              }}
            >
              <div className="text-xs font-black uppercase tracking-widest" style={{ color: '#D4AF37' }}>
                TOTAL
              </div>
              <div />
              <div className="text-sm font-black" style={{ color: '#F8F9FA' }}>
                {fmt(allowedRows.reduce((s, r) => s + r.assessed, 0))}
              </div>
              <div className="text-sm font-black" style={{ color: '#D4AF37' }}>
                {fmt(allowedRows.reduce((s, r) => s + (r.billedAmount || 0), 0))}
              </div>
              <div className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {fmt(notInBillTotal)} not claimed
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

        {/* ── Bill Check Info ───────────────────────── */}
        <div
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)' }}
        >
          <FileText size={16} style={{ color: '#D4AF37', flexShrink: 0, marginTop: 1 }} />
          <div className="text-xs" style={{ color: '#4A4E69', lineHeight: 1.6 }}>
            <strong>How Bill Check works:</strong> The Final Survey Report logs what the assessor <em>allowed</em>.
            Once the workshop completes repairs, they submit a final bill to the insurer. The Bill Check Report
            verifies that every allowed item is actually reflected in the final bill — and flags any discrepancies,
            missing items, or amounts that differ from the assessment. Go to <strong>Reports</strong> tab to generate the Bill Check PDF.
          </div>
        </div>
      </div>

      <AIReviewDialog
        isOpen={!!reviewData}
        onClose={cancelReview}
        onConfirm={confirmApply}
        title={reviewData?.key || ''}
        data={reviewData?.data}
      />
    </div>
  );
}

