'use client';

import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { buildUIICFinalHTML, triggerUIICFinalPrint } from '@/lib/reports/uiic-final-builder';
import { ReportPreviewPanel } from '@/components/shared/ReportPreviewPanel';
import {
  RotateCcw, Calendar, MapPin, Camera, ClipboardCheck,
  CheckCircle2, AlertCircle, FileText, ArrowRight,
} from 'lucide-react';
import { useState, useMemo } from 'react';

// ─── Inline Live Preview ─────────────────────────────────────────────────────
function RIPreview({ claim, profile }: { claim: any; profile: any }) {
  const html = useMemo(() => {
    try { return buildUIICFinalHTML(claim, profile); } catch { return ''; }
  }, [claim, profile]);

  return (
    <ReportPreviewPanel
      html={html}
      title="Re-inspection / UIIC Report — Live Preview"
      printLabel="Power Print"
      onPrint={() => triggerUIICFinalPrint(claim, profile)}
    />
  );
}

export function ReinspectionTab() {
  const { currentClaim, updateReinspection } = useClaimStore();
  const { profile } = useProfileStore();

  if (!currentClaim) return null;

  const allowedRows = currentClaim.assessmentRows.filter(r => r.allowed);

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
            <RotateCcw size={11} />
            Post-Repair Verification
          </div>
          <h1 className="text-2xl lg:text-3xl font-black mb-2" style={{ color: '#F8F9FA', letterSpacing: '-0.02em' }}>
            Re-inspection Report
          </h1>
          <p className="text-sm" style={{ color: 'rgba(232,236,240,0.65)' }}>
            Confirm that repairs have been carried out as per assessment and old parts have been surrendered.
          </p>
        </div>
      </div>

      <div className="px-6 lg:px-12 py-8 max-w-5xl mx-auto space-y-6">
        
        {/* ── Metadata ───────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-[#E2E6EA] shadow-sm">
            <h3 className="text-sm font-black mb-4 flex items-center gap-2" style={{ color: '#0D1B2A' }}>
              <Calendar size={16} style={{ color: '#D4AF37' }} />
              Inspection Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8D99AE] block mb-1.5">Date of Re-inspection</label>
                <input 
                  type="date" 
                  value={currentClaim.reinspection.date || ''} 
                  onChange={e => updateReinspection({ date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E6EA] outline-none text-sm font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8D99AE] block mb-1.5">RI Appointment Date</label>
                <input 
                  type="date" 
                  value={currentClaim.reinspection.riAppointmentDate || ''} 
                  onChange={e => updateReinspection({ riAppointmentDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E6EA] outline-none text-sm font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8D99AE] block mb-1.5">Repair Auth. Date</label>
                <input 
                  type="date" 
                  value={currentClaim.reinspection.repairAuthDate || ''} 
                  onChange={e => updateReinspection({ repairAuthDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E6EA] outline-none text-sm font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8D99AE] block mb-1.5">Repairs Done as Assessed?</label>
                <div className="flex gap-2">
                  {['YES', 'NO', 'PARTIAL'].map(val => (
                    <button
                      key={val}
                      onClick={() => updateReinspection({ repairsAsAssessed: val as any })}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all ${
                        currentClaim.reinspection.repairsAsAssessed === val 
                        ? 'bg-[#D4AF37] text-[#0D1B2A]' 
                        : 'bg-[#FAFAFA] border border-[#E2E6EA] text-[#8D99AE]'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8D99AE] block mb-1.5">Est. Completion Date</label>
                <input 
                  type="date" 
                  value={currentClaim.reinspection.estCompletionDate || ''} 
                  onChange={e => updateReinspection({ estCompletionDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E6EA] outline-none text-sm font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8D99AE] block mb-1.5">Actual Completion Date</label>
                <input 
                  type="date" 
                  value={currentClaim.reinspection.actualCompletionDate || ''} 
                  onChange={e => updateReinspection({ actualCompletionDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E6EA] outline-none text-sm font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#E2E6EA] shadow-sm">
            <h3 className="text-sm font-black mb-4 flex items-center gap-2" style={{ color: '#0D1B2A' }}>
              <ClipboardCheck size={16} style={{ color: '#D4AF37' }} />
              Major Parts Re-inspected
            </h3>
            <div className="max-h-[120px] overflow-y-auto space-y-2 pr-2">
              {allowedRows.slice(0, 5).map(row => (
                <div key={row.id} className="flex items-center justify-between text-xs py-1.5 border-bottom border-[#F0F2F5]">
                  <span className="font-medium text-[#4A4E69] truncate w-2/3">{row.particulars}</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 uppercase">Fitment OK</span>
                </div>
              ))}
              {allowedRows.length > 5 && (
                <div className="text-[10px] text-[#8D99AE] italic">+{allowedRows.length - 5} more parts</div>
              )}
              {allowedRows.length === 0 && (
                <div className="text-xs text-[#8D99AE] flex items-center gap-2">
                  <AlertCircle size={12} /> No allowed parts found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Visual Confirmation ────────────────────────── */}
        <div className="p-6 rounded-2xl bg-white border border-[#E2E6EA] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black flex items-center gap-2" style={{ color: '#0D1B2A' }}>
              <Camera size={16} style={{ color: '#D4AF37' }} />
              Re-inspection Photographs
            </h3>
            <button className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] hover:underline flex items-center gap-1">
              Surrender Old Parts <ArrowRight size={10} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="aspect-video rounded-xl border-2 border-dashed border-[#E2E6EA] flex flex-col items-center justify-center gap-2 bg-[#FAFAFA] hover:bg-[#F0F2F5] transition-all cursor-pointer group">
              <Camera size={20} className="text-[#C3C9D4] group-hover:text-[#D4AF37]" />
              <span className="text-[10px] font-bold text-[#8D99AE]">Front View</span>
            </div>
            <div className="aspect-video rounded-xl border-2 border-dashed border-[#E2E6EA] flex flex-col items-center justify-center gap-2 bg-[#FAFAFA] hover:bg-[#F0F2F5] transition-all cursor-pointer group">
              <Camera size={20} className="text-[#C3C9D4] group-hover:text-[#D4AF37]" />
              <span className="text-[10px] font-bold text-[#8D99AE]">Chassis Plate</span>
            </div>
            <div className="aspect-video rounded-xl border-2 border-dashed border-[#E2E6EA] flex flex-col items-center justify-center gap-2 bg-[#FAFAFA] hover:bg-[#F0F2F5] transition-all cursor-pointer group">
              <Camera size={20} className="text-[#C3C9D4] group-hover:text-[#D4AF37]" />
              <span className="text-[10px] font-bold text-[#8D99AE]">Part Fitment 1</span>
            </div>
            <div className="aspect-video rounded-xl border-2 border-dashed border-[#E2E6EA] flex flex-col items-center justify-center gap-2 bg-[#FAFAFA] hover:bg-[#F0F2F5] transition-all cursor-pointer group">
              <Camera size={20} className="text-[#C3C9D4] group-hover:text-[#D4AF37]" />
              <span className="text-[10px] font-bold text-[#8D99AE]">Old Parts Salvage</span>
            </div>
          </div>
        </div>

        {/* ── Conclusion ─────────────────────────────────── */}
        <div className="p-6 rounded-2xl bg-white border border-[#E2E6EA] shadow-sm">
          <h3 className="text-sm font-black mb-4 flex items-center gap-2" style={{ color: '#0D1B2A' }}>
            <FileText size={16} style={{ color: '#D4AF37' }} />
            Surveyor Conclusion / Remarks
          </h3>
          <textarea 
            rows={4}
            value={currentClaim.reinspection.observations || ''}
            onChange={e => updateReinspection({ observations: e.target.value })}
            placeholder="I have personally re-inspected the vehicle... All parts replaced are as per assessment..."
            className="w-full px-4 py-3 rounded-xl border border-[#E2E6EA] outline-none text-sm text-[#4A4E69] bg-[#FAFAFA] focus:bg-white transition-all"
          />
        </div>

        {/* ── Certificate Card ───────────────────────────── */}
        <div 
          className="p-6 rounded-2xl relative overflow-hidden flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #0D1B2A, #1e3a5f)' }}
        >
          <div className="relative z-10">
            <h3 className="text-base font-black text-white mb-1">Re-inspection Certificate</h3>
            <p className="text-xs text-white/60">Ready to issue certificate for claim {currentClaim.reportNo || 'DRAFT'}</p>
          </div>
          <button 
            className="relative z-10 px-6 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-105 active:scale-95"
            style={{ background: '#D4AF37', color: '#0D1B2A' }}
            onClick={() => triggerUIICFinalPrint(currentClaim, profile)}
          >
            Print RI Report
          </button>
          
          {/* Decorative Shield */}
          <div className="absolute top-1/2 right-[15%] -translate-y-1/2 opacity-10">
            <RotateCcw size={120} color="#FFFFFF" strokeWidth={1} />
          </div>
        </div>

        {/* ── Live RI Report Preview ────────────────────────── */}
        <RIPreview claim={currentClaim} profile={profile} />

      </div>
    </div>
  );
}
