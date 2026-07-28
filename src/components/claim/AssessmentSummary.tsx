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

  // Per-material Parts breakdown (hide materials with nothing on either side)
  const partSubtypes = [
    { label: 'Metal', est: summary.estimateMetalBase, assessed: summary.metalTotal },
    { label: 'Plastic / Rubber', est: summary.estimatePlasticBase, assessed: summary.plasticTotal },
    { label: 'Glass', est: summary.estimateGlassBase, assessed: summary.glassTotal },
    { label: 'Fibreglass', est: summary.estimateFiberglassBase, assessed: summary.fiberglassTotal },
  ].filter((s) => s.est > 0 || s.assessed > 0);

  // Suggested salvage: 5–10% of allowed metal-parts estimate. Surveyor edits/rounds.
  const salvageLow = Math.round(summary.estimateMetalBase * 0.05);
  const salvageHigh = Math.round(summary.estimateMetalBase * 0.10);

  return (
    <Card className="border border-border shadow-sm sticky top-6 bg-white overflow-hidden">
      <CardHeader className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)] pb-4">
        <CardTitle className="text-sm font-medium text-foreground uppercase tracking-widest">Financial summary</CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* ─── Estimated vs Assessed Comparison Table ─────────────────────── */}
        <div className="p-5">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-3">Estimate vs assessment comparison</div>
          <div className="border border-[var(--color-neutral-200)] rounded-lg overflow-hidden text-xs">
            {/* Header */}
            <div className="grid grid-cols-3 bg-[var(--color-neutral-100)] border-b border-[var(--color-neutral-200)]">
              <div className="p-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Particulars</div>
              <div className="p-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-[10px] border-l border-[var(--color-neutral-200)]">Estimated</div>
              <div className="p-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-[10px] border-l border-[var(--color-neutral-200)]">Assessed</div>
            </div>

            {/* Sub Total: Parts (Taxable) */}
            <div className="grid grid-cols-3 border-b border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)] transition-colors">
              <div className="p-2.5 font-medium text-foreground">Sub total: Parts</div>
              <div className="p-2.5 text-right font-medium text-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.estimatePartsBase)}</div>
              <div className="p-2.5 text-right font-medium text-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.partsBase)}</div>
            </div>

            {/* Per-material subtypes under Parts */}
            {partSubtypes.map((s) => (
              <div key={s.label} className="grid grid-cols-3 border-b border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)] transition-colors">
                <div className="p-2.5 text-muted-foreground pl-5">↳ {s.label}</div>
                <div className="p-2.5 text-right text-muted-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(s.est)}</div>
                <div className="p-2.5 text-right text-muted-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(s.assessed)}</div>
              </div>
            ))}

            {/* Tax on Parts */}
            <div className="grid grid-cols-3 border-b border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)] transition-colors">
              <div className="p-2.5 text-muted-foreground pl-5">↳ CGST on parts</div>
              <div className="p-2.5 text-right text-muted-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.estimatePartsGST / 2)}</div>
              <div className="p-2.5 text-right text-muted-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.partsCGST)}</div>
            </div>
            <div className="grid grid-cols-3 border-b border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)] transition-colors">
              <div className="p-2.5 text-muted-foreground pl-5">↳ SGST on parts</div>
              <div className="p-2.5 text-right text-muted-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.estimatePartsGST / 2)}</div>
              <div className="p-2.5 text-right text-muted-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.partsSGST)}</div>
            </div>
            <div className="grid grid-cols-3 border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] hover:bg-[var(--color-neutral-100)] transition-colors">
              <div className="p-2.5 font-medium text-foreground">Total tax on parts</div>
              <div className="p-2.5 text-right font-medium text-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.estimatePartsGST)}</div>
              <div className="p-2.5 text-right font-medium text-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.partsCGST + summary.partsSGST)}</div>
            </div>

            {/* Final Parts Invoice Amount */}
            <div className="grid grid-cols-3 border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] hover:bg-[var(--color-neutral-100)] transition-colors">
              <div className="p-2.5 font-medium text-foreground">Final parts invoice amt</div>
              <div className="p-2.5 text-right font-medium text-[var(--color-neutral-900)] border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.estimatePartsTotal)}</div>
              <div className="p-2.5 text-right font-medium text-[var(--color-neutral-900)] border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.partsTotal)}</div>
            </div>

            {/* Sub Total: Labour (Taxable) */}
            <div className="grid grid-cols-3 border-b border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)] transition-colors">
              <div className="p-2.5 font-medium text-foreground">Sub total: Labour</div>
              <div className="p-2.5 text-right font-medium text-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.estimateLabourBase)}</div>
              <div className="p-2.5 text-right font-medium text-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.labourBase)}</div>
            </div>

            {/* Tax on Labour */}
            <div className="grid grid-cols-3 border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] hover:bg-[var(--color-neutral-100)] transition-colors">
              <div className="p-2.5 font-medium text-foreground">Total tax on labour</div>
              <div className="p-2.5 text-right font-medium text-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.estimateLabourGST)}</div>
              <div className="p-2.5 text-right font-medium text-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.labourGST)}</div>
            </div>

            {/* Final Labour Invoice Amount */}
            <div className="grid grid-cols-3 border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] hover:bg-[var(--color-neutral-100)] transition-colors">
              <div className="p-2.5 font-medium text-foreground">Final labour invoice amt</div>
              <div className="p-2.5 text-right font-medium text-[var(--color-neutral-900)] border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.estimateLabourTotal)}</div>
              <div className="p-2.5 text-right font-medium text-[var(--color-neutral-900)] border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.labourTotal)}</div>
            </div>

            {/* Total Tax */}
            <div className="grid grid-cols-3 border-b border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)] transition-colors">
              <div className="p-2.5 font-medium text-foreground">Total tax (GST)</div>
              <div className="p-2.5 text-right font-medium text-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.estimatePartsGST + summary.estimateLabourGST)}</div>
              <div className="p-2.5 text-right font-medium text-foreground border-l border-[var(--color-neutral-200)]">{formatCurrency(summary.partsCGST + summary.partsSGST + summary.labourGST)}</div>
            </div>

            {/* Gross Amount */}
            <div className="grid grid-cols-3 bg-[var(--color-neutral-900)] text-white">
              <div className="p-3 font-medium uppercase tracking-wider text-[11px]">GROSS AMOUNT</div>
              <div className="p-3 text-right font-medium text-[13px] border-l border-[var(--color-neutral-600)]">{formatCurrency(summary.estimateGrossTotal)}</div>
              <div className="p-3 text-right font-medium text-[13px] border-l border-[var(--color-neutral-600)]">{formatCurrency(summary.grandTotal)}</div>
            </div>
          </div>

          {/* Variance indicator */}
          {summary.estimateGrossTotal > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Variance (Est − Assessed)</span>
              <span className={`font-medium ${summary.estimateGrossTotal - summary.grandTotal > 0 ? 'text-[var(--color-status-success)]' : summary.estimateGrossTotal - summary.grandTotal < 0 ? 'text-[var(--color-status-danger)]' : 'text-foreground'}`}>
                {summary.estimateGrossTotal - summary.grandTotal > 0 ? '↓ ' : summary.estimateGrossTotal - summary.grandTotal < 0 ? '↑ ' : ''}
                {formatCurrency(Math.abs(summary.estimateGrossTotal - summary.grandTotal))}
              </span>
            </div>
          )}
        </div>

        <Separator className="bg-[var(--color-neutral-200)]" />

        <div className="bg-[var(--color-neutral-50)] p-5 border-y border-[var(--color-neutral-200)] space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="salvage-value" className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Salvage value (₹)</Label>
            </div>
            <Input
              id="salvage-value"
              type="number"
              value={fb.salvageValue || ''}
              onChange={(e) => updateFeeBill({ salvageValue: parseFloat(e.target.value) || 0 })}
              className="text-right font-medium text-[var(--color-status-danger)] bg-white border-[var(--color-neutral-200)] hover:border-[var(--color-status-danger)] focus:border-[var(--color-status-danger)] focus:ring-1 focus:ring-[var(--color-status-danger-tint)] shadow-sm transition-all h-9"
              placeholder="0.00"
              min="0"
            />
            {summary.estimateMetalBase > 0 && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  Metal est {formatCurrency(summary.estimateMetalBase)} · suggest {formatCurrency(salvageLow)}–{formatCurrency(salvageHigh)}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => updateFeeBill({ salvageValue: salvageLow })}
                    className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-[var(--color-neutral-300)] bg-white text-muted-foreground hover:border-[var(--color-status-danger)] hover:text-[var(--color-status-danger)] transition-colors"
                    title={`Apply 5% of metal estimate (${formatCurrency(salvageLow)})`}
                  >
                    5%
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFeeBill({ salvageValue: salvageHigh })}
                    className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-[var(--color-neutral-300)] bg-white text-muted-foreground hover:border-[var(--color-status-danger)] hover:text-[var(--color-status-danger)] transition-colors"
                    title={`Apply 10% of metal estimate (${formatCurrency(salvageHigh)})`}
                  >
                    10%
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="compulsory-excess" className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Compulsory excess</Label>
              <Input
                id="compulsory-excess"
                type="number"
                value={fb.compulsoryExcess || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  updateFeeBill({ compulsoryExcess: val, lessExcess: val });
                }}
                className="text-right font-medium text-[var(--color-status-danger)] bg-white border-[var(--color-neutral-200)] hover:border-[var(--color-status-danger)] focus:border-[var(--color-status-danger)] transition-all h-9"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voluntary-excess" className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Voluntary excess</Label>
              <Input
                id="voluntary-excess"
                type="number"
                value={fb.voluntaryExcess || ''}
                onChange={(e) => updateFeeBill({ voluntaryExcess: parseFloat(e.target.value) || 0 })}
                className="text-right font-medium text-[var(--color-status-danger)] bg-white border-[var(--color-neutral-200)] hover:border-[var(--color-status-danger)] focus:border-[var(--color-status-danger)] transition-all h-9"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="p-6 bg-white relative">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--color-neutral-900)]"></div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[11px] font-medium text-foreground uppercase tracking-[0.2em] mb-1">TOTAL LIABILITY</div>
              <div className="text-[10px] font-medium text-muted-foreground">Net payable to insured</div>
            </div>
            <div className="text-3xl font-medium text-foreground tracking-tight tabular-nums relative -top-1">
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
