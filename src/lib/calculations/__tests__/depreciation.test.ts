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

  it('contains each required IRDAI clause type exactly once', () => {
    const clauses = getIRDAIStandardClauses();
    const types = clauses.map((c) => c.clauseType);
    expect(types).toContain('depreciation');
    expect(types).toContain('excess');
    expect(types).toContain('consumables-exclusion');
    expect(types).toContain('salvage');
    expect(types).toContain('specific-exclusion');
    expect(new Set(types).size).toBe(5);
  });

  it('depreciation clause references 50% rate for plastic parts', () => {
    const clauses = getIRDAIStandardClauses();
    const dep = clauses.find((c) => c.clauseType === 'depreciation')!;
    expect(dep.policyText).toMatch(/50%/);
    expect(dep.plainLanguage).toMatch(/depreciation/i);
  });
});
