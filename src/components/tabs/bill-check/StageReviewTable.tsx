'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import type { AssessmentRow, ExtraBillItem, BillItem } from '@/types/assessment';
import { normPart } from '@/lib/reports/bill-match-score';
import { matchStage1PartNumbers } from '@/lib/tally/stage1-part-number';
import { matchStage2NameAndCost } from '@/lib/tally/stage2-name-cost';
import { isTallyCandidate } from '@/lib/tally/candidate';
import { isFromBill, uploadLabels } from '@/lib/reports/bill-check-mode';
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

/** Row payload for keeping a pair that has no refMatch or linkable line. From-bill rows are already self-billed, so link by refSrNo only. */
export function keepUpdates(pair: ReviewPair, fromBill: boolean): Partial<AssessmentRow> {
  if (fromBill) {
    return { refSrNo: pair.billItem.srNo, estimateAmount: pair.billItem.taxableAmount, billVerified: true };
  }
  return {
    billVerified: true,
    billStatus: 'in-bill',
    billedTaxable: pair.billItem.taxableAmount,
    billedAmount: pair.billItem.totalAmount,
  };
}

/** Pairs "Keep all" keeps: not yet kept, and not unlinked by the surveyor on this screen. */
export function pairsToKeep(pairs: ReviewPair[], dismissed: ReadonlySet<string>): ReviewPair[] {
  return pairs.filter((p) => !p.isVerified && !dismissed.has(p.row.id));
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
  const fromBill = isFromBill(currentClaim);
  const labels = uploadLabels(currentClaim);
  const updateAssessmentRow = useClaimStore((s) => s.updateAssessmentRow);
  const unlinkBillMatch = useClaimStore((s) => s.unlinkBillMatch);
  const linkExtraBillItem = useClaimStore((s) => s.linkExtraBillItem);
  const [sectionFilter, setSectionFilter] = useState<'all' | 'parts' | 'labour' | 'paint'>('all');
  // Suggested pairs (no refMatch) the surveyor unlinked: nothing in the store to clear, so hide them here.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const stage = propStage ?? (storeStage === 2 ? 2 : 1);
  const nextStageNum = stage === 1 ? 2 : 3;

  const allPairs = useMemo<ReviewPair[]>(() => {
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
        (r) => !handledRowIds.has(r.id) && isTallyCandidate(r, fromBill)
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
        (r) => !handledRowIds.has(r.id) && isTallyCandidate(r, fromBill)
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
  const derivedPairs = dismissed.size ? allPairs.filter((p) => !dismissed.has(p.row.id)) : allPairs;

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
      updateAssessmentRow(pair.row.id, keepUpdates(pair, fromBill));
    }
  };

  const handleUnlink = (pair: ReviewPair) => {
    if (onUnlink) {
      onUnlink(pair.row.id);
      return;
    }
    if (pair.row.refMatch) unlinkBillMatch(pair.row.id);
    else setDismissed((prev) => new Set([...prev, pair.row.id]));
  };

  const handleNotBilled = (rowId: string) => {
    if (onMarkNotInBill) {
      onMarkNotInBill(rowId);
      return;
    }
    // From-bill every row IS the bill: "not billed" would zero it.
    if (fromBill) return;
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

    for (const pair of pairsToKeep(derivedPairs, dismissed)) handleKeep(pair);
    setStoreTallyStage(nextStageNum as 2 | 3);
  };

  const handlePushUnmatched = () => {
    if (onPushUnmatched) {
      onPushUnmatched();
      return;
    }
    setStoreTallyStage(nextStageNum as 2 | 3);
  };

  const visiblePairs = sectionFilter === 'all' ? derivedPairs : derivedPairs.filter((p) => p.row.section === sectionFilter);
  // Same part number and same price: nothing to decide, so it folds away.
  const isExactPair = (p: ReviewPair) => stage === 1 && Math.round(p.priceDelta) === 0;
  const exactPairs = visiblePairs.filter(isExactPair);
  const reviewPairs = visiblePairs.filter((p) => !isExactPair(p));
  const sectionCounts = (['parts', 'labour', 'paint'] as const)
    .map((s) => ({ s, n: derivedPairs.filter((p) => p.row.section === s).length }))
    .filter((x) => x.n > 0);

  // From-bill the uploaded document is the estimate, so lower is the worrying direction.
  const diffColour = (d: number) =>
    d < 0 ? (fromBill ? 'text-amber-700' : 'text-emerald-700') : fromBill ? 'text-muted-foreground' : 'text-amber-700';
  const diffTitle = (d: number) =>
    Math.round(d) === 0 ? `${fromBill ? 'Estimate' : 'Bill'} matches assessment`
      : d < 0 ? (fromBill ? 'Estimate is lower than assessed' : 'Bill is cheaper than assessed')
      : fromBill ? 'Estimate is higher than assessed' : 'Bill is higher than assessed';

  const renderRow = (pair: ReviewPair) => {
    const assessedAmt = pair.row.assessed || pair.row.estimated || 0;
    const delta = pair.priceDelta;
    const billPn = (pair.billItem.partNumber || '').trim();
    // Show the bill's part number only when it reads differently from the row's.
    const showBillPn = billPn && billPn.toLowerCase() !== (pair.row.partNumber || '').trim().toLowerCase();

    return (
      <tr key={pair.row.id} className="hover:bg-muted/40 transition-colors">
        <td className="py-2 pl-4 pr-2 align-top font-mono text-[11px] text-muted-foreground">{pair.row.srNo ?? '–'}</td>
        <td className="py-2 px-2 align-top">
          <div className="font-medium text-foreground leading-snug">{pair.row.particulars}</div>
          <div className="text-[11px] text-muted-foreground font-mono">
            {pair.row.partNumber}
            {pair.row.section !== 'parts' && <span className="font-sans capitalize ml-1">{pair.row.section}</span>}
          </div>
        </td>
        <td className="py-2 px-2 align-top">
          <div className="text-foreground leading-snug">
            <span className="text-[11px] text-muted-foreground mr-1.5">#{pair.billItem.srNo ?? '–'}</span>
            {pair.billItem.description}
          </div>
          {showBillPn && <div className="text-[11px] text-muted-foreground font-mono">{billPn}</div>}
          {stage === 2 && <div className="text-[11px] text-muted-foreground">{pair.matchBadge.text}</div>}
        </td>
        <td className="py-2 px-2 align-top text-right tabular-nums text-muted-foreground">{formatInr(assessedAmt)}</td>
        <td className="py-2 px-2 align-top text-right tabular-nums text-foreground">{formatInr(pair.billItem.taxableAmount)}</td>
        <td
          className={`py-2 px-2 align-top text-right tabular-nums font-semibold ${
            Math.round(delta) === 0 ? 'text-muted-foreground font-normal' : diffColour(delta)
          }`}
          title={diffTitle(delta)}
        >
          {Math.round(delta) === 0 ? '—' : delta < 0 ? `−${formatInr(Math.abs(delta))}` : `+${formatInr(delta)}`}
        </td>
        <td className="py-2 pl-2 pr-4 align-top text-right whitespace-nowrap">
          {pair.isVerified && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 mr-2" title="Kept by surveyor">
              <ShieldCheck className="w-3.5 h-3.5" /> Kept
            </span>
          )}
          <button
            type="button"
            onClick={() => handleUnlink(pair)}
            aria-label={`Unlink match for ${pair.row.particulars}`}
            className="text-[11px] font-medium text-muted-foreground hover:text-rose-700 px-1.5 py-1 rounded cursor-pointer"
          >
            Unlink
          </button>
          {!fromBill && (
            <button
              type="button"
              onClick={() => handleNotBilled(pair.row.id)}
              aria-label={`Mark ${pair.row.particulars} not billed`}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-1.5 py-1 rounded cursor-pointer"
            >
              Not billed
            </button>
          )}
        </td>
      </tr>
    );
  };

  const tableHead = (
    <thead>
      <tr className="border-b border-border text-[11px] text-muted-foreground font-medium">
        <th className="py-2 pl-4 pr-2 w-10 font-medium">#</th>
        <th className="py-2 px-2 font-medium">Assessment</th>
        <th className="py-2 px-2 font-medium">{labels.doc}</th>
        <th className="py-2 px-2 text-right font-medium">Assessed</th>
        <th className="py-2 px-2 text-right font-medium">{labels.amount}</th>
        <th className="py-2 px-2 text-right font-medium">Difference</th>
        <th className="py-2 pl-2 pr-4" aria-label="Actions" />
      </tr>
    </thead>
  );

  const nextLabel = stage === 1 ? 'Stage 2' : 'Stage 3';

  return (
    <div
      role="region"
      aria-label={`Stage ${stage} Review: ${stage === 1 ? 'Part Numbers' : 'Name & Price'}`}
      className={`flex flex-col bg-card border border-border rounded-xl ${className}`}
    >
      {derivedPairs.length === 0 ? (
        <div className="p-10 text-center flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-foreground">No Stage {stage} Matches Found</p>
          <p className="text-xs text-muted-foreground max-w-md">
            {stage === 1
              ? 'No rows share a part number with the bill. Name and price matching comes next.'
              : 'No further name and price pairs. The AI step comes next.'}
          </p>
          <button
            type="button"
            onClick={handlePushUnmatched}
            className="min-h-[40px] px-4 rounded-lg bg-primary hover:bg-amber-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            Proceed to Stage {nextStageNum} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Slim toolbar: what needs a look, and a section filter */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-border">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{reviewPairs.length}</span> to review
              {stage === 1 && <> · {exactPairs.length} exact</>}
              {verifiedCount > 0 && <> · {verifiedCount} kept</>}
            </p>
            {sectionCounts.length > 1 && (
              <div className="flex items-center gap-1" role="group" aria-label="Filter by section">
                {[{ s: 'all' as const, n: derivedPairs.length }, ...sectionCounts].map(({ s, n }) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSectionFilter(s)}
                    aria-pressed={sectionFilter === s}
                    className={`text-[11px] px-2.5 py-1 rounded-full border cursor-pointer capitalize ${
                      sectionFilter === s
                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s} {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs" role="table">
              {tableHead}
              <tbody className="divide-y divide-border/60">{reviewPairs.map(renderRow)}</tbody>
            </table>
          </div>

          {exactPairs.length > 0 && (
            <details className="border-t border-border group">
              <summary className="px-4 py-2.5 text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 inline -mt-0.5 mr-1.5 text-emerald-600" />
                {exactPairs.length} exact {exactPairs.length === 1 ? 'match' : 'matches'} — same part number and price. Kept when you continue.
                <span className="ml-1 underline group-open:hidden">Show</span>
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs" role="table">
                  {tableHead}
                  <tbody className="divide-y divide-border/60">{exactPairs.map(renderRow)}</tbody>
                </table>
              </div>
            </details>
          )}

          {/* One action bar, pinned to the bottom of the scroll area */}
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 px-4 py-2.5 bg-card/95 backdrop-blur-xs border-t border-border rounded-b-xl">
            <button
              type="button"
              onClick={handlePushUnmatched}
              className="min-h-[40px] px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Skip to {nextLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirmStage}
              className="min-h-[40px] px-4 rounded-lg bg-primary hover:bg-amber-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Keep all {derivedPairs.length - verifiedCount > 0 ? derivedPairs.length - verifiedCount : ''} and go to {nextLabel}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
