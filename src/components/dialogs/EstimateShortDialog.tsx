'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { EstimateShort } from '@/lib/calculations/estimate-floor';

const rs = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Holds a print or export: the estimate may not be lower than assessed / allowed / billed. */
export function EstimateShortDialog({ rows, onClose }: { rows: EstimateShort[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div role="alertdialog" aria-labelledby="estimate-short-title" className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-2xl bg-card border border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-status-error flex-shrink-0 mt-0.5" />
            <div>
              <h2 id="estimate-short-title" className="text-sm font-medium text-foreground">
                {rows.length} item{rows.length === 1 ? ' has an estimate' : 's have estimates'} lower than the amount passed
              </h2>
              <p className="text-xs mt-1 text-muted-foreground">
                The estimate can&apos;t be lower than the assessed, allowed or billed amount. Correct the estimate in Assessment, then try again.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <ul className="max-h-48 overflow-y-auto text-xs flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.rowId} className="flex justify-between gap-3 px-3 py-2 rounded-lg bg-neutral-50">
              <span className="truncate text-foreground">{r.particulars || 'Item'}</span>
              <span className="flex-shrink-0 text-muted-foreground">
                estimate {rs(r.estimated)}, needs {rs(r.floor)}
              </span>
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
