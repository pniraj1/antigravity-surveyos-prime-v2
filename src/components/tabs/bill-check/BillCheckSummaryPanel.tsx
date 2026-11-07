'use client';

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  ExternalLink,
  Receipt,
  Calculator,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SalvageInput } from '@/components/claim/SalvageInput';
import { numberToWords } from '@/lib/calculations/utils';
import type { BillCheckDetails } from '@/types/assessment';
import type { AssessmentSummary } from '@/types/assessment';

interface BcSummary {
  grandTotalAssessed: number;
  grandTotalBilled: number;
  notInBillTotal: number;
  netLiability: number;
  excess: number;
  salvage: number;
  towingCharges?: number;
}

interface Props {
  claimId?: string;
  bc: BillCheckDetails;
  onBillCheckChange: (updates: Partial<BillCheckDetails>) => void;
  summary: Partial<AssessmentSummary>;
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

  // Final net liability: use bcSummary if present, otherwise summary.netAssessedLoss
  const finalNetLiability = bcSummary.netLiability ?? summary?.netAssessedLoss ?? 0;

  // Per-material Parts breakdown (hide materials with 0 assessed)
  const partSubtypes = [
    { label: 'Metal', assessed: summary?.metalTotal },
    { label: 'Plastic / Rubber', assessed: summary?.plasticTotal },
    { label: 'Glass', assessed: summary?.glassTotal },
    { label: 'Fibreglass', assessed: summary?.fiberglassTotal },
  ].filter((s) => (s.assessed || 0) > 0);

  const partsTaxTotal = (summary?.partsCGST || 0) + (summary?.partsSGST || 0);
  const totalTaxGST = partsTaxTotal + (summary?.labourGST || 0);

