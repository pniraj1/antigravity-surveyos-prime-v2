'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import {
  CheckCircle2, Clock, FileText, ChevronRight, Sparkles,
  Car, CreditCard, Shield, FileCheck, Wrench, Camera,
  ScrollText, Receipt, AlertCircle, Eye,
  FileSearch, ZoomIn, ZoomOut, PanelRightOpen, PanelRightClose,
} from 'lucide-react';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';

// ─── Storage key for panel state ─────────────────────────────────────────────
const STORAGE_KEY = 'surveyos-review-evidence-panel';

// ─── Document metadata ────────────────────────────────────────────────────────
const DOC_META: Record<string, { label: string; icon: any; color: string }> = {
  rc:       { label: 'RC Book',          icon: Car,        color: '#0D1B2A' },
  dl:       { label: 'Driving Licence',  icon: CreditCard, color: '#1e3a5f' },
  policy:   { label: 'Policy Schedule',  icon: Shield,     color: '#D4AF37' },
  claim:    { label: 'Claim Form',       icon: FileCheck,  color: '#4A4E69' },
  estimate: { label: 'Repair Estimate',  icon: Wrench,     color: '#059669' },
  photos:   { label: 'Damage Photos',    icon: Camera,     color: '#7c3aed' },
  permit:   { label: 'Vehicle Permit',   icon: ScrollText, color: '#b45309' },
  auth:     { label: 'Auth Cert.',       icon: FileText,   color: '#0369a1' },
  fitness:  { label: 'Fitness Cert.',    icon: Receipt,    color: '#be185d' },
};

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
  photos: 'Damage Photos',
};

// ─── Helper to load a document image from session storage ────────────────────
function loadDocImage(claimId: string | null, docType: string | null): string | null {
  if (!claimId || !docType) return null;
  try {
    const raw = sessionStorage.getItem(`evidence_${claimId}_${docType}`);
    if (!raw) return null;
    const pages: string[] = JSON.parse(raw);
    return pages[0] ?? null;
  } catch {
    return null;
  }
}

// ─── Small icon button ────────────────────────────────────────────────────────
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

