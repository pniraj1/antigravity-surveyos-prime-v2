import type { AssessmentRow } from '@/types/assessment';
import type { MissingItem } from '@/types/claim';

export function keptOpenRows(rows: AssessmentRow[]): AssessmentRow[] {
  return rows.filter((r) => r.keptOpen);
}

/** K.O. amount per row: estimated + GST, no depreciation, disposal ignored. */
export function keptOpenTotal(rows: AssessmentRow[]): number {
  return keptOpenRows(rows).reduce((s, r) => s + r.estimated * (1 + (r.gst ?? 0) / 100), 0);
}

export interface CashComparison { gross: number; percent: number; notional: number; net: number }

export interface ComparisonInput {
  idv: number; excess: number;
  repairGrandInclGst: number; repairTowing: number; repairSalvage: number;
  keptOpen: number;
  cash?: CashComparison;
  tl: { salvageWithRC: number; salvageWithoutRC: number; towingExpenses: number; workshopRent: number; missingItems?: MissingItem[] };
}

export interface LiabilityComparison {
  repair: { grand: number; excess: number; salvage: number; towing: number; keptOpen: number; net: number };
  idv: number; excess: number; missing: number; addl: number;
  salvageWithRC: number; salvageWithoutRC: number;
  totalLoss: number; netWithRC: number; netWithoutRC: number;
  cash?: CashComparison;
}

export function liabilityComparison(i: ComparisonInput): LiabilityComparison {
  const { tl } = i;
  const missing = (tl.missingItems ?? []).reduce((s, m) => s + Math.max(0, m.amount || 0), 0);
  const base = Math.max(0, i.idv - i.excess - missing);
  const addl = tl.towingExpenses + tl.workshopRent;
  return {
    repair: {
      grand: i.repairGrandInclGst, excess: i.excess, salvage: i.repairSalvage, towing: i.repairTowing, keptOpen: i.keptOpen,
      net: Math.max(0, i.repairGrandInclGst + i.repairTowing - i.repairSalvage - i.excess) + i.keptOpen,
    },
    idv: i.idv, excess: i.excess, missing, addl,
    salvageWithRC: tl.salvageWithRC, salvageWithoutRC: tl.salvageWithoutRC,
    totalLoss: base + addl,
    netWithRC: Math.max(0, base - tl.salvageWithRC) + addl,
    netWithoutRC: Math.max(0, base - tl.salvageWithoutRC) + addl,
    cash: i.cash,
  };
}
