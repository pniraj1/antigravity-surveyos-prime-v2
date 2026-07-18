'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { getAllClaims, getAllPushedAt } from '@/lib/storage/indexeddb';
import { countUnsynced } from '@/lib/firebase/sync-guard';

// A claim mid-edit and not yet pushed is normal, expected state, not a
// problem — only a backlog past this size suggests something actually
// needs attention (e.g. sync has been failing for a while).
const WARNING_THRESHOLD = 5;

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
  const backlogged = pending > WARNING_THRESHOLD;
  const toneClass = synced
    ? 'bg-[var(--color-status-success-tint)] text-[var(--color-status-success)]'
    : backlogged
      ? 'bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)]'
      : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]';
  return (
    <span
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium uppercase tracking-wide ${toneClass}`}
      title={synced ? 'All claims saved to the cloud' : `${pending} change(s) not yet in the cloud`}
    >
      {synced ? <Cloud size={12} /> : <CloudOff size={12} />}
      {synced ? 'All saved to cloud' : `${pending} not in cloud`}
    </span>
  );
}
