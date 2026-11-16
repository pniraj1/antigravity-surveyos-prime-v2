import { describe, it, expect } from 'vitest';
import { isTallyCandidate } from '../candidate';
import type { AssessmentRow, ExtraBillItem } from '@/types/assessment';

const row = (extra: Partial<AssessmentRow> = {}): AssessmentRow => ({
  id: 'r1', particulars: 'FRONT BUMPER', estimated: 1000, assessed: 1000,
  partType: 'plastic', gst: 18, section: 'labour', allowed: true, ...extra,
});

describe('isTallyCandidate', () => {
  it('accepts an unbilled allowed row on a normal claim', () => {
    expect(isTallyCandidate(row(), false)).toBe(true);
  });
  it('accepts a self-billed row on a from-bill claim', () => {
    expect(isTallyCandidate(row({ billedTaxable: 1000 }), true)).toBe(true);
  });
  it('rejects a billed row on a normal claim', () => {
    expect(isTallyCandidate(row({ billedTaxable: 1000 }), false)).toBe(false);
  });
  it('rejects a from-bill row already linked by refSrNo', () => {
    expect(isTallyCandidate(row({ billedTaxable: 1000, refSrNo: 7 }), true)).toBe(false);
  });
  it('rejects refMatch, disallowed and not-in-bill rows', () => {
    const line = { id: 'e1' } as ExtraBillItem;
    expect(isTallyCandidate(row({ refMatch: { bill: line } as AssessmentRow['refMatch'] }), false)).toBe(false);
    expect(isTallyCandidate(row({ allowed: false }), false)).toBe(false);
    expect(isTallyCandidate(row({ billStatus: 'not-in-bill' }), false)).toBe(false);
  });
});
