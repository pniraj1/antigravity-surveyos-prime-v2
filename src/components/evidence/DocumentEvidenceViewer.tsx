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

interface BlobEntry {
  url: string;
  mimeType: string;
}

interface EvidenceState {
  isOpen: boolean;
  field: EvidenceField | null;
  claimId: string | null;
  openField: (claimId: string, field: EvidenceField) => void;
  close: () => void;
  // Blob URL map: "claimId_docType" → every file in the slot (front, back, …)
  blobUrls: Record<string, BlobEntry[]>;
  // Raw File map: "claimId_docType" → every File in the slot (for downstream processing)
  rawFiles: Record<string, File[]>;
  // Replace a slot with one or more files (revokes the slot's previous urls).
  storeFiles: (claimId: string, docType: string, files: File[]) => void;
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
  storeFiles: (claimId, docType, files) => {
    const key = `${claimId}_${docType}`;
    // Revoke any existing blob URLs for this slot to avoid memory leaks
    for (const prev of get().blobUrls[key] ?? []) URL.revokeObjectURL(prev.url);
    const entries = files.map((f) => ({ url: URL.createObjectURL(f), mimeType: f.type }));
    set(s => ({
      blobUrls: { ...s.blobUrls, [key]: entries },
      rawFiles: { ...s.rawFiles, [key]: [...files] },
    }));
  },
  revokeBlobUrls: (claimId) => {
    const current = get().blobUrls;
    const rawCurrent = get().rawFiles;
    const next: Record<string, BlobEntry[]> = {};
    const rawNext: Record<string, File[]> = {};
    for (const [key, entries] of Object.entries(current)) {
      if (key.startsWith(`${claimId}_`)) {
        for (const e of entries) URL.revokeObjectURL(e.url);
      } else {
        next[key] = entries;
      }
    }
    for (const [key, files] of Object.entries(rawCurrent)) {
      if (!key.startsWith(`${claimId}_`)) rawNext[key] = files;
    }
    set({ blobUrls: next, rawFiles: rawNext });
  },
}));

/** Store every file in a slot (front, back, …). Call this right after upload/pick. */
export function storeFiles(claimId: string, docType: string, files: File[]) {
  useEvidenceStore.getState().storeFiles(claimId, docType, files);
}

/** Back-compat: store a single file as the whole slot. */
export function storeBlobUrl(claimId: string, docType: string, file: File) {
  useEvidenceStore.getState().storeFiles(claimId, docType, [file]);
}

/** Retrieve the first raw File for a document. Returns null if not stored. */
export function getRawFile(claimId: string, docType: string): File | null {
  return useEvidenceStore.getState().rawFiles[`${claimId}_${docType}`]?.[0] ?? null;
}

