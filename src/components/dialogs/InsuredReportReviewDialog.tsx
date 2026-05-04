'use client';

import { useRef, useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, RefreshCw, Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import type { ClaimData } from '@/types/claim';
import type {
  InsuredReportDraft,
  InsuredReportLanguage,
  InsuredReportStage,
  InsuredReportLineExplanation,
  InsuredReportPolicyClause,
} from '@/types/insured-report';
import { generateInsuredReport } from '@/lib/ai/insured-report';
import { InsuredSummaryDocument } from '@/components/pdf/InsuredSummaryDocument';
import { fileToImages } from '@/lib/ai/processor';

interface Props {
  claim: ClaimData;
  stage: InsuredReportStage;
  allowedLanguages: InsuredReportLanguage[];
  defaultLanguage: InsuredReportLanguage;
  surveyorName: string;
  surveyorLicence: string;
  surveyorMobile: string;
  existingDraft?: InsuredReportDraft;
  onApproved: (draft: InsuredReportDraft) => void;
  onClose: () => void;
}

type Tab = 'financial' | 'policy' | 'lineitems';

// ─── Policy image helpers ─────────────────────────────────────────────────────

/**
 * Reads compressed API-quality images from sessionStorage where the Documents
 * tab stores them after extraction (key: evidence_<claimId>_policy).
 * These are the same high-res PNGs used for the Evidence Viewer.
 */
function getPolicyImagesFromSession(claimId: string): string[] {
  try {
    const raw = sessionStorage.getItem(`evidence_${claimId}_policy`);
    if (!raw) return [];
    const pages: string[] = JSON.parse(raw);
    return pages.filter(Boolean);
  } catch {
    return [];
  }
}

/** Converts a newly uploaded File into base64 JPEG API images. */
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

export function InsuredReportReviewDialog({
  claim, stage, allowedLanguages, defaultLanguage,
  surveyorName, surveyorLicence, surveyorMobile,
  existingDraft, onApproved, onClose,
}: Props) {
  const [language, setLanguage] = useState<InsuredReportLanguage>(existingDraft?.language ?? defaultLanguage);
  const [draft, setDraft] = useState<InsuredReportDraft | null>(existingDraft ?? null);
  const [activeTab, setActiveTab] = useState<Tab>('financial');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Policy document state
  // null = not yet checked; string[] (may be empty) = resolved
  const [policyImages, setPolicyImages] = useState<string[] | null>(null);
  const [policyFileName, setPolicyFileName] = useState<string>('');
  const [policyConverting, setPolicyConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Resolves policy images: prefers freshly-uploaded file, then falls back to
   * sessionStorage (from Documents tab), then returns empty (IRDAI fallback).
   */
  function getResolvedPolicyImages(): string[] {
    if (policyImages !== null) return policyImages;
    // First call — check sessionStorage
    const fromSession = getPolicyImagesFromSession(claim.id);
    setPolicyImages(fromSession);
    if (fromSession.length > 0) {
      setPolicyFileName('(from Documents tab)');
    }
    return fromSession;
  }

  async function handlePolicyUpload(file: File) {
    setPolicyConverting(true);
    try {
      const images = await convertPolicyFile(file, setLoadingMsg);
      setPolicyImages(images);
      setPolicyFileName(file.name);
      toast.success(`Policy loaded: ${file.name} (${images.length} page${images.length !== 1 ? 's' : ''})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to process policy: ${msg}`);
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
        claim, stage, language: lang,
        policyImages: imgs,
        onProgress: setLoadingMsg,
      });
      setDraft(generated);
      setActiveTab('financial');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to generate report: ${msg}`);
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
      const approved: InsuredReportDraft = { ...draft, isSurveyorApproved: true };
      const blob = await pdf(
        <InsuredSummaryDocument
          claim={claim}
          draft={approved}
          surveyorName={surveyorName}
          surveyorLicence={surveyorLicence}
          surveyorMobile={surveyorMobile}
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
      onApproved(approved);
      toast.success('Insured report approved and downloaded.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`PDF generation failed: ${msg}`);
    } finally {
      setDownloading(false);
    }
  }

  const flaggedCount = draft?.lineExplanations.filter(e => e.isFlagged).length ?? 0;

  // Resolved state for UI
  const resolvedImages = policyImages ?? getPolicyImagesFromSession(claim.id);
  const hasPolicyDoc = resolvedImages.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" style={{ color: '#0D1B2A' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#E2E6EA' }}>
          <div>
            <h2 className="text-lg font-black tracking-tight">Insured Claim Summary</h2>
            <p className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>
              {stage === 'preliminary' ? 'Preliminary Estimate' : 'Final Settlement'} · Review before approving
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={e => handleLanguageChange(e.target.value as InsuredReportLanguage)}
              disabled={loading}
              className="text-xs border rounded-lg px-2 py-1.5 font-medium"
              style={{ borderColor: '#E2E6EA', color: '#0D1B2A' }}
            >
              {allowedLanguages.map(l => (
                <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
              ))}
            </select>
            <button onClick={onClose} className="text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-100">✕ Close</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Policy Document Section ─────────────────────────────────────── */}
          <div className="mb-5 rounded-xl border p-4" style={{ borderColor: hasPolicyDoc ? '#D4AF37' : '#E2E6EA', background: hasPolicyDoc ? '#FFFBEB' : '#FAFAFA' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText size={15} style={{ color: hasPolicyDoc ? '#D4AF37' : '#8D99AE' }} />
                <span className="text-xs font-bold" style={{ color: '#0D1B2A' }}>
                  Policy Document
                </span>
                {hasPolicyDoc && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: '#FEF3C7', color: '#92400E' }}>
                    {resolvedImages.length} page{resolvedImages.length !== 1 ? 's' : ''} · AI will extract clauses
                  </span>
                )}
                {!hasPolicyDoc && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: '#F0F2F5', color: '#8D99AE' }}>
                    No policy · IRDAI standard clauses will be used
                  </span>
                )}
              </div>
              {hasPolicyDoc && policyFileName && (
                <button
                  onClick={handleClearPolicy}
                  className="text-[10px] flex items-center gap-1 font-bold"
                  style={{ color: '#8D99AE' }}
                  title="Remove policy — will use IRDAI standard clauses"
                >
                  <X size={11} /> Remove
                </button>
              )}
            </div>

            {policyFileName && (
              <p className="text-[10px] mb-2 truncate" style={{ color: '#8D99AE' }}>
                {policyFileName}
              </p>
            )}

            {/* Upload button */}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handlePolicyUpload(file);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={policyConverting || loading}
                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all"
                style={{
                  borderColor: '#E2E6EA',
                  color: '#0D1B2A',
                  opacity: policyConverting || loading ? 0.5 : 1,
                }}
              >
                {policyConverting
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Upload size={12} />}
                {hasPolicyDoc ? 'Re-upload Policy' : 'Upload Policy PDF'}
              </button>
              <span className="text-[10px]" style={{ color: '#8D99AE' }}>
                Upload to get real clause extraction · otherwise IRDAI standard clauses are used
              </span>
            </div>
          </div>

          {!draft && !loading && (
            <div className="text-center py-12">
              <button
                onClick={() => handleGenerate()}
                disabled={policyConverting}
                className="px-6 py-3 rounded-xl font-bold text-sm text-white"
                style={{ background: '#0D1B2A', opacity: policyConverting ? 0.5 : 1 }}
              >
                Generate Insured Report
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-16">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: '#D4AF37' }} />
              <p className="text-sm font-medium" style={{ color: '#8D99AE' }}>{loadingMsg || 'Generating…'}</p>
            </div>
          )}

          {draft && !loading && (
            <>
              {flaggedCount > 0 && (
                <div className="flex items-start gap-3 mb-4 p-3 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}>
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: '#92400E' }} />
                  <p className="text-xs" style={{ color: '#92400E' }}>
                    {flaggedCount} item{flaggedCount > 1 ? 's' : ''} could not be fully explained (no surveyor remarks). They are highlighted in the Line Items tab. The report can still be approved — flagged items will show a generic note.
                  </p>
                </div>
              )}

              <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: '#F0F2F5' }}>
                {(['financial', 'policy', 'lineitems'] as Tab[]).map(tab => (
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
                    {tab === 'financial' ? 'Financial Summary' : tab === 'policy' ? 'Policy Clauses' : `Line Items${flaggedCount > 0 ? ` (${flaggedCount} ⚠)` : ''}`}
                  </button>
                ))}
              </div>

              {activeTab === 'financial' && (
                <div className="space-y-1">
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
                      <span>{row.prefix}₹{row.value.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-3 text-sm font-bold border-t-2 mt-2" style={{ borderColor: '#0D1B2A' }}>
                    <span>Insurance company will pay</span>
                    <span>₹{draft.financialSummary.insurerPays.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-3 text-sm font-bold rounded-xl px-3" style={{ background: '#FEF3C7' }}>
                    <span>Your share (payable to garage)</span>
                    <span style={{ color: '#B91C1C' }}>₹{draft.financialSummary.insuredPays.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-xs mt-3" style={{ color: '#8D99AE' }}>This tab is read-only — figures are computed from claim data.</p>
                </div>
              )}

              {activeTab === 'policy' && (
                <div className="space-y-4">
                  {draft.policyMappings.map((clause, i) => (
                    <div key={clause.clauseType} className="rounded-xl p-4 border" style={{ borderColor: '#E2E6EA' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold">{clause.clauseTitle}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: clause.source === 'policy-pdf' ? '#ECFDF5' : '#FFFBEB', color: clause.source === 'policy-pdf' ? '#065F46' : '#92400E' }}>
                          {clause.source === 'policy-pdf' ? '✓ From Policy' : 'IRDAI Standard'}
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

              {activeTab === 'lineitems' && (
                <div className="space-y-3">
                  {draft.lineExplanations.length === 0 && (
                    <p className="text-sm text-center py-8" style={{ color: '#8D99AE' }}>No adjusted items to review.</p>
                  )}
                  {draft.lineExplanations.map(item => (
                    <div key={item.assessmentRowId} className="rounded-xl p-4 border" style={{ borderColor: item.isFlagged ? '#FCD34D' : '#E2E6EA', background: item.isFlagged ? '#FFFBEB' : '#FFFFFF' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">{item.partDescription}</span>
                        <div className="flex items-center gap-3 text-xs" style={{ color: '#8D99AE' }}>
                          <span>Billed (taxable): ₹{item.billedAmount.toLocaleString('en-IN')}</span>
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
            </>
          )}
        </div>

        {draft && !loading && (
          <div className="flex items-center justify-between p-6 border-t" style={{ borderColor: '#E2E6EA' }}>
            <button
              onClick={() => handleGenerate()}
              disabled={loading || downloading}
              className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border"
              style={{ borderColor: '#E2E6EA', color: '#8D99AE' }}
            >
              <RefreshCw size={14} /> Regenerate
            </button>

            <button
              onClick={handleApprove}
              disabled={downloading}
              className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl text-white"
              style={{ background: '#0D1B2A', opacity: downloading ? 0.6 : 1 }}
            >
              {downloading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {downloading ? 'Generating PDF…' : 'Approve & Download PDF'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
