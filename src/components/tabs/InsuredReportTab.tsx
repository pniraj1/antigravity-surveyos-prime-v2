'use client';

import { useRef, useState, useEffect } from 'react';
import {
  Loader2, AlertTriangle, CheckCircle2, RefreshCw,
  Upload, FileText, X, FileCheck, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useEvidenceStore, getRawFile } from '@/components/evidence/DocumentEvidenceViewer';
import type {
  InsuredReportDraft,
  InsuredReportLanguage,
  InsuredReportStage,
  InsuredReportLineExplanation,
  InsuredReportPolicyClause,
  PolicyAnalysisResult,
  AssessmentAnalysisResult,
  SurveyorAnswers,
  SurveyorAnswer,
} from '@/types/insured-report';
import {
  getBlockingRows,
  runPolicyAnalysis,
  runAssessmentAnalysis,
  runGenerateNarrative,
} from '@/lib/ai/insured-report';
import { InsuredSummaryDocument } from '@/components/pdf/InsuredSummaryDocument';
import { fileToImages } from '@/lib/ai/processor';
import { logger } from '@/lib/utils/logger';
import { CATEGORY_BADGE_LABELS, CATEGORY_BADGE_COLOURS } from '@/lib/constants/deduction-categories';
import { GapReviewStep } from '@/components/insured-report/GapReviewStep';
import { DepreciationBreakdownTable } from '@/components/insured-report/DepreciationBreakdownTable';

// ─── helpers ──────────────────────────────────────────────

async function convertPolicyFile(
  file: File,
  onProgress: (msg: string) => void,
): Promise<string[]> {
  onProgress('Converting policy document…');
  const { apiImages } = await fileToImages(file, (p, t) => {
    onProgress(`Processing policy page ${p} of ${t}…`);
  });
  return apiImages;
}

type ReviewTab = 'financial' | 'policy' | 'lineitems' | 'narrative';
const ALLOWED_LANGUAGES: InsuredReportLanguage[] = ['english', 'hindi', 'marathi'];

// ─── component ────────────────────────────────────────────

