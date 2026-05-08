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

      // Keep spotDetails.gvw in sync when RLW/registeredLoadWeight is manually edited
      let updatedSpotDetails = state.currentClaim.spotDetails;
      const rlwRaw = updates.registeredLoadWeight;
      if (rlwRaw !== undefined) {
        const parsed = Math.round(parseFloat(String(rlwRaw).replace(/[^0-9.]/g, '')));
        if (parsed > 0) {
          updatedSpotDetails = { ...updatedSpotDetails, gvw: parsed };
        }
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
