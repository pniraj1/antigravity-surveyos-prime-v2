import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import * as claimFolderStore from '@/lib/storage/claim-folder-store';
import { FromPhoneButton, scanResultMessage } from '../FromPhoneButton';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Radix dialogs portal out of static markup; render them inline so the content can be asserted.
vi.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }: any) => <div>{children}</div>;
  return {
    Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
    DialogFooter: Pass,
  };
});

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

  it('renders "From Phone" with no Notes/Scans menu', () => {
    const html = renderToStaticMarkup(<FromPhoneButton />);
    expect(html).toContain('From Phone');
    expect(html).not.toContain('aria-haspopup');
    expect(html).not.toContain('Phone Notes');
    expect(html).not.toContain('Phone Scans &amp; Photos');
  });

  it('initialOpen shows the source dialog with the computer zip option', () => {
    const html = renderToStaticMarkup(<FromPhoneButton initialOpen />);
    expect(html).toContain('From this Computer (.zip)');
    expect(html).toContain('Choose the zip SurveyOS Scan shared');
  });

  it('still offers the computer zip when local folders are unsupported', () => {
    vi.mocked(claimFolderStore.isLocalFolderSupported).mockReturnValue(false);
    const html = renderToStaticMarkup(<FromPhoneButton initialOpen />);
    expect(html).toContain('From this Computer (.zip)');
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

  it('getAction exposes open/close', () => {
    let actions: any = null;
    renderToStaticMarkup(<FromPhoneButton getAction={(a) => { actions = a; }} />);
    expect(typeof actions.open).toBe('function');
    expect(typeof actions.close).toBe('function');
    expect(() => actions.open()).not.toThrow();
  });
});

describe('scanResultMessage', () => {
  it('needs-folder with notes says notes came in', () => {
    expect(scanResultMessage({ status: 'needs-folder', notes: { spot: {} } })).toEqual({
      kind: 'info',
      text: 'Notes brought in. Documents and photos were not saved: link the claim folder on the Documents tab (desktop Chrome).',
    });
  });
  it('needs-folder without notes keeps the old error', () => {
    expect(scanResultMessage({ status: 'needs-folder', notes: null })?.kind).toBe('error');
  });
  it('cancelled needs no toast', () => {
    expect(scanResultMessage({ status: 'cancelled' })).toBeNull();
  });
});
