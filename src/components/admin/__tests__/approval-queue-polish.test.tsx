import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApprovalQueueTab } from '../tabs/ApprovalQueueTab';
import type { NewSignup } from '../types';

describe('ApprovalQueueTab Polish', () => {
  const mockSignup: NewSignup = {
    uid: 'user-signup-123',
    email: 'newsurveyor@example.com',
    displayName: 'Rajesh Sharma',
    name: 'Rajesh Sharma',
    irdaiLicence: 'SLA-88219',
    mobile: '+91 98765 43210',
    status: 'pending',
    profileName: 'Rajesh Sharma',
    profileIrdai: 'SLA-88219',
    profileMobile: '+91 98765 43210',
    profileCity: 'Pune',
    profileState: 'Maharashtra',
    accessRequestSubmitted: true,
    signedUpAt: {
      toDate: () => new Date('2026-11-01T10:30:00Z'),
    } as any,
  };

  it('renders table headers and row with accessible typography (no 9px or 10px text)', () => {
    const html = renderToStaticMarkup(
      <ApprovalQueueTab
        signups={[mockSignup]}
        loading={false}
        approvingId={null}
        onApprove={vi.fn()}
        onDismiss={vi.fn()}
        onEmail={vi.fn()}
      />
    );

    // Verify there are no text-[9px] or text-[10px] classes in the rendered HTML
    expect(html).not.toContain('text-[9px]');
    expect(html).not.toContain('text-[10px]');

    // Primary surveyor details are visible
    expect(html).toContain('Rajesh Sharma');
    expect(html).toContain('newsurveyor@example.com');
    expect(html).toContain('SLA-88219');
    expect(html).toContain('+91 98765 43210');
    expect(html).toContain('Pune, Maharashtra');
  });

  it('provides an accessible input for trial days with aria-label', () => {
    const html = renderToStaticMarkup(
      <ApprovalQueueTab
        signups={[mockSignup]}
        loading={false}
        approvingId={null}
        onApprove={vi.fn()}
        onDismiss={vi.fn()}
        onEmail={vi.fn()}
      />
    );

    expect(html).toMatch(/aria-label="Trial duration in days for Rajesh Sharma"/i);
  });

  it('renders clean empty state when there are no signups', () => {
    const html = renderToStaticMarkup(
      <ApprovalQueueTab
        signups={[]}
        loading={false}
        approvingId={null}
        onApprove={vi.fn()}
        onDismiss={vi.fn()}
        onEmail={vi.fn()}
      />
    );

    expect(html).toContain('No pending signups');
    expect(html).toContain('New signups will appear here for approval.');
  });
});
