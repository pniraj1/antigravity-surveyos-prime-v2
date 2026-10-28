'use client';

import React, { useMemo } from 'react';
import type { AssessmentRow } from '@/types';
import { formatCurrency } from '@/lib/calculations/utils';
import { X } from 'lucide-react';
import { parseEstimateLabel } from './EstimateViewSwitcher';

export interface EstimateTallyBannerProps {
  activeEstimateId: string | 'all';
  rows: AssessmentRow[];
  onResetView: () => void;
}

export function EstimateTallyBanner({
  activeEstimateId,
  rows,
  onResetView,
}: EstimateTallyBannerProps) {
  const activeRows = useMemo(() => {
    if (activeEstimateId === 'all') return rows;
    if (activeEstimateId === '__untagged__') return rows.filter((r) => !r.estimateId);
    return rows.filter((r) => r.estimateId === activeEstimateId);
  }, [rows, activeEstimateId]);

  const stats = useMemo(() => {
    let partsEstimated = 0;
    let labourEstimated = 0;
    let paintEstimated = 0;
    let totalTaxable = 0;
    let totalGst = 0;

    activeRows.forEach((r) => {
      const est = r.estimated || 0;
      totalTaxable += est;
      const gstRate = r.gst ?? 18;
      totalGst += (est * gstRate) / 100;

      if (r.section === 'parts') partsEstimated += est;
      else if (r.section === 'labour') labourEstimated += est;
      else if (r.section === 'paint') paintEstimated += est;
    });

    const grossEstimated = totalTaxable + totalGst;
    return {
      count: activeRows.length,
      partsEstimated,
      labourEstimated,
      paintEstimated,
      totalTaxable,
      totalGst,
      grossEstimated,
    };
  }, [activeRows]);

  if (activeEstimateId === 'all') return null;

  const label = activeEstimateId === '__untagged__' ? 'Manual / Other Items' : parseEstimateLabel(activeEstimateId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-primary/5 border-b border-primary/20 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-primary">
          Filtering: <span className="underline">{label}</span> ({stats.count} items)
        </span>
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground">
          Taxable Base: <strong className="text-foreground">{formatCurrency(stats.totalTaxable)}</strong>
        </span>
        <span className="text-muted-foreground">
          + Est. GST: <strong className="text-foreground">{formatCurrency(stats.totalGst)}</strong>
        </span>
        <span className="text-muted-foreground">
          = Est. Gross Total: <strong className="text-primary font-bold">{formatCurrency(stats.grossEstimated)}</strong>
        </span>
      </div>

      <button
        type="button"
        onClick={onResetView}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors"
      >
        <X size={13} />
        Clear filter (Show All)
      </button>
    </div>
  );
}
