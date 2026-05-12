/**
 * report-style-utils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central lookup table that maps a FontScale preference to concrete values
 * used by every report builder (HTML, Word/docx, and UIIC/Spot HTML).
 *
 * DESIGN NOTES
 * ─────────────────────────────────────────────────────────────────────────────
 * • "compact"     — identical to the hard-coded values that existed before this
 *                   feature. Selecting Compact is a guaranteed no-op for output.
 * • "standard"    — ~18% larger. Comfortable on-screen and for printing.
 * • "large-print" — ~35% larger. Client-facing sharing / accessibility.
 *
 * All half-point values in the Word section are even multiples so docx
 * produces clean output (e.g. 14 half-points = 7pt, 16 = 8pt, 19 = 9.5pt).
 *
 * SAFE TO MODIFY: Only this file needs updating to tweak scale ratios.
 */

import type { FontScale } from '@/types';

// ─── HTML / CSS values ───────────────────────────────────────────────────────

export interface HtmlFontScale {
  /** Base body font size (e.g. "7.8pt") */
  bodyFont: string;
  /** Table cell font size */
  cellFont: string;
  /** Section heading font size */
  headingFont: string;
  /** Small sub-headings / labels */
  labelFont: string;
  /** Table row line-height */
  lineHeight: string;
  /** Inner cell padding (top/bottom) */
  cellPaddingV: string;
  /** Inner cell padding (left/right) */
  cellPaddingH: string;
}

// ─── Word / docx half-point values ───────────────────────────────────────────
// docx fontSize field = half-points (e.g. 14 → 7pt, 16 → 8pt, 19 → 9.5pt)

export interface WordFontScale {
  /** Body / cell text */
  body: number;
  /** Section headings */
  heading: number;
  /** Table header row */
  tableHeader: number;
  /** Label / key column */
  label: number;
}

// ─── Combined scale descriptor ────────────────────────────────────────────────

export interface FontScaleConfig {
  html: HtmlFontScale;
  word: WordFontScale;
}

// ─── Scale table ──────────────────────────────────────────────────────────────

const SCALE_TABLE: Record<FontScale, FontScaleConfig> = {
  compact: {
    html: {
      bodyFont:     '7.8pt',
      cellFont:     '7.8pt',
      headingFont:  '9pt',
      labelFont:    '7.5pt',
      lineHeight:   '1.2',
      cellPaddingV: '1.5pt',
      cellPaddingH: '3pt',
    },
    word: {
      body:        16,   // 8pt
      heading:     18,   // 9pt
      tableHeader: 16,   // 8pt
      label:       14,   // 7pt
    },
  },

  standard: {
    html: {
      bodyFont:     '9pt',
      cellFont:     '9pt',
      headingFont:  '10.5pt',
      labelFont:    '8.5pt',
      lineHeight:   '1.35',
      cellPaddingV: '2.5pt',
      cellPaddingH: '4pt',
    },
    word: {
      body:        18,   // 9pt
      heading:     21,   // 10.5pt
      tableHeader: 18,   // 9pt
      label:       16,   // 8pt
    },
  },

  'large-print': {
    html: {
      bodyFont:     '10.5pt',
      cellFont:     '10.5pt',
      headingFont:  '12pt',
      labelFont:    '10pt',
      lineHeight:   '1.5',
      cellPaddingV: '3.5pt',
      cellPaddingH: '5pt',
    },
    word: {
      body:        21,   // 10.5pt
      heading:     24,   // 12pt
      tableHeader: 21,   // 10.5pt
      label:       19,   // 9.5pt
    },
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the full scale config for a given FontScale key.
 * Falls back to 'compact' on undefined/null (old claim data safety).
 */
export function getScaleConfig(scale?: FontScale | null): FontScaleConfig {
  return SCALE_TABLE[scale ?? 'compact'];
}

/**
 * Convenience: returns only the HTML sub-config.
 */
export function getHtmlScale(scale?: FontScale | null): HtmlFontScale {
  return getScaleConfig(scale).html;
}

/**
 * Convenience: returns only the Word sub-config (half-point values).
 */
export function getWordScale(scale?: FontScale | null): WordFontScale {
  return getScaleConfig(scale).word;
}
