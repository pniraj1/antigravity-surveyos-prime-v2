import { describe, it, expect } from 'vitest';
import { isNavItemVisible } from '../visible-nav';
import type { AppTab } from '@/stores/ui-store';

const visible = (survey: 'spot' | 'final' | 'valuation' | undefined, ids: AppTab[]) =>
  ids.filter((id) => isNavItemVisible(id, survey));

const ALL: AppTab[] = ['dashboard', 'documents', 'review', 'details', 'valuation', 'assessment',
  'reports', 'insured-report', 'bill-check', 'photos', 'fees', 'reinspection'];

describe('isNavItemVisible (matches sidebar.tsx as of 2026-10-02)', () => {
  it('spot hides assessment, bill check, reinspection, valuation', () => {
    expect(visible('spot', ALL)).toEqual(['dashboard', 'documents', 'review', 'details',
      'reports', 'insured-report', 'photos', 'fees']);
  });

  it('final hides only valuation', () => {
    expect(visible('final', ALL)).toEqual(ALL.filter((id) => id !== 'valuation'));
  });

  it('valuation hides assessment, bill check, reinspection, review, documents', () => {
    expect(visible('valuation', ALL)).toEqual(['dashboard', 'details', 'valuation',
      'reports', 'insured-report', 'photos', 'fees']);
  });

  it('does not crash on an unknown survey type', () => {
    expect(isNavItemVisible('details', 'bogus' as never)).toBe(true);
  });

  it('with no claim open only valuation is hidden', () => {
    expect(visible(undefined, ALL)).toEqual(ALL.filter((id) => id !== 'valuation'));
  });
});
