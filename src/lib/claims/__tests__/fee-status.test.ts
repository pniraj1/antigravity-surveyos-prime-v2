import { describe, it, expect } from 'vitest';
import { toggleFeePaid } from '../fee-status';
import { createBlankClaim } from '@/types/claim';

describe('toggleFeePaid', () => {
  it('flips feeBill.feePaid from false to true', () => {
    const claim = createBlankClaim();
    expect(toggleFeePaid(claim).feeBill.feePaid).toBe(true);
  });

  it('flips feeBill.feePaid from true back to false', () => {
    const base = createBlankClaim();
    const paid = { ...base, feeBill: { ...base.feeBill, feePaid: true } };
    expect(toggleFeePaid(paid).feeBill.feePaid).toBe(false);
  });

  it('does not mutate the input claim', () => {
    const claim = createBlankClaim();
    const before = claim.feeBill.feePaid;
    toggleFeePaid(claim);
    expect(claim.feeBill.feePaid).toBe(before);
  });
});
