// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import * as ReactDOMClient from 'react-dom/client';

// Configure React act environment for JSDOM
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { ScanProgressModal } from '../ScanProgressModal';
import type {
  SyncProgressUpdate,
  SmartSyncResult,
} from '@/lib/reconciliation/smart-sync-service';

describe('ScanProgressModal', () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    act(() => {
      root.render(
        <ScanProgressModal
          isOpen={false}
          progress={{
            phase: 'processing',
            current: 2,
            total: 10,
            message: 'Processing item 2 of 10',
          }}
          onCancel={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('renders indeterminate or listing phase properly', () => {
    const onCancel = vi.fn();
    const onClose = vi.fn();

    const progress: SyncProgressUpdate = {
      phase: 'listing',
      current: 0,
      total: 0,
      message: 'Searching Gmail for payment intimation emails...',
    };

    act(() => {
      root.render(
        <ScanProgressModal
          isOpen={true}
          progress={progress}
          onCancel={onCancel}
          onClose={onClose}
        />
      );
    });

    // Check dialog rendered
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    // Check title & message
    const title = container.querySelector('[data-testid="scan-title"]');
    expect(title?.textContent).toBe('Scanning Gmail for Payments');

    const message = container.querySelector('[data-testid="scan-message"]');
    expect(message?.textContent).toBe(
      'Searching Gmail for payment intimation emails...'
    );

    // Check indeterminate progress bar
    const barFill = container.querySelector(
      '[data-testid="progress-bar-fill"]'
    );
    expect(barFill).not.toBeNull();
    expect(barFill?.className).toContain('animate-pulse');

    // Check step counter
    const stepCounter = container.querySelector(
      '[data-testid="progress-step-counter"]'
    );
    expect(stepCounter?.textContent).toBe('0 of 0');

    // Check Cancel Scan button is rendered in progress
    const cancelBtn = container.querySelector(
      '[data-testid="cancel-scan-button"]'
    ) as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();
    expect(cancelBtn.textContent).toContain('Cancel Scan');

    // Done button should not exist while in progress
    expect(container.querySelector('[data-testid="done-scan-button"]')).toBeNull();
  });

  it('renders progress percentage and message during processing phase', () => {
    const progress: SyncProgressUpdate = {
      phase: 'processing',
      current: 4,
      total: 10,
      message: 'Analyzing payment voucher 4 of 10...',
    };

    act(() => {
      root.render(
        <ScanProgressModal
          isOpen={true}
          progress={progress}
          onCancel={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    // Check percentage is 40%
    const percentage = container.querySelector(
      '[data-testid="progress-percentage"]'
    );
    expect(percentage?.textContent).toBe('40%');

    // Check step counter
    const stepCounter = container.querySelector(
      '[data-testid="progress-step-counter"]'
    );
    expect(stepCounter?.textContent).toBe('4 of 10');

    // Check message
    const message = container.querySelector('[data-testid="scan-message"]');
    expect(message?.textContent).toBe('Analyzing payment voucher 4 of 10...');

    // Progress bar fill should be 40% width and not indeterminate
    const barFill = container.querySelector(
      '[data-testid="progress-bar-fill"]'
    ) as HTMLDivElement;
    expect(barFill.style.width).toBe('40%');
    expect(barFill.className).not.toContain('animate-pulse');
  });

  it('clamps percentage between 0% and 100%', () => {
    const overflowProgress: SyncProgressUpdate = {
      phase: 'processing',
      current: 15,
      total: 10,
      message: 'Finishing up...',
    };

    act(() => {
      root.render(
        <ScanProgressModal
          isOpen={true}
          progress={overflowProgress}
          onCancel={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    const percentage = container.querySelector(
      '[data-testid="progress-percentage"]'
    );
    expect(percentage?.textContent).toBe('100%');
  });

  it('displays live stats badges (Found, Skipped, Cached, Parsed)', () => {
    const mockResult: SmartSyncResult = {
      matches: [],
      unmatchedAdvices: [],
      stats: {
        totalFound: 48,
        skippedSettled: 30,
        cachedReused: 12,
        newlyParsed: 6,
        matchesCount: 9,
      },
    };

    act(() => {
      root.render(
        <ScanProgressModal
          isOpen={true}
          progress={{
            phase: 'processing',
            current: 18,
            total: 48,
            message: 'Extracting...',
          }}
          result={mockResult}
          onCancel={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    // Stats strip
    const statsStrip = container.querySelector(
      '[data-testid="live-stats-strip"]'
    );
    expect(statsStrip).not.toBeNull();

    // Found stat
    const statFound = container.querySelector('[data-testid="stat-found"]');
    expect(statFound?.textContent).toContain('Found');
    expect(statFound?.textContent).toContain('48');

    // Skipped stat
    const statSkipped = container.querySelector('[data-testid="stat-skipped"]');
    expect(statSkipped?.textContent).toContain('Skipped');
    expect(statSkipped?.textContent).toContain('30');

    // Cached stat
    const statCached = container.querySelector('[data-testid="stat-cached"]');
    expect(statCached?.textContent).toContain('Cache Reused');
    expect(statCached?.textContent).toContain('Cached');
    expect(statCached?.textContent).toContain('12');

    // Parsed stat
    const statParsed = container.querySelector('[data-testid="stat-parsed"]');
    expect(statParsed?.textContent).toContain('AI Parsed');
    expect(statParsed?.textContent).toContain('Parsed');
    expect(statParsed?.textContent).toContain('6');
  });

  it('clicking [ Cancel Scan ] triggers onCancel', () => {
    const onCancel = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root.render(
        <ScanProgressModal
          isOpen={true}
          progress={{
            phase: 'processing',
            current: 2,
            total: 5,
            message: 'Parsing...',
          }}
          onCancel={onCancel}
          onClose={onClose}
        />
      );
    });

    const cancelBtn = container.querySelector(
      '[data-testid="cancel-scan-button"]'
    ) as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();

    act(() => {
      cancelBtn.click();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('when phase === complete, shows completion state and [ Done / View Matches ] button which triggers onClose', () => {
    const onCancel = vi.fn();
    const onClose = vi.fn();

    const mockResult: SmartSyncResult = {
      matches: [],
      unmatchedAdvices: [],
      stats: {
        totalFound: 15,
        skippedSettled: 5,
        cachedReused: 7,
        newlyParsed: 3,
        matchesCount: 4,
      },
    };

    act(() => {
      root.render(
        <ScanProgressModal
          isOpen={true}
          progress={{
            phase: 'complete',
            current: 15,
            total: 15,
            message: 'All matching vouchers resolved.',
          }}
          result={mockResult}
          onCancel={onCancel}
          onClose={onClose}
        />
      );
    });

    // Check title
    const title = container.querySelector('[data-testid="scan-title"]');
    expect(title?.textContent).toBe('Scan Complete');

    // Percentage should be 100%
    const percentage = container.querySelector(
      '[data-testid="progress-percentage"]'
    );
    expect(percentage?.textContent).toBe('100%');

    // Completed summary banner
    const matchBanner = container.querySelector(
      '[data-testid="complete-summary-banner"]'
    );
    expect(matchBanner).not.toBeNull();
    expect(matchBanner?.textContent).toContain('4');

    // Done button should be present
    const doneBtn = container.querySelector(
      '[data-testid="done-scan-button"]'
    ) as HTMLButtonElement;
    expect(doneBtn).not.toBeNull();
    expect(doneBtn.textContent).toContain('Done / View Matches');

    // Cancel button should not exist
    expect(
      container.querySelector('[data-testid="cancel-scan-button"]')
    ).toBeNull();

    // Clicking done button triggers onClose
    act(() => {
      doneBtn.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('when phase === cancelled, shows cancelled state', () => {
    const onCancel = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root.render(
        <ScanProgressModal
          isOpen={true}
          progress={{
            phase: 'cancelled',
            current: 3,
            total: 10,
            message: 'Scan aborted by user.',
          }}
          onCancel={onCancel}
          onClose={onClose}
        />
      );
    });

    // Check title
    const title = container.querySelector('[data-testid="scan-title"]');
    expect(title?.textContent).toBe('Scan Cancelled');

    // Check message
    const message = container.querySelector('[data-testid="scan-message"]');
    expect(message?.textContent).toBe('Scan aborted by user.');

    // Cancelled banner
    const banner = container.querySelector(
      '[data-testid="cancelled-summary-banner"]'
    );
    expect(banner).not.toBeNull();

    // In cancelled state, Done button is available to close
    const doneBtn = container.querySelector(
      '[data-testid="done-scan-button"]'
    ) as HTMLButtonElement;
    expect(doneBtn).not.toBeNull();

    act(() => {
      doneBtn.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles result.cancelled === true when progress is null', () => {
    const mockResult: SmartSyncResult = {
      matches: [],
      unmatchedAdvices: [],
      cancelled: true,
      stats: {
        totalFound: 5,
        skippedSettled: 2,
        cachedReused: 1,
        newlyParsed: 2,
        matchesCount: 0,
      },
    };

    act(() => {
      root.render(
        <ScanProgressModal
          isOpen={true}
          progress={null}
          result={mockResult}
          onCancel={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    const title = container.querySelector('[data-testid="scan-title"]');
    expect(title?.textContent).toBe('Scan Cancelled');
  });

  it('falls back to appropriate default messages when progress message is missing', () => {
    act(() => {
      root.render(
        <ScanProgressModal
          isOpen={true}
          progress={{
            phase: 'filtering',
            current: 0,
            total: 10,
            message: '',
          }}
          onCancel={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    const message = container.querySelector('[data-testid="scan-message"]');
    expect(message?.textContent).toContain(
      'Checking local cache & skipping settled claims...'
    );
  });

  it('clicking top-right X button calls onCancel when scan is in progress and onClose when complete', () => {
    const onCancel = vi.fn();
    const onClose = vi.fn();

    // 1. In progress
    act(() => {
      root.render(
        <ScanProgressModal
          isOpen={true}
          progress={{
            phase: 'processing',
            current: 1,
            total: 3,
            message: 'In flight...',
          }}
          onCancel={onCancel}
          onClose={onClose}
        />
      );
    });

    const closeIconBtn = container.querySelector(
      '[data-testid="modal-close-icon-btn"]'
    ) as HTMLButtonElement;
    expect(closeIconBtn).not.toBeNull();

    act(() => {
      closeIconBtn.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    // 2. Complete
    act(() => {
      root.render(
        <ScanProgressModal
          isOpen={true}
          progress={{
            phase: 'complete',
            current: 3,
            total: 3,
            message: 'Finished',
          }}
          onCancel={onCancel}
          onClose={onClose}
        />
      );
    });

    act(() => {
      closeIconBtn.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
