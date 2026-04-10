'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { calculateAssessmentSummary } from '@/lib/calculations';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { Card, CardContent } from '@/components/ui/card';
import { DownloadCloud, Loader2, AlertCircle, FileText, Building2, CheckCircle2, Receipt } from 'lucide-react';
import { generateWordReport, generateSpotWordReport } from '@/lib/reports/word-builder';
import { toast } from 'sonner';

// ─── PDF Document Imports ───────────────────────────────────────────────────
import { SurveyReportDocument } from '@/components/pdf/SurveyReportDocument';
import { SpotReportDocument } from '@/components/pdf/SpotReportDocument';
import { UIICReportDocument } from '@/components/pdf/UIICReportDocument';
import { BillCheckDocument } from '@/components/pdf/BillCheckDocument';
import { FeeBillDocument } from '@/components/pdf/FeeBillDocument';

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
import { SpotPrintReport } from '@/components/print/SpotPrintReport';

import { UIICPrintReport } from '@/components/print/UIICPrintReport';
import { triggerStandardPrint, buildStandardFinalSurveyHTML } from '@/lib/reports/standard-report-builder';
import { triggerSpotFeeBillPrint } from '@/lib/reports/spot-fee-bill-builder';
import { triggerUIICFinalPrint, buildUIICFinalHTML } from '@/lib/reports/uiic-final-builder';
import { useRef } from 'react';

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
type ReportType = 'spot' | 'survey';

