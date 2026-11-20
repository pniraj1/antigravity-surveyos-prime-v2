'use client';

import React from 'react';
import {
  Mail,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';
import type {
  SyncProgressUpdate,
  SmartSyncResult,
} from '@/lib/reconciliation/smart-sync-service';

export interface ScanProgressModalProps {
  isOpen: boolean;
  progress: SyncProgressUpdate | null;
  result?: SmartSyncResult | null;
  onCancel: () => void;
  onClose: () => void;
}

export function ScanProgressModal({
  isOpen,
  progress,
  result,
  onCancel,
  onClose,
}: ScanProgressModalProps) {
  if (!isOpen) return null;

  const phase: SyncProgressUpdate['phase'] =
    progress?.phase ??
    (result?.cancelled ? 'cancelled' : result ? 'complete' : 'listing');

  const isComplete = phase === 'complete';
  const isCancelled = phase === 'cancelled' || result?.cancelled === true;
  const isInProgress = !isComplete && !isCancelled;

  // Percentage calculation clamped between 0% and 100%
  const isIndeterminate =
    isInProgress && (phase === 'listing' || !progress || progress.total === 0);

  const percentage = isComplete
    ? 100
    : progress && progress.total > 0
    ? Math.min(Math.max(Math.round((progress.current / progress.total) * 100), 0), 100)
    : 0;

  // Title selection
  const title = isComplete
    ? 'Scan Complete'
    : isCancelled
    ? 'Scan Cancelled'
    : 'Scanning Gmail for Payments';

  // Subtitle / message selection
  const getPhaseMessage = (): string => {
    if (progress?.message && progress.message.trim().length > 0) {
      return progress.message;
    }
    if (isComplete) {
      return 'All payment intimations have been analyzed and matched.';
    }
    if (isCancelled) {
      return 'Scan was cancelled. Any identified records remain saved.';
    }
    switch (phase) {
      case 'listing':
        return 'Querying Gmail for payment intimation emails...';
      case 'filtering':
        return 'Checking local cache & skipping settled claims...';
      case 'processing':
        return 'Extracting payment vouchers and line items...';
      case 'matching':
        return 'Matching payment line items to active claims...';
      default:
        return 'Scanning Gmail for payments...';
    }
  };

  const currentStep =
    progress?.current ?? (isComplete ? (result?.stats.totalFound ?? 0) : 0);
  const totalSteps = progress?.total ?? (result?.stats.totalFound ?? 0);

  // Live stats calculation
  const foundCount = result?.stats.totalFound ?? progress?.total ?? 0;
  const skippedCount = result?.stats.skippedSettled ?? 0;
  const cachedCount = result?.stats.cachedReused ?? 0;
  const parsedCount = result?.stats.newlyParsed ?? 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-progress-title"
      className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isComplete
                  ? 'bg-emerald-50 border border-emerald-100 text-emerald-600'
                  : isCancelled
                  ? 'bg-neutral-100 border border-neutral-200 text-neutral-500'
                  : 'bg-amber-50 border border-amber-200 text-amber-600'
              }`}
              data-testid="modal-icon"
            >
              {isComplete ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isCancelled ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <Mail className="w-5 h-5 animate-pulse" />
              )}
            </div>
            <div>
              <h2
                id="scan-progress-title"
                className="text-base font-semibold text-neutral-900 leading-tight"
                data-testid="scan-title"
              >
                {title}
              </h2>
              <p
                className="text-xs text-neutral-500 mt-1 leading-snug"
                data-testid="scan-message"
              >
                {getPhaseMessage()}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={isInProgress ? onCancel : onClose}
            aria-label="Close"
            className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg hover:bg-neutral-100 transition-colors"
            title={isInProgress ? 'Cancel Scan' : 'Close'}
            data-testid="modal-close-icon-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5" data-testid="progress-container">
          <div className="flex items-center justify-between text-xs">
            <span
              className="font-semibold text-neutral-800 font-mono"
              data-testid="progress-percentage"
            >
              {percentage}%
            </span>
            <span
              className="text-neutral-500 font-mono text-xs"
              data-testid="progress-step-counter"
            >
              {isIndeterminate && totalSteps === 0
                ? '0 of 0'
                : `${currentStep} of ${totalSteps}`}
            </span>
          </div>

          <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
            <div
              data-testid="progress-bar-fill"
              className={`h-2 rounded-full transition-all duration-300 ${
                isCancelled ? 'bg-neutral-400' : 'bg-amber-500'
              } ${isIndeterminate ? 'w-full animate-pulse' : ''}`}
              style={{ width: isIndeterminate ? '100%' : `${percentage}%` }}
            />
          </div>
        </div>

        {/* Live Stats Strip */}
        <div
          className="grid grid-cols-4 gap-2 text-center"
          data-testid="live-stats-strip"
        >
          {/* Found */}
          <div
            className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-100 flex flex-col items-center justify-center"
            data-testid="stat-found"
          >
            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              Found
            </span>
            <span
              className="text-base font-bold text-neutral-800 mt-0.5"
              data-testid="stat-found-count"
            >
              {foundCount}
            </span>
          </div>

          {/* Skipped */}
          <div
            className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-100 flex flex-col items-center justify-center"
            data-testid="stat-skipped"
          >
            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              Skipped
            </span>
            <span
              className="text-base font-bold text-neutral-600 mt-0.5"
              data-testid="stat-skipped-count"
            >
              {skippedCount}
            </span>
            <span className="text-[9px] text-neutral-400">Settled</span>
          </div>

          {/* Cache Reused */}
          <div
            className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-100 flex flex-col items-center justify-center"
            data-testid="stat-cached"
          >
            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              Cache Reused
            </span>
            <span
              className="text-base font-bold text-amber-600 mt-0.5"
              data-testid="stat-cached-count"
            >
              {cachedCount}
            </span>
            <span className="text-[9px] text-neutral-400">Cached</span>
          </div>

          {/* AI Parsed */}
          <div
            className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-100 flex flex-col items-center justify-center"
            data-testid="stat-parsed"
          >
            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              AI Parsed
            </span>
            <span
              className="text-base font-bold text-neutral-800 mt-0.5"
              data-testid="stat-parsed-count"
            >
              {parsedCount}
            </span>
            <span className="text-[9px] text-neutral-400">Parsed</span>
          </div>
        </div>

        {/* Completion or Cancellation Banner */}
        {isComplete && result && (
          <div
            className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-800 flex items-center justify-between"
            data-testid="complete-summary-banner"
          >
            <span className="font-medium">Vouchers Matched to Claims</span>
            <span
              className="font-bold text-emerald-700 font-mono text-sm"
              data-testid="stat-matches-count"
            >
              {result.stats.matchesCount ?? 0}
            </span>
          </div>
        )}

        {isCancelled && (
          <div
            className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 text-center"
            data-testid="cancelled-summary-banner"
          >
            Scan stopped. Identified vouchers remain in your cache.
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
          {isInProgress ? (
            <button
              type="button"
              onClick={onCancel}
              data-testid="cancel-scan-button"
              className="border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel Scan
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              data-testid="done-scan-button"
              className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-5 py-2 rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
            >
              Done / View Matches
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
