'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { calculateAssessmentSummary } from '@/lib/calculations';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { Card, CardContent } from '@/components/ui/card';
import { DownloadCloud, Loader2, AlertCircle, FileText, Building2, CheckCircle2, Receipt } from 'lucide-react';
import { generateWordReport } from '@/lib/reports/word-builder';
import { toast } from 'sonner';

// ─── PDF Document Imports ───────────────────────────────────────────────────
import { SurveyReportDocument } from '@/components/pdf/SurveyReportDocument';
import { SpotReportDocument } from '@/components/pdf/SpotReportDocument';
import { UIICReportDocument } from '@/components/pdf/UIICReportDocument';
import { BillCheckDocument } from '@/components/pdf/BillCheckDocument';
import { FeeBillDocument } from '@/components/pdf/FeeBillDocument';
import { PhotoSheetDocument } from '@/components/pdf/PhotoSheetDocument';

// ─── Dynamic PDF imports ─────────────────────────────────────────────────────
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then(m => m.PDFViewer),
  { ssr: false, loading: () => <PDFLoadingFallback /> }
);
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(m => m.PDFDownloadLink),
  { ssr: false }
);
import { useReactToPrint } from 'react-to-print';
import { UIICPrintReport } from '@/components/print/UIICPrintReport';
import { UIICExcelBuilder } from '@/lib/reports/uiic-excel-builder';
import { useRef } from 'react';
import { SpotPrintReport } from '@/components/print/SpotPrintReport';

function PDFLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[500px] rounded-2xl" style={{ background: '#F0F2F5' }}>
      <Loader2 className="h-8 w-8 animate-spin mb-4" style={{ color: '#D4AF37', opacity: 0.7 }} />
      <p className="text-sm font-black uppercase tracking-widest animate-pulse" style={{ color: '#8D99AE' }}>
        Compiling PDF Engine…
      </p>
    </div>
  );
}

// ─── Format Options ──────────────────────────────────────────────────────────
// ─── Report Types & Formats ──────────────────────────────────────────────────
type ReportType = 'spot' | 'survey' | 'bill-check' | 'fee-bill' | 'photo-sheet';

const REPORT_TYPES = [
  { id: 'spot',       label: 'Spot Report',         icon: <FileText size={16} />,     color: '#B91C1C' },
  { id: 'survey',     label: 'Final Survey Report', icon: <FileText size={16} />,     color: '#0D1B2A' },
  { id: 'bill-check', label: 'Bill Check Report',   icon: <CheckCircle2 size={16} />, color: '#059669' },
  { id: 'fee-bill',   label: 'Fee Bill / Invoice',  icon: <Receipt size={16} />,     color: '#D4AF37' },
  { id: 'photo-sheet', label: 'Photo Sheet',        icon: <DownloadCloud size={16} />, color: '#2563EB' },
];

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

