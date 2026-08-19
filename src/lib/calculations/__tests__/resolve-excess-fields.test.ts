import { describe, it, expect } from 'vitest';
import { getCompulsoryExcess, resolveExcessFields } from '../assessment';
import type { FeeBill } from '@/types';

/**
 * The compulsory excess lives in two fields. `compulsoryExcess` was added in
 * April 2026; every claim persisted before that holds the figure only in the
 * legacy `lessExcess`. The report builders resolve both through
 * getCompulsoryExcess(); eight screens read `feeBill.compulsoryExcess` raw and
 * got undefined. claimSlice.loadClaim now writes both fields back on the way
 * in, so the two readings cannot disagree.
 */
describe('resolveExcessFields', () => {
  it('backfills compulsoryExcess from a legacy lessExcess-only claim', () => {
    const legacy = { lessExcess: 5000 } as Partial<FeeBill>;
    expect(legacy.compulsoryExcess).toBeUndefined();
    expect(resolveExcessFields(legacy)).toEqual({ compulsoryExcess: 5000, lessExcess: 5000 });
  });

  it('makes the raw read agree with getCompulsoryExcess', () => {
    const legacy = { lessExcess: 5000 } as Partial<FeeBill>;
    const resolved = { ...legacy, ...resolveExcessFields(legacy) };
    // Before: report deducted 5000, screens deducted 0. After: both 5000.
    expect(resolved.compulsoryExcess).toBe(getCompulsoryExcess(resolved));
  });

  it('leaves a modern claim untouched', () => {
    const modern = { compulsoryExcess: 1000, lessExcess: 1000 } as Partial<FeeBill>;
    expect(resolveExcessFields(modern)).toEqual({ compulsoryExcess: 1000, lessExcess: 1000 });
  });

  it('prefers compulsoryExcess when the two disagree', () => {
    // compulsoryExcess is the field the excess input writes, so it wins.
    const conflicting = { compulsoryExcess: 2000, lessExcess: 5000 } as Partial<FeeBill>;
    expect(resolveExcessFields(conflicting)).toEqual({ compulsoryExcess: 2000, lessExcess: 2000 });
  });

  it('keeps an explicit zero as zero rather than falling through to the legacy field', () => {
    const waived = { compulsoryExcess: 0, lessExcess: 5000 } as Partial<FeeBill>;
    expect(resolveExcessFields(waived)).toEqual({ compulsoryExcess: 0, lessExcess: 0 });
  });

  it('resolves an empty fee bill to zero', () => {
    expect(resolveExcessFields({})).toEqual({ compulsoryExcess: 0, lessExcess: 0 });
  });
});
