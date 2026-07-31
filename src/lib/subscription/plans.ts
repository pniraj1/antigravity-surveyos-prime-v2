/**
 * Subscription plans — single source of truth for what a surveyor can buy.
 *
 * The payment form renders whatever is in PLANS, so adding quarterly/yearly
 * later is: add a line here, redeploy. Amounts are what the surveyor actually
 * transfers by UPI (no gateway, no tax added on top — see /terms).
 */

export interface Plan {
  id: string;
  label: string;
  months: number;
  amount: number;
  /** Short savings note shown under the label, e.g. "2 months free". */
  note?: string;
}

/**
 * Where surveyors send money. ponytail: interim personal VPA — replace with
 * the merchant handle once the current account exists. Referenced by the
 * renewal screen, the Profile renew card, and nowhere else.
 */
export const UPI_ID = '9822312204@upi';

export const PLANS: Plan[] = [
  { id: 'monthly', label: 'Monthly', months: 1, amount: 799 },
  // ponytail: quarterly/yearly staged pending pricing approval —
  // { id: 'quarterly', label: '3 Months', months: 3, amount: 2199, note: 'save ₹198' },
  // { id: 'yearly',    label: '12 Months', months: 12, amount: 7990, note: '2 months free' },
];
