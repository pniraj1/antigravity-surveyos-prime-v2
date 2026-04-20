'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { buildStandardFinalSurveyHTML } from '@/lib/reports/standard-report-builder';
import { buildUIICFinalHTML, buildUIICBillCheckHTML } from '@/lib/reports/uiic-final-builder';
import { buildSpotFeeBillHTML } from '@/lib/reports/spot-fee-bill-builder';
import { calculateAssessmentSummary } from '@/lib/calculations';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { SpotPrintReport } from '@/components/print/SpotPrintReport';
import { useReactToPrint } from 'react-to-print';
import { FileText, Printer, X, Minus, GripHorizontal } from 'lucide-react';

type ReportFormat = 'standard' | 'uiic' | 'spot' | 'bill-check' | 'fee-bill';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safePos() {
  if (typeof window === 'undefined') return { x: 200, y: 100 };
  return { x: window.innerWidth - 450, y: window.innerHeight - 620 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FloatingReportPreview() {
  const currentClaim = useClaimStore(s => s.currentClaim);
  const profile = useProfileStore(s => s.profile);
  const { activeTab } = useUIStore();

  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [format, setFormat] = useState<ReportFormat>('standard');
  const [html, setHtml] = useState('');
  const [pos, setPos] = useState(safePos);
  const [size, setSize] = useState({ width: 420, height: 580 });

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 420, h: 580, px: 0, py: 0 });
  const spotPrintRef = useRef<HTMLDivElement>(null);

  // ── Auto-detect format on tab / claim change ────────────────────────────────
  useEffect(() => {
    if (!currentClaim) return;
    
    if (activeTab === 'fees') {
      setFormat('fee-bill');
      return;
    }
    
    if (currentClaim.surveyType === 'spot') {
      setFormat('spot');
    } else {
      if (activeTab === 'bill-check') {
        setFormat('bill-check');
      } else if (activeTab === 'reinspection') {
        // UIIC format directly represents Reinspection well
        if (format !== 'standard' && format !== 'uiic') setFormat('uiic');
      } else {
        if (format === 'bill-check' || format === 'fee-bill') {
          setFormat('standard');
        }
      }
    }
  }, [currentClaim?.id, currentClaim?.surveyType, activeTab]);

  // ── Debounced HTML generation ────────────────────────────────────────────────
  useEffect(() => {
    if (!currentClaim || format === 'spot') {
      setHtml('');
      return;
    }
    const timer = setTimeout(() => {
      try {
        const yearRaw = currentClaim.vehicle?.yearOfManufacture;
        const ageMonths = getVehicleAgeMonths(
          null,
          yearRaw != null ? Number(yearRaw) : null,
          currentClaim.accident?.dateAndTime || null
        );
        const fb = currentClaim.feeBill;
        const summary = calculateAssessmentSummary(
          currentClaim.assessmentRows || [],
          ageMonths,
          currentClaim.depreciationType || 'Standard',
          fb?.salvageValue || 0,
          fb?.lessExcess ?? 500,
          fb?.voluntaryExcess || 0
        );
        let out = '';
        if (format === 'uiic') {
          out = buildUIICFinalHTML(currentClaim, profile);
        } else if (format === 'bill-check') {
          out = buildUIICBillCheckHTML(currentClaim, profile);
        } else if (format === 'fee-bill') {
          out = buildSpotFeeBillHTML(currentClaim, profile);
        } else {
          out = buildStandardFinalSurveyHTML(currentClaim, summary, profile);
        }
        setHtml(out);
      } catch {
        setHtml('');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [currentClaim, profile, format]);

  // ── Dragging ─────────────────────────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [pos]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setPos(prev => ({
      x: Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 48, e.clientY - dragOffset.current.y)),
    }));
  }, [size.width]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // ── Resizing ──────────────────────────────────────────────────────────────────
  // Top-left grip: dragging left/up expands width/height and moves pos accordingly
  const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    resizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height, px: pos.x, py: pos.y };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }, [size, pos]);

  const onResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizing.current) return;
    const { x: sx, y: sy, w: sw, h: sh, px, py } = resizeStart.current;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;

    // Right and bottom edges stay fixed; top-left corner moves
    const rightEdge = px + sw;
    const bottomEdge = py + sh;

    // Clamp new top-left pos: can't go below 0, can't make panel smaller than min
    const newPosX = Math.max(0, Math.min(rightEdge - 320, px + dx));
    const newPosY = Math.max(0, Math.min(bottomEdge - 300, py + dy));

    setPos({ x: newPosX, y: newPosY });
    setSize({ width: rightEdge - newPosX, height: bottomEdge - newPosY });
  }, []);

  const onResizePointerUp = useCallback(() => {
    resizing.current = false;
  }, []);

  // ── Print ─────────────────────────────────────────────────────────────────────
  const handleSpotPrint = useReactToPrint({
    contentRef: spotPrintRef,
    documentTitle: `Spot-Report-${currentClaim?.vehicle?.registrationNumber ?? 'Draft'}`,
  });

  const handleHtmlPrint = useCallback(() => {
    if (!html) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }, [html]);

  const handlePrint = format === 'spot' ? handleSpotPrint : handleHtmlPrint;

  // Zoom scales with panel width so content gets bigger as popup grows
  const zoom = Math.max(0.3, (size.width - 20) / 794);

  // ── Guard ─────────────────────────────────────────────────────────────────────
  if (!currentClaim || activeTab === 'reports') return null;

  // ── FAB ───────────────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
        style={{
          background: '#0D1B2A',
          color: '#D4AF37',
          boxShadow: '0 8px 32px rgba(13,27,42,0.45)',
        }}
      >
        <FileText size={13} />
        Live Preview
      </button>
    );
  }

  // ── Panel ─────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed z-50 flex flex-col rounded-2xl overflow-hidden"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: minimised ? 48 : size.height,
        background: '#FFFFFF',
        border: '1px solid #E2E6EA',
        boxShadow: '0 20px 60px rgba(13,27,42,0.35)',
        transition: minimised ? 'height 0.18s ease' : undefined,
        userSelect: 'none',
      }}
    >
      {/* ── Header / drag handle ── */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0 cursor-grab active:cursor-grabbing"
        style={{ background: '#0D1B2A', height: 48 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <GripHorizontal size={12} style={{ color: '#4A5568', flexShrink: 0 }} />
        <FileText size={12} style={{ color: '#D4AF37', flexShrink: 0 }} />
        <span
          className="text-[10px] font-black uppercase tracking-widest flex-1 truncate"
          style={{ color: '#D4AF37' }}
        >
          Live Report Preview
        </span>

        {/* Format tabs */}
        {!minimised && (
          <div
            className="flex items-center gap-0.5 rounded-lg p-0.5 flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            {(currentClaim?.surveyType === 'spot' 
                ? (['spot', 'fee-bill'] as const) 
                : (['standard', 'uiic', 'bill-check', 'fee-bill'] as const)).map(f => (
              <button
                key={f}
                onPointerDown={e => e.stopPropagation()}
                onClick={() => setFormat(f)}
                className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wide transition-all"
                style={{
                  background: format === f ? '#D4AF37' : 'transparent',
                  color: format === f ? '#0D1B2A' : '#8D99AE',
                }}
              >
                {f === 'standard' ? 'Std' : 
                 f === 'uiic' ? 'UIIC' : 
                 f === 'bill-check' ? 'Bill Chk' : 
                 f === 'fee-bill' ? 'Fees' : 'Spot'}
              </button>
            ))}
          </div>
        )}

        {/* Print */}
        {!minimised && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={handlePrint}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all hover:opacity-80 flex-shrink-0"
            style={{ background: '#D4AF37', color: '#0D1B2A' }}
          >
            <Printer size={10} />
            Print
          </button>
        )}

        {/* Minimise */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => setMinimised(m => !m)}
          className="p-1 rounded transition-colors hover:bg-white/10 flex-shrink-0"
          style={{ color: '#8D99AE' }}
        >
          <Minus size={12} />
        </button>

        {/* Close */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => setOpen(false)}
          className="p-1 rounded transition-colors hover:bg-white/10 flex-shrink-0"
          style={{ color: '#8D99AE' }}
        >
          <X size={12} />
        </button>
      </div>

      {/* ── Preview area ── */}
      {!minimised && (
        <div
          className="flex-1 overflow-auto"
          style={{ background: '#E8EAED', position: 'relative' }}
        >
          {format === 'spot' ? (
            <div style={{ padding: 8, zoom }}>
              <SpotPrintReport ref={spotPrintRef} claim={currentClaim} profile={profile} />
            </div>
          ) : html ? (
            <iframe
              key={format}
              srcDoc={html}
              title="Report Preview"
              style={{
                border: 'none',
                display: 'block',
                zoom,
                width: '210mm',
                height: `${Math.ceil(size.height / zoom) + 400}px`,
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-[11px] font-bold" style={{ color: '#8D99AE' }}>
                Generating preview…
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Resize grip (top-left corner) ── */}
      {!minimised && (
        <div
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 22,
            height: 22,
            cursor: 'nwse-resize',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            padding: 4,
            zIndex: 10,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 9L9 1M1 5L5 1M1 1" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </div>
  );
}
