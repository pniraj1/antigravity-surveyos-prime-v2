import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpotTab } from '../SpotTab';
import { VehicleDetailsForm } from '@/components/claim/VehicleForm';
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

function findElementById(tree: any, id: string): any {
  if (!tree) return null;
  if (tree.props?.id === id) return tree;
  if (Array.isArray(tree)) {
    for (const item of tree) {
      const found = findElementById(item, id);
      if (found) return found;
    }
  }
  if (tree.props?.children) {
    return findElementById(tree.props.children, id);
  }
  return null;
}

describe('SpotTab GVW, ULW and Payload Capacity Synchronization', () => {
  let mockUpdateSpotDetails: ReturnType<typeof vi.fn>;
  let mockUpdateVehicle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpdateSpotDetails = vi.fn();
    mockUpdateVehicle = vi.fn();
  });

  it('displays spotDetails.gvw || vehicle.registeredLoadWeight in GVW input', () => {
    // 1) Populated directly on spotDetails
    const claimWithSpotGvw = {
      ...createBlankClaim('spot', 'comm-goods'),
      spotDetails: {
        ...createBlankClaim('spot', 'comm-goods').spotDetails,
        gvw: 16200,
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claimWithSpotGvw,
      updateSpotDetails: mockUpdateSpotDetails,
      updateVehicle: mockUpdateVehicle,
    } as any);

    let tree = SpotTab();
    let gvwInput = findElementById(tree, 'sp-gvw');
    expect(gvwInput.props.value).toBe(16200);

    // 2) Fallback to vehicle.registeredLoadWeight when spotDetails.gvw is not set
    const claimWithVehicleGvw = {
      ...createBlankClaim('spot', 'comm-goods'),
      vehicle: {
        ...createBlankClaim('spot', 'comm-goods').vehicle,
        registeredLoadWeight: '16200 KG',
      },
      spotDetails: {
        ...createBlankClaim('spot', 'comm-goods').spotDetails,
        gvw: null,
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claimWithVehicleGvw,
      updateSpotDetails: mockUpdateSpotDetails,
      updateVehicle: mockUpdateVehicle,
    } as any);

    tree = SpotTab();
    gvwInput = findElementById(tree, 'sp-gvw');
    expect(gvwInput.props.value).toBe(16200);

    const html = renderToStaticMarkup(<SpotTab />);
    expect(html).toContain('id="sp-gvw"');
    expect(html).toContain('value="16200"');
  });

  it('displays spotDetails.ulw || vehicle.unladenWeight in ULW input', () => {
    // 1) Populated directly on spotDetails
    const claimWithSpotUlw = {
      ...createBlankClaim('spot', 'comm-goods'),
      spotDetails: {
        ...createBlankClaim('spot', 'comm-goods').spotDetails,
        ulw: 6200,
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claimWithSpotUlw,
      updateSpotDetails: mockUpdateSpotDetails,
      updateVehicle: mockUpdateVehicle,
    } as any);

    let tree = SpotTab();
    let ulwInput = findElementById(tree, 'sp-ulw');
    expect(ulwInput.props.value).toBe(6200);

    // 2) Fallback to vehicle.unladenWeight when spotDetails.ulw is not set
    const claimWithVehicleUlw = {
      ...createBlankClaim('spot', 'comm-goods'),
      vehicle: {
        ...createBlankClaim('spot', 'comm-goods').vehicle,
        unladenWeight: 6200,
      },
      spotDetails: {
        ...createBlankClaim('spot', 'comm-goods').spotDetails,
        ulw: null,
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claimWithVehicleUlw,
      updateSpotDetails: mockUpdateSpotDetails,
      updateVehicle: mockUpdateVehicle,
    } as any);

    tree = SpotTab();
    ulwInput = findElementById(tree, 'sp-ulw');
    expect(ulwInput.props.value).toBe(6200);

    const html = renderToStaticMarkup(<SpotTab />);
    expect(html).toContain('id="sp-ulw"');
    expect(html).toContain('value="6200"');
  });

  it('computes Payload Capacity (gvw - ulw) automatically even when values were only populated on vehicle', () => {
    const claim = {
      ...createBlankClaim('spot', 'comm-goods'),
      vehicle: {
        ...createBlankClaim('spot', 'comm-goods').vehicle,
        registeredLoadWeight: '16200 KG',
        unladenWeight: 6200,
      },
      spotDetails: {
        ...createBlankClaim('spot', 'comm-goods').spotDetails,
        gvw: null,
        ulw: null,
        loadCapacity: null,
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateSpotDetails: mockUpdateSpotDetails,
      updateVehicle: mockUpdateVehicle,
    } as any);

    const tree = SpotTab();
    const payloadInput = findElementById(tree, 'sp-payload');
    expect(payloadInput.props.value).toBe(10000);

    const html = renderToStaticMarkup(<SpotTab />);
    expect(html).toContain('id="sp-payload"');
    expect(html).toContain('value="10000"');
  });

  it('triggers updates for both spotDetails and vehicle when editing GVW or ULW in SpotTab', () => {
    const claim = {
      ...createBlankClaim('spot', 'comm-goods'),
      vehicle: {
        ...createBlankClaim('spot', 'comm-goods').vehicle,
        registeredLoadWeight: '16200',
        unladenWeight: 6200,
      },
      spotDetails: {
        ...createBlankClaim('spot', 'comm-goods').spotDetails,
        gvw: 16200,
        ulw: 6200,
        loadCapacity: 10000,
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateSpotDetails: mockUpdateSpotDetails,
      updateVehicle: mockUpdateVehicle,
    } as any);

    const tree = SpotTab();
    const gvwInput = findElementById(tree, 'sp-gvw');
    const ulwInput = findElementById(tree, 'sp-ulw');

    // Change GVW to 18000
    gvwInput.props.onChange({ target: { value: '18000' } });
    expect(mockUpdateSpotDetails).toHaveBeenCalledWith({
      gvw: 18000,
      loadCapacity: 11800, // 18000 - 6200
    });
    expect(mockUpdateVehicle).toHaveBeenCalledWith({
      registeredLoadWeight: '18000',
      grossWeight: 18000,
    });

    // Change ULW to 7000
    ulwInput.props.onChange({ target: { value: '7000' } });
    expect(mockUpdateSpotDetails).toHaveBeenCalledWith({
      ulw: 7000,
      loadCapacity: 9200, // 16200 - 7000
    });
    expect(mockUpdateVehicle).toHaveBeenCalledWith({
      unladenWeight: 7000,
    });
  });
});

