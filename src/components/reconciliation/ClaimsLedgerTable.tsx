'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  Check,
  Filter,
  FileText,
  Building,
  Car,
} from 'lucide-react';

export interface LedgerClaimItem {
  id: string;
  vehicleNo?: string;
  label?: string;
  claimNo?: string;
  insurerName?: string;
  insuredName?: string;
  reportNo?: string;
  surveyDate?: string;
  billDate?: string;
  updatedAt?: string;
  feePaid: boolean;
  feeTotal: number;
  paymentStatus?: 'unpaid' | 'paid' | 'partial';
  amountReceived?: number;
  tdsDeducted?: number;
  utrNumber?: string;
  paymentDate?: string;
}

export interface ClaimsLedgerTableProps {
  claims: LedgerClaimItem[];
  onTogglePaid: (claimId: string, currentPaid: boolean) => Promise<void> | void;
  onSelectClaim?: (claimId: string) => void;
}

type FilterTab = 'all' | 'unpaid' | 'paid';

function formatINR(val?: number): string {
  return (val || 0).toLocaleString('en-IN');
}

/**
 * Computes elapsed days since billDate / surveyDate / updatedAt.
 */
function computeAgeing(claim: LedgerClaimItem): { days: number; isOverdue: boolean; label: string } {
  const dateStr = claim.billDate || claim.surveyDate || claim.updatedAt;
  if (!dateStr) {
    return { days: 0, isOverdue: false, label: '—' };
  }

  const billTime = new Date(dateStr).getTime();
  if (isNaN(billTime)) {
    return { days: 0, isOverdue: false, label: '—' };
  }

  const days = Math.max(0, Math.floor((Date.now() - billTime) / (1000 * 60 * 60 * 24)));
  const isOverdue = !claim.feePaid && days > 30;

  let label: string;
  if (claim.feePaid) {
    label = `${days}d settled`;
  } else if (isOverdue) {
    label = `⚠️ ${days}d overdue`;
  } else {
    label = `${days}d pending`;
  }

  return { days, isOverdue, label };
}

