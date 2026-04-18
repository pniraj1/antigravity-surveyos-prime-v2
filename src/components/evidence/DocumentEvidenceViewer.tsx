/**
 * DocumentEvidenceViewer
 * ──────────────────────
 * Collapsible side panel that shows the source document page image alongside
 * a highlighted text context snippet for any field the surveyor clicks.
 *
 * Usage
 * -----
 * 1. Wrap the panel in your tab layout.
 * 2. Call `evidenceStore.openField(docType, fieldKey, contextSnippet)` when
 *    a surveyor clicks a field in the Reconciliation Hub or Assessment panel.
 * 3. Images are read from sessionStorage (keyed by `ev_img_<claimId>_<docType>`).
 *
 * Session-storage key format
 * --------------------------
 *   ev_img_<claimId>_<docType>   →  base64 string (data URL) of page 1 image
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronRight, ChevronLeft, FileSearch, ZoomIn, ZoomOut } from 'lucide-react';
import { create } from 'zustand';

// ─── Evidence Store ───────────────────────────────────────────────────────────

export interface EvidenceField {
  docType: string;       // "rc" | "policy" | "dl" | "estimate" | …
  fieldKey: string;      // e.g. "registration_number"
  contextSnippet: string; // text snippet from AI _context key
}

interface EvidenceState {
  isOpen: boolean;
  field: EvidenceField | null;
  claimId: string | null;
  openField: (claimId: string, field: EvidenceField) => void;
  close: () => void;
}

export const useEvidenceStore = create<EvidenceState>((set) => ({
  isOpen: false,
  field: null,
  claimId: null,
  openField: (claimId, field) => set({ isOpen: true, field, claimId }),
  close: () => set({ isOpen: false, field: null }),
}));

// ─── Helper: load image from session storage ──────────────────────────────────

function getStorageKey(claimId: string, docType: string) {
  return `evidence_${claimId}_${docType}`;
}

function loadImage(claimId: string | null, docType: string | null): string | null {
  if (!claimId || !docType) return null;
  try {
    // Images are stored as a JSON array of base64 strings; we show the first page
    const raw = sessionStorage.getItem(getStorageKey(claimId, docType));
    if (!raw) return null;
    const pages: string[] = JSON.parse(raw);
    return pages[0] ?? null;
  } catch {
    return null;
  }
}

/** Store a base64 document image for later retrieval by the Evidence Viewer.
 * Accepts the same array format written by useAIExtraction's saveEvidenceImages. */
export function storeEvidenceImage(claimId: string, docType: string, base64: string) {
  try {
    sessionStorage.setItem(getStorageKey(claimId, docType), JSON.stringify([base64]));
  } catch (e) {
    console.warn('[EvidenceViewer] sessionStorage quota exceeded, skipping image store', e);
  }
}

// ─── Doc type labels ──────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  /** Width of the panel when open, e.g. "420px" */
  panelWidth?: string;
}

