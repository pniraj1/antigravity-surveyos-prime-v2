// ═══════════════════════════════════════════════════════════
// DEPRECIATION ENGINE
// Exact mirror of getDepRate() + getVehicleAgeMonths()
// from Surveyor_V6_MASTER.html lines 1841-1859
// ═══════════════════════════════════════════════════════════

import type { PartType, DepreciationType } from '@/types';
import type { InsuredReportPolicyClause } from '@/types/insured-report';

/**
 * Calculate vehicle age in months from registration/manufacture date to reference date.
 * Legacy: getVehicleAgeMonths() — lines 1846-1853
 */
export function getVehicleAgeMonths(
  registrationDate: string | null,
  yearOfManufacture: number | null,
  referenceDate?: string | null
): number {
  let start: Date | null = null;

  if (registrationDate) {
    start = new Date(registrationDate);
  } else if (yearOfManufacture) {
    start = new Date(yearOfManufacture, 0, 1); // Jan 1 of manufacture year
  }

  if (!start || isNaN(start.getTime())) return 0;

  const ref = referenceDate ? new Date(referenceDate) : new Date();
  if (isNaN(ref.getTime()) || ref < start) return 0;

  return (ref.getFullYear() - start.getFullYear()) * 12 + ref.getMonth() - start.getMonth();
}

/**
 * Get IRDAI standard depreciation rate for a part type based on vehicle age.
 * Legacy: getDepRate(pt) — lines 1854-1859
 *
 * Rules (Standard IRDAI):
 * - Glass: always 0%
 * - Plastic/Rubber: always 50%
 * - Labour/Paint: always 0%
 * - Metal: age-based scale below
 *
 * Metal depreciation scale:
 *   0-6 months:    0%
 *   6-12 months:   5%
 *   12-24 months:  10%
 *   24-36 months:  15%
 *   36-48 months:  25%
 *   48-60 months:  35%
 *   60-120 months: 40%
 *   120+ months:   50%
 */
export function getDepreciationRate(
  partType: PartType,
  ageMonths: number,
  policyType: DepreciationType
): number {
  // Nil depreciation = 0% on everything
  if (policyType === 'nil') return 0;

  // Standard IRDAI depreciation
  if (partType === 'glass') return 0;
  if (partType === 'plastic') return 50;
  if (partType === 'fiberglass') return 30;
  if (partType === 'labour' || partType === 'paint') return 0;

  // Metal — age-based scale
  if (ageMonths <= 6) return 0;
  if (ageMonths <= 12) return 5;
  if (ageMonths <= 24) return 10;
  if (ageMonths <= 36) return 15;
  if (ageMonths <= 48) return 25;
  if (ageMonths <= 60) return 35;
  if (ageMonths <= 120) return 40;
  return 50;
}

/**
 * Calculate the after-depreciation value for a single part.
 */
export function applyDepreciation(
  assessedAmount: number,
  partType: PartType,
  ageMonths: number,
  policyType: DepreciationType
): number {
  const rate = getDepreciationRate(partType, ageMonths, policyType);
  return assessedAmount * (1 - rate / 100);
}

/**
 * Get a human-readable label for vehicle age.
 */
export function getAgeLabel(ageMonths: number): string {
  if (ageMonths <= 0) return '';
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  return `${years}yr ${months}mo`;
}

/**
 * Get depreciation policy label for reports.
 */
export function getDepPolicyLabel(
  policyType: DepreciationType,
  ageMonths: number
): string {
  switch (policyType) {
    case 'nil': return 'Nil Depreciation';
    case 'standard':
    default:
      return `Standard IRDAI ${getAgeLabel(ageMonths)}`;
  }
}

export function getIRDAIStandardClauses(): InsuredReportPolicyClause[] {
  return [
    {
      clauseType: 'depreciation',
      clauseTitle: 'Depreciation on Parts',
      policyText: 'As per IRDAI Motor Insurance guidelines, depreciation is applied on replaced parts based on the age of the vehicle. Plastic and rubber parts attract 50% depreciation; metal parts range from 0% (under 6 months) to 50% (over 10 years).',
      plainLanguage: 'The insurance company deducts a depreciation amount from the cost of replaced parts based on your vehicle\'s age. Older vehicles attract higher depreciation. Glass and labour charges have zero depreciation.',
      source: 'irdai-standard',
    },
    {
      clauseType: 'excess',
      clauseTitle: 'Compulsory Excess',
      policyText: 'Every motor insurance policy includes a Compulsory Excess (also called deductible) as specified in the policy schedule. This amount is mandated by IRDAI and is borne by the insured for every claim.',
      plainLanguage: 'Your policy has a fixed amount (called compulsory excess) that you must pay on every claim, no matter how small or large. This is set by the insurance company and cannot be waived.',
      source: 'irdai-standard',
    },
    {
      clauseType: 'consumables-exclusion',
      clauseTitle: 'Consumables Not Covered',
      policyText: 'Standard motor insurance policies exclude consumables such as engine oil, coolant, brake fluid, air filter, AC gas, nuts, bolts, and grease. These items are covered only if a specific consumables add-on cover has been purchased.',
      plainLanguage: 'Items like engine oil, coolant, AC gas, and filters are not covered under a standard policy. These are considered consumables — things that wear out regularly and need replacement regardless of an accident.',
      source: 'irdai-standard',
    },
    {
      clauseType: 'salvage',
      clauseTitle: 'Salvage / Disposal of Parts',
      policyText: 'When a part is replaced under a claim, the old damaged part becomes the property of the insurance company. The salvage value of such parts is deducted from the claim settlement amount.',
      plainLanguage: 'When the workshop replaces a damaged part with a new one, the old part belongs to the insurance company. Its estimated scrap value is deducted from your claim payment.',
      source: 'irdai-standard',
    },
    {
      clauseType: 'specific-exclusion',
      clauseTitle: 'Pre-existing and Unrelated Damage',
      policyText: 'Damage that existed prior to the reported accident, or damage that is not directly attributable to the cause of loss described in the claim, is not payable under the policy.',
      plainLanguage: 'If any part of your vehicle was already damaged before this accident, or if a part is unrelated to the accident cause, the surveyor cannot include it in this claim. Only damage caused by this specific accident is covered.',
      source: 'irdai-standard',
    },
  ];
}
