'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import type { ClaimData } from '@/types/claim';
import type { InsuredReportDraft, InsuredReportLanguage, InsuredReportStage, InsuredReportLineExplanation, InsuredReportPolicyClause } from '@/types/insured-report';
import { generateInsuredReport } from '@/lib/ai/insured-report';
import { InsuredSummaryDocument } from '@/components/pdf/InsuredSummaryDocument';

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

  async function handleGenerate(lang: InsuredReportLanguage = language) {
    setLoading(true);
    setDraft(null);
    try {
      const generated = await generateInsuredReport({
        claim, stage, language: lang,
        policyImages: [],
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
      a.click();
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

          {!draft && !loading && (
            <div className="text-center py-16">
              <p className="text-sm mb-6" style={{ color: '#8D99AE' }}>
                AI will analyze the policy and explain each deduction in plain language.
              </p>
              <button
                onClick={() => handleGenerate()}
                className="px-6 py-3 rounded-xl font-bold text-sm text-white"
                style={{ background: '#0D1B2A' }}
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
                    { label: 'Items not covered / consumables', value: draft.financialSummary.consumablesTotal + draft.financialSummary.notCoveredTotal, prefix: '−' },
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
                          {clause.source === 'policy-pdf' ? 'From Policy' : 'IRDAI Standard'}
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
            </>
          )}
        </div>

        {draft && !loading && (
          <div className="flex items-center justify-between p-6 border-t" style={{ borderColor: '#E2E6EA' }}>
            <button
              onClick={() => handleGenerate()}
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