/** Retrieve every raw File in a slot. Returns [] if not stored. */
export function getRawFiles(claimId: string, docType: string): File[] {
  return useEvidenceStore.getState().rawFiles[`${claimId}_${docType}`] ?? [];
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

  // Resolve every file in the current slot (RC front + back, etc.)
  const blobEntries = claimId && effectiveDocType
    ? blobUrls[`${claimId}_${effectiveDocType}`] ?? []
    : [];

  const docLabel = effectiveDocType ? (DOC_LABELS[effectiveDocType] ?? effectiveDocType.toUpperCase()) : '';

  return (
    <>
      {/* ── Floating toggle button when panel is closed ── */}
      {(!isOpen && !embedded) && (
        <button
          onClick={() => useEvidenceStore.setState({ isOpen: true })}
          title="Open Evidence Viewer"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-[1000] rounded-l-lg px-1.5 py-2.5 cursor-pointer shadow-lg flex flex-col items-center gap-1.5 bg-card border border-border text-primary"
        >
          <FileSearch size={18} />
          <ChevronRight size={14} className="rotate-180" />
        </button>
      )}

      {/* ── Side panel ── */}
      <div
        className="flex flex-col bg-card border-l border-border"
        style={{
          position: embedded ? 'relative' : 'fixed',
          top: 0,
          right: (isOpen || embedded) ? 0 : `-${panelWidth}`,
          width: embedded ? '100%' : panelWidth,
          height: embedded ? '100%' : '100vh',
          zIndex: embedded ? 1 : 1001,
          boxShadow: embedded ? 'none' : '-4px 0 24px rgba(13,27,42,0.12)',
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 shrink-0 bg-neutral-50 border-b border-border">
          <div className="flex items-center gap-2">
            <FileSearch size={18} className="text-primary" />
            <div>
              <div className="text-[13px] font-medium text-foreground">Evidence Viewer</div>
              {docLabel && <div className="text-[11px] text-primary mt-0.5">{docLabel}</div>}
            </div>
          </div>
          {!embedded && <IconBtn onClick={close} title="Close"><X size={15} /></IconBtn>}
        </div>

        {/* Context snippet badge */}
        {field?.contextSnippet && (
          <div className="mx-3.5 mt-3 px-3 py-2 rounded-lg shrink-0 bg-status-warning-tint border border-status-warning">
            <div className="text-[10px] font-medium uppercase tracking-widest text-primary mb-1">
              EXTRACTED FROM DOCUMENT
            </div>
            <div className="text-xs leading-relaxed font-mono text-foreground">
              <HighlightedSnippet
                snippet={field.contextSnippet}
                highlight={field.fieldKey.replace(/_/g, ' ')}
              />
            </div>
          </div>
        )}

        {/* Document display area — every file in the slot, stacked (front, back, …) */}
        <div className="flex-1 overflow-auto flex flex-col p-3 gap-3">
          {blobEntries.length > 0 ? (
            blobEntries.map((entry, idx) => {
              const isPdf = entry.mimeType === 'application/pdf';
              const isImage = entry.mimeType.startsWith('image/');
              return (
                <div key={entry.url} className="flex flex-col gap-1">
                  {blobEntries.length > 1 && (
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {idx + 1} of {blobEntries.length}
                    </span>
                  )}
                  {isPdf ? (
                    <iframe
                      src={entry.url}
                      title={`${docLabel} ${idx + 1}`}
                      className="w-full h-[70vh] border-none bg-white rounded-md"
                    />
                  ) : isImage ? (
                    <img
                      src={entry.url}
                      alt={`${docLabel} source document ${idx + 1}`}
                      className="w-full block rounded-md shadow-lg"
                    />
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="flex items-center justify-center h-full">
              <EmptyState field={field} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2 border-t border-border shrink-0 flex items-center gap-1.5">
          <ChevronRight size={14} className="text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            Click any field in the Reconciliation Hub to update this view
          </span>
        </div>
      </div>

      {/* Backdrop (mobile / narrow screens) */}
      {isOpen && !embedded && (
        <div
          onClick={close}
          className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm lg:hidden"
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
      className="flex items-center px-1.5 py-1 rounded-md border-none cursor-pointer text-white/70 bg-white/10 transition-colors hover:bg-white/20 hover:text-white"
    >
      {children}
    </button>
  );
}

/** Highlights value-like text within the snippet */
function HighlightedSnippet({ snippet, highlight }: { snippet: string; highlight: string }) {
  const parts = snippet.split(/(\b[A-Z0-9][A-Za-z0-9\-\/]+\b|\d{2,})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^[A-Z0-9]/.test(part) && part.length > 2 ? (
          <mark key={i} className="bg-status-warning-tint text-foreground rounded px-0.5">
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
    <div className="text-center text-muted-foreground p-6">
      <FileSearch size={40} className="opacity-30 mb-3 mx-auto" />
      <p className="text-[13px] m-0">
        {field
          ? 'Document image not available.\nRe-scan the document to enable this view.'
          : 'Click any field in the Reconciliation Hub to see its source document.'}
      </p>
    </div>
  );
}
