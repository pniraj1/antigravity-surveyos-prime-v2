'use client';

import { useClaimStore } from '@/stores/claim-store';
import { calculateAssessmentSummary } from '@/lib/calculations';
import { detectCTL } from '@/lib/calculations/assessment';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { AlertCircle, CheckCircle2, MessageSquare, Info } from 'lucide-react';
import { toast } from 'sonner';

export function TotalLossForm() {
  const currentClaim = useClaimStore(s => s.currentClaim);
  const updateClaim = useClaimStore(s => s.updateClaim);

  if (!currentClaim) return null;

  // Calculate assessment summary for CTL detection
  const ageMonths = getVehicleAgeMonths(
    currentClaim.vehicle?.dateOfRegistration,
    currentClaim.vehicle?.yearOfManufacture,
    currentClaim.accident?.dateAndTime
  );

  const summary = calculateAssessmentSummary(
    currentClaim.assessmentRows || [],
    ageMonths,
    currentClaim.depreciationType || 'standard',
    currentClaim.feeBill?.salvageValue || 0,
    currentClaim.feeBill?.compulsoryExcess || 500,
    currentClaim.feeBill?.voluntaryExcess || 0
  );

  const ctlStatus = detectCTL(summary.netAssessedLoss, currentClaim.policy?.idv);
  const isTL = currentClaim.isTotalLoss || false;

  const handleTLToggle = () => {
    updateClaim({
      isTotalLoss: !isTL,
      totalLossDetails: !isTL ? {
        salvageWithRC: 0,
        salvageWithoutRC: 0,
        towingExpenses: 0,
        workshopRent: 0,
        remarks: 'NOTE: Since the assessed repair cost is substantial relative to the IDV, the settlement comparison is provided above for the insurer\'s final decision.'
      } : undefined
    });
    toast.success(!isTL ? "Total Loss mode enabled" : "Switched to Repair basis");
  };

  const updateTLDetails = (key: string, val: any) => {
    updateClaim({
      totalLossDetails: {
        ...(currentClaim.totalLossDetails || {
          salvageWithRC: 0,
          salvageWithoutRC: 0,
          towingExpenses: 0,
          workshopRent: 0,
          remarks: ''
        }),
        [key]: val
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Section Header ───────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gray-100 text-gray-500">
          <AlertCircle size={18} />
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight">Total Loss Settlement</h3>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">CTL Threshold & 4-Way Comparison</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* CTL Suggestion Banner */}
        {ctlStatus.isCTL && !isTL && (
          <div className="flex items-center justify-between p-5 rounded-2xl animate-in zoom-in-95 duration-300 shadow-sm"
               style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-red-600 text-white shadow-lg shadow-red-200">
                <AlertCircle size={24} />
              </div>
              <div>
                <div className="text-sm font-black text-red-900 leading-tight flex items-center gap-2">
                  CONSTRUCTIVE TOTAL LOSS SUGGESTED
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-black">{(ctlStatus.ratio * 100).toFixed(1)}%</span>
                </div>
                <div className="text-[11px] font-bold text-red-700/70 mt-1">
                  Asst. ₹{summary.netAssessedLoss.toLocaleString()} exceeds 75% of IDV ₹{ctlStatus.idv.toLocaleString()}
                </div>
              </div>
            </div>
            <button
              onClick={handleTLToggle}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-red-200 transition-all active:scale-95"
            >
              Enable TL Mode
            </button>
          </div>
        )}

        {/* TL Control Panel */}
        <div className={`p-8 rounded-[2rem] transition-all duration-500 border-2 ${isTL ? 'bg-white shadow-2xl scale-[1.01]' : 'bg-gray-50/50 border-gray-100 opacity-60'}`}
             style={{ borderColor: isTL ? '#006838' : 'transparent' }}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isTL ? 'bg-green-700 text-white shadow-lg shadow-green-100' : 'bg-gray-200 text-gray-400'}`}>
                {isTL ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
              </div>
              <div>
                <h3 className={`text-base font-black tracking-tight uppercase ${isTL ? 'text-green-900' : 'text-gray-400'}`}>
                  {isTL ? 'Total Loss Mode Active' : 'Total Loss Mode Disabled'}
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  {isTL ? 'Generating comparison table for report' : 'Report will follow standard repair basis'}
                </p>
              </div>
            </div>
            <button
              onClick={handleTLToggle}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isTL ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-600 text-white hover:bg-green-700 shadow-md'}`}
            >
              {isTL ? 'Switch to Repair basis' : 'Force TL Mode'}
            </button>
          </div>

          {isTL && (
            <div className="space-y-8 animate-in slide-in-from-top-4 duration-500">
              {/* Numeric Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Salvage (With RC)', key: 'salvageWithRC', info: 'Sold as a whole with RC handover' },
                  { label: 'Salvage (Without RC)', key: 'salvageWithoutRC', info: 'Sold as scrap/parts' },
                  { label: 'Towing Expenses', key: 'towingExpenses', info: 'Additional towing for salvage move' },
                  { label: 'Workshop Rent/Adv.', key: 'workshopRent', info: 'Haltage or advance rent charges' },
                ].map((field) => (
                  <div key={field.key} className="space-y-2">
                    <div className="flex items-center gap-1.5 ml-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        {field.label}
                      </label>
                      <div className="group relative">
                        <Info size={10} className="text-gray-300 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                          {field.info}
                        </div>
                      </div>
                    </div>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-bold text-sm">₹</span>
                      <input
                        type="number"
                        value={(currentClaim.totalLossDetails as any)?.[field.key] || ''}
                        onChange={(e) => updateTLDetails(field.key, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full pl-8 pr-4 py-4 rounded-2xl border-2 border-gray-100 focus:border-green-600 focus:ring-0 transition-all font-bold text-base placeholder:text-gray-100"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Remarks Field */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 ml-1">
                  <MessageSquare size={14} className="text-green-600" />
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Settlement Justification / Special Remarks
                  </label>
                </div>
                <textarea
                  value={currentClaim.totalLossDetails?.remarks || ''}
                  onChange={(e) => updateTLDetails('remarks', e.target.value)}
                  placeholder="Enter remarks for the total loss recommendation..."
                  rows={3}
                  className="w-full px-6 py-5 rounded-2xl border-2 border-gray-100 focus:border-green-600 focus:ring-0 transition-all font-medium text-sm text-gray-700 leading-relaxed placeholder:text-gray-200"
                />
                <p className="text-[9px] font-bold text-gray-400 flex items-center gap-1 ml-1 uppercase tracking-wider">
                  <CheckCircle2 size={10} className="text-green-500" />
                  This note will appear at the bottom of the settlement table in the report.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
