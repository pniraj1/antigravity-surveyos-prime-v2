'use client';

import { useEffect, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { getDriveQueueCount } from '@/lib/storage/indexeddb';
import { flushDriveQueue } from '@/lib/drive';
import { DRIVE_QUEUE_EVENT } from '@/lib/drive/queue-events';

/** Persistent count of photos/files still waiting for Drive. Hidden at zero. */
export function DriveQueueChip() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      getDriveQueueCount().then((n) => { if (alive) setCount(n); }).catch(() => {});
    };
    refresh();
    window.addEventListener(DRIVE_QUEUE_EVENT, refresh);
    window.addEventListener('online', refresh);
    return () => {
      alive = false;
      window.removeEventListener(DRIVE_QUEUE_EVENT, refresh);
      window.removeEventListener('online', refresh);
    };
  }, []);

  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={() => { void flushDriveQueue().catch(() => {}); }}
      className="flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-lg text-[10px] font-medium uppercase tracking-wide bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)]"
      title="Tap to retry now. Uploads also resume on their own when signal returns."
    >
      <UploadCloud size={12} />
      {count} waiting to upload
    </button>
  );
}