export function DocumentEvidenceViewer({ panelWidth = '420px' }: Props) {
  const { isOpen, field, claimId, close } = useEvidenceStore();
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);

  // Load image whenever the field / claimId changes
  useEffect(() => {
    const src = loadImage(claimId, field?.docType ?? null);
    setImgSrc(src);
    setZoom(1);
  }, [claimId, field?.docType]);

  const zoomIn  = useCallback(() => setZoom(z => Math.min(z + 0.25, 4)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(z - 0.25, 0.5)), []);
  const resetZoom = useCallback(() => setZoom(1), []);

  // Mouse-wheel zoom on the image area
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        return Math.min(Math.max(z + delta, 0.5), 4);
      });
    }
  }, []);

  const docLabel = field ? (DOC_LABELS[field.docType] ?? field.docType.toUpperCase()) : '';

  return (
    <>
      {/* ── Floating toggle button when panel is closed ── */}
      {!isOpen && (
        <button
          onClick={() => {
            // Re-open with the last field if available
            useEvidenceStore.setState({ isOpen: true });
          }}
          title="Open Evidence Viewer"
          style={{
            position: 'fixed',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000,
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
            border: 'none',
            borderRadius: '8px 0 0 8px',
            padding: '10px 6px',
            cursor: 'pointer',
            boxShadow: '-2px 0 12px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            color: '#fff',
          }}
        >
          <FileSearch size={18} />
          <ChevronLeft size={14} />
        </button>
      )}

      {/* ── Side panel ── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: isOpen ? 0 : `-${panelWidth}`,
          width: panelWidth,
          height: '100vh',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          background: '#0f172a',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.5)',
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSearch size={18} color="#93c5fd" />
            <div>
              <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>
                Evidence Viewer
              </div>
              {docLabel && (
                <div style={{ color: '#93c5fd', fontSize: 11, marginTop: 1 }}>
                  {docLabel}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <IconBtn onClick={zoomOut} title="Zoom Out"><ZoomOut size={15} /></IconBtn>
            <button
              onClick={resetZoom}
              title="Reset zoom"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                cursor: 'pointer',
                color: '#93c5fd',
                fontSize: 11,
                fontWeight: 600,
                minWidth: 42,
              }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <IconBtn onClick={zoomIn}  title="Zoom In" ><ZoomIn  size={15} /></IconBtn>
            <IconBtn onClick={close}   title="Close">   <X        size={15} /></IconBtn>
          </div>
        </div>

        {/* Context snippet badge */}
        {field?.contextSnippet && (
          <div style={{
            margin: '12px 14px 0',
            padding: '8px 12px',
            background: 'rgba(37,99,235,0.18)',
            border: '1px solid rgba(37,99,235,0.35)',
            borderRadius: 8,
            flexShrink: 0,
          }}>
            <div style={{ color: '#93c5fd', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 4 }}>
              EXTRACTED FROM DOCUMENT
            </div>
            <div style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.5, fontFamily: 'monospace' }}>
              <HighlightedSnippet
                snippet={field.contextSnippet}
                highlight={field.fieldKey.replace(/_/g, ' ')}
              />
            </div>
          </div>
        )}

        {/* Document image — scrollable zoom container */}
        <div
          onWheel={handleWheel}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 12,
            // Don't use align/justify center — let the inner div expand freely
          }}
        >
          {imgSrc ? (
            <div
              style={{
                display: 'inline-block',
                minWidth: '100%',
                transformOrigin: 'top left',
                transform: `scale(${zoom})`,
                transition: 'transform 0.15s ease',
              }}
            >
              <img
                ref={imgRef}
                src={imgSrc}
                alt={`${docLabel} source document`}
                style={{
                  width: '100%',
                  display: 'block',
                  borderRadius: 6,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',

                }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <EmptyState field={field} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <ChevronRight size={14} color="#475569" />
          <span style={{ color: '#475569', fontSize: 11 }}>
            Click any field in the Reconciliation Hub to update this view
          </span>
        </div>
      </div>

      {/* Backdrop (mobile / narrow screens) */}
      {isOpen && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.4)',
            // Only show backdrop on smaller screens
            display: 'none',
          }}
          className="evidence-backdrop"
        />
      )}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'rgba(255,255,255,0.1)',
        border: 'none',
        borderRadius: 6,
        padding: '5px 7px',
        cursor: 'pointer',
        color: '#cbd5e1',
        display: 'flex',
        alignItems: 'center',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
    >
      {children}
    </button>
  );
}

/** Highlights value-like text within the snippet */
function HighlightedSnippet({ snippet, highlight }: { snippet: string; highlight: string }) {
  // Very lightweight highlight — just wraps numbers and capitalised words
  const parts = snippet.split(/(\b[A-Z0-9][A-Za-z0-9\-\/]+\b|\d{2,})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^[A-Z0-9]/.test(part) && part.length > 2 ? (
          <mark
            key={i}
            style={{
              background: 'rgba(234,179,8,0.25)',
              color: '#fef08a',
              borderRadius: 3,
              padding: '0 2px',
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function EmptyState({ field }: { field: EvidenceField | null }) {
  return (
    <div style={{ textAlign: 'center', color: '#475569', padding: 24 }}>
      <FileSearch size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
      <p style={{ fontSize: 13, margin: 0 }}>
        {field
          ? 'Document image not available.\nRe-scan the document to enable this view.'
          : 'Click any field in the Reconciliation Hub to see its source document.'}
      </p>
    </div>
  );
}
