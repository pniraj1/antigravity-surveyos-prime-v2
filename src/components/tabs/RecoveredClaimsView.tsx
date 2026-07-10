'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getRecoveredClaims,
  getClaim,
  saveClaim,
  addRecoveredClaim,
  type RecoveredClaim,
} from '@/lib/storage/indexeddb';
import { restoreRecoveredClaim, summarizeClaim, type ClaimSummary } from '@/lib/recovery/restoreClaim';
import { useClaimStore } from '@/stores/claim-store';
import type { ClaimData } from '@/types';
import { Archive, Clock, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';

/** Counts that let a surveyor tell two copies of the same report apart. */
function WorkSummary({ s }: { s: ClaimSummary }) {
  const items: [string, string | number][] = [
    ['Vehicle', s.vehicleNo],
    ['Insured', s.insuredName],
    ['Assessment items', s.assessmentRows],
    ['Damage items', s.spotDamageRows],
    ['Photos', s.photos],
    ['Last edited', new Date(s.updatedAt).toLocaleString()],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-foreground font-medium truncate">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RecoveredClaimsView() {
  const [items, setItems] = useState<RecoveredClaim[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [live, setLive] = useState<ClaimData | undefined>(undefined);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadClaim = useClaimStore((s) => s.loadClaim);

  useEffect(() => {
    getRecoveredClaims()
      .then((r) => { setItems(r); setLoadError(null); })
      // Never let a failed read look like "you have no recovered copies" —
      // that tells a surveyor his work is gone when it is still on disk.
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Load the claim currently in the slot so the surveyor can compare before restoring.
  useEffect(() => {
    const rec = items.find((r) => r.id === openId);
    if (!rec) { setLive(undefined); return; }
    getClaim(rec.claimId).then(setLive);
  }, [openId, items]);

  const handleRestore = async (rec: RecoveredClaim) => {
    setBusy(true);
    try {
      const restored = await restoreRecoveredClaim(rec.claim, { getClaim, saveClaim, addRecoveredClaim });
      loadClaim(restored);
      setItems(await getRecoveredClaims()); // the replaced copy is now stashed too
      setConfirmId(null);
      toast.success(
        `Restored "${restored.reportNo || restored.id}". The copy it replaced was saved here as well.`,
        { duration: 6000 },
      );
    } catch (err) {
      toast.error(`Restore failed — nothing was changed. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-[var(--color-status-danger)] p-6 text-center">
        <AlertTriangle size={20} className="mx-auto mb-2 text-[var(--color-status-danger)]" />
        <p className="text-sm font-medium text-foreground">
          Could not read your recovered copies.
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          This does <strong>not</strong> mean they are gone — they are stored on this
          device. Do not clear your browser data. Reload the page, and contact support
          if this persists.
        </p>
        <pre className="mt-3 overflow-auto text-left text-[10px] text-muted-foreground">{loadError}</pre>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No recovered copies. A copy is kept here whenever a save to the cloud is
        refused, so your work is never lost.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3 max-w-3xl mx-auto">
      <h2 className="text-lg font-medium text-foreground">Recovered copies</h2>
      <p className="text-[11px] text-muted-foreground">
        These are snapshots of your work that could not be saved to the cloud.
        Open one to compare it with the report as it stands now, then restore it.
        Restoring never deletes anything — the copy being replaced is kept here too.
      </p>

      {items.map((r) => {
        const snap = summarizeClaim(r.claim);
        const isOpen = openId === r.id;
        return (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <button
              onClick={() => { setOpenId(isOpen ? null : r.id); setConfirmId(null); }}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Archive size={16} /> {snap.reportNo}
                <span className="text-[10px] font-normal text-muted-foreground">
                  {snap.assessmentRows} items · {snap.photos} photos
                </span>
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock size={12} /> {new Date(r.supersededAt).toLocaleString()}
              </span>
            </button>

            {isOpen && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-status-success)]">
                      This recovered copy
                    </p>
                    <WorkSummary s={snap} />
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {live ? 'Currently in the app' : 'Not in the app (deleted)'}
                    </p>
                    {live
                      ? <WorkSummary s={summarizeClaim(live)} />
                      : <p className="text-[11px] text-muted-foreground">Restoring will bring this report back.</p>}
                  </div>
                </div>

                {confirmId === r.id ? (
                  <div className="rounded-lg border border-[var(--color-status-warning)] bg-[var(--color-status-warning-tint)] p-3">
                    <p className="flex items-center gap-2 text-[11px] font-medium text-foreground">
                      <AlertTriangle size={13} /> Replace the report currently in the app with this copy?
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      The current version will be kept in this list, so you can undo this.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        disabled={busy}
                        onClick={() => handleRestore(r)}
                        className="flex items-center gap-1.5 rounded-lg bg-[var(--color-status-success)] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                        Yes, restore this copy
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-[11px] text-muted-foreground disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(r.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-white"
                  >
                    <RotateCcw size={12} /> Restore this copy
                  </button>
                )}

                <details>
                  <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-muted-foreground">
                    Raw data (for support)
                  </summary>
                  <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-[var(--color-neutral-50)] p-3 text-[11px] text-foreground">
                    {JSON.stringify(r.claim, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
