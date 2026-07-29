import { describe, it, expect } from 'vitest';
import { claimLandingTab } from '../landing-tab';

describe('claimLandingTab', () => {
  it('starts spot and final surveys on Documents — the top of the workflow', () => {
    expect(claimLandingTab('spot')).toBe('documents');
    expect(claimLandingTab('final')).toBe('documents');
  });

  it('starts valuation surveys on Claim Details', () => {
    // sidebar.tsx restricts 'documents' for valuation surveys, so landing there
    // would strand the surveyor on a tab their sidebar never renders.
    expect(claimLandingTab('valuation')).toBe('details');
  });

  it('falls back to Documents when the survey type is missing', () => {
    expect(claimLandingTab(undefined)).toBe('documents');
  });
});
