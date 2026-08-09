import type { StateCreator } from 'zustand';
import type { ClaimData, AssessmentRow, SpotDamageRow } from '@/types';
import { createAssessmentRow } from '@/lib/calculations';
import { resolveSectionMove } from '@/lib/calculations/section-move';

export interface AssessmentSlice {
  addAssessmentRow: (section: AssessmentRow['section']) => void;
  updateAssessmentRow: (id: string, updates: Partial<AssessmentRow>) => void;
  deleteAssessmentRow: (id: string) => void;
  deleteAssessmentRows: (ids: string[]) => void;
  reorderAssessmentRows: (orderedIds: string[]) => void;
  moveRowToSection: (rowId: string, section: AssessmentRow['section'], targetIndex: number) => void;
  deleteExtraBillItem: (id: string) => void;
  clearExtraBillItems: () => void;
  linkExtraBillItem: (extraId: string, rowId: string) => void;
  promoteExtraBillItem: (extraId: string) => void;
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

  /**
   * Reorders the rows named in `orderedIds`, leaving every other row alone.
   *
   * Rows absent from the list keep their current index. The named rows are
   * redistributed, in the order given, into the index positions those named
   * rows already occupied — so a full-list call reorders everything, and a
   * partial call rearranges only its own subset.
   *
   * This used to rebuild the array from `orderedIds` alone, which deleted every
   * row the caller did not name: a subset call dropped the rest, and an empty
   * list wiped the grid. Harmless while the only caller passed all rows, fatal
   * the moment a per-section reorder passed one section's ids.
   */
  reorderAssessmentRows: (orderedIds) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const rows = state.currentClaim.assessmentRows;
      const rowMap = new Map(rows.map((r) => [r.id, r]));

      // Ignore ids that name no row, and keep only the first mention of each —
      // either would otherwise shift the rest of the sequence out of step with
      // the slots it is being written into.
      const named: string[] = [];
      const namedSet = new Set<string>();
      for (const id of orderedIds) {
        if (!rowMap.has(id) || namedSet.has(id)) continue;
        namedSet.add(id);
        named.push(id);
      }
      if (named.length === 0) return {};

      const slots = rows.reduce<number[]>((acc, r, i) => {
        if (namedSet.has(r.id)) acc.push(i);
        return acc;
      }, []);

      const reordered = [...rows];
      slots.forEach((slot, i) => {
        reordered[slot] = rowMap.get(named[i])!;
      });

      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: reordered,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  /**
   * Moves a row into another section and repositions it, in one action.
   *
   * `targetIndex` is an index into the flat assessmentRows array, resolved by
   * the caller from the drop position — not a position within the destination
   * section.
   *
   * Both the drag handler and the type dropdown call this. Two code paths for
   * one operation is how three copies of the depreciation table came to
   * disagree; see the fibre glass fix of 2026-08-09.
   */
  moveRowToSection: (rowId, section, targetIndex) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const rows = state.currentClaim.assessmentRows;
      const from = rows.findIndex((r) => r.id === rowId);
      if (from === -1) return {};

      const changes = resolveSectionMove(rows[from], section);
      const moved = { ...rows[from], ...changes };

      const without = rows.filter((_, i) => i !== from);
      const to = Math.max(0, Math.min(targetIndex, without.length));
      const next = [...without.slice(0, to), moved, ...without.slice(to)];

      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: next,
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

  linkExtraBillItem: (extraId, rowId) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const extra = (state.currentClaim.extraBillItems || []).find((i) => i.id === extraId);
      if (!extra) return {};

      const AMT_TOL = 1;
      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: state.currentClaim.assessmentRows.map((r) => {
            if (r.id !== rowId) return r;
            // Same item, worded differently by the workshop. Partial when the
            // workshop billed a different figure than was assessed.
            const partial = Math.abs(extra.taxableAmount - r.assessed) > AMT_TOL;
            return {
              ...r,
              billedTaxable: extra.taxableAmount,
              billedAmount: extra.amount,
              billStatus: partial ? ('partial' as const) : ('in-bill' as const),
              billRemarks: r.billRemarks || `Linked from bill: ${extra.description}`,
            };
          }),
          extraBillItems: (state.currentClaim.extraBillItems || []).filter((i) => i.id !== extraId),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },

  promoteExtraBillItem: (extraId) => {
    set((state: WithClaim) => {
      if (!state.currentClaim) return {};
      const extra = (state.currentClaim.extraBillItems || []).find((i) => i.id === extraId);
      if (!extra) return {};

      // Lands Not Allowed at zero assessed. The item is now on the record and
      // in the Final Report; whether it is allowed is the surveyor's call.
      const newRow = createAssessmentRow(extra.section, {
        particulars: extra.description,
        partNumber: extra.partNumber,
        hsnSac: extra.hsnSac,
        gst: extra.gstPercent,
        estimated: 0,
        assessed: 0,
        allowed: false,
        billedTaxable: extra.taxableAmount,
        billedAmount: extra.amount,
        billStatus: 'not-allowed',
        billRemarks: 'Added from final bill — not in original assessment',
      });

      return {
        currentClaim: {
          ...state.currentClaim,
          assessmentRows: [...state.currentClaim.assessmentRows, newRow],
          extraBillItems: (state.currentClaim.extraBillItems || []).filter((i) => i.id !== extraId),
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
