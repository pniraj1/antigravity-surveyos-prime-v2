import type { StateCreator } from 'zustand';
import type { ClaimData } from '@/types';

export interface VehicleSlice {
  updateVehicle: (updates: Partial<ClaimData['vehicle']>) => void;
}

export const createVehicleSlice: StateCreator<any, any, any, VehicleSlice> = (set) => ({
  updateVehicle: (updates) => {
    set((state: { currentClaim: ClaimData | null }) => {
      if (!state.currentClaim) return { currentClaim: null };
      const updatedVehicle = { ...state.currentClaim.vehicle, ...updates };
      let updatedSpotDetails = { ...state.currentClaim.spotDetails };
      let recomputeCapacity = false;

      // When registeredLoadWeight or grossWeight is in updates: parse numeric value.
      // If > 0, set spotDetails.gvw, vehicle.grossWeight, and compute spotDetails.loadCapacity.
      if ('registeredLoadWeight' in updates || 'grossWeight' in updates) {
        const rawGvw = updates.registeredLoadWeight ?? updates.grossWeight;
        if (rawGvw !== undefined && rawGvw !== null) {
          const parsed = Math.round(parseFloat(String(rawGvw).replace(/[^0-9.]/g, '')));
          if (parsed > 0) {
            updatedSpotDetails = { ...updatedSpotDetails, gvw: parsed };
            updatedVehicle.grossWeight = parsed;
            recomputeCapacity = true;
          }
        }
      }

      // When unladenWeight is in updates: set spotDetails.ulw and compute spotDetails.loadCapacity.
      if ('unladenWeight' in updates) {
        const ulwRaw = updates.unladenWeight;
        if (ulwRaw !== undefined && ulwRaw !== null) {
          const parsed = Math.round(parseFloat(String(ulwRaw).replace(/[^0-9.]/g, '')));
          if (!isNaN(parsed) && parsed > 0) {
            updatedSpotDetails = { ...updatedSpotDetails, ulw: parsed };
            updatedVehicle.unladenWeight = parsed;
            recomputeCapacity = true;
          } else {
            updatedSpotDetails = { ...updatedSpotDetails, ulw: null };
            updatedVehicle.unladenWeight = null;
            recomputeCapacity = true;
          }
        } else if (ulwRaw === null) {
          updatedSpotDetails = { ...updatedSpotDetails, ulw: null };
          updatedVehicle.unladenWeight = null;
          recomputeCapacity = true;
        }
      }

      // When goodsWeightAtAccident is in updates: set spotDetails.actualLoad = parseFloat(goodsWeightAtAccident) || null
      // and vehicle.actualPayload = goodsWeightAtAccident.
      if ('goodsWeightAtAccident' in updates) {
        const gwa = updates.goodsWeightAtAccident;
        const parsed = gwa ? parseFloat(String(gwa).replace(/,/g, '')) || null : null;
        updatedSpotDetails = { ...updatedSpotDetails, actualLoad: parsed };
        updatedVehicle.actualPayload = gwa ?? '';
      } else if ('actualPayload' in updates) {
        const ap = updates.actualPayload;
        const parsed = ap ? parseFloat(String(ap).replace(/,/g, '')) || null : null;
        updatedSpotDetails = { ...updatedSpotDetails, actualLoad: parsed };
        updatedVehicle.goodsWeightAtAccident = ap ?? '';
      }

      if (recomputeCapacity) {
        const g = updatedSpotDetails.gvw || 0;
        const u = updatedSpotDetails.ulw || 0;
        updatedSpotDetails.loadCapacity = (g > u && u > 0) ? g - u : (g || 0);
      }

      return {
        currentClaim: {
          ...state.currentClaim,
          vehicle: updatedVehicle,
          spotDetails: updatedSpotDetails,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },
});
