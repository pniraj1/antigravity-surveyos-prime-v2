import type { ClaimData } from '@/types/claim';
import { computeRowNet } from './row-net';
import { rowDepRate } from './row-dep-rate';
import { getCompulsoryExcess } from './assessment';

export interface CashLossBasis {
  labour: number; // labour + paint, after paint-material dep, before GST
  towing: number;
  parts: { metal: number; plastic: number; glass: number; fiberglass: number };
  salvage: number; gross: number;
  percent: number | null; notional: number; excess: number; net: number;
}

const validPercent = (p: number | null | undefined): p is number =>
  typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 100;

/** Cash loss figures, all before GST. Null when cash loss is off. */
export function cashLossBasis(claim: ClaimData, ageMonths: number): CashLossBasis | null {
  if (!claim.cashLoss?.enabled) return null;
  let labour = 0;
  const parts = { metal: 0, plastic: 0, glass: 0, fiberglass: 0 };
  for (const r of claim.assessmentRows ?? []) {
    if (r.allowed === false || r.keptOpen) continue;
    const { netBeforeGst } = computeRowNet(r, rowDepRate(r, ageMonths, claim));
    if (r.section === 'labour' || r.section === 'paint') labour += netBeforeGst;
    else if (r.partType === 'metal' || r.partType === 'glass' || r.partType === 'fiberglass') parts[r.partType] += netBeforeGst;
    else parts.plastic += netBeforeGst;
  }
  const towing = parseFloat(String(claim.feeBill?.towingCharges || 0)) || 0;
  const salvage = claim.feeBill?.salvageValue ?? 0;
  const excess = (claim.feeBill?.voluntaryExcess ?? 0) + getCompulsoryExcess(claim.feeBill);
  const gross = labour + towing + parts.metal + parts.plastic + parts.glass + parts.fiberglass - salvage;
  const percent = validPercent(claim.cashLoss.notionalPercent) ? claim.cashLoss.notionalPercent : null;
  const notional = percent === null ? 0 : Math.max(0, Math.round(gross * percent) / 100);
  return { labour, towing, parts, salvage, gross, percent, notional, excess, net: Math.max(0, gross - notional - excess) };
}

/** Reasons Final printing must wait. Empty = may print. */
export function cashLossHold(claim: ClaimData): string[] {
  if (!claim.cashLoss?.enabled) return [];
  const out: string[] = [];
  if (!validPercent(claim.cashLoss.notionalPercent)) out.push('Enter the notional deduction % for cash loss');
  const ko = (claim.assessmentRows ?? []).filter((r) => r.keptOpen).map((r) => r.particulars);
  if (ko.length) out.push(`Decide these as allowed or not allowed: ${ko.join(', ')}`);
  return out;
}
