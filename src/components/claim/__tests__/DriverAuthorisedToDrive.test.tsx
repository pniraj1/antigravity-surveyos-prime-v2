import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DriverDetailsForm } from '../DriverForm';
import { useClaimStore } from '@/stores/claim-store';
import { createBlankClaim } from '@/types';

vi.mock('@/stores/claim-store', () => ({
  useClaimStore: vi.fn(),
}));

vi.mock('@/hooks/useFieldEvidence', () => ({
  useFieldEvidence: () => ({
    triggerField: vi.fn(),
    hasEvidence: () => false,
  }),
}));

describe('DriverAuthorisedToDrive', () => {
  let mockUpdateDriver: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpdateDriver = vi.fn();
  });

  it('createBlankClaim initializes driver.authorisedToDrive to YES', () => {
    const claim = createBlankClaim('final', 'private');
    expect(claim.driver.authorisedToDrive).toBe('YES');
  });

  it('DriverDetailsForm renders #d-authorised select with only Yes and No options without empty option', () => {
    const claim = createBlankClaim('final', 'private');
    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateDriver: mockUpdateDriver,
    } as any);

    const html = renderToStaticMarkup(<DriverDetailsForm />);

    expect(html).toContain('id="d-authorised"');
    expect(html).toContain('value="YES"');
    expect(html).toContain('Yes</option>');
    expect(html).toContain('value="NO"');
    expect(html).toContain('No</option>');

    // Must NOT render empty option or placeholder dash
    expect(html).not.toContain('<option value="">');
    expect(html).not.toContain('—');
  });

  it('DriverDetailsForm defaults value to YES even if an existing claim had driver.authorisedToDrive === ""', () => {
    const claim = {
      ...createBlankClaim('final', 'private'),
      driver: {
        ...createBlankClaim('final', 'private').driver,
        authorisedToDrive: '',
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateDriver: mockUpdateDriver,
    } as any);

    const html = renderToStaticMarkup(<DriverDetailsForm />);

    // In renderToStaticMarkup, select with value="YES" selects YES
    expect(html).toContain('<option value="YES" selected="">Yes</option>');
    expect(html).not.toContain('<option value="">');
    expect(html).not.toContain('—');
  });
});
