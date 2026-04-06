// ═══════════════════════════════════════════════════════════
// CENTRAL CLAIM STORE — Zustand
// Replaces all legacy window.* global state
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ClaimData, AssessmentRow, SpotDamageRow, SurveyType, VehicleType, DepreciationType } from '@/types';
import { createBlankClaim } from '@/types';
import { createAssessmentRow } from '@/lib/calculations';
import { saveClaim } from '@/lib/storage/indexeddb';
import { useUIStore } from '@/stores/ui-store';

interface ClaimState {
  // ─── Current Claim ──────────────────────────────────
  currentClaim: ClaimData | null;
  currentClaimId: string | null;
  isDirty: boolean;

  // ─── Saved Claims List ──────────────────────────────
  claimsList: { id: string; label: string; updatedAt: string; surveyType: SurveyType }[];

  // ─── Actions ────────────────────────────────────────
  newClaim: (surveyType: SurveyType, vehicleType: VehicleType) => void;
  loadClaim: (claim: ClaimData) => void;
  updateClaim: (updates: Partial<ClaimData>) => void;

  // Vehicle / Driver / Policy / Accident
  updateVehicle: (updates: Partial<ClaimData['vehicle']>) => void;
  updateDriver: (updates: Partial<ClaimData['driver']>) => void;
  updatePolicy: (updates: Partial<ClaimData['policy']>) => void;
  updateAccident: (updates: Partial<ClaimData['accident']>) => void;
  updateSpotDetails: (updates: Partial<ClaimData['spotDetails']>) => void;

  // Depreciation
  setDepreciationType: (depType: DepreciationType) => void;

  // Assessment Rows
  addAssessmentRow: (section: AssessmentRow['section']) => void;
  updateAssessmentRow: (id: string, updates: Partial<AssessmentRow>) => void;
  deleteAssessmentRow: (id: string) => void;
  toggleRowAllowed: (id: string) => void;

  // Spot Damage
  addSpotDamageRow: (component?: string, damage?: string) => void;
  updateSpotDamageRow: (id: string, updates: Partial<SpotDamageRow>) => void;
  deleteSpotDamageRow: (id: string) => void;

  // Fee Bill
  updateFeeBill: (updates: Partial<ClaimData['feeBill']>) => void;

  // Bill Check
  updateBillCheck: (updates: Partial<ClaimData['billCheck']>) => void;

  // Photos
  addPhoto: (dataUrl: string, name: string) => void;
  deletePhoto: (index: number) => void;
  updatePhotoName: (index: number, name: string) => void;
  updatePhotoLayout: (layout: ClaimData['photoLayout']) => void;

  // AI Data
  setExtractedData: (key: string, data: any) => void;
  applyExtractedData: (key: string, data: any) => void;

  // Claims list
  setClaimsList: (claims: ClaimState['claimsList']) => void;
  markClean: () => void;
}

