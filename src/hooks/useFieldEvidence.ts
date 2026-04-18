'use client';

import { useCallback } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';

/**
 * Maps each store field name (camelCase) to the docType and AI extraction key
 * that produced it. This lets any input in the Details tab call
 * `triggerField('registrationNumber')` on focus to open the Evidence Viewer
 * on the correct document + highlight the context snippet.
 */
const FIELD_MAP: Record<string, { docType: string; aiKey: string }> = {
  // ── RC Book ──────────────────────────────────────────────────────────────
  registrationNumber:       { docType: 'rc', aiKey: 'registration_number' },
  classOfVehicle:           { docType: 'rc', aiKey: 'class_of_vehicle' },
  make:                     { docType: 'rc', aiKey: 'make' },
  model:                    { docType: 'rc', aiKey: 'model' },
  yearOfManufacture:        { docType: 'rc', aiKey: 'year_of_manufacture' },
  bodyType:                 { docType: 'rc', aiKey: 'body_type' },
  chassisNumber:            { docType: 'rc', aiKey: 'chassis_number' },
  engineNumber:             { docType: 'rc', aiKey: 'engine_number' },
  cubicCapacity:            { docType: 'rc', aiKey: 'cubic_capacity' },
  colour:                   { docType: 'rc', aiKey: 'colour' },
  fuel:                     { docType: 'rc', aiKey: 'fuel_type' },
  odometer:                 { docType: 'rc', aiKey: 'odometer' },
  registeringAuthority:     { docType: 'rc', aiKey: 'registering_authority' },
  registrationValidUpTo:    { docType: 'rc', aiKey: 'registration_valid_upto' },
  rcEndorsement:            { docType: 'rc', aiKey: 'rc_endorsement' },
  dateOfRegistration:       { docType: 'rc', aiKey: 'date_of_registration' },
  registeredLoadWeight:     { docType: 'rc', aiKey: 'gross_weight' },
  unladenWeight:            { docType: 'rc', aiKey: 'unladen_weight' },
  seatingCapacityTotal:     { docType: 'rc', aiKey: 'seating_capacity' },
  fitnessNo:                { docType: 'rc', aiKey: 'fitness_number' },
  fitnessValidUpto:         { docType: 'rc', aiKey: 'fitness_valid_upto' },
  route:                    { docType: 'rc', aiKey: 'route' },

  // ── Policy Schedule ───────────────────────────────────────────────────────
  policyNumber:             { docType: 'policy', aiKey: 'policy_number' },
  insuredName:              { docType: 'policy', aiKey: 'insured_name' },
  insuredAddress:           { docType: 'policy', aiKey: 'insured_address' },
  insuredMobile:            { docType: 'policy', aiKey: 'insured_mobile' },
  insurerName:              { docType: 'policy', aiKey: 'insurer_name' },
  idv:                      { docType: 'policy', aiKey: 'idv' },
  hpaWith:                  { docType: 'policy', aiKey: 'hpa_with' },
  hpa:                      { docType: 'policy', aiKey: 'hpa_with' },
  periodFrom:               { docType: 'policy', aiKey: 'period_from' },
  periodTo:                 { docType: 'policy', aiKey: 'period_to' },
  policyIssuingOffice:      { docType: 'policy', aiKey: 'policy_issuing_office' },
  policyType:               { docType: 'policy', aiKey: 'policy_type' },
  claimNumber:              { docType: 'policy', aiKey: 'claim_number' },

  // ── Driving Licence ───────────────────────────────────────────────────────
  licenceNumber:            { docType: 'dl', aiKey: 'licence_number' },
  driverName:               { docType: 'dl', aiKey: 'holder_name' },
  name:                     { docType: 'dl', aiKey: 'holder_name' },
  fatherHusbandName:        { docType: 'dl', aiKey: 'father_or_husband_name' },
  parentName:               { docType: 'dl', aiKey: 'father_or_husband_name' },
  relationType:             { docType: 'dl', aiKey: 'relation_type' },
  dob:                      { docType: 'dl', aiKey: 'date_of_birth' },
  dateOfBirth:              { docType: 'dl', aiKey: 'date_of_birth' },
  address:                  { docType: 'dl', aiKey: 'address' },
  dateOfIssue:              { docType: 'dl', aiKey: 'date_of_issue' },
  issuingAuthority:         { docType: 'dl', aiKey: 'issuing_authority' },
  vehicleClass:             { docType: 'dl', aiKey: 'vehicle_classes' },
  vehicleClasses:           { docType: 'dl', aiKey: 'vehicle_classes' },
  validityNonTransport:     { docType: 'dl', aiKey: 'validity_non_transport' },
  validityTransport:        { docType: 'dl', aiKey: 'validity_transport' },
};

/**
 * Returns `triggerField(fieldName)` — call this in any input's `onFocus`.
 * It will open the inline Evidence Panel on the source document and show
 * the AI context snippet for that field.
 *
 * Also returns `hasEvidence(fieldName)` — true when a context snippet
 * exists (use to show a small eye icon on the label).
 */
export function useFieldEvidence() {
  const claimId        = useClaimStore(s => s.currentClaim?.id ?? '');
  const extractedDocs  = useClaimStore(s => s.currentClaim?.extractedData ?? {});
  const openField      = useEvidenceStore(s => s.openField);

  const triggerField = useCallback((fieldName: string) => {
    const mapping = FIELD_MAP[fieldName];
    if (!mapping) return;

    const { docType, aiKey } = mapping;
    const docData = extractedDocs[docType] as Record<string, string> | undefined;
    if (!docData) return;            // document not yet scanned

    const contextSnippet = docData[`${aiKey}_context`] ?? '';
    openField(claimId, { docType, fieldKey: aiKey, contextSnippet });
  }, [claimId, extractedDocs, openField]);

  const hasEvidence = useCallback((fieldName: string): boolean => {
    const mapping = FIELD_MAP[fieldName];
    if (!mapping) return false;
    const docData = extractedDocs[mapping.docType] as Record<string, string> | undefined;
    if (!docData) return false;
    return Boolean(docData[`${mapping.aiKey}_context`]);
  }, [extractedDocs]);

  return { triggerField, hasEvidence };
}
