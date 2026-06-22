import type { ClaimData } from '@/types/claim';

/** Returns a new claim with feeBill.feePaid toggled. Never mutates the input. */
export function toggleFeePaid(claim: Readonly<ClaimData>): ClaimData {
  return {
    ...claim,
    feeBill: { ...claim.feeBill, feePaid: !claim.feeBill.feePaid },
    updatedAt: new Date().toISOString(),
  };
}
