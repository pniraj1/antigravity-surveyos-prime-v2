'use client';

import React, { useMemo } from 'react';
import {
  CheckCircle2,
  X,
  Ban,
  ArrowRight,
  Layers,
  Sparkles,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import type { AssessmentRow, ExtraBillItem, BillItem } from '@/types/assessment';
import { normPart } from '@/lib/reports/bill-match-score';
import { matchStage1PartNumbers } from '@/lib/tally/stage1-part-number';
import { matchStage2NameAndCost } from '@/lib/tally/stage2-name-cost';
import { isPartNumberMatched, isSemanticMatched } from './BillCheckStepper';

export interface ReviewPair {
  row: AssessmentRow;
  billItem: {
    idx?: number;
    srNo?: number | string;
    description: string;
    partNumber?: string;
    taxableAmount: number;
    totalAmount?: number;
    gstPercent?: number;
    extraId?: string;
  };
  stage: 1 | 2;
  matchBadge: {
    text: string;
    type: 'exact' | 'normalized' | 'semantic' | 'manual';
  };
  priceDelta: number; // billItem.taxableAmount - (row.assessed || row.estimated || 0)
  isVerified: boolean;
}

export interface StageReviewTableProps {
  stage?: 1 | 2;
  rows?: AssessmentRow[];
  extraBillItems?: ExtraBillItem[];
  pairs?: ReviewPair[];
  onKeep?: (rowId: string) => void;
  onUnlink?: (rowId: string) => void;
  onMarkNotInBill?: (rowId: string) => void;
  onConfirmStage?: () => void;
  onPushUnmatched?: () => void;
  className?: string;
}

function extraToBillItem(e: ExtraBillItem, idx: number): BillItem {
  return {
    idx,
    srNo: e.srNo ?? idx + 1,
    description: e.description,
    partNumber: e.partNumber || '',
    taxableAmount: e.taxableAmount,
    totalAmount: e.amount,
    gstPercent: e.gstPercent,
    section: e.section === 'parts' || e.section === 'labour' || e.section === 'paint' ? e.section : 'parts',
    category: e.category,
    raw: e,
  };
}

function formatInr(val: number): string {
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

export function StageReviewTable({
  stage: propStage,
  rows: propRows,
  extraBillItems: propExtraBillItems,
  pairs: propPairs,
  onKeep,
  onUnlink,
  onMarkNotInBill,
  onConfirmStage,
  onPushUnmatched,
  className = '',
}: StageReviewTableProps) {
  const storeStage = useClaimStore((s) => s.activeTallyStage);
  const setStoreTallyStage = useClaimStore((s) => s.setTallyStage);
  const currentClaim = useClaimStore((s) => s.currentClaim);
  const updateAssessmentRow = useClaimStore((s) => s.updateAssessmentRow);
  const unlinkBillMatch = useClaimStore((s) => s.unlinkBillMatch);
  const linkExtraBillItem = useClaimStore((s) => s.linkExtraBillItem);

  const stage = propStage ?? (storeStage === 2 ? 2 : 1);
  const nextStageNum = stage === 1 ? 2 : 3;

  const derivedPairs = useMemo<ReviewPair[]>(() => {
    if (propPairs) return propPairs;

    const rows = propRows ?? currentClaim?.assessmentRows ?? [];
    const extraItems = propExtraBillItems ?? currentClaim?.extraBillItems ?? [];
    const billLines = extraItems.map((e, idx) => extraToBillItem(e, idx));

    const pairsList: ReviewPair[] = [];
    const handledRowIds = new Set<string>();

    if (stage === 1) {
      // 1. Existing matched rows matching part numbers
      for (const r of rows) {
        if (!r.refMatch?.bill) continue;
        if (!isPartNumberMatched(r)) continue;

        const rowPn = (r.partNumber || '').trim();
        const billPn = (r.refMatch.bill.partNumber || '').trim();
        const isExact = Boolean(rowPn && billPn && rowPn.toLowerCase() === billPn.toLowerCase());
        const taxable = r.billedTaxable ?? r.refMatch.bill.taxableAmount ?? 0;
        const assessed = r.assessed || r.estimated || 0;

        pairsList.push({
          row: r,
          billItem: {
            srNo: r.refMatch.bill.srNo ?? r.refSrNo,
            description: r.refMatch.bill.description,
            partNumber: r.refMatch.bill.partNumber,
            taxableAmount: taxable,
            totalAmount: r.billedAmount ?? r.refMatch.bill.amount,
            gstPercent: r.refMatch.bill.gstPercent,
            extraId: r.refMatch.bill.id,
          },
          stage: 1,
          matchBadge: {
            text: isExact ? 'Exact Part No.' : 'Normalized Part No.',
            type: isExact ? 'exact' : 'normalized',
          },
          priceDelta: taxable - assessed,
          isVerified: r.billVerified === true,
        });
        handledRowIds.add(r.id);
      }

      // 2. Candidate matches from matchStage1PartNumbers
      const unmatchedRows = rows.filter(
        (r) => !handledRowIds.has(r.id) && !r.refMatch && r.allowed && r.billStatus !== 'not-in-bill' && r.billedTaxable === undefined
      );
      const s1Result = matchStage1PartNumbers(unmatchedRows, billLines);

      for (const m of s1Result.matches) {
        const row = rows.find((r) => r.id === m.rowId);
        if (!row) continue;
        const extraItem = extraItems[Number(m.lineId)] ?? extraItems.find((e) => e.id === m.billItem.raw?.id);

        pairsList.push({
          row,
          billItem: {
            idx: m.billItem.idx,
            srNo: m.billItem.srNo,
            description: m.billItem.description,
            partNumber: m.billItem.partNumber,
            taxableAmount: m.billItem.taxableAmount,
            totalAmount: m.billItem.totalAmount,
            gstPercent: m.billItem.gstPercent,
            extraId: extraItem?.id,
          },
          stage: 1,
          matchBadge: {
            text: m.matchType === 'exact' ? 'Exact Part No.' : 'Normalized Part No.',
            type: m.matchType,
          },
          priceDelta: m.priceDelta,
          isVerified: false,
        });
      }
    } else {
      // Stage 2: Name & Price
      // 1. Existing matched rows with semantic/manual matches
      for (const r of rows) {
        if (!r.refMatch?.bill) continue;
        if (!isSemanticMatched(r)) continue;

        const reason = r.refMatch.reasons?.[0] || 'Name & Price Match';
        const taxable = r.billedTaxable ?? r.refMatch.bill.taxableAmount ?? 0;
        const assessed = r.assessed || r.estimated || 0;

        pairsList.push({
          row: r,
          billItem: {
            srNo: r.refMatch.bill.srNo ?? r.refSrNo,
            description: r.refMatch.bill.description,
            partNumber: r.refMatch.bill.partNumber,
            taxableAmount: taxable,
            totalAmount: r.billedAmount ?? r.refMatch.bill.amount,
            gstPercent: r.refMatch.bill.gstPercent,
            extraId: r.refMatch.bill.id,
          },
          stage: 2,
          matchBadge: {
            text: reason,
            type: 'semantic',
          },
          priceDelta: taxable - assessed,
          isVerified: r.billVerified === true,
        });
        handledRowIds.add(r.id);
      }

      // 2. Candidate matches from matchStage2NameAndCost
      const unmatchedRows = rows.filter(
        (r) => !handledRowIds.has(r.id) && !r.refMatch && r.allowed && r.billStatus !== 'not-in-bill' && r.billedTaxable === undefined
      );
      // Consume any S1 matches first so S2 doesn't duplicate them
      const s1Res = matchStage1PartNumbers(unmatchedRows, billLines);
      const s2Res = matchStage2NameAndCost(s1Res.unmatchedRows, s1Res.unmatchedLines);

      for (const m of s2Res.matches) {
        const row = rows.find((r) => r.id === m.rowId);
        if (!row) continue;
        const extraItem = extraItems[Number(m.lineId)] ?? extraItems.find((e) => e.id === m.billItem.raw?.id);

        pairsList.push({
          row,
          billItem: {
            idx: m.billItem.idx,
            srNo: m.billItem.srNo,
            description: m.billItem.description,
            partNumber: m.billItem.partNumber,
            taxableAmount: m.billItem.taxableAmount,
            totalAmount: m.billItem.totalAmount,
            gstPercent: m.billItem.gstPercent,
            extraId: extraItem?.id,
          },
          stage: 2,
          matchBadge: {
            text: m.reasons.join(' · ') || 'Synonym / Price Match',
            type: 'semantic',
          },
          priceDelta: m.priceDelta,
          isVerified: false,
        });
      }
    }

    return pairsList;
  }, [propPairs, propRows, propExtraBillItems, currentClaim, stage]);

  const verifiedCount = derivedPairs.filter((p) => p.isVerified).length;

  const handleKeep = (pair: ReviewPair) => {
    if (onKeep) {
      onKeep(pair.row.id);
      return;
    }

    if (pair.row.refMatch) {
      updateAssessmentRow(pair.row.id, { billVerified: true, billStatus: 'in-bill' });
    } else if (pair.billItem.extraId) {
      linkExtraBillItem(pair.billItem.extraId, pair.row.id);
      updateAssessmentRow(pair.row.id, { billVerified: true, billStatus: 'in-bill' });
    } else {
      updateAssessmentRow(pair.row.id, {
        billVerified: true,
        billStatus: 'in-bill',
        billedTaxable: pair.billItem.taxableAmount,
        billedAmount: pair.billItem.totalAmount,
      });
    }
  };

  const handleUnlink = (rowId: string) => {
    if (onUnlink) {
      onUnlink(rowId);
      return;
    }
    unlinkBillMatch(rowId);
  };

  const handleNotBilled = (rowId: string) => {
    if (onMarkNotInBill) {
      onMarkNotInBill(rowId);
      return;
    }
    const r = currentClaim?.assessmentRows.find((row) => row.id === rowId);
    if (r?.refMatch) {
      unlinkBillMatch(rowId);
    }
    updateAssessmentRow(rowId, {
      billStatus: 'not-in-bill',
      billedTaxable: 0,
      billedAmount: 0,
    });
  };

  const handleConfirmStage = () => {
    if (onConfirmStage) {
      onConfirmStage();
      return;
    }

    for (const pair of derivedPairs) {
      if (!pair.isVerified) {
        handleKeep(pair);
      }
    }
    setStoreTallyStage(nextStageNum as 2 | 3);
  };

  const handlePushUnmatched = () => {
    if (onPushUnmatched) {
      onPushUnmatched();
      return;
    }
    setStoreTallyStage(nextStageNum as 2 | 3);
  };

  const stageTitle = stage === 1 ? 'Part Numbers' : 'Name & Price';
  const StageIcon = stage === 1 ? Layers : Sparkles;

  return (
    <div
      role="region"
      aria-label={`Stage ${stage} Review: ${stageTitle}`}
      className={`flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-slate-50 dark:bg-slate-900/60 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-primary flex items-center justify-center shrink-0 border border-amber-300/60">
            <StageIcon className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>Stage {stage}: {stageTitle}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300/60">
                {derivedPairs.length} {derivedPairs.length === 1 ? 'match' : 'matches'}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stage === 1
                ? 'Review OEM & normalized part number matches paired between survey estimate and final bill.'
                : 'Review semantic synonym and price-consistent matches identified across remaining items.'}
            </p>
          </div>
        </div>

        {derivedPairs.length > 0 && (
          <div className="text-xs font-medium text-muted-foreground bg-background px-3 py-1.5 rounded-md border border-border">
            <span className="font-bold text-foreground">{verifiedCount}</span> of{' '}
            <span className="font-bold text-foreground">{derivedPairs.length}</span> verified
          </div>
        )}
      </div>

      {/* Main Table Content */}
      {derivedPairs.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="max-w-md">
            <h4 className="text-sm font-bold text-foreground">No Stage {stage} Matches Found</h4>
            <p className="text-xs text-muted-foreground mt-1">
              {stage === 1
                ? 'No items share exact or normalized part numbers. Proceed to Stage 2 to review name and cost matches.'
                : 'No additional synonym or cost-aligned pairs were identified. Proceed to Stage 3 to run surveyor-controlled AI matching.'}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={handlePushUnmatched}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-primary hover:bg-amber-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span>Proceed to Stage {nextStageNum}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setStoreTallyStage('grid')}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              Show Full Grid
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs" role="table">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-[28%]">Assessment Row</th>
                <th className="py-3 px-3 w-[16%]">Match Criterion</th>
                <th className="py-3 px-4 w-[28%]">Workshop Bill Item</th>
                <th className="py-3 px-3 w-[14%]">Price Delta</th>
                <th className="py-3 px-4 w-[14%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {derivedPairs.map((pair) => {
                const assessedAmt = pair.row.assessed || pair.row.estimated || 0;
                const billedAmt = pair.billItem.taxableAmount;
                const delta = pair.priceDelta;

                return (
                  <tr
                    key={pair.row.id}
                    className={`transition-colors hover:bg-muted/30 ${
                      pair.isVerified ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                    }`}
                  >
                    {/* Assessment Item */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            #{pair.row.srNo ?? '-'}
                          </span>
                          <span className="font-bold text-foreground text-xs leading-snug">
                            {pair.row.particulars}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {pair.row.partNumber && (
                            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              PN: {pair.row.partNumber}
                            </span>
                          )}
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                            {pair.row.section}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Assessed: <span className="font-semibold text-foreground">{formatInr(assessedAmt)}</span>
                        </div>
                      </div>
                    </td>

                    {/* Match Badge */}
                    <td className="py-3.5 px-3 align-top">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                            stage === 1
                              ? pair.matchBadge.type === 'exact'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                          }`}
                        >
                          <StageIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span className="truncate" title={pair.matchBadge.text}>
                            {pair.matchBadge.text}
                          </span>
                        </span>
                        {stage === 1 && pair.billItem.partNumber && (
                          <span className="font-mono text-[10px] text-muted-foreground truncate" title={pair.billItem.partNumber}>
                            {pair.billItem.partNumber}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Bill Item */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            Bill #{pair.billItem.srNo ?? '-'}
                          </span>
                          <span className="font-bold text-foreground text-xs leading-snug">
                            {pair.billItem.description}
                          </span>
                        </div>
                        {pair.billItem.partNumber && (
                          <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded w-fit">
                            PN: {pair.billItem.partNumber}
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Taxable: <span className="font-semibold text-foreground">{formatInr(billedAmt)}</span>
                          {pair.billItem.totalAmount !== undefined && (
                            <span className="text-[10px] text-muted-foreground/80 ml-1.5">
                              (Incl GST: {formatInr(pair.billItem.totalAmount)})
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Price Comparison Delta */}
                    <td className="py-3.5 px-3 align-top">
                      <div className="flex flex-col gap-1">
                        {delta === 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded text-[11px] w-fit">
                            ₹0 (Exact)
                          </span>
                        ) : delta < 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-[11px] w-fit border ${
                              stage === 2
                                ? 'text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                                : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                            }`}
                          >
                            -{formatInr(Math.abs(delta))} (Cheaper)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded text-[11px] w-fit">
                            +{formatInr(delta)} (Higher)
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {delta === 0 ? 'Assessed matches bill' : delta < 0 ? 'Insurer savings' : 'Surplus over survey'}
                        </span>
                      </div>
                    </td>

                    {/* Row Actions */}
                    <td className="py-3.5 px-4 align-top text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {pair.isVerified ? (
                          <span
                            className="min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1.5"
                            title="Item match verified by surveyor"
                          >
                            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleKeep(pair)}
                            aria-label={`Keep match for ${pair.row.particulars}`}
                            className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Keep</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleUnlink(pair.row.id)}
                          aria-label={`Unlink match for ${pair.row.particulars}`}
                          className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Unlink</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleNotBilled(pair.row.id)}
                          aria-label={`Mark ${pair.row.particulars} not billed`}
                          className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Not Billed</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Stage Action Bar at Bottom */}
      {derivedPairs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 dark:bg-slate-900/80 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {verifiedCount === derivedPairs.length ? (
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                All {derivedPairs.length} Stage {stage} pairs confirmed!
              </span>
            ) : (
              <span>
                {derivedPairs.length - verifiedCount} unconfirmed {derivedPairs.length - verifiedCount === 1 ? 'match' : 'matches'}.
                Clicking confirm will keep all remaining stage matches.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePushUnmatched}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer text-foreground shadow-sm"
            >
              <span>Push Unmatched to Stage {nextStageNum}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={handleConfirmStage}
              className="min-h-[44px] px-5 py-2 rounded-lg bg-primary hover:bg-amber-600 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <span>Confirm Stage Matches & Proceed to Next Stage</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
