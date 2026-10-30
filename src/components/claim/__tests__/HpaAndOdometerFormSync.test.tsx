import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PolicyDetailsForm } from '../PolicyForm';
import { VehicleDetailsForm } from '../VehicleForm';
import { SurveyForm } from '../SurveyForm';
import { ValuationTab } from '@/components/tabs/ValuationTab';
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

function findElement(tree: any, predicate: (node: any) => boolean): any {
  if (!tree) return null;
  if (predicate(tree)) return tree;
  if (Array.isArray(tree)) {
    for (const item of tree) {
      const found = findElement(item, predicate);
      if (found) return found;
    }
  }
  if (tree.props?.children) {
    return findElement(tree.props.children, predicate);
  }
  return null;
}

function findElementById(tree: any, id: string): any {
  return findElement(tree, (node) => node.props?.id === id);
}

describe('HpaAndOdometerFormSync', () => {
  let mockUpdatePolicy: ReturnType<typeof vi.fn>;
  let mockUpdateVehicle: ReturnType<typeof vi.fn>;
  let mockUpdateValuationDetails: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpdatePolicy = vi.fn();
    mockUpdateVehicle = vi.fn();
    mockUpdateValuationDetails = vi.fn();
  });

  describe('PolicyForm HPA Sync & Fallback', () => {
    it('displays fallback from vehicle.hypothecation or vehicle.rcEndorsement when policy.hpaWith is empty', () => {
      // Case 1: fallback from vehicle.hypothecation
      const claim1 = {
        ...createBlankClaim('final', 'private'),
        policy: {
          ...createBlankClaim('final', 'private').policy,
          hpaWith: '',
        },
        vehicle: {
          ...createBlankClaim('final', 'private').vehicle,
          hypothecation: 'HDFC BANK LTD',
          rcEndorsement: '',
        },
      };

      vi.mocked(useClaimStore).mockReturnValue({
        currentClaim: claim1,
        updatePolicy: mockUpdatePolicy,
        updateVehicle: mockUpdateVehicle,
      } as any);

      const html1 = renderToStaticMarkup(<PolicyDetailsForm />);
      expect(html1).toContain('value="HDFC BANK LTD"');

      const tree1 = PolicyDetailsForm({});
      const input1 = findElementById(tree1, 'p-hpa');
      expect(input1.props.value).toBe('HDFC BANK LTD');

      // Case 2: fallback from vehicle.rcEndorsement
      const claim2 = {
        ...createBlankClaim('final', 'private'),
        policy: {
          ...createBlankClaim('final', 'private').policy,
          hpaWith: '',
        },
        vehicle: {
          ...createBlankClaim('final', 'private').vehicle,
          hypothecation: '',
          rcEndorsement: 'ICICI BANK LTD',
        },
      };

      vi.mocked(useClaimStore).mockReturnValue({
        currentClaim: claim2,
        updatePolicy: mockUpdatePolicy,
        updateVehicle: mockUpdateVehicle,
      } as any);

      const tree2 = PolicyDetailsForm({});
      const input2 = findElementById(tree2, 'p-hpa');
      expect(input2.props.value).toBe('ICICI BANK LTD');
    });

    it('updates both policy.hpaWith and vehicle.hypothecation/rcEndorsement when p-hpa changes', () => {
      const claim = createBlankClaim('final', 'private');

      vi.mocked(useClaimStore).mockReturnValue({
        currentClaim: claim,
        updatePolicy: mockUpdatePolicy,
        updateVehicle: mockUpdateVehicle,
      } as any);

      const tree = PolicyDetailsForm({});
      const input = findElementById(tree, 'p-hpa');
      input.props.onChange({ target: { value: 'State Bank of India' } });

      expect(mockUpdatePolicy).toHaveBeenCalledWith({ hpaWith: 'State Bank of India' });
      expect(mockUpdateVehicle).toHaveBeenCalledWith({
        hypothecation: 'STATE BANK OF INDIA',
        rcEndorsement: 'STATE BANK OF INDIA',
      });
    });
  });

  describe('VehicleForm HPA & RC Endorsement Sync & Fallback', () => {
    it('displays fallback from policy.hpaWith for v-hpa and v-rc-end when vehicle fields are empty', () => {
      const claim = {
        ...createBlankClaim('final', 'private'),
        policy: {
          ...createBlankClaim('final', 'private').policy,
          hpaWith: 'KOTAK MAHINDRA PRIME',
        },
        vehicle: {
          ...createBlankClaim('final', 'private').vehicle,
          hypothecation: '',
          rcEndorsement: '',
        },
      };

      vi.mocked(useClaimStore).mockReturnValue({
        currentClaim: claim,
        updateVehicle: mockUpdateVehicle,
        updatePolicy: mockUpdatePolicy,
      } as any);

      const html = renderToStaticMarkup(<VehicleDetailsForm />);
      expect(html).toContain('value="KOTAK MAHINDRA PRIME"');

      const tree = VehicleDetailsForm({});
      const hpaInput = findElementById(tree, 'v-hpa');
      const rcEndInput = findElementById(tree, 'v-rc-end');

      expect(hpaInput.props.value).toBe('KOTAK MAHINDRA PRIME');
      expect(rcEndInput.props.value).toBe('KOTAK MAHINDRA PRIME');
    });

    it('updates vehicle hypothecation, rcEndorsement and policy hpaWith when v-hpa changes', () => {
      const claim = createBlankClaim('final', 'private');

      vi.mocked(useClaimStore).mockReturnValue({
        currentClaim: claim,
        updateVehicle: mockUpdateVehicle,
        updatePolicy: mockUpdatePolicy,
      } as any);

      const tree = VehicleDetailsForm({});
      const hpaInput = findElementById(tree, 'v-hpa');
      hpaInput.props.onChange({ target: { value: 'Axis Bank Ltd' } });

      expect(mockUpdateVehicle).toHaveBeenCalledWith({
        hypothecation: 'AXIS BANK LTD',
        rcEndorsement: 'AXIS BANK LTD',
      });
      expect(mockUpdatePolicy).toHaveBeenCalledWith({ hpaWith: 'AXIS BANK LTD' });
    });

    it('updates vehicle and policy when v-rc-end changes', () => {
      const claim = {
        ...createBlankClaim('final', 'private'),
        policy: {
          ...createBlankClaim('final', 'private').policy,
          hpaWith: '',
        },
        vehicle: {
          ...createBlankClaim('final', 'private').vehicle,
          hypothecation: '',
          rcEndorsement: '',
        },
      };

      vi.mocked(useClaimStore).mockReturnValue({
        currentClaim: claim,
        updateVehicle: mockUpdateVehicle,
        updatePolicy: mockUpdatePolicy,
      } as any);

      const tree = VehicleDetailsForm({});
      const rcEndInput = findElementById(tree, 'v-rc-end');
      rcEndInput.props.onChange({ target: { value: 'Bajaj Finance' } });

      expect(mockUpdateVehicle).toHaveBeenCalledWith({ rcEndorsement: 'BAJAJ FINANCE' });
      expect(mockUpdateVehicle).toHaveBeenCalledWith({ hypothecation: 'BAJAJ FINANCE' });
      expect(mockUpdatePolicy).toHaveBeenCalledWith({ hpaWith: 'BAJAJ FINANCE' });
    });
  });

  describe('Odometer Sync & Fallback between SurveyForm and ValuationTab', () => {
    it('SurveyForm Odometer displays fallback from valuationDetails.odometer when vehicle.odometer is empty', () => {
      const claim = {
        ...createBlankClaim('final', 'private'),
        vehicle: {
          ...createBlankClaim('final', 'private').vehicle,
          odometer: '',
        },
        valuationDetails: {
          ...createBlankClaim('final', 'private').valuationDetails,
          odometer: '45000',
        },
      };

      vi.mocked(useClaimStore).mockReturnValue({
        currentClaim: claim,
        updateAccident: vi.fn(),
        updateVehicle: mockUpdateVehicle,
        updateSpotDetails: vi.fn(),
        updateValuationDetails: mockUpdateValuationDetails,
      } as any);

      const html = renderToStaticMarkup(<SurveyForm claim={claim} />);
      expect(html).toContain('value="45000"');

      const tree = SurveyForm({ claim });
      const odoInput = findElementById(tree, 'v-odo');
      expect(odoInput.props.value).toBe('45000');
    });

    it('SurveyForm Odometer onChange updates both vehicle and valuationDetails', () => {
      const claim = createBlankClaim('final', 'private');

      vi.mocked(useClaimStore).mockReturnValue({
        currentClaim: claim,
        updateAccident: vi.fn(),
        updateVehicle: mockUpdateVehicle,
        updateSpotDetails: vi.fn(),
        updateValuationDetails: mockUpdateValuationDetails,
      } as any);

      const tree = SurveyForm({ claim });
      const odoInput = findElementById(tree, 'v-odo');
      odoInput.props.onChange({ target: { value: '52000' } });

      expect(mockUpdateVehicle).toHaveBeenCalledWith({ odometer: '52000' });
      expect(mockUpdateValuationDetails).toHaveBeenCalledWith({ odometer: '52000' });
    });

    it('ValuationTab Odometer displays fallback from vehicle.odometer when valuationDetails.odometer is empty', () => {
      const claim = {
        ...createBlankClaim('valuation', 'private'),
        vehicle: {
          ...createBlankClaim('valuation', 'private').vehicle,
          odometer: '68000',
        },
        valuationDetails: {
          ...createBlankClaim('valuation', 'private').valuationDetails,
          odometer: '',
        },
      };

      vi.mocked(useClaimStore).mockReturnValue({
        currentClaim: claim,
        updateValuationDetails: mockUpdateValuationDetails,
        updateVehicle: mockUpdateVehicle,
      } as any);

      const html = renderToStaticMarkup(<ValuationTab />);
      expect(html).toContain('value="68000"');

      const tree = ValuationTab();
      const odoInput = findElement(tree, (node) => node.props?.placeholder === 'e.g. 42987');
      expect(odoInput.props.value).toBe('68000');
    });

    it('ValuationTab Odometer onChange updates both valuationDetails and vehicle', () => {
      const claim = createBlankClaim('valuation', 'private');

      vi.mocked(useClaimStore).mockReturnValue({
        currentClaim: claim,
        updateValuationDetails: mockUpdateValuationDetails,
        updateVehicle: mockUpdateVehicle,
      } as any);

      const tree = ValuationTab();
      const odoInput = findElement(tree, (node) => node.props?.placeholder === 'e.g. 42987');
      odoInput.props.onChange({ target: { value: '71000' } });

      expect(mockUpdateValuationDetails).toHaveBeenCalledWith({ odometer: '71000' });
      expect(mockUpdateVehicle).toHaveBeenCalledWith({ odometer: '71000' });
    });
  });
});
