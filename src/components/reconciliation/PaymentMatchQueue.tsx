'use client';

import React, { useState } from 'react';
import type { PaymentMatchResult, MatchConfidence } from '@/types/payment-reconciliation';
import {
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Car,
  FileText,
  Trash2,
  Check,
  ChevronDown,
  Loader2,
  Calendar,
  Hash,
} from 'lucide-react';

export interface ClaimOption {
  id: string;
  label?: string;
  vehicleNo?: string;
  claimNo?: string;
  reportNo?: string;
  feeTotal?: number;
  feePaid?: boolean;
}

export interface PaymentMatchQueueProps {
  matches: PaymentMatchResult[];
  claimsList: ClaimOption[];
  onConfirmSettle: (selectedMatches: PaymentMatchResult[]) => Promise<void> | void;
  onDismissMatch?: (matchId: string) => void;
  onClearQueue?: () => void;
  onAssignManualClaim?: (matchId: string, claimId: string) => void;
  isSettling?: boolean;
}

function formatINR(val?: number): string {
  return (val || 0).toLocaleString('en-IN');
}

export function PaymentMatchQueue({
  matches,
  claimsList,
  onConfirmSettle,
  onDismissMatch,
  onClearQueue,
  onAssignManualClaim,
  isSettling = false,
}: PaymentMatchQueueProps) {
  // Track selected IDs for bulk settle (defaults to all matched items)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set(matches.filter(m => m.status === 'matched').map(m => m.id));
  });

  const matchedItems = matches.filter(m => m.status === 'matched');
  const unmatchedItems = matches.filter(m => m.status === 'unmatched');

  // Candidate unpaid claims for manual assignment
  const unpaidCandidates = claimsList.filter(c => !c.feePaid);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === matchedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(matchedItems.map(m => m.id)));
    }
  };

  const handleSettle = () => {
    const toSettle = matchedItems.filter(m => selectedIds.has(m.id));
    if (toSettle.length > 0) {
      onConfirmSettle(toSettle);
    }
  };

  if (matches.length === 0) {
    return null;
  }

  const selectedCount = matchedItems.filter(m => selectedIds.has(m.id)).length;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-card p-5 space-y-4 shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-500">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>Payment Match Queue</span>
              <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                {matchedItems.length} Matched / {matches.length} Total
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Review verified advice remittances before applying to claim fee bills
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {matchedItems.length > 0 && (
            <button
              type="button"
              onClick={handleSettle}
              disabled={isSettling || selectedCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isSettling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Confirm &amp; Settle ({selectedCount})</span>
            </button>
          )}

          {onClearQueue && (
            <button
              type="button"
              onClick={onClearQueue}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-neutral-800 transition-colors"
              title="Clear all advice items in queue"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Queue</span>
            </button>
          )}
        </div>
      </div>

      {/* Matched Claims Section */}
      {matchedItems.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span className="font-medium text-foreground">Matched Remittances</span>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-amber-500 hover:underline cursor-pointer"
            >
              {selectedIds.size === matchedItems.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {matchedItems.map((item) => {
              const isChecked = selectedIds.has(item.id);
              const advice = item.adviceClaim;

              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3.5 transition-colors ${
                    isChecked
                      ? 'border-amber-500/40 bg-neutral-900/60'
                      : 'border-border bg-neutral-900/20'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(item.id)}
                        className="mt-1 rounded border-border text-amber-500 focus:ring-amber-500 h-4 w-4 bg-neutral-800 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {item.vehicleNo || advice.vehicleNumber || 'Unknown Vehicle'}
                          </span>
                          {/* Confidence Badge */}
                          {item.confidence === 'exact_claim_no' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                              <CheckCircle className="w-3 h-3" />
                              <span>Exact Claim No</span>
                            </span>
                          )}
                          {item.confidence === 'exact_vehicle_no' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-950/60 text-blue-400 border border-blue-800/40">
                              <Car className="w-3 h-3" />
                              <span>Exact Vehicle Reg</span>
                            </span>
                          )}
                          {item.confidence === 'manual' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-950/60 text-purple-400 border border-purple-800/40">
                              <span>Manually Assigned</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                          {item.insurerName && (
                            <span className="text-foreground/90 font-medium">
                              {item.insurerName}
                            </span>
                          )}
                          {advice.claimNumber && (
                            <span className="flex items-center gap-1 font-mono text-[11px]">
                              <FileText className="w-3 h-3" />
                              <span>Claim: {advice.claimNumber}</span>
                            </span>
                          )}
                          {item.utrNumber && (
                            <span className="flex items-center gap-1 font-mono text-[11px]">
                              <Hash className="w-3 h-3" />
                              <span>UTR: {item.utrNumber}</span>
                            </span>
                          )}
                          {item.paymentDate && (
                            <span className="flex items-center gap-1 text-[11px]">
                              <Calendar className="w-3 h-3" />
                              <span>{item.paymentDate}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Financial details & quick dismiss */}
                    <div className="flex items-center justify-between md:justify-end gap-4 pl-7 md:pl-0">
                      <div className="text-right">
                        <div className="text-sm font-bold text-foreground">
                          ₹{formatINR(advice.netPaid)}
                          <span className="text-[10px] font-normal text-muted-foreground ml-1">
                            Net
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Gross: ₹{formatINR(advice.grossFee)}
                          {advice.tdsAmount ? (
                            <span className="text-blue-400 ml-1">
                              (TDS: ₹{formatINR(advice.tdsAmount)})
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {onDismissMatch && (
                        <button
                          type="button"
                          onClick={() => onDismissMatch(item.id)}
                          className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-neutral-800 transition-colors"
                          title="Dismiss item from match queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unmatched Items Section */}
      {unmatchedItems.length > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Unmatched Items ({unmatchedItems.length}) — Manual Claim Assignment Required</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {unmatchedItems.map((item) => {
              const advice = item.adviceClaim;

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-neutral-700/60 bg-neutral-900/30 p-3 text-xs"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {advice.vehicleNumber || 'No Vehicle Specified'}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-neutral-800 text-muted-foreground font-mono">
                          Claim: {advice.claimNumber || 'None'}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          UTR: {item.utrNumber || '—'}
                        </span>
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {item.insurerName} • Net: ₹{formatINR(advice.netPaid)} (TDS: ₹
                        {formatINR(advice.tdsAmount)})
                      </div>
                    </div>

                    {/* Manual Assignment Selector */}
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Assign to claim"
                        className="text-xs bg-neutral-800 border border-border rounded px-2.5 py-1.5 text-foreground focus:outline-none focus:border-amber-500 max-w-xs"
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && onAssignManualClaim) {
                            onAssignManualClaim(item.id, val);
                          }
                        }}
                      >
                        <option value="" disabled>
                          Select claim to assign...
                        </option>
                        {unpaidCandidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.vehicleNo || c.label} — {c.claimNo ? `Claim: ${c.claimNo}` : ''} (₹
                            {formatINR(c.feeTotal)})
                          </option>
                        ))}
                      </select>

                      {onDismissMatch && (
                        <button
                          type="button"
                          onClick={() => onDismissMatch(item.id)}
                          className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-neutral-800 transition-colors"
                          title="Dismiss item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
