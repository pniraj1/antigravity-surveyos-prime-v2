import { ClaimData } from '@/types';

export interface ReconciliationField {
  id: string;
  label: string;
  path: string; // e.g. "vehicle.registrationNumber"
  current: string;
  sources: {
    origin: string; // e.g. "rc", "policy", "dl"
    value: string;
    label: string;
  }[];
  hasConflict: boolean;
}

// ─── Mapping AI Keys to Claim Structure ────────────────────────────────────
const FIELD_MAPPINGS = [
  // ─── Vehicle Details ──────────────────────────────────────────────────────
  { label: 'Registration Number', path: 'vehicle.registrationNumber', aiKeys: { rc: 'registration_number', policy: 'registration_number', fitness: 'vehicle_number', claim: 'vehicle_number', fir: 'vehicle_number' } },
  { label: 'Chassis Number',      path: 'vehicle.chassisNumber',      aiKeys: { rc: 'chassis_number', policy: 'chassis_number', fitness: 'chassis_number', estimate: 'chassis_number' } },
  { label: 'Engine Number',       path: 'vehicle.engineNumber',       aiKeys: { rc: 'engine_number', policy: 'engine_number', fitness: 'engine_number', estimate: 'engine_number' } },
  { label: 'Make',                path: 'vehicle.make',              aiKeys: { rc: 'make' } },
  { label: 'Model',               path: 'vehicle.model',             aiKeys: { rc: 'model' } },
  { label: 'Fuel Type',           path: 'vehicle.fuelType',          aiKeys: { rc: 'fuel', fitness: 'fuel_type' } },
  { label: 'Date of Reg',         path: 'vehicle.dateOfRegistration', aiKeys: { rc: 'date_of_registration' } },
  { label: 'Cubic Capacity',      path: 'vehicle.cubicCapacity',      aiKeys: { rc: 'cubic_capacity' } },
  { label: 'Year of Mfg',         path: 'vehicle.yearOfManufacture', aiKeys: { rc: 'year_of_manufacture' } },
  { label: 'Body Type',           path: 'vehicle.bodyType',          aiKeys: { rc: 'body_type' } },
  { label: 'Class of Vehicle',    path: 'vehicle.classOfVehicle',    aiKeys: { rc: 'class_of_vehicle' } },
  { label: 'Unladen Weight',      path: 'vehicle.unladenWeight',     aiKeys: { rc: 'unladen_weight', fitness: 'unladen_weight_kg', permit: 'unladen_weight_kg' } },
  { label: 'Gross Weight',        path: 'vehicle.grossWeight',       aiKeys: { rc: 'gross_weight', fitness: 'gross_vehicle_weight_kg', permit: 'gross_vehicle_weight_kg' } },
  { label: 'Seating Capacity',    path: 'vehicle.seatingCapacity',   aiKeys: { rc: 'seating_capacity', fitness: 'seating_capacity' } },
  { label: 'Fitness Valid Upto',  path: 'vehicle.fitnessValidUpto',  aiKeys: { rc: 'fitness_valid_upto', fitness: 'validity_to' } },
  { label: 'Fitness Type',        path: 'vehicle.fitnessType',       aiKeys: { rc: 'fitness_type', fitness: 'fitness_type' } },
  
  // ─── Policy Details ───────────────────────────────────────────────────────
  { label: 'Policy Number',       path: 'policy.policyNumber',       aiKeys: { policy: 'policy_number', claim: 'policy_number' } },
  { label: 'Insured Name',        path: 'policy.insuredName',        aiKeys: { policy: 'insured_name', rc: 'owner_name', claim: 'insured_name' } },
  { label: 'Insurer Name',        path: 'policy.insurerName',        aiKeys: { policy: 'insurer_name' } },
  { label: 'IDV',                 path: 'policy.idv',                aiKeys: { policy: 'idv' } },
  { label: 'HPA/Hypothecation',   path: 'policy.hpaWith',            aiKeys: { policy: 'hpa_with', rc: 'hypothecation' } },
  
  // ─── Driver Details ───────────────────────────────────────────────────────
  { label: 'Driver Name',         path: 'driver.name',               aiKeys: { dl: 'holder_name', claim: 'driver_name', fir: 'driver_name' } },
  { label: 'Father/Husband Name', path: 'driver.fatherHusbandName',  aiKeys: { dl: 'father_or_husband_name' } },
  { label: 'Relation Type',       path: 'driver.relationType',       aiKeys: { dl: 'relation_type' } },
  { label: 'DL Number',           path: 'driver.licenceNumber',      aiKeys: { dl: 'licence_number', claim: 'driver_licence_no' } },
  { label: 'Date of Birth',       path: 'driver.dob',                aiKeys: { dl: 'date_of_birth' } },
  { label: 'Validity (Non-Tr)',   path: 'driver.validityNonTransport', aiKeys: { dl: 'validity_non_transport' } },
  { label: 'Validity (Transport)', path: 'driver.validityTransport',    aiKeys: { dl: 'validity_transport' } },
  { label: 'Issuing Authority',   path: 'driver.issuingAuthority',   aiKeys: { dl: 'issuing_authority' } },
  { label: 'Vehicle Classes',     path: 'driver.vehicleClasses',     aiKeys: { dl: 'vehicle_classes' } },
  { label: 'Badge Number',        path: 'driver.badgeNumber',        aiKeys: { dl: 'badge_no' } },

  // ─── Accident Details ─────────────────────────────────────────────────────
  { label: 'Accident Date/Time',  path: 'accident.dateAndTime',      aiKeys: { claim: 'date_of_accident', fir: 'date_of_accident' } },
  { label: 'Accident Place',      path: 'accident.placeOfAccident',  aiKeys: { claim: 'place_of_accident', fir: 'place_of_accident' } },
  { label: 'Cause of Accident',   path: 'accident.causeOfAccident',  aiKeys: { claim: 'cause_of_accident', fir: 'brief_accident_details' } },
  { label: 'Police Station',      path: 'accident.policeStation',    aiKeys: { fir: 'police_station' } },
  { label: 'FIR Number',          path: 'accident.firNumber',        aiKeys: { fir: 'fir_number' } },
  { label: 'FIR Date',            path: 'accident.firDate',          aiKeys: { fir: 'fir_date' } },
  { label: 'Accident Pincode',    path: 'accident.pincode',          aiKeys: { fir: 'pincode' } },
  { label: 'Workshop Name',       path: 'accident.workshopName',     aiKeys: { estimate: 'workshop_name', 'final-bill': 'workshop_name', claim: 'workshop_name' } },
];

