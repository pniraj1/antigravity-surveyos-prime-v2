'use client';

import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

export const A4_HEIGHT_PX = 1122.5197; // 297mm at 96 DPI (297 * 96 / 25.4)

export function sanitizeReport(html: string): string {
  if (!html || typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORCE_BODY: false,
    ADD_TAGS: ['style', 'link'],
    ADD_ATTR: ['style', 'media', 'type'],
  });
}

/**
 * Splits report HTML by explicit print page breaks:
 * e.g. <div style="page-break-before:always;"></div>
 */
export function splitReportHtml(html: string): string[] {
  if (!html || !html.trim()) return [''];
  const parts = html.split(/<div\s+style=["']page-break-before:\s*always\s*;?\s*["']\s*><\/div>/gi);
  const trimmed = parts.map(p => p.trim()).filter((p, i) => p.length > 0 || i === 0);
  return trimmed.length > 0 ? trimmed : [''];
}

/**
 * Heuristic page count estimator for SSR / initial static render
 * before browser DOM layout measurements (ResizeObserver) kick in.
 */
export function estimatePageCount(html: string): number {
  if (!html || !html.trim()) return 1;

  // 1. Explicit data-page-count or data-pages attribute
  const dataPageMatch = html.match(/data-page(?:-count)?=["'](\d+)["']/i);
  if (dataPageMatch) {
    return Math.max(1, parseInt(dataPageMatch[1], 10));
  }

  // 2. Explicit pixel height in style (e.g. style="height: 2400px" or min-height: 2400px)
  const heightMatch = html.match(/(?:min-)?height:\s*(\d+(?:\.\d+)?)px/i);
  if (heightMatch) {
    const px = parseFloat(heightMatch[1]);
    if (px > 0) {
      return Math.max(1, Math.ceil(px / A4_HEIGHT_PX));
    }
  }

  // 3. Count table rows: typical A4 survey report fits ~18 table rows along with section headers
  const trMatches = html.match(/<tr\b/gi);
  const trCount = trMatches ? trMatches.length : 0;
  if (trCount > 18) {
    return Math.max(1, Math.ceil(trCount / 18));
  }

  // 4. Content length heuristic (approx 2,500 characters of clean text per dense A4 page)
  const cleanLength = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .trim().length;
  if (cleanLength > 2500) {
    return Math.max(1, Math.ceil(cleanLength / 2200));
  }

  // 5. Raw HTML string length heuristic
  if (html.length > 6000) {
    return Math.max(1, Math.ceil(html.length / 4500));
  }

  return 1;
}

export interface ReportPageSheetProps {
  sheetIndex: number;
  startPage: number;
  totalPages: number;
  isDraft: boolean;
  htmlContent?: string;
  children?: React.ReactNode;
  initialPageCount?: number;
  onPageCountChange?: (sheetIndex: number, pages: number) => void;
}

export function ReportPageSheet({
  sheetIndex,
  startPage,
  totalPages,
  isDraft,
  htmlContent,
  children,
  initialPageCount,
  onPageCountChange,
}: ReportPageSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  const [pages, setPages] = useState<number>(() => {
    if (typeof initialPageCount === 'number' && initialPageCount > 0) {
      return initialPageCount;
    }
    if (htmlContent) {
      return estimatePageCount(htmlContent);
    }
    return 1;
  });

  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  // Keep pages in sync if initialPageCount or htmlContent estimates change
  useEffect(() => {
    if (typeof initialPageCount === 'number' && initialPageCount > 0) {
      setPages(initialPageCount);
      pagesRef.current = initialPageCount;
    } else if (htmlContent) {
      const estimated = estimatePageCount(htmlContent);
      setPages(estimated);
      pagesRef.current = estimated;
    }
  }, [initialPageCount, htmlContent]);

  // Client-side ResizeObserver layout measurement
  useEffect(() => {
    const element = sheetRef.current;
    if (!element || typeof window === 'undefined') return;

    const measureHeight = () => {
      const scrollHeight = element.scrollHeight;
      if (scrollHeight > 0) {
        // 10px buffer for subpixel anti-aliasing / margin collapse
        const calculatedPages = Math.max(1, Math.ceil((scrollHeight - 10) / A4_HEIGHT_PX));
        if (calculatedPages !== pagesRef.current) {
          pagesRef.current = calculatedPages;
          setPages(calculatedPages);
          onPageCountChange?.(sheetIndex, calculatedPages);
        }
      }
    };

    measureHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        measureHeight();
      });
      observer.observe(element);
      return () => observer.disconnect();
    }
  }, [sheetIndex, onPageCountChange, htmlContent]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* ── Page Sheet Top Badge ── */}
      <div className="flex items-center justify-between w-full max-w-[210mm] px-1 mb-2 select-none">
        <div className="flex items-center gap-2">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-200 border border-neutral-700 shadow-sm flex items-center gap-1.5"
            data-testid="page-badge"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Page {startPage} of {totalPages}
          </span>
          {pages > 1 && (
            <span className="text-[11px] text-neutral-400 font-medium">
              ({pages} pages continuous)
            </span>
          )}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
          A4 Physical Sheet {sheetIndex + 1}
        </div>
      </div>

      {/* ── Physical A4 Sheet Container ── */}
      <div
        ref={sheetRef}
        className="bg-white shadow-2xl relative rounded-sm"
        style={{
          width: '210mm',
          minHeight: pages > 1 ? `calc(297mm * ${pages})` : '297mm',
          padding: '10mm 12mm',
          fontFamily: "'Barlow', 'Helvetica', Arial, sans-serif",
          fontSize: '7.8pt',
          color: '#000',
          boxSizing: 'border-box',
        }}
        data-testid="report-page-sheet"
        data-sheet-index={sheetIndex}
        data-pages={pages}
      >
        {/* ── Draft Watermark on each physical page ── */}
        {isDraft &&
          Array.from({ length: pages }).map((_, p) => (
            <div
              key={`watermark-${p}`}
              className="absolute left-0 right-0 pointer-events-none flex items-center justify-center overflow-hidden z-20"
              style={{
                top: `calc(297mm * ${p})`,
                height: '297mm',
              }}
              data-testid="draft-watermark"
            >
              <div
                style={{
                  transform: 'rotate(-45deg)',
                  fontSize: '130px',
                  color: 'var(--color-status-danger, #dc2626)',
                  opacity: 0.06,
                  fontWeight: 900,
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                DRAFT
              </div>
            </div>
          ))}

        {/* ── Page Cut Lines for Height Overflow ── */}
        {pages > 1 &&
          Array.from({ length: pages - 1 }).map((_, i) => {
            const p = i + 1;
            const pageNumber = startPage + p - 1;
            const nextPage = startPage + p;
            return (
              <div
                key={`cutline-${p}`}
                className="page-cut-line absolute left-0 right-0 pointer-events-none z-30 select-none flex items-center justify-center"
                style={{
                  top: `calc(297mm * ${p})`,
                  transform: 'translateY(-50%)',
                  padding: '0 8px',
                }}
                data-testid="page-cut-line"
              >
                <div className="w-full flex items-center">
                  <div className="flex-1 border-b-2 border-dashed border-red-500/80" />
                  <div className="mx-2 px-3 py-1 bg-red-600 text-white text-[11px] font-bold rounded shadow-lg flex items-center gap-2 tracking-wide whitespace-nowrap">
                    <span>─── ✂️ Page Break (End of Page {pageNumber})</span>
                    <span className="opacity-80">──────</span>
                    <span>[ Page {nextPage} Starts Below ↓ ] ───</span>
                  </div>
                  <div className="flex-1 border-b-2 border-dashed border-red-500/80" />
                </div>
              </div>
            );
          })}

        {/* ── Render Content ── */}
        {children ? (
          <div className="relative z-10">{children}</div>
        ) : htmlContent ? (
          <div
            className="relative z-10"
            dangerouslySetInnerHTML={{ __html: sanitizeReport(htmlContent) }}
          />
        ) : null}
      </div>
    </div>
  );
}
