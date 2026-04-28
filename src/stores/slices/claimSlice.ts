import type { StateCreator } from 'zustand';
import type { ClaimData, SurveyType, VehicleType, DepreciationType } from '@/types';
import { createBlankClaim } from '@/types';
import { saveClaim } from '@/lib/storage/indexeddb';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';

export interface ClaimSlice {
  currentClaim: ClaimData | null;
  currentClaimId: string | null;
  isDirty: boolean;
  claimsList: {
    id: string;
    label: string;
    updatedAt: string;
    surveyType: SurveyType;
    reportNo: string;
    vehicleNo: string;
    insurerName: string;
    insuredName: string;
    stage: 'spot' | 'final' | 'reinspection' | 'bill-check' | 'valuation';
    isCompleted: boolean;
    feePaid: boolean;
    feeTotal: number;
    isActive: boolean;
    gDriveFolderId: string | null;
  }[];

  newClaim: (surveyType: SurveyType, vehicleType: VehicleType) => void;
  loadClaim: (claim: ClaimData) => void;
  updateClaim: (updates: Partial<ClaimData>) => void;
  updateDriver: (updates: Partial<ClaimData['driver']>) => void;
  updatePolicy: (updates: Partial<ClaimData['policy']>) => void;
  updateAccident: (updates: Partial<ClaimData['accident']>) => void;
  updateReinspection: (updates: Partial<ClaimData['reinspection']>) => void;
  updateSpotDetails: (updates: Partial<ClaimData['spotDetails']>) => void;
  updateValuationDetails: (updates: Partial<ClaimData['valuationDetails']>) => void;
  setDepreciationType: (depType: DepreciationType) => void;
  updateFeeBill: (updates: Partial<ClaimData['feeBill']>) => void;
  updateBillCheck: (updates: Partial<ClaimData['billCheck']>) => void;
  addPhoto: (dataUrl: string, name: string, w?: number, h?: number) => void;
  deletePhoto: (index: number) => void;
  updatePhotoName: (index: number, name: string) => void;
  updatePhotoLayout: (layout: ClaimData['photoLayout']) => void;
  setClaimsList: (claims: ClaimSlice['claimsList']) => void;
  markClean: () => void;
  /**
   * Wipes all in-memory claim state on logout.
   * Called by resetAllState() in src/lib/auth/resetAllState.ts.
   * Ensures Surveyor B never sees Surveyor A's claims after a user switch.
   */
  resetStore: () => void;
}

