'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { calculateAssessmentSummary } from '@/lib/calculations';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, FileText, Loader2, Shield } from 'lucide-react';
import { InsuredReportReviewDialog } from '@/components/dialogs/InsuredReportReviewDialog';
import type { InsuredReportDraft, InsuredReportStage } from '@/types/insured-report';
import { SpotActions } from './report/SpotActions';
import { SurveyActions } from './report/SurveyActions';

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
import { buildStandardFinalSurveyHTML } from '@/lib/reports/standard-report-builder';
import { buildUIICFinalHTML } from '@/lib/reports/uiic-final-builder';
import { buildValuationReportHTML } from '@/lib/reports/valuation-report-builder';
import DOMPurify from 'dompurify';
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

// ─── Report Types ─────────────────────────────────────────────────────────────
type ReportType = 'spot' | 'survey' | 'valuation';

const REPORT_TYPES = [
  { id: 'spot',      label: 'Spot Report',              icon: <FileText size={16} />, color: '#B91C1C' },
  { id: 'survey',    label: 'Final Survey Report',      icon: <FileText size={16} />, color: '#0D1B2A' },
  { id: 'valuation', label: 'Valuation / Break-in',     icon: <FileText size={16} />, color: '#92400E' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export function ReportTab() {
  const { currentClaim, isDirty } = useClaimStore();
  const { profile } = useProfileStore();
  const [mounted, setMounted] = useState(false);
  
  const [activeReport, setActiveReport] = useState<ReportType>(
    currentClaim?.surveyType === 'spot' ? 'spot' :
    currentClaim?.surveyType === 'valuation' ? 'valuation' : 'survey'
  );
  const [format, setFormat] = useState<'standard' | 'uiic'>('standard');
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [zoom, setZoom] = useState<number>(0.9); // Default to 90% for better fit
  const [insuredDialogStage, setInsuredDialogStage] = useState<InsuredReportStage | null>(null);
  const { updateClaim } = useClaimStore();
  
  const contentRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Spot-Survey-Report-${currentClaim?.vehicle?.registrationNumber || 'Draft'}`,
  });

  function handleInsuredApproved(stage: InsuredReportStage, draft: InsuredReportDraft) {
    if (stage === 'preliminary') {
      updateClaim({ insuredReportPreliminary: draft });
    } else {
      updateClaim({ insuredReportFinal: draft });
    }
    setInsuredDialogStage(null);
  }

  // Ensure valid state based on survey type
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (currentClaim) {
      if (currentClaim.surveyType === 'spot' && activeReport !== 'spot') {
        setActiveReport('spot');
      } else if (currentClaim.surveyType === 'final' && activeReport !== 'survey') {
        setActiveReport('survey');
      } else if (currentClaim.surveyType === 'valuation' && activeReport !== 'valuation') {
        setActiveReport('valuation');
      }
    }
  }, [currentClaim?.surveyType, activeReport]);

  if (!currentClaim || !mounted) return <PDFLoadingFallback />;

  const availableReports = REPORT_TYPES.filter(rt => {
    if (currentClaim.surveyType === 'spot') return rt.id === 'spot';
    if (currentClaim.surveyType === 'valuation') return rt.id === 'valuation';
    return rt.id === 'survey';
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

      {/* ── Actions (report-type specific) ───────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {activeReport === 'spot' && (
          <SpotActions
            claim={currentClaim}
            profile={profile!}
            isExportingWord={isExportingWord}
            setIsExportingWord={setIsExportingWord}
            onPrint={handlePrint}
          />
        )}
        {activeReport === 'survey' && (
          <SurveyActions
            claim={currentClaim}
            summary={safeSummary}
            profile={profile!}
            format={format}
            setFormat={setFormat}
            isExportingWord={isExportingWord}
            setIsExportingWord={setIsExportingWord}
            zoom={zoom}
            setZoom={setZoom}
          />
        )}
        {activeReport === 'valuation' && (
          <button
            onClick={() => {
              const html = buildValuationReportHTML(currentClaim, profile!);
              const win = window.open('', '_blank');
              if (win) { win.document.write(html); win.document.close(); win.print(); }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
            style={{ background: '#92400E', color: '#fff' }}
          >
            <FileText size={14} /> Print / Download PDF
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
          {(activeReport === 'survey' || activeReport === 'spot' || activeReport === 'valuation') ? (
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
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(buildStandardFinalSurveyHTML(currentClaim, safeSummary, profile!)) }} />
                )}
                {activeReport === 'survey' && format === 'uiic' && (
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(buildUIICFinalHTML(currentClaim, profile!)) }} />
                )}
                {activeReport === 'spot' && (
                  <SpotPrintReport claim={currentClaim} profile={profile!} />
                )}
                {activeReport === 'valuation' && (
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(buildValuationReportHTML(currentClaim, profile!)) }} />
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

      {/* Insured Reports (Premium) */}
      {profile?.insuredReportSettings?.enabled && (
        <div className="mt-8 p-5 rounded-2xl border" style={{ borderColor: '#E2E6EA', background: '#F9FAFB' }}>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} style={{ color: '#D4AF37' }} />
            <h3 className="text-sm font-black tracking-tight" style={{ color: '#0D1B2A' }}>Insured Reports</h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#FEF3C7', color: '#92400E' }}>PREMIUM</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {profile.insuredReportSettings.enabledStages.includes('preliminary') && currentClaim.surveyType === 'final' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInsuredDialogStage('preliminary')}
                  className="text-xs font-bold px-4 py-2 rounded-xl border flex items-center gap-2"
                  style={{ borderColor: '#D4AF37', color: '#0D1B2A' }}
                >
                  <FileText size={14} />
                  {currentClaim.insuredReportPreliminary?.isSurveyorApproved ? 'Download / Edit Preliminary' : 'Generate Insured Report (Preliminary)'}
                </button>
                {currentClaim.insuredReportPreliminary?.isSurveyorApproved && (
                  <span className="text-xs" style={{ color: '#065F46' }}>✓ Approved</span>
                )}
              </div>
            )}
            {profile.insuredReportSettings.enabledStages.includes('final') && currentClaim.billCheck.billTotal > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInsuredDialogStage('final')}
                  className="text-xs font-bold px-4 py-2 rounded-xl border flex items-center gap-2"
                  style={{ borderColor: '#D4AF37', color: '#0D1B2A' }}
                >
                  <FileText size={14} />
                  {currentClaim.insuredReportFinal?.isSurveyorApproved ? 'Download / Edit Final' : 'Generate Insured Report (Final)'}
                </button>
                {currentClaim.insuredReportFinal?.isSurveyorApproved && (
                  <span className="text-xs" style={{ color: '#065F46' }}>✓ Approved</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {insuredDialogStage && (
        <InsuredReportReviewDialog
          claim={currentClaim}
          stage={insuredDialogStage}
          allowedLanguages={profile?.insuredReportSettings?.allowedLanguages ?? ['english']}
          defaultLanguage={profile?.insuredReportSettings?.defaultLanguage ?? 'english'}
          surveyorName={profile?.name ?? ''}
          surveyorLicence={profile?.licenceNumber ?? ''}
          surveyorMobile={profile?.mobile ?? ''}
          existingDraft={
            insuredDialogStage === 'preliminary'
              ? currentClaim.insuredReportPreliminary
              : currentClaim.insuredReportFinal
          }
          onApproved={draft => handleInsuredApproved(insuredDialogStage, draft)}
          onClose={() => setInsuredDialogStage(null)}
        />
      )}
    </div>
  );
}
