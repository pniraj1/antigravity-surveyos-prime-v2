import type { StateCreator } from 'zustand';
import type { ClaimData, AssessmentRow, SpotDamageRow } from '@/types';
import { createAssessmentRow } from '@/lib/calculations';

export interface AssessmentSlice {
  addAssessmentRow: (section: AssessmentRow['section']) => void;
  updateAssessmentRow: (id: string, updates: Partial<AssessmentRow>) => void;
  deleteAssessmentRow: (id: string) => void;
  deleteAssessmentRows: (ids: string[]) => void;
  deleteExtraBillItem: (id: string) => void;
  clearExtraBillItems: () => void;
  toggleRowAllowed: (id: string) => void;
  addSpotDamageRow: (component?: string, damage?: string) => void;
  updateSpotDamageRow: (id: string, updates: Partial<SpotDamageRow>) => void;
  deleteSpotDamageRow: (id: string) => void;
}

type WithClaim = { currentClaim: ClaimData | null };

export const createAssessmentSlice: StateCreator<any, any, any, AssessmentSlice> = (set) => ({
  addAssessmentRow: (section) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const newRow = createAssessmentRow(section);
      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: [...state.currentClaim.assessmentRows, newRow],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  updateAssessmentRow: (id, updates) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: state.currentClaim.assessmentRows.map((r) => {
            if (r.id !== id) return r;
            const updatedRow = { ...r, ...updates };

            // Auto-calculate estimated if unitPrice or quantity changes
            if ('unitPrice' in updates || 'quantity' in updates) {
              updatedRow.estimated = (updatedRow.unitPrice || 0) * (updatedRow.quantity || 1);
            }

            // If allowed changed, or if it's currently allowed and we just changed unitPrice/quantity, update assessed
            if ('allowed' in updates || (updatedRow.allowed && ('unitPrice' in updates || 'quantity' in updates))) {
              if (updatedRow.allowed) {
                updatedRow.assessed = updatedRow.estimated;
              }
            }

            return updatedRow;
          }),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  deleteAssessmentRow: (id) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: state.currentClaim.assessmentRows.filter((r) => r.id !== id),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  deleteAssessmentRows: (ids) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const idSet = new Set(ids);
      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: state.currentClaim.assessmentRows.filter((r) => !idSet.has(r.id)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  deleteExtraBillItem: (id) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      return {
        currentClaim: {
          ...state.currentClaim,
          extraBillItems: (state.currentClaim.extraBillItems || []).filter((i) => i.id !== id),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  clearExtraBillItems: () => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      return {
        currentClaim: {
          ...state.currentClaim,
          extraBillItems: [],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  toggleRowAllowed: (id) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: state.currentClaim.assessmentRows.map((r) => {
            if (r.id !== id) return r;
            const allowed = !r.allowed;
            return {
              ...r,
              allowed,
              ...(allowed && { assessed: r.estimated }),
            };
          }),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  addSpotDamageRow: (component = '', damage = '') => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const newRow: SpotDamageRow = {
        id: `spot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        component,
        damage,
      };
      return {
        currentClaim: {
          ...state.currentClaim,
          spotDamageRows: [...(state.currentClaim.spotDamageRows ?? []), newRow],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  updateSpotDamageRow: (id, updates) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      return {
        currentClaim: {
          ...state.currentClaim,
          spotDamageRows: (state.currentClaim.spotDamageRows ?? []).map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  deleteSpotDamageRow: (id) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      return {
        currentClaim: {
          ...state.currentClaim,
          spotDamageRows: (state.currentClaim.spotDamageRows ?? []).filter((r) => r.id !== id),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },
});
