import type { AssessmentRow } from '@/types/assessment';

/**
 * The metal-parts figure a salvage suggestion is a percentage of.
 *
 * Allowed metal parts only, at their assessed amount before depreciation, with
 * each row's own GST — the amount the claim will actually carry for that part.
 * Salvage is scrap: what matters is the part that came off, which exists only
 * for parts the surveyor allowed.
 *
 * `amount` is the lens. Pass nothing for the Final Survey Report's basis; pass
 * `billCheckAssessed` for the Bill Check's, and the cap and the not-in-bill
 * rows fall out on their own.
 *
 * The `allowed` test cannot be replaced by `assessed === 0`: toggleRowAllowed
 * writes `assessed` only when switching a row on, so a rejected row keeps its
 * old figure sitting there.
 *
 * Disposal rows carry no GST, matching the engine everywhere else.
 *
 * IMT-23 is deliberately ignored here. Salvage is the scrap value of the
 * physical part that came off; the endorsement changes who pays for the new
 * one, not what the old one is worth. Reads r.assessed, never effectiveAssessed.
 */
export const salvageBasis = (
  rows: AssessmentRow[],
  amount: (r: AssessmentRow) => number = r => r.assessed,
) => rows.reduce((s, r) =>
  r.allowed && r.section === 'parts' && r.partType === 'metal'
    ? s + amount(r) * (r.isDisposal ? 1 : 1 + (r.gst ?? 18) / 100)
    : s, 0);
