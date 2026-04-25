// ═══════════════════════════════════════════════════════════
// CENTRAL CLAIM STORE — Zustand
// Replaces all legacy window.* global state
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ClaimData, AssessmentRow, SpotDamageRow, SurveyType, VehicleType, DepreciationType, ExtraBillItem } from '@/types';
import { createBlankClaim } from '@/types';
import { createAssessmentRow } from '@/lib/calculations';
import { saveClaim } from '@/lib/storage/indexeddb';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';

interface ClaimState {
  // ─── Current Claim ──────────────────────────────────
  currentClaim: ClaimData | null;
  currentClaimId: string | null;
  isDirty: boolean;

  // ─── Saved Claims List ──────────────────────────────
  claimsList: {
    id: string;
    label: string;
    updatedAt: string;
    surveyType: SurveyType;
    reportNo: string;
    vehicleNo: string;
    insurerName: string;
    insuredName: string;
    stage: 'spot' | 'final' | 'reinspection' | 'bill-check';
    isCompleted: boolean;
    feePaid: boolean;
    feeTotal: number;
    isActive: boolean;
    gDriveFolderId: string | null;
  }[];

  // ─── Actions ────────────────────────────────────────
  newClaim: (surveyType: SurveyType, vehicleType: VehicleType) => void;
  loadClaim: (claim: ClaimData) => void;
  updateClaim: (updates: Partial<ClaimData>) => void;

  // Vehicle / Driver / Policy / Accident
  updateVehicle: (updates: Partial<ClaimData['vehicle']>) => void;
  updateDriver: (updates: Partial<ClaimData['driver']>) => void;
  updatePolicy: (updates: Partial<ClaimData['policy']>) => void;
  updateAccident: (updates: Partial<ClaimData['accident']>) => void;
  updateReinspection: (updates: Partial<ClaimData['reinspection']>) => void;
  updateSpotDetails: (updates: Partial<ClaimData['spotDetails']>) => void;

  // Depreciation
  setDepreciationType: (depType: DepreciationType) => void;

  // Assessment Rows
  addAssessmentRow: (section: AssessmentRow['section']) => void;
  updateAssessmentRow: (id: string, updates: Partial<AssessmentRow>) => void;
  deleteAssessmentRow: (id: string) => void;
  deleteAssessmentRows: (ids: string[]) => void;
  deleteExtraBillItem: (id: string) => void;
  clearExtraBillItems: () => void;
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
  addPhoto: (dataUrl: string, name: string, w?: number, h?: number) => void;
  deletePhoto: (index: number) => void;
  updatePhotoName: (index: number, name: string) => void;
  updatePhotoLayout: (layout: ClaimData['photoLayout']) => void;

  // AI Data
  setExtractedData: (key: string, data: any) => void;
  applyExtractedData: (key: string, data: any) => void;
  reconcileField: (path: string, value: any) => void;

  // Claims list
  setClaimsList: (claims: ClaimState['claimsList']) => void;
  markClean: () => void;

  /**
   * Wipes all in-memory claim state on logout.
   * Called by resetAllState() in src/lib/auth/resetAllState.ts.
   * Ensures Surveyor B never sees Surveyor A's claims after a user switch.
   */
  resetStore: () => void;
}

