'use client';

import { Loader2, FileText, Building2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ClaimData } from '@/types/claim';
import type { AssessmentSummary } from '@/types';
import type { SurveyorProfile } from '@/types/vehicle';
import { generateWordReport } from '@/lib/reports/word-builder';
import { triggerStandardPrint } from '@/lib/reports/standard-report-builder';
import { triggerUIICFinalPrint } from '@/lib/reports/uiic-final-builder';

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
  claim, summary, profile, format, setFormat,
  isExportingWord, setIsExportingWord, zoom, setZoom,
}: SurveyActionsProps) {
  return (
    <>
      {/* Format Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {FORMATS.map(f => (
          <button
            key={f.id}
            onClick={() => setFormat(f.id as 'standard' | 'uiic')}
            className="relative flex items-start gap-4 p-4 rounded-2xl text-left transition-all"
            style={{
              background: format === f.id ? f.color : '#FFFFFF',
              border: format === f.id ? `2px solid ${f.accent}` : '2px solid #E2E6EA',
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
                background: format === f.id ? 'rgba(255,255,255,0.12)' : 'rgba(13,27,42,0.06)',
                color: format === f.id ? f.accent : f.color,
              }}
            >
              {f.icon}
            </div>
            <div>
              <div className="text-sm font-black mb-0.5" style={{ color: format === f.id ? '#FFFFFF' : '#0D1B2A' }}>
                {f.label}
              </div>
              <div className="text-[10px] font-bold mb-1" style={{ color: format === f.id ? f.accent : '#8D99AE' }}>
                {f.subtitle}
              </div>
              <div className="text-xs leading-relaxed" style={{ color: format === f.id ? 'rgba(255,255,255,0.65)' : '#6B7280' }}>
                {f.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 mr-2 shadow-sm">
        <button
          onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}
          className="px-2 py-1.5 hover:bg-gray-100 rounded text-sm font-black text-gray-600 transition-colors"
        >
          -
        </button>
        <span className="text-xs font-bold w-12 text-center text-gray-700">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(z => Math.min(2, z + 0.1))}
          className="px-2 py-1.5 hover:bg-gray-100 rounded text-sm font-black text-gray-600 transition-colors"
        >
          +
        </button>
      </div>

      {/* Word Export (standard only) */}
      {format === 'standard' && (
        <button
          onClick={async () => {
            setIsExportingWord(true);
            try {
              await generateWordReport(claim, summary);
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
      )}

      {/* Power Print — Standard */}
      {format === 'standard' && (
        <button
          onClick={() => triggerStandardPrint(claim, summary, profile)}
          className="flex items-center gap-2 px-8 py-3 rounded-xl font-black text-sm transition-all shadow-xl hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #0D1B2A, #1a3a5c)', color: '#FFFFFF', cursor: 'pointer', border: 'none' }}
        >
          <div className="w-3 h-3 rounded-sm bg-amber-400 animate-pulse" />
          POWER PRINT — FINAL SURVEY REPORT
        </button>
      )}

      {/* Power Print — UIIC */}
      {format === 'uiic' && (
        <button
          onClick={() => triggerUIICFinalPrint(claim, profile)}
          className="flex items-center gap-2 px-8 py-3 rounded-xl font-black text-sm transition-all shadow-xl hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #006838, #009a52)', color: '#FFFFFF', cursor: 'pointer', border: 'none' }}
        >
          <div className="w-3 h-3 rounded-sm bg-amber-400 animate-pulse" />
          POWER PRINT — UIIC FINAL SURVEY REPORT
        </button>
      )}
    </>
  );
}