const REPORT_TYPES = [
  { id: 'spot',   label: 'Spot Report',         icon: <FileText size={16} />,   color: '#B91C1C' },
  { id: 'survey', label: 'Final Survey Report', icon: <FileText size={16} />,   color: '#0D1B2A' },
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
  const [zoom, setZoom] = useState<number>(0.9); // Default to 90% for better fit
  const { updateClaim } = useClaimStore();
  
  const contentRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Spot-Survey-Report-${currentClaim?.vehicle?.registrationNumber || 'Draft'}`,
  });

  // Ensure valid state based on survey type
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (currentClaim) {
      if (currentClaim.surveyType === 'spot' && !['spot'].includes(activeReport)) {
        setActiveReport('spot');
      } else if (currentClaim.surveyType === 'final' && !['survey'].includes(activeReport)) {
        setActiveReport('survey');
      }
    }
  }, [currentClaim?.surveyType, activeReport]);

  if (!currentClaim || !mounted) return <PDFLoadingFallback />;

  const availableReports = REPORT_TYPES.filter(rt => {
    if (currentClaim.surveyType === 'spot') {
      return ['spot'].includes(rt.id);
    } else {
      return ['survey'].includes(rt.id);
    }
  });

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
      : `${regNo}-Bill-Check.pdf`;

  // Determine active document
  let ActiveDocument = <SurveyReportDocument claim={currentClaim} />;
  
  if (activeReport === 'spot') {
    ActiveDocument = <SpotReportDocument claim={currentClaim} />;
  } else if (activeReport === 'survey' && format === 'uiic') {
    ActiveDocument = <UIICReportDocument claim={currentClaim} summary={safeSummary} profile={profile} />;
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
          {availableReports.map(rt => (
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



      {/* ── Action Buttons ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        
        {/* Zoom Controls */}
        {activeReport === 'survey' && (
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
        )}

        {/* Word Export for Standard Survey and Spot */}
        {(activeReport === 'spot' || (activeReport === 'survey' && format === 'standard')) && (
          <button
            onClick={async () => {
              setIsExportingWord(true);
              try {
                if (activeReport === 'spot') {
                  await generateSpotWordReport(currentClaim, profile!);
                } else {
                  await generateWordReport(currentClaim, summary);
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


        {/* Power Print (Spot) */}
        {activeReport === 'spot' && (
          <button
            onClick={() => handlePrint()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all shadow-md border-2 border-green-700 text-green-700 hover:bg-green-50"
            style={{
              background: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
            POWER PRINT (SPOT)
          </button>
        )}

        {/* Standard Format — Power Print (HTML → Browser PDF, mirrors UIIC format.html exactly) */}
        {activeReport === 'survey' && format === 'standard' && (
          <button
            onClick={() => {
              triggerStandardPrint(currentClaim!, safeSummary, profile!);
            }}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-black text-sm transition-all shadow-xl hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #0D1B2A, #1a3a5c)',
              color: '#FFFFFF',
              cursor: 'pointer',
              border: 'none'
            }}
          >
            <div className="w-3 h-3 rounded-sm bg-amber-400 animate-pulse" />
            POWER PRINT — FINAL SURVEY REPORT
          </button>
        )}

        {/* UIIC Format — Power Print (HTML → Browser PDF, mirrors UIIC main correct format.html exactly) */}
        {activeReport === 'survey' && format === 'uiic' && (
          <button
            onClick={() => {
              triggerUIICFinalPrint(currentClaim!, profile!);
            }}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-black text-sm transition-all shadow-xl hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #006838, #009a52)',
              color: '#FFFFFF',
              cursor: 'pointer',
              border: 'none'
            }}
          >
            <div className="w-3 h-3 rounded-sm bg-amber-400 animate-pulse" />
            POWER PRINT — UIIC FINAL SURVEY REPORT
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
        {activeReport === 'survey' && (
          <UIICPrintReport ref={contentRef} claim={currentClaim} summary={safeSummary} profile={profile!} />
        )}
        {activeReport === 'spot' && (
          <SpotPrintReport ref={contentRef} claim={currentClaim} profile={profile!} />
        )}
      </div>

      {/* ── PDF Viewer / Live HTML Preview ───────────────────────────────────────── */}
      <Card
        className="flex-1 overflow-hidden shadow-lg"
        style={{ border: '1px solid #E2E6EA' }}
      >
        <CardContent className="p-0 w-full h-[calc(100vh-340px)] min-h-[520px]" style={{ background: '#525659' }}>
          {(activeReport === 'survey' || activeReport === 'spot') ? (
            <div className="w-full h-full overflow-auto flex justify-center py-8">
              <div 
                className="bg-white shadow-2xl relative"
                style={{ 
                  width: '210mm', 
                  minHeight: '297mm', 
                  padding: '10mm 12mm', 
                  fontFamily: "'Barlow', 'Helvetica', Arial, sans-serif",
                  fontSize: '7.8pt',
                  color: '#000',
                  boxSizing: 'border-box',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  marginBottom: `calc(297mm * ${zoom - 1})`
                }}
              >
                {/* Draft Watermark */}
                {(!currentClaim?.isCompleted) && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-50">
                    <div
                      style={{
                        transform: 'rotate(-45deg)',
                        fontSize: '140px',
                        color: 'rgba(220, 38, 38, 0.06)', // Very faint red
                        fontWeight: 900,
                        letterSpacing: '0.1em',
                        whiteSpace: 'nowrap',
                        userSelect: 'none'
                      }}
                    >
                      DRAFT
                    </div>
                  </div>
                )}
                
                {activeReport === 'survey' && format === 'standard' && (
                  <div dangerouslySetInnerHTML={{ __html: buildStandardFinalSurveyHTML(currentClaim, safeSummary, profile!) }} />
                )}
                {activeReport === 'survey' && format === 'uiic' && (
                  <div dangerouslySetInnerHTML={{ __html: buildUIICFinalHTML(currentClaim, profile!) }} />
                )}
                {activeReport === 'spot' && (
                  <SpotPrintReport claim={currentClaim} profile={profile!} />
                )}
              </div>
            </div>
          ) : (
            /* @ts-ignore */
            <PDFViewer width="100%" height="100%" showToolbar={true}>
              {ActiveDocument}
            </PDFViewer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
