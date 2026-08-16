'use client';

import React from 'react';
import { FilePlus2, RefreshCw, X, Layers } from 'lucide-react';
import type { EstimateApplyMode } from '@/stores/slices/aiDataSlice';

interface EstimateModeDialogProps {
  fileLabel: string;
  /** Rows already on the assessment sheet. */
  rowCount: number;
  /** Sum of `estimated` across those rows. */
  total: number;
  onChoose: (mode: EstimateApplyMode) => void;
  onCancel: () => void;
}

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/**
 * Asked BEFORE the document is read, so a wrong file costs nothing.
 *
 * Only the claim side can be quantified here — the document has not been
 * extracted yet. That is the deliberate trade for not billing an AI call the
 * surveyor may cancel.
 */
export function EstimateModeDialog({
  fileLabel,
  rowCount,
  total,
  onChoose,
  onCancel,
}: EstimateModeDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in duration-200 bg-card border border-border">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-status-info-tint, rgba(59,130,246,0.1))' }}
          >
            <Layers size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">
              This claim already has an assessment
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              <span className="font-medium text-foreground">{rowCount}</span>{' '}
              {rowCount === 1 ? 'line' : 'lines'} on the sheet, totalling{' '}
              <span className="font-medium text-foreground">₹{INR.format(total)}</span>.
              <br />
              What is{' '}
              <span className="font-medium text-foreground">&ldquo;{fileLabel}&rdquo;</span>?
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onChoose('append')}
            className="w-full flex items-start gap-3 p-3 rounded-xl text-left bg-primary text-primary-foreground transition-all hover:scale-[1.01]"
          >
            <FilePlus2 size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              <span className="block text-xs font-medium">A supplementary estimate</span>
              <span className="block text-[11px] opacity-80 mt-0.5">
                Its items are added below the existing ones. Nothing is removed.
              </span>
            </span>
          </button>

          <button
            onClick={() => onChoose('replace')}
            className="w-full flex items-start gap-3 p-3 rounded-xl text-left border transition-all hover:bg-muted"
            style={{
              borderColor: 'var(--color-status-warning, #f59e0b)',
              color: 'var(--color-status-warning, #b45309)',
            }}
          >
            <RefreshCw size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              <span className="block text-xs font-medium">
                The same estimate again — read it fresh
              </span>
              <span className="block text-[11px] opacity-80 mt-0.5">
                Replaces the lines this estimate created. Hand-added and
                supplementary lines are kept.
              </span>
            </span>
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
