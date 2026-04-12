'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { buildStandardFinalSurveyHTML } from '@/lib/reports/standard-report-builder';
import { buildUIICFinalHTML } from '@/lib/reports/uiic-final-builder';
import { calculateAssessmentSummary } from '@/lib/calculations';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { SpotPrintReport } from '@/components/print/SpotPrintReport';
import { useReactToPrint } from 'react-to-print';
import { FileText, Printer, X, Minus, GripHorizontal } from 'lucide-react';

type ReportFormat = 'standard' | 'uiic' | 'spot';

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

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const spotPrintRef = useRef<HTMLDivElement>(null);

  // ── Auto-detect format on claim change ──────────────────────────────────────
  useEffect(() => {
    if (!currentClaim) return;
    const hasSpotData =
      !!currentClaim.spotDetails?.reportDate ||
      !!currentClaim.spotDetails?.reportNo ||
      (currentClaim.spotDamageRows?.length ?? 0) > 0;
    setFormat(hasSpotData ? 'spot' : 'standard');
  }, [currentClaim?.id]);

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
        const out =
          format === 'uiic'
            ? buildUIICFinalHTML(currentClaim, profile)
            : buildStandardFinalSurveyHTML(currentClaim, summary, profile);
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
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - 420, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 48, e.clientY - dragOffset.current.y)),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
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
        width: 420,
        height: minimised ? 48 : 580,
        background: '#FFFFFF',
        border: '1px solid #E2E6EA',
        boxShadow: '0 20px 60px rgba(13,27,42,0.35)',
        transition: 'height 0.18s ease',
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
            {(['standard', 'uiic', 'spot'] as ReportFormat[]).map(f => (
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
                {f === 'standard' ? 'Std' : f === 'uiic' ? 'UIIC' : 'Spot'}
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
          style={{ background: '#E8EAED' }}
        >
          {format === 'spot' ? (
            /* Spot: render SpotPrintReport directly, zoom to fit panel */
            <div
              style={{
                padding: 8,
                /* zoom scales layout space too — no overflow issues */
                zoom: 0.46,
              }}
            >
              <SpotPrintReport ref={spotPrintRef} claim={currentClaim} profile={profile} />
            </div>
          ) : html ? (
            /* Standard / UIIC: inject complete HTML doc into iframe */
            <iframe
              key={format}
              srcDoc={html}
              title="Report Preview"
              style={{
                border: 'none',
                display: 'block',
                /* zoom shrinks 793px A4 to ~364px — fits panel width of 420px */
                zoom: 0.46,
                width: '210mm',
                height: '1400px',
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
    </div>
  );
}
