'use client';

import React from 'react';
import { FileCheck2, Files, X } from 'lucide-react';

interface AllowanceScopeDialogProps {
  /** The figure assessed at final survey. */
  assessed: number;
  /** The figure the surveyor just typed. */
  proposed: number;
  onChoose: (scope: 'bill-check' | 'both') => void;
  onCancel: () => void;
}

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/**
 * Asked when an Assessed edit in Bill Check diverges from the assessed figure.
 *
 * Both grids write one assessmentRows array and nothing snapshots an issued
 * report, so writing `assessed` here silently rewrites a Final Survey Report
 * that may already be with the insurer. This makes that reach a choice.
 */
export function AllowanceScopeDialog({
  assessed,
  proposed,
  onChoose,
  onCancel,
}: AllowanceScopeDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in duration-200 bg-card border border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-foreground">
              Allow ₹{INR.format(proposed)} against an assessment of ₹{INR.format(assessed)}?
            </h2>
            <p className="text-xs mt-1 text-muted-foreground">
              How far should this change reach?
            </p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground" aria-label="Cancel">
            <X size={16} />
          </button>
        </div>

        <button
          onClick={() => onChoose('bill-check')}
          className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-primary text-left transition-colors"
        >
          <FileCheck2 size={18} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-foreground">Bill Check only</div>
            <div className="text-xs mt-0.5 text-muted-foreground">
              The Final Survey Report keeps showing ₹{INR.format(assessed)}. Use this when you are
              allowing the workshop&apos;s figure, not revising your assessment.
            </div>
          </div>
        </button>

        <button
          onClick={() => onChoose('both')}
          className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-status-danger text-left transition-colors"
        >
          <Files size={18} className="text-status-danger flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-foreground">Both reports</div>
            <div className="text-xs mt-0.5 text-muted-foreground">
              Changes the assessment itself. The Final Survey Report will reprint at
              ₹{INR.format(proposed)} — <strong>including a copy already sent to the insurer</strong>.
              Correct when a supplementary estimate revised the assessment.
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