export const createClaimSlice: StateCreator<any, any, any, ClaimSlice> = (set) => ({
  currentClaim: null,
  currentClaimId: null,
  isDirty: false,
  claimsList: [],

  newClaim: (surveyType, vehicleType) => {
    const uid = useAuthStore.getState().user?.uid;
    const claim = { ...createBlankClaim(surveyType, vehicleType), ...(uid ? { ownerId: uid } : {}) };
    set({
      currentClaim: claim,
      currentClaimId: claim.id,
      isDirty: true,
    });
    useUIStore.getState().setCurrentClaimId(claim.id);
    saveClaim(claim).catch(err => console.error('[ClaimStore] Failed to save new claim:', err));
  },

  loadClaim: (claim) => {
    set({
      currentClaim: { ...claim },
      currentClaimId: claim.id,
      isDirty: false,
    });
    useUIStore.getState().setCurrentClaimId(claim.id);
  },

  updateClaim: (updates) => {
    set((state: ClaimSlice) => ({
      currentClaim: state.currentClaim
        ? { ...state.currentClaim, ...updates, updatedAt: new Date().toISOString() }
        : null,
      isDirty: true,
    }));
  },

  updateDriver: (updates) => {
    set((state: ClaimSlice) => ({
      currentClaim: state.currentClaim
        ? {
            ...state.currentClaim,
            driver: { ...state.currentClaim.driver, ...updates },
            updatedAt: new Date().toISOString(),
          }
        : null,
      isDirty: true,
    }));
  },

  updatePolicy: (updates) => {
    set((state: ClaimSlice) => ({
      currentClaim: state.currentClaim
        ? {
            ...state.currentClaim,
            policy: { ...state.currentClaim.policy, ...updates },
            updatedAt: new Date().toISOString(),
          }
        : null,
      isDirty: true,
    }));
  },

  updateAccident: (updates) => {
    set((state: ClaimSlice) => ({
      currentClaim: state.currentClaim
        ? {
            ...state.currentClaim,
            accident: { ...state.currentClaim.accident, ...updates },
            updatedAt: new Date().toISOString(),
          }
        : null,
      isDirty: true,
    }));
  },

  updateReinspection: (updates) => {
    set((state: ClaimSlice) => ({
      currentClaim: state.currentClaim
        ? {
            ...state.currentClaim,
            reinspection: { ...state.currentClaim.reinspection, ...updates },
            updatedAt: new Date().toISOString(),
          }
        : null,
      isDirty: true,
    }));
  },

  updateSpotDetails: (updates) => {
    set((state: ClaimSlice) => ({
      currentClaim: state.currentClaim
        ? {
            ...state.currentClaim,
            spotDetails: { ...state.currentClaim.spotDetails, ...updates },
            updatedAt: new Date().toISOString(),
          }
        : null,
      isDirty: true,
    }));
  },

  updateValuationDetails: (updates) => {
    set((state: ClaimSlice) => ({
      currentClaim: state.currentClaim
        ? {
            ...state.currentClaim,
            valuationDetails: { ...state.currentClaim.valuationDetails, ...updates },
            updatedAt: new Date().toISOString(),
          }
        : null,
      isDirty: true,
    }));
  },

  setDepreciationType: (depType) => {
    set((state: ClaimSlice) => ({
      currentClaim: state.currentClaim
        ? {
            ...state.currentClaim,
            depreciationType: depType,
            updatedAt: new Date().toISOString(),
          }
        : null,
      isDirty: true,
    }));
  },

  updateFeeBill: (updates) => {
    set((state: ClaimSlice) => ({
      currentClaim: state.currentClaim
        ? {
            ...state.currentClaim,
            feeBill: { ...state.currentClaim.feeBill, ...updates },
            updatedAt: new Date().toISOString(),
          }
        : null,
      isDirty: true,
    }));
  },

  updateBillCheck: (updates) => {
    set((state: ClaimSlice) => ({
      currentClaim: state.currentClaim
        ? {
            ...state.currentClaim,
            billCheck: { ...state.currentClaim.billCheck, ...updates },
            updatedAt: new Date().toISOString(),
          }
        : null,
      isDirty: true,
    }));
  },

  addPhoto: (dataUrl, name, w, h) => {
    set((state: ClaimSlice) => {
      if (!state.currentClaim) return {};
      return {
        currentClaim: {
          ...state.currentClaim,
          photos: [...state.currentClaim.photos, { dataUrl, name, w, h }],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  deletePhoto: (index) => {
    set((state: ClaimSlice) => {
      if (!state.currentClaim) return {};
      const newPhotos = [...state.currentClaim.photos];
      newPhotos.splice(index, 1);
      return {
        currentClaim: {
          ...state.currentClaim,
          photos: newPhotos,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  updatePhotoName: (index, name) => {
    set((state: ClaimSlice) => {
      if (!state.currentClaim) return {};
      const newPhotos = [...state.currentClaim.photos];
      newPhotos[index] = { ...newPhotos[index], name };
      return {
        currentClaim: {
          ...state.currentClaim,
          photos: newPhotos,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  updatePhotoLayout: (layout) => {
    set((state: ClaimSlice) => ({
      currentClaim: state.currentClaim
        ? {
            ...state.currentClaim,
            photoLayout: layout,
            updatedAt: new Date().toISOString(),
          }
        : null,
      isDirty: true,
    }));
  },

  setClaimsList: (claims) => set({ claimsList: claims }),
  markClean: () => set({ isDirty: false }),

  resetStore: () => set({
    currentClaim: null,
    currentClaimId: null,
    isDirty: false,
    claimsList: [],
  }),
});