export function ClaimsLedgerTable({
  claims,
  onTogglePaid,
  onSelectClaim,
}: ClaimsLedgerTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      // Tab filter
      if (filterTab === 'unpaid' && claim.feePaid) return false;
      if (filterTab === 'paid' && !claim.feePaid) return false;

      // Search query filter (matches vehicle, claim no, insurer, report no, insured name)
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const v = (claim.vehicleNo || claim.label || '').toLowerCase();
        const c = (claim.claimNo || '').toLowerCase();
        const ins = (claim.insurerName || '').toLowerCase();
        const r = (claim.reportNo || '').toLowerCase();
        const name = (claim.insuredName || '').toLowerCase();
        const utr = (claim.utrNumber || '').toLowerCase();

        if (
          !v.includes(q) &&
          !c.includes(q) &&
          !ins.includes(q) &&
          !r.includes(q) &&
          !name.includes(q) &&
          !utr.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [claims, filterTab, searchQuery]);

  const handleToggle = async (claimId: string, currentPaid: boolean) => {
    setTogglingId(claimId);
    try {
      await onTogglePaid(claimId, currentPaid);
    } finally {
      setTogglingId(null);
    }
  };

  const counts = useMemo(() => {
    let paid = 0;
    let unpaid = 0;
    for (const c of claims) {
      if (c.feePaid) paid++;
      else unpaid++;
    }
    return { all: claims.length, paid, unpaid };
  }, [claims]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
      {/* Top Controls: Search and Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span>Claims Fee Ledger</span>
            <span className="text-xs font-normal text-muted-foreground">
              ({filteredClaims.length} of {claims.length})
            </span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Complete register of surveyor fees, billing dates, ageing, and reconciliation statuses
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search vehicle, claim, insurer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs bg-white border border-border rounded-lg pl-8 pr-3 py-1.5 w-52 sm:w-64 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>

          {/* Filter Tabs */}
          <div className="inline-flex items-center rounded-lg bg-neutral-100 p-1 border border-border text-xs">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterTab === 'all'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-foreground'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('unpaid')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterTab === 'unpaid'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-foreground'
              }`}
            >
              Unpaid ({counts.unpaid})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('paid')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterTab === 'paid'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-foreground'
              }`}
            >
              Paid ({counts.paid})
            </button>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-50 text-neutral-600 border-b border-border">
              <th className="py-2.5 px-3 font-medium">Status</th>
              <th className="py-2.5 px-3 font-medium">Vehicle Reg No</th>
              <th className="py-2.5 px-3 font-medium">Claim No &amp; Insurer</th>
              <th className="py-2.5 px-3 font-medium">Bill Date &amp; Ageing</th>
              <th className="py-2.5 px-3 font-medium text-right">Billed Amount</th>
              <th className="py-2.5 px-3 font-medium text-right">Received</th>
              <th className="py-2.5 px-3 font-medium text-right">TDS</th>
              <th className="py-2.5 px-3 font-medium">UTR / Ref</th>
              <th className="py-2.5 px-3 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredClaims.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
                  No claims found matching the filter criteria.
                </td>
              </tr>
            ) : (
              filteredClaims.map((claim) => {
                const ageing = computeAgeing(claim);
                const isPaid = claim.feePaid;
                const billedAmount = claim.feeTotal || 0;
                const receivedAmount =
                  claim.amountReceived !== undefined
                    ? claim.amountReceived
                    : isPaid
                    ? billedAmount
                    : 0;

                return (
                  <tr
                    key={claim.id}
                    className="hover:bg-neutral-50/80 transition-colors"
                  >
                    {/* Status Pill */}
                    <td className="py-3 px-3">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" />
                          <span>Paid</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          <span>Unpaid</span>
                        </span>
                      )}
                    </td>

                    {/* Vehicle Reg No */}
                    <td className="py-3 px-3">
                      <div
                        onClick={() => onSelectClaim?.(claim.id)}
                        className={`font-semibold text-foreground ${
                          onSelectClaim ? 'cursor-pointer hover:text-amber-500' : ''
                        }`}
                      >
                        {claim.vehicleNo || claim.label || '—'}
                      </div>
                      {claim.reportNo && (
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {claim.reportNo}
                        </div>
                      )}
                    </td>

                    {/* Claim No & Insurer */}
                    <td className="py-3 px-3">
                      <div className="font-mono text-[11px] text-foreground">
                        {claim.claimNo || '—'}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                        {claim.insurerName || '—'}
                      </div>
                    </td>

                    {/* Bill Date & Ageing */}
                    <td className="py-3 px-3">
                      <div className="text-foreground">
                        {claim.billDate || claim.surveyDate || '—'}
                      </div>
                      <div
                        className={`text-[11px] font-medium ${
                          ageing.isOverdue
                            ? 'text-red-600'
                            : isPaid
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {ageing.label}
                      </div>
                    </td>

                    {/* Billed Amount */}
                    <td className="py-3 px-3 text-right font-medium text-foreground">
                      ₹{formatINR(billedAmount)}
                    </td>

                    {/* Received Amount */}
                    <td className="py-3 px-3 text-right">
                      {isPaid || receivedAmount > 0 ? (
                        <span className="font-semibold text-emerald-700">
                          ₹{formatINR(receivedAmount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* TDS */}
                    <td className="py-3 px-3 text-right">
                      {claim.tdsDeducted && claim.tdsDeducted > 0 ? (
                        <span className="text-blue-700 font-medium">₹{formatINR(claim.tdsDeducted)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* UTR */}
                    <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">
                      {claim.utrNumber || '—'}
                    </td>

                    {/* Quick Toggle Action */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggle(claim.id, isPaid)}
                        disabled={togglingId === claim.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                          isPaid
                            ? 'border border-border bg-white text-neutral-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-500 hover:text-white'
                        }`}
                        title={isPaid ? 'Revert to Unpaid' : 'Mark as Paid'}
                      >
                        {isPaid ? (
                          <>
                            <RotateCcw className="w-3 h-3" />
                            <span>Mark Unpaid</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Mark Paid</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
