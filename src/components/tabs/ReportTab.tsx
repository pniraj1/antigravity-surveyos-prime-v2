'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { isNarrowViewport } from '@/lib/navigation/viewport';

import { markOnboarding } from '@/lib/onboarding/rules';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { calculateAssessmentSummary, getCompulsoryExcess } from '@/lib/calculations';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, FileText, Loader2, Shield } from 'lucide-react';
import { InsuredReportReviewDialog } from '@/components/dialogs/InsuredReportReviewDialog';
import type { InsuredReportDraft, InsuredReportStage } from '@/types/insured-report';
import { SpotActions } from './report/SpotActions';
import { SurveyActions } from './report/SurveyActions';
import { BillCheckActions } from './report/BillCheckActions';
import { PolicyCheckStrip } from '@/components/policy/PolicyCheckStrip';
import { ProfileGapBanner } from '@/components/onboarding/ProfileGapBanner';
import { ReportSectionGuide } from '@/components/onboarding/ReportSectionGuide';

// Every report here renders from its HTML builder below. The @react-pdf
// documents this tab used to host were unreachable and have been removed.
import { useReactToPrint } from 'react-to-print';
import { recordPrinted } from '@/lib/claims/printed';
import { SpotPrintReport } from '@/components/print/SpotPrintReport';
import { buildStandardFinalSurveyHTML } from '@/lib/reports/standard-report-builder';
import { buildUIICFinalHTML, buildUIICBillCheckHTML } from '@/lib/reports/uiic-final-builder';
import { buildValuationReportHTML, buildValuationPrintDocument, triggerValuationPrint } from '@/lib/reports/valuation-report-builder';
import { downloadAsWord } from '@/lib/reports/word-export';
import { footerFromProfile } from '@/lib/reports/print-shell';
import { preambleFromClaim, cashLossPreambleSentence } from '@/lib/reports/final-survey-preamble';
import { cashLossBasis } from '@/lib/calculations/cash-loss';
import { ReportPageSheet, splitReportHtml, estimatePageCount } from './report/ReportPageSheet';
import DOMPurify from 'dompurify';
import { isClaimCompleted } from '@/lib/claims/progress';

function sanitizeReport(html: string): string {
  if (!html || typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORCE_BODY: false,
    ADD_TAGS: ['style', 'link'],
    ADD_ATTR: ['style', 'media', 'type'],
  });
}

// Tab padding (p-3 each side on phones) + card border + a little slack.
const PHONE_GUTTER_PX = 40;

function PDFLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[500px] rounded-2xl bg-neutral-50">
      <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" style={{ opacity: 0.7 }} />
      <p className="text-sm font-medium uppercase tracking-widest animate-pulse text-muted-foreground">
        Compiling PDF Engine…
      </p>
    </div>
  );
}

// ─── Report Types ─────────────────────────────────────────────────────────────
type ReportType = 'spot' | 'survey' | 'bill-check' | 'valuation';

