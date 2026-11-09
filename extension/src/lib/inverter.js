// @ts-check
/**
 * Value inverter for AI SurveyOS Portal Fill.
 * Correlates an observed value typed into a portal field against the active
 * PortalPacket (the claim's ground truth).
 *
 * Implements:
 * 1. Exact string matching (case-insensitive, trimmed)
 * 2. Numeric equivalence (ignoring commas, decimals, trailing zeroes)
 * 3. Date format variations (DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY)
 * 4. Substring matching for split fields (e.g. DL prefix "MH12" from "MH1220110001234")
 * 5. Ambiguity detection (flags when >1 field matches)
 */
(() => {
const NS = 'SxInverter';

/**
 * Normalise a date string to YYYY-MM-DD if possible.
 * @param {string} val
 * @returns {string | null}
 */
function toStandardDate(val) {
  const s = String(val ?? '').trim().split('T')[0];
  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    const y = m[1], mo = m[2].padStart(2, '0'), d = m[3].padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  // DD-MM-YYYY or DD/MM/YYYY
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0'), y = m[3];
    return `${y}-${mo}-${d}`;
  }
  return null;
}

/**
 * Normalise a numeric string for equivalence check.
 * "15,000.00" -> 15000
 * @param {unknown} val
 * @returns {number | null}
 */
function toNumeric(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).replace(/,/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Clean and normalise a string for loose comparison.
 * @param {unknown} val
 * @returns {string}
 */
function cleanStr(val) {
  return String(val ?? '').trim().toLowerCase();
}

/**
 * Test whether typed value correlates to claim value under known transforms.
 * Returns the transform name if matched, or null.
 * @param {string} typed
 * @param {unknown} claimVal
 * @returns {string | null}
 */
function checkFieldMatch(typed, claimVal) {
  if (claimVal === null || claimVal === undefined || claimVal === '') return null;

  const typedClean = cleanStr(typed);
  const claimClean = cleanStr(claimVal);

  if (!typedClean || !claimClean) return null;

  // 1. Exact string match (case-insensitive)
  if (typedClean === claimClean) return 'exact';

  // 2. Numeric match (e.g. "15000" vs "15000.00" or "15,000") - check before alphanumeric
  const numTyped = toNumeric(typed);
  const numClaim = toNumeric(claimVal);
  if (numTyped !== null && numClaim !== null && numTyped === numClaim) {
    return 'numeric';
  }

  // 3. Exact match after stripping spaces/hyphens (e.g. vehicle reg "MH 12 AB 1234" vs "MH12AB1234")
  const typedAlphaNum = typedClean.replace(/[^a-z0-9]/g, '');
  const claimAlphaNum = claimClean.replace(/[^a-z0-9]/g, '');
  if (typedAlphaNum && claimAlphaNum && typedAlphaNum === claimAlphaNum) {
    return 'alphanumeric';
  }

  // 4. Date format match
  const dateTyped = toStandardDate(typed);
  const dateClaim = toStandardDate(String(claimVal));
  if (dateTyped && dateClaim && dateTyped === dateClaim) {
    // Detect which format typed was
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(typed.trim())) return 'ddmmyyyy';
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(typed.trim())) return 'dd-mm-yyyy';
    return 'date';
  }

  // 5. Substring / Prefix / Suffix match for split fields
  // Only check if typed is at least 3 characters to avoid trivial 1-2 char false matches
  if (typedAlphaNum.length >= 3 && claimAlphaNum.length > typedAlphaNum.length) {
    if (claimAlphaNum.startsWith(typedAlphaNum)) {
      return `prefix:${typedAlphaNum.length}`;
    }
    if (claimAlphaNum.endsWith(typedAlphaNum)) {
      return `suffix:${typedAlphaNum.length}`;
    }
    const idx = claimAlphaNum.indexOf(typedAlphaNum);
    if (idx !== -1) {
      return `substr:${idx}:${typedAlphaNum.length}`;
    }
  }

  return null;
}

/**
 * Apply a recorded transform to a claim value at fill time.
 * @param {unknown} claimVal
 * @param {string} transform
 * @returns {string}
 */
function applyTransform(claimVal, transform) {
  if (claimVal === null || claimVal === undefined) return '';
  const s = String(claimVal);

  if (transform === 'exact') return s;
  if (transform === 'alphanumeric') return s.replace(/[^a-zA-Z0-9]/g, '');
  if (transform === 'numeric') {
    const n = toNumeric(s);
    return n !== null ? String(n) : s;
  }
  if (transform === 'ddmmyyyy') {
    const std = toStandardDate(s);
    if (std) {
      const [y, m, d] = std.split('-');
      return `${d}/${m}/${y}`;
    }
    return s;
  }
  if (transform === 'dd-mm-yyyy') {
    const std = toStandardDate(s);
    if (std) {
      const [y, m, d] = std.split('-');
      return `${d}-${m}-${y}`;
    }
    return s;
  }
  if (transform?.startsWith('prefix:')) {
    const len = parseInt(transform.slice('prefix:'.length), 10);
    const clean = s.replace(/[^a-zA-Z0-9]/g, '');
    return clean.slice(0, len);
  }
  if (transform?.startsWith('suffix:')) {
    const len = parseInt(transform.slice('suffix:'.length), 10);
    const clean = s.replace(/[^a-zA-Z0-9]/g, '');
    return clean.slice(-len);
  }
  if (transform?.startsWith('substr:')) {
    const parts = transform.split(':');
    const start = parseInt(parts[1], 10);
    const len = parseInt(parts[2], 10);
    const clean = s.replace(/[^a-zA-Z0-9]/g, '');
    return clean.slice(start, start + len);
  }

  return s;
}

/**
 * Correlate an observed input against a PortalPacket's fields.
 *
 * @param {string} typedValue - The text typed by the surveyor
 * @param {Record<string, unknown>} packetFields - The active packet's fields map
 * @returns {InverterResult}
 */
function correlate(typedValue, packetFields) {
  if (!typedValue || !packetFields || Object.keys(packetFields).length === 0) {
    return { match: false, reason: 'no_correlation' };
  }

  /** @type {Array<{ field: string, transform: string, value: unknown }>} */
  const matches = [];

  for (const [fieldName, claimVal] of Object.entries(packetFields)) {
    const transform = checkFieldMatch(typedValue, claimVal);
    if (transform) {
      matches.push({ field: fieldName, transform, value: claimVal });
    }
  }

  if (matches.length === 1) {
    return {
      match: true,
      claimField: matches[0].field,
      transform: matches[0].transform,
      confidence: 'candidate',
    };
  }

  if (matches.length > 1) {
    return {
      match: false,
      reason: 'ambiguous',
      candidates: matches.map((m) => ({ field: m.field, transform: m.transform })),
    };
  }

  return { match: false, reason: 'no_correlation' };
}

/**
 * @typedef {{
 *   match: true,
 *   claimField: string,
 *   transform: string,
 *   confidence: 'candidate'
 * } | {
 *   match: false,
 *   reason: 'ambiguous',
 *   candidates: Array<{ field: string, transform: string }>
 * } | {
 *   match: false,
 *   reason: 'no_correlation'
 * }} InverterResult
 */

const API = { correlate, checkFieldMatch, applyTransform, toStandardDate, toNumeric };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else globalThis[NS] = API;
})();