export function InsuredReportTab() {
  const { currentClaim, updateClaim } = useClaimStore();
  const { profile } = useProfileStore();

  const [stage, setStage] = useState<InsuredReportStage>('final');
  const [language, setLanguage] = useState<InsuredReportLanguage>('english');
  const [draft, setDraft] = useState<InsuredReportDraft | null>(null);
  const [activeTab, setActiveTab] = useState<ReviewTab>('financial');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [narrativeText, setNarrativeText] = useState('');
  const [narrativeError, setNarrativeError] = useState<string | null>(null);

  const [policyImages, setPolicyImages] = useState<string[] | null>(null);
  const [policyFileName, setPolicyFileName] = useState('');
  const [policyConverting, setPolicyConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Stage pipeline state (persisted across tab closes) ───────────────────────
  const [policyAnalysis, setPolicyAnalysis] = useState<PolicyAnalysisResult | undefined>(
    currentClaim?.insuredReportStages?.policyAnalysis,
  );
  const [assessmentAnalysis, setAssessmentAnalysis] = useState<AssessmentAnalysisResult | undefined>(
    currentClaim?.insuredReportStages?.assessmentAnalysis,
  );
  const [surveyorAnswers, setSurveyorAnswers] = useState<SurveyorAnswers | undefined>(
    currentClaim?.insuredReportStages?.surveyorAnswers,
  );

  // ── Auto-detect policy from Documents tab (MUST be before early return) ──────
  // Watch EvidenceStore's rawFiles. When the policy file is uploaded in DocumentsTab,
  // auto-convert it here so the surveyor doesn't need to re-upload.
  const rawFiles = useEvidenceStore(s => s.rawFiles);

  useEffect(() => {
    if (!currentClaim) return;
    if (policyImages !== null) return; // already loaded / user uploaded their own
    const file = getRawFile(currentClaim.id, 'policy');
    if (!file) return;
    setPolicyConverting(true);
    setPolicyFileName('(linked from Documents tab)');
    convertPolicyFile(file, setLoadingMsg)
      .then(imgs => {
        setPolicyImages(imgs);
        toast.success(`Policy linked from Documents tab: ${imgs.length} page${imgs.length !== 1 ? 's' : ''}`);
      })
      .catch(err => {
        logger.warn('[InsuredReportTab] Auto-convert failed:', err);
        setPolicyImages([]);
        setPolicyFileName('');
      })
      .finally(() => {
        setPolicyConverting(false);
        setLoadingMsg('');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClaim?.id, rawFiles]);

  // ── Early return — no claim open ────────────────────
  if (!currentClaim) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
        <FileCheck size={40} className="mb-4 text-muted-foreground" />
        <div className="text-base font-medium text-foreground">No Claim Open</div>
        <div className="text-sm mt-1 text-muted-foreground">
          Open or create a claim to generate an Insured Report.
        </div>
      </div>
    );
  }

  // After the guard, currentClaim is non-null — alias for brevity
  const claim = currentClaim;

  // Resolve policy images: uploaded this session > Documents tab auto-detect > empty
  function getResolvedPolicyImages(): string[] {
    return policyImages ?? [];
  }

  async function handlePolicyUpload(file: File) {
    setPolicyConverting(true);
    try {
      const images = await convertPolicyFile(file, setLoadingMsg);
      setPolicyImages(images);
      setPolicyFileName(file.name);
      toast.success(`Policy loaded: ${file.name} (${images.length} page${images.length !== 1 ? 's' : ''})`);
    } catch (err: unknown) {
      toast.error(`Failed to process policy: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPolicyConverting(false);
      setLoadingMsg('');
    }
  }

  function handleClearPolicy() {
    setPolicyImages([]);
    setPolicyFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Stage 1: Policy Analysis ─────────────────────────────────────────────────
  async function handleAnalysePolicy() {
    setLoading(true);
    try {
      const result = await runPolicyAnalysis({
        claim,
        language,
        policyImages: getResolvedPolicyImages(),
        onProgress: setLoadingMsg,
      });
      setPolicyAnalysis(result);
      // Reset downstream stages when policy is re-analysed
      setAssessmentAnalysis(undefined);
      setSurveyorAnswers(undefined);
      updateClaim({
        insuredReportStages: {
          ...(claim.insuredReportStages ?? {}),
          policyAnalysis: result,
          assessmentAnalysis: undefined,
          surveyorAnswers: undefined,
        },
      });
    } catch (err: unknown) {
      toast.error(`Policy analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }

  // ── Stage 2: Assessment Analysis ─────────────────────────────────────────────
  async function handleAnalyseAssessment() {
    if (!policyAnalysis) return;
    setLoading(true);
    try {
      const result = await runAssessmentAnalysis({
        claim,
        language,
        policyAnalysis,
        onProgress: setLoadingMsg,
      });
      setAssessmentAnalysis(result);
      setSurveyorAnswers(undefined);
      updateClaim({
        insuredReportStages: {
          ...(claim.insuredReportStages ?? {}),
          assessmentAnalysis: result,
          surveyorAnswers: undefined,
        },
      });
    } catch (err: unknown) {
      toast.error(`Assessment analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }

  // ── Stage 3: Gap Review complete ─────────────────────────────────────────────
  function handleGapReviewComplete(answers: SurveyorAnswer[]) {
    const result: SurveyorAnswers = {
      completedAt: new Date().toISOString(),
      answers,
    };
    setSurveyorAnswers(result);
    updateClaim({
      insuredReportStages: {
        ...(claim.insuredReportStages ?? {}),
        surveyorAnswers: result,
      },
    });
  }

  // ── Stage 4: Generate Report ─────────────────────────────────────────────────
  async function handleGenerateReport() {
    if (!policyAnalysis || !assessmentAnalysis) return;
    setLoading(true);
    setDraft(null);
    try {
      const generated = await runGenerateNarrative({
        claim,
        stage,
        language,
        policyAnalysis,
        assessmentAnalysis,
        surveyorAnswers: surveyorAnswers ?? undefined,
        onProgress: setLoadingMsg,
      });
      setDraft(generated);
      setNarrativeText(generated.coveringNarrative ?? '');
      setNarrativeError(generated.narrativeError ?? null);
      setActiveTab(generated.narrativeError ? 'narrative' : 'financial');
      if (stage === 'preliminary') {
        updateClaim({ insuredReportPreliminary: generated });
      } else {
        updateClaim({ insuredReportFinal: generated });
      }
    } catch (err: unknown) {
      toast.error(`Failed to generate report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }

  async function handleLanguageChange(lang: InsuredReportLanguage) {
    if (loading) return;
    setLanguage(lang);
    if (draft && policyAnalysis && assessmentAnalysis) {
      setLoading(true);
      setDraft(null);
      try {
        const generated = await runGenerateNarrative({
          claim,
          stage,
          language: lang,
          policyAnalysis,
          assessmentAnalysis,
          surveyorAnswers: surveyorAnswers ?? undefined,
          onProgress: setLoadingMsg,
        });
        setDraft(generated);
        setNarrativeText(generated.coveringNarrative ?? '');
        setNarrativeError(generated.narrativeError ?? null);
        setActiveTab(generated.narrativeError ? 'narrative' : 'financial');
        if (stage === 'preliminary') {
          updateClaim({ insuredReportPreliminary: generated });
        } else {
          updateClaim({ insuredReportFinal: generated });
        }
      } catch (err: unknown) {
        toast.error(`Failed to generate report: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
        setLoadingMsg('');
      }
    }
  }

  function updateLineExplanation(id: string, field: keyof InsuredReportLineExplanation, value: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      lineExplanations: draft.lineExplanations.map(ex =>
        ex.assessmentRowId === id ? { ...ex, [field]: value } : ex
      ),
    });
  }

  function updatePolicyClause(i: number, field: keyof InsuredReportPolicyClause, value: string) {
    if (!draft) return;
    const updated = [...draft.policyMappings];
    updated[i] = { ...updated[i], [field]: value };
    setDraft({ ...draft, policyMappings: updated });
  }

  async function handleApprove() {
    if (!draft) return;
    setDownloading(true);
    try {
      const approved: InsuredReportDraft = {
        ...draft,
        isSurveyorApproved: true,
        coveringNarrative: narrativeText || draft.coveringNarrative,
      };
      const blob = await pdf(
        <InsuredSummaryDocument
          claim={claim}
          draft={approved}
          surveyorName={profile.name || ''}
          surveyorLicence={profile.licenceNumber || ''}
          surveyorMobile={profile.mobile || ''}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${claim.vehicle.registrationNumber || 'Claim'}-Insured-Summary.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Insured report approved and downloaded.');
    } catch (err: unknown) {
      toast.error(`PDF generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDownloading(false);
    }
  }

  const resolvedImages = policyImages ?? [];
  const hasPolicyDoc = resolvedImages.length > 0;
  const flaggedCount = draft?.lineExplanations.filter(e => e.isFlagged).length ?? 0;

  // ── Gate: derive zeroDep and blocking rows ────────────────────────────────
  const zeroDep = (
    claim.depreciationType === 'nil' ||
    (claim.policy.policyType?.toLowerCase().includes('zero dep') ?? false)
  );
  const blockingRows = getBlockingRows(claim, zeroDep);
  const isGateBlocked = blockingRows.length > 0;

  // ── Current pipeline stage ────────────────────────────────────────────────
  const currentStage =
    !policyAnalysis ? 'policy' :
    !assessmentAnalysis ? 'assessment' :
    assessmentAnalysis.hasFlaggedRows && !surveyorAnswers ? 'gap-review' :
    'generate';

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-neutral-50)]">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="px-8 py-6 border-b bg-card border-border">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium tracking-tight text-foreground">
              Insured Report
            </h1>
            <p className="text-xs mt-0.5 text-muted-foreground">
              AI-powered plain-language claim summary for the insured party ·{' '}
              {currentClaim.vehicle.registrationNumber || currentClaim.reportNo || 'Current Claim'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Stage selector */}
            <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-neutral-100)]">
              {(['preliminary', 'final'] as InsuredReportStage[]).map(s => (
                <button
                  key={s}
                  onClick={() => { setStage(s); setDraft(null); }}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-all"
                  style={{
                    background: stage === s ? 'var(--color-neutral-50)' : 'transparent',
                    color: stage === s ? 'var(--color-neutral-900)' : 'var(--color-neutral-400)',
                    boxShadow: stage === s ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {/* Language selector */}
            <select
              value={language}
              onChange={e => handleLanguageChange(e.target.value as InsuredReportLanguage)}
              disabled={loading}
              className="text-xs border rounded-lg px-2 py-1.5 font-medium border-border text-foreground bg-card"
            >
              {ALLOWED_LANGUAGES.map(l => (
                <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────── */}
      <div className="px-8 py-8 max-w-3xl mx-auto space-y-6">

        {/* Policy Document Upload Card */}
        <div
          className="rounded-2xl border p-5"
          style={{
            borderColor: hasPolicyDoc ? 'var(--color-primary)' : 'var(--color-neutral-200)',
            background: hasPolicyDoc ? 'var(--color-status-warning-tint)' : 'var(--color-neutral-50)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={16} style={{ color: hasPolicyDoc ? 'var(--color-primary)' : 'var(--color-neutral-400)' }} />
              <span className="text-sm font-medium text-foreground">Policy Document</span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={hasPolicyDoc
                  ? { background: 'var(--color-status-warning-tint)', color: 'var(--color-status-warning)' }
                  : { background: 'var(--color-neutral-100)', color: 'var(--color-neutral-400)' }}
              >
                {hasPolicyDoc
                  ? `${resolvedImages.length} page${resolvedImages.length !== 1 ? 's' : ''} · AI will extract clauses`
                  : 'No policy · IRDAI standard clauses'}
              </span>
            </div>
            {hasPolicyDoc && policyFileName && (
              <button
                onClick={handleClearPolicy}
                className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
                title="Remove policy — will use IRDAI standard clauses"
              >
                <X size={11} /> Remove
              </button>
            )}
          </div>

          {policyFileName && (
            <p className="text-[11px] mb-3 truncate text-muted-foreground">
              {policyFileName}
            </p>
          )}

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePolicyUpload(f); }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={policyConverting || loading}
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl border border-border text-foreground bg-card transition-all"
              style={{
                opacity: policyConverting || loading ? 0.5 : 1,
              }}
            >
              {policyConverting
                ? <Loader2 size={13} className="animate-spin" />
                : <Upload size={13} />}
              {hasPolicyDoc ? 'Re-upload Policy PDF' : 'Upload Policy PDF'}
            </button>
            {loadingMsg && policyConverting && (
              <span className="text-[11px] text-muted-foreground">{loadingMsg}</span>
            )}
            {!loadingMsg && (
              <span className="text-[11px] text-muted-foreground">
                Upload for real clause extraction — otherwise IRDAI standard clauses are used
              </span>
            )}
          </div>
        </div>

        {/* Gate: blocking rows panel — appears before generate button */}
        {isGateBlocked && !draft && !loading && (
          <div
            className="rounded-2xl border p-5 space-y-3"
            style={{ background: 'var(--color-status-danger-tint)', borderColor: 'var(--color-status-danger)' }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-status-danger)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-status-danger)' }}>
                  {blockingRows.length} item{blockingRows.length > 1 ? 's' : ''} need{blockingRows.length === 1 ? 's' : ''} remarks before the report can be generated
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-status-danger)' }}>
                  Add surveyor remarks in the Assessment tab for the items below, then return here to generate.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {blockingRows.map(row => (
                <div
                  key={row.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: 'var(--color-status-danger-tint)', border: '1px solid var(--color-status-danger)' }}
                >
                  <div>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-status-danger)' }}>
                      {row.particulars}
                    </span>
                    <span className="text-xs ml-2" style={{ color: 'var(--color-status-danger)' }}>
                      {row.reason}
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="text-[11px] font-mono" style={{ color: 'var(--color-status-danger)' }}>
                      Billed ₹{row.billed.toLocaleString('en-IN')}
                      {row.assessed !== row.billed && (
                        <> &rarr; Assessed ₹{row.assessed.toLocaleString('en-IN')}</>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage 1 — Policy Analysis */}
        {currentStage === 'policy' && !loading && (
          <div className="text-center py-6 space-y-3">
            <button
              onClick={handleAnalysePolicy}
              disabled={policyConverting || isGateBlocked}
              className="px-8 py-3.5 rounded-2xl font-medium text-sm transition-all shadow-md"
              style={{
                background: isGateBlocked
                  ? 'var(--color-neutral-200)'
                  : 'var(--color-primary)',
                color: isGateBlocked ? 'var(--color-neutral-400)' : 'var(--color-neutral-50)',
                cursor: isGateBlocked ? 'not-allowed' : 'pointer',
                opacity: policyConverting ? 0.5 : 1,
              }}
            >
              {isGateBlocked
                ? `Add remarks for ${blockingRows.length} item${blockingRows.length > 1 ? 's' : ''} first`
                : 'Analyse Policy'}
            </button>
            <p className="text-xs text-muted-foreground">
              {isGateBlocked
                ? 'Fill in surveyor remarks for the highlighted items in the Assessment tab, then return here.'
                : hasPolicyDoc
                  ? 'AI will extract clauses from your uploaded policy.'
                  : 'IRDAI standard clauses will be used. Upload a policy PDF above for specific clause extraction.'}
            </p>
          </div>
        )}

        {/* Stage 2 — Assessment Analysis */}
        {currentStage === 'assessment' && !loading && policyAnalysis && (
          <div className="space-y-3">
            <div
              className="rounded-2xl border p-4 flex items-center gap-3"
              style={{ background: 'var(--color-status-success-tint)', borderColor: 'var(--color-status-success)' }}
            >
              <CheckCircle2 size={16} style={{ color: 'var(--color-status-success)' }} />
              <p className="text-sm" style={{ color: 'var(--color-status-success)' }}>
                Policy analysed — {policyAnalysis.clauses.length} clause
                {policyAnalysis.clauses.length !== 1 ? 's' : ''} extracted from{' '}
                {policyAnalysis.source === 'policy-pdf' ? 'uploaded policy' : 'IRDAI standard clauses'}.
              </p>
            </div>
            <div className="text-center py-4">
              <button
                onClick={handleAnalyseAssessment}
                disabled={isGateBlocked}
                className="px-8 py-3.5 rounded-2xl font-medium text-sm transition-all shadow-md"
                style={{
                  background: isGateBlocked ? 'var(--color-neutral-200)' : 'var(--color-primary)',
                  color: isGateBlocked ? 'var(--color-neutral-400)' : 'var(--color-neutral-50)',
                  cursor: isGateBlocked ? 'not-allowed' : 'pointer',
                }}
              >
                {isGateBlocked
                  ? `Add remarks for ${blockingRows.length} item${blockingRows.length > 1 ? 's' : ''} first`
                  : 'Analyse Assessment'}
              </button>
            </div>
          </div>
        )}

        {/* Stage 3 — Gap Review (conditional) */}
        {currentStage === 'gap-review' && assessmentAnalysis && !loading && (
          <GapReviewStep
            flaggedItems={assessmentAnalysis.lineExplanations.filter(e => e.isFlagged)}
            onComplete={handleGapReviewComplete}
          />
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16">
            <Loader2 className="h-9 w-9 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">{loadingMsg || 'Processing…'}</p>
          </div>
        )}

        {/* Stage 4 — Generate Report button (shown before draft exists) */}
        {currentStage === 'generate' && !draft && !loading && (
          <div className="text-center py-10">
            <button
              onClick={handleGenerateReport}
              disabled={isGateBlocked}
              className="px-8 py-3.5 rounded-2xl font-medium text-sm transition-all shadow-md"
              style={{
                background: isGateBlocked ? 'var(--color-neutral-200)' : 'var(--color-primary)',
                color: isGateBlocked ? 'var(--color-neutral-400)' : 'var(--color-neutral-50)',
                cursor: isGateBlocked ? 'not-allowed' : 'pointer',
              }}
            >
              {isGateBlocked
                ? `Add remarks for ${blockingRows.length} item${blockingRows.length > 1 ? 's' : ''} first`
                : 'Generate Report'}
            </button>
            <p className="text-xs mt-3 text-muted-foreground">
              {isGateBlocked
                ? 'Fill in surveyor remarks for the highlighted items in the Assessment tab, then return here.'
                : 'All stages complete — ready to generate the insured report.'}
            </p>
          </div>
        )}

        {/* Draft review */}
        {draft && !loading && (
          <>
            {flaggedCount > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: 'var(--color-status-warning-tint)', border: '1px solid var(--color-status-warning)' }}>
                <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-status-warning)' }} />
                <p className="text-xs" style={{ color: 'var(--color-status-warning)' }}>
                  {flaggedCount} item{flaggedCount > 1 ? 's' : ''} had insufficient context for a full explanation. Each has been given a professional fallback note referencing the actual amounts — review in Line Items before approving.
                </p>
              </div>
            )}

            {/* Sub-tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-neutral-100)]">
              {(['financial', 'policy', 'lineitems', 'narrative'] as ReviewTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-2 text-xs font-medium rounded-lg transition-all"
                  style={{
                    background: activeTab === tab ? 'var(--color-neutral-50)' : 'transparent',
                    color: activeTab === tab ? 'var(--color-neutral-900)' : 'var(--color-neutral-400)',
                    boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  {tab === 'financial' ? 'Financial'
                    : tab === 'policy' ? 'Policy Clauses'
                    : tab === 'lineitems' ? `Line Items${flaggedCount > 0 ? ` (${flaggedCount} ⚠)` : ''}`
                    : 'Narrative'}
                </button>
              ))}
            </div>

            {/* Financial Summary */}
            {activeTab === 'financial' && (
              <div className="rounded-2xl border p-5 space-y-1 bg-card border-border">
                {[
                  { label: 'Garage repair estimate', value: draft.financialSummary.garageEstimate, prefix: '' },
                  { label: 'Amount negotiated with garage', value: draft.financialSummary.negotiatedSavings, prefix: '−' },
                  { label: 'Excess (compulsory + voluntary)', value: draft.financialSummary.excessTotal, prefix: '−' },
                  { label: 'Consumables deduction', value: draft.financialSummary.consumablesTotal, prefix: '−' },
                  { label: 'Items not covered by policy', value: draft.financialSummary.notCoveredTotal, prefix: '−' },
                  { label: 'Salvage / disposal deduction', value: draft.financialSummary.salvageTotal, prefix: '−' },
                ].filter(r => r.value > 0).map((row, i) => (
                  <div key={i} className="flex justify-between py-2.5 text-sm border-b border-[var(--color-neutral-100)]">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium">{row.prefix}₹{row.value.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                {draft.financialSummary.depreciationTotal > 0 && (
                  <div className="border-b py-2.5 border-[var(--color-neutral-100)]">
                    <DepreciationBreakdownTable
                      breakdown={draft.financialSummary.depreciationBreakdown}
                      total={draft.financialSummary.depreciationTotal}
                    />
                  </div>
                )}
                <div className="flex justify-between pt-4 pb-2 text-sm font-medium border-t-2 border-foreground">
                  <span>Insurance company will pay</span>
                  <span>₹{draft.financialSummary.insurerPays.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-3 text-sm font-medium rounded-xl px-3 mt-2 bg-[var(--color-status-warning-tint)]">
                  <span>Your share (payable to garage)</span>
                  <span style={{ color: 'var(--color-status-danger)' }}>₹{draft.financialSummary.insuredPays.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-xs pt-2 text-muted-foreground">Figures are computed from claim assessment data.</p>
              </div>
            )}

            {/* Policy Clauses */}
            {activeTab === 'policy' && (
              <div className="space-y-4">
                {draft.policyMappings.map((clause, i) => (
                  <div key={clause.clauseType} className="rounded-2xl p-4 border bg-card border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium">{clause.clauseTitle}</span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={clause.source === 'policy-pdf'
                          ? { background: 'var(--color-status-success-tint)', color: 'var(--color-status-success)' }
                          : { background: 'var(--color-status-warning-tint)', color: 'var(--color-status-warning)' }}
                      >
                        {clause.source === 'policy-pdf' ? '✓ From Policy PDF' : 'IRDAI Standard'}
                      </span>
                    </div>
                    <textarea
                      value={clause.plainLanguage}
                      onChange={e => updatePolicyClause(i, 'plainLanguage', e.target.value)}
                      rows={3}
                      className="w-full text-xs border rounded-lg p-2 resize-none border-border"
                      style={{ color: 'var(--color-neutral-600)' }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Narrative */}
            {activeTab === 'narrative' && (
              <div className="rounded-2xl border p-5 bg-card border-border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Covering Narrative</p>
                    <p className="text-xs mt-0.5 text-muted-foreground">
                      AI-drafted letter for the insured. Review and edit before approving.
                    </p>
                  </div>
                  {!narrativeText && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'var(--color-status-warning-tint)', color: 'var(--color-status-warning)' }}
                      title={narrativeError ?? 'The AI did not return a narrative. You can type it manually.'}
                    >
                      ⚠ {narrativeError ?? 'AI did not generate — type manually'}
                    </span>
                  )}
                </div>
                <textarea
                  value={narrativeText}
                  onChange={e => setNarrativeText(e.target.value)}
                  rows={14}
                  placeholder="The AI will generate a professional covering letter here. If it is blank, you can type the narrative manually before approving."
                  className="w-full text-sm border rounded-xl p-3 resize-none leading-relaxed border-border"
                  style={{
                    color: 'var(--color-neutral-600)',
                    fontFamily: 'Georgia, serif',
                    lineHeight: '1.75',
                  }}
                />
                <p className="text-[11px] mt-2 text-muted-foreground">
                  This narrative will be included in the PDF sent to the insured. It does not affect the financial figures.
                </p>
              </div>
            )}

            {/* Line Items */}
            {activeTab === 'lineitems' && (
              <div className="space-y-3">
                {draft.lineExplanations.length === 0 && (
                  <p className="text-sm text-center py-8 text-muted-foreground">No adjusted items to review.</p>
                )}
                {draft.lineExplanations.map(item => (
                  <div
                    key={item.assessmentRowId}
                    className="rounded-2xl p-4 border"
                    style={{
                      borderColor: item.isFlagged ? 'var(--color-status-warning)' : 'var(--color-neutral-200)',
                      background: item.isFlagged ? 'var(--color-status-warning-tint)' : 'var(--color-neutral-50)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{item.partDescription}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Billed: ₹{item.billedAmount.toLocaleString('en-IN')}</span>
                        <span>Assessed: ₹{item.surveyorAmount.toLocaleString('en-IN')}</span>
                        {item.isFlagged && <span style={{ color: 'var(--color-status-warning)' }}>⚠ Needs context</span>}
                      </div>
                    </div>
                    {item.surveyorRemarks && (
                      <p className="text-xs mb-2 italic text-muted-foreground">Surveyor: &quot;{item.surveyorRemarks}&quot;</p>
                    )}
                    <textarea
                      value={item.aiExplanation}
                      onChange={e => updateLineExplanation(item.assessmentRowId, 'aiExplanation', e.target.value)}
                      rows={2}
                      placeholder={item.isFlagged ? 'Add explanation for insured (optional)…' : ''}
                      className="w-full text-xs border rounded-lg p-2 resize-none"
                      style={{
                        borderColor: item.isFlagged ? 'var(--color-status-warning)' : 'var(--color-neutral-200)',
                        color: 'var(--color-neutral-600)',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between pt-2 pb-8">
              <button
                onClick={handleGenerateReport}
                disabled={loading || downloading || !policyAnalysis || !assessmentAnalysis}
                className="flex items-center gap-2 text-xs font-medium px-4 py-2.5 rounded-xl border transition-all border-border text-muted-foreground bg-card"
              >
                <RefreshCw size={14} /> Regenerate
              </button>
              <button
                onClick={handleApprove}
                disabled={downloading}
                className="flex items-center gap-2 text-sm font-medium px-6 py-3 rounded-xl transition-all bg-primary text-[var(--color-neutral-50)]"
                style={{
                  opacity: downloading ? 0.6 : 1,
                }}
              >
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {downloading ? 'Generating PDF…' : 'Approve & Download PDF'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
