// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DocumentsTab } from '../DocumentsTab';
import { createBlankClaim } from '@/types/claim';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let mockStoreState: any = {};
let mockIsProcessing = false;

vi.mock('@/stores/claim-store', () => {
  const store = vi.fn((selector?: any) => {
    if (typeof selector === 'function') {
      return selector(mockStoreState);
    }
    return mockStoreState;
  });
  (store as any).getState = () => mockStoreState;
  (store as any).setState = (next: any) => {
    mockStoreState = typeof next === 'function' ? next(mockStoreState) : { ...mockStoreState, ...next };
  };
  return {
    useClaimStore: store,
  };
});

vi.mock('@/stores/profile-store', () => ({
  useProfileStore: () => ({
    profile: { aiProvider: 'gemini', autoUploadDrive: false },
    updateProfile: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAIExtraction', () => ({
  useAIExtraction: () => ({
    isProcessing: mockIsProcessing,
    progress: '',
    reviewData: null,
    triggerExtraction: vi.fn(),
    confirmApply: vi.fn(),
    cancelReview: vi.fn(),
    reScanWithFeedback: vi.fn(),
  }),
}));

vi.mock('@/components/ai/AIControls', () => ({
  ProviderToggle: () => null,
  DocModeToggle: () => null,
  ModelSelector: () => null,
  ProviderHealthBadge: () => null,
}));

vi.mock('@/components/documents/FromPhoneButton', () => ({
  FromPhoneButton: () => null,
}));

vi.mock('@/components/documents/AskForDocumentsDialog', () => ({
  AskForDocumentsButton: () => null,
}));

vi.mock('@/components/documents/PhoneFilesList', () => ({
  PhoneFilesList: () => null,
}));

vi.mock('@/components/dialogs/AIReviewDialog', () => ({
  AIReviewDialog: () => null,
}));

vi.mock('@/components/dialogs/DuplicateUploadDialog', () => ({
  DuplicateUploadDialog: () => null,
}));

vi.mock('@/components/sync-bridge/SyncDrivePicker', () => ({
  SyncDrivePicker: () => null,
}));

vi.mock('@/components/documents/DocumentReviewSheet', () => ({
  DocumentReviewSheet: () => null,
}));

vi.mock('@/components/layout/ClaimFolderPromptDialog', () => ({
  ClaimFolderPromptDialog: () => null,
}));

vi.mock('@/lib/documents/useClaimDocuments', () => ({
  useClaimDocuments: () => ({
    docs: [],
    open: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSaveToCloudPrompt', () => ({
  useSaveToCloudPrompt: () => ({
    confirmSaveToCloud: vi.fn().mockResolvedValue(false),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../reconciliation/ReconciliationDialog', () => ({
  ReconciliationDialog: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="reconciliation-dialog">
        <span>Reconciliation Dialog Open</span>
        <button data-testid="close-dialog" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

describe('DocumentsTab Sticky Reconciliation Dock', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsProcessing = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders the floating dock with conflict count and Review & Reconcile button when conflicts exist', () => {
    const claim = createBlankClaim('final', 'private');
    claim.vehicle.registrationNumber = 'MH12AB1234';
    claim.extractedData = {
      rc: { engine_number: 'ENG111', registration_number: 'MH12AB1234' },
      policy: { engine_number: 'ENG222', registration_number: 'MH12AB1234' },
    };

    mockStoreState = {
      currentClaim: claim,
      batchReconcile: vi.fn(),
      setReconciliationConflictCount: vi.fn(),
    };

    act(() => {
      root.render(<DocumentsTab />);
    });

    const dock = container.querySelector('[data-testid="recon-conflict-dock"]');
    expect(dock).not.toBeNull();
    expect(dock?.className).toContain('fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40');
    expect(dock?.getAttribute('role')).toBe('region');
    expect(dock?.getAttribute('aria-label')).toBe('Data reconciliation alert');
    expect(dock?.textContent).toContain('1 Data Conflict Detected');
    expect(dock?.textContent).toContain('Values differ across scanned documents');

    const button = dock?.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain('Review & Reconcile');
  });

  it('pluralizes correctly when multiple conflicts exist', () => {
    const claim = createBlankClaim('final', 'private');
    claim.vehicle.registrationNumber = 'MH12AB1234';
    claim.extractedData = {
      rc: { engine_number: 'ENG111', chassis_number: 'CHAS111' },
      policy: { engine_number: 'ENG222', chassis_number: 'CHAS222' },
    };

    mockStoreState = {
      currentClaim: claim,
      batchReconcile: vi.fn(),
      setReconciliationConflictCount: vi.fn(),
    };

    act(() => {
      root.render(<DocumentsTab />);
    });

    const dock = container.querySelector('[data-testid="recon-conflict-dock"]');
    expect(dock).not.toBeNull();
    expect(dock?.textContent).toContain('2 Data Conflicts Detected');
  });

  it('opens the reconciliation dialog when clicking the Review & Reconcile button in the floating dock', () => {
    const claim = createBlankClaim('final', 'private');
    claim.vehicle.registrationNumber = 'MH12AB1234';
    claim.extractedData = {
      rc: { engine_number: 'ENG111' },
      policy: { engine_number: 'ENG222' },
    };

    mockStoreState = {
      currentClaim: claim,
      batchReconcile: vi.fn(),
      setReconciliationConflictCount: vi.fn(),
    };

    act(() => {
      root.render(<DocumentsTab />);
    });

    // Dialog is initially closed
    expect(container.querySelector('[data-testid="reconciliation-dialog"]')).toBeNull();

    const dock = container.querySelector('[data-testid="recon-conflict-dock"]');
    const button = dock?.querySelector('button');
    expect(button).not.toBeNull();

    // Click the Review & Reconcile button
    act(() => {
      button?.click();
    });

    // Dialog is now open
    expect(container.querySelector('[data-testid="reconciliation-dialog"]')).not.toBeNull();
    expect(container.textContent).toContain('Reconciliation Dialog Open');
  });

  it('renders the compact floating dock when no conflicts exist but multiple documents are scanned', () => {
    const claim = createBlankClaim('final', 'private');
    claim.vehicle.registrationNumber = 'MH12AB1234';
    claim.extractedData = {
      rc: { registration_number: 'MH12AB1234' },
      policy: { registration_number: 'MH12AB1234' },
    };

    mockStoreState = {
      currentClaim: claim,
      batchReconcile: vi.fn(),
      setReconciliationConflictCount: vi.fn(),
    };

    act(() => {
      root.render(<DocumentsTab />);
    });

    // Conflict dock should NOT be rendered
    expect(container.querySelector('[data-testid="recon-conflict-dock"]')).toBeNull();

    // Compact dock should be rendered at bottom-right
    const compactDock = container.querySelector('[data-testid="recon-compact-dock"]');
    expect(compactDock).not.toBeNull();
    expect(compactDock?.className).toContain('fixed bottom-20 md:bottom-6 right-6 z-40');
    expect(compactDock?.textContent).toContain('Reconciliation Hub (2 docs scanned)');

    // Clicking it should also open the dialog
    const button = compactDock?.querySelector('button');
    expect(button).not.toBeNull();

    act(() => {
      button?.click();
    });

    expect(container.querySelector('[data-testid="reconciliation-dialog"]')).not.toBeNull();
  });

  it('does not render docks when isProcessing is true', () => {
    mockIsProcessing = true;
    const claim = createBlankClaim('final', 'private');
    claim.vehicle.registrationNumber = 'MH12AB1234';
    claim.extractedData = {
      rc: { engine_number: 'ENG111' },
      policy: { engine_number: 'ENG222' },
    };

    mockStoreState = {
      currentClaim: claim,
      batchReconcile: vi.fn(),
      setReconciliationConflictCount: vi.fn(),
    };

    act(() => {
      root.render(<DocumentsTab />);
    });

    expect(container.querySelector('[data-testid="recon-conflict-dock"]')).toBeNull();
    expect(container.querySelector('[data-testid="recon-compact-dock"]')).toBeNull();
  });
});
