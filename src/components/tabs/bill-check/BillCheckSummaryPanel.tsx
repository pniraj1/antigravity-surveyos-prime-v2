'use client';

import React from 'react';
import {
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  ExternalLink,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SalvageInput } from '@/components/claim/SalvageInput';
import { numberToWords } from '@/lib/calculations/utils';
import type { BillCheckDetails } from '@/types/assessment';

interface AssessmentSummary {
  grandTotal: number;
  netAssessedLoss: number;
  partsTotal?: number;
  labourTotal?: number;
}

interface BcSummary {
  grandTotalAssessed: number;
  grandTotalBilled: number;
  notInBillTotal: number;
  netLiability: number;
  excess: number;
  salvage: number;
}

interface Props {
  bc: BillCheckDetails;
  onBillCheckChange: (updates: Partial<BillCheckDetails>) => void;
  summary: AssessmentSummary;
  bcSummary: BcSummary;
  inBillTotal: number;
  notInBillTotal: number;
  partialTotal: number;
  fmt: (n: number) => string;
  /** Bill-check salvage: the typed figure, or the rescaled one. */
  salvageValue: number;
  /** Allowed metal through the bill-check lens — what the band is struck on. */
  salvageBasis: number;
  salvageNote?: string;
  onSalvageChange: (value: number | undefined) => void;
  onNavigateToReports?: () => void;
}

