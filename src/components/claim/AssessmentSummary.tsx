'use client';

import { useClaimStore } from '@/stores/claim-store';
import { calculateAssessmentSummary } from '@/lib/calculations/assessment';
import { formatCurrency } from '@/lib/calculations/utils';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export function AssessmentSummary() {
  const { currentClaim, updateFeeBill } = useClaimStore();

  if (!currentClaim) return null;

  const ageMonths = getVehicleAgeMonths(
    currentClaim.vehicle.dateOfRegistration,
    currentClaim.vehicle.yearOfManufacture,
    currentClaim.accident.dateAndTime
  );

  // Real-time zero-state math execution
  const fb = currentClaim.feeBill;
  const summary = calculateAssessmentSummary(
    currentClaim.assessmentRows, 
    ageMonths, 
    currentClaim.depreciationType, 
    fb.salvageValue, 
    fb.compulsoryExcess,
    fb.voluntaryExcess
  );

  return (
    <Card className="border border-border shadow-sm sticky top-6 bg-white overflow-hidden">
      <CardHeader className="bg-zinc-50 border-b border-[#f0f0f0] pb-4">
        <CardTitle className="text-sm font-bold text-foreground uppercase tracking-widest">Financial Summary</CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* ─── Estimated vs Assessed Comparison Table ─────────────────────── */}
        <div className="p-5">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Estimate vs Assessment Comparison</div>
          <div className="border border-[#e5e5e5] rounded-lg overflow-hidden text-xs">
            {/* Header */}
            <div className="grid grid-cols-3 bg-zinc-100 border-b border-[#e5e5e5]">
              <div className="p-2.5 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Particulars</div>
              <div className="p-2.5 text-right font-bold text-muted-foreground uppercase tracking-wider text-[10px] border-l border-[#e5e5e5]">Estimated</div>
              <div className="p-2.5 text-right font-bold text-muted-foreground uppercase tracking-wider text-[10px] border-l border-[#e5e5e5]">Assessed</div>
            </div>

            {/* Sub Total: Parts (Taxable) */}
            <div className="grid grid-cols-3 border-b border-[#f0f0f0] hover:bg-zinc-50/50 transition-colors">
              <div className="p-2.5 font-medium text-foreground">Sub Total: Parts</div>
              <div className="p-2.5 text-right font-semibold text-foreground border-l border-[#f0f0f0]">{formatCurrency(summary.estimatePartsBase)}</div>
              <div className="p-2.5 text-right font-semibold text-foreground border-l border-[#f0f0f0]">{formatCurrency(summary.partsBase)}</div>
            </div>

            {/* Tax on Parts */}
            <div className="grid grid-cols-3 border-b border-[#f0f0f0] hover:bg-zinc-50/50 transition-colors">
              <div className="p-2.5 text-muted-foreground pl-5">↳ CGST on Parts</div>
              <div className="p-2.5 text-right text-muted-foreground border-l border-[#f0f0f0]">{formatCurrency(summary.estimatePartsGST / 2)}</div>
              <div className="p-2.5 text-right text-muted-foreground border-l border-[#f0f0f0]">{formatCurrency(summary.partsCGST)}</div>
            </div>
            <div className="grid grid-cols-3 border-b border-[#f0f0f0] hover:bg-zinc-50/50 transition-colors">
              <div className="p-2.5 text-muted-foreground pl-5">↳ SGST on Parts</div>
              <div className="p-2.5 text-right text-muted-foreground border-l border-[#f0f0f0]">{formatCurrency(summary.estimatePartsGST / 2)}</div>
              <div className="p-2.5 text-right text-muted-foreground border-l border-[#f0f0f0]">{formatCurrency(summary.partsSGST)}</div>
            </div>
            <div className="grid grid-cols-3 border-b border-[#e5e5e5] bg-zinc-50/30 hover:bg-zinc-50/50 transition-colors">
              <div className="p-2.5 font-semibold text-foreground">Total Tax on Parts</div>
              <div className="p-2.5 text-right font-semibold text-foreground border-l border-[#e5e5e5]">{formatCurrency(summary.estimatePartsGST)}</div>
              <div className="p-2.5 text-right font-semibold text-foreground border-l border-[#e5e5e5]">{formatCurrency(summary.partsCGST + summary.partsSGST)}</div>
            </div>

            {/* Final Parts Invoice Amount */}
            <div className="grid grid-cols-3 border-b border-[#e5e5e5] bg-blue-50/40 hover:bg-blue-50/60 transition-colors">
              <div className="p-2.5 font-bold text-foreground">Final Parts Invoice Amt</div>
              <div className="p-2.5 text-right font-bold text-blue-700 border-l border-[#e5e5e5]">{formatCurrency(summary.estimatePartsTotal)}</div>
              <div className="p-2.5 text-right font-bold text-blue-700 border-l border-[#e5e5e5]">{formatCurrency(summary.partsTotal)}</div>
            </div>

            {/* Sub Total: Labour (Taxable) */}
            <div className="grid grid-cols-3 border-b border-[#f0f0f0] hover:bg-zinc-50/50 transition-colors">
              <div className="p-2.5 font-medium text-foreground">Sub Total: Labour</div>
              <div className="p-2.5 text-right font-semibold text-foreground border-l border-[#f0f0f0]">{formatCurrency(summary.estimateLabourBase)}</div>
              <div className="p-2.5 text-right font-semibold text-foreground border-l border-[#f0f0f0]">{formatCurrency(summary.labourBase)}</div>
            </div>

            {/* Tax on Labour */}
            <div className="grid grid-cols-3 border-b border-[#e5e5e5] bg-zinc-50/30 hover:bg-zinc-50/50 transition-colors">
              <div className="p-2.5 font-semibold text-foreground">Total Tax on Labour</div>
              <div className="p-2.5 text-right font-semibold text-foreground border-l border-[#e5e5e5]">{formatCurrency(summary.estimateLabourGST)}</div>
              <div className="p-2.5 text-right font-semibold text-foreground border-l border-[#e5e5e5]">{formatCurrency(summary.labourGST)}</div>
            </div>

            {/* Final Labour Invoice Amount */}
            <div className="grid grid-cols-3 border-b border-[#e5e5e5] bg-blue-50/40 hover:bg-blue-50/60 transition-colors">
              <div className="p-2.5 font-bold text-foreground">Final Labour Invoice Amt</div>
              <div className="p-2.5 text-right font-bold text-blue-700 border-l border-[#e5e5e5]">{formatCurrency(summary.estimateLabourTotal)}</div>
              <div className="p-2.5 text-right font-bold text-blue-700 border-l border-[#e5e5e5]">{formatCurrency(summary.labourTotal)}</div>
            </div>

            {/* Total Tax */}
            <div className="grid grid-cols-3 border-b border-[#e5e5e5] hover:bg-zinc-50/50 transition-colors">
              <div className="p-2.5 font-semibold text-foreground">Total Tax (GST)</div>
              <div className="p-2.5 text-right font-semibold text-foreground border-l border-[#e5e5e5]">{formatCurrency(summary.estimatePartsGST + summary.estimateLabourGST)}</div>
              <div className="p-2.5 text-right font-semibold text-foreground border-l border-[#e5e5e5]">{formatCurrency(summary.partsCGST + summary.partsSGST + summary.labourGST)}</div>
            </div>

            {/* Gross Amount */}
            <div className="grid grid-cols-3 bg-zinc-900 text-white">
              <div className="p-3 font-bold uppercase tracking-wider text-[11px]">Gross Amount</div>
              <div className="p-3 text-right font-bold text-[13px] border-l border-zinc-700">{formatCurrency(summary.estimateGrossTotal)}</div>
              <div className="p-3 text-right font-bold text-[13px] border-l border-zinc-700">{formatCurrency(summary.grandTotal)}</div>
            </div>
          </div>

          {/* Variance indicator */}
          {summary.estimateGrossTotal > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Variance (Est − Assessed)</span>
              <span className={`font-bold ${summary.estimateGrossTotal - summary.grandTotal > 0 ? 'text-green-600' : summary.estimateGrossTotal - summary.grandTotal < 0 ? 'text-red-600' : 'text-foreground'}`}>
                {summary.estimateGrossTotal - summary.grandTotal > 0 ? '↓ ' : summary.estimateGrossTotal - summary.grandTotal < 0 ? '↑ ' : ''}
                {formatCurrency(Math.abs(summary.estimateGrossTotal - summary.grandTotal))}
              </span>
            </div>
          )}
        </div>

        <Separator className="bg-[#e5e5e5]" />

        <div className="bg-zinc-50/50 p-5 border-y border-[#f0f0f0] space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="salvage-value" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Salvage Value (₹)</Label>
            </div>
            <Input
              id="salvage-value"
              type="number"
              value={fb.salvageValue || ''}
              onChange={(e) => updateFeeBill({ salvageValue: parseFloat(e.target.value) || 0 })}
              className="text-right font-bold text-red-600 bg-white border-[#e5e5e5] hover:border-red-600 focus:border-red-600 focus:ring-1 focus:ring-red-600/20 shadow-sm transition-all h-9"
              placeholder="0.00"
              min="0"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="compulsory-excess" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Compulsory Excess</Label>
              <Input
                id="compulsory-excess"
                type="number"
                value={fb.compulsoryExcess || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  updateFeeBill({ compulsoryExcess: val, lessExcess: val });
                }}
                className="text-right font-bold text-red-600 bg-white border-[#e5e5e5] hover:border-red-600 focus:border-red-600 transition-all h-9"
                placeholder="1000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voluntary-excess" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Voluntary Excess</Label>
              <Input
                id="voluntary-excess"
                type="number"
                value={fb.voluntaryExcess || ''}
                onChange={(e) => updateFeeBill({ voluntaryExcess: parseFloat(e.target.value) || 0 })}
                className="text-right font-bold text-red-600 bg-white border-[#e5e5e5] hover:border-red-600 focus:border-red-600 transition-all h-9"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="p-6 bg-white relative">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-black"></div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[11px] font-extrabold text-foreground uppercase tracking-[0.2em] mb-1">Total Liability</div>
              <div className="text-[10px] font-medium text-muted-foreground">Net Payable to Insured</div>
            </div>
            <div className="text-3xl font-extrabold text-foreground tracking-tight tabular-nums relative -top-1">
              {formatCurrency(summary.netAssessedLoss)}
            </div>
          </div>
          
          <div className="mt-4 text-[10px] font-medium text-muted-foreground/70 text-right">
            {summary.netInWords}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