export const useClaimStore = create<ClaimState>()(
  devtools(
    (set) => ({
      currentClaim: null,
      currentClaimId: null,
      isDirty: false,
      claimsList: [],

      newClaim: (surveyType, vehicleType) => {
        const claim = createBlankClaim(surveyType, vehicleType);
        set({
          currentClaim: claim,
          currentClaimId: claim.id,
          isDirty: true, // Mark dirty immediately so AutoSave picks it up
        });
        
        // Update UI store for persistence
        useUIStore.getState().setCurrentClaimId(claim.id);
        
        // Immediately persist to IndexedDB — don't wait for debounce
        saveClaim(claim).catch(err => console.error('[ClaimStore] Failed to save new claim:', err));
      },

      loadClaim: (claim) => {
        set({
          currentClaim: { ...claim },
          currentClaimId: claim.id,
          isDirty: false,
        });
        
        // Update UI store for persistence
        useUIStore.getState().setCurrentClaimId(claim.id);
      },

      updateClaim: (updates) => {
        set((state) => ({
          currentClaim: state.currentClaim
            ? { ...state.currentClaim, ...updates, updatedAt: new Date().toISOString() }
            : null,
          isDirty: true,
        }));
      },

      updateVehicle: (updates) => {
        set((state) => ({
          currentClaim: state.currentClaim
            ? {
                ...state.currentClaim,
                vehicle: { ...state.currentClaim.vehicle, ...updates },
                updatedAt: new Date().toISOString(),
              }
            : null,
          isDirty: true,
        }));
      },

      updateDriver: (updates) => {
        set((state) => ({
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
        set((state) => ({
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
        set((state) => ({
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

      updateSpotDetails: (updates) => {
        set((state) => ({
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

      setDepreciationType: (depType) => {
        set((state) => ({
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

      addAssessmentRow: (section) => {
        set((state) => {
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
        set((state) => {
          if (!state.currentClaim) return {};
          return {
            currentClaim: {
              ...state.currentClaim,
              assessmentRows: state.currentClaim.assessmentRows.map((r) =>
                r.id === id ? { ...r, ...updates } : r
              ),
              updatedAt: new Date().toISOString(),
            },
            isDirty: true,
          };
        });
      },

      deleteAssessmentRow: (id) => {
        set((state) => {
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

      toggleRowAllowed: (id) => {
        set((state) => {
          if (!state.currentClaim) return {};
          return {
            currentClaim: {
              ...state.currentClaim,
              assessmentRows: state.currentClaim.assessmentRows.map((r) =>
                r.id === id ? { ...r, allowed: !r.allowed } : r
              ),
              updatedAt: new Date().toISOString(),
            },
            isDirty: true,
          };
        });
      },

      addSpotDamageRow: (component = '', damage = '') => {
        set((state) => {
          if (!state.currentClaim) return {};
          const newRow: SpotDamageRow = {
            id: `spot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            component,
            damage,
          };
          return {
            currentClaim: {
              ...state.currentClaim,
              spotDamageRows: [...state.currentClaim.spotDamageRows, newRow],
              updatedAt: new Date().toISOString(),
            },
            isDirty: true,
          };
        });
      },

      updateSpotDamageRow: (id, updates) => {
        set((state) => {
          if (!state.currentClaim) return {};
          return {
            currentClaim: {
              ...state.currentClaim,
              spotDamageRows: state.currentClaim.spotDamageRows.map((r) =>
                r.id === id ? { ...r, ...updates } : r
              ),
              updatedAt: new Date().toISOString(),
            },
            isDirty: true,
          };
        });
      },

      deleteSpotDamageRow: (id) => {
        set((state) => {
          if (!state.currentClaim) return {};
          return {
            currentClaim: {
              ...state.currentClaim,
              spotDamageRows: state.currentClaim.spotDamageRows.filter((r) => r.id !== id),
              updatedAt: new Date().toISOString(),
            },
            isDirty: true,
          };
        });
      },

      updateFeeBill: (updates) => {
        set((state) => ({
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
        set((state) => ({
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

      addPhoto: (dataUrl, name) => {
        set((state) => {
          if (!state.currentClaim) return {};
          return {
            currentClaim: {
              ...state.currentClaim,
              photos: [...state.currentClaim.photos, { dataUrl, name }],
              updatedAt: new Date().toISOString(),
            },
            isDirty: true,
          };
        });
      },

      deletePhoto: (index) => {
        set((state) => {
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
        set((state) => {
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
        set((state) => ({
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

      setExtractedData: (key, data) => {
        set((state) => ({
          currentClaim: state.currentClaim
            ? {
                ...state.currentClaim,
                extractedData: { ...state.currentClaim.extractedData, [key]: data },
                updatedAt: new Date().toISOString(),
              }
            : null,
          isDirty: true,
        }));
      },

      applyExtractedData: (key, data) => {
        set((state) => {
          if (!state.currentClaim) return {};
          const newClaim = { ...state.currentClaim };

          // Mapping logic based on document key
          if (key === 'rc') {
            newClaim.vehicle = { ...newClaim.vehicle, ...data };
            // Map specific fields if the keys differ
            if (data.registration_number) newClaim.vehicle.registrationNumber = data.registration_number;
            if (data.date_of_registration) newClaim.vehicle.dateOfRegistration = data.date_of_registration;
          } else if (key === 'policy') {
            newClaim.policy = { ...newClaim.policy, ...data };
            if (data.policy_number) newClaim.policy.policyNumber = data.policy_number;
          } else if (key === 'dl') {
            newClaim.driver = { ...newClaim.driver, ...data };
            if (data.licence_number) newClaim.driver.licenceNumber = data.licence_number;
          } else if (key === 'final-bill') {
            newClaim.billCheck = {
              billNo: data.bill_number || '',
              billDate: data.bill_date || '',
              billTotal: data.total_amount || 0,
            };

            const billItems = [
              ...(data.spare_parts || []).map((i: any) => ({ ...i, type: 'parts' })),
              ...(data.labour_items || []).map((i: any) => ({ ...i, type: 'labour' })),
              ...(data.painting_items || []).map((i: any) => ({ ...i, type: 'paint' })),
            ];

            newClaim.assessmentRows = newClaim.assessmentRows.map(row => {
              if (!row.allowed) return row;
              const match = billItems.find((bi: any) => 
                bi.description?.toLowerCase().includes(row.particulars.toLowerCase()) ||
                row.particulars.toLowerCase().includes(bi.description?.toLowerCase())
              );
              if (match) {
                return {
                  ...row,
                  billedAmount: match.amount || 0,
                  billStatus: 'in-bill',
                };
              }
              return row;
            });
          } else if (key === 'estimate') {
            const newRows: AssessmentRow[] = [];
            (data.spare_parts || []).forEach((item: any) => {
              newRows.push(createAssessmentRow('parts', {
                particulars: item.description || 'Unnamed Part',
                estimated: item.amount || 0,
                assessed: item.amount || 0,
                partType: (item.category as any) || 'metal',
                gst: item.gst_percent || 18,
              }));
            });
            (data.labour_items || []).forEach((item: any) => {
              newRows.push(createAssessmentRow('labour', {
                particulars: item.description || 'Labour Item',
                estimated: item.amount || 0,
                assessed: item.amount || 0,
                partType: 'labour',
                gst: item.gst_percent || 18,
              }));
            });
            (data.painting_items || []).forEach((item: any) => {
              newRows.push(createAssessmentRow('paint', {
                particulars: item.description || 'Painting Item',
                estimated: item.amount || 0,
                assessed: item.amount || 0,
                partType: 'paint',
                gst: item.gst_percent || 18,
              }));
            });
            newClaim.assessmentRows = [...newClaim.assessmentRows, ...newRows];
            if (data.estimate_date) newClaim.accident.dateAndTime = data.estimate_date;
            if (data.workshop_name) newClaim.accident.placeOfSurvey = data.workshop_name;
          }

          return {
            currentClaim: { ...newClaim, updatedAt: new Date().toISOString() },
            isDirty: true,
          };
        });
      },
    }),
    { name: 'claim-store' }
  )
);
