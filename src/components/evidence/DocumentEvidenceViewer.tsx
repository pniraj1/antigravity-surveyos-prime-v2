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
 *
 * The panel can also take a file itself, via `EvidenceUpload` below. That path
 * stores the blob and stops there — no extraction — so a surveyor who refreshes
 * mid-claim can put the document back without paying for a second AI read.
 */

import React, { useRef, useState } from 'react';
import { X, ChevronRight, FileSearch, Upload } from 'lucide-react';
import { create } from 'zustand';
import { useClaimStore } from '@/stores/claim-store';

// ─── Evidence Store ───────────────────────────────────────────────────────────

export interface EvidenceField {
  docType: string;       // "rc" | "policy" | "dl" | "estimate" | …
  fieldKey: string;      // e.g. "registration_number"
  contextSnippet: string; // text snippet from AI _context key
}

interface BlobEntry {
  url: string;
  mimeType: string;
  /** Named so a file the viewer cannot render can still be identified. */
  name: string;
  size: number;
}

interface EvidenceState {
  isOpen: boolean;
  field: EvidenceField | null;
  claimId: string | null;
  openField: (claimId: string, field: EvidenceField) => void;
  /**
   * Set the active field WITHOUT opening the full-screen viewer. Used by hosts
   * that already render their own inline panel — the Reconciliation Hub is a
   * modal, and openField's `isOpen: true` would stack the overlay on top of it.
   */
  setActiveField: (claimId: string, field: EvidenceField) => void;
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
  setActiveField: (claimId, field) => set({ field, claimId }),
  close: () => set({ isOpen: false, field: null }),
  storeFiles: (claimId, docType, files) => {
    const key = `${claimId}_${docType}`;
    // Revoke any existing blob URLs for this slot to avoid memory leaks
    for (const prev of get().blobUrls[key] ?? []) URL.revokeObjectURL(prev.url);
    const entries = files.map((f) => ({
      url: URL.createObjectURL(f),
      mimeType: f.type,
      name: f.name,
      size: f.size,
    }));
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

// ─── Viewing-only upload ──────────────────────────────────────────────────────

/**
 * Attaches a file to an evidence slot for VIEWING ONLY. Calls `storeFiles` and
 * nothing else — `triggerExtraction` is never involved, so the AI does not read
 * the document a second time.
 *
 * Deliberately avoids the gold Sparkles treatment used by the Documents and
 * Assessment upload tiles: that visual means "AI is reading this" everywhere
 * else in the app, and this path never does.
 */
export function EvidenceUpload({
  claimId,
  docType,
  docLabel,
  variant = 'zone',
}: {
  claimId: string;
  docType: string;
  docLabel?: string;
  /** 'zone' = dashed drop area for the empty state. 'compact' = header pill. */
  variant?: 'zone' | 'compact';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length > 0) storeFiles(claimId, docType, files);
    // Clear so re-picking the same file still fires onChange.
    if (inputRef.current) inputRef.current.value = '';
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept="image/*,application/pdf"
      onChange={(e) => accept(e.target.files)}
      className="absolute inset-0 opacity-0 cursor-pointer"
    />
  );

  if (variant === 'compact') {
    return (
      <label
        title="Attach a file to view here — the AI will not read it"
        className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer text-[10px] font-medium border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        {input}
        <Upload size={11} />
        Replace
      </label>
    );
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); accept(e.dataTransfer.files); }}
      className={`relative flex flex-col items-center justify-center gap-2.5 w-full px-5 py-6 rounded-2xl cursor-pointer text-center border border-dashed transition-all ${
        dragOver
          ? 'border-primary bg-primary/10'
          : 'border-border bg-neutral-950/[0.03] hover:border-primary/50 hover:bg-primary/5'
      }`}
    >
      {input}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
        <Upload size={17} />
      </div>
      <div>
        <div className="text-sm font-medium text-foreground">
          {docLabel ? `Attach ${docLabel}` : 'Attach document'}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
          Click or drop a file to view it here.
          <br />
          Viewing only — not sent to the AI.
        </p>
      </div>
    </label>
  );
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
  const { isOpen, field, close, blobUrls } = useEvidenceStore();

  // The store's claimId is only set once a field is clicked. Fall back to the
  // open claim so the upload control works before any field has been touched —
  // which is exactly the state the panel is in right after a refresh.
  const storeClaimId = useEvidenceStore(s => s.claimId);
  const openClaimId = useClaimStore(s => s.currentClaim?.id);
  const claimId = storeClaimId ?? openClaimId ?? null;

  // Resolve the docType: current field or fallback to default
  const effectiveDocType = field?.docType || defaultDocType;

  // Resolve every file in the current slot (RC front + back, etc.)
  const blobEntries = claimId && effectiveDocType
    ? blobUrls[`${claimId}_${effectiveDocType}`] ?? []
    : [];

  const canUpload = Boolean(claimId && effectiveDocType);

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
          <div className="flex items-center gap-2">
            {/* Only offered once something is on screen — the empty state has
                its own, larger control. */}
            {canUpload && blobEntries.length > 0 && (
              <EvidenceUpload
                claimId={claimId!}
                docType={effectiveDocType!}
                docLabel={docLabel}
                variant="compact"
              />
            )}
            {!embedded && <IconBtn onClick={close} title="Close"><X size={15} /></IconBtn>}
          </div>
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
                  ) : (
                    // Anything else used to fall through to null, so a file the
                    // surveyor had uploaded showed as blank space.
                    <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-2">
                      <div className="text-sm font-medium text-foreground break-all">{entry.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.mimeType || 'Type not recognised'} · {(entry.size / 1024).toFixed(0)} KB
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This file cannot be shown here. Open it to check the figures against it.
                      </p>
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="self-start px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground"
                      >
                        Open in new tab
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <EmptyState field={field} canUpload={canUpload} />
              {canUpload && (
                <EvidenceUpload
                  claimId={claimId!}
                  docType={effectiveDocType!}
                  docLabel={docLabel}
                />
              )}
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

// The header sits on bg-neutral-50, so the previous white-on-white/10 styling
// rendered this control invisible.
function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center px-1.5 py-1 rounded-md border-none cursor-pointer text-muted-foreground bg-transparent transition-colors hover:bg-neutral-950/5 hover:text-foreground"
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

function EmptyState({ field, canUpload }: { field: EvidenceField | null; canUpload?: boolean }) {
  // With the upload control right below, telling the surveyor to re-scan would
  // send them off to pay for an extraction they do not need.
  const message = canUpload
    ? 'This document is not loaded in this session.'
    : field
      ? 'Document image not available.\nRe-scan the document to enable this view.'
      : 'Click any field in the Reconciliation Hub to see its source document.';

  return (
    <div className="text-center text-muted-foreground px-6 pt-6">
      <FileSearch size={40} className="opacity-30 mb-3 mx-auto" />
      <p className="text-[13px] m-0 whitespace-pre-line">{message}</p>
    </div>
  );
}
