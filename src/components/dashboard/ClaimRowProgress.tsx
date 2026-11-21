'use client';

import React from 'react';
import type { ClaimSlice } from '@/stores/slices/claimSlice';
import { applyToClaims, withCourieredAt, withPortalUploaded } from '@/lib/claims/dispatch';

export type ClaimsListItem = ClaimSlice['claimsList'][number];

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Dashboard row cell: next-step label, courier date and portal tick. */
export function ClaimRowProgress({ claim, readOnly }: { claim: ClaimsListItem; readOnly: boolean }) {
  const { progress } = claim;
  const since = progress?.since
    ? new Date(progress.since).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
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
            value={claim.courieredAt ?? ''}
            onClick={stop}
            onChange={(e) => {
              const value = e.target.value;
              void applyToClaims([claim.id], (c) => withCourieredAt(c, value));
            }}
            className="w-[104px] text-[10px] bg-transparent border border-border rounded px-1 py-0.5"
          />
          <label className="inline-flex items-center gap-1 text-muted-foreground" onClick={stop}>
            <input
              type="checkbox"
              checked={!!claim.portalUploadedAt}
              onClick={stop}
              onChange={(e) => {
                const checked = e.target.checked;
                void applyToClaims([claim.id], (c) => withPortalUploaded(c, checked, new Date().toISOString()));
              }}
            />
            Portal
          </label>
        </div>
      )}
    </div>
  );
}
