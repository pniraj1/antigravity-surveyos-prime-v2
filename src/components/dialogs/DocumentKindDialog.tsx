'use client';

import React from 'react';
import { FileText, X } from 'lucide-react';

interface DocumentKindDialogProps {
  onChoose: (k: 'estimate' | 'final-bill') => void;
  onCancel: () => void;
}

/** Asked once, on a claim's first Assessment upload. */
export function DocumentKindDialog({ onChoose, onCancel }: DocumentKindDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in duration-200 bg-card border border-border">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-status-info-tint, rgba(59,130,246,0.1))' }}
          >
            <FileText size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">What is this document?</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Choose Final bill when the insurer asks you to assess from the bill (UIIC). Bill Check will then read the estimate for Est. No.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onChoose('estimate')}
            className="w-full p-3 rounded-xl text-xs font-medium bg-primary text-primary-foreground transition-all hover:scale-[1.01]"
          >
            Estimate
          </button>
          <button
            onClick={() => onChoose('final-bill')}
            className="w-full p-3 rounded-xl text-xs font-medium bg-muted/70 hover:bg-muted text-foreground border border-border transition-all hover:scale-[1.01]"
          >
            Final bill
          </button>
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
          >
            <X size={14} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
