import { describe, expect, test } from 'vitest';
import { cashLossLine } from '@/components/pdf/InsuredSummaryDocument';
import { createBlankClaim, type ClaimData } from '@/types/claim';
import type { AssessmentRow } from '@/types/assessment';

const rows = [{
  id: 'r1', particulars: 'Labour', estimated: 10000, assessed: 10000, partType: 'labour', gst: 18,
  section: 'labour', allowed: true, isDisposal: false, disposalPercent: 50,
}] as unknown as AssessmentRow[];

const claimOf = (cashLoss: ClaimData['cashLoss']): ClaimData => ({ ...createBlankClaim(), assessmentRows: rows, cashLoss });

describe('insured report cash loss line', () => {
  test('on: names the percent and the notional amount', () => {
    expect(cashLossLine(claimOf({ enabled: true, notionalPercent: 30 }))).toBe(
      'Settled on cash loss basis at your request; a notional deduction of 30% (₹3,000.00) applies as repair bills are not submitted.',
    );
  });
  test('off: no line', () => {
    expect(cashLossLine(claimOf({ enabled: false, notionalPercent: 30 }))).toBeNull();
    expect(cashLossLine(claimOf(undefined))).toBeNull();
  });
});
