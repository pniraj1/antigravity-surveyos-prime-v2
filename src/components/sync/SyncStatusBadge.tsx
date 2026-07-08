'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { getAllClaims, getAllPushedAt } from '@/lib/storage/indexeddb';
import { countUnsynced } from '@/lib/firebase/sync-guard';

export function SyncStatusBadge() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const [claims, pushed] = await Promise.all([getAllClaims(), getAllPushedAt()]);
      if (alive) setPending(countUnsynced(claims, pushed));
    };
    refresh();
    const channel = new BroadcastChannel('surveyos_claims_sync');
    channel.onmessage = () => refresh();
    const interval = setInterval(refresh, 15000);
    return () => { alive = false; channel.close(); clearInterval(interval); };
  }, []);

  const synced = pending === 0;
  return (
    <span
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium uppercase tracking-wide ${
        synced
          ? 'bg-[var(--color-status-success-tint)] text-[var(--color-status-success)]'
          : 'bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)]'
      }`}
      title={synced ? 'All claims saved to the cloud' : `${pending} change(s) not yet in the cloud`}
    >
      {synced ? <Cloud size={12} /> : <CloudOff size={12} />}
      {synced ? 'All saved to cloud' : `${pending} not in cloud`}
    </span>
  );
}
