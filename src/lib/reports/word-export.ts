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

/** Base page styling. Report bodies carry their own inline styles on top. */
const WORD_SHELL_CSS = `
  @page { size: A4 portrait; margin: 10mm 12mm; }
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
export function buildWordDocument(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>${WORD_SHELL_CSS}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/**
 * Downloads a report body as an editable Word document.
 *
 * @param bodyHtml HTML body fragment from any report builder (or the innerHTML
 *                 of a rendered print component).
 * @param filename Target filename. `.doc` is appended when missing.
 */
export function downloadAsWord(bodyHtml: string, filename: string): void {
  if (!bodyHtml || !bodyHtml.trim()) {
    throw new Error('Cannot export an empty report to Word.');
  }

  const name = filename.toLowerCase().endsWith('.doc') ? filename : `${filename}.doc`;
  const html = buildWordDocument(bodyHtml, name.replace(/\.doc$/i, ''));

  // Leading BOM so Word detects UTF-8 — without it the ₹ sign renders as mojibake.
  saveAs(new Blob(['﻿', html], { type: 'application/msword' }), name);
}
