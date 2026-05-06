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
} from '@/types/insured-report';
import { generateInsuredReport, getBlockingRows } from '@/lib/ai/insured-report';
import { InsuredSummaryDocument } from '@/components/pdf/InsuredSummaryDocument';
import { fileToImages } from '@/lib/ai/processor';
import { logger } from '@/lib/utils/logger';
import { CATEGORY_BADGE_LABELS, CATEGORY_BADGE_COLOURS } from '@/lib/constants/deduction-categories';

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
  const { currentClaim } = useClaimStore();
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
        <FileCheck size={40} style={{ color: '#E2E6EA' }} className="mb-4" />
        <div className="text-base font-bold" style={{ color: '#0D1B2A' }}>No Claim Open</div>
        <div className="text-sm mt-1" style={{ color: '#8D99AE' }}>
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

  async function handleGenerate(lang: InsuredReportLanguage = language) {
    setLoading(true);
    setDraft(null);
    try {
      const imgs = getResolvedPolicyImages();
      const generated = await generateInsuredReport({
        claim,
        stage,
        language: lang,
        policyImages: imgs,
        onProgress: setLoadingMsg,
      });
      setDraft(generated);
      setNarrativeText(generated.coveringNarrative ?? '');
      setNarrativeError(generated.narrativeError ?? null);
      // Auto-open the Narrative tab on error so the surveyor sees the issue immediately
      setActiveTab(generated.narrativeError ? 'narrative' : 'financial');
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
    if (draft) await handleGenerate(lang);
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
    (claim.depreciationType === 'nil') ||
    ((claim.policy as any)?.policyType?.toLowerCase().includes('zero dep')) ||
    false
  );
  const blockingRows = getBlockingRows(claim, zeroDep);
  const isGateBlocked = blockingRows.length > 0;

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8F9FA' }}>
      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="px-8 py-6 border-b"
        style={{ background: '#FFFFFF', borderColor: '#E2E6EA' }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight" style={{ color: '#0D1B2A' }}>
              Insured Report
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>
              AI-powered plain-language claim summary for the insured party ·{' '}
              {currentClaim.vehicle.registrationNumber || currentClaim.reportNo || 'Current Claim'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Stage selector */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F0F2F5' }}>
              {(['preliminary', 'final'] as InsuredReportStage[]).map(s => (
                <button
                  key={s}
                  onClick={() => { setStage(s); setDraft(null); }}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition-all"
                  style={{
                    background: stage === s ? '#FFFFFF' : 'transparent',
                    color: stage === s ? '#0D1B2A' : '#8D99AE',
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
              className="text-xs border rounded-lg px-2 py-1.5 font-medium"
              style={{ borderColor: '#E2E6EA', color: '#0D1B2A', background: '#FFFFFF' }}
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
            borderColor: hasPolicyDoc ? '#D4AF37' : '#E2E6EA',
            background: hasPolicyDoc ? '#FFFBEB' : '#FFFFFF',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={16} style={{ color: hasPolicyDoc ? '#D4AF37' : '#8D99AE' }} />
              <span className="text-sm font-bold" style={{ color: '#0D1B2A' }}>Policy Document</span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={hasPolicyDoc
                  ? { background: '#FEF3C7', color: '#92400E' }
                  : { background: '#F0F2F5', color: '#8D99AE' }}
              >
                {hasPolicyDoc
                  ? `${resolvedImages.length} page${resolvedImages.length !== 1 ? 's' : ''} · AI will extract clauses`
                  : 'No policy · IRDAI standard clauses'}
              </span>
            </div>
            {hasPolicyDoc && policyFileName && (
              <button
                onClick={handleClearPolicy}
                className="flex items-center gap-1 text-[11px] font-bold"
                style={{ color: '#8D99AE' }}
                title="Remove policy — will use IRDAI standard clauses"
              >
                <X size={11} /> Remove
              </button>
            )}
          </div>

          {policyFileName && (
            <p className="text-[11px] mb-3 truncate" style={{ color: '#8D99AE' }}>
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
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border transition-all"
              style={{
                borderColor: '#E2E6EA',
                color: '#0D1B2A',
                opacity: policyConverting || loading ? 0.5 : 1,
                background: '#FFFFFF',
              }}
            >
              {policyConverting
                ? <Loader2 size={13} className="animate-spin" />
                : <Upload size={13} />}
              {hasPolicyDoc ? 'Re-upload Policy PDF' : 'Upload Policy PDF'}
            </button>
            {loadingMsg && policyConverting && (
              <span className="text-[11px]" style={{ color: '#8D99AE' }}>{loadingMsg}</span>
            )}
            {!loadingMsg && (
              <span className="text-[11px]" style={{ color: '#8D99AE' }}>
                Upload for real clause extraction — otherwise IRDAI standard clauses are used
              </span>
            )}
          </div>
        </div>

        {/* Gate: blocking rows panel — appears before generate button */}
        {isGateBlocked && !draft && !loading && (
          <div
            className="rounded-2xl border p-5 space-y-3"
            style={{ background: '#FFF5F5', borderColor: '#FECACA' }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: '#DC2626' }} />
              <div>
                <p className="text-sm font-bold" style={{ color: '#991B1B' }}>
                  {blockingRows.length} item{blockingRows.length > 1 ? 's' : ''} need{blockingRows.length === 1 ? 's' : ''} remarks before the report can be generated
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#B91C1C' }}>
                  Add surveyor remarks in the Assessment tab for the items below, then return here to generate.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {blockingRows.map(row => (
                <div
                  key={row.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: '#FEE2E2', border: '1px solid #FECACA' }}
                >
                  <div>
                    <span className="text-xs font-bold" style={{ color: '#7F1D1D' }}>
                      {row.particulars}
                    </span>
                    <span className="text-xs ml-2" style={{ color: '#B91C1C' }}>
                      {row.reason}
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="text-[11px] font-mono" style={{ color: '#991B1B' }}>
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

        {/* Generate button (pre-generation) */}
        {!draft && !loading && (
          <div className="text-center py-10">
            <button
              onClick={() => handleGenerate()}
              disabled={policyConverting || isGateBlocked}
              className="px-8 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-md"
              style={{
                background: isGateBlocked
                  ? '#E2E6EA'
                  : 'linear-gradient(135deg, #0D1B2A, #1e3a5f)',
                color: isGateBlocked ? '#8D99AE' : '#F8F9FA',
                cursor: isGateBlocked ? 'not-allowed' : 'pointer',
                opacity: policyConverting ? 0.5 : 1,
              }}
              onMouseEnter={e => {
                if (!isGateBlocked) e.currentTarget.style.boxShadow = '0 6px 24px rgba(13,27,42,0.25)';
              }}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(13,27,42,0.15)')}
            >
              {isGateBlocked
                ? `Add remarks for ${blockingRows.length} item${blockingRows.length > 1 ? 's' : ''} first`
                : 'Generate Insured Report'}
            </button>
            <p className="text-xs mt-3" style={{ color: '#8D99AE' }}>
              {isGateBlocked
                ? 'Fill in surveyor remarks for the highlighted items in the Assessment tab, then return here.'
                : hasPolicyDoc
                  ? 'AI will extract clauses from your uploaded policy, then explain each deduction.'
                  : 'IRDAI standard clauses will be used. Upload a policy PDF above for specific clause extraction.'}
            </p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16">
            <Loader2 className="h-9 w-9 animate-spin mx-auto mb-4" style={{ color: '#D4AF37' }} />
            <p className="text-sm font-medium" style={{ color: '#8D99AE' }}>{loadingMsg || 'Generating…'}</p>
          </div>
        )}

        {/* Draft review */}
        {draft && !loading && (
          <>
            {flaggedCount > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}>
                <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: '#92400E' }} />
                <p className="text-xs" style={{ color: '#92400E' }}>
                  {flaggedCount} item{flaggedCount > 1 ? 's' : ''} had insufficient context for a full explanation. Each has been given a professional fallback note referencing the actual amounts — review in Line Items before approving.
                </p>
              </div>
            )}

            {/* Sub-tabs */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F0F2F5' }}>
              {(['financial', 'policy', 'lineitems', 'narrative'] as ReviewTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-2 text-xs font-bold rounded-lg transition-all"
                  style={{
                    background: activeTab === tab ? '#FFFFFF' : 'transparent',
                    color: activeTab === tab ? '#0D1B2A' : '#8D99AE',
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
              <div
                className="rounded-2xl border p-5 space-y-1"
                style={{ background: '#FFFFFF', borderColor: '#E2E6EA' }}
              >
                {[
                  { label: 'Garage repair estimate', value: draft.financialSummary.garageEstimate, prefix: '' },
                  { label: 'Amount negotiated with garage', value: draft.financialSummary.negotiatedSavings, prefix: '−' },
                  { label: 'Depreciation on parts', value: draft.financialSummary.depreciationTotal, prefix: '−' },
                  { label: 'Excess (compulsory + voluntary)', value: draft.financialSummary.excessTotal, prefix: '−' },
                  { label: 'Consumables deduction', value: draft.financialSummary.consumablesTotal, prefix: '−' },
                  { label: 'Items not covered by policy', value: draft.financialSummary.notCoveredTotal, prefix: '−' },
                  { label: 'Salvage / disposal deduction', value: draft.financialSummary.salvageTotal, prefix: '−' },
                ].filter(r => r.value > 0).map((row, i) => (
                  <div key={i} className="flex justify-between py-2.5 text-sm border-b" style={{ borderColor: '#F0F2F5' }}>
                    <span style={{ color: '#8D99AE' }}>{row.label}</span>
                    <span className="font-medium">{row.prefix}₹{row.value.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-4 pb-2 text-sm font-bold border-t-2" style={{ borderColor: '#0D1B2A' }}>
                  <span>Insurance company will pay</span>
                  <span>₹{draft.financialSummary.insurerPays.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-3 text-sm font-bold rounded-xl px-3 mt-2" style={{ background: '#FEF3C7' }}>
                  <span>Your share (payable to garage)</span>
                  <span style={{ color: '#B91C1C' }}>₹{draft.financialSummary.insuredPays.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-xs pt-2" style={{ color: '#8D99AE' }}>Figures are computed from claim assessment data.</p>
              </div>
            )}

            {/* Policy Clauses */}
            {activeTab === 'policy' && (
              <div className="space-y-4">
                {draft.policyMappings.map((clause, i) => (
                  <div key={clause.clauseType} className="rounded-2xl p-4 border" style={{ borderColor: '#E2E6EA', background: '#FFFFFF' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold">{clause.clauseTitle}</span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={clause.source === 'policy-pdf'
                          ? { background: '#ECFDF5', color: '#065F46' }
                          : { background: '#FFFBEB', color: '#92400E' }}
                      >
                        {clause.source === 'policy-pdf' ? '✓ From Policy PDF' : 'IRDAI Standard'}
                      </span>
                    </div>
                    <textarea
                      value={clause.plainLanguage}
                      onChange={e => updatePolicyClause(i, 'plainLanguage', e.target.value)}
                      rows={3}
                      className="w-full text-xs border rounded-lg p-2 resize-none"
                      style={{ borderColor: '#E2E6EA', color: '#374151' }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Narrative */}
            {activeTab === 'narrative' && (
              <div
                className="rounded-2xl border p-5"
                style={{ background: '#FFFFFF', borderColor: '#E2E6EA' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#0D1B2A' }}>Covering Narrative</p>
                    <p className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>
                      AI-drafted letter for the insured. Review and edit before approving.
                    </p>
                  </div>
                  {!narrativeText && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: '#FEF3C7', color: '#92400E' }}
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
                  className="w-full text-sm border rounded-xl p-3 resize-none leading-relaxed"
                  style={{
                    borderColor: '#E2E6EA',
                    color: '#374151',
                    fontFamily: 'Georgia, serif',
                    lineHeight: '1.75',
                  }}
                />
                <p className="text-[11px] mt-2" style={{ color: '#8D99AE' }}>
                  This narrative will be included in the PDF sent to the insured. It does not affect the financial figures.
                </p>
              </div>
            )}

            {/* Line Items */}
            {activeTab === 'lineitems' && (
              <div className="space-y-3">
                {draft.lineExplanations.length === 0 && (
                  <p className="text-sm text-center py-8" style={{ color: '#8D99AE' }}>No adjusted items to review.</p>
                )}
                {draft.lineExplanations.map(item => (
                  <div
                    key={item.assessmentRowId}
                    className="rounded-2xl p-4 border"
                    style={{ borderColor: item.isFlagged ? '#FCD34D' : '#E2E6EA', background: item.isFlagged ? '#FFFBEB' : '#FFFFFF' }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{item.partDescription}</span>
                      <div className="flex items-center gap-3 text-xs" style={{ color: '#8D99AE' }}>
                        <span>Billed: ₹{item.billedAmount.toLocaleString('en-IN')}</span>
                        <span>Assessed: ₹{item.surveyorAmount.toLocaleString('en-IN')}</span>
                        {item.isFlagged && <span style={{ color: '#92400E' }}>⚠ Needs context</span>}
                      </div>
                    </div>
                    {item.surveyorRemarks && (
                      <p className="text-xs mb-2 italic" style={{ color: '#8D99AE' }}>Surveyor: &quot;{item.surveyorRemarks}&quot;</p>
                    )}
                    <textarea
                      value={item.aiExplanation}
                      onChange={e => updateLineExplanation(item.assessmentRowId, 'aiExplanation', e.target.value)}
                      rows={2}
                      placeholder={item.isFlagged ? 'Add explanation for insured (optional)…' : ''}
                      className="w-full text-xs border rounded-lg p-2 resize-none"
                      style={{ borderColor: item.isFlagged ? '#FCD34D' : '#E2E6EA', color: '#374151' }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between pt-2 pb-8">
              <button
                onClick={() => handleGenerate()}
                disabled={loading || downloading}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border transition-all"
                style={{ borderColor: '#E2E6EA', color: '#8D99AE', background: '#FFFFFF' }}
              >
                <RefreshCw size={14} /> Regenerate
              </button>
              <button
                onClick={handleApprove}
                disabled={downloading}
                className="flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl transition-all"
                style={{
                  background: 'linear-gradient(135deg, #0D1B2A, #1e3a5f)',
                  color: '#F8F9FA',
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
