/**
 * Vehicle registration number utilities.
 *
 * Indian vehicle numbers come in many formats:
 *   MH18R414  →  alphanumeric, no separators (computer-entry style)
 *   MH.18.R.414 → dot-separated        (RTO document style)
 *   MH-18-R-414 → dash-separated       (sticker / emboss style)
 *   MH 18 R 414 → space-separated      (spoken / typed style)
 *   MH/18/R/414 → slash-separated      (some old documents)
 *
 * The canonical form strips ALL non-alphanumeric characters and uppercases.
 * → "MH18R414" (the canonical key used for duplicate detection)
 */

/**
 * Converts any Indian vehicle number format into a canonical uppercase
 * alphanumeric string, suitable for equality comparison.
 *
 * @example
 * normalizeVehicleNumber("MH.18.R.414") === "MH18R414"  // true
 * normalizeVehicleNumber("mh-18-r-414") === "MH18R414"  // true
 * normalizeVehicleNumber("MH 18 R 414") === "MH18R414"  // true
 */
export function normalizeVehicleNumber(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Returns true if two vehicle numbers represent the same vehicle,
 * regardless of separator style or case.
 */
export function vehicleNumbersMatch(a: string, b: string): boolean {
  return normalizeVehicleNumber(a) === normalizeVehicleNumber(b);
}
