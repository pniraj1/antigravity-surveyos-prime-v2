'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VehicleDetailsForm } from '@/components/claim/VehicleForm';
import { DriverDetailsForm } from '@/components/claim/DriverForm';
import { PolicyDetailsForm } from '@/components/claim/PolicyForm';
import { AccidentDetailsForm } from '@/components/claim/AccidentForm';
import { TotalLossForm } from '@/components/claim/TotalLossForm';
import { useAIExtraction } from '@/hooks/useAIExtraction';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { generateWordReport } from '@/lib/reports/word-builder';
import { FileText, Sparkles, Download, Loader2, Hash, Wand2, FileSearch, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SpotTab } from '@/components/tabs/SpotTab';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';

// ─── Inline Evidence Panel ────────────────────────────────────────────────────
// Mirrors the DocumentEvidenceViewer logic but renders inline (not fixed-position)

const DOC_LABELS: Record<string, string> = {
  rc: 'Registration Certificate',
  policy: 'Insurance Policy',
  dl: 'Driving Licence',
  estimate: 'Repair Estimate',
  'final-bill': 'Final Bill',
  permit: 'Permit',
  fitness: 'Fitness Certificate',
  fir: 'FIR / Panchnama',
  claim: 'Claim Form',
  auth: 'Authorisation',
  'lok-challan': 'Lok Challan',
  photos: 'Damage Photos',
};

function getStorageKey(claimId: string, docType: string) {
  return `evidence_${claimId}_${docType}`;
}

function loadImage(claimId: string | null, docType: string | null): string | null {
  if (!claimId || !docType) return null;
  try {
    const raw = sessionStorage.getItem(getStorageKey(claimId, docType));
    if (!raw) return null;
    const pages: string[] = JSON.parse(raw);
    return pages[0] ?? null;
  } catch {
    return null;
  }
}