export const useClaimStore = create<ClaimState>()(
  devtools(
    (set) => ({
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
        set((state) => {
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

      updateReinspection: (updates) => {
        set((state) => ({
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
              assessmentRows: state.currentClaim.assessmentRows.map((r) => {
                if (r.id === id) {
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
                }
                return r;
              }),
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

      deleteAssessmentRows: (ids) => {
        set((state) => {
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
        set((state) => {
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
        set((state) => {
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
        set((state) => {
          if (!state.currentClaim) return {};
          return {
            currentClaim: {
              ...state.currentClaim,
              assessmentRows: state.currentClaim.assessmentRows.map((r) => {
                if (r.id === id) {
                  const allowed = !r.allowed;
                  return { 
                    ...r, 
                    allowed,
                    ...(allowed && { assessed: r.estimated })
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
              spotDamageRows: [...(state.currentClaim.spotDamageRows ?? []), newRow],
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
        set((state) => {
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

      addPhoto: (dataUrl, name, w, h) => {
        set((state) => {
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

      resetStore: () => set({
        currentClaim: null,
        currentClaimId: null,
        isDirty: false,
        claimsList: [],
      }),

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

          const parseDate = (d: string) => {
            if (!d) return '';
            const clean = d.trim().replace(/[^\w\s\-/]/g, ' '); // Basic cleaning
            
            // If it's already YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

            // Split by space, dash, or slash
            const parts = clean.split(/[\s\-/]+/);
            if (parts.length >= 3) {
              let day = parts[0];
              let month = parts[1];
              let year = parts[2];

              // Handle "20 Nov 2022" or "Nov 20 2022"
              const dateObj = new Date(clean);
              if (!isNaN(dateObj.getTime())) {
                const y = dateObj.getFullYear();
                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                const dayStr = String(dateObj.getDate()).padStart(2, '0');
                return `${y}-${m}-${dayStr}`;
              }

              // Standard Indian DD-MM-YYYY
              if (year.length === 4 && day.length <= 2) {
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              }
            }
            
            // Final fallback
            const fallback = new Date(clean);
            if (!isNaN(fallback.getTime())) {
               return fallback.toISOString().split('T')[0];
            }
            return d; // Return original if all else fails
          };
          
          // Helper for fuel mapping
          const formatFuel = (f: string) => {
             if (!f) return '';
             const up = f.toUpperCase();
             if (up === 'PETROL') return 'Petrol';
             if (up === 'DIESEL') return 'Diesel';
             if (up.includes('PETROL') && up.includes('CNG')) return 'Petrol+CNG';
             if (up.includes('PETROL') && up.includes('LPG')) return 'Petrol+LPG';
             if (up === 'CNG') return 'CNG';
             if (up === 'ELECTRIC' || up === 'EV') return 'Electric';
             if (up === 'HYBRID') return 'Hybrid';
             return f;
          };

          // Mapping logic based on document key
          if (key === 'rc') {
            const hypothecation = data.hypothecation || data.hpa || newClaim.vehicle.hypothecation;
            const rlw = typeof data.gross_weight === 'string' ? data.gross_weight : String(data.gross_weight || data.rlw || newClaim.vehicle.registeredLoadWeight);
            const yomStr = (data.year_of_manufacture || data.yom)?.toString() || '';
            const yomMatch = yomStr.match(/\b(19|20)\d{2}\b/);
            const yom = yomMatch ? parseInt(yomMatch[0]) : newClaim.vehicle.yearOfManufacture;

            newClaim.vehicle = { 
              ...newClaim.vehicle,
              registrationNumber: data.registration_number || data.reg_no || newClaim.vehicle.registrationNumber,
              dateOfRegistration: parseDate(data.date_of_registration || data.registration_date || data.reg_date) || newClaim.vehicle.dateOfRegistration,
              chassisNumber: data.chassis_number || data.chassis_no || newClaim.vehicle.chassisNumber,
              engineNumber: data.engine_number || data.engine_no || newClaim.vehicle.engineNumber,
              make: data.make || newClaim.vehicle.make,
              model: data.model || newClaim.vehicle.model,
              bodyType: data.body_type || newClaim.vehicle.bodyType,
              cubicCapacity: data.cubic_capacity || data.cc || newClaim.vehicle.cubicCapacity,
              colour: data.colour || data.color || newClaim.vehicle.colour,
              fuel: formatFuel(data.fuel) || newClaim.vehicle.fuel,
              seatingCapacity: data.seating_capacity || data.seats || newClaim.vehicle.seatingCapacity,
              unladenWeight: parseFloat(data.unladen_weight || data.ulw) || newClaim.vehicle.unladenWeight,
              registeredLoadWeight: rlw || newClaim.vehicle.registeredLoadWeight,
              classOfVehicle: data.class_of_vehicle || data.vehicle_class || newClaim.vehicle.classOfVehicle,
              registrationType: data.class_of_vehicle || data.vehicle_class || newClaim.vehicle.registrationType,
              registeringAuthority: data.registering_authority || data.rto || newClaim.vehicle.registeringAuthority,
              route: data.route || newClaim.vehicle.route,
              yearOfManufacture: yom,
              registrationValidUpTo: parseDate(data.registration_valid_upto || data.reg_valid_upto || data.regn_valid_upto) || newClaim.vehicle.registrationValidUpTo,
              hypothecation: hypothecation,
            };
            newClaim.policy = {
              ...newClaim.policy,
              insuredName: data.owner_name || data.name || newClaim.policy.insuredName,
              insuredAddress: data.address || newClaim.policy.insuredAddress,
              // Sync HPA from RC into policy so standard report HPA row is always populated
              hpaWith: hypothecation || newClaim.policy.hpaWith,
            };
            
            const gvwStr = String(data.gross_weight || '0').replace(/[^0-9.]/g, '');
            const ulwStr = String(data.unladen_weight || '0').replace(/[^0-9.]/g, '');
            const gvw = gvwStr ? Math.round(parseFloat(gvwStr)) : 0;
            const ulw = ulwStr ? Math.round(parseFloat(ulwStr)) : 0;
            
            newClaim.spotDetails = {
              ...newClaim.spotDetails,
              gvw: gvw || newClaim.spotDetails.gvw,
              ulw: ulw || newClaim.spotDetails.ulw,
              loadCapacity: (gvw && ulw && gvw > ulw) ? (gvw - ulw) : newClaim.spotDetails.loadCapacity,
            };
          } else if (key === 'policy') {
            newClaim.policy = { 
              ...newClaim.policy,
              policyNumber: data.policy_number || newClaim.policy.policyNumber,
              insuredName: data.insured_name || newClaim.policy.insuredName,
              insuredAddress: data.insured_address || newClaim.policy.insuredAddress,
              insuredMobile: data.insured_mobile || newClaim.policy.insuredMobile,
              insurerName: data.insurer_name && data.insurer_address ? `${data.insurer_name} ${data.insurer_address}` : data.insurer_name || newClaim.policy.insurerName,
              idv: data.idv || newClaim.policy.idv,
              // Write to both hpaWith (primary) and hpa (alias) so all report paths are covered
              hpaWith: data.hpa_with || newClaim.policy.hpaWith,
              periodFrom: parseDate(data.period_from) || newClaim.policy.periodFrom,
              periodTo: parseDate(data.period_to) || newClaim.policy.periodTo,
              policyIssuingOffice: data.policy_issuing_office || newClaim.policy.policyIssuingOffice,
              // appointingOffice is intentionally NOT read from AI — surveyor fills this manually
              appointingOffice: newClaim.policy.appointingOffice,
              policyType: data.policy_type || newClaim.policy.policyType,
            };
            if (data.registration_number) newClaim.vehicle.registrationNumber = data.registration_number;
            if (data.chassis_number) newClaim.vehicle.chassisNumber = data.chassis_number;
            if (data.engine_number) newClaim.vehicle.engineNumber = data.engine_number;
            if (data.make_model && !newClaim.vehicle.make) {
              const parts = data.make_model.split(/[/,\s]+/);
              if (parts.length >= 2) {
                newClaim.vehicle.make = parts[0].trim();
                newClaim.vehicle.model = parts.slice(1).join(' ').trim();
              }
            }
          } else if (key === 'dl') {
            newClaim.driver = { 
              ...newClaim.driver,
              licenceNumber: data.licence_number || data.dl_no || newClaim.driver.licenceNumber,
              parentName: data.father_or_husband_name || data.father_name || data.parent_name || newClaim.driver.parentName,
              relationType: data.relation_type || newClaim.driver.relationType,
              dateOfBirth: parseDate(data.date_of_birth || data.dob) || newClaim.driver.dateOfBirth,
              address: data.address || newClaim.driver.address,
              dateOfIssue: parseDate(data.date_of_issue || data.issue_date) || newClaim.driver.dateOfIssue,
              issuingAuthority: data.issuing_authority || data.rto || newClaim.driver.issuingAuthority,
              vehicleClasses: data.vehicle_classes || data.classes || data.authorized_classes || newClaim.driver.vehicleClasses,
              validityNonTransport: parseDate(data.validity_non_transport || data.valid_nt) || newClaim.driver.validityNonTransport,
              validityTransport: parseDate(data.validity_transport || data.valid_t) || newClaim.driver.validityTransport,
            };
            // NOTE: driver fields are now exclusively in driver.* — no spotDetails dual-write needed.
          } else if (key === 'claim') {
             newClaim.policy = {
               ...newClaim.policy,
               claimNumber: data.claim_number || newClaim.policy.claimNumber,
               policyNumber: data.policy_number || newClaim.policy.policyNumber,
               insuredName: data.insured_name || newClaim.policy.insuredName,
             };
             newClaim.vehicle = {
               ...newClaim.vehicle,
               registrationNumber: data.vehicle_number || newClaim.vehicle.registrationNumber,
             };
             newClaim.driver = {
               ...newClaim.driver,
               name: data.driver_name || newClaim.driver.name,
               licenceNumber: data.driver_licence_no || newClaim.driver.licenceNumber,
             };
             newClaim.accident = {
               ...newClaim.accident,
               placeOfAccident: data.place_of_accident || newClaim.accident.placeOfAccident,
               causeOfAccident: data.cause_of_accident || newClaim.accident.causeOfAccident,
               placeOfSurvey: data.workshop_name || data.place_of_repair || newClaim.accident.placeOfSurvey,
               thirdPartyDetails: data.third_party_details || newClaim.accident.thirdPartyDetails,
               dateAndTime: data.date_of_accident ? `${parseDate(data.date_of_accident)}T${(data.time_of_accident || '00:00').substring(0, 5)}` : newClaim.accident.dateAndTime,
             };
             // NOTE: surveyPlace -> accident.placeOfSurvey, thirdPartyDetails -> accident.thirdPartyDetails
             // driver.name and driver.licenceNumber already set above — no spotDetails dual-write needed.
             if (data.third_party_details && data.third_party_details.toLowerCase() !== 'nil') {
                const s = data.third_party_details.toLowerCase();
                const v = (s.includes('injur') || s.includes('death')) && (s.includes('damage') || s.includes('property')) ? 'both' 
                          : s.includes('injur') || s.includes('death') ? 'tppi' : 'tppd';
                newClaim.spotDetails.tpInvolved = v;
             }
          } else if (key === 'permit') {
             newClaim.spotDetails = {
               ...newClaim.spotDetails,
               permitNo: data.permit_no || newClaim.spotDetails.permitNo,
               permitType: data.permit_type || newClaim.spotDetails.permitType,
               permitFrom: parseDate(data.validity_from) || newClaim.spotDetails.permitFrom,
               permitTo: parseDate(data.validity_to) || newClaim.spotDetails.permitTo,
             };
             if (data.route) newClaim.vehicle.route = data.route;
             const gvwStr = String(data.gross_vehicle_weight_kg || '0').replace(/[^0-9.]/g, '');
             const ulwStr = String(data.unladen_weight_kg || '0').replace(/[^0-9.]/g, '');
             if (gvwStr) newClaim.spotDetails.gvw = Math.round(parseFloat(gvwStr));
             if (ulwStr) newClaim.spotDetails.ulw = Math.round(parseFloat(ulwStr));
          } else if (key === 'auth') {
             newClaim.spotDetails = {
               ...newClaim.spotDetails,
               authNo: data.auth_no || newClaim.spotDetails.authNo,
               authValid: parseDate(data.validity_to) || newClaim.spotDetails.authValid,
             };
          } else if (key === 'fitness') {
             newClaim.vehicle.fitnessNo = data.fitness_cert_no || newClaim.vehicle.fitnessNo;
             newClaim.vehicle.fitnessValidUpto = parseDate(data.validity_to) || newClaim.vehicle.fitnessValidUpto;
             if (data.seating_capacity) {
               newClaim.vehicle.seatingCapacity = data.seating_capacity;
             }
             if (data.chassis_number) newClaim.vehicle.chassisNumber = data.chassis_number || newClaim.vehicle.chassisNumber;
             if (data.engine_number) newClaim.vehicle.engineNumber = data.engine_number || newClaim.vehicle.engineNumber;
             if (data.fitness_type) newClaim.vehicle.fitnessType = data.fitness_type;
             // NOTE: fitnessNo/fitnessValid removed from spotDetails — vehicle.* is the single source of truth.
             
             const gvwStr = String(data.gross_vehicle_weight_kg || '0').replace(/[^0-9.]/g, '');
             const ulwStr = String(data.unladen_weight_kg || '0').replace(/[^0-9.]/g, '');
             if (gvwStr) newClaim.spotDetails.gvw = Math.round(parseFloat(gvwStr));
             if (ulwStr) newClaim.spotDetails.ulw = Math.round(parseFloat(ulwStr));
          } else if (key === 'lok-challan') {
             newClaim.spotDetails = {
               ...newClaim.spotDetails,
               challanNo: data.challan_no || newClaim.spotDetails.challanNo,
               challanDate: parseDate(data.challan_date) || newClaim.spotDetails.challanDate,
               loadOrigin: data.origin || newClaim.spotDetails.loadOrigin,
               loadDest: data.destination || newClaim.spotDetails.loadDest,
               loadDesc: data.goods_description || newClaim.spotDetails.loadDesc,
               actualLoad: parseFloat(data.weight_kg) || newClaim.spotDetails.actualLoad,
             };
             newClaim.vehicle.actualPayload = data.weight_kg || newClaim.vehicle.actualPayload;
          } else if (key === 'final-bill') {
            newClaim.billCheck = {
              billNo: data.bill_number || '',
              billDate: data.bill_date || '',
              billTotal: data.total_amount || 0,
            };

            // Build bill items with normalized section tags matching assessment sections.
            const billItems: Array<{
              idx: number;
              description: string;
              partNumber: string;
              taxableAmount: number;
              totalAmount: number;
              gstPercent: number;
              section: 'parts' | 'labour' | 'paint';
              category?: string;
              raw: any;
            }> = [];
            const pushItems = (arr: any[], section: 'parts' | 'labour' | 'paint') => {
              (arr || []).forEach((i: any) => {
                const gstPct = i.gst_percent || 18;
                let taxable = i.taxable_amount;
                const total = i.total_amount || i.amount || 0;
                if (!taxable || taxable <= 0) {
                  taxable = total / (1 + gstPct / 100);
                }
                billItems.push({
                  idx: billItems.length,
                  description: (i.description || '').toString(),
                  partNumber: (i.part_number || '').toString(),
                  taxableAmount: Math.round(taxable * 100) / 100,
                  totalAmount: Math.round(total * 100) / 100,
                  gstPercent: gstPct,
                  section,
                  category: i.category,
                  raw: i,
                });
              });
            };
            pushItems(data.spare_parts || [], 'parts');
            pushItems(data.labour_items || [], 'labour');
            pushItems(data.painting_items || [], 'paint');

            const normalizePart = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, '');
            const normalizeDesc = (s: string) => s.toLowerCase().trim();
            const AMT_TOL = 1; // ₹1 tolerance

            const matchedBillIds = new Set<number>();
            const rowMatches = new Map<string, { bill: typeof billItems[0]; reason: 'part' | 'amount' | 'desc' }>();

            // --- Step 1: Exact part-number match ---
            newClaim.assessmentRows.forEach(row => {
              if (rowMatches.has(row.id)) return;
              const rowPart = normalizePart(row.partNumber || '');
              if (!rowPart) return;
              const hit = billItems.find(bi => {
                if (matchedBillIds.has(bi.idx)) return false;
                const biPart = normalizePart(bi.partNumber);
                return biPart && biPart === rowPart;
              });
              if (hit) {
                matchedBillIds.add(hit.idx);
                rowMatches.set(row.id, { bill: hit, reason: 'part' });
              }
            });

            // --- Step 2: Taxable-amount + section match (± ₹1) ---
            newClaim.assessmentRows.forEach(row => {
              if (rowMatches.has(row.id)) return;
              const rowAmt = row.estimated || 0;
              if (rowAmt <= 0) return;
              // Find all unmatched bill items in same section within tolerance
              const candidates = billItems.filter(bi =>
                !matchedBillIds.has(bi.idx) &&
                bi.section === row.section &&
                Math.abs(bi.taxableAmount - rowAmt) <= AMT_TOL
              );
              if (candidates.length === 0) return;
              let pick = candidates[0];
              let ambiguous = false;
              if (candidates.length > 1) {
                // Tiebreaker: description overlap
                const rowDesc = normalizeDesc(row.particulars);
                const scored = candidates.map(c => {
                  const cDesc = normalizeDesc(c.description);
                  const overlap =
                    (rowDesc && cDesc && (cDesc.includes(rowDesc) || rowDesc.includes(cDesc))) ? 2 :
                    (rowDesc && cDesc && cDesc.split(' ').some(w => w.length > 3 && rowDesc.includes(w))) ? 1 : 0;
                  return { c, overlap };
                });
                scored.sort((a, b) => b.overlap - a.overlap);
                pick = scored[0].c;
                if (scored[0].overlap === 0 || (scored[1] && scored[0].overlap === scored[1].overlap)) {
                  ambiguous = true;
                }
              }
              matchedBillIds.add(pick.idx);
              rowMatches.set(row.id, { bill: pick, reason: ambiguous ? 'desc' : 'amount' });
              if (ambiguous) {
                // Mark the row as needing review — handled below via billRemarks
                (pick as any)._ambiguous = true;
              }
            });

            // --- Step 3: Fuzzy description fallback ---
            newClaim.assessmentRows.forEach(row => {
              if (rowMatches.has(row.id)) return;
              const rowDesc = normalizeDesc(row.particulars);
              if (!rowDesc) return;
              const hit = billItems.find(bi => {
                if (matchedBillIds.has(bi.idx)) return false;
                if (bi.section !== row.section) return false;
                const biDesc = normalizeDesc(bi.description);
                if (!biDesc) return false;
                return biDesc.includes(rowDesc) || rowDesc.includes(biDesc);
              });
              if (hit) {
                matchedBillIds.add(hit.idx);
                rowMatches.set(row.id, { bill: hit, reason: 'desc' });
              }
            });

            // --- Apply matches to rows ---
            newClaim.assessmentRows = newClaim.assessmentRows.map(row => {
              const m = rowMatches.get(row.id);
              if (!m) return row;
              const billedAmt = m.bill.totalAmount || 0;
              const billedTax = m.bill.taxableAmount || 0;
              const partial =
                m.reason === 'part' &&
                row.estimated > 0 &&
                Math.abs(m.bill.taxableAmount - row.estimated) > AMT_TOL;
              if (!row.allowed) {
                return {
                  ...row,
                  billedTaxable: billedTax,
                  billedAmount: billedAmt,
                  billStatus: 'not-allowed' as const,
                  billRemarks: row.billRemarks || 'Workshop billed for a disallowed item',
                };
              }
              const status: 'in-bill' | 'partial' = partial ? 'partial' : 'in-bill';
              const remark = (m.bill as any)._ambiguous
                ? 'Ambiguous amount match — please verify'
                : row.billRemarks;
              return { ...row, billedTaxable: billedTax, billedAmount: billedAmt, billStatus: status, billRemarks: remark };
            });

            // --- Unmatched bill items become extras ---
            const unmatched: ExtraBillItem[] = billItems
              .filter(bi => !matchedBillIds.has(bi.idx))
              .map((bi, i) => ({
                id: `extra-${Date.now()}-${i}`,
                description: bi.description || 'Unnamed item',
                amount: bi.totalAmount,
                category:
                  bi.section === 'parts' ? 'spare_parts' :
                  bi.section === 'labour' ? 'labour' :
                  'painting',
                source: 'final-bill' as const,
              }));
            newClaim.extraBillItems = unmatched;
          } else if (key === 'estimate') {
            const newRows: AssessmentRow[] = [];
            let runningSerial = 1;
            (data.spare_parts || []).forEach((item: any, idx: number) => {
              // The estimate AI prompt extracts taxable_amount (net, before GST) directly.
              // Prefer it. Fall back to back-calculating from total_amount if missing.
              const gstPct = item.gst_percent || 18;
              let base: number;
              if (item.taxable_amount && item.taxable_amount > 0) {
                base = item.taxable_amount;
              } else {
                const gross = item.total_amount || item.amount || 0;
                base = gross / (1 + gstPct / 100);
              }
              const rounded = Math.round(base * 100) / 100;
              newRows.push(createAssessmentRow('parts', {
                srNo: item.sr_no || runningSerial++,
                particulars: item.description || 'Unnamed Part',
                partNumber: item.part_number || '',
                hsnSac: item.hsn_sac || '',
                quantity: item.quantity || 1,
                unitPrice: item.unit_price || 0,
                estimated: rounded,
                assessed: rounded,
                partType: (item.category as any) || 'metal',
                gst: gstPct,
              }));
            });
            (data.labour_items || []).forEach((item: any) => {
              const gstPct = item.gst_percent || 18;
              let base: number;
              if (item.taxable_amount && item.taxable_amount > 0) {
                base = item.taxable_amount;
              } else {
                const gross = item.total_amount || item.amount || 0;
                base = gross / (1 + gstPct / 100);
              }
              const rounded = Math.round(base * 100) / 100;
              newRows.push(createAssessmentRow('labour', {
                srNo: item.sr_no || runningSerial++,
                particulars: item.description || 'Labour Item',
                hsnSac: item.hsn_sac || '',
                quantity: item.quantity || 1,
                unitPrice: item.unit_price || 0,
                estimated: rounded,
                assessed: rounded,
                partType: 'labour',
                gst: gstPct,
              }));
            });
            (data.painting_items || []).forEach((item: any) => {
              const gstPct = item.gst_percent || 18;
              let base: number;
              if (item.taxable_amount && item.taxable_amount > 0) {
                base = item.taxable_amount;
              } else {
                const gross = item.total_amount || item.amount || 0;
                base = gross / (1 + gstPct / 100);
              }
              const rounded = Math.round(base * 100) / 100;
              newRows.push(createAssessmentRow('paint', {
                srNo: item.sr_no || runningSerial++,
                particulars: item.description || 'Painting Item',
                hsnSac: item.hsn_sac || '',
                quantity: item.quantity || 1,
                unitPrice: item.unit_price || 0,
                estimated: rounded,
                assessed: rounded,
                partType: 'paint',
                gst: gstPct,
              }));
            });
            // Sort by original serial number to preserve invoice order
            newRows.sort((a, b) => (a.srNo || 0) - (b.srNo || 0));
            newClaim.assessmentRows = [...newClaim.assessmentRows, ...newRows];
            if (data.workshop_name) newClaim.accident.placeOfSurvey = data.workshop_name;
          }

          return {
            currentClaim: { ...newClaim, updatedAt: new Date().toISOString() },
            isDirty: true,
          };
        });
      },

      reconcileField: (path, value) => {
        set((state) => {
          if (!state.currentClaim) return {};
          const newClaim = { ...state.currentClaim };
          
          // Simple deep set for "top.sub" paths
          const parts = path.split('.');
          if (parts.length === 2) {
            const [top, sub] = parts;
            (newClaim as any)[top] = {
              ...(newClaim as any)[top],
              [sub]: value
            };
          } else {
            // Handle root level if needed (though mapping usually uses path.sub)
            (newClaim as any)[path] = value;
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
