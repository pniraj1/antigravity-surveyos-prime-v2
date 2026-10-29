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

describe('Weights and Load Store Synchronization', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    store.setState({ currentClaim: createBlankClaim() });
  });

  describe('updateVehicle', () => {
    it('a) syncs registeredLoadWeight to spotDetails.gvw, vehicle.grossWeight and computes spotDetails.loadCapacity', () => {
      store.getState().updateVehicle({ registeredLoadWeight: '16200 KG' });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.gvw).toBe(16200);
      expect(claim.vehicle.grossWeight).toBe(16200);
      expect(claim.spotDetails.loadCapacity).toBe(16200);
    });

    it('b) syncs unladenWeight to spotDetails.ulw and computes spotDetails.loadCapacity', () => {
      store.getState().updateVehicle({ registeredLoadWeight: '16200 KG' });
      store.getState().updateVehicle({ unladenWeight: 6200 });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.ulw).toBe(6200);
      expect(claim.vehicle.unladenWeight).toBe(6200);
      expect(claim.spotDetails.loadCapacity).toBe(10000); // 16200 - 6200
    });

    it('c) syncs goodsWeightAtAccident to spotDetails.actualLoad and vehicle.actualPayload', () => {
      store.getState().updateVehicle({ goodsWeightAtAccident: '10000' });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.actualLoad).toBe(10000);
      expect(claim.vehicle.actualPayload).toBe('10000');
      expect(claim.vehicle.goodsWeightAtAccident).toBe('10000');
    });

    it('handles grossWeight in updateVehicle', () => {
      store.getState().updateVehicle({ grossWeight: 16200 });

      const claim = store.getState().currentClaim!;
      expect(claim.spotDetails.gvw).toBe(16200);
      expect(claim.vehicle.grossWeight).toBe(16200);
      expect(claim.spotDetails.loadCapacity).toBe(16200);
    });
  });

  describe('updateSpotDetails', () => {
    it('d) syncs gvw to vehicle.registeredLoadWeight, vehicle.grossWeight and computes spotDetails.loadCapacity', () => {
      store.getState().updateSpotDetails({ gvw: 18000 });

      const claim = store.getState().currentClaim!;
      expect(claim.vehicle.registeredLoadWeight).toBe('18000');
      expect(claim.vehicle.grossWeight).toBe(18000);
      expect(claim.spotDetails.gvw).toBe(18000);
      expect(claim.spotDetails.loadCapacity).toBe(18000);
    });

    it('e) syncs ulw to vehicle.unladenWeight and computes spotDetails.loadCapacity', () => {
      store.getState().updateSpotDetails({ gvw: 18000 });
      store.getState().updateSpotDetails({ ulw: 7000 });

      const claim = store.getState().currentClaim!;
      expect(claim.vehicle.unladenWeight).toBe(7000);
      expect(claim.spotDetails.ulw).toBe(7000);
      expect(claim.spotDetails.loadCapacity).toBe(11000); // 18000 - 7000
    });

    it('f) syncs actualLoad to vehicle.goodsWeightAtAccident and vehicle.actualPayload', () => {
      store.getState().updateSpotDetails({ actualLoad: 11000 });

      const claim = store.getState().currentClaim!;
      expect(claim.vehicle.goodsWeightAtAccident).toBe('11000');
      expect(claim.vehicle.actualPayload).toBe('11000');
      expect(claim.spotDetails.actualLoad).toBe(11000);
    });
  });

  describe('Capacity computation formula: (gvw > ulw && ulw > 0) ? gvw - ulw : (gvw || 0)', () => {
    it('computes gvw - ulw when gvw > ulw and ulw > 0', () => {
      store.getState().updateSpotDetails({ gvw: 20000, ulw: 8000 });
      expect(store.getState().currentClaim!.spotDetails.loadCapacity).toBe(12000);
    });

    it('falls back to gvw when ulw is 0 or null', () => {
      store.getState().updateSpotDetails({ gvw: 15000, ulw: null });
      expect(store.getState().currentClaim!.spotDetails.loadCapacity).toBe(15000);
    });

    it('falls back to gvw when gvw <= ulw', () => {
      store.getState().updateSpotDetails({ gvw: 5000, ulw: 6000 });
      expect(store.getState().currentClaim!.spotDetails.loadCapacity).toBe(5000);
    });

    it('falls back to 0 when gvw is null', () => {
      store.getState().updateSpotDetails({ gvw: null, ulw: 5000 });
      expect(store.getState().currentClaim!.spotDetails.loadCapacity).toBe(0);
    });
  });
});
