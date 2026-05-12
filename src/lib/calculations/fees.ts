// ═══════════════════════════════════════════════════════════
// FEE BILL CALCULATOR
// Mirrors: calcFeeTotal() + buildFeeBillHTML() from
// Surveyor_V6_MASTER.html lines 2036-2044, 2396-2414
// ═══════════════════════════════════════════════════════════

import type { FeeBill } from '@/types';
import { calculateFeeGST } from './gst';

export interface FeeSummary {
  professionalFee: number;
  riFee: number;
  /** Effective travel total used in subTotal — equals travellingCharges + tollCharges when new fields populated, else fee.travelExpenses. */
  travelExpenses: number;
  /** distanceKm × ratePerKm (0 when only legacy travelExpenses is used). */
  travellingCharges: number;
  /** Toll charges (0 when only legacy travelExpenses is used). */
  tollCharges: number;
  distanceKm: number;
  ratePerKm: number;
  /** True when no new travel fields are populated but legacy fee.travelExpenses > 0. */
  isLegacyTravel: boolean;
  photographyCharges: number;
  postalCharges: number;
  haltageCharges: number;
  subTotal: number;
  gstAmount: number;
  grandTotal: number;
}

/**
 * Calculate fee bill summary.
 *
 * Travel is now itemised as:
 *   - travellingCharges = distanceKm × ratePerKm
 *   - tollCharges       = toll paid (with optional tollNote)
 *
 * When all new fields are zero but legacy `fee.travelExpenses` > 0, the legacy
 * amount is used as-is so older claims continue to total correctly.
 */
export function calculateFeeSummary(fee: FeeBill): FeeSummary {
  const distanceKm = fee.distanceKm || 0;
  const ratePerKm = fee.ratePerKm || 0;
  const tollCharges = fee.tollCharges || 0;
  const travellingCharges = distanceKm * ratePerKm;

  const hasNewTravel = distanceKm > 0 || ratePerKm > 0 || tollCharges > 0;
  const legacyTravel = fee.travelExpenses || 0;
  const isLegacyTravel = !hasNewTravel && legacyTravel > 0;
  const travelTotal = hasNewTravel ? travellingCharges + tollCharges : legacyTravel;

  const photographyCharges = fee.photosCount * fee.photoRate;
  const subTotal =
    fee.professionalFee +
    fee.riFee +
    travelTotal +
    photographyCharges +
    fee.postalCharges +
    fee.haltageCharges;

  const gstAmount = fee.includeGST ? calculateFeeGST(subTotal).totalGST : 0;
  const grandTotal = subTotal + gstAmount;

  return {
    professionalFee: fee.professionalFee,
    riFee: fee.riFee,
    travelExpenses: travelTotal,
    travellingCharges: hasNewTravel ? travellingCharges : 0,
    tollCharges: hasNewTravel ? tollCharges : 0,
    distanceKm,
    ratePerKm,
    isLegacyTravel,
    photographyCharges,
    postalCharges: fee.postalCharges,
    haltageCharges: fee.haltageCharges,
    subTotal,
    gstAmount,
    grandTotal,
  };
}

/**
 * Get the fee bill line items (for rendering).
 * Filters out zero-amount items automatically.
 */
export function getFeeLineItems(
  fee: FeeBill,
  regNo: string = ''
): { label: string; amount: number }[] {
  const distanceKm = fee.distanceKm || 0;
  const ratePerKm = fee.ratePerKm || 0;
  const tollCharges = fee.tollCharges || 0;
  const tollNote = fee.tollNote || '';
  const travellingCharges = distanceKm * ratePerKm;
  const hasNewTravel = distanceKm > 0 || ratePerKm > 0 || tollCharges > 0;

  const travelLines: { label: string; amount: number }[] = hasNewTravel
    ? [
        { label: `Travelling Charges (${distanceKm} km × ₹${ratePerKm})`, amount: travellingCharges },
        { label: `Toll Charges${tollNote ? ' — ' + tollNote : ''}`, amount: tollCharges },
      ]
    : [{ label: `Travel Expenses — ${fee.travelNote || ''}`, amount: fee.travelExpenses }];

  const items = [
    { label: `Professional Survey Fee — ${regNo || 'Vehicle'}`, amount: fee.professionalFee },
    { label: 'RI Inspection Fee', amount: fee.riFee },
    ...travelLines,
    { label: `Photography Charges (${fee.photosCount} photos × ₹${fee.photoRate})`, amount: fee.photosCount * fee.photoRate },
    { label: 'Postal / Courier Charges', amount: fee.postalCharges },
    { label: 'Haltage Charges', amount: fee.haltageCharges },
  ];

  return items.filter((item) => item.amount > 0);
}
