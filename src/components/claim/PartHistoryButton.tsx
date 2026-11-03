'use client';

import React from 'react';
import { History } from 'lucide-react';
import { toast } from 'sonner';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { getAllClaims, getClaim, saveClaim } from '@/lib/storage/indexeddb';
import { claimLandingTab } from '@/lib/claims/landing-tab';
import { isNarrowViewport } from '@/lib/navigation/viewport';
import { partHistory, type PartHistoryEntry } from '@/lib/claims/part-history';
import { formatCurrency, formatDateDMY } from '@/lib/calculations/utils';
import type { AssessmentRow } from '@/types';

const PAGE = 5;
const WIDTH = 360;

interface PartHistoryButtonProps {
  row: AssessmentRow;
}

/**
 * Clock icon on an assessment row: the surveyor's own past figures for this
 * part on this model. Opens only on click and never touches the row.
 */
export function PartHistoryButton({ row }: PartHistoryButtonProps) {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const [entries, setEntries] = React.useState<PartHistoryEntry[] | null>(null);
  const [shown, setShown] = React.useState(PAGE);
  const popRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setPos(null), []);

  React.useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) close();
    };
    // Fixed position: follow-the-row on scroll is not worth the code, so just close.
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close, true);
    };
  }, [pos, close]);

  const open = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8));
    setPos({ top: r.bottom + 4, left });
    setEntries(null);
    setShown(PAGE);
    const current = useClaimStore.getState().currentClaim;
    if (!current) return;
    try {
      setEntries(partHistory(await getAllClaims(), current, row));
    } catch {
      setEntries([]);
      toast.error('Could not read past claims.');
    }
  };

  const openClaim = async (id: string) => {
    try {
      // Save first so nothing typed on this claim in the last instant is lost.
      const current = useClaimStore.getState().currentClaim;
      if (current) await saveClaim(current);
      const full = await getClaim(id);
      if (!full) {
        toast.error('Could not open this claim.');
        return;
      }
      useClaimStore.getState().loadClaim(full);
      useUIStore.getState().setActiveTab(claimLandingTab(full.surveyType, isNarrowViewport()));
    } catch {
      toast.error('Could not open this claim.');
    }
  };

  const model = useClaimStore((s) => s.currentClaim?.vehicle?.model) || 'this model';

  return (
    <>
      <button
        type="button"
        onClick={open}
        title="Past prices for this part"
        aria-label="Past prices for this part"
        className="shrink-0 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
      >
        <History size={12} />
      </button>
      {pos && (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Past prices"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: WIDTH }}
          className="z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-3 text-xs"
        >
          <div className="font-semibold mb-2">
            {row.particulars || 'This part'} · {model}
            {entries && entries.length > 0 && (
              <span className="font-normal text-muted-foreground"> · your last {entries.length}</span>
            )}
          </div>
          {entries === null && <div className="text-muted-foreground">Looking…</div>}
          {entries?.length === 0 && (
            <div className="text-muted-foreground">No past claims for this part on {model}.</div>
          )}
          {entries && entries.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-normal pb-1">Date</th>
                  <th className="text-left font-normal pb-1">Workshop</th>
                  <th className="text-right font-normal pb-1">Est.</th>
                  <th className="text-right font-normal pb-1">Assessed</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, shown).map((e, i) => (
                  <tr
                    key={`${e.claimId}-${i}`}
                    onClick={() => openClaim(e.claimId)}
                    title={`Open ${e.reportNo || 'claim'} · ${e.particulars}`}
                    className="cursor-pointer hover:bg-accent/40 border-t border-border/50"
                  >
                    <td className="py-1 pr-2 whitespace-nowrap">{formatDateDMY(e.date)}</td>
                    <td className="py-1 pr-2 truncate max-w-[130px]">{e.workshop || '—'}</td>
                    <td className="py-1 text-right tabular-nums">{formatCurrency(e.estimated)}</td>
                    <td className="py-1 text-right tabular-nums font-semibold">
                      {e.disallowed ? <span className="text-muted-foreground font-normal">Disallowed</span> : formatCurrency(e.assessed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {entries && entries.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="mt-2 text-primary hover:underline">
              Show more ({entries.length - shown})
            </button>
          )}
          {entries && entries.length > 0 && (
            <div className="mt-2 text-muted-foreground">Click a row to open that claim</div>
          )}
        </div>
      )}
    </>
  );
}
