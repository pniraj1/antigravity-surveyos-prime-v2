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
  // Vehicle Details
  { label: 'Registration Number', path: 'vehicle.registrationNumber', aiKeys: { rc: 'registration_number', policy: 'registration_number', fitness: 'vehicle_number', claim: 'vehicle_number' } },
  { label: 'Chassis Number',      path: 'vehicle.chassisNumber',      aiKeys: { rc: 'chassis_number', policy: 'chassis_number', fitness: 'chassis_number', estimate: 'chassis_number' } },
  { label: 'Engine Number',       path: 'vehicle.engineNumber',       aiKeys: { rc: 'engine_number', policy: 'engine_number', fitness: 'engine_number', estimate: 'engine_number' } },
  { label: 'Make',                path: 'vehicle.make',              aiKeys: { rc: 'make' } },
  { label: 'Model',               path: 'vehicle.model',             aiKeys: { rc: 'model' } },
  { label: 'Fuel Type',           path: 'vehicle.fuelType',          aiKeys: { rc: 'fuel', fitness: 'fuel_type' } },
  { label: 'Date of Reg',         path: 'vehicle.dateOfRegistration', aiKeys: { rc: 'date_of_registration' } },
  
  // Policy Details
  { label: 'Policy Number',       path: 'policy.policyNumber',       aiKeys: { policy: 'policy_number', claim: 'policy_number' } },
  { label: 'Insured Name',        path: 'policy.insuredName',        aiKeys: { policy: 'insured_name', rc: 'owner_name', claim: 'insured_name' } },
  { label: 'Insurer Name',        path: 'policy.insurerName',        aiKeys: { policy: 'insurer_name' } },
  { label: 'IDV',                 path: 'policy.idv',                aiKeys: { policy: 'idv' } },
  
  // Driver Details
  { label: 'Driver Name',         path: 'driver.name',               aiKeys: { dl: 'holder_name', claim: 'driver_name' } },
  { label: 'DL Number',           path: 'driver.licenceNumber',      aiKeys: { dl: 'licence_number', claim: 'driver_licence_no' } },
  { label: 'Date of Birth',       path: 'driver.dob',                aiKeys: { dl: 'date_of_birth' } },
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
    const hasConflict = uniqueNormalized.size > 1;

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
