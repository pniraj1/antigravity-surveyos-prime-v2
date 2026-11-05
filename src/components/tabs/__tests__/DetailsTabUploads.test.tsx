import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VehicleDetailsForm } from '@/components/claim/VehicleForm';
import { DriverDetailsForm } from '@/components/claim/DriverForm';
import { PolicyDetailsForm } from '@/components/claim/PolicyForm';
import { DetailsTab } from '../DetailsTab';
import { useClaimStore } from '@/stores/claim-store';
import { createBlankClaim } from '@/types';
import { ingestDocument } from '@/lib/documents/ingest';
import { storeFiles } from '@/components/evidence/DocumentEvidenceViewer';

// Spies
export const mockTriggerExtraction = vi.fn();
export const mockUsePhoneFiles = vi.fn();
export const capturedDocSections: Record<string, any> = {};

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

vi.mock('@/lib/documents/ingest', () => ({
  ingestDocument: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/components/evidence/DocumentEvidenceViewer', () => ({
  storeFiles: vi.fn(),
  useEvidenceStore: () => ({ field: null, blobUrls: {} }),
}));

vi.mock('@/components/documents/UsePhoneFiles', () => ({
  UsePhoneFiles: (props: any) => {
    mockUsePhoneFiles(props);
    return (
      <button data-testid="use-phone-button" data-types={props.types?.join(',')}>
        Use phone files
      </button>
    );
  },
}));

