'use client';

import React from 'react';
import { Loader2, FileText, Building2, CheckCircle2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import type { ClaimData } from '@/types/claim';
import type { SurveyorProfile } from '@/types/vehicle';
import { downloadAsWord } from '@/lib/reports/word-export';
import { footerFromProfile } from '@/lib/reports/print-shell';
import { buildStandardFinalSurveyHTML } from '@/lib/reports/standard-report-builder';
import { buildUIICBillCheckHTML } from '@/lib/reports/uiic-final-builder';
import { useBillCheckPrintGate } from '@/hooks/useBillCheckPrintGate';

const FORMATS = [
  {
    id: 'standard',
    label: 'Standard Format',
    subtitle: 'Generic — All Insurers',
    description: 'Compares allowed items against workshop final bill with serial tracking and variance calculation.',
    color: '#0D1B2A',
    accent: '#D4AF37',
    icon: <FileText size={18} />,
  },
  {
    id: 'uiic',
    label: 'UIIC Format',
    subtitle: 'United India Insurance Co. Ltd.',
    description: 'Insurer-specific format with UIIC branding, allowed item verification, and workshop liability summary.',
    color: '#006838',
    accent: '#C9993F',
    icon: <Building2 size={18} />,
  },
];

interface Props {
  claim: ClaimData;
  profile: SurveyorProfile;
  format: 'standard' | 'uiic';
  setFormat: (f: 'standard' | 'uiic') => void;
  isExportingWord: boolean;
  setIsExportingWord: (v: boolean) => void;
  zoom: number;
  setZoom: (fn: (z: number) => number) => void;
}

export function BillCheckActions({
  claim,
  profile,
  format,
  setFormat,
  isExportingWord,
  setIsExportingWord,
  zoom,
  setZoom,
}: Props) {
  const { requestPrint, dialogs } = useBillCheckPrintGate();

  const handleExportWord = async () => {
    setIsExportingWord(true);
    try {
      const html =
        format === 'uiic'
          ? buildUIICBillCheckHTML(claim, profile)
          : buildStandardFinalSurveyHTML(claim, profile, 'bill-check');
      const filename = `${claim?.vehicle?.registrationNumber || 'Claim'}-${format === 'uiic' ? 'UIIC' : 'Standard'}-Bill-Check`;
      await downloadAsWord(html, filename, footerFromProfile(profile));
      toast.success('Word report exported');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export Word document');
    } finally {
      setIsExportingWord(false);
    }
  };

  return (
    <>
      {dialogs}

      {/* Format Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 w-full">
        {FORMATS.map((f) => (
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
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
          className="px-2 py-1.5 hover:bg-neutral-100 rounded text-sm font-medium text-muted-foreground transition-colors"
          title="Zoom out"
        >
          -
        </button>
        <span className="text-xs font-mono font-medium text-foreground w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
          className="px-2 py-1.5 hover:bg-neutral-100 rounded text-sm font-medium text-muted-foreground transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setZoom(() => 0.9)}
          className="px-2 py-1 hover:bg-neutral-100 rounded text-[11px] font-medium text-muted-foreground transition-colors ml-1 border-l border-border pl-2"
          title="Reset zoom"
        >
          Reset
        </button>
      </div>

      {/* Export Word */}
      <button
        onClick={handleExportWord}
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

      {/* Power Print Button */}
      <button
        onClick={() => requestPrint(format)}
        className="flex items-center gap-2 px-8 py-3 rounded-xl font-medium text-sm transition-all shadow-xl hover:scale-105 active:scale-95 text-white"
        style={{
          background: format === 'uiic' ? 'var(--color-status-success)' : 'var(--color-neutral-900)',
          cursor: 'pointer',
          border: 'none',
        }}
      >
        <Printer size={16} />
        PRINT PDF — {format === 'uiic' ? 'UIIC' : 'STANDARD'} BILL CHECK
      </button>
    </>
  );
}
