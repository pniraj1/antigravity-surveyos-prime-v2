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
  rc:       { label: 'RC Book',          icon: Car,        color: 'var(--color-neutral-900)' },
  dl:       { label: 'Driving Licence',  icon: CreditCard, color: 'var(--color-neutral-600)' },
  policy:   { label: 'Policy Schedule',  icon: Shield,     color: 'var(--color-primary)' },
  claim:    { label: 'Claim Form',       icon: FileCheck,  color: 'var(--color-neutral-600)' },
  estimate: { label: 'Repair Estimate',  icon: Wrench,     color: 'var(--color-status-success)' },
  photos:   { label: 'Damage Photos',    icon: Camera,     color: 'var(--color-status-warning)' },
  permit:   { label: 'Vehicle Permit',   icon: ScrollText, color: 'var(--color-status-warning)' },
  auth:     { label: 'Auth Cert.',       icon: FileText,   color: 'var(--color-neutral-600)' },
  fitness:  { label: 'Fitness Cert.',    icon: Receipt,    color: 'var(--color-status-danger)' },
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
      style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-neutral-900)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--color-neutral-900)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileSearch size={16} color="var(--color-neutral-200)" />
          <div>
            <div style={{ color: 'var(--color-neutral-200)', fontWeight: 500, fontSize: 12 }}>Evidence Viewer</div>
            {docLabel && <div style={{ color: 'var(--color-neutral-400)', fontSize: 10, marginTop: 1 }}>{docLabel}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <EvidenceIconBtn onClick={zoomOut} title="Zoom Out"><ZoomOut size={13} /></EvidenceIconBtn>
          <button
            onClick={resetZoom}
            title="Reset zoom"
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', color: 'var(--color-neutral-400)', fontSize: 10, fontWeight: 500, minWidth: 38 }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <EvidenceIconBtn onClick={zoomIn} title="Zoom In"><ZoomIn size={13} /></EvidenceIconBtn>
        </div>
      </div>

      {/* Context snippet */}
      {field?.contextSnippet && (
        <div style={{ margin: '10px 12px 0', padding: '7px 10px', background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-200)', borderRadius: 7, flexShrink: 0 }}>
          <div style={{ color: 'var(--color-neutral-400)', fontSize: 9, fontWeight: 500, letterSpacing: '0.05em', marginBottom: 3 }}>EXTRACTED FROM DOCUMENT</div>
          <div style={{ color: 'var(--color-neutral-200)', fontSize: 11, lineHeight: 1.5, fontFamily: 'monospace' }}>{field.contextSnippet}</div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', color: 'var(--color-neutral-600)', padding: 20 }}>
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
        <ChevronRight size={12} color="var(--color-neutral-600)" />
        <span style={{ color: 'var(--color-neutral-600)', fontSize: 10 }}>Click a field above to populate this panel</span>
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
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--color-neutral-50)' }}>

        {/* Header */}
        <div
          className="px-8 py-8 lg:px-12"
          style={{
            background: 'var(--color-neutral-900)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="max-w-4xl mx-auto">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.2em] mb-4 bg-primary/15 text-primary border border-primary/30"
            >
              <Sparkles size={11} />
              AI Extraction Results
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-medium mb-2" style={{ color: 'var(--color-neutral-50)', letterSpacing: '-0.02em' }}>
                  Document Review
                </h1>
                <p className="text-sm" style={{ color: 'var(--color-neutral-400)' }}>
                  Review all AI-extracted data below. <Eye size={12} className="inline" style={{ color: 'var(--color-primary)' }} />{' '}
                  Click any field to view its source in the <strong style={{ color: 'var(--color-primary)' }}>Evidence Panel</strong>.
                </p>
              </div>

              {/* Toggle Evidence Panel button */}
              <button
                onClick={togglePanel}
                title={panelOpen ? 'Hide Evidence Panel' : 'Show Evidence Panel'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
                  background: panelOpen ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${panelOpen ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.15)'}`,
                  color: panelOpen ? 'var(--color-primary)' : 'rgba(255,255,255,0.6)',
                  fontSize: 12, fontWeight: 500, transition: 'all 0.2s',
                }}
              >
                {panelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                Evidence
              </button>
            </div>

            {/* Summary chips */}
            <div className="flex items-center gap-3 mt-5 flex-wrap">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'var(--color-status-success-tint)', color: 'var(--color-status-success)' }}
              >
                <CheckCircle2 size={13} />
                {scannedKeys.length} Scanned
              </div>
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--color-neutral-400)' }}
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
              className="rounded-2xl p-12 flex flex-col items-center text-center bg-card border border-border"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'var(--color-neutral-100)' }}
              >
                <AlertCircle size={28} style={{ color: 'var(--color-neutral-400)' }} />
              </div>
              <div className="text-base font-medium mb-1 text-foreground">
                No documents scanned yet
              </div>
              <div className="text-sm mb-6 text-muted-foreground">
                Go to the Documents tab and upload your first document for AI extraction.
              </div>
              <button
                onClick={() => setActiveTab('documents')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all bg-primary text-primary-foreground"
                style={{
                  boxShadow: '0 4px 16px color-mix(in srgb, var(--color-primary) 30%, transparent)',
                }}
              >
                <Sparkles size={14} />
                Go to Documents Tab
              </button>
            </div>
          )}

          {/* Scanned Document Cards */}
          {scannedKeys.map(key => {
            const meta = DOC_META[key] ?? { label: key.toUpperCase(), icon: FileText, color: 'var(--color-neutral-600)' };
            const Icon = meta.icon;
            const data = extractedDocs[key] as Record<string, unknown>;
            const fields = typeof data === 'object' && data !== null
              ? Object.entries(data).filter(([k]) => !k.endsWith('_context'))
              : [];

            return (
              <div
                key={key}
                className="rounded-2xl overflow-hidden bg-card border border-border"
                style={{ boxShadow: '0 1px 4px rgba(13,27,42,0.04)' }}
              >
                {/* Card header */}
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{ borderBottom: '1px solid var(--color-neutral-100)', background: 'var(--color-neutral-50)' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${meta.color}15`, color: meta.color }}
                  >
                    <Icon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{meta.label}</div>
                    <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      AI Extracted · click any field to view source
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
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
                              className="text-[9px] font-medium uppercase tracking-[0.2em] flex items-center gap-1 text-muted-foreground"
                            >
                              {fieldKey.replace(/_/g, ' ')}
                              {hasContext && (
                                <Eye size={9} style={{ color: meta.color, opacity: 0.7 }} />
                              )}
                            </div>
                            <div
                              className="text-sm font-medium truncate text-foreground"
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
                  <div className="p-6 text-sm text-center text-muted-foreground">
                    No fields extracted — try re-scanning with a clearer image.
                  </div>
                )}
              </div>
            );
          })}

          {/* Pending docs shortcut */}
          {pendingKeys.length > 0 && scannedKeys.length > 0 && (
            <div
              className="rounded-2xl p-5 flex items-center justify-between gap-3 bg-card border border-border"
            >
              <div>
                <div className="text-sm font-medium text-foreground">
                  {pendingKeys.length} documents not yet scanned
                </div>
                <div className="text-xs mt-0.5 text-muted-foreground">
                  {pendingKeys.map(k => DOC_META[k]?.label ?? k).join(', ')}
                </div>
              </div>
              <button
                onClick={() => setActiveTab('documents')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium flex-shrink-0 transition-all"
                style={{ background: 'var(--color-neutral-900)', color: 'var(--color-primary)' }}
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
            style={{ width: 3, height: 40, borderRadius: 999, background: 'var(--color-neutral-200)', opacity: 0.25, transition: 'opacity 0.2s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.6')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.25')}
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
