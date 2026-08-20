'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { AssessmentRow } from '@/types/assessment';

interface PendingRowsDialogProps {
  /** Allowed rows still sitting at status `pending`. */
  rows: AssessmentRow[];
  /** Marks every listed row Not in Bill. */
  onResolveAll: () => void;
  onCancel: () => void;
  /** Wording, so the same dialog serves the divergence gate too. */
  title?: string;
  body?: string;
  resolveLabel?: string;
}

/**
 * A bill check is not issued while the bill is still pending. `pending` means
 * the workshop gave no figure for that item, and the surveyor must say what
 * that means before the document exists — so PENDING never reaches the PDF.
 */
export function PendingRowsDialog({
  rows, onResolveAll, onCancel,
  title,
  body = 'A bill check cannot be issued while items are pending. Enter the billed figure, or record that they were not billed.',
  resolveLabel = 'Mark all Not in Bill',
}: PendingRowsDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in duration-200 bg-card border border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-status-warning flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-medium text-foreground">
                {title ?? `${rows.length} item${rows.length === 1 ? '' : 's'} not yet checked`}
              </h2>
              <p className="text-xs mt-1 text-muted-foreground">
                {body}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <ul className="max-h-48 overflow-y-auto text-xs flex flex-col gap-1">
          {rows.map(r => (
            <li key={r.id} className="flex justify-between gap-3 px-3 py-2 rounded-lg bg-neutral-50">
              <span className="truncate text-foreground">{r.particulars}</span>
              <span className="flex-shrink-0 text-muted-foreground">
                ₹{r.assessed.toLocaleString('en-IN')}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground"
          >
            Go back and edit
          </button>
          <button
            onClick={onResolveAll}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground"
          >
            {resolveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
