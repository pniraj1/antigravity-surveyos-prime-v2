'use client';

import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { buildReinspectionHTML, triggerReinspectionPrint } from '@/lib/reports/reinspection-report-builder';
import { ReportPreviewPanel } from '@/components/shared/ReportPreviewPanel';
import { RotateCcw, Calendar, FileText } from 'lucide-react';
import { useMemo } from 'react';

// ─── Inline Live Preview ─────────────────────────────────────────────────────
function RIPreview({ claim, profile }: { claim: any; profile: any }) {
  const html = useMemo(() => {
    try { return buildReinspectionHTML(claim, profile); } catch { return ''; }
  }, [claim, profile]);

  return (
    <ReportPreviewPanel
      html={html}
      title="Re-inspection Report — Live Preview"
      printLabel="Power Print"
      onPrint={() => triggerReinspectionPrint(claim, profile)}
    />
  );
}

export function ReinspectionTab() {
  const { currentClaim, updateReinspection } = useClaimStore();
  const { profile } = useProfileStore();

  if (!currentClaim) return null;

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

        {/* ── Inspection Details ─────────────────────────── */}
        <div className="p-6 rounded-2xl bg-white border border-[#E2E6EA] shadow-sm">
          <h3 className="text-sm font-black mb-4 flex items-center gap-2" style={{ color: '#0D1B2A' }}>
            <Calendar size={16} style={{ color: '#D4AF37' }} />
            Inspection Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className="text-[10px] font-black uppercase tracking-widest text-[#8D99AE] block mb-1.5">Repair Auth. Date</label>
              <input
                type="date"
                value={currentClaim.reinspection.repairAuthDate || ''}
                onChange={e => updateReinspection({ repairAuthDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E2E6EA] outline-none text-sm font-semibold"
              />
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
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#8D99AE] block mb-1.5">Repairs Done as Assessed?</label>
              <div className="flex gap-2">
                {(['YES', 'NO', 'PARTIAL'] as const).map(val => (
                  <button
                    key={val}
                    onClick={() => updateReinspection({ repairsAsAssessed: val })}
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
          </div>
        </div>

        {/* ── Reinspection Findings ─────────────────────── */}
        <div className="p-6 rounded-2xl bg-white border border-[#E2E6EA] shadow-sm">
          <h3 className="text-sm font-black mb-4 flex items-center gap-2" style={{ color: '#0D1B2A' }}>
            <RotateCcw size={16} style={{ color: '#D4AF37' }} />
            Reinspection Findings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#8D99AE] block mb-1.5">Vehicle Condition</label>
              <input
                type="text"
                value={currentClaim.reinspection.vehicleCondition || ''}
                onChange={e => updateReinspection({ vehicleCondition: e.target.value as any })}
                placeholder="e.g. Road Worthy"
                className="w-full px-3 py-2 rounded-lg border border-[#E2E6EA] outline-none text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#8D99AE] block mb-1.5">Salvage Status</label>
              <input
                type="text"
                value={currentClaim.reinspection.salvageStatus || ''}
                onChange={e => updateReinspection({ salvageStatus: e.target.value as any })}
                placeholder="e.g. Collected"
                className="w-full px-3 py-2 rounded-lg border border-[#E2E6EA] outline-none text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#8D99AE] block mb-1.5">Repair Quality</label>
              <input
                type="text"
                value={currentClaim.reinspection.repairQuality || ''}
                onChange={e => updateReinspection({ repairQuality: e.target.value as any })}
                placeholder="e.g. Satisfactory"
                className="w-full px-3 py-2 rounded-lg border border-[#E2E6EA] outline-none text-sm font-semibold"
              />
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
            rows={5}
            value={currentClaim.reinspection.observations || ''}
            onChange={e => updateReinspection({ observations: e.target.value })}
            placeholder="WE HAVE RE-INSPECTED THE CAPTIONED VEHICLE & HAVE FOUND THAT THE REPAIRS / REPLACEMENTS MADE THEREIN WERE STRICTLY FOLLOWED AS PER OUR FINAL SURVEY REPORT..."
            className="w-full px-4 py-3 rounded-xl border border-[#E2E6EA] outline-none text-sm text-[#4A4E69] bg-[#FAFAFA] focus:bg-white transition-all"
          />
        </div>

        {/* ── Live RI Report Preview ────────────────────────── */}
        <RIPreview claim={currentClaim} profile={profile} />

      </div>
    </div>
  );
}
