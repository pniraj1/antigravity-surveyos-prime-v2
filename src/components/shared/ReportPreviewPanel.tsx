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

import { useMemo, useState, useRef } from 'react';
import DOMPurify from 'dompurify';
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
  const [height, setHeight] = useState(520);
  const containerRef = useRef<HTMLDivElement>(null);
  const srcDoc = useMemo(() => {
    if (!html) return '';
    // Sanitize the body fragment before wrapping — prevents XSS from
    // user-supplied claim/profile data interpolated into report HTML.
    const clean = typeof window !== 'undefined'
      ? DOMPurify.sanitize(html, { ADD_TAGS: ['style'], ADD_ATTR: ['style'] })
      : html;
    return wrapInDocument(clean);
  }, [html]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      const newHeight = Math.max(300, startHeight + delta);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden bg-card border border-border"
    >
      {/* ── Panel header ── */}
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ background: 'var(--color-neutral-900)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
          <FileText size={13} className="text-primary" />
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            {title}
          </span>
        </div>
        <button
          onClick={onPrint}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wide transition-all hover:opacity-80 active:scale-95 bg-primary text-primary-foreground"
        >
          <Printer size={11} />
          {printLabel}
        </button>
      </div>

      {/* ── Preview iframe ── */}
      <div
        style={{
          background: 'var(--color-neutral-200)',
          height,
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
              zoom: 0.52,
              width: '210mm',
              height: `${Math.ceil(height / 0.52) + 400}px`,
              transformOrigin: 'top left',
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] font-medium animate-pulse text-muted-foreground">
              Generating preview…
            </p>
          </div>
        )}
      </div>

      {/* ── Resize handle ── */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          height: 14,
          cursor: 'ns-resize',
          background: 'var(--color-neutral-900)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          userSelect: 'none',
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)', opacity: 0.5 }}
          />
        ))}
      </div>
    </div>
  );
}
