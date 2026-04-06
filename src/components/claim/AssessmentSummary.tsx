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
    fb.lessExcess
  );

  return (
    <Card className="border border-border shadow-sm sticky top-6 bg-white overflow-hidden">
      <CardHeader className="bg-zinc-50 border-b border-[#f0f0f0] pb-4">
        <CardTitle className="text-sm font-bold text-foreground uppercase tracking-widest">Financial Summary</CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="p-5 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Total Parts Assessed</span>
            <span className="font-bold text-foreground">{formatCurrency(summary.partsBase)}</span>
          </div>
          
          <Separator className="bg-[#f0f0f0]" />
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Total Labour Assessed</span>
            <span className="font-bold text-foreground">{formatCurrency(summary.labourBase)}</span>
          </div>
          
          <Separator className="bg-[#f0f0f0]" />
          
          <div className="flex justify-between items-center text-sm font-semibold text-foreground">
            <span>Net Assessment before GST</span>
            <span>{formatCurrency(summary.partsBase + summary.labourBase)}</span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Total GST Additions</span>
            <span className="font-bold text-foreground">{formatCurrency(summary.partsCGST + summary.partsSGST + summary.labourGST)}</span>
          </div>
        </div>

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
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="policy-excess" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Policy Excess (₹)</Label>
            </div>
            <Input
              id="policy-excess"
              type="number"
              value={fb.lessExcess || ''}
              onChange={(e) => updateFeeBill({ lessExcess: parseFloat(e.target.value) || 0 })}
              className="text-right font-bold text-red-600 bg-white border-[#e5e5e5] hover:border-red-600 focus:border-red-600 focus:ring-1 focus:ring-red-600/20 shadow-sm transition-all h-9"
              placeholder="1000.00"
              min="0"
            />
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