describe('VehicleDetailsForm GVW and ULW Fallbacks and Updates', () => {
  let mockUpdateVehicle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpdateVehicle = vi.fn();
  });

  it('displays spotDetails.gvw and spotDetails.ulw as fallback in VehicleDetailsForm when vehicle fields are empty', () => {
    const claim = {
      ...createBlankClaim('final', 'comm-goods'),
      vehicle: {
        ...createBlankClaim('final', 'comm-goods').vehicle,
        registeredLoadWeight: '',
        unladenWeight: null,
      },
      spotDetails: {
        ...createBlankClaim('final', 'comm-goods').spotDetails,
        gvw: 16200,
        ulw: 6200,
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateVehicle: mockUpdateVehicle,
    } as any);

    const tree = VehicleDetailsForm({});
    const gvwInput = findElementById(tree, 'v-rlw');
    const ulwInput = findElementById(tree, 'v-ulw');

    expect(gvwInput.props.value).toBe('16200');
    expect(ulwInput.props.value).toBe(6200);
  });

  it('updates registeredLoadWeight and grossWeight when GVW is changed in VehicleDetailsForm', () => {
    const claim = createBlankClaim('final', 'comm-goods');

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateVehicle: mockUpdateVehicle,
    } as any);

    const tree = VehicleDetailsForm({});
    const gvwInput = findElementById(tree, 'v-rlw');

    gvwInput.props.onChange({ target: { value: '16200 KG' } });
    expect(mockUpdateVehicle).toHaveBeenCalledWith({
      registeredLoadWeight: '16200 KG',
      grossWeight: 16200,
    });
  });

  it('updates unladenWeight when ULW is changed in VehicleDetailsForm', () => {
    const claim = createBlankClaim('final', 'comm-goods');

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateVehicle: mockUpdateVehicle,
    } as any);

    const tree = VehicleDetailsForm({});
    const ulwInput = findElementById(tree, 'v-ulw');

    ulwInput.props.onChange({ target: { value: '6200' } });
    expect(mockUpdateVehicle).toHaveBeenCalledWith({
      unladenWeight: 6200,
    });
  });
});
