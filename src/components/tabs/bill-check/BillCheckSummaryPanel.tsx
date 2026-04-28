'use client';

import { DollarSign, CheckCircle2, XCircle, Minus, Calculator } from 'lucide-react';

interface AssessmentSummary {
  grandTotal: number;
  netAssessedLoss: number;
}

interface BcSummary {
  grandTotalAssessed: number;
  grandTotalBilled: number;
  notInBillTotal: number;
  netLiability: number;
}

interface Props {
  summary: AssessmentSummary;
  bcSummary: BcSummary;
  inBillTotal: number;
  notInBillTotal: number;
  partialTotal: number;
  fmt: (n: number) => string;
}

export function BillCheckSummaryPanel({ summary, bcSummary, inBillTotal, notInBillTotal, partialTotal, fmt }: Props) {
  const cards = [
    { label: 'Assessed (Allowed)', value: fmt(summary.grandTotal),  accent: '#0D1B2A', icon: <DollarSign size={15} /> },
    { label: 'In Bill',            value: fmt(inBillTotal),          accent: '#059669', icon: <CheckCircle2 size={15} /> },
    { label: 'Not in Bill',        value: fmt(notInBillTotal),       accent: '#dc2626', icon: <XCircle size={15} /> },
    { label: 'Variance',           value: fmt(partialTotal),         accent: '#d97706', icon: <Minus size={15} /> },
  ];

  return (
    <>
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className="p-5 rounded-2xl relative overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
            <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-2xl" style={{ background: card.accent }} />
            <div className="flex items-center gap-1.5 mb-2 mt-1" style={{ color: card.accent }}>
              {card.icon}
              <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: '#8D99AE' }}>{card.label}</span>
            </div>
            <div className="text-xl font-black" style={{ color: '#0D1B2A' }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Final Liability Summary */}
      <div className="rounded-2xl p-6 shadow-sm border" style={{ background: '#FFFFFF', borderColor: '#E2E6EA' }}>
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
    </>
  );
}