vi.mock('@/hooks/useAIExtraction', () => ({
  useAIExtraction: () => ({
    isProcessing: false,
    progress: '',
    reviewData: null,
    triggerExtraction: mockTriggerExtraction,
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

vi.mock('@/lib/ai/needs-review', () => ({
  needsReview: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/hooks/useFieldEvidence', () => ({
  useFieldEvidence: () => ({
    triggerField: vi.fn(),
    hasEvidence: () => false,
  }),
}));

vi.mock('@/components/claim/form-bits', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    DocSection: (props: any) => {
      capturedDocSections[props.title] = props;
      return (
        <div data-testid={`section-${props.title}`}>
          <div data-testid="section-action">{props.action}</div>
          <div data-testid="section-children">{props.children}</div>
        </div>
      );
    },
  };
});

// Mock other tabs/panels inside DetailsTab to keep tests fast and isolated
vi.mock('@/components/evidence/InlineEvidencePanel', () => ({
  InlineEvidencePanel: () => <div data-testid="inline-evidence-panel" />,
  DOC_LABELS: {},
}));

vi.mock('@/components/evidence/EvidencePanelSlot', () => ({
  EvidencePanelSlot: ({ children }: any) => <div data-testid="evidence-slot">{children}</div>,
}));

vi.mock('@/components/dialogs/AIReviewDialog', () => ({
  AIReviewDialog: () => null,
}));

vi.mock('@/components/documents/DocumentReviewSheet', () => ({
  DocumentReviewSheet: () => null,
}));

vi.mock('@/components/claim/AssignmentForm', () => ({ AssignmentForm: () => null }));
vi.mock('@/components/claim/PermitForm', () => ({ PermitForm: () => null }));
vi.mock('@/components/claim/AccidentForm', () => ({ AccidentDetailsForm: () => null }));
vi.mock('@/components/claim/AtAccidentForm', () => ({ AtAccidentForm: () => null }));
vi.mock('@/components/claim/SurveyForm', () => ({ SurveyForm: () => null }));
vi.mock('@/components/claim/DocumentChecklist', () => ({ DocumentChecklist: () => null }));
vi.mock('@/components/tabs/SpotTab', () => ({ SpotTab: () => null }));

describe('DetailsTab direct uploads and phone scans support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(capturedDocSections)) {
      delete capturedDocSections[key];
    }
    const claim = {
      ...createBlankClaim('final', 'private'),
      id: 'claim-test-123',
      vehicle: {
        registrationNumber: 'MH12AB1234',
        make: 'Maruti',
        model: 'Swift',
      },
      driver: {
        name: 'Rahul Sharma',
      },
      policy: {
        policyNumber: 'POL-999',
      },
    };
    mockStoreState = {
      currentClaim: claim,
      updateClaim: vi.fn(),
      updateVehicle: vi.fn(),
      updateDriver: vi.fn(),
      updatePolicy: vi.fn(),
      updateSpotDetails: vi.fn(),
    };
  });

  describe('Form Components (VehicleForm, DriverForm, PolicyForm) support usePhone', () => {
    it('VehicleDetailsForm accepts and renders usePhone alongside scan', () => {
      const scanNode = <button id="custom-scan">Scan RC</button>;
      const phoneNode = <button id="custom-phone">Use phone files</button>;

      const html = renderToStaticMarkup(<VehicleDetailsForm scan={scanNode} usePhone={phoneNode} />);

      expect(html).toContain('id="custom-scan"');
      expect(html).toContain('id="custom-phone"');

      // Check captured DocSection action
      const rcSection = capturedDocSections['Registration Certificate (RC)'];
      expect(rcSection).toBeDefined();
      expect(rcSection.action).toBeDefined();
    });

    it('DriverDetailsForm accepts and renders usePhone alongside scan', () => {
      const scanNode = <button id="custom-dl-scan">Scan DL</button>;
      const phoneNode = <button id="custom-dl-phone">Use phone files</button>;

      const html = renderToStaticMarkup(<DriverDetailsForm scan={scanNode} usePhone={phoneNode} />);

      expect(html).toContain('id="custom-dl-scan"');
      expect(html).toContain('id="custom-dl-phone"');

      const dlSection = capturedDocSections['Driving Licence'];
      expect(dlSection).toBeDefined();
      expect(dlSection.action).toBeDefined();
    });

    it('PolicyDetailsForm accepts and renders usePhone alongside scan', () => {
      const scanNode = <button id="custom-policy-scan">Scan Policy</button>;
      const phoneNode = <button id="custom-policy-phone">Use phone files</button>;

      const html = renderToStaticMarkup(<PolicyDetailsForm scan={scanNode} usePhone={phoneNode} />);

      expect(html).toContain('id="custom-policy-scan"');
      expect(html).toContain('id="custom-policy-phone"');

      const polSection = capturedDocSections['Policy & Insured'];
      expect(polSection).toBeDefined();
      expect(polSection.action).toBeDefined();
    });
  });

  describe('DetailsTab Direct Upload Persistence', () => {
    it('uploading an RC file invokes ingestDocument with claimId, docType, file, slotKey, and triggerExtraction', async () => {
      renderToStaticMarkup(<DetailsTab />);

      const rcSection = capturedDocSections['Registration Certificate (RC)'];
      expect(rcSection).toBeDefined();

      // Find the scan element inside action
      // action is: <div className="flex items-center gap-2">{usePhone}{scan}</div>
      const action = rcSection.action;
      expect(action).toBeDefined();

      const children = Array.isArray(action.props?.children) ? action.props.children : [action];
      const scanButton = children.find((c: any) => c?.props?.label?.includes('RC Copy') || c?.props?.onFile) ?? action;
      expect(scanButton.props.onFile).toBeInstanceOf(Function);

      const mockFile = new File(['mock rc content'], 'rc-smart-card.pdf', { type: 'application/pdf' });
      await scanButton.props.onFile({ target: { files: [mockFile], value: '' } });

      expect(ingestDocument).toHaveBeenCalledTimes(1);
      expect(ingestDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          claimId: 'claim-test-123',
          docType: 'rc',
          file: mockFile,
          slotKey: 'rc',
          triggerExtraction: mockTriggerExtraction,
        })
      );
    });

    it('falls back to triggerExtraction if ingestDocument throws an error', async () => {
      vi.mocked(ingestDocument).mockRejectedValueOnce(new Error('Folder write failure'));

      renderToStaticMarkup(<DetailsTab />);

      const rcSection = capturedDocSections['Registration Certificate (RC)'];
      const action = rcSection.action;
      const children = Array.isArray(action.props?.children) ? action.props.children : [action];
      const scanButton = children.find((c: any) => c?.props?.label?.includes('RC Copy') || c?.props?.onFile) ?? action;

      const mockFile = new File(['mock rc content'], 'rc-smart-card.pdf', { type: 'application/pdf' });
      await scanButton.props.onFile({ target: { files: [mockFile], value: '' } });

      expect(ingestDocument).toHaveBeenCalledTimes(1);
      expect(mockTriggerExtraction).toHaveBeenCalledWith('rc', mockFile);
    });
  });

  describe('DetailsTab Phone Files Picker Support', () => {
    it('mounts UsePhoneFiles for RC, DL, and Policy with appropriate document types', () => {
      renderToStaticMarkup(<DetailsTab />);

      // Check UsePhoneFiles calls
      const rcPhoneCall = mockUsePhoneFiles.mock.calls.find((c: any) => c[0].types?.includes('rc'));
      const dlPhoneCall = mockUsePhoneFiles.mock.calls.find((c: any) => c[0].types?.includes('dl'));
      const policyPhoneCall = mockUsePhoneFiles.mock.calls.find((c: any) => c[0].types?.includes('policy'));

      expect(rcPhoneCall).toBeDefined();
      expect(rcPhoneCall![0].types).toEqual(['rc', 'rcBack']);

      expect(dlPhoneCall).toBeDefined();
      expect(dlPhoneCall![0].types).toEqual(['dl', 'dlBack']);

      expect(policyPhoneCall).toBeDefined();
      expect(policyPhoneCall![0].types).toEqual(['policy']);
    });

    it('calling onPick on RC UsePhoneFiles stores file in evidence and triggers extraction', async () => {
      renderToStaticMarkup(<DetailsTab />);

      const rcPhoneCall = mockUsePhoneFiles.mock.calls.find((c: any) => c[0].types?.includes('rc'));
      expect(rcPhoneCall).toBeDefined();
      const onPick = rcPhoneCall![0].onPick;
      expect(onPick).toBeInstanceOf(Function);

      const mockPhoneFile = new File(['phone scan'], 'phone-rc.jpg', { type: 'image/jpeg' });
      await onPick(mockPhoneFile);

      expect(storeFiles).toHaveBeenCalledWith('claim-test-123', 'rc', [mockPhoneFile]);
      expect(mockTriggerExtraction).toHaveBeenCalledWith('rc', mockPhoneFile);
    });

    it('calling onPick on DL UsePhoneFiles stores file in evidence and triggers extraction', async () => {
      renderToStaticMarkup(<DetailsTab />);

      const dlPhoneCall = mockUsePhoneFiles.mock.calls.find((c: any) => c[0].types?.includes('dl'));
      expect(dlPhoneCall).toBeDefined();
      const onPick = dlPhoneCall![0].onPick;
      expect(onPick).toBeInstanceOf(Function);

      const mockPhoneFile = new File(['phone scan'], 'phone-dl.jpg', { type: 'image/jpeg' });
      await onPick(mockPhoneFile);

      expect(storeFiles).toHaveBeenCalledWith('claim-test-123', 'dl', [mockPhoneFile]);
      expect(mockTriggerExtraction).toHaveBeenCalledWith('dl', mockPhoneFile);
    });

    it('calling onPick on Policy UsePhoneFiles stores file in evidence and triggers extraction', async () => {
      renderToStaticMarkup(<DetailsTab />);

      const polPhoneCall = mockUsePhoneFiles.mock.calls.find((c: any) => c[0].types?.includes('policy'));
      expect(polPhoneCall).toBeDefined();
      const onPick = polPhoneCall![0].onPick;
      expect(onPick).toBeInstanceOf(Function);

      const mockPhoneFile = new File(['phone scan'], 'phone-policy.pdf', { type: 'application/pdf' });
      await onPick(mockPhoneFile);

      expect(storeFiles).toHaveBeenCalledWith('claim-test-123', 'policy', [mockPhoneFile]);
      expect(mockTriggerExtraction).toHaveBeenCalledWith('policy', mockPhoneFile);
    });
  });
});
