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
    <div className="mb-4 shrink-0 space-y-2">
      {complete ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-medium"
        >
          Policy checked
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="w-full text-left rounded-lg bg-amber-100 text-amber-900 px-3 py-2 text-sm font-medium"
        >
          Policy check: {answered} of {total} confirmed
        </button>
      )}
      {warnings.length > 0 && !open && (
        <ul className="list-disc pl-5 text-xs text-amber-800">
          {warnings.map(w => <li key={w}>{w}</li>)}
        </ul>
      )}
      {open && <PolicyCheckCard />}
    </div>
  );
}
