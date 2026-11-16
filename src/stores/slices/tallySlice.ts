import type { StateCreator } from 'zustand';
import type { AssessmentRow } from '@/types/assessment';
import type { ClaimData } from '@/types';

export type TallyStage = 1 | 2 | 3 | 4 | 'grid';

export interface TallySlice {
  activeTallyStage: TallyStage;
  setTallyStage: (stage: TallyStage) => void;
  markRemainingAllowedAsNotInBill: () => void;
}

type WithClaim = { currentClaim: ClaimData | null };

export const createTallySlice: StateCreator<any, any, any, TallySlice> = (set) => ({
  activeTallyStage: 1,
  setTallyStage: (stage) => set({ activeTallyStage: stage }),
  markRemainingAllowedAsNotInBill: () => {
    set((state: WithClaim) => {
      if (!state.currentClaim?.assessmentRows) return {};
      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: state.currentClaim.assessmentRows.map((r: AssessmentRow) => {
            if (r.allowed && r.billedTaxable === undefined) {
              return {
                ...r,
                billStatus: 'not-in-bill' as const,
                billedTaxable: 0,
                billedAmount: 0,
              };
            }
            return r;
          }),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },
});
