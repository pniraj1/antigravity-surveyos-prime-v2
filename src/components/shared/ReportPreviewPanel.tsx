'use client';

/**
 * ReportPreviewPanel
 *
 * A self-contained live preview panel that renders any HTML report string
 * inside a zoomed iframe. Drop it at the bottom of any tab to give a
 * "live report preview" experience without the floating widget.
 *
 * Props:
 *   html       – The full HTML body string (NOT a complete document).
 *   onPrint    – Called when the user clicks "Print / Export".
 *   title      – Panel heading shown in the dark header bar.
 *   printLabel – Label on the print button (default "Print / Export").
 */

import { useMemo } from 'react';
import { Printer, FileText } from 'lucide-react';

interface ReportPreviewPanelProps {
  html: string;
  onPrint: () => void;
  title?: string;
  printLabel?: string;
}

/** Wraps an HTML body fragment into a complete A4-ish preview document. */
function wrapInDocument(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Barlow', Arial, sans-serif;
      font-size: 7.8pt;
      background: #e8eaed;
      color: #000;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 10mm 12mm;
      background: #fff;
      margin: 8mm auto;
      box-shadow: 0 2px 12px rgba(0,0,0,0.18);
    }
    @media print {
      @page { size: A4 portrait; margin: 10mm 12mm; }
      body { background: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { margin: 0 !important; box-shadow: none !important; width: 100% !important; padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="page">${body}</div>
</body>
</html>`;
}

export function ReportPreviewPanel({
  html,
  onPrint,
  title = 'Live Report Preview',
  printLabel = 'Print / Export',
}: ReportPreviewPanelProps) {
  const srcDoc = useMemo(() => (html ? wrapInDocument(html) : ''), [html]);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
    >
      {/* ── Panel header ── */}
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ background: '#0D1B2A', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
          <FileText size={13} style={{ color: '#D4AF37' }} />
          <span
            className="text-[10px] font-black uppercase tracking-[0.2em]"
            style={{ color: '#D4AF37' }}
          >
            {title}
          </span>
        </div>
        <button
          onClick={onPrint}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all hover:opacity-80 active:scale-95"
          style={{ background: '#D4AF37', color: '#0D1B2A' }}
        >
          <Printer size={11} />
          {printLabel}
        </button>
      </div>

      {/* ── Preview iframe ── */}
      <div
        style={{
          background: '#E8EAED',
          height: 520,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {html ? (
          <iframe
            key={html.slice(0, 80)} /* re-mount only when content changes significantly */
            srcDoc={srcDoc}
            title={title}
            style={{
              border: 'none',
              display: 'block',
              /* zoom shrinks 210mm (~794px) A4 to fit the 420px panel */
              zoom: 0.52,
              width: '210mm',
              height: '1400px',
              transformOrigin: 'top left',
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p
              className="text-[11px] font-bold animate-pulse"
              style={{ color: '#8D99AE' }}
            >
              Generating preview…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
