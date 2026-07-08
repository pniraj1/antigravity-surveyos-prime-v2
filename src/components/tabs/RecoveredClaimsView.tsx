'use client';

import { useEffect, useState } from 'react';
import { getRecoveredClaims, type RecoveredClaim } from '@/lib/storage/indexeddb';
import { Archive, Clock } from 'lucide-react';

export function RecoveredClaimsView() {
  const [items, setItems] = useState<RecoveredClaim[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { getRecoveredClaims().then(setItems); }, []);

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No recovered copies. This list only fills if an unsynced edit was ever
        superseded by a newer version from another device.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3 max-w-3xl mx-auto">
      <h2 className="text-lg font-medium text-foreground">Recovered copies</h2>
      {items.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
          <button
            onClick={() => setOpenId(openId === r.id ? null : r.id)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Archive size={16} /> {r.reportNo || r.claimId}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock size={12} /> {new Date(r.supersededAt).toLocaleString()}
            </span>
          </button>
          {openId === r.id && (
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-[var(--color-neutral-50)] p-3 text-[11px] text-foreground">
              {JSON.stringify(r.claim, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
