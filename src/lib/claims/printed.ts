import type { ClaimData, PrintedKind } from '@/types/claim';
import { useClaimStore } from '@/stores/claim-store';

/** Pure: returns a copy of the claim with `kind` stamped as printed at `at`. */
export function withPrinted(claim: ClaimData, kind: PrintedKind, at: string): ClaimData {
  return { ...claim, printedAt: { ...claim.printedAt, [kind]: at } };
}

/** Stamps a print on the open claim; ignores any other claim id. */
export function recordPrinted(claimId: string, kind: PrintedKind): void {
  const { currentClaim, updateClaim } = useClaimStore.getState();
  if (currentClaim?.id !== claimId) return;
  updateClaim({
    printedAt: withPrinted(currentClaim, kind, new Date().toISOString()).printedAt,
  });
}
