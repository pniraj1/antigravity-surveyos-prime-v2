'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { RowIssue } from '@/lib/calculations/estimate-floor';

export type RowIssueKind = 'estimate-short' | 'over-billed' | 'bill-pending';
export interface RowIssueSet { kind: RowIssueKind; rows: RowIssue[] }

const TEXT: Record<RowIssueKind, { title: (n: number) => string; hint: string }> = {
  'estimate-short': {
    title: (n) => `${n} item${n === 1 ? ' has an estimate' : 's have estimates'} lower than the assessed amount`,
    hint: 'In Assessment, raise the estimate or lower the assessed amount, then try again.',
  },
  'over-billed': {
    title: (n) => `${n} item${n === 1 ? ' is' : 's are'} allowed above the billed amount`,
    hint: 'In Bill Check, lower the Allowed amount to the bill or below, then try again.',
  },
  'bill-pending': {
    title: (n) => `${n} item${n === 1 ? ' has' : 's have'} no billed amount`,
    hint: 'In Bill Check, enter the billed amount, mark it Not in Bill, or disallow it.',
  },
};

/** One-line wording for the OIC export dialog's inline alert. */
export function rowIssueSummary({ kind, rows }: RowIssueSet): string {
  const names = rows.slice(0, 3).map((r) => r.particulars || 'Item').join(', ') + (rows.length > 3 ? '…' : '');
  return `${TEXT[kind].title(rows.length)} (${names}). ${TEXT[kind].hint}`;
}

/** Holds a print or export until the listed rows are corrected. */
export function EstimateShortDialog({ issues, onClose }: { issues: RowIssueSet; onClose: () => void }) {
  const { title, hint } = TEXT[issues.kind];
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div role="alertdialog" aria-labelledby="estimate-short-title" className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-2xl bg-card border border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h2 id="estimate-short-title" className="text-sm font-medium text-foreground">
                {title(issues.rows.length)}
              </h2>
              <p className="text-xs mt-1 text-muted-foreground">{hint}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <ul className="max-h-48 overflow-y-auto text-xs flex flex-col gap-1">
          {issues.rows.map((r) => (
            <li key={r.rowId} className="flex justify-between gap-3 px-3 py-2 rounded-lg bg-neutral-50">
              <span className="truncate text-foreground">{r.particulars || 'Item'}</span>
              <span className="flex-shrink-0 text-muted-foreground">{r.detail}</span>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground">
          Go back and edit
        </button>
      </div>
    </div>
  );
}
