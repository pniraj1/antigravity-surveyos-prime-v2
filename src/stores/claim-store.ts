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
import { createTallySlice, type TallySlice } from './slices/tallySlice';

export type ClaimState = ClaimSlice & VehicleSlice & AssessmentSlice & AIDataSlice & TallySlice;

export const useClaimStore = create<ClaimState>()(
  devtools(
    (...a) => ({
      ...createClaimSlice(...a),
      ...createVehicleSlice(...a),
      ...createAssessmentSlice(...a),
      ...createAIDataSlice(...a),
      ...createTallySlice(...a),
    }),
    { name: 'claim-store' }
  )
);
