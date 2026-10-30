import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AtAccidentForm } from '../AtAccidentForm';
import { useClaimStore } from '@/stores/claim-store';
import { createBlankClaim } from '@/types';

vi.mock('@/stores/claim-store', () => ({
  useClaimStore: vi.fn(),
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

describe('AtAccidentForm', () => {
  let mockUpdateVehicle: ReturnType<typeof vi.fn>;
  let mockUpdateSpotDetails: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpdateVehicle = vi.fn();
    mockUpdateSpotDetails = vi.fn();
  });

  it('renders "Load at Accident (KG)" input for commercial vehicles', () => {
    const claim = {
      ...createBlankClaim('final', 'comm-goods'),
      spotDetails: {
        ...createBlankClaim('final', 'comm-goods').spotDetails,
        actualLoad: 8500,
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateVehicle: mockUpdateVehicle,
      updateSpotDetails: mockUpdateSpotDetails,
    } as any);

    const html = renderToStaticMarkup(<AtAccidentForm />);
    expect(html).toContain('Load at Accident (KG)');
    expect(html).toContain('id="c-actual-load"');
    expect(html).toContain('value="8500"');
  });

  it('asserts that "Goods Weight at Accident" input (htmlFor="v-goods-weight") is NO LONGER present in the DOM', () => {
    const claim = createBlankClaim('final', 'comm-goods');

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateVehicle: mockUpdateVehicle,
      updateSpotDetails: mockUpdateSpotDetails,
    } as any);

    const html = renderToStaticMarkup(<AtAccidentForm />);
    expect(html).not.toContain('Goods Weight at Accident');
    expect(html).not.toContain('v-goods-weight');

    const tree = AtAccidentForm();
    const goodsWeightInput = findElementById(tree, 'v-goods-weight');
    expect(goodsWeightInput).toBeNull();
  });

  it('asserts that changing "Load at Accident (KG)" updates both spotDetails.actualLoad and vehicle.goodsWeightAtAccident', () => {
    const claim = createBlankClaim('final', 'comm-goods');

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateVehicle: mockUpdateVehicle,
      updateSpotDetails: mockUpdateSpotDetails,
    } as any);

    const tree = AtAccidentForm();
    const actualLoadInput = findElementById(tree, 'c-actual-load');
    expect(actualLoadInput).not.toBeNull();

    // Change to a numeric load value
    actualLoadInput.props.onChange({ target: { value: '14000' } });
    expect(mockUpdateSpotDetails).toHaveBeenCalledWith({ actualLoad: 14000 });
    expect(mockUpdateVehicle).toHaveBeenCalledWith({
      goodsWeightAtAccident: '14000',
      actualPayload: '14000',
    });

    // Clear the input value
    actualLoadInput.props.onChange({ target: { value: '' } });
    expect(mockUpdateSpotDetails).toHaveBeenCalledWith({ actualLoad: null });
    expect(mockUpdateVehicle).toHaveBeenCalledWith({
      goodsWeightAtAccident: '',
      actualPayload: '',
    });
  });

  it('asserts fallback: when spotDetails.actualLoad is unset/null/0 but vehicle.goodsWeightAtAccident has a value, the input displays the fallback', () => {
    // Case 1: actualLoad is null
    const claimWithNullLoad = {
      ...createBlankClaim('final', 'comm-goods'),
      spotDetails: {
        ...createBlankClaim('final', 'comm-goods').spotDetails,
        actualLoad: null,
      },
      vehicle: {
        ...createBlankClaim('final', 'comm-goods').vehicle,
        goodsWeightAtAccident: '12500',
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claimWithNullLoad,
      updateVehicle: mockUpdateVehicle,
      updateSpotDetails: mockUpdateSpotDetails,
    } as any);

    const html1 = renderToStaticMarkup(<AtAccidentForm />);
    expect(html1).toContain('value="12500"');

    const tree1 = AtAccidentForm();
    const input1 = findElementById(tree1, 'c-actual-load');
    expect(input1.props.value).toBe(12500);

    // Case 2: actualLoad is 0
    const claimWithZeroLoad = {
      ...createBlankClaim('final', 'comm-goods'),
      spotDetails: {
        ...createBlankClaim('final', 'comm-goods').spotDetails,
        actualLoad: 0,
      },
      vehicle: {
        ...createBlankClaim('final', 'comm-goods').vehicle,
        goodsWeightAtAccident: '12,500 KG',
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claimWithZeroLoad,
      updateVehicle: mockUpdateVehicle,
      updateSpotDetails: mockUpdateSpotDetails,
    } as any);

    const html2 = renderToStaticMarkup(<AtAccidentForm />);
    expect(html2).toContain('value="12500"');

    const tree2 = AtAccidentForm();
    const input2 = findElementById(tree2, 'c-actual-load');
    expect(input2.props.value).toBe(12500);
  });

  it('asserts that separate "Nature of Goods" input (htmlFor="v-goods-nature") is NO LONGER present in the DOM', () => {
    const claim = createBlankClaim('final', 'comm-goods');

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateVehicle: mockUpdateVehicle,
      updateSpotDetails: mockUpdateSpotDetails,
    } as any);

    const html = renderToStaticMarkup(<AtAccidentForm />);
    expect(html).not.toContain('v-goods-nature');
    expect(html).not.toContain('Nature of Goods');

    const tree = AtAccidentForm();
    const goodsNatureInput = findElementById(tree, 'v-goods-nature');
    expect(goodsNatureInput).toBeNull();
  });

  it('asserts that "Nature / Description of Goods" input (c-goods) displays fallback from natureOfGoods or detailsOfGoodsCarried when spotDetails.loadDesc is empty', () => {
    // Case 1: fallback from natureOfGoods
    const claim1 = {
      ...createBlankClaim('final', 'comm-goods'),
      spotDetails: {
        ...createBlankClaim('final', 'comm-goods').spotDetails,
        loadDesc: '',
      },
      vehicle: {
        ...createBlankClaim('final', 'comm-goods').vehicle,
        natureOfGoods: 'TIMBER LOGS',
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim1,
      updateVehicle: mockUpdateVehicle,
      updateSpotDetails: mockUpdateSpotDetails,
    } as any);

    const html1 = renderToStaticMarkup(<AtAccidentForm />);
    expect(html1).toContain('Nature / Description of Goods');
    expect(html1).toContain('value="TIMBER LOGS"');

    const tree1 = AtAccidentForm();
    const input1 = findElementById(tree1, 'c-goods');
    expect(input1.props.value).toBe('TIMBER LOGS');

    // Case 2: fallback from detailsOfGoodsCarried
    const claim2 = {
      ...createBlankClaim('final', 'comm-goods'),
      spotDetails: {
        ...createBlankClaim('final', 'comm-goods').spotDetails,
        loadDesc: '',
      },
      vehicle: {
        ...createBlankClaim('final', 'comm-goods').vehicle,
        natureOfGoods: '',
        detailsOfGoodsCarried: 'TEXTILE GOODS',
      },
    };

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim2,
      updateVehicle: mockUpdateVehicle,
      updateSpotDetails: mockUpdateSpotDetails,
    } as any);

    const tree2 = AtAccidentForm();
    const input2 = findElementById(tree2, 'c-goods');
    expect(input2.props.value).toBe('TEXTILE GOODS');
  });

  it('asserts that changing "c-goods" calls updateSpotDetails and updateVehicle (natureOfGoods, detailsOfGoodsCarried)', () => {
    const claim = createBlankClaim('final', 'comm-goods');

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateVehicle: mockUpdateVehicle,
      updateSpotDetails: mockUpdateSpotDetails,
    } as any);

    const tree = AtAccidentForm();
    const goodsInput = findElementById(tree, 'c-goods');
    expect(goodsInput).not.toBeNull();

    goodsInput.props.onChange({ target: { value: 'Iron Rods' } });
    expect(mockUpdateSpotDetails).toHaveBeenCalledWith({ loadDesc: 'Iron Rods' });
    expect(mockUpdateVehicle).toHaveBeenCalledWith({
      natureOfGoods: 'IRON RODS',
      detailsOfGoodsCarried: 'Iron Rods',
    });
  });
});
