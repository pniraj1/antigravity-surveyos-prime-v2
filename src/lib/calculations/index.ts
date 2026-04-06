// Barrel export for calculations engine
export { getVehicleAgeMonths, getDepreciationRate, applyDepreciation, getAgeLabel, getDepPolicyLabel } from './depreciation';
export { calculatePartsGST, calculateLabourGST, calculateFeeGST } from './gst';
export { calculateAssessmentSummary, createAssessmentRow, calculateBillCheckSummary } from './assessment';
export { calculateFeeSummary, getFeeLineItems } from './fees';
export { numberToWords, formatCurrency, formatCurrencyShort, formatDateDMY, formatDateTimeDMY, parseDateToISO, generateId } from './utils';

export type { GSTBreakdown } from './gst';
export type { FeeSummary } from './fees';
