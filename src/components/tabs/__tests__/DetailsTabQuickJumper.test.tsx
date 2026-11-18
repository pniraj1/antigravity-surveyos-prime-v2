import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DetailsTab } from '../DetailsTab';

let mockStoreState: any = {};

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
  useProfileStore: (selector?: any) => {
    const p = {
      getNextSpotNumber: () => 'SPOT-001',
      getNextFinalNumber: () => 'FINAL-001',
      updateProfile: vi.fn(),
      profile: {},
    };
    return typeof selector === 'function' ? selector(p) : p;
  },
}));

vi.mock('@/hooks/useAIExtraction', () => ({
  useAIExtraction: () => ({
    isProcessing: false,
    progress: '',
    reviewData: null,
    triggerExtraction: vi.fn(),
    confirmApply: vi.fn(),
    cancelReview: vi.fn(),
  }),
}));

vi.mock('@/hooks/useEvidencePanel', () => ({
  useEvidencePanel: () => ({
    panelOpen: false,
    togglePanel: vi.fn(),
    containerRef: { current: null },
  }),
}));

vi.mock('@/hooks/useFieldEvidence', () => ({
  useFieldEvidence: () => ({
    triggerField: vi.fn(),
    hasEvidence: () => false,
  }),
}));

// Mock sub-components to keep DetailsTab rendering light and isolated
vi.mock('@/components/claim/AssignmentForm', () => ({ AssignmentForm: () => null }));
vi.mock('@/components/claim/PolicyForm', () => ({ PolicyDetailsForm: () => null }));
vi.mock('@/components/claim/VehicleForm', () => ({ VehicleDetailsForm: () => null }));
vi.mock('@/components/claim/DriverForm', () => ({ DriverDetailsForm: () => null }));
vi.mock('@/components/claim/PermitForm', () => ({ PermitForm: () => null }));
vi.mock('@/components/claim/AccidentForm', () => ({ AccidentDetailsForm: () => null }));
vi.mock('@/components/claim/AtAccidentForm', () => ({ AtAccidentForm: () => null }));
vi.mock('@/components/claim/SurveyForm', () => ({ SurveyForm: () => null }));
vi.mock('@/components/claim/DocumentChecklist', () => ({ DocumentChecklist: () => null }));
vi.mock('@/components/tabs/SpotTab', () => ({ SpotTab: () => null }));
vi.mock('@/components/evidence/InlineEvidencePanel', () => ({ InlineEvidencePanel: () => null }));
vi.mock('@/components/evidence/EvidencePanelSlot', () => ({ EvidencePanelSlot: () => null }));
vi.mock('@/components/documents/DocumentReviewSheet', () => ({ DocumentReviewSheet: () => null }));
vi.mock('@/components/dialogs/AIReviewDialog', () => ({ AIReviewDialog: () => null }));
vi.mock('@/components/documents/UsePhoneFiles', () => ({ UsePhoneFiles: () => null }));

describe('DetailsTab Quick Jumper UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      currentClaim: {
        id: 'claim-test-123',
        surveyType: 'final',
        vehicleType: 'private',
        reportNo: 'FINAL-001',
      },
      updateClaim: vi.fn(),
      updateSpotDetails: vi.fn(),
    };
  });

  it('renders the Quick Jumper button in the header row', () => {
    const html = renderToStaticMarkup(<DetailsTab />);
    // Tests that the tooltip/title contains Alt+J
    expect(html).toContain('Alt+J');
    // Tests that the button text contains Unfilled or All Filled
    expect(html).toMatch(/Unfilled|All Filled/);
    // Checks that the tooltip format matches the expected pattern
    expect(html).toContain('Jump to next unfilled field (Alt+J)');
    // Checks that Evidence button is present in the header alongside Quick Jumper
    expect(html).toContain('Evidence');
  });

  it('renders nothing when currentClaim is null', () => {
    mockStoreState = { currentClaim: null };
    const html = renderToStaticMarkup(<DetailsTab />);
    expect(html).toBe('');
  });
});
