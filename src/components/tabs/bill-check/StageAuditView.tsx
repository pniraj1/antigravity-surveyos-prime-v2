'use client';

import React, { useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  PiggyBank,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Grid,
  Plus,
  Trash2,
  Link as LinkIcon,
  Ban,
  FileText,
} from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { isFromBill } from '@/lib/reports/bill-check-mode';
import type { AssessmentRow, ExtraBillItem, BillItem } from '@/types/assessment';
import { segregateStage4Tally } from '@/lib/tally/stage4-tally-matrix';
import { reconcileInvoice } from '@/lib/reports/bill-check-flags';
import { toast } from 'sonner';

export interface StageAuditViewProps {
  rows?: AssessmentRow[];
  extraBillItems?: ExtraBillItem[];
  invoiceTotal?: number;
  onMarkSavings?: () => void;
  onPromoteExtra?: (extraId: string) => void;
  onLinkExtra?: (extraId: string, rowId: string) => void;
  onDiscardExtra?: (extraId: string) => void;
  onPrint?: (format: 'standard' | 'uiic') => void;
  onComplete?: () => void;
  className?: string;
}

function formatInr(val: number): string {
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

export function StageAuditView({
  rows: propRows,
  extraBillItems: propExtraBillItems,
  invoiceTotal: propInvoiceTotal,
  onMarkSavings,
  onPromoteExtra,
  onLinkExtra,
  onDiscardExtra,
  onPrint,
  onComplete,
  className = '',
}: StageAuditViewProps) {
  const currentClaim = useClaimStore((s) => s.currentClaim);
  const markRemainingAllowedAsNotInBill = useClaimStore((s) => s.markRemainingAllowedAsNotInBill);
  const promoteExtraBillItem = useClaimStore((s) => s.promoteExtraBillItem);
  const linkExtraBillItem = useClaimStore((s) => s.linkExtraBillItem);
  const deleteExtraBillItem = useClaimStore((s) => s.deleteExtraBillItem);
  const setStoreTallyStage = useClaimStore((s) => s.setTallyStage);

  const rows = propRows ?? currentClaim?.assessmentRows ?? [];
  const extraItems = propExtraBillItems ?? currentClaim?.extraBillItems ?? [];
  const invoiceTotal = propInvoiceTotal ?? currentClaim?.billCheck?.billTotal ?? 0;

  // Convert extra items to BillItem format for segregateStage4Tally
  const billLines: BillItem[] = useMemo(() => {
    return extraItems.map((e, idx) => ({
      idx,
      srNo: e.srNo ?? idx + 1,
      description: e.description,
      partNumber: e.partNumber || '',
      taxableAmount: e.taxableAmount,
      totalAmount: e.amount,
      gstPercent: e.gstPercent,
      section: (e.section === 'parts' || e.section === 'labour' || e.section === 'paint') ? e.section : 'parts',
      category: e.category,
      raw: e,
    }));
  }, [extraItems]);

  const matrix = useMemo(() => {
    return segregateStage4Tally(rows, billLines);
  }, [rows, billLines]);

  const reconciliation = useMemo(() => {
    return reconcileInvoice(rows, invoiceTotal);
  }, [rows, invoiceTotal]);

  // Savings only exist on normal claims; from-bill rows are all self-billed.
  const fromBill = isFromBill(currentClaim);
  const remainingAllowedUnmarked = fromBill
    ? []
    : rows.filter((r) => r.allowed && r.billedTaxable === undefined);
  // From-bill: bill rows no estimate line was linked to or priced for.
  const notInEstimate = fromBill
    ? rows.filter((r) => r.allowed && r.refSrNo == null && r.estimateAmount == null)
    : [];

  const handleMarkSavings = () => {
    if (onMarkSavings) {
      onMarkSavings();
    } else {
      markRemainingAllowedAsNotInBill();
    }
    toast.success('All remaining allowed items marked as Not In Bill (Savings).');
  };

  const handlePromote = (extraId: string) => {
    if (onPromoteExtra) {
      onPromoteExtra(extraId);
    } else {
      promoteExtraBillItem(extraId);
    }
    toast.success('Leftover bill item added to assessment as supplementary.');
  };

  const handleLink = (extraId: string, rowId: string) => {
    if (!rowId) return;
    if (onLinkExtra) {
      onLinkExtra(extraId, rowId);
    } else {
      linkExtraBillItem(extraId, rowId);
    }
    toast.success('Bill item linked to assessment row.');
  };

  const handleDiscard = (extraId: string) => {
    if (onDiscardExtra) {
      onDiscardExtra(extraId);
    } else {
      deleteExtraBillItem(extraId);
    }
    toast.info('Extra bill item discarded.');
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    } else {
      setStoreTallyStage('grid');
    }
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint('standard');
    } else {
      window.print();
    }
  };

  return (
    <div
      role="region"
      aria-label="Stage 4: Disallowed & Tally Matrix Audit"
      className={`flex flex-col gap-6 bg-card border border-border rounded-xl shadow-sm p-5 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldAlert className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>Stage 4: Disallowed &amp; Tally Audit</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60">
                Final Review
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Zero-liability audit for disallowed items, insurer savings confirmation, leftover bill items reconciliation, and invoice seal.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: Disallowed Items Billed by Workshop */}
      <section
        aria-labelledby="disallowed-billed-heading"
        className="flex flex-col gap-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 p-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-600 dark:text-red-400" aria-hidden="true" />
            <h3 id="disallowed-billed-heading" className="text-sm font-bold text-foreground">
              Disallowed Items Billed by Workshop
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200 border border-red-300">
              {matrix.disallowedBilled.length} {matrix.disallowedBilled.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <span className="text-xs font-semibold text-red-800 dark:text-red-300">
            Strict ₹0 Insurer Liability Enforced
          </span>
        </div>

        {matrix.disallowedBilled.length === 0 ? (
          <div className="py-4 px-3 bg-white/60 dark:bg-slate-900/40 border border-dashed border-red-200 dark:border-red-800 rounded-lg text-center text-xs text-muted-foreground">
            No disallowed items were billed by the workshop. Zero survey divergence.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-red-200/80 dark:border-red-900/50 bg-white dark:bg-slate-900/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-red-100/60 dark:bg-red-950/40 text-red-950 dark:text-red-200 border-b border-red-200/80 dark:border-red-900/60 font-semibold">
                  <th className="py-2.5 px-3">Item Particulars</th>
                  <th className="py-2.5 px-3">Workshop Claimed</th>
                  <th className="py-2.5 px-3">Insurer Liability</th>
                  <th className="py-2.5 px-3">Auto Audit Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100 dark:divide-red-900/30">
                {matrix.disallowedBilled.map((item, idx) => (
                  <tr key={item.row.id || idx} className="hover:bg-red-50/50 dark:hover:bg-red-950/30">
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      <div>{item.row.particulars}</div>
                      {item.row.partNumber && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {item.row.partNumber}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                      {formatInr(item.billedTaxable)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800">
                        ₹0 Liability
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground italic text-[11px]">
                      {item.remark}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 2: Insurer Savings */}
      <section
        aria-labelledby="insurer-savings-heading"
        className="flex flex-col gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div>
              <h3 id="insurer-savings-heading" className="text-sm font-bold text-foreground">
                {fromBill ? 'Billed Items Not in Estimate' : 'Insurer Savings (Allowed Items Not in Bill)'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fromBill ? 'Items on the bill that the estimate did not include.' : 'Items surveyed and approved in estimate that the workshop did not invoice.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!fromBill && (
            <div className="text-right">
              <span className="text-xs text-muted-foreground block uppercase tracking-wide">
                Total Saved
              </span>
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-400" data-testid="total-saved-amount">
                {formatInr(matrix.totalSaved)}
              </span>
            </div>
            )}

            {!fromBill && (
            <button
              type="button"
              onClick={handleMarkSavings}
              disabled={remainingAllowedUnmarked.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-emerald-900 dark:text-emerald-100 bg-emerald-200/80 hover:bg-emerald-300 dark:bg-emerald-800/80 dark:hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Mark All Remaining Allowed as Not in Bill (Saving)</span>
            </button>
            )}
          </div>
        </div>

        {fromBill ? (
          notInEstimate.length === 0 ? (
            <div className="py-4 px-3 bg-white/60 border border-dashed border-emerald-200 rounded-lg text-center text-xs text-muted-foreground">
              Every billed item was found in the estimate.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-emerald-200/80 bg-white max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-emerald-100/60 text-emerald-900 border-b border-emerald-200 font-semibold z-10">
                  <tr>
                    <th className="py-2.5 px-3">Item Particulars</th>
                    <th className="py-2.5 px-3">Part Number</th>
                    <th className="py-2.5 px-3">Billed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {notInEstimate.map((r) => (
                    <tr key={r.id} className="hover:bg-emerald-50/50">
                      <td className="py-2 px-3 font-medium text-foreground">{r.particulars}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">{r.partNumber || '—'}</td>
                      <td className="py-2 px-3 font-semibold text-foreground">{formatInr(r.billedTaxable ?? r.estimated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : matrix.savings.length === 0 ? (
          <div className="py-4 px-3 bg-white/60 dark:bg-slate-900/40 border border-dashed border-emerald-200 dark:border-emerald-800 rounded-lg text-center text-xs text-muted-foreground">
            No allowed items saved (all allowed items appeared in the bill).
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-emerald-200/80 dark:border-emerald-900/50 bg-white dark:bg-slate-900/80 max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-emerald-100/60 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border-b border-emerald-200 dark:border-emerald-800 font-semibold z-10">
                <tr>
                  <th className="py-2.5 px-3">Item Particulars</th>
                  <th className="py-2.5 px-3">Part Number</th>
                  <th className="py-2.5 px-3">Assessed Saving</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/30">
                {matrix.savings.map((s, idx) => (
                  <tr key={s.row.id || idx} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30">
                    <td className="py-2 px-3 font-medium text-foreground">{s.row.particulars}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                      {s.row.partNumber || '—'}
                    </td>
                    <td className="py-2 px-3 font-bold text-emerald-700 dark:text-emerald-400">
                      {formatInr(s.savedAmount)}
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Saved (Not in Bill)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 3: Extra Bill Items Tray (Amber) */}
      <section
        aria-labelledby="extra-items-heading"
        className="flex flex-col gap-3 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <h3 id="extra-items-heading" className="text-sm font-bold text-foreground">
              {fromBill ? 'Estimate Lines Not on the Bill' : 'Extra Bill Items (Leftover Invoice Lines)'}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300">
              {extraItems.length} {extraItems.length === 1 ? 'line' : 'lines'}
            </span>
          </div>
          <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
            {fromBill ? 'Estimate lines not matched to any billed item.' : 'Billed lines not matched to initial assessment'}
          </span>
        </div>

        {extraItems.length === 0 ? (
          <div className="py-4 px-3 bg-white/60 dark:bg-slate-900/40 border border-dashed border-amber-200 dark:border-amber-800 rounded-lg text-center text-xs text-muted-foreground">
            All invoice lines have been reconciled. Zero leftover lines.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {extraItems.map((extra) => (
              <div
                key={extra.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-lg shadow-2xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-foreground truncate">
                    {extra.description}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    {extra.partNumber && (
                      <span className="font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                        {extra.partNumber}
                      </span>
                    )}
                    <span>Taxable: {formatInr(extra.taxableAmount)}</span>
                    <span>Total: {formatInr(extra.amount)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Promote Button */}
                  <button
                    type="button"
                    onClick={() => handlePromote(extra.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-amber-900 dark:text-amber-100 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800 border border-amber-300 dark:border-amber-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>+ Add as Supplementary</span>
                  </button>

                  {/* Link Select Dropdown */}
                  <div className="relative inline-block">
                    <select
                      aria-label={`Link ${extra.description} to assessment row`}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleLink(extra.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="px-2.5 py-1 rounded text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 cursor-pointer transition-colors"
                    >
                      <option value="" disabled>
                        Link ▾
                      </option>
                      {rows.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.particulars} ({formatInr(r.assessed || r.estimated || 0)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Discard Button */}
                  <button
                    type="button"
                    onClick={() => handleDiscard(extra.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Discard</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 4: Final Reconciliation Seal */}
      <section
        aria-labelledby="seal-heading"
        className="flex flex-col gap-3 rounded-xl border border-border bg-slate-50/70 dark:bg-slate-900/50 p-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 id="seal-heading" className="text-sm font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>Final Reconciliation Seal</span>
          </h3>
          <div className="text-xs text-muted-foreground">
            Billed Invoice Total vs. Audited Line Total
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-white dark:bg-slate-800 border border-border rounded-lg text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Invoice Total
            </div>
            <div className="text-base font-bold text-foreground mt-0.5">
              {formatInr(reconciliation.invoiceTotal)}
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800 border border-border rounded-lg text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Audited Line Total
            </div>
            <div className="text-base font-bold text-foreground mt-0.5">
              {formatInr(reconciliation.lineTotal)}
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800 border border-border rounded-lg text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Variance / Gap
            </div>
            <div
              className={`text-base font-bold mt-0.5 ${
                reconciliation.reconciles ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              ₹{reconciliation.gap.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Seal Status Banner */}
        {reconciliation.reconciles ? (
          <div className="flex items-center gap-3 p-3.5 bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <div>
              <div className="text-sm font-bold">100% Reconciled — Audit Clean</div>
              <div className="text-xs text-emerald-800 dark:text-emerald-200">
                The total of all audited invoice lines matches the final workshop invoice perfectly (Gap: ₹0.00).
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3.5 bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <div>
              <div className="text-sm font-bold">
                Reconciliation Gap: ₹{reconciliation.gap.toFixed(2)}
              </div>
              <div className="text-xs text-amber-800 dark:text-amber-200">
                Audited lines total ₹{formatInr(reconciliation.lineTotal)} vs workshop invoice ₹{formatInr(reconciliation.invoiceTotal)}. Check for unpromoted extra lines or missing entries.
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Bottom Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors"
        >
          <Printer className="w-4 h-4" aria-hidden="true" />
          <span>🖨 Print Bill Check Report</span>
        </button>

        <button
          type="button"
          onClick={handleComplete}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-amber-600 active:bg-amber-700 shadow-xs transition-colors ml-auto cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          <span>Apply to Assessment Grid &amp; Finish</span>
        </button>
      </div>
    </div>
  );
}
