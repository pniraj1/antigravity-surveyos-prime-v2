'use client';

import { useClaimStore } from '@/stores/claim-store';
import { AssessmentGrid } from '@/components/claim/AssessmentGrid';
import { AssessmentSummary } from '@/components/claim/AssessmentSummary';
import { Label } from '@/components/ui/label';

export function AssessmentTab() {
  const { currentClaim, setDepreciationType } = useClaimStore();

  if (!currentClaim) return null;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Assessment</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Build the assessment grid. Calculations apply IMT-23 and GST automatically based on part types.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border">
          <Label htmlFor="dep-type" className="font-semibold text-sm">Policy Depreciation:</Label>
          <select
            id="dep-type"
            value={currentClaim.depreciationType}
            onChange={(e) => setDepreciationType(e.target.value as any)}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary font-bold text-primary"
          >
            <option value="standard">Standard (Age Based)</option>
            <option value="nil">Nil Depreciation</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Assessment Grid - Takes up 8 columns out of 12 on large screens */}
        <div className="lg:col-span-8 xl:col-span-9">
          <AssessmentGrid />
        </div>

        {/* Financial Summary - Takes up 4 columns out of 12 on large screens, sticks to top */}
        <div className="lg:col-span-4 xl:col-span-3">
          <AssessmentSummary />
        </div>
      </div>
    </div>
  );
}
