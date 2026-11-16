'use client';

import React from 'react';
import { FileText, X } from 'lucide-react';

type Kind = 'estimate' | 'final-bill';

interface DocumentKindDialogProps {
  /** The claim's current base document, marked when known. */
  current?: Kind;
  onChoose: (k: 'estimate' | 'final-bill') => void;
  onCancel: () => void;
}

/** Asked on every Assessment upload. */
export function DocumentKindDialog({ current, onChoose, onCancel }: DocumentKindDialogProps) {
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
          {([['estimate', 'Estimate'], ['final-bill', 'Final bill']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => onChoose(k)}
              aria-pressed={current === k}
              className={`w-full p-3 rounded-xl text-xs font-medium transition-all hover:scale-[1.01] ${
                k === 'estimate' ? 'bg-primary text-primary-foreground' : 'bg-muted/70 hover:bg-muted text-foreground border border-border'
              } ${current === k ? 'ring-2 ring-primary' : ''}`}
            >
              {label}
              {current === k && <span className="ml-2 text-[10px] font-normal opacity-80">Current</span>}
            </button>
          ))}
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
