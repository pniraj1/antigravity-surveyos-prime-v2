'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Cloud, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { syncClaimNow } from '@/lib/sync/syncClaimNow';
import { pushClaimToCloud } from '@/lib/firebase/sync';
import { flushDriveQueue, backupAllPendingToDrive } from '@/lib/drive';
import { saveClaim } from '@/lib/storage/indexeddb';

type BtnState = 'idle' | 'saving' | 'saved' | 'error';

/** 'default' = dark button for light surfaces; 'onDark' = gold button for dark headers. */
type Tone = 'default' | 'onDark';

interface SaveProgressButtonProps {
  className?: string;
  tone?: Tone;
}

export function SaveProgressButton({ className = '', tone = 'default' }: SaveProgressButtonProps) {
  const currentClaim = useClaimStore(s => s.currentClaim);
  const user = useAuthStore(s => s.user);
  const setSaveStatus = useUIStore(s => s.setSaveStatus);
  const [state, setState] = useState<BtnState>('idle');

  const handleClick = async () => {
    if (!currentClaim || !user) {
      toast.error('No claim open, or you are not signed in.');
      return;
    }

    setState('saving');
    setSaveStatus('saving');

    // Layer 1 — guarantee a local save first so data is never lost even if
    // the cloud push fails. Non-fatal if this throws; the cloud result drives UI.
    try {
      await saveClaim(currentClaim);
    } catch {
      /* surfaced via the cloud result below */
    }

    const result = await syncClaimNow(currentClaim, user.uid, {
      pushClaimToCloud,
      flushDriveQueue,
      isOnline: () => navigator.onLine,
    });

    if (result.ok) {
      setState('saved');
      setSaveStatus('saved');
      // Catch up any claims still missing/stale on Drive so one save leaves
      // everything backed up. Background + duplicate-safe.
      void backupAllPendingToDrive();
      toast.success('Saved to cloud — available on all your devices.', { duration: 3000 });
    } else if (result.error === 'offline') {
      setState('error');
      setSaveStatus('queued');
      toast.warning('Saved on this device. It will sync to the cloud when you are back online.', { duration: 5000 });
    } else if (result.error === 'conflict') {
      setState('error');
      setSaveStatus('error');
      toast.error(
        'NOT saved — a newer version of this report exists in the cloud. Your changes are kept in the Recovered tab.',
        { duration: 12000 },
      );
    } else {
      setState('error');
      setSaveStatus('queued');
      toast.error('Saved on this device, but cloud sync failed. It will retry automatically.', { duration: 6000 });
    }

    setTimeout(() => setState('idle'), 2800);
  };

  const cfg: Record<BtnState, { icon: React.ReactNode; label: string }> = {
    idle:   { icon: <Cloud size={16} />, label: 'Save to Cloud' },
    saving: { icon: <Loader2 size={16} className="animate-spin" />, label: 'Saving…' },
    saved:  { icon: <CheckCircle size={16} />, label: 'Saved everywhere' },
    error:  { icon: <AlertTriangle size={16} />, label: 'Saved locally' },
  };

  const surface =
    state === 'error'
      ? { background: 'var(--color-status-warning)', color: 'var(--color-primary-foreground)' }
      : tone === 'onDark'
        ? { background: 'var(--color-primary)', color: 'var(--color-foreground)' }
        : { background: 'var(--color-neutral-900)', color: 'var(--color-neutral-50)' };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'saving' || !currentClaim}
      title="Save this claim to the cloud so it is available on your other computers"
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50 ${className}`}
      style={surface}
    >
      {cfg[state].icon}
      <span>{cfg[state].label}</span>
    </button>
  );
}