export function BillCheckSummaryPanel({
  bc,
  onBillCheckChange,
  summary,
  bcSummary,
  inBillTotal,
  notInBillTotal,
  partialTotal,
  fmt,
  salvageValue,
  salvageBasis,
  salvageNote,
  onSalvageChange,
  onNavigateToReports,
}: Props) {
  const isVerified =
    Boolean(bc.billNo?.trim()) &&
    Boolean(bc.billDate?.trim()) &&
    Boolean(bc.billTotal && bc.billTotal > 0) &&
    bc.verifiedBySurveyor === true;

  const handleFieldChange = (updates: Partial<BillCheckDetails>) => {
    // Any change to billNo, billDate, or billTotal resets verifiedBySurveyor
    onBillCheckChange({
      ...updates,
      verifiedBySurveyor: false,
      verifiedAt: undefined,
    });
  };

  const handleToggleVerification = (checked: boolean) => {
    if (checked) {
      onBillCheckChange({
        verifiedBySurveyor: true,
        verifiedAt: new Date().toISOString(),
      });
    } else {
      onBillCheckChange({
        verifiedBySurveyor: false,
        verifiedAt: undefined,
      });
    }
  };

  const billTotalNum = bc.billTotal || 0;
  // Variance between workshop bill total and verified in-bill total
  const invoiceDiff = billTotalNum - inBillTotal;

  return (
    <Card className="border border-border shadow-sm sticky top-2 bg-card overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-muted/40 border-b border-border py-3 px-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-primary" />
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Bill Verification & Summary
          </CardTitle>
        </div>
        <div>
          {isVerified ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
              <CheckCircle2 size={11} /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/30">
              <AlertTriangle size={11} /> Unverified
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4 text-xs">
        {/* ─── 1. Workshop Invoice Details ───────────────────────── */}
        <div className={`p-3 rounded-xl border transition-colors ${isVerified ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/30 border-border'}`}>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <FileCheck2 size={12} className="text-primary" /> Workshop Invoice Details
            </span>
            {bc.verifiedAt && isVerified && (
              <span className="text-[9px] text-muted-foreground font-mono">
                {new Date(bc.verifiedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-[10px] text-muted-foreground font-medium mb-1 block">
                Bill / Invoice No.
              </Label>
              <Input
                value={bc.billNo || ''}
                onChange={(e) => handleFieldChange({ billNo: e.target.value })}
                placeholder="INV-001"
                className="h-7 text-xs font-medium bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground font-medium mb-1 block">
                  Bill Date
                </Label>
                <Input
                  type="date"
                  value={bc.billDate || ''}
                  onChange={(e) => handleFieldChange({ billDate: e.target.value })}
                  className="h-7 text-xs bg-background px-1.5"
                />
              </div>

              <div>
                <Label className="text-[10px] text-muted-foreground font-medium mb-1 block">
                  Bill Total (₹)
                </Label>
                <Input
                  type="number"
                  value={bc.billTotal || ''}
                  onChange={(e) => handleFieldChange({ billTotal: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="h-7 text-xs font-semibold text-right bg-background"
                />
              </div>
            </div>

            {/* Verification Checkbox */}
            <label className={`flex items-start gap-2 pt-2 mt-1 border-t border-border/60 cursor-pointer select-none ${isVerified ? 'text-emerald-800' : 'text-foreground'}`}>
              <input
                type="checkbox"
                checked={bc.verifiedBySurveyor === true}
                onChange={(e) => handleToggleVerification(e.target.checked)}
                className="mt-0.5 rounded border-input h-3.5 w-3.5 cursor-pointer accent-primary"
                disabled={!bc.billNo?.trim() || !bc.billDate?.trim() || !bc.billTotal}
              />
              <span className="text-[11px] leading-tight">
                {isVerified ? (
                  <span className="font-semibold text-emerald-700">Verified against workshop bill</span>
                ) : (
                  <span>Check box to confirm details match physical/PDF invoice</span>
                )}
              </span>
            </label>
          </div>
        </div>

        {/* ─── 2. Invoice Reconciliation Math ────────────────────── */}
        <div className="p-2.5 rounded-xl bg-muted/20 border border-border space-y-1.5 text-xs">
          <div className="flex justify-between items-center text-muted-foreground text-[11px]">
            <span>Workshop Invoice Total:</span>
            <span className="font-medium text-foreground">{fmt(billTotalNum)}</span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground text-[11px]">
            <span>Verified in Bill:</span>
            <span className="font-medium text-emerald-600">{fmt(inBillTotal)}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-border/60 font-medium text-[11px]">
            <span className="flex items-center gap-1">
              {Math.abs(invoiceDiff) < 1 ? 'Reconciled:' : 'Difference:'}
            </span>
            <span className={Math.abs(invoiceDiff) < 1 ? 'text-emerald-600' : 'text-amber-600 font-semibold'}>
              {invoiceDiff > 0 ? `+${fmt(invoiceDiff)}` : fmt(invoiceDiff)}
            </span>
          </div>
        </div>

        {/* ─── 3. Verification Metrics Table ─────────────────────── */}
        <div className="border border-border rounded-lg overflow-hidden text-xs">
          <div className="grid grid-cols-2 bg-muted/40 border-b border-border p-2 font-medium text-[10px] uppercase text-muted-foreground">
            <span>Particulars</span>
            <span className="text-right">Amount (₹)</span>
          </div>

          <div className="grid grid-cols-2 p-2 border-b border-border/60 hover:bg-muted/10 transition-colors">
            <span className="text-muted-foreground">Assessed (Allowed)</span>
            <span className="text-right font-medium text-foreground">{fmt(summary.grandTotal)}</span>
          </div>

          <div className="grid grid-cols-2 p-2 border-b border-border/60 hover:bg-muted/10 transition-colors">
            <span className="text-muted-foreground flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-600" /> In Bill
            </span>
            <span className="text-right font-medium text-emerald-600">{fmt(inBillTotal)}</span>
          </div>

          <div className="grid grid-cols-2 p-2 border-b border-border/60 hover:bg-muted/10 transition-colors">
            <span className="text-muted-foreground flex items-center gap-1">
              <XCircle size={12} className="text-destructive" /> Not in Bill (Saving)
            </span>
            <span className="text-right font-medium text-destructive">-{fmt(notInBillTotal)}</span>
          </div>

          {partialTotal > 0 && (
            <div className="grid grid-cols-2 p-2 border-b border-border/60 hover:bg-muted/10 transition-colors">
              <span className="text-muted-foreground">Capped Variance</span>
              <span className="text-right font-medium text-amber-600">-{fmt(partialTotal)}</span>
            </div>
          )}

          <div className="grid grid-cols-2 p-2 bg-muted/20 border-b border-border font-medium">
            <span className="text-foreground">Net Billed (After Dep)</span>
            <span className="text-right text-foreground">{fmt(bcSummary.grandTotalBilled)}</span>
          </div>
        </div>

        {/* ─── 4. Deductions: Salvage & Excess ────────────────────── */}
        <div className="space-y-2 pt-1">
          <div className="p-2.5 rounded-xl border border-border bg-muted/10">
            <SalvageInput
              id="bc-salvage-value"
              value={salvageValue}
              onChange={onSalvageChange}
              basis={salvageBasis}
              note={salvageNote}
            />
          </div>

          <div className="flex justify-between items-center px-2 py-1 text-xs text-muted-foreground">
            <span>Less: Policy Excess</span>
            <span className="font-medium text-foreground">-{fmt(bcSummary.excess || 0)}</span>
          </div>
        </div>

        {/* ─── 5. Final Net Liability Card ────────────────────────── */}
        <div className="p-3.5 rounded-xl border-2 border-primary/30 bg-primary/5 text-foreground space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Net Final Liability
            </span>
            <span className="text-xl font-bold text-foreground">
              {fmt(bcSummary.netLiability)}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground leading-tight pt-1 border-t border-primary/10">
            RUPEES {numberToWords(bcSummary.netLiability).toUpperCase()} ONLY
          </div>
        </div>

        {/* ─── 6. Action Link to Report Center ───────────────────── */}
        {onNavigateToReports && (
          <button
            type="button"
            onClick={onNavigateToReports}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <span>View & Print in Report Center</span>
            <ExternalLink size={13} />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
