// Barrel export for calculations engine
export { getVehicleAgeMonths, getDepreciationRate, applyDepreciation, getAgeLabel, getDepPolicyLabel } from './depreciation';
export { calculatePartsGST, calculateLabourGST, calculateFeeGST } from './gst';
export { calculateAssessmentSummary, createAssessmentRow, calculateBillCheckSummary, getCompulsoryExcess } from './assessment';
export { calculateFeeSummary, getFeeLineItems } from './fees';
export { computeRowNet, computeRowLiability } from './row-net';
export { numberToWords, formatCurrency, formatCurrencyShort, formatDateDMY, formatDateTimeDMY, generateId } from './utils';

export type { RowNetResult, RowLiabilityResult } from './row-net';
export type { GSTBreakdown } from './gst';
export type { FeeSummary } from './fees';
