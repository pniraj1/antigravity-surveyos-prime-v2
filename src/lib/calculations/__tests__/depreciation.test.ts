import { describe, it, expect } from 'vitest';
import { getIRDAIStandardClauses } from '../depreciation';

describe('getIRDAIStandardClauses', () => {
  it('returns 5 standard clauses', () => {
    const clauses = getIRDAIStandardClauses();
    expect(clauses).toHaveLength(5);
  });

  it('all clauses have required fields', () => {
    const clauses = getIRDAIStandardClauses();
    for (const c of clauses) {
      expect(c.clauseType).toBeTruthy();
      expect(c.clauseTitle).toBeTruthy();
      expect(c.policyText).toBeTruthy();
      expect(c.plainLanguage).toBeTruthy();
      expect(c.source).toBe('irdai-standard');
    }
  });
});
