import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { createClaimSlice, type ClaimSlice } from '../claimSlice';
import { createVehicleSlice, type VehicleSlice } from '../vehicleSlice';
import { createBlankClaim } from '@/types';

type TestStore = ClaimSlice & VehicleSlice;

function makeStore() {
  return create<TestStore>()((...a) => ({
    ...createClaimSlice(...a),
    ...createVehicleSlice(...a),
  }));
}

describe('Goods, HPA, and Odometer Store Synchronization', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    store.setState({ currentClaim: createBlankClaim() });
  });

  describe('Goods description & nature synchronization', () => {
    it('a) updateSpotDetails({ loadDesc: "STEEL COILS" }) syncs vehicle.natureOfGoods and vehicle.detailsOfGoodsCarried', () => {
      store.getState().updateSpotDetails({ loadDesc: 'STEEL COILS' });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.loadDesc).toBe('STEEL COILS');
      expect(claim.vehicle.natureOfGoods).toBe('STEEL COILS');
      expect(claim.vehicle.detailsOfGoodsCarried).toBe('STEEL COILS');
    });

    it('b) updateVehicle({ natureOfGoods: "IRON PIPES" }) syncs spotDetails.loadDesc and vehicle.detailsOfGoodsCarried', () => {
      store.getState().updateVehicle({ natureOfGoods: 'IRON PIPES' });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.loadDesc).toBe('IRON PIPES');
      expect(claim.vehicle.natureOfGoods).toBe('IRON PIPES');
      expect(claim.vehicle.detailsOfGoodsCarried).toBe('IRON PIPES');
    });

    it('c) updateVehicle({ detailsOfGoodsCarried: "BAGS" }) syncs spotDetails.loadDesc and vehicle.natureOfGoods', () => {
      store.getState().updateVehicle({ detailsOfGoodsCarried: 'BAGS' });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.loadDesc).toBe('BAGS');
      expect(claim.vehicle.natureOfGoods).toBe('BAGS');
      expect(claim.vehicle.detailsOfGoodsCarried).toBe('BAGS');
    });
  });

  describe('HPA / Financier synchronization', () => {
    it('d) updatePolicy({ hpaWith: "HDFC BANK LTD." }) syncs vehicle.hypothecation and vehicle.rcEndorsement', () => {
      store.getState().updatePolicy({ hpaWith: 'HDFC BANK LTD.' });

      const claim = store.getState().currentClaim!;
      expect(claim.policy.hpaWith).toBe('HDFC BANK LTD.');
      expect(claim.vehicle.hypothecation).toBe('HDFC BANK LTD.');
      expect(claim.vehicle.rcEndorsement).toBe('HDFC BANK LTD.');
    });

    it('e) updateVehicle({ hypothecation: "SBI" }) syncs policy.hpaWith and vehicle.rcEndorsement', () => {
      store.getState().updateVehicle({ hypothecation: 'SBI' });

      const claim = store.getState().currentClaim!;
      expect(claim.policy.hpaWith).toBe('SBI');
      expect(claim.vehicle.hypothecation).toBe('SBI');
      expect(claim.vehicle.rcEndorsement).toBe('SBI');
    });

    it('f) updateVehicle({ rcEndorsement: "ICICI BANK" }) syncs policy.hpaWith and vehicle.hypothecation', () => {
      store.getState().updateVehicle({ rcEndorsement: 'ICICI BANK' });

      const claim = store.getState().currentClaim!;
      expect(claim.policy.hpaWith).toBe('ICICI BANK');
      expect(claim.vehicle.hypothecation).toBe('ICICI BANK');
      expect(claim.vehicle.rcEndorsement).toBe('ICICI BANK');
    });
  });

  describe('Odometer synchronization', () => {
    it('g) updateVehicle({ odometer: "45000" }) syncs valuationDetails.odometer', () => {
      store.getState().updateVehicle({ odometer: '45000' });

      const claim = store.getState().currentClaim!;
      expect(claim.vehicle.odometer).toBe('45000');
      expect(claim.valuationDetails.odometer).toBe('45000');
    });

    it('h) updateValuationDetails({ odometer: "52000" }) syncs vehicle.odometer', () => {
      store.getState().updateValuationDetails({ odometer: '52000' });

      const claim = store.getState().currentClaim!;
      expect(claim.valuationDetails.odometer).toBe('52000');
      expect(claim.vehicle.odometer).toBe('52000');
    });
  });
});
