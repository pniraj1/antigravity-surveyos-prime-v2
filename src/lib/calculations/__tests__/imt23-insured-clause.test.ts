import { describe, it, expect } from 'vitest';
import { getIMT23Clause } from '../depreciation';

describe('IMT-23 insured clause', () => {
  it('leads with the cover the endorsement restores, not the deduction', () => {
    const c = getIMT23Clause();
    expect(c.clauseType).toBe('imt-23');
    expect(c.plainLanguage).toContain('not covered at all');
    expect(c.plainLanguage).toContain('in full');
  });

  it('states the conditions that limit the cover', () => {
    const c = getIMT23Clause();
    expect(c.policyText).toContain('50%');
    expect(c.policyText).toContain('also damaged in the same incident');
    expect(c.policyText).toContain('Theft');
  });
});
