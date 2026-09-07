import type { AssessmentRow } from '@/types/assessment';
import { getDepreciationRate, paintMaterialRate, toDepreciationType } from './depreciation';

export interface PaintDepClaim {
  depreciationType?: string | null;
  applyPaintMaterialDep?: boolean;
  paintMaterialPercent?: number;
  paintMaterialDepPercent?: number;
}

/**
 * The depreciation rate for one row.
 *
 * The expression `r.depOverride !== undefined ? r.depOverride : getDepreciationRate(...)`
 * had eight copies across the engine, the two report builders and the grid.
 * Paint's GR-9 rate has to reach every one of them, so they now share this.
 *
 * Order matters: a surveyor's override always wins, including an explicit 0.
 */
export function rowDepRate(
  row: AssessmentRow,
  ageMonths: number,
  claim: PaintDepClaim,
): number {
  if (row.depOverride !== undefined) return row.depOverride;
  if (row.section === 'paint') return paintMaterialRate(claim);
  return getDepreciationRate(row.partType, ageMonths, toDepreciationType(claim.depreciationType));
}
