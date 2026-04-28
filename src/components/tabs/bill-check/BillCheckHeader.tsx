'use client';

import { CheckCircle2, Layout, Columns } from 'lucide-react';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import type { fmt as FmtType } from './config';

interface BcSummary {
  grandTotalBilled: number;
  netLiability: number;
  notInBillTotal: number;
}

interface Props {
  showEvidence: boolean;
  onToggleEvidence: () => void;
  bcSummary: BcSummary;
  claimId: string | null;
  fmt: typeof FmtType;
}

export function BillCheckHeader({ showEvidence, onToggleEvidence, bcSummary, claimId, fmt }: Props) {
  const handleToggle = () => {
    onToggleEvidence();
    if (!showEvidence && claimId) {
      useEvidenceStore.getState().openField(claimId, {
        docType: 'final-bill',
        fieldKey: 'bill_items',
        contextSnippet: 'Reviewing extracted bill items against assessment...',
      });
    }
  };

  return (
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
          <h1 className="text-2xl lg:text-3xl font-black mb-2" style={{ color: '#F8F9FA', letterSpacing: '-0.02em' }}>
            Bill Check Report
          </h1>
          <button
            onClick={handleToggle}
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
        <p className="text-sm" style={{ color: 'rgba(232,236,240,0.65)' }}>
          Verify that items <strong style={{ color: '#D4AF37' }}>allowed</strong> in the Final Survey Report are correctly
          reflected in the workshop&apos;s final bill submitted to the insurer.
        </p>
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
  );
}
