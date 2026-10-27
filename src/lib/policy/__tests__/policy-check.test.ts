import { describe, it, expect } from 'vitest';
import { parsePolicyAddOns, mergePolicyAiRead, policyCheckStatus } from '../policy-check';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

const claimWith = (policyCheck?: ClaimData['policyCheck'], rows: Partial<AssessmentRow>[] = []): ClaimData => ({
  ...createBlankClaim(),
  policyCheck,
  assessmentRows: rows as AssessmentRow[],
});

describe('policyCheckStatus', () => {
  it('old claim with no policyCheck is 0 of 4, incomplete', () => {
    const s = policyCheckStatus(createBlankClaim());
    expect(createBlankClaim().policyCheck).toBeUndefined();
    expect(s).toEqual({ answered: 0, total: 4, complete: false, warnings: [] });
  });

  it('all four answered is complete', () => {
    const s = policyCheckStatus(claimWith({ nilDep: 'yes', imt23: 'na', consumables: 'yes', excessConfirmed: true }));
    expect(s.answered).toBe(4);
    expect(s.complete).toBe(true);
  });

  it('warns when IMT 23 rows are ticked but policy has none', () => {
    const s = policyCheckStatus(claimWith({ imt23: 'no' }, [
      { allowed: true, imt23: true }, { allowed: true, imt23: true }, { allowed: false, imt23: true }, { allowed: true },
    ]));
    expect(s.warnings).toEqual(['2 rows ticked IMT 23 — policy has no IMT 23']);
  });

  it('warns when policy has IMT 23 but no row is ticked', () => {
    const s = policyCheckStatus(claimWith({ imt23: 'yes' }, [{ allowed: true }]));
    expect(s.warnings).toEqual(['Policy has IMT 23 — no rows ticked yet']);
  });

  it('warns when consumables are not payable', () => {
    const s = policyCheckStatus(claimWith({ consumables: 'no' }));
    expect(s.warnings).toEqual(['Consumables not payable — check consumable rows']);
  });
});

describe('parsePolicyAddOns', () => {
  it('reads yes/no case-insensitively, drops unknown, strips amounts', () => {
    expect(parsePolicyAddOns({ nil_depreciation: 'YES', imt23: 'unknown', compulsory_excess: 'Rs. 1,000' }))
      .toEqual({ nilDep: 'yes', compulsoryExcess: 1000 });
  });
  it('omits zero / empty / NaN amounts', () => {
    expect(parsePolicyAddOns({ compulsory_excess: '0', voluntary_excess: '' , consumables_cover: 'No' }))
      .toEqual({ consumables: 'no' });
    expect(parsePolicyAddOns(undefined)).toEqual({});
  });
});

describe('mergePolicyAiRead', () => {
  const excess = { compulsory: 1000, voluntary: 0 };
  it('stores aiRead and keeps agreeing answers', () => {
    const r = mergePolicyAiRead({ nilDep: 'yes' }, { nilDep: 'yes' }, excess);
    expect(r.nilDep).toBe('yes');
    expect(r.aiRead).toEqual({ nilDep: 'yes' });
  });
  it('clears an answer the AI disagrees with', () => {
    expect(mergePolicyAiRead({ nilDep: 'no' }, { nilDep: 'yes' }, excess).nilDep).toBeUndefined();
  });
  it('keeps IMT 23 "na" when AI says no, clears it when AI says yes', () => {
    expect(mergePolicyAiRead({ imt23: 'na' }, { imt23: 'no' }, excess).imt23).toBe('na');
    expect(mergePolicyAiRead({ imt23: 'na' }, { imt23: 'yes' }, excess).imt23).toBeUndefined();
  });
  it('clears excessConfirmed when AI excess differs, keeps it when equal or absent', () => {
    expect(mergePolicyAiRead({ excessConfirmed: true }, { compulsoryExcess: 500 }, excess).excessConfirmed).toBeUndefined();
    expect(mergePolicyAiRead({ excessConfirmed: true }, { voluntaryExcess: 200 }, excess).excessConfirmed).toBeUndefined();
    expect(mergePolicyAiRead({ excessConfirmed: true }, { compulsoryExcess: 1000 }, excess).excessConfirmed).toBe(true);
    expect(mergePolicyAiRead({ excessConfirmed: true }, {}, excess).excessConfirmed).toBe(true);
  });
  it('works from undefined and does not mutate input', () => {
    const input = { nilDep: 'no' as const };
    mergePolicyAiRead(input, { nilDep: 'yes' }, excess);
    expect(input).toEqual({ nilDep: 'no' });
    expect(mergePolicyAiRead(undefined, { nilDep: 'yes' }, excess).aiRead).toEqual({ nilDep: 'yes' });
  });
});
