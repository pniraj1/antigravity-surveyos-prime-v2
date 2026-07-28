'use client';

import { CheckCircle2, Layout, Columns } from 'lucide-react';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { SaveProgressButton } from '@/components/sync/SaveProgressButton';
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
      style={{ background: '#EEF2FF', borderBottom: '1px solid #C7D2FE' }}
    >
      <div className="max-w-5xl mx-auto">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.2em] mb-4 bg-primary/10 text-primary border border-primary/30"
        >
          <CheckCircle2 size={11} />
          Final Bill Verification
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl lg:text-3xl font-medium mb-2 text-[#1D1D1F]" style={{ letterSpacing: '-0.02em' }}>
            Bill Check Report
          </h1>
          <div className="flex items-center gap-3">
            <SaveProgressButton className="shadow-lg" />
            <button
              onClick={handleToggle}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg"
              style={{
                background: showEvidence ? 'var(--color-primary)' : '#E0E7FF',
                color: showEvidence ? 'var(--color-primary-foreground)' : '#3730A3',
                border: `1px solid ${showEvidence ? 'var(--color-primary)' : '#A5B4FC'}`,
              }}
            >
              {showEvidence ? <Layout size={16} /> : <Columns size={16} />}
              {showEvidence ? 'Full View' : 'Show Evidence'}
            </button>
          </div>
        </div>
        <p className="text-sm text-[#4B5563]">
          Verify that items <strong className="text-primary">allowed</strong> in the Final Survey Report are correctly
          reflected in the workshop&apos;s final bill submitted to the insurer.
        </p>
        <div className="flex flex-wrap gap-3 mt-5">
          <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-status-success/10 text-status-success">
            Total Billed: {fmt(bcSummary.grandTotalBilled)}
          </div>
          <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            Final Liability: {fmt(bcSummary.netLiability)}
          </div>
          <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-status-danger/10 text-status-danger">
            Saving to Insurer: {fmt(bcSummary.notInBillTotal)}
          </div>
        </div>
      </div>
    </div>
  );
}
