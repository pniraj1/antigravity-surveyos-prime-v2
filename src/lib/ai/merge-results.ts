/**
 * Helper to deep merge AI JSON fragments from multi-page extractions.
 * Concatenates arrays and fills in empty/new fields.
 */
// Fields that represent document-level financial totals.
// For these we keep the LARGEST non-zero value seen across all page chunks
// (a page that has no summary row returns 0, which should never overwrite
// a real total found on a later page).
const TOTAL_FIELDS = new Set([
  'total_amount', 'gross_amount', 'net_amount', 'payable_amount',
  'subtotal_parts_taxable', 'subtotal_labour_taxable', 'subtotal_painting_taxable',
  'gst_amount', 'discount_amount', 'tds_amount',
]);

export function mergeAIResults(acc: any, fragment: any): any {
  if (!acc) return fragment;
  const result = { ...acc };

  for (const key in fragment) {
    const newVal = fragment[key];
    const oldVal = result[key];

    if (Array.isArray(newVal)) {
      // Concatenate list items (e.g. spare_parts, labour_items)
      result[key] = [...(Array.isArray(oldVal) ? oldVal : []), ...newVal];
    } else if (typeof newVal === 'object' && newVal !== null) {
      // Recursive merge for sub-objects
      result[key] = mergeAIResults(oldVal || {}, newVal);
    } else if (TOTAL_FIELDS.has(key)) {
      // Financial totals: keep the largest non-zero value across all pages.
      // This prevents a page-1 zero from permanently hiding the real total
      // found on a later summary page.
      const oldNum = Number(oldVal) || 0;
      const newNum = Number(newVal) || 0;
      result[key] = Math.max(oldNum, newNum) || oldVal;
    } else {
      // Simple values: prefer existing if already set, otherwise take new
      if (oldVal === undefined || oldVal === null || oldVal === '') {
        result[key] = newVal;
      }
    }
  }
  return result;
}
