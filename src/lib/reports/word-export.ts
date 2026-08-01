/**
 * word-export.ts
 *
 * Turns a report's HTML body — the exact same string the print/PDF path
 * renders — into an editable Word document.
 *
 * Word has opened HTML natively since Word 2000. Feeding it the report body
 * means the .doc IS the PDF, not a second hand-written rendering of it, so the
 * two can no longer drift apart. This replaced word-builder.ts, which redrew
 * each report with the `docx` library and had already fallen ~6 sections
 * behind the real report.
 *
 * ponytail: output is HTML-in-Word (.doc), not OOXML (.docx). Word opens,
 * edits and prints it normally, but may show a one-time format notice. If an
 * insurer portal ever rejects the extension, that is the trigger to move to a
 * real .docx writer — not before.
 */

import { saveAs } from 'file-saver';

/**
 * Base page styling, kept deliberately in step with the print document's
 * shell (see buildStandardPrintDocument) so Word lays the report out on the
 * same A4 geometry the PDF uses.
 *
 * Word ignores a bare `@page` rule. It honours page size and margins only via
 * a *named* page bound to a wrapper div — the "Section1" idiom below — so
 * without it Word silently falls back to Letter with 1in margins and squeezes
 * every table narrower than the PDF.
 */
const WORD_SHELL_CSS = `
  @page Section1 {
    size: 210mm 297mm;
    margin: 10mm 12mm 16mm 12mm;
    mso-page-orientation: portrait;
    mso-footer: f1;
    mso-footer-margin: 8mm;
  }
  div.Section1 { page: Section1; }
  @page { size: 210mm 297mm; margin: 10mm 12mm; }
  /* Same reset the print document applies — without it Word adds its own
     default spacing to every paragraph and table. */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Barlow', Helvetica, Arial, sans-serif;
    font-size: 7.8pt;
    color: #000;
  }
  table { border-collapse: collapse; }
`;

/**
 * Wraps a report body fragment in the minimal document Word needs.
 * The office/word xmlns declarations are what make Word claim the file
 * instead of handing it to a browser.
 */
export function buildWordDocument(bodyHtml: string, title: string, footerLeft = ''): string {
  // Word cannot read CSS @page margin boxes — the mechanism the print/PDF path
  // uses for its footer. It needs an mso-element footer div bound to the named
  // page, with PAGE as a real field code so the number stays correct after the
  // surveyor edits the document.
  const footer = `
  <div style='mso-element:footer' id="f1">
    <table style="width:100%;border:none;font-size:7.5pt;">
      <tr>
        <td style="border:none;padding:0;text-align:left;font-weight:600;color:#000;">${escapeHtml(footerLeft)}</td>
        <td style="border:none;padding:0;text-align:right;color:#444;">Page <span style='mso-field-code:PAGE'>1</span></td>
      </tr>
    </table>
  </div>`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>${WORD_SHELL_CSS}</style>
</head>
<body><div class="Section1">${bodyHtml}${footer}</div></body>
</html>`;
}

/** Minimal escaping for text interpolated into the footer markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Downloads a report body as an editable Word document.
 *
 * @param bodyHtml HTML body fragment from any report builder (or the innerHTML
 *                 of a rendered print component).
 * @param filename Target filename. `.doc` is appended when missing.
 */
export function downloadAsWord(bodyHtml: string, filename: string, footerLeft = ''): void {
  if (!bodyHtml || !bodyHtml.trim()) {
    throw new Error('Cannot export an empty report to Word.');
  }

  const name = filename.toLowerCase().endsWith('.doc') ? filename : `${filename}.doc`;
  const html = buildWordDocument(bodyHtml, name.replace(/\.doc$/i, ''), footerLeft);

  // Leading BOM so Word detects UTF-8 — without it the ₹ sign renders as mojibake.
  saveAs(new Blob(['﻿', html], { type: 'application/msword' }), name);
}
