import type { FeeSchedule } from '@/lib/config/fee-schedule';

/** Parses an IDV that may be a formatted string ("₹5,00,000", "Rs.20,00,000/-") into a number. */
export function parseIdv(idv: string | number | null | undefined): number {
  if (typeof idv === 'number') return Number.isFinite(idv) ? idv : 0;
  if (!idv) return 0;
  // Drop digit grouping first, then take the first number. Stripping to [\d.]
  // instead would read the dot in the "Rs." prefix as a decimal point and turn
  // "Rs.20,00,000" into 0.2.
  const match = String(idv).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

/**
 * IISLA professional survey fee from the Estimate of Repairs.
 * Per the schedule note, when the estimate exceeds the IDV the fee is based on
 * the IDV instead. Returns 0 for a non-positive basis (no estimate yet → no auto-fill).
 */
export function computeProfessionalFee(estimate: number, idv: number, schedule: FeeSchedule): number {
  const basis = idv > 0 && estimate > idv ? idv : estimate;
  if (basis <= 0) return 0;

  const slabs = schedule.slabs;
  const slab = slabs.find((s) => s.upTo === null || basis <= s.upTo) ?? slabs[slabs.length - 1];

  let fee = slab.base + (slab.marginalRatePct / 100) * Math.max(0, basis - slab.marginalFrom);
  if (slab.maxFee !== null) fee = Math.min(fee, slab.maxFee);
  return Math.round(fee);
}
