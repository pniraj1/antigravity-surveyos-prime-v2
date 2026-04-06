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
  reconcileField: (path: string, value: any) => void;

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
            newClaim.vehicle = { 
              ...newClaim.vehicle,
              registrationNumber: data.registration_number || newClaim.vehicle.registrationNumber,
              dateOfRegistration: data.date_of_registration || newClaim.vehicle.dateOfRegistration,
              chassisNumber: data.chassis_number || newClaim.vehicle.chassisNumber,
              engineNumber: data.engine_number || newClaim.vehicle.engineNumber,
              make: data.make || newClaim.vehicle.make,
              model: data.model || newClaim.vehicle.model,
              bodyType: data.body_type || newClaim.vehicle.bodyType,
              cubicCapacity: data.cubic_capacity || newClaim.vehicle.cubicCapacity,
              colour: data.colour || newClaim.vehicle.colour,
              fuel: data.fuel || newClaim.vehicle.fuel,
              seatingCapacity: data.seating_capacity || newClaim.vehicle.seatingCapacity,
              unladenWeight: parseFloat(data.unladen_weight) || newClaim.vehicle.unladenWeight,
              rlw: typeof data.gross_weight === 'string' ? data.gross_weight : String(data.gross_weight || newClaim.vehicle.rlw),
              classOfVehicle: data.class_of_vehicle || newClaim.vehicle.classOfVehicle,
              fitnessNo: data.fitness_cert_no || newClaim.vehicle.fitnessNo,
              fitnessValidUpto: data.fitness_valid_upto || newClaim.vehicle.fitnessValidUpto,
              route: data.route || newClaim.vehicle.route,
              yearOfManufacture: data.year_of_manufacture || newClaim.vehicle.yearOfManufacture,
              hpa: data.hypothecation || newClaim.vehicle.hpa,
            };
            newClaim.policy = {
              ...newClaim.policy,
              insuredName: data.owner_name || newClaim.policy.insuredName,
              insuredAddress: data.address || newClaim.policy.insuredAddress,
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
              hpa: data.hpa_with || newClaim.policy.hpa,
              periodFrom: data.period_from || newClaim.policy.periodFrom,
              periodTo: data.period_to || newClaim.policy.periodTo,
              policyIssuingOffice: data.policy_issuing_office || newClaim.policy.policyIssuingOffice,
              appointingOffice: data.appointing_office || newClaim.policy.appointingOffice,
              policyType: data.policy_type || newClaim.policy.policyType,
            };
            if (data.registration_number) newClaim.vehicle.registrationNumber = data.registration_number;
            if (data.chassis_number) newClaim.vehicle.chassisNumber = data.chassis_number;
            if (data.engine_number) newClaim.vehicle.engineNumber = data.engine_number;
          } else if (key === 'dl') {
            newClaim.driver = { 
              ...newClaim.driver,
              licenceNumber: data.licence_number || newClaim.driver.licenceNumber,
              name: data.holder_name || newClaim.driver.name,
              fatherHusbandName: data.father_or_husband_name || newClaim.driver.fatherHusbandName,
              relationType: data.relation_type || newClaim.driver.relationType,
              dob: data.date_of_birth || newClaim.driver.dob,
              address: data.address || newClaim.driver.address,
              dateOfIssue: data.date_of_issue || newClaim.driver.dateOfIssue,
              issuingAuthority: data.issuing_authority || data.rto || newClaim.driver.issuingAuthority,
              vehicleClass: data.vehicle_classes || newClaim.driver.vehicleClass,
              validityNonTransport: data.validity_non_transport || newClaim.driver.validityNonTransport,
              validityTransport: data.validity_transport || newClaim.driver.validityTransport,
            };
            newClaim.spotDetails = {
              ...newClaim.spotDetails,
              driverName: data.holder_name || newClaim.spotDetails.driverName,
              dlParentName: data.father_or_husband_name || newClaim.spotDetails.dlParentName,
              mdlNo: data.licence_number || newClaim.spotDetails.mdlNo,
              dlAuthority: data.issuing_authority || data.rto || newClaim.spotDetails.dlAuthority,
              dlType: data.vehicle_classes || newClaim.spotDetails.dlType,
              dlIssueDate: data.date_of_issue || newClaim.spotDetails.dlIssueDate,
              dlRelation: data.relation_type || newClaim.spotDetails.dlRelation,
              dlValidNT: data.validity_non_transport || newClaim.spotDetails.dlValidNT,
              dlValidT: data.validity_transport || newClaim.spotDetails.dlValidT,
            };
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
               dateAndTime: data.date_of_accident ? `${data.date_of_accident}T${(data.time_of_accident || '00:00').substring(0, 5)}` : newClaim.accident.dateAndTime,
             };
             newClaim.spotDetails = {
               ...newClaim.spotDetails,
               surveyPlace: data.workshop_name || data.place_of_repair || newClaim.spotDetails.surveyPlace,
               tpDetails: data.third_party_details || newClaim.spotDetails.tpDetails,
               driverName: data.driver_name || newClaim.spotDetails.driverName,
               mdlNo: data.driver_licence_no || newClaim.spotDetails.mdlNo,
             };
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
               permitFrom: data.validity_from || newClaim.spotDetails.permitFrom,
               permitTo: data.validity_to || newClaim.spotDetails.permitTo,
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
               authValid: data.validity_to || newClaim.spotDetails.authValid,
             };
          } else if (key === 'fitness') {
             newClaim.vehicle.fitnessNo = data.fitness_cert_no || newClaim.vehicle.fitnessNo;
             newClaim.spotDetails.fitnessNo = data.fitness_cert_no || newClaim.spotDetails.fitnessNo;
             newClaim.vehicle.fitnessValidUpto = data.validity_to || newClaim.vehicle.fitnessValidUpto;
             newClaim.spotDetails.fitnessValid = data.validity_to || newClaim.spotDetails.fitnessValid;
             
             const gvwStr = String(data.gross_vehicle_weight_kg || '0').replace(/[^0-9.]/g, '');
             const ulwStr = String(data.unladen_weight_kg || '0').replace(/[^0-9.]/g, '');
             if (gvwStr) newClaim.spotDetails.gvw = Math.round(parseFloat(gvwStr));
             if (ulwStr) newClaim.spotDetails.ulw = Math.round(parseFloat(ulwStr));
          } else if (key === 'lok-challan') {
             newClaim.spotDetails = {
               ...newClaim.spotDetails,
               challanNo: data.challan_no || newClaim.spotDetails.challanNo,
               challanDate: data.challan_date || newClaim.spotDetails.challanDate,
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
