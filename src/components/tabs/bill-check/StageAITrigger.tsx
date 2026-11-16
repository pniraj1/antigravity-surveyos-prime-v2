'use client';

import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { isTallyCandidate } from '@/lib/tally/candidate';
import { isFromBill } from '@/lib/reports/bill-check-mode';
import type { AssessmentRow, ExtraBillItem } from '@/types/assessment';
import {
  buildStage3AIPrompt,
  parseStage3AIResponse,
  type AIProposal,
  type CandidateRow,
  type CandidateLine,
} from '@/lib/tally/stage3-ai-matcher';
import { callAIGateway } from '@/lib/ai/service';
import { toast } from 'sonner';

export interface StageAITriggerProps {
  rows?: AssessmentRow[];
  extraBillItems?: ExtraBillItem[];
  proposals?: AIProposal[];
  onAcceptProposal?: (extraId: string, rowId: string) => void;
  onRejectProposal?: (proposal: AIProposal) => void;
  onProceedToStage4?: () => void;
  className?: string;
}

function formatInr(val: number): string {
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

export function StageAITrigger({
  rows: propRows,
  extraBillItems: propExtraBillItems,
  proposals: propProposals,
  onAcceptProposal,
  onRejectProposal,
  onProceedToStage4,
  className = '',
}: StageAITriggerProps) {
  const currentClaim = useClaimStore((s) => s.currentClaim);
  const linkExtraBillItem = useClaimStore((s) => s.linkExtraBillItem);
  const setStoreTallyStage = useClaimStore((s) => s.setTallyStage);

  const rows = propRows ?? currentClaim?.assessmentRows ?? [];
  const extraItems = propExtraBillItems ?? currentClaim?.extraBillItems ?? [];

  // Filter remaining unmatched rows
  const fromBill = isFromBill(currentClaim);
  const remainingRows = rows.filter((r) => isTallyCandidate(r, fromBill));
  const remainingLines = extraItems;

  const [activeProposals, setActiveProposals] = useState<AIProposal[]>(propProposals ?? []);
  const [acceptedProposalIds, setAcceptedProposalIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasQueriedAI, setHasQueriedAI] = useState(false);

  // If propProposals changes, synchronize
  React.useEffect(() => {
    if (propProposals) {
      setActiveProposals(propProposals);
    }
  }, [propProposals]);

  const handleAskAI = async () => {
    if (remainingRows.length === 0 || remainingLines.length === 0) {
      toast.info('No remaining items to match with AI.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const candidateRows: CandidateRow[] = remainingRows.map((r) => ({
      id: r.id,
      particulars: r.particulars,
      amount: r.assessed || r.estimated || 0,
    }));

    const candidateLines: CandidateLine[] = remainingLines.map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.taxableAmount || e.amount || 0,
    }));

    try {
      const prompt = buildStage3AIPrompt(candidateRows, candidateLines);
      const rawResponse = await callAIGateway(prompt, [], 'json', 'light');
      const parsed = parseStage3AIResponse(rawResponse);

      setActiveProposals(parsed);
      setHasQueriedAI(true);

      if (parsed.length === 0) {
        toast.info('AI did not identify additional confident matches for remaining items.');
      } else {
        toast.success(`AI suggested ${parsed.length} item match ${parsed.length === 1 ? 'proposal' : 'proposals'}.`);
      }
    } catch (err: any) {
      console.error('Failed to query Stage 3 AI matcher:', err);
      const msg = err?.message || 'Failed to communicate with AI gateway.';
      setErrorMessage(msg);
      toast.error('AI Matching failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = (proposal: AIProposal) => {
    // Resolve matching line from extra items
    const extra = remainingLines.find(
      (e) => e.id === proposal.lineId || (e.srNo !== undefined && String(e.srNo) === proposal.lineId)
    );
    const extraId = extra?.id ?? proposal.lineId;

    if (onAcceptProposal) {
      onAcceptProposal(extraId, proposal.rowId);
    } else {
      linkExtraBillItem(extraId, proposal.rowId);
    }

    setAcceptedProposalIds((prev) => new Set(prev).add(`${proposal.rowId}-${proposal.lineId}`));
    setActiveProposals((prev) => prev.filter((p) => p !== proposal));
    toast.success('Match proposal accepted and linked.');
  };

  const handleReject = (proposal: AIProposal) => {
    if (onRejectProposal) {
      onRejectProposal(proposal);
    }
    setActiveProposals((prev) => prev.filter((p) => p !== proposal));
    toast.info('Match proposal rejected.');
  };

  const handleProceedToStage4 = () => {
    if (onProceedToStage4) {
      onProceedToStage4();
    } else {
      setStoreTallyStage(4);
    }
  };

  return (
    <div
      role="region"
      aria-label="Stage 3: Surveyor-Triggered AI Matching"
      className={`flex flex-col gap-6 bg-card border border-border rounded-xl shadow-sm p-5 ${className}`}
    >
      {/* Hero Card */}
      <div className="bg-amber-50/70 dark:bg-amber-950/25 border border-amber-300 dark:border-amber-800/60 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-primary flex items-center justify-center shrink-0 shadow-xs border border-amber-300">
              <Bot className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                  Stage 3 · Surveyor-Controlled
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300">
                  Automotive Reasoning
                </span>
              </div>
              <h2 className="text-lg font-bold text-foreground mt-1">
                Targeted AI Semantic Matching
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Compare remaining unmatched assessment items against workshop bill lines. Uses AI to catch
                regional workshop terminology, assembly naming quirks, and alternate abbreviations without altering your figures.
              </p>
            </div>
          </div>

          {/* Counts and Trigger Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
            <div className="flex items-center gap-3 bg-white/90 dark:bg-slate-800/80 border border-amber-200/80 dark:border-slate-700/80 rounded-lg px-4 py-2.5 shadow-xs">
              <div className="text-center">
                <div className="text-base font-bold text-foreground" data-testid="remaining-rows-count">
                  {remainingRows.length}
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Remaining Items
                </div>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
              <div className="text-center">
                <div className="text-base font-bold text-foreground" data-testid="remaining-lines-count">
                  {remainingLines.length}
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Bill Lines
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAskAI}
              disabled={isLoading || remainingRows.length === 0 || remainingLines.length === 0}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-all focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Matching Remaining Items...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>🤖 Ask AI to Match Remaining Items</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error notification if AI failed */}
        {errorMessage && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span className="flex-1">{errorMessage}</span>
            <button
              type="button"
              onClick={handleAskAI}
              className="text-xs font-semibold underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* AI Proposals Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span>AI Match Proposals</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {activeProposals.length} {activeProposals.length === 1 ? 'proposal' : 'proposals'}
            </span>
          </h3>
        </div>

        {activeProposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 border border-dashed border-border rounded-xl text-center bg-slate-50/50 dark:bg-slate-900/30">
            <Sparkles className="w-8 h-8 text-muted-foreground/60 mb-2" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">
              {hasQueriedAI
                ? 'No remaining matches found by AI'
                : 'Click "Ask AI to Match Remaining Items" to discover proposals'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              {hasQueriedAI
                ? 'All possible equivalences have been evaluated. You can proceed to Stage 4 to review disallowed items and audit savings.'
                : 'Our automotive language model will analyze the remaining items and suggest high-confidence matches.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5" data-testid="proposals-list">
            {activeProposals.map((prop, idx) => {
              const row = rows.find((r) => r.id === prop.rowId);
              const extra = remainingLines.find(
                (e) => e.id === prop.lineId || (e.srNo !== undefined && String(e.srNo) === prop.lineId)
              );

              const rowCost = row?.assessed || row?.estimated || 0;
              const lineCost = extra?.taxableAmount || extra?.amount || 0;
              const priceDelta = lineCost - rowCost;

              const isHighConfidence = prop.confidence >= 80;
              const isMediumConfidence = prop.confidence >= 60;

              return (
                <div
                  key={`${prop.rowId}-${prop.lineId}-${idx}`}
                  className="bg-card border border-border hover:border-amber-400 dark:hover:border-amber-700 rounded-xl p-4 shadow-xs transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    {/* Items pairing preview */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      {/* Estimate Row */}
                      <div className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Estimate Item
                        </div>
                        <div className="text-sm font-bold text-foreground truncate mt-0.5">
                          {row?.particulars || `Row #${prop.rowId}`}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          {row?.partNumber && (
                            <span className="font-mono bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[11px]">
                              {row.partNumber}
                            </span>
                          )}
                          <span>Assessed: {formatInr(rowCost)}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center justify-center text-muted-foreground">
                        <ArrowRight className="w-4 h-4 hidden sm:block" aria-hidden="true" />
                        <div className="w-4 h-px bg-border sm:hidden" />
                      </div>

                      {/* Bill Item */}
                      <div className="flex-1 min-w-0 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-900/50">
                        <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                          Bill Line
                        </div>
                        <div className="text-sm font-bold text-foreground truncate mt-0.5">
                          {extra?.description || `Bill #${prop.lineId}`}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          {extra?.partNumber && (
                            <span className="font-mono bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-1.5 py-0.2 rounded text-[11px]">
                              {extra.partNumber}
                            </span>
                          )}
                          <span>Billed: {formatInr(lineCost)}</span>
                          <span className={priceDelta <= 0 ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                            ({priceDelta > 0 ? `+${formatInr(priceDelta)}` : formatInr(priceDelta)})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Reason and confidence */}
                    <div className="flex flex-wrap items-center gap-2.5 mt-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isHighConfidence
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : isMediumConfidence
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{prop.confidence}% Confidence</span>
                      </span>

                      <p className="text-xs text-muted-foreground italic">
                        &ldquo;{prop.reason}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Accept / Reject actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => handleAccept(prop)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Accept Proposal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(prop)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Surveyor note: Stage 3 never automatically modifies figures without your explicit acceptance.
        </p>

        <button
          type="button"
          onClick={handleProceedToStage4}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-amber-600 active:bg-amber-700 shadow-xs transition-colors ml-auto cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <span>Proceed to Stage 4 (Disallowed &amp; Tally)</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
