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
  travelExpenses: number;
  photographyCharges: number;
  postalCharges: number;
  haltageCharges: number;
  subTotal: number;
  gstAmount: number;
  grandTotal: number;
}

/**
 * Calculate fee bill summary.
 * Legacy: calcFeeTotal() — adds prof + ri + travel + (count * rate) + postal + haltage
 */
export function calculateFeeSummary(fee: FeeBill): FeeSummary {
  const photographyCharges = fee.photosCount * fee.photoRate;
  const subTotal =
    fee.professionalFee +
    fee.riFee +
    fee.travelExpenses +
    photographyCharges +
    fee.postalCharges +
    fee.haltageCharges;

  const gstAmount = fee.includeGST ? calculateFeeGST(subTotal).totalGST : 0;
  const grandTotal = subTotal + gstAmount;

  return {
    professionalFee: fee.professionalFee,
    riFee: fee.riFee,
    travelExpenses: fee.travelExpenses,
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
  const items = [
    { label: `Professional Survey Fee — ${regNo || 'Vehicle'}`, amount: fee.professionalFee },
    { label: 'RI Inspection Fee', amount: fee.riFee },
    { label: `Travel Expenses — ${fee.travelNote || ''}`, amount: fee.travelExpenses },
    { label: `Photography Charges (${fee.photosCount} photos × ₹${fee.photoRate})`, amount: fee.photosCount * fee.photoRate },
    { label: 'Postal / Courier Charges', amount: fee.postalCharges },
    { label: 'Haltage Charges', amount: fee.haltageCharges },
  ];

  return items.filter((item) => item.amount > 0);
}
