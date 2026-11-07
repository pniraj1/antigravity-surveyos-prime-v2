import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import * as claimFolderStore from '@/lib/storage/claim-folder-store';
import { FromPhoneButton } from '../FromPhoneButton';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/drive', () => ({
  loadDriveIndex: vi.fn().mockResolvedValue({}),
  saveDriveIndex: vi.fn().mockResolvedValue(undefined),
  linkGoogleDrive: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/storage/claim-folder-store', () => ({
  isLocalFolderSupported: vi.fn().mockReturnValue(true),
}));

describe('FromPhoneButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClaimStore.setState({
      currentClaim: {
        id: 'claim-123',
        vehicle: { registrationNumber: 'MH02CB1234' },
      } as any,
    });
    useUIStore.setState({
      isDriveConnected: true,
      driveEmail: 'surveyor@example.com',
    });
  });

  it('renders a trigger button labeled "From Phone" with mobile smartphone icon and dropdown chevron', () => {
    const html = renderToStaticMarkup(<FromPhoneButton />);
    expect(html).toContain('From Phone');
    // Checks that it renders the button trigger with aria attributes
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    // Checks for svg icons (lucide-react Smartphone and ChevronDown)
    expect(html).toContain('<svg');
    // Dropdown menu options should be closed initially
    expect(html).not.toContain('Phone Notes');
    expect(html).not.toContain('Phone Scans &amp; Photos');
  });

  it('renders a menu with "Phone Notes" and "Phone Scans & Photos" options when open', () => {
    const html = renderToStaticMarkup(<FromPhoneButton initialOpen={true} />);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('role="menu"');
    expect(html).toContain('Phone Notes');
    expect(html).toContain('Review field notes recorded on phone &amp; auto-populate details');
    expect(html).toContain('Phone Scans &amp; Photos');
    expect(html).toContain('Import scans and photos from phone .zip or Drive folder');
  });

  it('respects disabled state when no claim is loaded', () => {
    useClaimStore.setState({ currentClaim: null });
    const html = renderToStaticMarkup(<FromPhoneButton />);
    expect(html).toContain('disabled');
  });

  it('respects explicit disabled prop', () => {
    const html = renderToStaticMarkup(<FromPhoneButton disabled={true} />);
    expect(html).toContain('disabled');
  });

  it('handles unsupported local folder gracefully in Phone Scans option', () => {
    vi.spyOn(claimFolderStore, 'isLocalFolderSupported').mockReturnValue(false);
    const html = renderToStaticMarkup(<FromPhoneButton initialOpen={true} />);
    // When unsupported, the menu still renders Phone Notes cleanly
    expect(html).toContain('Phone Notes');
    expect(html).toContain('Phone Scans &amp; Photos');
    // Phone Scans indicates disabled/unsupported state
    expect(html).toContain('data-unsupported="true"');
  });

  it('provides getAction hook to trigger menu toggle and actions', () => {
    let actions: any = null;
    renderToStaticMarkup(
      <FromPhoneButton getAction={(a) => { actions = a; }} />
    );
    expect(actions).toBeDefined();
    expect(typeof actions.toggleMenu).toBe('function');
    expect(typeof actions.openNotes).toBe('function');
    expect(typeof actions.openScans).toBe('function');
  });
});
