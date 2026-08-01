/**
 * print-shell.ts
 *
 * The A4 document wrapper every printable report shares: page geometry, the
 * screen-vs-print styling, and the running footer.
 *
 * Before this file the same shell was pasted into six places and had already
 * drifted — page margins ranged from 8mm to 14mm and the Valuation report had
 * no shell at all, printing without any A4 setup. One definition now fixes the
 * geometry for every report.
 *
 * FOOTER
 * ──────────────────────────────────────────────────────────────────────────
 * Rendered via CSS `@page` margin boxes, which Chromium supports (verified on
 * Chrome 149): surveyor name + qualification bottom-left, "Page N" bottom-right,
 * on every page including the first.
 *
 * `counter(page)` only — deliberately no "of N". `counter(pages)` forces the
 * renderer to know the total before painting, and its Word equivalent
 * (NUMPAGES) commonly shows a stale value until the user refreshes fields.
 *
 * Browsers without margin-box support simply render nothing there; the report
 * itself is unaffected.
 */

import type { SurveyorProfile } from '@/types/vehicle';

/** Bottom margin must house the footer — the other three match the old shells. */
const PAGE_MARGIN = '10mm 12mm 16mm 12mm';

/**
 * Escapes a string for use inside a CSS `content: "..."` declaration.
 * A surveyor name containing a quote or backslash would otherwise terminate
 * the string early and break every rule that follows it.
 */
export function escapeCssString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');
}

/**
 * The bottom-left footer line: "Niraj Patil, B.E. (Mech)".
 * Falls back to the name alone when no qualification is recorded.
 */
export function footerFromProfile(profile: SurveyorProfile | null): string {
  const name = (profile?.name || '').trim();
  const qual = (profile?.qualifications || '').trim();
  if (!name) return '';
  return qual ? `${name}, ${qual}` : name;
}

export interface PrintShellOptions {
  /** Browser/tab title and print-dialog default filename. */
  title: string;
  /** Bottom-left running footer text — pass footerFromProfile(profile). */
  footerLeft: string;
  /** Base body font size, e.g. '7.8pt'. Reports set their own sizes inline. */
  fontSize?: string;
  /** Base font stack. */
  fontFamily?: string;
}

/**
 * Wraps a report body fragment in the printable A4 document.
 * Body builders are untouched — this only supplies the page around them.
 */
export function buildPrintShell(body: string, opts: PrintShellOptions): string {
  const {
    title,
    footerLeft,
    fontSize = '7.8pt',
    fontFamily = `'Barlow', 'Helvetica', Arial, sans-serif`,
  } = opts;

  // An empty content string renders an empty box, so omit the rule entirely
  // when there is no profile name to show.
  const footerLeftRule = footerLeft
    ? `@bottom-left {
        content: "${escapeCssString(footerLeft)}";
        font-family: ${fontFamily};
        font-size: 7.5pt;
        font-weight: 600;
        color: #000;
      }`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${fontFamily};
      font-size: ${fontSize};
      background: #525659;
      color: #000;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 10mm 12mm;
      background: #fff;
      margin: 10mm auto;
      box-shadow: 0 0 10px rgba(0,0,0,0.2);
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: ${PAGE_MARGIN};
        ${footerLeftRule}
        @bottom-right {
          content: "Page " counter(page);
          font-family: ${fontFamily};
          font-size: 7.5pt;
          color: #444;
        }
      }
      body {
        background: none;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        margin: 0 !important;
        box-shadow: none !important;
        width: 100% !important;
        min-height: auto !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    ${body}
  </div>
</body>
</html>`;
}
