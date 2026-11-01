'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, RefreshCw } from 'lucide-react';
import type { ClaimData } from '@/types';
import { getAllClaims, saveClaim } from '@/lib/storage/indexeddb';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cleanupTargets, groupForCleanup, loadCleanupLookup, trashFolder } from '@/lib/drive/cleanup';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
type Lookup = Awaited<ReturnType<typeof loadCleanupLookup>>;

export function DriveCleanupSection() {
  const connected = useUIStore(s => s.isDriveConnected);
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [lookup, setLookup] = useState<Lookup>({ index: {}, scanFolders: {} });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const done = (await getAllClaims()).filter(c => c.completedAt && !c.driveTrashedAt);
      setClaims(done);
      setLookup(await loadCleanupLookup(done));
      setPicked(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load completed claims');
    } finally { setLoading(false); }
  }, [connected]);
  useEffect(() => { load(); }, [load]);

  const years = useMemo(() => groupForCleanup(claims), [claims]);
  const toggle = (ids: string[], on: boolean) =>
    setPicked(p => { const n = new Set(p); ids.forEach(i => (on ? n.add(i) : n.delete(i))); return n; });
  const close = () => { setStep(0); setTyped(''); };

  const run = async () => {
    setBusy(true);
    let ok = 0, failed = 0;
    for (const c of claims.filter(x => picked.has(x.id))) {
      const t = cleanupTargets(c, lookup.index, lookup.scanFolders);
      try {
        for (const id of [t.prime, t.scan]) if (id) await trashFolder(id);
        const at = new Date().toISOString();
        const open = useClaimStore.getState();
        if (open.currentClaim?.id === c.id) open.updateClaim({ driveTrashedAt: at });
        else await saveClaim({ ...c, driveTrashedAt: at });
        ok++;
      } catch { failed++; }
    }
    setBusy(false); close();
    const msg = `${ok} claim${ok === 1 ? '' : 's'} moved to Drive trash${failed ? `, ${failed} failed (try again)` : ''}.`;
    if (failed) toast.error(msg); else toast.success(msg);
    await load();
  };

  if (!connected) return null;
  const n = picked.size;
  const found = (id: string | null) => (id ? 'found' : 'not on Drive');

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border">
      <div className="px-6 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Trash2 size={14} className="text-primary" />
          <span className="text-sm font-medium text-foreground">Drive cleanup</span>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Move completed claims&apos; Drive folders (Prime and Scan) to the Drive trash. They stay recoverable there for about 30 days. The claims stay in Prime.
        </p>
        {years.length === 0 && <p className="text-xs text-muted-foreground">{loading ? 'Looking...' : 'No completed claims to clean up.'}</p>}
        {years.map(y => {
          const ids = y.months.flatMap(m => m.claims.map(c => c.id));
          return (
            <div key={y.year} className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={ids.every(i => picked.has(i))} onChange={e => toggle(ids, e.target.checked)} />
                {y.year} <span className="text-xs text-muted-foreground">({ids.length})</span>
              </label>
              {y.months.map(m => (
                <div key={m.month} className="ml-6 space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{MONTHS[m.month]}</div>
                  {m.claims.map(c => {
                    const t = cleanupTargets(c, lookup.index, lookup.scanFolders);
                    return (
                      <label key={c.id} className="flex items-start gap-2 text-xs">
                        <input type="checkbox" className="mt-0.5" checked={picked.has(c.id)} onChange={e => toggle([c.id], e.target.checked)} />
                        <span>
                          <span className="font-medium text-foreground">{c.vehicle?.registrationNumber || c.id}</span>
                          {c.policy?.insurerName ? ` · ${c.policy.insurerName}` : ''}
                          <span className="block text-muted-foreground">Prime folder: {found(t.prime)} · Scan folder: {c.scanClaimId ? found(t.scan) : 'no phone scan'}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">{n} selected</span>
          <Button variant="destructive" size="sm" disabled={n === 0} onClick={() => setStep(1)}>Move to Drive trash</Button>
        </div>
      </div>

      <Dialog open={step === 1} onOpenChange={o => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {n} claim{n === 1 ? '' : 's'} to Drive trash?</DialogTitle>
            <DialogDescription>Their Prime and Scan folders go to the Drive trash. You can restore them from Drive within about 30 days. Nothing is deleted from Prime.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button variant="destructive" onClick={() => setStep(2)}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={step === 2} onOpenChange={o => !o && !busy && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Type {n} to confirm</DialogTitle>
            <DialogDescription>Type the number of claims ({n}) to move them to the Drive trash.</DialogDescription>
          </DialogHeader>
          <Input inputMode="numeric" value={typed} onChange={e => setTyped(e.target.value)} placeholder={String(n)} />
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={close}>Cancel</Button>
            <Button variant="destructive" disabled={busy || typed.trim() !== String(n)} onClick={run}>{busy ? 'Moving...' : 'Move to Drive trash'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
