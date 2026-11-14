'use client';

import { useEffect, useState } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { policyCheckStatus } from '@/lib/policy/policy-check';
import { PolicyCheckCard } from './PolicyCheckCard';
import type { ClaimData } from '@/types/claim';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Amber bar (or green chip once all four are answered) that opens the policy check card.
 * `autoOpen`: pops the card up on mount while the check is unfinished, so the
 * policy is settled before the grid is worked. The print gate still blocks too.
 */
export function PolicyCheckStrip({ autoOpen = false }: { autoOpen?: boolean }) {
  const claim = useClaimStore(s => s.currentClaim);
  const [open, setOpen] = useState(false);
  const claimId = claim?.id;
  // Once per claim per visit to the tab: not on every keystroke inside the card.
  useEffect(() => {
    const c = useClaimStore.getState().currentClaim;
    if (autoOpen && c && !policyCheckStatus(c).complete) setOpen(true);
  }, [autoOpen, claimId]);
  if (!claim) return null;
  return <PolicyCheckStripView claim={claim} open={open} onToggle={() => setOpen(o => !o)} />;
}

export function PolicyDialogFooter({ complete, onDone, onLater }: { complete: boolean; onDone: () => void; onLater: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-3 border-t border-border mt-3">
      {complete ? (
        <span className="text-xs text-green-700 font-medium">All four confirmed</span>
      ) : (
        <button type="button" onClick={onLater} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Answer later (printing stays blocked)
        </button>
      )}
      <Button size="sm" onClick={onDone} disabled={!complete} className="h-8 px-4 text-xs font-medium">
        Done
      </Button>
    </div>
  );
}

// ponytail: split from the store wrapper so tests can render with a claim (renderToStaticMarkup reads zustand initial state)
export function PolicyCheckStripView({ claim, open, onToggle }: { claim: ClaimData; open: boolean; onToggle: () => void }) {
  const { answered, total, complete, warnings } = policyCheckStatus(claim);

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        {complete ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="rounded-full bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 text-xs font-medium transition-colors"
          >
            Policy checked
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1 text-xs font-medium transition-colors inline-flex items-center gap-1.5"
          >
            <span>Policy check: {answered} of {total} confirmed</span>
            {warnings.length > 0 && (
              <span className="bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded-full text-[10px] font-semibold" title={warnings.join('; ')}>
                ⚠️ {warnings.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Only the footer buttons close it while unfinished: no outside click, no Escape. */}
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && open && complete) onToggle(); }}>
        <DialogContent showCloseButton={complete} className="sm:max-w-lg bg-white text-foreground border border-border shadow-2xl p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {complete ? 'Policy Terms & Deductibles' : 'Confirm the policy before you assess'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Nil Dep, IMT 23 and Consumables decide which columns and deductions apply below. Answer all four from the policy copy.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <PolicyCheckCard />
          </div>

          <PolicyDialogFooter complete={complete} onDone={onToggle} onLater={onToggle} />
        </DialogContent>
      </Dialog>
    </>
  );
}
