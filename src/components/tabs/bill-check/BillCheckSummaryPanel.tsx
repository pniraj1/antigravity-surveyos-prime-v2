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
    { label: 'Assessed (Allowed)', value: fmt(summary.grandTotal),  accent: 'var(--color-neutral-900)', icon: <DollarSign size={15} /> },
    { label: 'In Bill',            value: fmt(inBillTotal),          accent: 'var(--color-status-success)', icon: <CheckCircle2 size={15} /> },
    { label: 'Not in Bill',        value: fmt(notInBillTotal),       accent: 'var(--color-status-danger)', icon: <XCircle size={15} /> },
    { label: 'Variance',           value: fmt(partialTotal),         accent: 'var(--color-status-warning)', icon: <Minus size={15} /> },
  ];

  return (
    <>
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className="p-5 rounded-2xl relative overflow-hidden bg-card border border-border">
            <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-2xl" style={{ background: card.accent }} />
            <div className="flex items-center gap-1.5 mb-2 mt-1" style={{ color: card.accent }}>
              {card.icon}
              <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{card.label}</span>
            </div>
            <div className="text-xl font-medium text-foreground">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Final Liability Summary */}
      <div className="rounded-2xl p-6 shadow-sm border bg-card border-border">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Calculator size={18} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Final Liability Summary</h3>
            <p className="text-[10px] text-muted-foreground">Consolidated verification results including GST and Depreciation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Gross Assessed</p>
            <p className="text-lg font-medium text-foreground">{fmt(bcSummary.grandTotalAssessed)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Net Billed (After Dep)</p>
            <p className="text-lg font-medium text-status-success">{fmt(bcSummary.grandTotalBilled)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Saving (Not in Bill)</p>
            <p className="text-lg font-medium text-status-danger">-{fmt(bcSummary.notInBillTotal)}</p>
          </div>
          <div className="p-4 rounded-xl shadow-lg border-2 border-primary/20 bg-neutral-900">
            <p className="text-[9px] font-medium text-primary uppercase tracking-[0.2em] mb-1">Final Liability</p>
            <p className="text-2xl font-medium text-white">{fmt(bcSummary.netLiability)}</p>
            <div className="mt-2 text-[8px] text-white/40 uppercase font-medium tracking-widest">Payable to Workshop</div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <p className="text-[10px] font-medium text-muted-foreground italic">
            Verification results update in real-time as you match items to the final bill.
          </p>
        </div>
      </div>
    </>
  );
}
