'use client';

import { useState } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { policyCheckStatus } from '@/lib/policy/policy-check';
import { PolicyCheckCard } from './PolicyCheckCard';
import type { ClaimData } from '@/types/claim';

/** Amber bar (or green chip once all four are answered) that opens the policy check card. */
export function PolicyCheckStrip() {
  const claim = useClaimStore(s => s.currentClaim);
  const [open, setOpen] = useState(false);
  if (!claim) return null;
  return <PolicyCheckStripView claim={claim} open={open} onToggle={() => setOpen(o => !o)} />;
}

// ponytail: split from the store wrapper so tests can render with a claim (renderToStaticMarkup reads zustand initial state)
export function PolicyCheckStripView({ claim, open, onToggle }: { claim: ClaimData; open: boolean; onToggle: () => void }) {
  const { answered, total, complete, warnings } = policyCheckStatus(claim);

  return (
    <div className="relative inline-block shrink-0">
      <div className="flex items-center gap-2">
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
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 w-[420px] max-w-[90vw] shadow-2xl rounded-xl bg-card border border-border p-2 animate-in fade-in-50 zoom-in-95">
          <PolicyCheckCard />
        </div>
      )}
    </div>
  );
}