const REPORT_TYPES = [
  { id: 'spot',       label: 'Spot Report',              icon: <FileText size={16} />, color: '#B91C1C' },
  { id: 'survey',     label: 'Final Survey Report',      icon: <FileText size={16} />, color: '#0D1B2A' },
  { id: 'bill-check', label: 'Bill Check Report',        icon: <FileText size={16} />, color: '#006838' },
  { id: 'valuation',  label: 'Valuation / Break-in',     icon: <FileText size={16} />, color: '#92400E' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export function ReportTab() {
  useEffect(() => {
    markOnboarding({ reportSeenAt: new Date().toISOString() });
  }, []);

  const { currentClaim, isDirty, updateClaim } = useClaimStore();
  const { profile } = useProfileStore();
  const [mounted, setMounted] = useState(() => typeof window !== 'undefined' || process.env.NODE_ENV === 'test');

  const [activeReport, setActiveReport] = useState<ReportType>(
    currentClaim?.surveyType === 'spot' ? 'spot' :
    currentClaim?.surveyType === 'valuation' ? 'valuation' : 'survey'
  );
  const [format, setFormat] = useState<'standard' | 'uiic'>('standard');
  const [isExportingWord, setIsExportingWord] = useState(false);
  // A4 is 210 mm ≈ 794 px; on a phone start at the zoom that fits the screen width
  // (the 0.4 floor matches the zoom-out button's minimum).
  const [zoom, setZoom] = useState<number>(() =>
    isNarrowViewport() ? Math.max(0.4, Math.floor(((window.innerWidth - PHONE_GUTTER_PX) / 794) * 100) / 100) : 0.9,
  );
  const [insuredDialogStage, setInsuredDialogStage] = useState<InsuredReportStage | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Spot-Survey-Report-${currentClaim?.vehicle?.registrationNumber || 'Draft'}`,
    onAfterPrint: () => {
      const open = useClaimStore.getState().currentClaim;
      if (open) recordPrinted(open.id, 'spotReport');
    },
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
      const type = currentClaim.surveyType || 'final';
      if (type === 'spot' && activeReport !== 'spot') {
        setActiveReport('spot');
      } else if (type === 'final' && activeReport !== 'survey' && activeReport !== 'bill-check') {
        setActiveReport('survey');
      } else if (type === 'valuation' && activeReport !== 'valuation') {
        setActiveReport('valuation');
      }
    }
  }, [currentClaim?.surveyType, activeReport]);

  if (!currentClaim || !mounted) return <PDFLoadingFallback />;

  const availableReports = REPORT_TYPES.filter(rt => {
    const type = currentClaim?.surveyType || 'final';
    if (type === 'spot') return rt.id === 'spot';
    if (type === 'valuation') return rt.id === 'valuation';
    return rt.id === 'survey' || rt.id === 'bill-check';
  });

  const ageMonths = getVehicleAgeMonths(
    currentClaim?.vehicle?.dateOfRegistration || null,
    currentClaim?.vehicle?.yearOfManufacture ? Number(currentClaim.vehicle.yearOfManufacture) : null,
    currentClaim?.accident?.dateAndTime || null,
  );
  const cashBasis = currentClaim ? cashLossBasis(currentClaim, ageMonths) : null;
  const fb = currentClaim?.feeBill || {};
  const summary = calculateAssessmentSummary(
    currentClaim?.assessmentRows || [],
    ageMonths,
    currentClaim?.depreciationType || 'Standard',
    fb?.salvageValue || 0,
    getCompulsoryExcess(fb),
    fb?.voluntaryExcess || 0,
    currentClaim,
    fb?.towingCharges || 0,
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

  const defaultPreamble = preambleFromClaim(
    currentClaim,
    safeSummary.totalEstimated,
    safeSummary.netAssessedLoss,
  ) + (cashBasis && cashBasis.percent !== null ? cashLossPreambleSentence(cashBasis.percent) : '');
  const preambleValue = (currentClaim.reportPreamble && currentClaim.reportPreamble.trim())
    ? currentClaim.reportPreamble
    : defaultPreamble;

  const reportHtml = useMemo(() => {
    try {
      if (activeReport === 'survey') {
        return format === 'uiic'
          ? buildUIICFinalHTML(currentClaim, profile!)
          : buildStandardFinalSurveyHTML(currentClaim, profile!);
      }
      if (activeReport === 'bill-check') {
        return format === 'uiic'
          ? buildUIICBillCheckHTML(currentClaim, profile!)
          : buildStandardFinalSurveyHTML(currentClaim, profile!, 'bill-check');
      }
      if (activeReport === 'valuation') {
        return buildValuationReportHTML(currentClaim, profile!);
      }
      return '';
    } catch (err) {
      console.error('[ReportTab] Failed to generate report HTML:', err);
      return '<div style="padding: 24px; color: #dc2626; font-family: sans-serif;">Failed to generate report preview. Please verify claim and assessment data.</div>';
    }
  }, [activeReport, format, currentClaim, profile]);

  // Split HTML into multi-page sections by explicit page-breaks
  const sections = useMemo(() => {
    if (activeReport === 'spot') return [''];
    return splitReportHtml(reportHtml);
  }, [activeReport, reportHtml]);

  const initialEstimatedCounts = useMemo(() => {
    if (activeReport === 'spot') return [2];
    return sections.map(s => estimatePageCount(s));
  }, [activeReport, sections]);

  const [sheetPageCounts, setSheetPageCounts] = useState<number[]>(initialEstimatedCounts);

  useEffect(() => {
    setSheetPageCounts(initialEstimatedCounts);
  }, [initialEstimatedCounts]);

  const handlePageCountChange = useCallback((sheetIndex: number, count: number) => {
    setSheetPageCounts(prev => {
      if (prev[sheetIndex] === count) return prev;
      const next = [...prev];
      next[sheetIndex] = count;
      return next;
    });
  }, []);

  const effectivePageCounts = sheetPageCounts.length === sections.length
    ? sheetPageCounts
    : initialEstimatedCounts;

  const totalPages = useMemo(() => {
    return effectivePageCounts.reduce((sum, c) => sum + Math.max(1, c), 0);
  }, [effectivePageCounts]);

  const startPages = useMemo(() => {
    const starts: number[] = [];
    let current = 1;
    for (const count of effectivePageCounts) {
      starts.push(current);
      current += Math.max(1, count);
    }
    return starts;
  }, [effectivePageCounts]);

  const totalHeightMm = totalPages * 297 + (sections.length - 1) * 32;

  return (
    <div className="p-3 md:p-6 lg:p-8 max-w-7xl mx-auto h-full flex flex-col">
      {currentClaim.surveyType === 'final' && <PolicyCheckStrip />}

      <ProfileGapBanner />

      {activeReport !== 'bill-check' && <ReportSectionGuide reportType={activeReport} />}

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-medium tracking-tight text-foreground" style={{ letterSpacing: '-0.02em' }}>
              Report Center
            </h2>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 shadow-sm"
              data-testid="total-pages-badge"
              title="Total physical A4 pages"
            >
              📄 {totalPages} A4 Pages
            </span>
            {currentClaim.surveyType === 'final' && (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground border-l border-border pl-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Jump to:</span>
                <button
                  type="button"
                  onClick={() => useUIStore.getState().setActiveTab('assessment')}
                  className="px-2 py-0.5 rounded-md hover:bg-neutral-100 hover:text-foreground transition-colors cursor-pointer"
                  title="Switch to Assessment tab"
                >
                  Assessment ↗
                </button>
                <button
                  type="button"
                  onClick={() => useUIStore.getState().setActiveTab('bill-check')}
                  className="px-2 py-0.5 rounded-md hover:bg-neutral-100 hover:text-foreground transition-colors cursor-pointer"
                  title="Switch to Bill Check tab"
                >
                  Bill Check ↗
                </button>
              </div>
            )}
          </div>
          <p className="text-sm mt-1 text-muted-foreground">
            Select deliverable format to preview, download Word, or print PDF.
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-neutral-50">
          {availableReports.map(rt => (
            <button
              key={rt.id}
              onClick={() => setActiveReport(rt.id as ReportType)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: activeReport === rt.id ? 'var(--color-card, #FFFFFF)' : 'transparent',
                color: activeReport === rt.id ? rt.color : 'var(--color-neutral-400)',
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
            isExportingWord={isExportingWord}
            setIsExportingWord={setIsExportingWord}
            onPrint={handlePrint}
            getPrintHtml={() => contentRef.current?.innerHTML ?? ''}
            footerLeft={footerFromProfile(profile)}
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
        {activeReport === 'bill-check' && (
          <BillCheckActions
            claim={currentClaim}
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
          <>
            <button
              onClick={() => triggerValuationPrint(currentClaim, profile)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all shadow-sm"
              style={{ background: 'var(--color-status-warning)', color: 'var(--color-neutral-50)' }}
            >
              <FileText size={14} /> Print / Download PDF
            </button>
            <button
              onClick={() => downloadAsWord(
                buildValuationReportHTML(currentClaim, profile!),
                `${currentClaim.vehicle.registrationNumber || 'Claim'}-Valuation`,
                footerFromProfile(profile),
              )}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all shadow-sm border border-border text-foreground"
            >
              <FileText size={14} /> Export Word
            </button>
          </>
        )}
        {isDirty && (
          <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-status-warning-tint)', color: 'var(--color-status-warning)', border: '1px solid var(--color-status-warning)' }}>
            <AlertCircle size={12} /> Unsaved changes — PDF updates live
          </div>
        )}
      </div>

      {/* ── Report Preamble Editor ────────────────────────── */}
        {activeReport === 'survey' && (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="report-preamble" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Report Preamble (shown above the assessment sheet)
                </label>
                <button
                  type="button"
                  onClick={() => updateClaim({ reportPreamble: '' })}
                  className="text-[11px] font-medium text-primary hover:underline"
                  title="Discard edits and re-generate from current claim data"
                >
                  Reset to auto-generated
                </button>
              </div>
              <textarea
                id="report-preamble"
                value={preambleValue}
                onChange={(e) => updateClaim({ reportPreamble: e.target.value })}
                rows={6}
                className="w-full text-xs rounded-md border border-input bg-background p-2 leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Narrative shown above the assessment sheet…"
              />
            </CardContent>
          </Card>
        )}

      {/* Hidden print source for POWER PRINT (SPOT) — react-to-print reads this ref.
          Final-survey printing goes through triggerStandardPrint / triggerUIICFinalPrint. */}
      <div style={{ display: 'none' }}>
        {activeReport === 'spot' && (
          <SpotPrintReport ref={contentRef} claim={currentClaim} profile={profile!} />
        )}
      </div>

      {/* ── PDF Viewer / Live HTML Preview ───────────────────────────────────────── */}
      <Card
        className="flex-1 overflow-hidden shadow-lg border-border"
      >
        <div className="bg-neutral-800 text-neutral-200 px-4 py-2 border-b border-neutral-700 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-neutral-400" />
            <span className="font-medium text-neutral-200">A4 Document Preview</span>
            <span className="px-2.5 py-0.5 rounded-full bg-neutral-700 text-neutral-200 font-semibold text-[11px] border border-neutral-600">
              📄 {totalPages} A4 Pages
            </span>
          </div>
          <div className="flex items-center gap-3 text-neutral-400 text-[11px]">
            <span>Scale: {Math.round(zoom * 100)}%</span>
            <span>•</span>
            <span>A4 (210 × 297 mm)</span>
          </div>
        </div>
        <CardContent className="p-0 w-full h-[calc(100dvh-340px)] min-h-[520px]" style={{ background: '#525659' }}>
          <div className="w-full h-full overflow-auto py-8 px-2 md:px-4">
            {/* Block + mx-auto, not flex centring: a centred flex child wider than
                its box overflows to the left, where scrolling can't reach. */}
            <div className="mx-auto" style={{ width: `calc(210mm * ${zoom})`, overflowX: isNarrowViewport() ? 'clip' : undefined }}>
              <div 
                style={{ 
                  width: '210mm',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '32px',
                  alignItems: 'center',
                  marginBottom: `calc(${totalHeightMm}mm * ${zoom - 1})`
                }}
              >
                {activeReport === 'spot' ? (
                  <ReportPageSheet
                    key="spot-preview-sheet"
                    sheetIndex={0}
                    startPage={1}
                    totalPages={totalPages}
                    isDraft={!(currentClaim && isClaimCompleted(currentClaim))}
                    initialPageCount={effectivePageCounts[0] || 2}
                    onPageCountChange={handlePageCountChange}
                  >
                    <SpotPrintReport claim={currentClaim} profile={profile!} />
                  </ReportPageSheet>
                ) : (
                  sections.map((secHtml, idx) => (
                    <ReportPageSheet
                      key={`page-sheet-${idx}`}
                      sheetIndex={idx}
                      startPage={startPages[idx] || 1}
                      totalPages={totalPages}
                      isDraft={!(currentClaim && isClaimCompleted(currentClaim))}
                      htmlContent={secHtml}
                      initialPageCount={effectivePageCounts[idx]}
                      onPageCountChange={handlePageCountChange}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insured Reports (Premium) */}
      {profile?.insuredReportSettings?.enabled && (
        <div className="mt-8 p-5 rounded-2xl border border-border bg-neutral-50">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-primary" />
            <h3 className="text-sm font-medium tracking-tight text-foreground">Insured Reports</h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-status-warning-tint)', color: 'var(--color-status-warning)' }}>PREMIUM</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {profile.insuredReportSettings.enabledStages.includes('preliminary') && currentClaim.surveyType === 'final' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInsuredDialogStage('preliminary')}
                  className="text-xs font-medium px-4 py-2 rounded-xl border flex items-center gap-2"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-neutral-900)' }}
                >
                  <FileText size={14} />
                  {currentClaim.insuredReportPreliminary?.isSurveyorApproved ? 'Download / Edit Preliminary' : 'Generate Insured Report (Preliminary)'}
                </button>
                {currentClaim.insuredReportPreliminary?.isSurveyorApproved && (
                  <span className="text-xs" style={{ color: 'var(--color-status-success)' }}>✓ Approved</span>
                )}
              </div>
            )}
            {profile.insuredReportSettings.enabledStages.includes('final') && (currentClaim.billCheck?.billTotal ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInsuredDialogStage('final')}
                  className="text-xs font-medium px-4 py-2 rounded-xl border flex items-center gap-2"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-neutral-900)' }}
                >
                  <FileText size={14} />
                  {currentClaim.insuredReportFinal?.isSurveyorApproved ? 'Download / Edit Final' : 'Generate Insured Report (Final)'}
                </button>
                {currentClaim.insuredReportFinal?.isSurveyorApproved && (
                  <span className="text-xs" style={{ color: 'var(--color-status-success)' }}>✓ Approved</span>
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
