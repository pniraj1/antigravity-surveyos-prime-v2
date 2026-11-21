'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ClaimSlice } from '@/stores/slices/claimSlice';
import { applyToClaims, withCourieredAt, withPortalUploaded } from '@/lib/claims/dispatch';

export type ClaimsListItem = ClaimSlice['claimsList'][number];

const validDate = (v: string) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000);

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Dashboard row cell: next-step label, courier date and portal tick. */
export function ClaimRowProgress({ claim, readOnly }: { claim: ClaimsListItem; readOnly: boolean }) {
  const { progress } = claim;
  const [date, setDate] = useState(claim.courieredAt ?? '');
  const [portal, setPortal] = useState(!!claim.portalUploadedAt);
  const savedDate = useRef(claim.courieredAt ?? '');
  useEffect(() => { setDate(claim.courieredAt ?? ''); savedDate.current = claim.courieredAt ?? ''; }, [claim.courieredAt]);
  useEffect(() => { setPortal(!!claim.portalUploadedAt); }, [claim.portalUploadedAt]);

  const saveDate = (value: string) => {
    if (!validDate(value) || value === savedDate.current) return;
    const prev = savedDate.current;
    savedDate.current = value;
    applyToClaims([claim.id], (c) => withCourieredAt(c, value)).catch(() => {
      savedDate.current = prev;
      setDate(prev);
      toast.error("Couldn't save the courier date — try again.");
    });
  };

  const since = progress?.since
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(progress.since) ? `${progress.since}T00:00` : progress.since).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : '';

  return (
    <div className="flex flex-col gap-1 min-w-0 text-[11px]">
      {claim.isCompleted ? (
        <span className="font-medium text-[var(--color-status-success)]">Done</span>
      ) : progress ? (
        <span className="truncate text-[var(--color-neutral-900)]">
          {progress.label ?? 'All steps done'}
          {since && <span className="text-muted-foreground"> · since {since}</span>}
          <span className="text-muted-foreground"> · {progress.done} of {progress.total}</span>
        </span>
      ) : null}
      {claim.heldNote && <span className="truncate text-muted-foreground">{claim.heldNote}</span>}
      {!readOnly && (
        <div className="flex items-center gap-2" onClick={stop}>
          <input
            type="date"
            title="Couriered on"
            aria-label="Couriered on"
            value={date}
            onClick={stop}
            onChange={(e) => { setDate(e.target.value); saveDate(e.target.value); }}
            onBlur={() => saveDate(date)}
            className="w-[104px] text-[10px] bg-transparent border border-border rounded px-1 py-0.5"
          />
          <label className="inline-flex items-center gap-1 text-muted-foreground" onClick={stop}>
            <input
              type="checkbox"
              checked={portal}
              onClick={stop}
              onChange={(e) => {
                const checked = e.target.checked;
                setPortal(checked);
                applyToClaims([claim.id], (c) => withPortalUploaded(c, checked, new Date().toISOString())).catch(() => {
                  setPortal(!checked);
                  toast.error("Couldn't save the portal tick — try again.");
                });
              }}
            />
            Portal
          </label>
        </div>
      )}
    </div>
  );
}
