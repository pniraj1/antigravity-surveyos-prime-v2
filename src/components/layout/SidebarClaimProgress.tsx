'use client';

import { useEffect, useState } from 'react';
import type { ClaimData } from '@/types/claim';
import { useClaimStore } from '@/stores/claim-store';
import { progressSummary } from '@/lib/claims/dispatch';
import { sinceLabel } from '@/components/dashboard/ClaimRowProgress';

const ASK = 'Why is this claim waiting?';

/** Waiting line and hold note under the sidebar claim badge. Hidden once every step is done. */
export function SidebarClaimProgress({ claim }: { claim: ClaimData }) {
  const p = progressSummary(claim);
  const saved = claim.heldNote ?? '';
  const [note, setNote] = useState(saved);
  useEffect(() => { setNote(saved); }, [saved, claim.id]);

  if (!p.label) return null;
  const since = sinceLabel(p.since);

  const save = () => {
    const next = note.trim();
    if (next === saved) return;
    useClaimStore.getState().updateClaim({ heldNote: next || undefined });
  };

  return (
    <div className="mt-2 pl-1 space-y-1.5">
      <div className="text-[11px] text-[var(--color-neutral-600)]">
        {p.label}
        {since && ` · since ${since}`}
        {` · ${p.done} of ${p.total}`}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={save}
        aria-label={ASK}
        placeholder={ASK}
        className="w-full text-[11px] bg-transparent border border-[var(--color-neutral-200)] rounded px-1.5 py-1"
      />
    </div>
  );
}
