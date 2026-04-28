// ═══════════════════════════════════════════════════════════
// CENTRAL CLAIM STORE — Zustand
// Replaces all legacy window.* global state
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { createClaimSlice, type ClaimSlice } from './slices/claimSlice';
import { createVehicleSlice, type VehicleSlice } from './slices/vehicleSlice';
import { createAssessmentSlice, type AssessmentSlice } from './slices/assessmentSlice';
import { createAIDataSlice, type AIDataSlice } from './slices/aiDataSlice';

export type ClaimState = ClaimSlice & VehicleSlice & AssessmentSlice & AIDataSlice;

export const useClaimStore = create<ClaimState>()(
  devtools(
    (...a) => ({
      ...createClaimSlice(...a),
      ...createVehicleSlice(...a),
      ...createAssessmentSlice(...a),
      ...createAIDataSlice(...a),
    }),
    { name: 'claim-store' }
  )
);