/**
 * Gets a nested value from an object using a dot-path.
 */
function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj) || '';
}

/**
 * Normalizes values for comparison (removes spaces, dashes, case-insensitive).
 */
function normalize(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[\s-]/g, '').toLowerCase();
}

/**
 * Logic to identify all available data points for a claim.
 */
export function getReconciliationFields(claim: ClaimData): ReconciliationField[] {
  const result: ReconciliationField[] = [];
  const extractedStore = (claim.extractedData || {}) as Record<string, any>;

  for (const mapping of FIELD_MAPPINGS) {
    const currentValue = String(getNestedValue(claim, mapping.path));
    const sources: ReconciliationField['sources'] = [];

    // Check all potential AI sources for this field
    Object.entries(mapping.aiKeys).forEach(([docKey, aiKey]) => {
      const docData = extractedStore[docKey] as Record<string, any>;
      if (docData && docData[aiKey]) {
        sources.push({
          origin: docKey,
          label: docKey.toUpperCase(),
          value: String(docData[aiKey]),
        });
      }
    });

    if (sources.length === 0) continue;

    // A conflict exists if:
    // 1. Any source value differs from current value
    // 2. Multiple sources exist with different values
    const allValues = [currentValue, ...sources.map(s => s.value)];
    const uniqueNormalized = new Set(allValues.filter(v => v !== '').map(normalize));
    
    // It's a conflict if the sources disagree (size > 1), or if the field isn't set yet.
    const isCurrentSet = currentValue !== '';
    const hasConflict = uniqueNormalized.size > 1 || !isCurrentSet;

    result.push({
      id: mapping.path,
      label: mapping.label,
      path: mapping.path,
      current: currentValue,
      sources,
      hasConflict,
    });
  }

  return result;
}
