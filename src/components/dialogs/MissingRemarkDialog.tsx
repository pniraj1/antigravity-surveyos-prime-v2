'use client';

import React from 'react';
import { MessageSquareWarning, X } from 'lucide-react';
import type { AssessmentRow } from '@/types/assessment';

interface MissingRemarkDialogProps {
  /** Rows whose bill-check outcome carries no explanation. */
  rows: AssessmentRow[];
  onPrintAnyway: () => void;
  onCancel: () => void;
}

/**
 * Non-blocking. A missing remark never changes a number — the report prints
 * correctly either way — so unlike PendingRowsDialog, this offers a way past
 * itself. It exists so a claims officer reading "Not in Bill" or an allowance
 * above assessment later finds a reason, not silence.
 */
export function MissingRemarkDialog({ rows, onPrintAnyway, onCancel }: MissingRemarkDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in duration-200 bg-card border border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <MessageSquareWarning size={20} className="text-status-warning flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-medium text-foreground">
                {rows.length} item{rows.length === 1 ? '' : 's'} with no remark
              </h2>
              <p className="text-xs mt-1 text-muted-foreground">
                These items were dropped or billed differently from what was assessed, with no
                note explaining why. The report will still print correctly — this is only about
                the paper trail.
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
                {r.billStatus === 'not-in-bill' ? 'Not in Bill' : 'Billed ≠ Allowed'}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground"
          >
            Go back and add remarks
          </button>
          <button
            onClick={onPrintAnyway}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground"
          >
            Print anyway
          </button>
        </div>
      </div>
    </div>
  );
}
