/**
 * report-style-utils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central lookup table that maps a FontScale preference to concrete values
 * used by every report builder.
 *
 * DESIGN NOTES
 * ─────────────────────────────────────────────────────────────────────────────
 * • "compact"     — identical to the hard-coded values that existed before this
 *                   feature. Selecting Compact is a guaranteed no-op for output.
 * • "standard"    — ~18% larger. Comfortable on-screen and for printing.
 * • "large-print" — ~35% larger. Client-facing sharing / accessibility.
 *
 * These values now drive Word too: the .doc export reuses the report's HTML
 * verbatim, so it picks up the same scale without a parallel table.
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

// ─── Combined scale descriptor ────────────────────────────────────────────────

export interface FontScaleConfig {
  html: HtmlFontScale;
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