  return (
    <Card className="border border-border shadow-sm sticky top-2 bg-card overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-muted/40 border-b border-border py-3 px-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-primary" />
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Financial Summary
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
          <div className="flex items-center justify-between mb-2">
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

        {/* ─── 2. Assessed Loss Calculation (Primary Engine) ─────── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calculator size={13} className="text-primary" /> Loss Assessment (Assessed)
            </span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Assessed Amount</span>
          </div>

          <div className="border border-border rounded-lg overflow-hidden text-xs">
            {/* Header */}
            <div className="grid grid-cols-2 bg-muted/40 border-b border-border p-2 font-medium text-[10px] uppercase text-muted-foreground">
              <span>Particulars</span>
              <span className="text-right">Amount (₹)</span>
            </div>

            {/* Sub Total: Parts */}
            <div className="grid grid-cols-2 p-2 border-b border-border/60 hover:bg-muted/10 transition-colors">
              <span className="font-medium text-foreground">Sub total: Parts (Taxable)</span>
              <span className="text-right font-medium text-foreground">{fmt(summary?.partsBase || 0)}</span>
            </div>

            {/* Material Subtypes */}
            {partSubtypes.map((s) => (
              <div key={s.label} className="grid grid-cols-2 p-1.5 pl-4 border-b border-border/40 hover:bg-muted/10 transition-colors text-[11px] text-muted-foreground">
                <span>↳ {s.label}</span>
                <span className="text-right font-mono">{fmt(s.assessed || 0)}</span>
              </div>
            ))}

            {/* Tax on Parts */}
            {partsTaxTotal > 0 && (
              <div className="grid grid-cols-2 p-1.5 pl-4 border-b border-border/40 hover:bg-muted/10 transition-colors text-[11px] text-muted-foreground">
                <span>↳ Tax on parts (CGST + SGST)</span>
                <span className="text-right font-mono">{fmt(partsTaxTotal)}</span>
              </div>
            )}

            {/* Final Parts Assessed Amount */}
            <div className="grid grid-cols-2 p-2 border-b border-border/60 bg-muted/20 font-medium text-foreground">
              <span>Final parts assessed amt</span>
              <span className="text-right">{fmt(summary?.partsTotal || 0)}</span>
            </div>

            {/* Sub Total: Labour */}
            <div className="grid grid-cols-2 p-2 border-b border-border/60 hover:bg-muted/10 transition-colors">
              <span className="font-medium text-foreground">Sub total: Labour (Taxable)</span>
              <span className="text-right font-medium text-foreground">{fmt(summary?.labourOnlyBase ?? summary?.labourBase ?? 0)}</span>
            </div>

            {/* Tax on Labour */}
            {(summary?.labourGST || 0) > 0 && (
              <div className="grid grid-cols-2 p-1.5 pl-4 border-b border-border/40 hover:bg-muted/10 transition-colors text-[11px] text-muted-foreground">
                <span>↳ Tax on labour (GST)</span>
                <span className="text-right font-mono">{fmt(summary?.labourGST || 0)}</span>
              </div>
            )}

            {/* Final Labour Assessed Amount */}
            <div className="grid grid-cols-2 p-2 border-b border-border/60 bg-muted/20 font-medium text-foreground">
              <span>Final labour assessed amt</span>
              <span className="text-right">{fmt(summary?.labourOnlyTotal ?? summary?.labourTotal ?? 0)}</span>
            </div>

            {/* Painting Charges (if present) */}
            {(summary?.paintOnlyTotal || 0) > 0 && (
              <div className="grid grid-cols-2 p-2 border-b border-border/60 hover:bg-muted/10 transition-colors font-medium text-foreground">
                <span>Painting charges (with GST)</span>
                <span className="text-right">{fmt(summary?.paintOnlyTotal || 0)}</span>
              </div>
            )}

            {/* Total GST */}
            {totalTaxGST > 0 && (
              <div className="grid grid-cols-2 p-2 border-b border-border/60 bg-muted/10 text-muted-foreground">
                <span>Total tax (GST)</span>
                <span className="text-right font-medium text-foreground">{fmt(totalTaxGST)}</span>
              </div>
            )}

            {/* Gross Assessed Loss */}
            <div className="grid grid-cols-2 p-2.5 bg-[var(--color-neutral-900)] text-white font-medium">
              <span className="uppercase tracking-wider text-[10px]">GROSS ASSESSED LOSS</span>
              <span className="text-right text-[12px] font-bold">
                {fmt(summary?.grandTotal ?? bcSummary.grandTotalAssessed ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* ─── 3. Deductions: Salvage & Excess ────────────────────── */}
        <div className="p-3 bg-muted/20 rounded-xl border border-border space-y-2.5">
          <SalvageInput
            id="bc-salvage-value"
            value={salvageValue}
            onChange={onSalvageChange}
            basis={salvageBasis}
            note={salvageNote}
          />

          <div className="flex justify-between items-center px-1 text-xs text-muted-foreground pt-1.5 border-t border-border/60">
            <span className="font-medium">Less: Policy Excess</span>
            <span className="font-semibold text-destructive">
              -{fmt(bcSummary.excess ?? summary?.excess ?? 0)}
            </span>
          </div>
        </div>

        {/* ─── 4. The Hero Anchor: NET FINAL LIABILITY ────────────── */}
        {((bcSummary.towingCharges ?? summary?.towingCharges ?? 0) > 0) && (
          <div className="flex justify-between items-center text-xs text-muted-foreground px-1 pb-1">
            <span>Includes Towing Charges</span>
            <span className="font-medium text-foreground">+ {fmt(bcSummary.towingCharges ?? summary?.towingCharges ?? 0)}</span>
          </div>
        )}
        <div className="p-4 rounded-xl border-2 border-primary/40 bg-primary/5 text-foreground space-y-1 shadow-sm">
          <div className="flex justify-between items-baseline">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                TOTAL LIABILITY
              </span>
              <span className="text-[10px] text-muted-foreground">
                Net payable under bill check
              </span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {fmt(finalNetLiability)}
            </span>
          </div>
          <div className="text-[10px] font-medium text-muted-foreground leading-tight pt-2 border-t border-primary/10 text-right">
            RUPEES {numberToWords(finalNetLiability).toUpperCase()} ONLY
          </div>
        </div>

        {/* ─── 5. Secondary: Audit & Invoice Reconciliation ───────── */}
        <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1.5 text-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Audit & Reconciliation
          </div>
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

          {notInBillTotal > 0 && (
            <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t border-border/40">
              <span className="flex items-center gap-1 text-destructive">
                <XCircle size={11} /> Items Not in Bill (Saving):
              </span>
              <span className="font-medium text-destructive">-{fmt(notInBillTotal)}</span>
            </div>
          )}

          {partialTotal > 0 && (
            <div className="flex justify-between items-center text-[11px] text-muted-foreground">
              <span>Capped Variance:</span>
              <span className="font-medium text-amber-600">-{fmt(partialTotal)}</span>
            </div>
          )}
        </div>

        {/* ─── 6. Action Link to Report Center ───────────────────── */}
        {onNavigateToReports && (
          <button
            type="button"
            onClick={onNavigateToReports}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm cursor-pointer"
          >
            <span>View & Print in Report Center</span>
            <ExternalLink size={13} />
          </button>
        )}
      </CardContent>
    </Card>
  );
}

