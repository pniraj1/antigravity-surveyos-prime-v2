import type { AssessmentSummary } from '@/types';
import type { AssessmentSection } from '@/types/assessment';

export interface SectionSubtotal {
  /** Assessed amount after depreciation, before GST. */
  base: number;
  gst: number;
  /** base + gst */
  total: number;
}

/**
 * Maps the assessment summary into per-section figures for the grid footers.
 *
 * Every number is read from the summary the engine already produced — nothing
 * is recomputed here. A local recomputation sitting beside the engine is what
 * let the report builders print two different answers on one page.
 */
export function sectionSubtotals(
  summary: AssessmentSummary
): Record<AssessmentSection, SectionSubtotal> {
  const of = (base: number, total: number): SectionSubtotal => ({
    base,
    gst: total - base,
    total,
  });

  return {
    parts: of(summary.partsBase, summary.partsTotal),
    labour: of(summary.labourOnlyBase, summary.labourOnlyTotal),
    paint: of(summary.paintOnlyBase, summary.paintOnlyTotal),
  };
}
