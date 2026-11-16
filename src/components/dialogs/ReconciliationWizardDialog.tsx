'use client';

import React from 'react';
import { X, Sparkles, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClaimStore } from '@/stores/claim-store';
import { BillCheckStepper } from '@/components/tabs/bill-check/BillCheckStepper';
import { StageReviewTable } from '@/components/tabs/bill-check/StageReviewTable';
import { StageAITrigger } from '@/components/tabs/bill-check/StageAITrigger';
import { StageAuditView } from '@/components/tabs/bill-check/StageAuditView';
import type { TallyStage } from '@/stores/slices/tallySlice';
import { toast } from 'sonner';

export interface ReconciliationWizardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFinish?: () => void;
  onPrint?: (format: 'standard' | 'uiic') => void;
  stage?: TallyStage;
  claim?: any;
}

export function handleWizardKeyDown(
  e: { key: string },
  opts: { onClose: () => void; setTallyStage: (stage: 'grid') => void }
) {
  if (e.key === 'Escape') {
    opts.setTallyStage('grid');
    opts.onClose();
  }
}

export function ReconciliationWizardDialog({
  isOpen,
  onClose,
  onApplyFinish,
  onPrint,
  stage: propStage,
  claim: propClaim,
}: ReconciliationWizardDialogProps) {
  const storeClaim = useClaimStore((s) => s.currentClaim);
  const currentClaim = propClaim ?? storeClaim;
  const storeActiveStage = useClaimStore((s) => s.activeTallyStage);
  const setTallyStage = useClaimStore((s) => s.setTallyStage);

  // Google Chrome Modern Web Guidance: Escape key listener for modal dialogs.
  // Must stay above the `!isOpen` return: a hook after it crashes on open (React #310).
  React.useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      handleWizardKeyDown(e, { onClose, setTallyStage });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, setTallyStage]);

  if (!isOpen) return null;

  // If in 'grid' mode when opened, default wizard to Stage 1
  const activeStage = propStage ?? storeActiveStage;
  const stageNum = typeof activeStage === 'number' ? activeStage : 1;

  const bc = currentClaim?.billCheck;
  const billLabel = bc?.billNo ? `Bill #${bc.billNo}` : 'Workshop Bill';
  const billTotalFormatted = bc?.billTotal
    ? `₹${Math.round(bc.billTotal).toLocaleString('en-IN')}`
    : null;

  const handleNextStage = () => {
    if (stageNum < 4) {
      setTallyStage((stageNum + 1) as TallyStage);
    }
  };

  const handlePrevStage = () => {
    if (stageNum > 1) {
      setTallyStage((stageNum - 1) as TallyStage);
    }
  };

  const handleApplyFinish = () => {
    setTallyStage('grid');
    if (onApplyFinish) {
      onApplyFinish();
    } else {
      toast.success('Reconciliation applied to Assessment Grid!');
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setTallyStage('grid');
          onClose();
        }
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 lg:p-6 animate-in fade-in duration-200"
    >
      <div className="w-[98vw] max-w-6xl h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left: Document Info */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-primary flex items-center justify-center shrink-0 border border-amber-300/60">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="wizard-dialog-title" className="text-sm font-bold text-foreground">
                  Reconciliation Cockpit
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  {billLabel}
                </span>
                {billTotalFormatted && (
                  <span className="text-xs font-semibold text-muted-foreground">
                    ({billTotalFormatted})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                4-Stage surveyor-controlled matching against assessment rows.
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => {
              setTallyStage('grid');
              onClose();
            }}
            className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close reconciliation wizard"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper Bar in Header */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/40 border-b border-border shrink-0">
          <BillCheckStepper
            activeStage={stageNum}
            onStageChange={(s) => setTallyStage(s)}
          />
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-background">
          {stageNum === 1 || stageNum === 2 ? (
            // The table's own bar keeps matches and moves on; overriding it skipped the keep.
            <StageReviewTable stage={stageNum} />
          ) : stageNum === 3 ? (
            <StageAITrigger onProceedToStage4={() => setTallyStage(4)} />
          ) : (
            <StageAuditView
              onPrint={onPrint}
              onComplete={handleApplyFinish}
            />
          )}
        </div>

        {/* Bottom Sticky Navigation Footer */}
        <div className="px-6 py-3.5 bg-white dark:bg-slate-900 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-medium text-muted-foreground">
            Stage <strong className="text-foreground">{stageNum}</strong> of 4 ·{' '}
            {stageNum === 1
              ? 'Part Numbers'
              : stageNum === 2
              ? 'Name & Price Proximity'
              : stageNum === 3
              ? 'Ask AI for Ambiguous Items'
              : 'Disallowed Items & Final Tally'}
          </div>

          <div className="flex items-center gap-2">
            {stageNum > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevStage}
                className="text-xs h-9 px-3 gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} />
                Previous Stage
              </Button>
            )}

            {stageNum === 1 || stageNum === 2 ? null : stageNum < 4 ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextStage}
                  className="text-xs h-9 px-3 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Skip Stage
                </Button>
                <Button
                  size="sm"
                  onClick={handleNextStage}
                  className="bg-primary hover:bg-amber-600 text-white font-semibold text-xs h-9 px-4 gap-1.5 cursor-pointer shadow-xs"
                >
                  Next Stage
                  <ArrowRight size={14} />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleApplyFinish}
                className="bg-primary hover:bg-amber-600 text-white font-bold text-xs h-9 px-5 gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 size={15} />
                Apply to Assessment Grid &amp; Finish
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
