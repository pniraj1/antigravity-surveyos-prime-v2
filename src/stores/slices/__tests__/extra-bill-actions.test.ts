import { describe, expect, test } from 'vitest';
import { createAssessmentSlice } from '../assessmentSlice';
import type { ClaimData, ExtraBillItem } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: 'r1',
    particulars: 'FRONT BUMPER',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

const extra: ExtraBillItem = {
  id: 'e1',
  description: 'RADIATOR ASSY',
  amount: 7080,
  taxableAmount: 6000,
  gstPercent: 18,
  partNumber: 'RD-9',
  section: 'parts',
  category: 'spare_parts',
  source: 'final-bill',
};

/** Minimal harness: runs the slice's set() against a plain state object. */
function harness(claim: ClaimData) {
  let state: { currentClaim: ClaimData | null; isDirty?: boolean } = { currentClaim: claim };
  const set = (fn: (s: typeof state) => Partial<typeof state>) => {
    state = { ...state, ...fn(state) };
  };
  const slice = createAssessmentSlice(set as never, (() => state) as never, {} as never);
  return { slice, get: () => state };
}

describe('linkExtraBillItem', () => {
  test('attaches the bill figures to the chosen row and consumes the extra', () => {
    const claim = { id: 'c1', assessmentRows: [row()], extraBillItems: [extra] } as unknown as ClaimData;
    const { slice, get } = harness(claim);

    slice.linkExtraBillItem('e1', 'r1');

    const r = get().currentClaim!.assessmentRows[0];
    expect(r.billedTaxable).toBe(6000);
    expect(r.billedAmount).toBe(7080);
    // 6000 billed against 10000 assessed is a divergence, and a divergence is
    // now a derived flag driving the cap, not a stored status. The row is in
    // the bill; billCheckFlags is what says something needs looking at.
    expect(r.billStatus).toBe('in-bill');
    expect(get().currentClaim!.extraBillItems).toHaveLength(0);
  });

  test('marks in-bill when the amounts agree', () => {
    const claim = {
      id: 'c1',
      assessmentRows: [row({ assessed: 6000, estimated: 6000 })],
      extraBillItems: [extra],
    } as unknown as ClaimData;
    const { slice, get } = harness(claim);

    slice.linkExtraBillItem('e1', 'r1');

    expect(get().currentClaim!.assessmentRows[0].billStatus).toBe('in-bill');
  });
});

describe('promoteExtraBillItem', () => {
  test('creates a Not Allowed row at zero assessed, carrying the bill data', () => {
    const claim = { id: 'c1', assessmentRows: [], extraBillItems: [extra] } as unknown as ClaimData;
    const { slice, get } = harness(claim);

    slice.promoteExtraBillItem('e1');

    const added = get().currentClaim!.assessmentRows[0];
    expect(added.particulars).toBe('RADIATOR ASSY');
    expect(added.allowed).toBe(false);   // the surveyor decides, not the AI
    expect(added.assessed).toBe(0);
    expect(added.estimated).toBe(0);
    expect(added.billedTaxable).toBe(6000);
    expect(added.billedAmount).toBe(7080);
    expect(added.partNumber).toBe('RD-9');
    expect(added.gst).toBe(18);
    expect(added.section).toBe('parts');
    expect(get().currentClaim!.extraBillItems).toHaveLength(0);
  });

  test('does nothing when the id is unknown', () => {
    const claim = { id: 'c1', assessmentRows: [], extraBillItems: [extra] } as unknown as ClaimData;
    const { slice, get } = harness(claim);

    slice.promoteExtraBillItem('nope');

    expect(get().currentClaim!.assessmentRows).toHaveLength(0);
    expect(get().currentClaim!.extraBillItems).toHaveLength(1);
  });
});

describe('correcting a wrong match', () => {
  const wrongLine: ExtraBillItem = { ...extra, id: 'e-lh', description: 'HEAD LAMP LH', srNo: 9 };
  const rightLine: ExtraBillItem = { ...extra, id: 'e-rh', description: 'HEAD LAMP RH', srNo: 10 };
  const matched = () => row({
    particulars: 'HEAD LAMP RH', billedTaxable: 6000, billStatus: 'in-bill', refSrNo: 9,
    refStatus: 'ambiguous', refMatch: { bill: wrongLine, score: 45, reasons: ['Left vs right'] },
  });

  test('linking the right line returns the wrong one to unmatched', () => {
    const claim = { id: 'c1', assessmentRows: [matched()], extraBillItems: [rightLine] } as unknown as ClaimData;
    const { slice, get } = harness(claim);

    slice.linkExtraBillItem('e-rh', 'r1');

    const r = get().currentClaim!.assessmentRows[0];
    expect(r.refSrNo).toBe(10);
    expect(r.refStatus).toBe('manual');
    expect(get().currentClaim!.extraBillItems!.map(e => e.id)).toEqual(['e-lh']);
  });

  test('unlinking puts the line back and leaves the row unchecked', () => {
    const claim = { id: 'c1', assessmentRows: [matched()], extraBillItems: [] } as unknown as ClaimData;
    const { slice, get } = harness(claim);

    slice.unlinkBillMatch('r1');

    const r = get().currentClaim!.assessmentRows[0];
    expect(r.billedTaxable).toBeUndefined();
    expect(r.billStatus).toBe('pending');
    expect(r.refSrNo).toBeUndefined();
    expect(get().currentClaim!.extraBillItems!.map(e => e.id)).toEqual(['e-lh']);
  });
});
