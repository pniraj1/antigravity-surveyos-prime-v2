'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { applyToClaims, withCourieredAt } from '@/lib/claims/dispatch';

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Bar above the claims table: set one courier date on every selected claim. */
export function CourierBatchBar({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [date, setDate] = useState(localToday);
  const [busy, setBusy] = useState(false);
  if (ids.length === 0) return null;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);

  const run = async () => {
    if (!validDate || busy) return;
    setBusy(true);
    try {
      const saved = await applyToClaims(ids, (c) => withCourieredAt(c, date));
      toast.success(`${saved} ${saved === 1 ? 'claim' : 'claims'} marked couriered on ${date}`);
      onDone();
    } catch {
      toast.error("Couldn't mark the claims couriered — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-6 py-2 flex items-center gap-3 text-xs border-b border-border bg-[var(--color-neutral-50)]">
      <span className="font-medium text-[var(--color-neutral-900)]">{ids.length} selected</span>
      <input
        type="date"
        aria-label="Couriered on"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="text-[11px] bg-transparent border border-border rounded px-1 py-0.5"
      />
      <button
        type="button"
        disabled={busy || !validDate}
        onClick={run}
        className="px-3 py-1 rounded-lg font-medium bg-[var(--color-neutral-900)] text-primary disabled:opacity-50"
      >
        Mark couriered
      </button>
    </div>
  );
}