// ─── Main Component ───────────────────────────────────────────────────────────
export function ReportTab() {
  const { currentClaim, isDirty } = useClaimStore();
  const { profile } = useProfileStore();
  const [mounted, setMounted] = useState(false);
  
  const [activeReport, setActiveReport] = useState<ReportType>('survey');
  const [format, setFormat] = useState<'standard' | 'uiic'>('standard');
  const [isExportingWord, setIsExportingWord] = useState(false);
  const { updateClaim } = useClaimStore();
  
  const contentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `UIIC-Survey-Report-${currentClaim?.vehicle?.registrationNumber || 'Draft'}`,
  });

  useEffect(() => { setMounted(true); }, []);

  if (!currentClaim || !mounted) return <PDFLoadingFallback />;

  const ageMonths = getVehicleAgeMonths(
    currentClaim?.vehicle?.dateOfRegistration || null,
    currentClaim?.vehicle?.yearOfManufacture ? Number(currentClaim.vehicle.yearOfManufacture) : null,
    currentClaim?.accident?.dateAndTime || null,
  );
  const fb = currentClaim?.feeBill || {};
  const summary = calculateAssessmentSummary(
    currentClaim?.assessmentRows || [],
    ageMonths,
    currentClaim?.depreciationType || 'Standard',
    fb?.salvageValue || 0,
    fb?.lessExcess || 0,
  );

  // Safety fallback for summary values
  const safeSummary = {
    ...summary,
    netInWords: summary?.netInWords || 'ZERO',
    totalEstimated: summary?.totalEstimated || 0,
    netAssessedLoss: summary?.netAssessedLoss || 0,
    partsTotal: summary?.partsTotal || 0,
    labourBase: summary?.labourBase || 0,
    partsBase: summary?.partsBase || 0,
    grandTotal: summary?.grandTotal || 0,
    partsCGST: summary?.partsCGST || 0,
    partsSGST: summary?.partsSGST || 0,
  };

  const regNo = currentClaim.vehicle.registrationNumber || 'DRAFT';
  const pdfFilename = activeReport === 'spot'
    ? `${regNo}-Spot-Report.pdf`
    : activeReport === 'survey' 
      ? (format === 'uiic' ? `${regNo}-UIIC-Report.pdf` : `${regNo}-Report.pdf`)
      : activeReport === 'bill-check' ? `${regNo}-Bill-Check.pdf` 
      : activeReport === 'photo-sheet' ? `${regNo}-Photos.pdf`
      : `${regNo}-Fee-Bill.pdf`;

  // Determine active document
  let ActiveDocument = <SurveyReportDocument claim={currentClaim} summary={safeSummary} />;
  
  if (activeReport === 'spot') {
    ActiveDocument = <SpotReportDocument claim={currentClaim} />;
  } else if (activeReport === 'survey' && format === 'uiic') {
    ActiveDocument = <UIICReportDocument claim={currentClaim} summary={safeSummary} profile={profile} />;
  } else if (activeReport === 'bill-check') {
    ActiveDocument = <BillCheckDocument claim={currentClaim} />;
  } else if (activeReport === 'fee-bill') {
    ActiveDocument = <FeeBillDocument claim={currentClaim} summary={safeSummary} />;
  } else if (activeReport === 'photo-sheet') {
    ActiveDocument = <PhotoSheetDocument claim={currentClaim} />;
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300 h-full flex flex-col">
      
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: '#0D1B2A', letterSpacing: '-0.02em' }}>
            Report Center
          </h2>
          <p className="text-sm mt-1" style={{ color: '#8D99AE' }}>
            Select report type and format to generate professional outputs.
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F0F2F5' }}>
          {REPORT_TYPES.map(rt => (
            <button
              key={rt.id}
              onClick={() => setActiveReport(rt.id as ReportType)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: activeReport === rt.id ? '#FFFFFF' : 'transparent',
                color: activeReport === rt.id ? rt.color : '#8D99AE',
                boxShadow: activeReport === rt.id ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {rt.icon}
              {rt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Format Selector (Only for Survey) ────────────────── */}
      {activeReport === 'survey' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id as any)}
              className="relative flex items-start gap-4 p-4 rounded-2xl text-left transition-all"
              style={{
                background: format === f.id ? f.color : '#FFFFFF',
                border: format === f.id
                  ? `2px solid ${f.accent}`
                  : '2px solid #E2E6EA',
                boxShadow: format === f.id ? `0 4px 16px rgba(0,0,0,0.12)` : 'none',
              }}
            >
              {/* Check badge */}
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
                  background: format === f.id ? `rgba(255,255,255,0.12)` : `rgba(13,27,42,0.06)`,
                  color: format === f.id ? f.accent : f.color,
                }}
              >
                {f.icon}
              </div>
              <div>
                <div
                  className="text-sm font-black mb-0.5"
                  style={{ color: format === f.id ? '#FFFFFF' : '#0D1B2A' }}
                >
                  {f.label}
                </div>
                <div
                  className="text-[10px] font-bold mb-1"
                  style={{ color: format === f.id ? f.accent : '#8D99AE' }}
                >
                  {f.subtitle}
                </div>
                <div
                  className="text-xs leading-relaxed"
                  style={{ color: format === f.id ? 'rgba(255,255,255,0.65)' : '#6B7280' }}
                >
                  {f.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Photo Layout Selector (Only for Photo Sheet) ───── */}
      {activeReport === 'photo-sheet' && (
        <div className="mb-6 flex flex-col gap-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#8D99AE]">
            Selection: Photos per page
          </div>
          <div className="flex gap-2">
            {[4, 6, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => updateClaim({ photoLayout: num as any })}
                className="flex-1 py-3 px-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1"
                style={{
                  background: currentClaim.photoLayout === num ? '#2563EB' : '#FFFFFF',
                  borderColor: currentClaim.photoLayout === num ? '#2563EB' : '#E2E6EA',
                  color: currentClaim.photoLayout === num ? '#FFFFFF' : '#0D1B2A',
                }}
              >
                <span className="text-sm font-black">{num} Photos</span>
                <span className="text-[9px] opacity-60 font-bold">
                  {num === 4 ? '2 x 2' : num === 6 ? '2 x 3' : num === 8 ? '2 x 4' : '3 x 3'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Action Buttons ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Word only for standard */}
        {format === 'standard' && (
          <button
            onClick={async () => {
              setIsExportingWord(true);
              try {
                await generateWordReport(currentClaim, summary);
                toast.success('Word report generated!');
              } catch {
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

        {/* PDF Download - HIDDEN for UIIC as per new standard */}
        {format !== 'uiic' && (
          <PDFDownloadLink
            document={ActiveDocument}
            fileName={pdfFilename}
          >
            {/* @ts-ignore */}
            {({ loading }) => (
              <button
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all shadow-md"
                style={{
                  background: loading
                    ? '#F0F2F5'
                    : 'linear-gradient(135deg, #D4AF37, #f0d870)',
                  color: loading ? '#8D99AE' : '#FFFFFF',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <DownloadCloud size={15} />}
                {loading
                  ? 'Preparing PDF…'
                  : activeReport === 'survey'
                    ? 'Download Standard PDF'
                    : activeReport === 'bill-check' ? 'Download Bill Check' : 'Download Fee Bill'}
              </button>
            )}
          </PDFDownloadLink>
        )}

        {/* UIIC Exclusive Excel Bridge */}
        {activeReport === 'survey' && format === 'uiic' && (
          <button
            onClick={async () => {
              const builder = new UIICExcelBuilder(currentClaim!, safeSummary, profile!);
              await builder.build();
            }}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-black text-sm transition-all shadow-xl hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #022c22, #064e3b)',
              color: '#FFFFFF',
              cursor: 'pointer',
              border: 'none'
            }}
          >
            <div className="w-3 h-3 rounded-sm bg-emerald-400 animate-pulse" />
            DOWNLOAD PROFESSIONAL EXCEL REPORT
          </button>
        )}

        {/* Power Print (Shared for Spot and Standard Survey) */}
        {((activeReport === 'survey' && format !== 'uiic') || activeReport === 'spot') && (
          <button
            onClick={() => handlePrint()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all shadow-md border-2 border-green-700 text-green-700 hover:bg-green-50"
            style={{
              background: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
            {activeReport === 'spot' ? 'POWER PRINT (SPOT)' : 'POWER PRINT (HIGH-RES)'}
          </button>
        )}

        {isDirty && (
          <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'rgba(251,191,36,0.1)', color: '#D97706', border: '1px solid rgba(217,119,6,0.2)' }}>
            <AlertCircle size={12} /> Unsaved changes — PDF updates live
          </div>
        )}
      </div>

      {/* Hidden print component */}
      <div style={{ display: 'none' }}>
        {activeReport === 'spot' ? (
          <SpotPrintReport ref={contentRef} claim={currentClaim} profile={profile!} />
        ) : (
          <UIICPrintReport ref={contentRef} claim={currentClaim} summary={safeSummary} profile={profile!} />
        )}
      </div>

      {/* ── PDF Viewer ───────────────────────────────────────── */}
      <Card
        className="flex-1 overflow-hidden shadow-lg"
        style={{ border: '1px solid #E2E6EA' }}
      >
        <CardContent className="p-0 w-full h-[calc(100vh-340px)] min-h-[520px]" style={{ background: '#525659' }}>
          {/* @ts-ignore */}
          <PDFViewer width="100%" height="100%" showToolbar={true}>
            {ActiveDocument}
          </PDFViewer>
        </CardContent>
      </Card>
    </div>
  );
}
