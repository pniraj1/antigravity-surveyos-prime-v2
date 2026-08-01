'use client';

import { Loader2, FileText, Type } from 'lucide-react';
import { toast } from 'sonner';
import type { ClaimData, FontScale } from '@/types/claim';
import { downloadAsWord } from '@/lib/reports/word-export';
import { useClaimStore } from '@/stores/claim-store';

interface SpotActionsProps {
  claim: ClaimData;
  isExportingWord: boolean;
  setIsExportingWord: (v: boolean) => void;
  onPrint: () => void;
  /**
   * Returns the markup of the hidden SpotPrintReport that react-to-print
   * prints, so the Word file and the printout come from the same DOM.
   */
  getPrintHtml: () => string;
  /** Running-footer text for the Word export — matches the printed footer. */
  footerLeft: string;
}

export function SpotActions({ claim, isExportingWord, setIsExportingWord, onPrint, getPrintHtml, footerLeft }: SpotActionsProps) {
  return (
    <>
      {/* Font Scale Selector */}
      <FontScalePill currentScale={claim.reportSettings?.fontScale ?? 'compact'} />

      {/* Word Export */}
      <button
        onClick={async () => {
          setIsExportingWord(true);
          try {
            downloadAsWord(getPrintHtml(), `${claim.vehicle.registrationNumber || 'Claim'}-Spot-Report`, footerLeft);
            toast.success('Word report generated!');
          } catch (e) {
            console.error(e);
            toast.error('Failed to generate Word report');
          } finally {
            setIsExportingWord(false);
          }
        }}
        disabled={isExportingWord}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all"
        style={{
          background: isExportingWord ? 'var(--color-neutral-100)' : '#FFFFFF',
          color: isExportingWord ? 'var(--color-neutral-400)' : 'var(--color-neutral-900)',
          border: '1.5px solid var(--color-neutral-200)',
          cursor: isExportingWord ? 'not-allowed' : 'pointer',
        }}
      >
        {isExportingWord ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
        {isExportingWord ? 'Building…' : 'Export Word'}
      </button>

      {/* Power Print */}
      <button
        onClick={onPrint}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md border-2 border-status-success text-status-success hover:bg-status-success/10"
        style={{ background: 'var(--color-card)', cursor: 'pointer' }}
      >
        <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
        POWER PRINT (SPOT)
      </button>
    </>
  );
}

// ─── Font Scale Segmented Control ────────────────────────────────────────────

const SCALE_OPTIONS: { id: FontScale; label: string; title: string }[] = [
  { id: 'compact',     label: 'Compact',     title: 'Compact — insurer submission size (default)' },
  { id: 'standard',   label: 'Standard',    title: 'Standard — comfortable reading on screen' },
  { id: 'large-print', label: 'Large Print', title: 'Large Print — client-facing / accessibility' },
];

function FontScalePill({ currentScale }: { currentScale: FontScale }) {
  const { updateReportSettings } = useClaimStore();

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg p-0.5 shadow-inner"
      style={{ background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-200)' }}
      title="Report font density"
    >
      <Type size={11} style={{ color: 'var(--color-neutral-400)', marginLeft: 5, flexShrink: 0 }} />
      {SCALE_OPTIONS.map(opt => {
        const active = currentScale === opt.id;
        return (
          <button
            key={opt.id}
            title={opt.title}
            onClick={() => updateReportSettings({ fontScale: opt.id })}
            className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
            style={{
              background: active ? '#FFFFFF' : 'transparent',
              color: active ? 'var(--color-neutral-900)' : 'var(--color-neutral-400)',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              letterSpacing: '0.02em',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
