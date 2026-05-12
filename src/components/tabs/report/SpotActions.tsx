'use client';

import { Loader2, FileText, Type } from 'lucide-react';
import { toast } from 'sonner';
import type { ClaimData, FontScale } from '@/types/claim';
import type { SurveyorProfile } from '@/types/vehicle';
import { generateSpotWordReport } from '@/lib/reports/word-builder';
import { useClaimStore } from '@/stores/claim-store';

interface SpotActionsProps {
  claim: ClaimData;
  profile: SurveyorProfile;
  isExportingWord: boolean;
  setIsExportingWord: (v: boolean) => void;
  onPrint: () => void;
}

export function SpotActions({ claim, profile, isExportingWord, setIsExportingWord, onPrint }: SpotActionsProps) {
  return (
    <>
      {/* Font Scale Selector */}
      <FontScalePill currentScale={claim.reportSettings?.fontScale ?? 'compact'} />

      {/* Word Export */}
      <button
        onClick={async () => {
          setIsExportingWord(true);
          try {
            await generateSpotWordReport(claim, profile);
            toast.success('Word report generated!');
          } catch (e) {
            console.error(e);
            toast.error('Failed to generate Word report');
          } finally {
            setIsExportingWord(false);
          }
        }}
        disabled={isExportingWord}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
        style={{
          background: isExportingWord ? '#F0F2F5' : '#FFFFFF',
          color: isExportingWord ? '#8D99AE' : '#0D1B2A',
          border: '1.5px solid #E2E6EA',
          cursor: isExportingWord ? 'not-allowed' : 'pointer',
        }}
      >
        {isExportingWord ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
        {isExportingWord ? 'Building…' : 'Export Word (.docx)'}
      </button>

      {/* Power Print */}
      <button
        onClick={onPrint}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all shadow-md border-2 border-green-700 text-green-700 hover:bg-green-50"
        style={{ background: '#FFFFFF', cursor: 'pointer' }}
      >
        <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
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
      style={{ background: '#F0F2F5', border: '1px solid #E2E6EA' }}
      title="Report font density"
    >
      <Type size={11} style={{ color: '#8D99AE', marginLeft: 5, flexShrink: 0 }} />
      {SCALE_OPTIONS.map(opt => {
        const active = currentScale === opt.id;
        return (
          <button
            key={opt.id}
            title={opt.title}
            onClick={() => updateReportSettings({ fontScale: opt.id })}
            className="px-2.5 py-1 rounded-md text-[10px] font-bold transition-all"
            style={{
              background: active ? '#FFFFFF' : 'transparent',
              color: active ? '#0D1B2A' : '#8D99AE',
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
