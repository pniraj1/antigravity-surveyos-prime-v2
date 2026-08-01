'use client';

import { Loader2, FileText, Building2, CheckCircle2, Type } from 'lucide-react';
import { toast } from 'sonner';
import type { ClaimData, FontScale } from '@/types/claim';
import type { AssessmentSummary } from '@/types';
import type { SurveyorProfile } from '@/types/vehicle';
import { downloadAsWord } from '@/lib/reports/word-export';
import { triggerStandardPrint, buildStandardFinalSurveyHTML } from '@/lib/reports/standard-report-builder';
import { triggerUIICFinalPrint, buildUIICFinalHTML } from '@/lib/reports/uiic-final-builder';
import { useClaimStore } from '@/stores/claim-store';

const FORMATS = [
  {
    id: 'standard',
    label: 'Standard Format',
    subtitle: 'Generic — All Insurers',
    description: 'Universal format accepted by all insurance companies. Includes full vehicle, accident, assessment, and photo pages.',
    color: '#0D1B2A',
    accent: '#D4AF37',
    icon: <FileText size={18} />,
  },
  {
    id: 'uiic',
    label: 'UIIC Format',
    subtitle: 'United India Insurance Co. Ltd.',
    description: 'Insurer-specific 3-page format with UIIC branding, green scheme, CONFIDENTIAL badge, separate allowed/disallowed tables, and formal declaration.',
    color: '#006838',
    accent: '#C9993F',
    icon: <Building2 size={18} />,
  },
];

interface SurveyActionsProps {
  claim: ClaimData;
  summary: AssessmentSummary;
  profile: SurveyorProfile;
  format: 'standard' | 'uiic';
  setFormat: (f: 'standard' | 'uiic') => void;
  isExportingWord: boolean;
  setIsExportingWord: (v: boolean) => void;
  zoom: number;
  setZoom: (fn: (z: number) => number) => void;
}

export function SurveyActions({
  claim,
  summary,
  profile,
  format,
  setFormat,
  isExportingWord,
  setIsExportingWord,
  zoom,
  setZoom,
}: SurveyActionsProps) {

  return (
    <>
      {/* Format Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 w-full">
        {FORMATS.map(f => (
          <button
            key={f.id}
            onClick={() => setFormat(f.id as 'standard' | 'uiic')}
            className="relative flex items-start gap-4 p-4 rounded-2xl text-left transition-all"
            style={{
              background: format === f.id ? f.color : 'var(--color-neutral-50)',
              border: format === f.id ? `2px solid ${f.accent}` : '2px solid var(--color-neutral-200)',
              boxShadow: format === f.id ? '0 4px 16px rgba(0,0,0,0.12)' : 'none',
            }}
          >
            {format === f.id && (
              <div
                className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: f.accent }}
              >
                <CheckCircle2 size={13} style={{ color: format === 'standard' ? '#0D1B2A' : '#FFFFFF' }} />
              </div>
            )}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{
                background: format === f.id ? 'rgba(255,255,255,0.12)' : 'var(--color-neutral-100)',
                color: format === f.id ? f.accent : f.color,
              }}
            >
              {f.icon}
            </div>
            <div>
              <div className="text-sm font-medium mb-0.5" style={{ color: format === f.id ? '#FFFFFF' : 'var(--color-neutral-900)' }}>
                {f.label}
              </div>
              <div className="text-[10px] font-medium mb-1" style={{ color: format === f.id ? f.accent : 'var(--color-neutral-400)' }}>
                {f.subtitle}
              </div>
              <div className="text-xs leading-relaxed" style={{ color: format === f.id ? 'rgba(255,255,255,0.65)' : 'var(--color-neutral-400)' }}>
                {f.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 mr-2 shadow-sm">
        <button
          onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}
          className="px-2 py-1.5 hover:bg-neutral-100 rounded text-sm font-medium text-muted-foreground transition-colors"
        >
          -
        </button>
        <span className="text-xs font-medium w-12 text-center text-foreground">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(z => Math.min(2, z + 0.1))}
          className="px-2 py-1.5 hover:bg-neutral-100 rounded text-sm font-medium text-muted-foreground transition-colors"
        >
          +
        </button>
      </div>

      {/* Font Scale Selector */}
      <FontScalePill currentScale={claim.reportSettings?.fontScale ?? 'compact'} />

      {/* Word Export — same HTML the Power Print button sends to the printer */}
      <button
          onClick={async () => {
            setIsExportingWord(true);
            try {
              const regNo = claim.vehicle.registrationNumber || 'Claim';
              if (format === 'uiic') {
                downloadAsWord(buildUIICFinalHTML(claim, profile), `${regNo}-UIIC-Final-Survey`);
              } else {
                downloadAsWord(buildStandardFinalSurveyHTML(claim, summary, profile), `${regNo}-Final-Survey`);
              }
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
            background: isExportingWord ? 'var(--color-neutral-100)' : 'var(--color-neutral-50)',
            color: isExportingWord ? 'var(--color-neutral-400)' : 'var(--color-neutral-900)',
            border: '1.5px solid var(--color-neutral-200)',
            cursor: isExportingWord ? 'not-allowed' : 'pointer',
          }}
        >
          {isExportingWord ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
          {isExportingWord ? 'Building…' : 'Export Word'}
        </button>

      {/* Power Print — Standard */}
      {format === 'standard' && (
        <button
          onClick={() => triggerStandardPrint(claim, summary, profile)}
          className="flex items-center gap-2 px-8 py-3 rounded-xl font-medium text-sm transition-all shadow-xl hover:scale-105 active:scale-95"
          style={{ background: 'var(--color-neutral-900)', color: '#FFFFFF', cursor: 'pointer', border: 'none' }}
        >
          <div className="w-3 h-3 rounded-sm bg-primary animate-pulse" />
          POWER PRINT — FINAL SURVEY REPORT
        </button>
      )}

      {/* Power Print — UIIC */}
      {format === 'uiic' && (
        <button
          onClick={() => triggerUIICFinalPrint(claim, profile)}
          className="flex items-center gap-2 px-8 py-3 rounded-xl font-medium text-sm transition-all shadow-xl hover:scale-105 active:scale-95"
          style={{ background: 'var(--color-status-success)', color: '#FFFFFF', cursor: 'pointer', border: 'none' }}
        >
          <div className="w-3 h-3 rounded-sm bg-primary animate-pulse" />
          POWER PRINT — UIIC FINAL SURVEY REPORT
        </button>
      )}
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
              background: active ? 'var(--color-neutral-50)' : 'transparent',
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
