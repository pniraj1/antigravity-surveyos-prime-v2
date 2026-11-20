import type {
  PaymentAdviceClaimItem,
  PaymentMatchResult,
  MatchConfidence,
} from '@/types/payment-reconciliation';

export interface ClaimReconciliationTarget {
  id: string;
  claimNo?: string;
  vehicleNo?: string;
  feeTotal?: number;
  reportNo?: string;
  feePaid?: boolean;
}

/**
 * Normalizes claim numbers by stripping special characters (slashes, hyphens, spaces, etc.)
 * and converting to uppercase alphanumeric string.
 */
export function normalizeClaimNumber(val?: string | null): string {
  if (!val) return '';
  return val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Normalizes vehicle registration numbers to uppercase alphanumeric characters without spaces or hyphens.
 */
export function normalizeVehicleNumber(val?: string | null): string {
  if (!val) return '';
  return val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Deterministically matches parsed payment advice line items to existing claims.
 *
 * DOMAIN RULE (CRITICAL):
 * NEVER match by fee amount alone. Standard fee amounts (e.g. ₹500, ₹1,200, ₹1,500)
 * repeat across dozens of claims. Matching requires Claim Number or Vehicle Registration Number.
 * If neither matches, it MUST remain status: 'unmatched' with matchedClaimId: undefined
 * for manual surveyor review.
 */
export function matchPaymentAdvicesToClaims(
  items: PaymentAdviceClaimItem[],
  claimsList: ClaimReconciliationTarget[],
  utrNumber: string,
  paymentDate: string,
  insurerName: string
): PaymentMatchResult[] {
  return items.map((item, index) => {
    const normAdviceClaim = normalizeClaimNumber(item.claimNumber);
    const normAdviceVehicle = normalizeVehicleNumber(item.vehicleNumber);

    let matchedClaim: ClaimReconciliationTarget | undefined;
    let confidence: MatchConfidence | undefined;

    // 1. First priority: match by normalized claim number
    if (normAdviceClaim.length > 0) {
      matchedClaim = claimsList.find((c) => {
        const norm = normalizeClaimNumber(c.claimNo);
        return norm.length > 0 && norm === normAdviceClaim;
      });
      if (matchedClaim) {
        confidence = 'exact_claim_no';
      }
    }

    // 2. Second priority: match by normalized vehicle number if claim number did not match or was absent
    if (!matchedClaim && normAdviceVehicle.length > 0) {
      matchedClaim = claimsList.find((c) => {
        const norm = normalizeVehicleNumber(c.vehicleNo);
        return norm.length > 0 && norm === normAdviceVehicle;
      });
      if (matchedClaim) {
        confidence = 'exact_vehicle_no';
      }
    }

    // Stable deterministic ID
    const stableId = `pm_${utrNumber || 'advice'}_${index}_${normAdviceClaim || normAdviceVehicle || index}`;

    if (matchedClaim) {
      const billed = matchedClaim.feeTotal ?? 0;
      const gross = item.grossFee ?? 0;
      const net = item.netPaid ?? 0;
      const tds = item.tdsAmount ?? 0;
      const totalCreditedOrAccounted = gross > 0 ? gross : (net + tds);
      const disallowed = (billed > 0 && totalCreditedOrAccounted < billed) ? (billed - totalCreditedOrAccounted) : 0;
      const shortfall = (billed > 0 && (net + tds) < billed) ? (billed - (net + tds)) : 0;

      return {
        id: stableId,
        adviceClaim: item,
        matchedClaimId: matchedClaim.id,
        vehicleNo: matchedClaim.vehicleNo || item.vehicleNumber || '',
        reportNo: matchedClaim.reportNo,
        billedTotal: billed,
        status: 'matched',
        confidence,
        utrNumber,
        paymentDate,
        insurerName,
        shortfall,
        disallowed,
      };
    }

    // Unmatched: NEVER match by amount alone
    return {
      id: stableId,
      adviceClaim: item,
      matchedClaimId: undefined,
      vehicleNo: item.vehicleNumber || '',
      reportNo: undefined,
      billedTotal: 0,
      status: 'unmatched',
      confidence: undefined,
      utrNumber,
      paymentDate,
      insurerName,
    };
  });
}
