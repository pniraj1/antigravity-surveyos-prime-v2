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

const isPlainObject = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const isDocument = (x: unknown): boolean => isPlainObject(x) && Object.values(x).some(Array.isArray);
/** Rows carry a serial; a lone object without one is a scalar document (RC, DL, header). */
const isLoneDocument = (list: unknown[]): boolean =>
  list.length === 1 && isPlainObject(list[0]) && !('sr_no' in list[0]);

/**
 * A model sometimes wraps a page's answer in a list (`[ { spare_parts: … } ]`).
 * mergeAIResults would file that under key "0", where nothing reads it, and
 * the page's rows are lost. Fold document-shaped elements back into one object.
 */
// ponytail: a bare row list (rows with sr_no, no section keys) is left as-is — its section can't be known; it fails as before.
export function asFragment(parsed: unknown): unknown {
  if (!Array.isArray(parsed) || !parsed.every(isPlainObject)) return parsed;
  if (!parsed.some(isDocument) && !isLoneDocument(parsed)) return parsed;
  return parsed.reduce((acc: unknown, doc: unknown) => mergeAIResults(acc, doc), null);
}

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
