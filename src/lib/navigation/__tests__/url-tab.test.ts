import { describe, it, expect } from 'vitest';
import { normalizeUrlTab } from '../url-tab';

describe('normalizeUrlTab', () => {
  it('sends a bookmarked ?tab=site to Claim Details', () => {
    expect(normalizeUrlTab('site', true)).toBe('details');
  });

  it('defaults to Claim Details with a claim and the dashboard without one', () => {
    expect(normalizeUrlTab(null, true)).toBe('details');
    expect(normalizeUrlTab(null, false)).toBe('dashboard');
  });

  it('passes any other tab through', () => {
    expect(normalizeUrlTab('photos', true)).toBe('photos');
  });
});