function InlineEvidencePanel({ claimId }: { claimId: string }) {
  const { field } = useEvidenceStore();
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setImgSrc(loadImage(claimId, field?.docType ?? null));
    setZoom(1);
  }, [claimId, field?.docType]);

  const zoomIn  = useCallback(() => setZoom(z => Math.min(z + 0.25, 4)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(z - 0.25, 0.5)), []);
  const resetZoom = useCallback(() => setZoom(1), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.min(Math.max(z + (e.deltaY > 0 ? -0.1 : 0.1), 0.5), 4));
    }
  }, []);

  const docLabel = field ? (DOC_LABELS[field.docType] ?? field.docType.toUpperCase()) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f172a', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileSearch size={16} color="#93c5fd" />
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 12 }}>Evidence Viewer</div>
            {docLabel && <div style={{ color: '#93c5fd', fontSize: 10, marginTop: 1 }}>{docLabel}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <EvidenceIconBtn onClick={zoomOut} title="Zoom Out"><ZoomOut size={13} /></EvidenceIconBtn>
          <button
            onClick={resetZoom}
            title="Reset zoom"
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', color: '#93c5fd', fontSize: 10, fontWeight: 600, minWidth: 38 }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <EvidenceIconBtn onClick={zoomIn} title="Zoom In"><ZoomIn size={13} /></EvidenceIconBtn>
        </div>
      </div>

      {/* Context snippet */}
      {field?.contextSnippet && (
        <div style={{ margin: '10px 12px 0', padding: '7px 10px', background: 'rgba(37,99,235,0.18)', border: '1px solid rgba(37,99,235,0.35)', borderRadius: 7, flexShrink: 0 }}>
          <div style={{ color: '#93c5fd', fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 3 }}>EXTRACTED FROM DOCUMENT</div>
          <div style={{ color: '#e2e8f0', fontSize: 11, lineHeight: 1.5, fontFamily: 'monospace' }}>{field.contextSnippet}</div>
        </div>
      )}

      {/* Document image */}
      <div onWheel={handleWheel} style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {imgSrc ? (
          <div style={{ display: 'inline-block', minWidth: '100%', transformOrigin: 'top left', transform: `scale(${zoom})`, transition: 'transform 0.15s ease' }}>
            <img
              src={imgSrc}
              alt={`${docLabel} source document`}
              style={{ width: '100%', display: 'block', borderRadius: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', color: '#475569', padding: 20 }}>
            <div>
              <FileSearch size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
              <p style={{ fontSize: 12, margin: 0 }}>
                {field
                  ? 'Document image not available.\nRe-scan the document to enable this view.'
                  : 'Scan a document (RC / Policy / DL)\nto see the source here.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
        <ChevronRight size={12} color="#475569" />
        <span style={{ color: '#475569', fontSize: 10 }}>Scan a document above to populate this panel</span>
      </div>
    </div>
  );
}

function EvidenceIconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', color: '#cbd5e1', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const STORAGE_KEY_PANEL = 'surveyos-details-evidence-panel';

export function DetailsTab() {
  const currentClaim = useClaimStore(s => s.currentClaim);
  const updateClaim = useClaimStore(s => s.updateClaim);
  const updateSpotDetails = useClaimStore(s => s.updateSpotDetails);
  const getNextSpotNumber = useProfileStore(s => s.getNextSpotNumber);
  const getNextFinalNumber = useProfileStore(s => s.getNextFinalNumber);
  const { isProcessing, progress, reviewData, triggerExtraction, confirmApply, cancelReview } = useAIExtraction();

  // Evidence panel open/closed + width (px) — persisted in localStorage
  const [panelOpen, setPanelOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_PANEL + '-open') !== 'false'; } catch { return true; }
  });
  const [panelWidth, setPanelWidth] = useState(() => {
    try { return parseInt(localStorage.getItem(STORAGE_KEY_PANEL + '-width') || '380', 10); } catch { return 380; }
  });

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(panelWidth);
  const containerRef = useRef<HTMLDivElement>(null);

  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    try { localStorage.setItem(STORAGE_KEY_PANEL + '-open', String(next)); } catch {}
  };

  // ── Drag-to-resize ──────────────────────────────────────────────────────────
  const onMouseDownHandle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;

    const onMove = (me: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - me.clientX; // dragging left = wider panel
      const container = containerRef.current;
      const maxW = container ? container.offsetWidth - 400 : 800;
      const newW = Math.min(Math.max(dragStartWidth.current + delta, 280), maxW);
      setPanelWidth(newW);
    };

    const onUp = () => {
      isDragging.current = false;
      // persist
      try { localStorage.setItem(STORAGE_KEY_PANEL + '-width', String(panelWidth)); } catch {}
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  // persist width on change (deferred)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_PANEL + '-width', String(panelWidth)); } catch {}
  }, [panelWidth]);

  if (!currentClaim) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (file) triggerExtraction(key, file);
  };

  const docSlots = [
    { id: 'rc', label: 'RC Copy' },
    { id: 'dl', label: 'Driving Licence' },
    { id: 'policy', label: 'Policy Schedule' }
  ];

  const surveyLabel = currentClaim.surveyType === 'spot' ? 'Spot Survey' :
                      currentClaim.surveyType === 'final' ? 'Final Survey' :
                      currentClaim.surveyType === 'reinspection' ? 'Reinspection' : 'Survey';

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden', position: 'relative' }}>

      {/* ── LEFT: Form area ─────────────────────────────────────────────────── */}
      <div
        style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px 32px 40px' }}
        className="animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Report Number */}
          <div
            className="flex items-center gap-4 px-5 py-4 rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #0D1B2A, #1e3a5f)', border: '1px solid rgba(212,175,55,0.2)' }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(212,175,55,0.15)' }}>
              <Hash size={16} style={{ color: '#D4AF37' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: 'rgba(212,175,55,0.7)' }}>
                {surveyLabel} Report No.
              </div>
              <input
                value={currentClaim.reportNo || ''}
                onChange={e => {
                  updateClaim({ reportNo: e.target.value });
                  if (currentClaim.surveyType === 'spot') {
                    updateSpotDetails({ reportNo: e.target.value });
                  }
                }}
                placeholder="Auto-assigned on creation — edit if needed"
                className="w-full bg-transparent text-lg font-black tracking-wide focus:outline-none placeholder:font-normal placeholder:text-sm"
                style={{ color: '#F8F9FA', caretColor: '#D4AF37' }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (currentClaim.reportNo && !confirm('Overwrite existing report number?')) return;
                const next = currentClaim.surveyType === 'spot' ? getNextSpotNumber() : getNextFinalNumber();
                updateClaim({ reportNo: next });
                if (currentClaim.surveyType === 'spot') {
                  const today = new Date().toISOString().split('T')[0];
                  updateSpotDetails({
                    reportNo: next,
                    ...(!currentClaim.spotDetails?.reportDate && { reportDate: today }),
                    ...(!currentClaim.spotDetails?.allotmentDate && { allotmentDate: today }),
                  });
                }
                toast.success(`Allocated: ${next}`);
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-110"
              style={{ background: 'rgba(212,175,55,0.2)', color: '#D4AF37' }}
              title="Auto-allocate next sequential number"
            >
              <Wand2 size={15} />
            </button>
            <div
              className="text-[10px] font-bold px-3 py-1 rounded-full flex-shrink-0"
              style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
            >
              {currentClaim.reportNo ? 'Assigned' : 'Pending'}
            </div>
          </div>

          {/* Header row */}
          <div className="flex justify-between items-start">
            <div className="mb-4">
              <h2 className="text-2xl font-bold tracking-tight">Claim Details</h2>
              <p className="text-muted-foreground text-sm">
                Core intake information for the claim. All changes save automatically offline.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={togglePanel}
                className="gap-2 shadow-sm"
                title={panelOpen ? 'Hide Evidence Viewer' : 'Show Evidence Viewer'}
              >
                {panelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                Evidence
              </Button>
              <Button
                variant="outline"
                onClick={() => generateWordReport(currentClaim, null)}
                className="gap-2 shadow-sm"
              >
                <Download size={16} />
                Word Report
              </Button>
            </div>
          </div>

          {/* AI Extraction Slots */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {docSlots.map(slot => (
              <div key={slot.id} className="relative p-6 rounded-2xl border border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all flex flex-col items-center justify-center gap-3 group">
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  onChange={(e) => handleFileChange(e, slot.id)}
                  accept="image/*,application/pdf"
                />
                <div className="p-3 rounded-full bg-white shadow-sm text-primary group-hover:scale-110 transition-transform">
                  {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <FileText size={24} />}
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-primary flex items-center gap-1.5 justify-center">
                    <Sparkles size={14} className="animate-pulse" />
                    Scan {slot.label}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium">Click to upload and auto-fill</p>
                </div>
              </div>
            ))}
          </div>

          {isProcessing && (
            <div className="p-4 rounded-xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 flex items-center gap-3 animate-in zoom-in-95">
              <Loader2 className="animate-spin text-white" size={18} />
              <span className="text-sm font-bold tracking-tight uppercase">{progress || 'Processing Document...'}</span>
            </div>
          )}

          <div className="space-y-6">
            <VehicleDetailsForm />
            <PolicyDetailsForm />
            <DriverDetailsForm />
            <AccidentDetailsForm />
            <TotalLossForm />
          </div>

          {currentClaim.surveyType === 'spot' && <SpotTab />}
        </div>
      </div>

      {/* ── DRAG HANDLE ─────────────────────────────────────────────────────── */}
      {panelOpen && (
        <div
          onMouseDown={onMouseDownHandle}
          style={{
            width: 6,
            flexShrink: 0,
            cursor: 'col-resize',
            background: 'transparent',
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Drag to resize evidence panel"
        >
          {/* Visual handle indicator */}
          <div style={{
            width: 3,
            height: 40,
            borderRadius: 999,
            background: 'rgba(148,163,184,0.25)',
            transition: 'background 0.2s',
          }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.6)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.25)')}
          />
        </div>
      )}

      {/* ── RIGHT: Inline Evidence Viewer ───────────────────────────────────── */}
      {panelOpen && (
        <div
          style={{
            width: panelWidth,
            flexShrink: 0,
            padding: '16px 16px 16px 0',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 280,
          }}
        >
          <InlineEvidencePanel claimId={currentClaim.id} />
        </div>
      )}

      <AIReviewDialog
        isOpen={!!reviewData}
        onClose={cancelReview}
        onConfirm={confirmApply}
        title={reviewData?.key || ''}
        data={reviewData?.data}
      />
    </div>
  );
}
