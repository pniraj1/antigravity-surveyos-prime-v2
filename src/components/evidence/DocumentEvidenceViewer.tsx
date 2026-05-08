/**
 * DocumentEvidenceViewer
 * ──────────────────────
 * Collapsible side panel that shows the source document alongside a highlighted
 * text context snippet for any field the surveyor clicks.
 *
 * Usage
 * -----
 * 1. When a file is uploaded, call `storeBlobUrl(claimId, docType, file)` once.
 *    This creates an object URL pointing to the original file — no conversion needed.
 * 2. Call `evidenceStore.openField(claimId, field)` when the surveyor clicks a field.
 * 3. The viewer renders PDFs in a native <iframe> and images as <img>.
 *
 * Blob URLs are in-memory only — they are cleared on tab close or claim archive.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { X, ChevronRight, FileSearch } from 'lucide-react';
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
  // Blob URL map: "claimId_docType" → { url, mimeType }
  blobUrls: Record<string, { url: string; mimeType: string }>;
  // Raw File map: "claimId_docType" → File (for downstream processing)
  rawFiles: Record<string, File>;
  storeBlobUrl: (claimId: string, docType: string, file: File) => void;
  revokeBlobUrls: (claimId: string) => void;
}

export const useEvidenceStore = create<EvidenceState>((set, get) => ({
  isOpen: false,
  field: null,
  claimId: null,
  blobUrls: {},
  rawFiles: {},
  openField: (claimId, field) => set({ isOpen: true, field, claimId }),
  close: () => set({ isOpen: false, field: null }),
  storeBlobUrl: (claimId, docType, file) => {
    const key = `${claimId}_${docType}`;
    // Revoke any existing blob URL for this doc to avoid memory leaks
    const existing = get().blobUrls[key];
    if (existing) URL.revokeObjectURL(existing.url);
    const url = URL.createObjectURL(file);
    set(s => ({
      blobUrls: { ...s.blobUrls, [key]: { url, mimeType: file.type } },
      rawFiles: { ...s.rawFiles, [key]: file },
    }));
  },
  revokeBlobUrls: (claimId) => {
    const current = get().blobUrls;
    const rawCurrent = get().rawFiles;
    const next: Record<string, { url: string; mimeType: string }> = {};
    const rawNext: Record<string, File> = {};
    for (const [key, val] of Object.entries(current)) {
      if (key.startsWith(`${claimId}_`)) {
        URL.revokeObjectURL(val.url);
      } else {
        next[key] = val;
      }
    }
    for (const [key, file] of Object.entries(rawCurrent)) {
      if (!key.startsWith(`${claimId}_`)) rawNext[key] = file;
    }
    set({ blobUrls: next, rawFiles: rawNext });
  },
}));

/** Convenience: store a blob URL for a file. Call this right after upload. */
export function storeBlobUrl(claimId: string, docType: string, file: File) {
  useEvidenceStore.getState().storeBlobUrl(claimId, docType, file);
}

/** Retrieve the raw File object for a previously uploaded document. Returns null if not stored. */
export function getRawFile(claimId: string, docType: string): File | null {
  return useEvidenceStore.getState().rawFiles[`${claimId}_${docType}`] ?? null;
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
  panelWidth?: string;
  embedded?: boolean;
  defaultDocType?: string;
}

export function DocumentEvidenceViewer({ panelWidth = '420px', embedded = false, defaultDocType }: Props) {
  const { isOpen, field, claimId, close, blobUrls } = useEvidenceStore();

  // Resolve the docType: current field or fallback to default
  const effectiveDocType = field?.docType || defaultDocType;

  // Resolve the blob URL for the current doc
  const blobEntry = claimId && effectiveDocType
    ? blobUrls[`${claimId}_${effectiveDocType}`] ?? null
    : null;
  const blobUrl  = blobEntry?.url ?? null;
  const isPdf    = blobEntry?.mimeType === 'application/pdf';
  const isImage  = blobEntry?.mimeType.startsWith('image/') ?? false;

  const docLabel = effectiveDocType ? (DOC_LABELS[effectiveDocType] ?? effectiveDocType.toUpperCase()) : '';

  return (
    <>
      {/* ── Floating toggle button when panel is closed ── */}
      {(!isOpen && !embedded) && (
        <button
          onClick={() => useEvidenceStore.setState({ isOpen: true })}
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
          <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}

      {/* ── Side panel ── */}
      <div
        style={{
          position: embedded ? 'relative' : 'fixed',
          top: 0,
          right: (isOpen || embedded) ? 0 : `-${panelWidth}`,
          width: embedded ? '100%' : panelWidth,
          height: embedded ? '100%' : '100vh',
          zIndex: embedded ? 1 : 1001,
          display: 'flex',
          flexDirection: 'column',
          background: '#0f172a',
          boxShadow: embedded ? 'none' : '-4px 0 32px rgba(0,0,0,0.5)',
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
              <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>Evidence Viewer</div>
              {docLabel && <div style={{ color: '#93c5fd', fontSize: 11, marginTop: 1 }}>{docLabel}</div>}
            </div>
          </div>
          {!embedded && <IconBtn onClick={close} title="Close"><X size={15} /></IconBtn>}
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

        {/* Document display area */}
        <div style={{ flex: 1, overflow: 'hidden', padding: isPdf ? 0 : 12, display: 'flex', flexDirection: 'column' }}>
          {blobUrl && isPdf ? (
            // Native PDF rendering — browser handles zoom, scroll, text selection
            <iframe
              key={blobUrl}
              src={blobUrl}
              title={docLabel}
              style={{ flex: 1, width: '100%', border: 'none', borderRadius: 0, background: '#fff' }}
            />
          ) : blobUrl && isImage ? (
            // Image files — render directly
            <div style={{ flex: 1, overflow: 'auto' }}>
              <img
                src={blobUrl}
                alt={`${docLabel} source document`}
                style={{ width: '100%', display: 'block', borderRadius: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
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