// ─── Inline Evidence Panel (same as DetailsTab) ───────────────────────────────
function InlineEvidencePanel({ claimId }: { claimId: string }) {
  const { field } = useEvidenceStore();
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setImgSrc(loadDocImage(claimId, field?.docType ?? null));
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
                  : 'Click any field in a card\nto see its source here.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
        <ChevronRight size={12} color="#475569" />
        <span style={{ color: '#475569', fontSize: 10 }}>Click a field above to populate this panel</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ReviewTab() {
  const currentClaim  = useClaimStore(s => s.currentClaim);
  const extractedDocs = currentClaim?.extractedData ?? {};
  const { setActiveTab } = useUIStore();
  const openField = useEvidenceStore(s => s.openField);

  // Panel open/closed + width — persisted in localStorage
  const [panelOpen, setPanelOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY + '-open') !== 'false'; } catch { return true; }
  });
  const [panelWidth, setPanelWidth] = useState(() => {
    try { return parseInt(localStorage.getItem(STORAGE_KEY + '-width') || '400', 10); } catch { return 400; }
  });

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(panelWidth);
  const containerRef = useRef<HTMLDivElement>(null);

  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    try { localStorage.setItem(STORAGE_KEY + '-open', String(next)); } catch {}
  };

  // ── Drag-to-resize ──────────────────────────────────────────────────────────
  const onMouseDownHandle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;

    const onMove = (me: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - me.clientX; // drag left = wider panel
      const container = containerRef.current;
      const maxW = container ? container.offsetWidth - 400 : 900;
      const newW = Math.min(Math.max(dragStartWidth.current + delta, 280), maxW);
      setPanelWidth(newW);
    };

    const onUp = () => {
      isDragging.current = false;
      try { localStorage.setItem(STORAGE_KEY + '-width', String(panelWidth)); } catch {}
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  // persist width on change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY + '-width', String(panelWidth)); } catch {}
  }, [panelWidth]);

  if (!currentClaim) return null;

  const claimId     = currentClaim.id;
  const scannedKeys = Object.keys(extractedDocs);
  const allKeys     = Object.keys(DOC_META);
  const pendingKeys = allKeys.filter(k => !scannedKeys.includes(k));

  function handleFieldClick(docType: string, fieldKey: string, data: Record<string, unknown>) {
    const contextKey = `${fieldKey}_context`;
    const contextSnippet = (data[contextKey] as string) ?? '';
    openField(claimId, { docType, fieldKey, contextSnippet });
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* ── LEFT: Scrollable content ──────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: '#F8F9FA' }}>

        {/* Header */}
        <div
          className="px-8 py-8 lg:px-12"
          style={{
            background: 'linear-gradient(135deg, #0D1B2A 0%, #1e3a5f 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="max-w-4xl mx-auto">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-4"
              style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
            >
              <Sparkles size={11} />
              AI Extraction Results
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-black mb-2" style={{ color: '#F8F9FA', letterSpacing: '-0.02em' }}>
                  Document Review
                </h1>
                <p className="text-sm" style={{ color: 'rgba(232,236,240,0.65)' }}>
                  Review all AI-extracted data below. <Eye size={12} className="inline" style={{ color: '#D4AF37' }} />{' '}
                  Click any field to view its source in the <strong style={{ color: '#D4AF37' }}>Evidence Panel</strong>.
                </p>
              </div>

              {/* Toggle Evidence Panel button */}
              <button
                onClick={togglePanel}
                title={panelOpen ? 'Hide Evidence Panel' : 'Show Evidence Panel'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
                  background: panelOpen ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${panelOpen ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.15)'}`,
                  color: panelOpen ? '#D4AF37' : 'rgba(255,255,255,0.6)',
                  fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                }}
              >
                {panelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                Evidence
              </button>
            </div>

            {/* Summary chips */}
            <div className="flex items-center gap-3 mt-5 flex-wrap">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(5,150,105,0.15)', color: '#34d399' }}
              >
                <CheckCircle2 size={13} />
                {scannedKeys.length} Scanned
              </div>
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                <Clock size={13} />
                {pendingKeys.length} Pending
              </div>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="px-6 lg:px-12 py-8 max-w-4xl mx-auto space-y-6">

          {/* No docs yet */}
          {scannedKeys.length === 0 && (
            <div
              className="rounded-2xl p-12 flex flex-col items-center text-center"
              style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: '#F0F2F5' }}
              >
                <AlertCircle size={28} style={{ color: '#8D99AE' }} />
              </div>
              <div className="text-base font-bold mb-1" style={{ color: '#0D1B2A' }}>
                No documents scanned yet
              </div>
              <div className="text-sm mb-6" style={{ color: '#8D99AE' }}>
                Go to the Documents tab and upload your first document for AI extraction.
              </div>
              <button
                onClick={() => setActiveTab('documents')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #f0d870)',
                  color: '#0D1B2A',
                  boxShadow: '0 4px 16px rgba(212,175,55,0.3)',
                }}
              >
                <Sparkles size={14} />
                Go to Documents Tab
              </button>
            </div>
          )}

          {/* Scanned Document Cards */}
          {scannedKeys.map(key => {
            const meta = DOC_META[key] ?? { label: key.toUpperCase(), icon: FileText, color: '#4A4E69' };
            const Icon = meta.icon;
            const data = extractedDocs[key] as Record<string, unknown>;
            const fields = typeof data === 'object' && data !== null
              ? Object.entries(data).filter(([k]) => !k.endsWith('_context'))
              : [];

            return (
              <div
                key={key}
                className="rounded-2xl overflow-hidden"
                style={{ background: '#FFFFFF', border: '1px solid #E2E6EA', boxShadow: '0 1px 4px rgba(13,27,42,0.04)' }}
              >
                {/* Card header */}
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${meta.color}15`, color: meta.color }}
                  >
                    <Icon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black" style={{ color: '#0D1B2A' }}>{meta.label}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8D99AE' }}>
                      AI Extracted · click any field to view source
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{ background: `${meta.color}15`, color: meta.color }}
                  >
                    <CheckCircle2 size={11} />
                    {fields.length} fields
                  </div>
                </div>

                {/* Fields grid */}
                {fields.length > 0 ? (
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {fields
                      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
                      .map(([fieldKey, value]) => {
                        const hasContext = Boolean((data as Record<string, unknown>)[`${fieldKey}_context`]);
                        return (
                          <div
                            key={fieldKey}
                            className="space-y-0.5 rounded-xl p-2 transition-all cursor-pointer group"
                            onClick={() => handleFieldClick(key, fieldKey, data)}
                            title={hasContext ? 'Click to view source in document' : undefined}
                            style={{ border: '1px solid transparent' }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = `${meta.color}08`;
                              e.currentTarget.style.borderColor = `${meta.color}30`;
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.borderColor = 'transparent';
                            }}
                          >
                            <div
                              className="text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1"
                              style={{ color: '#8D99AE' }}
                            >
                              {fieldKey.replace(/_/g, ' ')}
                              {hasContext && (
                                <Eye size={9} style={{ color: meta.color, opacity: 0.7 }} />
                              )}
                            </div>
                            <div
                              className="text-sm font-semibold truncate"
                              style={{ color: '#0D1B2A' }}
                              title={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            >
                              {typeof value === 'object'
                                ? Array.isArray(value)
                                  ? `${value.length} items`
                                  : JSON.stringify(value)
                                : String(value) || '—'}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="p-6 text-sm text-center" style={{ color: '#8D99AE' }}>
                    No fields extracted — try re-scanning with a clearer image.
                  </div>
                )}
              </div>
            );
          })}

          {/* Pending docs shortcut */}
          {pendingKeys.length > 0 && scannedKeys.length > 0 && (
            <div
              className="rounded-2xl p-5 flex items-center justify-between gap-3"
              style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
            >
              <div>
                <div className="text-sm font-bold" style={{ color: '#0D1B2A' }}>
                  {pendingKeys.length} documents not yet scanned
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>
                  {pendingKeys.map(k => DOC_META[k]?.label ?? k).join(', ')}
                </div>
              </div>
              <button
                onClick={() => setActiveTab('documents')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
                style={{ background: '#0D1B2A', color: '#D4AF37' }}
              >
                Scan More <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── DRAG HANDLE ──────────────────────────────────────────────────────── */}
      {panelOpen && (
        <div
          onMouseDown={onMouseDownHandle}
          title="Drag to resize evidence panel"
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
        >
          <div
            style={{ width: 3, height: 40, borderRadius: 999, background: 'rgba(148,163,184,0.25)', transition: 'background 0.2s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.6)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.25)')}
          />
        </div>
      )}

      {/* ── RIGHT: Inline Evidence Viewer ─────────────────────────────────────── */}
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
          <InlineEvidencePanel claimId={claimId} />
        </div>
      )}
    </div>
  );
}
