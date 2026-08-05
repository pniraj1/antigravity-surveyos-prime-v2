'use client';

import { FileSearch, ChevronRight } from 'lucide-react';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';

// ─── Inline Evidence Panel ────────────────────────────────────────────────────
// Uses blob URLs stored in the evidence store — no PNG conversion needed.
//
// Blob URLs are session-only by design: they die on refresh, and this panel
// shows a placeholder rather than hiding itself. Do NOT add persistence —
// a survey is done in one sitting, and a surveyor who needs a document later
// re-uploads it.

export const DOC_LABELS: Record<string, string> = {
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

export function InlineEvidencePanel({ claimId }: { claimId: string }) {
  const { field, blobUrls } = useEvidenceStore();

  // Determine which document to show: active field's doc or first available
  let effectiveDocType = field?.docType;
  if (!effectiveDocType) {
    for (const type of ['rc', 'policy', 'dl', 'estimate']) {
      if (blobUrls[`${claimId}_${type}`]) {
        effectiveDocType = type;
        break;
      }
    }
  }

  const docLabel = effectiveDocType ? (DOC_LABELS[effectiveDocType] ?? effectiveDocType.toUpperCase()) : '';
  const blobEntry = effectiveDocType ? blobUrls[`${claimId}_${effectiveDocType}`]?.[0] : undefined;
  const isPdf = blobEntry?.mimeType === 'application/pdf';

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-border bg-[var(--color-neutral-50)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-[var(--color-neutral-50)] border-b border-border">
        <div className="flex items-center gap-2">
          <FileSearch size={16} className="text-primary" />
          <div>
            <div className="text-xs font-medium text-foreground">Evidence Viewer</div>
            {docLabel && <div className="text-[10px] text-primary mt-0.5">{docLabel}</div>}
          </div>
        </div>
        {blobEntry && (
          <a
            href={blobEntry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary underline hover:opacity-80"
          >
            Open in new tab
          </a>
        )}
      </div>

      {/* Context snippet */}
      {field?.contextSnippet && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg shrink-0 bg-[var(--color-status-warning-tint)] border border-[var(--color-status-warning)]/30">
          <div className="text-[10px] font-medium tracking-wide text-[var(--color-status-warning)] mb-1">Extracted from document</div>
          <div className="text-[11px] leading-relaxed font-mono text-[var(--color-neutral-900)]">{field.contextSnippet}</div>
        </div>
      )}

      {/* Document viewer */}
      <div className={`flex-1 overflow-hidden ${blobEntry ? '' : 'p-3'}`}>
        {blobEntry ? (
          isPdf ? (
            <iframe
              src={blobEntry.url}
              className="w-full h-full border-none block"
              title={docLabel}
            />
          ) : (
            <div className="h-full overflow-auto p-3">
              <img
                src={blobEntry.url}
                alt={`${docLabel} source document`}
                className="w-full block rounded-md shadow-lg"
              />
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-center text-[var(--color-neutral-400)] p-5">
            <div>
              <FileSearch size={36} className="opacity-30 mb-3 mx-auto" />
              <p className="text-xs m-0">
                {field
                  ? 'Upload the document to view it here.'
                  : 'Scan a document (RC / Policy / DL)\nto see the source here.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border shrink-0 flex items-center gap-1.5">
        <ChevronRight size={12} className="text-[var(--color-neutral-400)]" />
        <span className="text-[10px] text-[var(--color-neutral-400)]">Upload a document above to populate this panel</span>
      </div>
    </div>
  );
}
