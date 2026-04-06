// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// Mirrors from Surveyor_V6_MASTER.html:
//   numberToWords()    — lines 2056-2062
//   formatDateDMY()    — lines 2064-2078
//   formatDateTimeDMY()— lines 2080-2087
//   fmt2() / fa()      — currency formatting
// ═══════════════════════════════════════════════════════════

/**
 * Convert a number to Indian English words.
 * Supports Lakh/Crore system (Indian numbering).
 * Legacy: numberToWords() — lines 2056-2062
 */
export function numberToWords(num: number): string {
  if (!num || isNaN(num)) return 'ZERO';

  const ones = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN',
    'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN',
    'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
  ];
  const tens = [
    '', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY',
    'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY',
  ];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' THOUSAND' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' LAKH' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' CRORE' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  return convert(Math.floor(num));
}

/**
 * Format a date value to DD.MM.YYYY (Indian standard).
 * Handles ISO dates, DD-MM-YYYY, and DD/MM/YYYY.
 * Legacy: formatDateDMY() — lines 2064-2078
 */
export function formatDateDMY(value: string | null | undefined): string {
  if (!value) return '—';

  const dStr = String(value).split('T')[0];
  const parts = dStr.split('-');

  if (parts.length === 3) {
    // ISO format: YYYY-MM-DD
    if (parts[0].length === 4) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    // DD-MM-YYYY
    if (parts[2].length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
  }

  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return (
      String(d.getDate()).padStart(2, '0') +
      '.' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '.' +
      d.getFullYear()
    );
  }

  return value;
}

/**
 * Format a datetime value to DD.MM.YYYY at HH:MM hrs.
 * Legacy: formatDateTimeDMY() — lines 2080-2087
 */
export function formatDateTimeDMY(value: string | null | undefined): string {
  if (!value) return '—';

  const s = String(value);
  const datePart = formatDateDMY(s.split('T')[0]);
  const timePart = s.includes('T') ? s.split('T')[1].substring(0, 5) : '';

  return timePart && timePart !== '00:00'
    ? `${datePart} at ${timePart} hrs`
    : datePart;
}

/**
 * Format a number as Indian currency string.
 * Legacy: fa() — '₹ ' + v.toFixed(2).replace(...)
 */
export function formatCurrency(value: number): string {
  return '₹ ' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Short currency format without decimals.
 * Legacy: fmt2() shorthand
 */
export function formatCurrencyShort(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) || 0 : value;
  return '₹' + num.toLocaleString('en-IN');
}

/**
 * Parse a date string from various Indian formats to ISO (YYYY-MM-DD).
 * Handles: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 * Legacy: td() helper inside applyExtractedData — lines 1684-1689
 */
export function parseDateToISO(value: string | null | undefined): string {
  if (!value) return '';
  const v = String(value).trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // DD/MM/YYYY or DD-MM-YYYY
  const m = v.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  return v;
}

/**
 * Generate a unique ID.
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
