import type { AssessmentSummary } from '@/types';
import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

/**
 * Fixed order and printed titles, matching sections 8 and 9 of the report.
 *
 * Shared by the Assessment grid and the Bill Check grid. Both render only what
 * this lists, so a section missing here is a section missing from the screen.
 */
export const SECTION_ORDER: { section: AssessmentSection; title: string }[] = [
  { section: 'parts', title: 'Spare Parts' },
  { section: 'labour', title: 'Labour' },
  { section: 'paint', title: 'Painting' },
];

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

export interface BilledTotals {
  /** Taxable amount as it came off the estimate. */
  estimated: number;
  assessed: number;
  billedTaxable: number;
  billedAmount: number;
  /** Assessed value of items the workshop never claimed. */
  notInBill: number;
}

/**
 * Billed-side column totals for the Bill Check grid footers.
 *
 * Pass ALLOWED rows only — `sectionSubtotals` above reads a summary the engine
 * built from allowed rows alone, and a section printing an assessed figure and a
 * billed figure drawn from two different populations is the exact defect the
 * comment above warns about.
 *
 * The three optional money fields are summed with `|| 0`: they are genuinely
 * absent on rows persisted before those columns existed, and one bare `+` on an
 * undefined turns a whole column into NaN.
 */
export function billedTotals(rows: AssessmentRow[]): BilledTotals {
  return rows.reduce<BilledTotals>(
    (t, r) => ({
      estimated: t.estimated + (r.estimated || 0),
      assessed: t.assessed + (r.assessed || 0),
      billedTaxable: t.billedTaxable + (r.billedTaxable || 0),
      billedAmount: t.billedAmount + (r.billedAmount || 0),
      notInBill: t.notInBill + (r.billStatus === 'not-in-bill' ? r.assessed || 0 : 0),
    }),
    { estimated: 0, assessed: 0, billedTaxable: 0, billedAmount: 0, notInBill: 0 },
  );
}
