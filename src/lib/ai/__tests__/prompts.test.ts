import { describe, it, expect } from 'vitest';
import { getPageScopeSuffix } from '../prompts';

describe('getPageScopeSuffix', () => {
  it('includes the page number and total pages', () => {
    const suffix = getPageScopeSuffix(2, 6);
    expect(suffix).toContain('page 2 of 6');
  });

  it('includes instruction to not repeat items', () => {
    const suffix = getPageScopeSuffix(1, 1);
    expect(suffix.toLowerCase()).toContain('do not repeat');
  });

  it('starts with a newline for clean prompt concatenation', () => {
    const suffix = getPageScopeSuffix(3, 5);
    expect(suffix.startsWith('\n')).toBe(true);
  });

  it('works for page 1 of 1', () => {
    const suffix = getPageScopeSuffix(1, 1);
    expect(suffix).toContain('page 1 of 1');
  });
});
