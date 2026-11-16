import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReconciliationWizardDialog, handleWizardKeyDown } from '../ReconciliationWizardDialog';
import { useClaimStore } from '@/stores/claim-store';
import type { ClaimData } from '@/types';

const mockClaim = {
  id: 'c1',
  assessmentRows: [],
  extraBillItems: [],
  billCheck: { billNo: 'INV-101', billTotal: 45000 },
} as unknown as ClaimData;

describe('ReconciliationWizardDialog', () => {
  beforeEach(() => {
    useClaimStore.setState({
      currentClaim: mockClaim,
      activeTallyStage: 1,
    });
  });

  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ReconciliationWizardDialog isOpen={false} onClose={vi.fn()} claim={mockClaim} />
    );
    expect(html).toBe('');
  });

  it('renders correctly when open', () => {
    const html = renderToStaticMarkup(
      <ReconciliationWizardDialog isOpen={true} onClose={vi.fn()} claim={mockClaim} stage={1} />
    );
    expect(html).toContain('Reconciliation Cockpit');
    expect(html).toContain('Bill #INV-101');
    expect(html).toContain('of 4');
    expect(html).toContain('Next Stage');
  });

  it('complies with Google Chrome Modern Web Guidance for modal dialogs', () => {
    const html = renderToStaticMarkup(
      <ReconciliationWizardDialog isOpen={true} onClose={vi.fn()} claim={mockClaim} stage={1} />
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="wizard-dialog-title"');
    expect(html).toContain('id="wizard-dialog-title"');
    expect(html).toContain('aria-label="Close reconciliation wizard"');
  });

  it('renders Stage 4 with Apply to Assessment Grid button', () => {
    const html = renderToStaticMarkup(
      <ReconciliationWizardDialog isOpen={true} onClose={vi.fn()} claim={mockClaim} stage={4} />
    );
    expect(html).toContain('of 4');
    expect(html).toContain('Apply to Assessment Grid &amp; Finish');
  });

  it('closes dialog and returns tally stage to grid on Escape key', () => {
    const onCloseSpy = vi.fn();
    const setTallyStageSpy = vi.fn();
    handleWizardKeyDown({ key: 'Escape' }, { onClose: onCloseSpy, setTallyStage: setTallyStageSpy });
    expect(setTallyStageSpy).toHaveBeenCalledWith('grid');
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores non-Escape keys', () => {
    const onCloseSpy = vi.fn();
    const setTallyStageSpy = vi.fn();
    handleWizardKeyDown({ key: 'Enter' }, { onClose: onCloseSpy, setTallyStage: setTallyStageSpy });
    handleWizardKeyDown({ key: 'Tab' }, { onClose: onCloseSpy, setTallyStage: setTallyStageSpy });
    expect(setTallyStageSpy).not.toHaveBeenCalled();
    expect(onCloseSpy).not.toHaveBeenCalled();
  });
});
