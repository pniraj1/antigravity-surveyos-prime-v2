import type { AssessmentRow, AssessmentSection } from '@/types/assessment';

export interface Imt23SectionTotal {
  /** The insured's 50% share for this section, on the pre-depreciation assessed figure. */
  amount: number;
  /** Rows actually contributing to `amount` — printed as "N items". */
  count: number;
}

/**
 * The printed "Less endorsement 23" figure, per section.
 *
 * Computed on the pre-depreciation assessed amount, which is what the market
 * format prints and what makes the subtotal block reconcile whatever mix of
 * depreciation rates the bucket holds.
 *
 * A row contributes only when it carries money: disallowed rows were never a
 * liability, and a not-in-bill row arrives here already zeroed by the bill-check
 * projection. Callers render the line only when `amount > 0`, never merely
 * because a ticked row exists — otherwise a bill check with an unbilled IMT-23
 * part prints a zero-value deduction the sample reports do not have.
 */
export function imt23Totals(
  rows: AssessmentRow[],
): Record<AssessmentSection, Imt23SectionTotal> {
  const out: Record<AssessmentSection, Imt23SectionTotal> = {
    parts:  { amount: 0, count: 0 },
    labour: { amount: 0, count: 0 },
    paint:  { amount: 0, count: 0 },
  };
  for (const r of rows) {
    if (!r.imt23 || r.allowed === false || !r.assessed) continue;
    out[r.section].amount += r.assessed / 2;
    out[r.section].count += 1;
  }
  return out;
}

/**
 * The explanatory footnote printed beneath the assessment sheet whenever a claim
 * carries an IMT-23-tagged row. An insurer seeing a 50% deduction needs the
 * authority cited on the same page.
 *
 * Legal wording — the substance is reproduced exactly and must not be reworded.
 * `opening` names the marker the specific document format uses (bold suffix,
 * asterisk column, per-row line), since the three formats mark tagged rows
 * differently.
 */
export function imt23FootnoteText(opening: string): string {
  return `${opening} Lamps, tyres/tubes, mudguards, bonnet/side parts, bumpers, headlights and paintwork are excluded under a standard commercial vehicle package policy and are covered only by virtue of Endorsement IMT-23, under which the insured bears 50% of the assessed loss on each such item. Cover applies only where the vehicle is also damaged in the same incident. Theft of these items is excluded under all circumstances.`;
}
